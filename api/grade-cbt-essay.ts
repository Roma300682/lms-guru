import type { IncomingMessage, ServerResponse } from 'node:http';
import { GoogleGenAI, Type, ThinkingLevel } from '@google/genai';

interface GradeEssayItemInput {
  id?: unknown;
  question?: unknown;
  answerKey?: unknown;
  studentAnswer?: unknown;
}

interface GradeEssayRequest {
  subject?: unknown;
  items?: unknown;
}

type VercelLikeReq = IncomingMessage & { body?: unknown };

const GRADE_RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    grades: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING },
          score: {
            type: Type.INTEGER,
            description: 'Skor objektif antara 0 sampai 100 berdasarkan kesesuaian jawaban siswa dengan kunci jawaban/rubrik.',
          },
        },
        required: ['id', 'score'],
      },
    },
  },
  required: ['grades'],
};

function sendJson(res: ServerResponse, statusCode: number, payload: unknown) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(payload));
}

async function readRequestBody(req: VercelLikeReq): Promise<GradeEssayRequest> {
  if (req.body && typeof req.body === 'object') {
    return req.body as GradeEssayRequest;
  }
  if (typeof req.body === 'string' && req.body.trim()) {
    return JSON.parse(req.body) as GradeEssayRequest;
  }
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  const raw = Buffer.concat(chunks).toString('utf8').trim();
  if (!raw) return {};
  return JSON.parse(raw) as GradeEssayRequest;
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
      error: 'Metode tidak diizinkan. Gunakan metode POST ke /api/grade-cbt-essay.',
    });
    return;
  }

  let body: GradeEssayRequest;
  try {
    body = await readRequestBody(req);
  } catch {
    sendJson(res, 400, { error: 'Body permintaan harus berupa JSON yang valid.' });
    return;
  }

  const subject = typeof body.subject === 'string' ? body.subject.trim() : 'Mata Pelajaran';
  const rawItems = Array.isArray(body.items) ? (body.items as GradeEssayItemInput[]).slice(0, 5) : [];

  if (rawItems.length === 0) {
    sendJson(res, 400, { error: 'Daftar soal uraian kosong.' });
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
    sendJson(res, 200, { essayScore: 0, perQuestionScores });
    return;
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    sendJson(res, 503, { error: 'GEMINI_API_KEY belum tersedia di server.' });
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
        responseSchema: GRADE_RESPONSE_SCHEMA,
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

    sendJson(res, 200, { essayScore, perQuestionScores });
  } catch (err) {
    console.error('Error grading CBT essay:', err);
    sendJson(res, 500, { error: 'Gagal menilai jawaban uraian dengan AI.' });
  }
}
