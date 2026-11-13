import { GeneratedEssayQuestion } from '../types/lms';

const STOPWORDS = new Set([
  'yang', 'dan', 'di', 'ke', 'dari', 'adalah', 'ialah', 'merupakan', 'untuk',
  'dengan', 'pada', 'atau', 'itu', 'ini', 'juga', 'dalam', 'sebagai', 'oleh',
  'karena', 'sebab', 'agar', 'supaya', 'bisa', 'dapat', 'akan', 'telah', 'sudah',
  'belum', 'tidak', 'bukan', 'sangat', 'lebih', 'paling', 'antara', 'seperti',
  'yaitu', 'yakni', 'serta', 'maupun', 'secara', 'suatu', 'sebuah', 'para', 'hal',
  'the', 'is', 'are', 'was', 'were', 'and', 'or', 'of', 'to', 'in', 'for', 'with',
  'that', 'this', 'from', 'by', 'as', 'an', 'a',
]);

export function resolveEssayWeight(
  pgCount: number,
  essayCount: number,
  configuredWeight?: number
): number {
  if (essayCount <= 0) return 0;
  if (pgCount <= 0) return 100;
  if (
    typeof configuredWeight === 'number' &&
    !Number.isNaN(configuredWeight) &&
    configuredWeight > 0 &&
    configuredWeight < 100
  ) {
    return Math.round(configuredWeight);
  }
  return 30;
}

export function computeFinalCbtScore(
  pgScore: number,
  essayScore: number | undefined,
  pgCount: number,
  essayCount: number,
  configuredWeight?: number
): number {
  const safePg = Math.min(100, Math.max(0, Math.round(pgScore || 0)));
  if (essayCount <= 0) {
    return safePg;
  }
  if (pgCount <= 0) {
    return typeof essayScore === 'number' && !Number.isNaN(essayScore)
      ? Math.min(100, Math.max(0, Math.round(essayScore)))
      : 0;
  }
  if (typeof essayScore !== 'number' || Number.isNaN(essayScore)) {
    return safePg;
  }
  const safeEssay = Math.min(100, Math.max(0, Math.round(essayScore)));
  const essayWeight = resolveEssayWeight(pgCount, essayCount, configuredWeight);
  const pgWeight = 100 - essayWeight;
  return Math.min(
    100,
    Math.max(0, Math.round((safePg * pgWeight + safeEssay * essayWeight) / 100))
  );
}

function tokenizeKeywords(text: string): string[] {
  const normalized = text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/gi, ' ')
    .split(/\s+/)
    .map((w) => w.trim())
    .filter((w) => w.length >= 3 && !STOPWORDS.has(w));
  return Array.from(new Set(normalized));
}

export function scoreSingleEssayDeterministic(
  studentAnswer: string,
  answerKey: string
): number {
  const cleanAns = (studentAnswer || '').trim();
  if (!cleanAns) return 0;

  const ansLower = cleanAns.toLowerCase();
  const keyTokens = tokenizeKeywords(answerKey || '');
  const ansTokens = tokenizeKeywords(cleanAns);

  if (keyTokens.length === 0) {
    // No rubric keywords provided: score based on non-empty substantive length
    if (ansTokens.length >= 8 || cleanAns.length >= 50) return 85;
    if (ansTokens.length >= 4 || cleanAns.length >= 20) return 70;
    return 50;
  }

  let hits = 0;
  keyTokens.forEach((kw) => {
    if (ansTokens.includes(kw) || ansLower.includes(kw)) {
      hits += 1;
    } else if (kw.length >= 5 && ansTokens.some((at) => at.startsWith(kw.slice(0, 5)) || kw.startsWith(at.slice(0, 5)))) {
      hits += 0.7;
    }
  });

  const recall = Math.min(1, hits / keyTokens.length);
  if (recall === 0) {
    // Student attempted an answer, but no key concept matched
    return ansTokens.length >= 5 ? 25 : 15;
  }

  // Scale smoothly between 40 and 100 when key concepts match
  return Math.min(100, Math.round(35 + recall * 65));
}

export function gradeEssaysLocally(
  questions: GeneratedEssayQuestion[],
  answers: Record<string, string>
): { essayScore: number; perQuestionScores: Record<string, number> } {
  if (!questions || questions.length === 0) {
    return { essayScore: 0, perQuestionScores: {} };
  }
  const perQuestionScores: Record<string, number> = {};
  let sum = 0;
  questions.forEach((q) => {
    const score = scoreSingleEssayDeterministic(answers[q.id] || '', q.answerKey || '');
    perQuestionScores[q.id] = score;
    sum += score;
  });
  return {
    essayScore: Math.round(sum / questions.length),
    perQuestionScores,
  };
}
