import 'dotenv/config';
import express, { type Request, type Response } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, Type, ThinkingLevel } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

async function startServer() {
  const app = express();
  const port = Number(process.env.PORT) || 3000;

  app.use(express.json({ limit: '1mb' }));

  app.use('/api', (req: Request, res: Response, next) => {
    if (req.method === 'OPTIONS') {
      res.setHeader('Allow', 'GET, POST, OPTIONS');
      res.status(204).end();
      return;
    }
    next();
  });

  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({ ok: true });
  });

  app.post('/api/generate-questions', async (req: Request, res: Response) => {
    const body = (req.body || {}) as GenerateQuestionsRequest;
    const uraianMateri = typeof body.uraianMateri === 'string' ? body.uraianMateri.trim() : '';
    const subject = typeof body.subject === 'string' ? body.subject.trim() : 'Mata Pelajaran';

    const rawPg = Number(body.pgCount);
    const rawEssay = Number(body.essayCount);

    if (!Number.isInteger(rawPg) || rawPg < 0 || rawPg > 50) {
      res.status(400).json({ error: 'Jumlah soal Pilihan Ganda harus bilangan bulat antara 0 sampai 50.' });
      return;
    }

    if (!Number.isInteger(rawEssay) || rawEssay < 0 || rawEssay > 5) {
      res.status(400).json({ error: 'Jumlah soal Uraian harus bilangan bulat antara 0 sampai 5.' });
      return;
    }

    if (rawPg + rawEssay === 0) {
      res.status(400).json({ error: 'Minimal tentukan 1 soal Pilihan Ganda atau 1 soal Uraian.' });
      return;
    }

    if (uraianMateri.length < 10) {
      res.status(400).json({ error: 'Uraian materi terlalu singkat. Masukkan minimal 10 karakter materi ajar.' });
      return;
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      res.status(500).json({
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

      // Split PG > 10 into parallel chunks so output JSON never truncates or times out
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

      res.json({
        title: chosenTitle || `Latihan Soal ${subject}`,
        multipleChoice,
        essay,
      });
    } catch (err) {
      console.error('Error generating questions:', err);
      const status = (err as { status?: number })?.status;
      const message = err instanceof Error ? err.message : 'Terjadi kesalahan saat menghubungi layanan AI.';
      if (status === 429) {
        res.status(429).json({ error: 'Batas permintaan AI tercapai sementara. Silakan tunggu beberapa detik lalu coba lagi.' });
        return;
      }
      if (status === 401 || status === 403) {
        res.status(500).json({ error: 'Kunci API AI tidak valid atau belum diizinkan pada server.' });
        return;
      }
      res.status(500).json({ error: `Gagal membuat soal: ${message}` });
    }
  });

  app.post('/api/grade-cbt-essay', async (req: Request, res: Response) => {
    const body = (req.body || {}) as {
      subject?: unknown;
      items?: unknown;
    };
    const subject = typeof body.subject === 'string' ? body.subject.trim() : 'Mata Pelajaran';
    const rawItems = Array.isArray(body.items)
      ? (body.items as Array<{ id?: unknown; question?: unknown; answerKey?: unknown; studentAnswer?: unknown }>).slice(0, 5)
      : [];

    if (rawItems.length === 0) {
      res.status(400).json({ error: 'Daftar soal uraian kosong.' });
      return;
    }

    const normalized = rawItems.map((it, idx) => ({
      id: typeof it.id === 'string' && it.id.trim() ? it.id.trim() : `es_${idx}`,
      question: typeof it.question === 'string' ? it.question.trim().slice(0, 1500) : '',
      answerKey: typeof it.answerKey === 'string' ? it.answerKey.trim().slice(0, 1500) : '',
      studentAnswer: typeof it.studentAnswer === 'string' ? it.studentAnswer.trim().slice(0, 3000) : '',
    }));

    const nonEmpty = normalized.filter((it) => it.studentAnswer.length > 0);
    if (nonEmpty.length === 0) {
      const perQuestionScores: Record<string, number> = {};
      normalized.forEach((it) => {
        perQuestionScores[it.id] = 0;
      });
      res.json({ essayScore: 0, perQuestionScores });
      return;
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      res.status(503).json({ error: 'GEMINI_API_KEY belum tersedia di server.' });
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

      const prompt = `Nilai jawaban uraian siswa untuk mata pelajaran "${subject}".
Beri skor 0 sampai 100 untuk setiap ID soal berdasarkan kesesuaian konsep/makna jawaban siswa dengan kunci jawaban/rubrik.
Aturan:
- Jawaban kosong = 0.
- Jawaban benar & lengkap sesuai konsep kunci = 85–100.
- Jawaban benar sebagian atau kurang lengkap = 50–80.
- Jawaban melenceng namun ada usaha relevan = 15–45.
- Jangan menghukum perbedaan parafrase selama makna konsep benar.

Data soal dan jawaban:
${JSON.stringify(nonEmpty)}`;

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              grades: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    id: { type: Type.STRING },
                    score: { type: Type.INTEGER },
                  },
                  required: ['id', 'score'],
                },
              },
            },
            required: ['grades'],
          },
          thinkingConfig: {
            thinkingLevel: ThinkingLevel.LOW,
          },
        },
      });

      const parsed = JSON.parse((response.text || '{}').trim()) as {
        grades?: Array<{ id?: unknown; score?: unknown }>;
      };

      const perQuestionScores: Record<string, number> = {};
      normalized.forEach((it) => {
        perQuestionScores[it.id] = 0;
      });

      if (Array.isArray(parsed.grades)) {
        parsed.grades.forEach((g) => {
          if (typeof g.id === 'string' && g.id in perQuestionScores) {
            const item = normalized.find((n) => n.id === g.id);
            if (!item || !item.studentAnswer) {
              perQuestionScores[g.id] = 0;
            } else {
              const rawNum = typeof g.score === 'number' ? Math.round(g.score) : 0;
              perQuestionScores[g.id] = Math.min(100, Math.max(0, rawNum));
            }
          }
        });
      }

      const total = normalized.reduce((acc, it) => acc + (perQuestionScores[it.id] ?? 0), 0);
      const essayScore = Math.round(total / normalized.length);

      res.json({ essayScore, perQuestionScores });
    } catch (err) {
      console.error('Error grading CBT essay:', err);
      res.status(500).json({ error: 'Gagal menilai jawaban uraian dengan AI.' });
    }
  });

  app.get('/api/whatsapp/status', (_req: Request, res: Response) => {
    const token = process.env.WHATSAPP_TOKEN?.trim() || '';
    const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID?.trim() || '';
    const provider =
      process.env.WHATSAPP_PROVIDER?.trim().toLowerCase() ||
      (phoneNumberId ? 'meta' : 'fonnte');

    res.json({
      configured: Boolean(token),
      provider,
    });
  });

  app.post('/api/whatsapp/broadcast', async (req: Request, res: Response) => {
    const token = process.env.WHATSAPP_TOKEN?.trim() || '';
    const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID?.trim() || '';
    const provider =
      process.env.WHATSAPP_PROVIDER?.trim().toLowerCase() ||
      (phoneNumberId ? 'meta' : 'fonnte');
    const gatewayUrl =
      process.env.WHATSAPP_GATEWAY_URL?.trim() ||
      (provider === 'wablas'
        ? 'https://solo.wablas.com/api/send-message'
        : 'https://api.fonnte.com/send');

    if (!token) {
      res.status(503).json({
        error:
          'Gateway WhatsApp otomatis belum aktif di server (WHATSAPP_TOKEN belum diatur). Gunakan mode Kirim Langsung via WhatsApp (wa.me) atau atur WHATSAPP_TOKEN di environment server.',
      });
      return;
    }

    const body = (req.body || {}) as {
      recipients?: Array<{ id?: unknown; name?: unknown; phone?: unknown; message?: unknown }>;
      defaultMessage?: unknown;
    };

    const rawRecipients = Array.isArray(body.recipients) ? body.recipients : [];
    const defaultMessage = typeof body.defaultMessage === 'string' ? body.defaultMessage.trim() : '';

    if (rawRecipients.length === 0) {
      res.status(400).json({ error: 'Daftar penerima WhatsApp kosong.' });
      return;
    }

    if (rawRecipients.length > 200) {
      res.status(400).json({ error: 'Maksimal 200 penerima per sekali pengiriman broadcast.' });
      return;
    }

    const normalizePhone = (raw: string): string => {
      const digits = raw.replace(/\D/g, '');
      if (!digits) return '';
      let clean = digits;
      if (clean.startsWith('0')) clean = '62' + clean.slice(1);
      else if (clean.startsWith('8')) clean = '62' + clean;
      return clean.length >= 9 && clean.length <= 15 ? clean : '';
    };

    const results: Array<{
      id: string;
      name: string;
      phone: string;
      ok: boolean;
      detail: string;
    }> = [];

    for (let i = 0; i < rawRecipients.length; i++) {
      const item = rawRecipients[i];
      const recId = typeof item.id === 'string' ? item.id : `rec_${i}`;
      const recName = typeof item.name === 'string' ? item.name.trim() : 'Siswa';
      const rawPhone = typeof item.phone === 'string' ? item.phone : '';
      const phone = normalizePhone(rawPhone);
      const text =
        typeof item.message === 'string' && item.message.trim().length > 0
          ? item.message.trim()
          : defaultMessage;

      if (!phone) {
        results.push({ id: recId, name: recName, phone: rawPhone, ok: false, detail: 'Nomor WA tidak valid' });
        continue;
      }

      if (!text) {
        results.push({ id: recId, name: recName, phone, ok: false, detail: 'Pesan kosong' });
        continue;
      }

      try {
        let gwRes: globalThis.Response;

        if (provider === 'meta' && phoneNumberId) {
          gwRes = await fetch(`https://graph.facebook.com/v21.0/${phoneNumberId}/messages`, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              messaging_product: 'whatsapp',
              to: phone,
              type: 'text',
              text: { body: text },
            }),
          });
        } else if (provider === 'wablas') {
          gwRes = await fetch(gatewayUrl, {
            method: 'POST',
            headers: {
              Authorization: token,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ phone, message: text }),
          });
        } else {
          const form = new URLSearchParams();
          form.append('target', phone);
          form.append('message', text);
          form.append('countryCode', '62');
          gwRes = await fetch(gatewayUrl, {
            method: 'POST',
            headers: {
              Authorization: token,
            },
            body: form,
          });
        }

        const payload = (await gwRes.json().catch(() => ({}))) as {
          status?: boolean;
          reason?: string;
          message?: string;
          error?: { message?: string };
        };

        const isOk = gwRes.ok && payload.status !== false && !payload.error;
        results.push({
          id: recId,
          name: recName,
          phone,
          ok: isOk,
          detail: isOk
            ? 'Terkirim'
            : payload.error?.message || payload.reason || payload.message || `HTTP ${gwRes.status}`,
        });
      } catch (err) {
        results.push({
          id: recId,
          name: recName,
          phone,
          ok: false,
          detail: err instanceof Error ? err.message : 'Gagal menghubungi gateway',
        });
      }

      if (i < rawRecipients.length - 1) {
        await new Promise((r) => setTimeout(r, 300));
      }
    }

    const sentCount = results.filter((r) => r.ok).length;
    res.json({
      total: results.length,
      sentCount,
      failedCount: results.length - sentCount,
      results,
    });
  });

  app.all('/api/generate-questions', (_req: Request, res: Response) => {
    res.status(405).json({ error: 'Metode tidak diizinkan. Gunakan metode POST ke /api/generate-questions.' });
  });

  app.all('/api/grade-cbt-essay', (_req: Request, res: Response) => {
    res.status(405).json({ error: 'Metode tidak diizinkan. Gunakan metode POST ke /api/grade-cbt-essay.' });
  });

  app.all('/api/whatsapp/broadcast', (_req: Request, res: Response) => {
    res.status(405).json({ error: 'Metode tidak diizinkan. Gunakan metode POST ke /api/whatsapp/broadcast.' });
  });

  app.use('/api', (_req: Request, res: Response) => {
    res.status(404).json({ error: 'Endpoint API tidak ditemukan.' });
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(port, '0.0.0.0', () => {
    console.log(`GuruMapel LMS server running on http://0.0.0.0:${port}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
