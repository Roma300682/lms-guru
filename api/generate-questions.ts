import type { IncomingMessage, ServerResponse } from 'node:http';
import { GoogleGenAI, Type, ThinkingLevel } from '@google/genai';

interface GenerateQuestionsRequest {
  uraianMateri?: unknown;
  pgCount?: unknown;
  essayCount?: unknown;
  subject?: unknown;
}

interface RawPGItem {
  question?: unknown;
  options?: unknown;
  correctIndex?: unknown;
  explanation?: unknown;
}

interface RawEssayItem {
  question?: unknown;
  answerKey?: unknown;
}

interface RawAIResult {
  title?: unknown;
  multipleChoice?: unknown;
  essay?: unknown;
}

type VercelLikeReq = IncomingMessage & { body?: unknown };

const QUESTION_RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    title: {
      type: Type.STRING,
      description: 'Judul paket soal yang singkat dan sesuai dengan uraian materi.',
    },
    multipleChoice: {
      type: Type.ARRAY,
      description: 'Daftar soal pilihan ganda. Kosongkan ([]) jika pgCount bernilai 0.',
      items: {
        type: Type.OBJECT,
        properties: {
          question: {
            type: Type.STRING,
            description: 'Teks pertanyaan pilihan ganda yang jelas tanpa nomor urut.',
          },
          options: {
            type: Type.ARRAY,
            description: 'Tepat 4 pilihan jawaban (A, B, C, D) tanpa awalan huruf A./B./C./D.',
            items: {
              type: Type.STRING,
            },
          },
          correctIndex: {
            type: Type.INTEGER,
            description: 'Indeks jawaban benar dari array options (0, 1, 2, atau 3).',
          },
          explanation: {
            type: Type.STRING,
            description: 'Pembahasan singkat mengapa jawaban tersebut benar berdasarkan materi.',
          },
        },
        required: ['question', 'options', 'correctIndex', 'explanation'],
      },
    },
    essay: {
      type: Type.ARRAY,
      description: 'Daftar soal uraian/esai. Kosongkan ([]) jika essayCount bernilai 0.',
      items: {
        type: Type.OBJECT,
        properties: {
          question: {
            type: Type.STRING,
            description: 'Teks pertanyaan uraian yang menguji pemahaman atau analisis tanpa nomor urut.',
          },
          answerKey: {
            type: Type.STRING,
            description: 'Kunci jawaban atau rubrik poin penilaian yang ringkas dan jelas.',
          },
        },
        required: ['question', 'answerKey'],
      },
    },
  },
  required: ['title', 'multipleChoice', 'essay'],
};

function sendJson(res: ServerResponse, statusCode: number, payload: unknown) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(payload));
}

async function readRequestBody(req: VercelLikeReq): Promise<GenerateQuestionsRequest> {
  if (req.body && typeof req.body === 'object') {
    return req.body as GenerateQuestionsRequest;
  }
  if (typeof req.body === 'string' && req.body.trim()) {
    return JSON.parse(req.body) as GenerateQuestionsRequest;
  }

  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  const raw = Buffer.concat(chunks).toString('utf8').trim();
  if (!raw) return {};
  return JSON.parse(raw) as GenerateQuestionsRequest;
}

function safeParseModelJson(rawText: string | undefined): RawAIResult {
  const cleaned = (rawText || '')
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();

  if (!cleaned) {
    throw new Error('Respons AI kosong. Silakan coba lagi.');
  }

  try {
    return JSON.parse(cleaned) as RawAIResult;
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Format JSON tidak lengkap';
    throw new Error(`Hasil AI terpotong atau tidak valid (${msg}). Silakan coba lagi.`);
  }
}

async function generateWithRetry<T>(fn: () => Promise<T>, maxRetries = 2): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      const status = (err as { status?: number })?.status;
      const isRetryable = status === undefined || status >= 500 || status === 429;
      if (attempt < maxRetries && isRetryable) {
        await new Promise((resolve) => setTimeout(resolve, 800 * Math.pow(2, attempt)));
        continue;
      }
      throw err;
    }
  }
  throw lastError;
}

