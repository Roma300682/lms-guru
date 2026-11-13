import React, { useState, useEffect, useRef, useMemo } from 'react';
import { CbtExam, CbtAttempt, Student } from '../types/lms';
import {
  MonitorCheck,
  Clock,
  CheckCircle2,
  XCircle,
  ArrowLeft,
  ArrowRight,
  Send,
  Award,
  AlertCircle,
  Play,
  Eye,
  StopCircle,
} from 'lucide-react';

const OPTION_LABELS = ['A', 'B', 'C', 'D'] as const;

const formatTimer = (seconds: number): string => {
  const safe = Math.max(0, Math.trunc(seconds));
  const m = Math.floor(safe / 60);
  const s = safe % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
};

interface StudentCbtPanelProps {
  student?: Student;
  exams: CbtExam[];
  results: CbtAttempt[];
  kktp: number;
  fallbackSubject: string;
  onSubmitAttempt: (attempt: Omit<CbtAttempt, 'id' | 'submittedAt'>) => CbtAttempt;
}

export const StudentCbtPanel: React.FC<StudentCbtPanelProps> = ({
  student,
  exams,
  results,
  kktp,
  fallbackSubject,
  onSubmitAttempt,
}) => {
  // Active Exam Runner State
  const [activeExam, setActiveExam] = useState<CbtExam | null>(null);
  const [currentIdx, setCurrentIdx] = useState<number>(0);
  const [pgAnswers, setPgAnswers] = useState<Record<string, number>>({});
  const [essayAnswers, setEssayAnswers] = useState<Record<string, string>>({});
  const [remainingSec, setRemainingSec] = useState<number>(0);
  const [confirmSubmitOpen, setConfirmSubmitOpen] = useState<boolean>(false);
  const [confirmStopOpen, setConfirmStopOpen] = useState<boolean>(false);
  const [stopNotice, setStopNotice] = useState<string>('');

  // Instant Result Review State
  const [reviewState, setReviewState] = useState<{
    exam: CbtExam;
    attempt: CbtAttempt;
    stoppedReason?: 'teacher' | 'student' | 'timeout';
  } | null>(null);

  const startedAtRef = useRef<number>(0);
  const hasSubmittedRef = useRef<boolean>(false);

  // Flattened questions list for active exam: PG first, then Essay
  const combinedItems = useMemo(() => {
    if (!activeExam) return [];
    const pgItems = activeExam.multipleChoice.map((q, idx) => ({
      kind: 'pg' as const,
      number: idx + 1,
      question: q,
    }));
    const offset = pgItems.length;
    const essayItems = activeExam.essay.map((q, idx) => ({
      kind: 'essay' as const,
      number: offset + idx + 1,
      question: q,
    }));
    return [...pgItems, ...essayItems];
  }, [activeExam]);

  const startExam = (exam: CbtExam) => {
    if (!student || !exam.isActive) return;
    setActiveExam(exam);
    setReviewState(null);
    setStopNotice('');
    setCurrentIdx(0);
    setPgAnswers({});
    setEssayAnswers({});
    setRemainingSec(exam.durationMinutes * 60);
    setConfirmSubmitOpen(false);
    setConfirmStopOpen(false);
    startedAtRef.current = Date.now();
    hasSubmittedRef.current = false;
  };

  const finalizeSubmit = useRef<(reason?: 'teacher' | 'student' | 'timeout') => void>(() => {});
  finalizeSubmit.current = (reason?: 'teacher' | 'student' | 'timeout') => {
    if (!activeExam || !student || hasSubmittedRef.current) return;
    hasSubmittedRef.current = true;

    const pgTotal = activeExam.multipleChoice.length;
    let pgCorrect = 0;
    activeExam.multipleChoice.forEach((q) => {
      if (pgAnswers[q.id] === q.correctIndex) {
        pgCorrect += 1;
      }
    });
    const pgScore = pgTotal > 0 ? Math.round((pgCorrect / pgTotal) * 100) : 0;
    const finalScore = pgTotal > 0 ? pgScore : 0;
    const durationSpentSec = Math.max(
      1,
      Math.round((Date.now() - startedAtRef.current) / 1000)
    );

    const savedAttempt = onSubmitAttempt({
      examId: activeExam.id,
      examTitle: activeExam.title,
      questionSetId: activeExam.questionSetId,
      studentId: student.id,
      studentName: student.name,
      classId: student.classId,
      subject: activeExam.subject || fallbackSubject,
      pgAnswers,
      essayAnswers,
      pgCorrect,
      pgTotal,
      pgScore,
      finalScore,
      durationSpentSec,
    });

    const completedExam = activeExam;
    setActiveExam(null);
    setConfirmSubmitOpen(false);
    setConfirmStopOpen(false);
    setReviewState({ exam: completedExam, attempt: savedAttempt, stoppedReason: reason });
  };

  // Real-time force-stop if teacher stops/closes or deletes the active CBT exam
  useEffect(() => {
    if (!activeExam) return;
    const latest = exams.find((e) => e.id === activeExam.id);
    if (!latest) {
      setActiveExam(null);
      setConfirmSubmitOpen(false);
      setConfirmStopOpen(false);
      setStopNotice(`Ujian CBT "${activeExam.title}" telah dihapus atau dihentikan oleh guru.`);
      return;
    }
    if (!latest.isActive) {
      finalizeSubmit.current('teacher');
    }
  }, [exams, activeExam]);

  // Countdown tick while activeExam is open
  useEffect(() => {
    if (!activeExam) return;
    const timer = window.setInterval(() => {
      setRemainingSec((prev) => {
        if (prev <= 1) {
          window.clearInterval(timer);
          finalizeSubmit.current('timeout');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [activeExam]);

  // Reset runner/review when switching student simulation
  useEffect(() => {
    setActiveExam(null);
    setReviewState(null);
    setConfirmSubmitOpen(false);
    setConfirmStopOpen(false);
    setStopNotice('');
  }, [student?.id]);

  // =========================================================================
  // VIEW 1: ACTIVE CBT EXAM RUNNER
  // =========================================================================
  if (activeExam) {
    const currentItem = combinedItems[currentIdx];
    const totalCount = combinedItems.length;
    const answeredCount =
      Object.keys(pgAnswers).length +
      Object.values(essayAnswers).filter((v) => v.trim().length > 0).length;
    const isUrgent = remainingSec <= 120;

    return (
      <div className="space-y-4">
        {/* Top Exam Status Bar */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 sticky top-16 z-20 shadow-xs">
          <div className="min-w-0">
            <div className="text-[11px] font-semibold text-indigo-700 uppercase tracking-wide">
              Ujian CBT Online · {activeExam.subject}
            </div>
            <h3 className="text-sm sm:text-base font-bold text-slate-900 truncate">
              {activeExam.title}
            </h3>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <div
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border font-mono tabular-nums text-xs font-bold ${
                isUrgent
                  ? 'bg-rose-50 text-rose-700 border-rose-300 animate-pulse'
                  : 'bg-slate-50 text-slate-800 border-slate-200'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              <span>Sisa Waktu: {formatTimer(remainingSec)}</span>
            </div>

            <div className="text-xs font-medium text-slate-600 font-mono tabular-nums px-2.5 py-1.5 bg-slate-50 rounded-lg border border-slate-200">
              Terjawab {answeredCount}/{totalCount}
            </div>

            {!confirmSubmitOpen && !confirmStopOpen && (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setConfirmStopOpen(true);
                    setConfirmSubmitOpen(false);
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg transition-colors"
                >
                  <StopCircle className="w-3.5 h-3.5" />
                  <span>Hentikan Ujian</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setConfirmSubmitOpen(true);
                    setConfirmStopOpen(false);
                  }}
                  className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-xs transition-colors"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Selesaikan &amp; Lihat Hasil</span>
                </button>
              </>
            )}
          </div>
        </div>

        {/* Inline Stop Exam Confirmation Bar */}
        {confirmStopOpen && (
          <div className="p-4 rounded-xl bg-rose-50 border border-rose-300 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="text-xs text-rose-950 space-y-0.5">
              <div className="font-bold flex items-center gap-1.5">
                <StopCircle className="w-4 h-4 text-rose-600" />
                <span>Hentikan Ujian CBT Sekarang?</span>
              </div>
              <div>
                Jika dihentikan, pengerjaan langsung berakhir dan{' '}
                <strong className="font-mono tabular-nums">
                  {answeredCount} dari {totalCount}
                </strong>{' '}
                jawaban yang sudah terisi akan otomatis dikumpulkan ke Ruang Guru.
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => finalizeSubmit.current('student')}
                className="px-4 py-1.5 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-lg shadow-xs"
              >
                Ya, Hentikan &amp; Kumpulkan
              </button>
              <button
                type="button"
                onClick={() => setConfirmStopOpen(false)}
                className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg"
              >
                Lanjutkan Mengerjakan
              </button>
            </div>
          </div>
        )}

        {/* Inline Submit Confirmation Bar */}
        {confirmSubmitOpen && (
          <div className="p-4 rounded-xl bg-amber-50 border border-amber-300 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="text-xs text-amber-950 space-y-0.5">
              <div className="font-bold">
                Kumpulkan jawaban ujian CBT sekarang?
              </div>
              <div>
                Anda baru menjawab{' '}
                <strong className="font-mono tabular-nums">
                  {answeredCount} dari {totalCount}
                </strong>{' '}
                butir soal. Setelah dikumpulkan, skor akan langsung ditampilkan.
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => finalizeSubmit.current()}
                className="px-4 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-xs"
              >
                Ya, Kumpulkan Sekarang
              </button>
              <button
                type="button"
                onClick={() => setConfirmSubmitOpen(false)}
                className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg"
              >
                Lanjutkan Mengerjakan
              </button>
            </div>
          </div>
        )}

        {/* Split Stage: Question Card (Left 3 cols) + Navigator Deck (Right 1 col) */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
          {/* Active Question Stage */}
          <div className="lg:col-span-3 bg-white rounded-xl border border-slate-200 p-5 sm:p-6 space-y-5">
            {currentItem ? (
              <>
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <span className="text-xs font-bold text-indigo-700 uppercase tracking-wide">
                    Soal Nomor {currentItem.number} dari {totalCount} ·{' '}
                    {currentItem.kind === 'pg' ? 'Pilihan Ganda' : 'Uraian'}
                  </span>
                </div>

                <div className="text-sm sm:text-base font-medium text-slate-900 leading-relaxed whitespace-pre-wrap">
                  {currentItem.question.question}
                </div>

                {currentItem.kind === 'pg' ? (
                  <div className="space-y-2.5 pt-1">
                    {currentItem.question.options.map((opt, oIdx) => {
                      const selected =
                        pgAnswers[currentItem.question.id] === oIdx;
                      return (
                        <button
                          key={oIdx}
                          type="button"
                          onClick={() =>
                            setPgAnswers((prev) => ({
                              ...prev,
                              [currentItem.question.id]: oIdx,
                            }))
                          }
                          className={`w-full text-left flex items-start gap-3 p-3.5 rounded-xl border transition-colors ${
                            selected
                              ? 'bg-indigo-50 border-indigo-500 text-indigo-950 shadow-xs'
                              : 'bg-slate-50/50 border-slate-200 hover:bg-slate-100 text-slate-800'
                          }`}
                        >
                          <span
                            className={`w-7 h-7 rounded-lg font-bold text-xs flex items-center justify-center shrink-0 border transition-colors ${
                              selected
                                ? 'bg-indigo-600 text-white border-indigo-600'
                                : 'bg-white text-slate-700 border-slate-300'
                            }`}
                          >
                            {OPTION_LABELS[oIdx]}
                          </span>
                          <span className="text-xs sm:text-sm leading-relaxed pt-0.5">
                            {opt}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-slate-700 block">
                      Jawaban Uraian Anda:
                    </label>
                    <textarea
                      rows={5}
                      value={essayAnswers[currentItem.question.id] || ''}
                      onChange={(e) =>
                        setEssayAnswers((prev) => ({
                          ...prev,
                          [currentItem.question.id]: e.target.value,
                        }))
                      }
                      placeholder="Tuliskan jawaban uraian secara jelas di sini..."
                      className="w-full text-xs sm:text-sm p-3.5 border border-slate-300 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-indigo-500 bg-slate-50/40"
                    />
                  </div>
                )}

                {/* Prev / Next Navigation */}
                <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    disabled={currentIdx === 0}
                    onClick={() => setCurrentIdx((i) => Math.max(0, i - 1))}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 disabled:opacity-40 rounded-lg transition-colors"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>Sebelumnya</span>
                  </button>

                  {currentIdx < totalCount - 1 ? (
                    <button
                      type="button"
                      onClick={() =>
                        setCurrentIdx((i) => Math.min(totalCount - 1, i + 1))
                      }
                      className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors"
                    >
                      <span>Soal Berikutnya</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmSubmitOpen(true)}
                      className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>Kumpulkan Jawaban</span>
                    </button>
                  )}
                </div>
              </>
            ) : null}
          </div>

          {/* Right Question Number Grid */}
          <aside className="lg:col-span-1 bg-white rounded-xl border border-slate-200 p-4 space-y-3 h-fit">
            <div className="text-xs font-bold text-slate-800">
              Navigasi Nomor Soal
            </div>
            <div className="grid grid-cols-5 gap-1.5">
              {combinedItems.map((item, idx) => {
                const isCurrent = idx === currentIdx;
                const isAnswered =
                  item.kind === 'pg'
                    ? pgAnswers[item.question.id] !== undefined
                    : Boolean((essayAnswers[item.question.id] || '').trim());

                return (
                  <button
                    key={item.question.id}
                    type="button"
                    onClick={() => setCurrentIdx(idx)}
                    className={`h-9 rounded-lg font-mono tabular-nums text-xs font-bold border transition-colors ${
                      isCurrent
                        ? 'bg-slate-900 text-white border-slate-900'
                        : isAnswered
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    {item.number}
                  </button>
                );
              })}
            </div>
            <div className="text-[11px] text-slate-500 space-y-1 pt-2 border-t border-slate-100">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded bg-emerald-100 border border-emerald-400 inline-block" />
                <span>Sudah dijawab</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded bg-white border border-slate-300 inline-block" />
                <span>Belum dijawab</span>
              </div>
            </div>
          </aside>
        </div>
      </div>
    );
  }

  // =========================================================================
  // VIEW 2: INSTANT CBT SCORE & ANSWER REVIEW SCREEN
  // =========================================================================
  if (reviewState) {
    const { exam, attempt } = reviewState;
    const latestAttempt =
      results.find((r) => r.id === attempt.id) || attempt;
    const passed = latestAttempt.finalScore >= kktp;
    const hasEssay = exam.essay.length > 0;
    const awaitingEssayScore =
      hasEssay && latestAttempt.essayScore === undefined && exam.multipleChoice.length === 0;

    return (
      <div className="space-y-5">
        {/* Back button */}
        <div>
          <button
            type="button"
            onClick={() => setReviewState(null)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Kembali ke Daftar Ujian CBT</span>
          </button>
        </div>

        {reviewState.stoppedReason && (
          <div className="flex items-center gap-2.5 p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900">
            <StopCircle className="w-4 h-4 text-amber-700 shrink-0" />
            <span>
              {reviewState.stoppedReason === 'teacher'
                ? 'Ujian CBT ini telah dihentikan oleh guru. Seluruh jawaban yang sudah Anda isi otomatis dikumpulkan ke Ruang Guru.'
                : reviewState.stoppedReason === 'timeout'
                ? 'Waktu ujian CBT telah habis. Jawaban Anda otomatis dikumpulkan.'
                : 'Anda telah menghentikan ujian CBT. Jawaban yang sudah terisi telah dikumpulkan ke Ruang Guru.'}
            </span>
          </div>
        )}

        {/* Hero Result Summary Card */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 sm:p-6 space-y-5 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-5">
            <div className="space-y-1">
              <div className="text-xs font-semibold text-indigo-700 uppercase tracking-wide">
                Hasil Ujian CBT · {exam.subject}
              </div>
              <h3 className="text-lg sm:text-xl font-bold text-slate-900">
                {exam.title}
              </h3>
              <p className="text-xs text-slate-500">
                Siswa: <strong>{latestAttempt.studentName}</strong> · Dikumpulkan pada{' '}
                <span className="font-mono tabular-nums">{latestAttempt.submittedAt}</span>
              </p>
            </div>

            <div className="flex items-center gap-4 bg-slate-50 border border-slate-200 rounded-xl px-5 py-3 shrink-0">
              <div className="text-right">
                <div className="text-[11px] font-semibold text-slate-500 uppercase">
                  {hasEssay && latestAttempt.essayScore === undefined && exam.multipleChoice.length > 0
                    ? 'Skor PG Otomatis'
                    : 'Nilai Akhir CBT'}
                </div>
                <div
                  className={`text-3xl sm:text-4xl font-extrabold font-mono tabular-nums leading-none mt-1 ${
                    awaitingEssayScore
                      ? 'text-amber-700'
                      : passed
                      ? 'text-emerald-700'
                      : 'text-rose-700'
                  }`}
                >
                  {awaitingEssayScore ? '-' : latestAttempt.finalScore}
                </div>
              </div>
              <div className="h-10 w-px bg-slate-200" />
              <div>
                {awaitingEssayScore ? (
                  <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-800 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-lg">
                    <Clock className="w-3.5 h-3.5" />
                    Menunggu Nilai Uraian
                  </span>
                ) : passed ? (
                  <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-lg">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Tuntas (KKTP {kktp})
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-xs font-bold text-rose-700 bg-rose-50 border border-rose-200 px-2.5 py-1 rounded-lg">
                    <AlertCircle className="w-3.5 h-3.5" />
                    Perlu Penguatan
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Metrics Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
              <div className="text-[11px] text-slate-500">Jawaban PG Benar</div>
              <div className="text-base font-bold text-emerald-700 font-mono tabular-nums mt-0.5">
                {latestAttempt.pgCorrect} / {latestAttempt.pgTotal}
              </div>
            </div>
            <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
              <div className="text-[11px] text-slate-500">Jawaban PG Salah / Kosong</div>
              <div className="text-base font-bold text-rose-700 font-mono tabular-nums mt-0.5">
                {Math.max(0, latestAttempt.pgTotal - latestAttempt.pgCorrect)}
              </div>
            </div>
            <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
              <div className="text-[11px] text-slate-500">Skor Pilihan Ganda</div>
              <div className="text-base font-bold text-slate-900 font-mono tabular-nums mt-0.5">
                {latestAttempt.pgTotal > 0 ? latestAttempt.pgScore : '-'}
              </div>
            </div>
            <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
              <div className="text-[11px] text-slate-500">Skor Uraian</div>
              <div className="text-base font-bold text-slate-900 font-mono tabular-nums mt-0.5">
                {hasEssay
                  ? latestAttempt.essayScore !== undefined
                    ? latestAttempt.essayScore
                    : 'Menunggu Guru'
                  : 'Tidak Ada'}
              </div>
            </div>
          </div>

          {latestAttempt.teacherNote && (
            <div className="p-3.5 rounded-lg bg-indigo-50 border border-indigo-200 text-xs text-indigo-950">
              <strong className="block mb-0.5">Catatan Guru:</strong>
              <span>{latestAttempt.teacherNote}</span>
            </div>
          )}
        </div>

        {/* Question-by-Question Review & Explanation */}
        {exam.showResultToStudent ? (
          <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
            <h4 className="text-sm font-bold text-slate-900">
              Pembahasan &amp; Kunci Jawaban
            </h4>

            {exam.multipleChoice.length > 0 && (
              <div className="space-y-3">
                {exam.multipleChoice.map((q, idx) => {
                  const chosen = latestAttempt.pgAnswers[q.id];
                  const isCorrect = chosen === q.correctIndex;
                  return (
                    <div
                      key={q.id}
                      className={`p-4 rounded-xl border space-y-2.5 text-xs ${
                        isCorrect
                          ? 'bg-emerald-50/40 border-emerald-200'
                          : 'bg-rose-50/40 border-rose-200'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="font-semibold text-slate-900 text-xs sm:text-sm">
                          {idx + 1}. {q.question}
                        </div>
                        {isCorrect ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 shrink-0">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Benar
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-700 shrink-0">
                            <XCircle className="w-3.5 h-3.5" />
                            {chosen === undefined ? 'Tidak Dijawab' : 'Salah'}
                          </span>
                        )}
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                        {q.options.map((opt, oIdx) => {
                          const isKey = oIdx === q.correctIndex;
                          const isChosen = oIdx === chosen;
                          return (
                            <div
                              key={oIdx}
                              className={`px-3 py-2 rounded-lg border text-xs flex items-start gap-2 ${
                                isKey
                                  ? 'bg-emerald-100/70 border-emerald-400 text-emerald-950 font-semibold'
                                  : isChosen
                                  ? 'bg-rose-100/70 border-rose-300 text-rose-900'
                                  : 'bg-white border-slate-200 text-slate-700'
                              }`}
                            >
                              <span className="font-bold shrink-0">
                                {OPTION_LABELS[oIdx]}.
                              </span>
                              <span className="flex-1">{opt}</span>
                              {isKey && (
                                <span className="text-[10px] font-bold text-emerald-800 shrink-0">
                                  (Kunci)
                                </span>
                              )}
                              {isChosen && !isKey && (
                                <span className="text-[10px] font-bold text-rose-700 shrink-0">
                                  (Pilihan Anda)
                                </span>
                              )}
                            </div>
                          );
                        })}
                      </div>

                      {q.explanation && (
                        <div className="p-2.5 rounded-lg bg-white border border-slate-200 text-slate-700 text-[11px]">
                          <strong>Pembahasan:</strong> {q.explanation}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {exam.essay.length > 0 && (
              <div className="space-y-3 pt-2">
                <h5 className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                  Soal Uraian ({exam.essay.length} Butir)
                </h5>
                {exam.essay.map((q, idx) => {
                  const ans = latestAttempt.essayAnswers[q.id] || '';
                  return (
                    <div
                      key={q.id}
                      className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 space-y-2 text-xs"
                    >
                      <div className="font-semibold text-slate-900">
                        {idx + 1}. {q.question}
                      </div>
                      <div className="p-2.5 rounded-lg bg-white border border-slate-200 text-slate-800">
                        <span className="text-[10px] font-bold uppercase text-slate-400 block mb-0.5">
                          Jawaban Anda:
                        </span>
                        {ans.trim() || <span className="italic text-slate-400">(Kosong)</span>}
                      </div>
                      <div className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-950">
                        <span className="text-[10px] font-bold uppercase text-emerald-700 block mb-0.5">
                          Kunci Jawaban Referensi:
                        </span>
                        {q.answerKey}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-slate-200 p-6 text-center text-xs text-slate-600">
            Jawaban dan nilai Anda sudah dikirim langsung ke Ruang Guru. Kunci jawaban dan pembahasan dinonaktifkan untuk ujian ini.
          </div>
        )}
      </div>
    );
  }

  // =========================================================================
  // VIEW 3: AVAILABLE CBT EXAMS LIST
  // =========================================================================
  return (
    <div className="space-y-4">
      {stopNotice && (
        <div className="flex items-center justify-between gap-2 p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800">
          <div className="flex items-center gap-2">
            <StopCircle className="w-4 h-4 shrink-0 text-rose-600" />
            <span>{stopNotice}</span>
          </div>
          <button
            type="button"
            onClick={() => setStopNotice('')}
            className="text-[11px] font-semibold text-rose-700 hover:underline shrink-0"
          >
            Tutup
          </button>
        </div>
      )}
      {exams.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center space-y-2">
          <MonitorCheck className="w-9 h-9 text-slate-300 mx-auto" />
          <p className="text-xs font-semibold text-slate-700">
            Belum ada ujian CBT online untuk kelas dan mata pelajaran ini.
          </p>
          <p className="text-[11px] text-slate-500">
            Ujian CBT yang diterbitkan guru dari Buat Soal AI akan langsung tampil di sini.
          </p>
        </div>
      ) : (
        exams.map((exam) => {
          const attempt = results.find(
            (r) => r.examId === exam.id && r.studentId === student?.id
          );
          const passed = attempt ? attempt.finalScore >= kktp : false;

          return (
            <div
              key={exam.id}
              className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-4"
            >
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                    <span className="font-semibold text-indigo-700">
                      {exam.subject || fallbackSubject}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono tabular-nums">
                      {exam.multipleChoice.length} Pilihan Ganda
                      {exam.essay.length > 0 ? ` · ${exam.essay.length} Uraian` : ''}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span className="inline-flex items-center gap-1 font-mono tabular-nums">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      {exam.durationMinutes} menit
                    </span>
                  </div>
                  <h3 className="text-base font-bold text-slate-900">{exam.title}</h3>
                </div>

                <div className="shrink-0">
                  {attempt ? (
                    <span
                      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold border ${
                        passed
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : 'bg-amber-50 text-amber-800 border-amber-200'
                      }`}
                    >
                      <Award className="w-3.5 h-3.5" />
                      <span>
                        Selesai · Nilai:{' '}
                        <span className="font-mono tabular-nums">
                          {attempt.finalScore}
                        </span>
                      </span>
                    </span>
                  ) : exam.isActive ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Ujian Dibuka
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold text-rose-700 bg-rose-50 border border-rose-200">
                      <StopCircle className="w-3.5 h-3.5" />
                      Ujian Dihentikan Guru
                    </span>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100">
                {attempt ? (
                  <>
                    <div className="text-xs text-slate-600">
                      Dikumpulkan <span className="font-mono tabular-nums">{attempt.submittedAt}</span>
                      {attempt.pgTotal > 0 && (
                        <span>
                          {' '}
                          · Benar PG:{' '}
                          <strong className="font-mono tabular-nums">
                            {attempt.pgCorrect}/{attempt.pgTotal}
                          </strong>
                        </span>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => setReviewState({ exam, attempt })}
                      className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-lg transition-colors"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>
                        {exam.showResultToStudent
                          ? 'Lihat Hasil & Pembahasan'
                          : 'Lihat Ringkasan Hasil'}
                      </span>
                    </button>
                  </>
                ) : (
                  <>
                    <div className="text-xs text-slate-500">
                      {exam.showResultToStudent
                        ? 'Nilai & pembahasan langsung muncul setelah selesai mengerjakan.'
                        : 'Nilai direkap di Ruang Guru setelah selesai mengerjakan.'}
                    </div>
                    {exam.isActive && (
                      <button
                        type="button"
                        onClick={() => startExam(exam)}
                        className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-xs transition-colors"
                      >
                        <Play className="w-3.5 h-3.5" />
                        <span>Mulai Ujian CBT</span>
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>
          );
        })
      )}
    </div>
  );
};