export default async function handler(req: VercelLikeReq, res: ServerResponse) {
  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.setHeader('Allow', 'POST, OPTIONS');
    res.end();
    return;
  }

  if (req.method !== 'POST') {
    sendJson(res, 405, {
      error: 'Metode tidak diizinkan. Gunakan metode POST ke /api/generate-questions.',
    });
    return;
  }

  let body: GenerateQuestionsRequest;
  try {
    body = await readRequestBody(req);
  } catch {
    sendJson(res, 400, { error: 'Body permintaan harus berupa JSON yang valid.' });
    return;
  }

  const uraianMateri = typeof body.uraianMateri === 'string' ? body.uraianMateri.trim() : '';
  const subject = typeof body.subject === 'string' ? body.subject.trim() : 'Mata Pelajaran';
  const rawPg = Number(body.pgCount);
  const rawEssay = Number(body.essayCount);

  if (!Number.isInteger(rawPg) || rawPg < 0 || rawPg > 50) {
    sendJson(res, 400, { error: 'Jumlah soal Pilihan Ganda harus bilangan bulat antara 0 sampai 50.' });
    return;
  }

  if (!Number.isInteger(rawEssay) || rawEssay < 0 || rawEssay > 5) {
    sendJson(res, 400, { error: 'Jumlah soal Uraian harus bilangan bulat antara 0 sampai 5.' });
    return;
  }

  if (rawPg + rawEssay === 0) {
    sendJson(res, 400, { error: 'Minimal tentukan 1 soal Pilihan Ganda atau 1 soal Uraian.' });
    return;
  }

  if (uraianMateri.length < 10) {
    sendJson(res, 400, { error: 'Uraian materi terlalu singkat. Masukkan minimal 10 karakter materi ajar.' });
    return;
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    sendJson(res, 500, {
      error: 'Konfigurasi GEMINI_API_KEY belum tersedia di server. Silakan atur environment variable GEMINI_API_KEY.',
    });
    return;
  }

  try {
    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });

    const generateChunk = async (
      pgTarget: number,
      essayTarget: number,
      batchHint: string
    ): Promise<RawAIResult> => {
      const systemInstruction = `Anda adalah guru mata pelajaran "${subject}" yang ahli menyusun evaluasi pembelajaran kurikulum Indonesia.
Tugas Anda menyusun soal berkualitas HOTS maupun pemahaman konsep HANYA berdasarkan uraian materi yang diberikan pengguna.

Aturan Ketat:
1. Buat TEPAT ${pgTarget} soal Pilihan Ganda (multipleChoice). Jika ${pgTarget} = 0, kembalikan array kosong [].
2. Buat TEPAT ${essayTarget} soal Uraian (essay). Jika ${essayTarget} = 0, kembalikan array kosong [].
3. Setiap soal Pilihan Ganda wajib memiliki TEPAT 4 opsi jawaban (A, B, C, D) tanpa awalan huruf "A. "/"1. ".
4. Pastikan opsi pengecoh masuk akal dan hanya ada 1 jawaban paling benar (correctIndex: 0, 1, 2, atau 3).
5. Pembahasan (explanation) dan kunci uraian (answerKey) cukup 1 kalimat padat dan jelas.
6. Jangan sertakan nomor urut di awal teks pertanyaan.
7. Gunakan bahasa Indonesia yang baik dan baku (kecuali jika materi berbahasa asing).`;

      const userPrompt = `Susun paket soal evaluasi untuk mata pelajaran ${subject} ${batchHint}dengan ketentuan:
- Jumlah Pilihan Ganda: ${pgTarget} soal
- Jumlah Uraian: ${essayTarget} soal

=== URAIAN MATERI ===
${uraianMateri.slice(0, 30000)}`;

      return generateWithRetry(async () => {
        const response = await ai.models.generateContent({
          model: 'gemini-4-hydrogen',
          contents: userPrompt,
          config: {
            systemInstruction,
            responseMimeType: 'application/json',
            responseSchema: QUESTION_RESPONSE_SCHEMA,
            thinkingConfig: {
              thinkingLevel: ThinkingLevel.LOW,
            },
          },
        });
        return safeParseModelJson(response.text);
      });
    };

    const MAX_PG_PER_CHUNK = 10;
    const chunks: Array<{ pg: number; essay: number; hint: string }> = [];

    if (rawPg === 0) {
      chunks.push({ pg: 0, essay: rawEssay, hint: '' });
    } else {
      let remainingPg = rawPg;
      let idx = 1;
      const totalBatches = Math.ceil(rawPg / MAX_PG_PER_CHUNK);
      while (remainingPg > 0) {
        const takePg = Math.min(MAX_PG_PER_CHUNK, remainingPg);
        const takeEssay = idx === 1 ? rawEssay : 0;
        chunks.push({
          pg: takePg,
          essay: takeEssay,
          hint: totalBatches > 1 ? `(Bagian ${idx} dari ${totalBatches}, fokus variasi topik berbeda) ` : '',
        });
        remainingPg -= takePg;
        idx++;
      }
    }

    const chunkResults = await Promise.all(
      chunks.map((c) => generateChunk(c.pg, c.essay, c.hint))
    );

    const now = Date.now();
    const allRawPG: RawPGItem[] = [];
    const allRawEssay: RawEssayItem[] = [];
    let chosenTitle = '';

    chunkResults.forEach((parsed) => {
      if (!chosenTitle && typeof parsed.title === 'string' && parsed.title.trim()) {
        chosenTitle = parsed.title.trim();
      }
      if (Array.isArray(parsed.multipleChoice)) {
        allRawPG.push(...(parsed.multipleChoice as RawPGItem[]));
      }
      if (Array.isArray(parsed.essay)) {
        allRawEssay.push(...(parsed.essay as RawEssayItem[]));
      }
    });

    const multipleChoice = rawPg === 0
      ? []
      : allRawPG.slice(0, rawPg).map((item, idx) => {
          const rawOpts = Array.isArray(item.options)
            ? item.options.map((o) => String(o || '').trim()).filter(Boolean)
            : [];
          const options = [
            rawOpts[0] || 'Opsi A',
            rawOpts[1] || 'Opsi B',
            rawOpts[2] || 'Opsi C',
            rawOpts[3] || 'Opsi D',
          ];
          const numericIdx = typeof item.correctIndex === 'number' ? Math.trunc(item.correctIndex) : 0;
          const correctIndex = Math.min(3, Math.max(0, numericIdx));

          return {
            id: `pg_${now}_${idx}`,
            question: typeof item.question === 'string' ? item.question.trim() : `Pertanyaan ${idx + 1}`,
            options,
            correctIndex,
            explanation: typeof item.explanation === 'string' ? item.explanation.trim() : '',
          };
        });

    const essay = rawEssay === 0
      ? []
      : allRawEssay.slice(0, rawEssay).map((item, idx) => ({
          id: `es_${now}_${idx}`,
          question: typeof item.question === 'string' ? item.question.trim() : `Soal Uraian ${idx + 1}`,
          answerKey: typeof item.answerKey === 'string' ? item.answerKey.trim() : '',
        }));

    sendJson(res, 200, {
      title: chosenTitle || `Latihan Soal ${subject}`,
      multipleChoice,
      essay,
    });
  } catch (err) {
    console.error('Error generating questions:', err);
    const status = (err as { status?: number })?.status;
    const message = err instanceof Error ? err.message : 'Terjadi kesalahan saat menghubungi layanan AI.';
    if (status === 429) {
      sendJson(res, 429, { error: 'Batas permintaan AI tercapai sementara. Silakan tunggu beberapa detik lalu coba lagi.' });
      return;
    }
    if (status === 401 || status === 403) {
      sendJson(res, 500, { error: 'Kunci API AI tidak valid atau belum diizinkan pada server.' });
      return;
    }
    sendJson(res, 500, { error: `Gagal membuat soal: ${message}` });
  }
}
