import React, { useState, useMemo, useEffect } from 'react';
import { useLMS } from '../../context/LMSContext';
import { CbtAttempt } from '../../types/lms';
import {
  MonitorCheck,
  Sparkles,
  Trash2,
  CheckCircle2,
  XCircle,
  Clock,
  Download,
  Printer,
  Eye,
  X,
  StopCircle,
  PlayCircle,
  Award,
  Users,
  Check,
  AlertCircle,
} from 'lucide-react';
import { getPrimarySubject } from '../../utils/subjects';

const OPTION_LABELS = ['A', 'B', 'C', 'D'] as const;

const formatDurationSpent = (sec?: number): string => {
  if (typeof sec !== 'number' || sec < 0) return '-';
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}m ${String(s).padStart(2, '0')}d`;
};

interface CbtGuruTabProps {
  onNavigateToSoalAI?: () => void;
}

export const CbtGuruTab: React.FC<CbtGuruTabProps> = ({ onNavigateToSoalAI }) => {
  const {
    teacher,
    classes,
    students,
    cbtExams,
    cbtResults,
    activeClassId,
    activeSubject,
    toggleCbtExamActive,
    stopAllActiveCbtExams,
    deleteCbtExam,
    gradeCbtAttempt,
    deleteCbtAttempt,
  } = useLMS();

  const kktp = typeof teacher.kktp === 'number' ? teacher.kktp : 75;
  const fallbackSubject = getPrimarySubject(teacher.subject);

  // Filter exams by active class & active subject
  const filteredExams = useMemo(() => {
    return cbtExams.filter((ex) => {
      const matchClass =
        activeClassId === 'all' || ex.classId === 'all' || ex.classId === activeClassId;
      const exSubj = ex.subject?.trim() || fallbackSubject;
      const matchSubj =
        activeSubject === 'all' ||
        exSubj.toLowerCase() === activeSubject.toLowerCase();
      return matchClass && matchSubj;
    });
  }, [cbtExams, activeClassId, activeSubject, fallbackSubject]);

  const [selectedExamId, setSelectedExamId] = useState<string | null>(
    () => filteredExams[0]?.id || null
  );

  useEffect(() => {
    if (!selectedExamId && filteredExams.length > 0) {
      setSelectedExamId(filteredExams[0].id);
    } else if (
      selectedExamId &&
      filteredExams.length > 0 &&
      !filteredExams.some((e) => e.id === selectedExamId)
    ) {
      setSelectedExamId(filteredExams[0].id);
    } else if (filteredExams.length === 0) {
      setSelectedExamId(null);
    }
  }, [filteredExams, selectedExamId]);

  const selectedExam = useMemo(
    () => filteredExams.find((e) => e.id === selectedExamId) || null,
    [filteredExams, selectedExamId]
  );

  // Confirm stop / delete exam or attempt inline (avoiding window.confirm)
  const [confirmStopExamId, setConfirmStopExamId] = useState<string | null>(null);
  const [confirmStopAllOpen, setConfirmStopAllOpen] = useState<boolean>(false);
  const [confirmDeleteExamId, setConfirmDeleteExamId] = useState<string | null>(null);
  const [confirmDeleteAttemptId, setConfirmDeleteAttemptId] = useState<string | null>(null);

  const activeExamCount = useMemo(
    () => filteredExams.filter((ex) => ex.isActive).length,
    [filteredExams]
  );

  // Detail & grading modal
  const [inspectAttempt, setInspectAttempt] = useState<CbtAttempt | null>(null);
  const [draftEssayScore, setDraftEssayScore] = useState<string>('');
  const [draftFinalScore, setDraftFinalScore] = useState<string>('');
  const [draftTeacherNote, setDraftTeacherNote] = useState<string>('');
  const [gradeSavedBanner, setGradeSavedBanner] = useState<boolean>(false);

  const openInspectModal = (attempt: CbtAttempt) => {
    setInspectAttempt(attempt);
    setDraftEssayScore(
      typeof attempt.essayScore === 'number' ? String(attempt.essayScore) : ''
    );
    setDraftFinalScore(String(attempt.finalScore));
    setDraftTeacherNote(attempt.teacherNote || '');
    setGradeSavedBanner(false);
  };

  // Attempts scoped to selectedExam & activeClassId
  const examAttempts = useMemo(() => {
    if (!selectedExam) return [];
    return cbtResults.filter((r) => {
      if (r.examId !== selectedExam.id) return false;
      if (activeClassId !== 'all' && r.classId !== activeClassId) return false;
      return true;
    });
  }, [cbtResults, selectedExam, activeClassId]);

  // Target roster for selectedExam (to show pending count)
  const targetStudents = useMemo(() => {
    if (!selectedExam) return [];
    return students.filter((s) => {
      if (activeClassId !== 'all' && s.classId !== activeClassId) return false;
      if (selectedExam.classId !== 'all' && s.classId !== selectedExam.classId) return false;
      return true;
    });
  }, [students, selectedExam, activeClassId]);

  const submittedStudentIds = useMemo(
    () => new Set(examAttempts.map((a) => a.studentId)),
    [examAttempts]
  );

  const pendingStudents = useMemo(
    () => targetStudents.filter((s) => !submittedStudentIds.has(s.id)),
    [targetStudents, submittedStudentIds]
  );

  // Metrics
  const stats = useMemo(() => {
    if (examAttempts.length === 0) {
      return {
        totalAttempts: 0,
        avgScore: 0,
        maxScore: 0,
        passedCount: 0,
      };
    }
    const scores = examAttempts.map((a) => a.finalScore);
    const sum = scores.reduce((acc, s) => acc + s, 0);
    return {
      totalAttempts: examAttempts.length,
      avgScore: Math.round(sum / examAttempts.length),
      maxScore: Math.max(...scores),
      passedCount: scores.filter((s) => s >= kktp).length,
    };
  }, [examAttempts, kktp]);

  const handleSaveGrade = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inspectAttempt) return;
    const parsedFinal = Math.min(
      100,
      Math.max(0, Math.round(Number(draftFinalScore) || 0))
    );
    const parsedEssay =
      draftEssayScore.trim() !== ''
        ? Math.min(100, Math.max(0, Math.round(Number(draftEssayScore) || 0)))
        : undefined;
    gradeCbtAttempt(
      inspectAttempt.id,
      parsedFinal,
      parsedEssay,
      draftTeacherNote.trim()
    );
    setInspectAttempt({
      ...inspectAttempt,
      finalScore: parsedFinal,
      essayScore: parsedEssay ?? inspectAttempt.essayScore,
      teacherNote: draftTeacherNote.trim(),
    });
    setGradeSavedBanner(true);
    setTimeout(() => setGradeSavedBanner(false), 2500);
  };

  // Auto-calculate weighted final score when essay score changes
  const handleEssayScoreChange = (val: string) => {
    setDraftEssayScore(val);
    if (!inspectAttempt || !selectedExam) return;
    if (val.trim() === '') return;
    const essayNum = Math.min(100, Math.max(0, Number(val) || 0));
    if (selectedExam.multipleChoice.length === 0) {
      setDraftFinalScore(String(Math.round(essayNum)));
    } else {
      const combined = Math.round(inspectAttempt.pgScore * 0.7 + essayNum * 0.3);
      setDraftFinalScore(String(combined));
    }
  };

  const handleExportCsv = () => {
    if (!selectedExam) return;
    const headers = [
      'No',
      'Nama Siswa',
      'Kelas',
      'Mata Pelajaran',
      'Ujian CBT',
      'Benar PG',
      'Total PG',
      'Skor PG',
      'Skor Uraian',
      'Nilai Akhir',
      'Status KKTP',
      'Waktu Selesai',
      'Durasi Pengerjaan',
      'Catatan Guru',
    ];

    const rows = examAttempts.map((a, idx) => {
      const clsName = classes.find((c) => c.id === a.classId)?.name || '-';
      const status = a.finalScore >= kktp ? 'TUNTAS' : 'BELUM TUNTAS';
      return [
        idx + 1,
        `"${a.studentName.replace(/"/g, '""')}"`,
        `"${clsName.replace(/"/g, '""')}"`,
        `"${a.subject.replace(/"/g, '""')}"`,
        `"${a.examTitle.replace(/"/g, '""')}"`,
        a.pgCorrect,
        a.pgTotal,
        a.pgScore,
        a.essayScore !== undefined ? a.essayScore : '-',
        a.finalScore,
        status,
        `"${a.submittedAt}"`,
        `"${formatDurationSpent(a.durationSpentSec)}"`,
        `"${(a.teacherNote || '').replace(/"/g, '""')}"`,
      ].join(',');
    });

    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const safeTitle =
      selectedExam.title.replace(/[^a-zA-Z0-9_-]+/g, '_') || 'Hasil_CBT';
    link.href = url;
    link.download = `Hasil_CBT_${safeTitle}_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-5">
      {/* Header Banner */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 print:hidden">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center shrink-0">
            <MonitorCheck className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm sm:text-base font-bold text-slate-900">
              Ruang Guru · Ujian CBT &amp; Hasil Siswa
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Pantau skor otomatis ujian CBT yang diterbitkan dari menu Buat Soal AI, tinjau rincian jawaban siswa, dan berikan nilai uraian.
            </p>
          </div>
        </div>

        {onNavigateToSoalAI && (
          <button
            type="button"
            onClick={onNavigateToSoalAI}
            className="inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-xs transition-colors shrink-0"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Buat &amp; Terbitkan CBT dari Soal AI</span>
          </button>
        )}
      </div>

      {filteredExams.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-10 text-center space-y-3">
          <MonitorCheck className="w-10 h-10 text-slate-300 mx-auto" />
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-slate-800">
              Belum Ada Sesi Ujian CBT Diterbitkan
            </h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              Buat paket soal di menu <strong>Buat Soal AI</strong>, lalu klik tombol{' '}
              <strong>Terbitkan CBT Online</strong> agar siswa dapat langsung mengerjakan ujian dan melihat hasilnya secara otomatis.
            </p>
          </div>
          {onNavigateToSoalAI && (
            <button
              type="button"
              onClick={onNavigateToSoalAI}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Buka Pembuat Soal AI</span>
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-5">
          {/* Left Sidebar: Published CBT Exams List */}
          <aside className="lg:col-span-1 space-y-2.5 print:hidden">
            <div className="bg-white rounded-xl border border-slate-200 p-3.5 space-y-2.5">
              <div className="flex items-center justify-between gap-2 text-xs font-semibold text-slate-800">
                <span>Daftar Ujian CBT ({filteredExams.length})</span>
                {activeExamCount > 0 && (
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                    {activeExamCount} Aktif
                  </span>
                )}
              </div>

              {activeExamCount > 1 && (
                confirmStopAllOpen ? (
                  <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 space-y-2">
                    <div className="text-[11px] font-semibold text-rose-800">
                      Hentikan semua {activeExamCount} ujian CBT aktif sekaligus?
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          stopAllActiveCbtExams();
                          setConfirmStopAllOpen(false);
                          setConfirmStopExamId(null);
                        }}
                        className="flex-1 px-2 py-1 text-[11px] font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded"
                      >
                        Ya, Hentikan Semua
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmStopAllOpen(false)}
                        className="px-2 py-1 text-[11px] font-medium text-slate-600 bg-white border border-slate-200 rounded"
                      >
                        Batal
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmStopAllOpen(true)}
                    className="w-full inline-flex items-center justify-center gap-1.5 px-2.5 py-1.5 text-[11px] font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg transition-colors"
                  >
                    <StopCircle className="w-3.5 h-3.5" />
                    <span>Hentikan Semua Ujian Aktif</span>
                  </button>
                )
              )}

              <div className="space-y-2 max-h-[520px] overflow-y-auto pr-0.5">
                {filteredExams.map((ex) => {
                  const isSelected = ex.id === selectedExam?.id;
                  const className =
                    ex.classId === 'all'
                      ? 'Semua Kelas'
                      : classes.find((c) => c.id === ex.classId)?.name || 'Kelas';
                  const attemptCount = cbtResults.filter(
                    (r) =>
                      r.examId === ex.id &&
                      (activeClassId === 'all' || r.classId === activeClassId)
                  ).length;

                  return (
                    <div
                      key={ex.id}
                      onClick={() => {
                        setSelectedExamId(ex.id);
                        setConfirmDeleteExamId(null);
                        setConfirmStopExamId(null);
                      }}
                      className={`p-3 rounded-lg border cursor-pointer transition-colors space-y-2 ${
                        isSelected
                          ? 'bg-indigo-50/80 border-indigo-300'
                          : 'bg-slate-50/70 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-slate-900 truncate">
                            {ex.title}
                          </div>
                          <div className="text-[11px] text-slate-600 mt-0.5">
                            {ex.subject} · {className}
                          </div>
                        </div>
                        <span
                          className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border shrink-0 ${
                            ex.isActive
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : 'bg-rose-50 text-rose-700 border-rose-200'
                          }`}
                        >
                          {ex.isActive ? 'Aktif' : 'Dihentikan'}
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-[11px] text-slate-500">
                        <span className="font-mono tabular-nums">
                          {ex.multipleChoice.length} PG
                          {ex.essay.length > 0 ? ` · ${ex.essay.length} Uraian` : ''} · {ex.durationMinutes}m
                        </span>
                        <span className="font-semibold text-indigo-700 font-mono tabular-nums">
                          {attemptCount} hasil
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </aside>

          {/* Right Panel: Selected CBT Exam Results & Controls */}
          <section className="lg:col-span-3 space-y-4">
            {selectedExam && (
              <>
                {/* Selected Exam Control Card */}
                <div className="bg-white rounded-xl border border-slate-200 p-4 sm:p-5 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 border-b border-slate-200 pb-4">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                        <span className="font-semibold text-indigo-700">
                          {selectedExam.subject}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span>
                          {selectedExam.classId === 'all'
                            ? 'Semua Kelas'
                            : classes.find((c) => c.id === selectedExam.classId)?.name || 'Kelas'}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono tabular-nums">
                          Durasi {selectedExam.durationMinutes} menit
                        </span>
                        <span aria-hidden="true">·</span>
                        <span>
                          {selectedExam.showResultToStudent
                            ? 'Nilai langsung tampil ke siswa'
                            : 'Nilai ditahan guru'}
                        </span>
                      </div>
                      <h3 className="text-base sm:text-lg font-bold text-slate-900">
                        {selectedExam.title}
                      </h3>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 print:hidden shrink-0">
                      {selectedExam.isActive ? (
                        confirmStopExamId === selectedExam.id ? (
                          <div className="flex flex-wrap items-center gap-1.5 bg-amber-50 border border-amber-300 px-2.5 py-1.5 rounded-lg">
                            <span className="text-[11px] font-semibold text-amber-900">
                              Hentikan ujian? Siswa yang sedang mengerjakan otomatis dikumpulkan.
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                toggleCbtExamActive(selectedExam.id, false);
                                setConfirmStopExamId(null);
                              }}
                              className="px-2.5 py-1 text-[11px] font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded"
                            >
                              Ya, Hentikan Ujian
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmStopExamId(null)}
                              className="px-2 py-1 text-[11px] font-medium text-slate-700 bg-white border border-slate-200 rounded"
                            >
                              Batal
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              setConfirmStopExamId(selectedExam.id);
                              setConfirmDeleteExamId(null);
                            }}
                            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-lg border bg-rose-600 text-white border-rose-600 hover:bg-rose-700 shadow-xs transition-colors"
                          >
                            <StopCircle className="w-3.5 h-3.5" />
                            <span>Hentikan Ujian CBT</span>
                          </button>
                        )
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            toggleCbtExamActive(selectedExam.id, true);
                            setConfirmStopExamId(null);
                          }}
                          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-lg border bg-emerald-600 text-white border-emerald-600 hover:bg-emerald-700 shadow-xs transition-colors"
                        >
                          <PlayCircle className="w-3.5 h-3.5" />
                          <span>Aktifkan Kembali CBT</span>
                        </button>
                      )}

                      {confirmDeleteExamId === selectedExam.id ? (
                        <div className="flex items-center gap-1.5 bg-rose-50 border border-rose-200 px-2 py-1 rounded-lg">
                          <span className="text-[11px] font-semibold text-rose-700">
                            Hapus ujian &amp; hasilnya?
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              deleteCbtExam(selectedExam.id);
                              setConfirmDeleteExamId(null);
                            }}
                            className="px-2 py-0.5 text-[11px] font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded"
                          >
                            Ya, Hapus
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteExamId(null)}
                            className="px-2 py-0.5 text-[11px] font-medium text-slate-600 bg-white border border-slate-200 rounded"
                          >
                            Batal
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setConfirmDeleteExamId(selectedExam.id);
                            setConfirmStopExamId(null);
                          }}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-rose-600 hover:bg-rose-50 border border-rose-200 rounded-lg transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Hapus</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {!selectedExam.isActive && (
                    <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-800">
                      <StopCircle className="w-4 h-4 shrink-0 text-rose-600" />
                      <span>
                        <strong>Ujian CBT Dihentikan.</strong> Siswa tidak dapat memulai atau melanjutkan ujian ini hingga Anda mengaktifkannya kembali.
                      </span>
                    </div>
                  )}

                  {/* KPI Metric Strip */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="p-3 rounded-lg border border-slate-200 bg-slate-50/70">
                      <div className="text-[11px] font-medium text-slate-500 flex items-center gap-1">
                        <Users className="w-3.5 h-3.5 text-indigo-600" />
                        <span>Sudah Selesai</span>
                      </div>
                      <div className="text-lg font-bold text-slate-900 font-mono tabular-nums mt-0.5">
                        {stats.totalAttempts}
                        <span className="text-xs font-normal text-slate-500">
                          /{targetStudents.length || stats.totalAttempts}
                        </span>
                      </div>
                    </div>

                    <div className="p-3 rounded-lg border border-slate-200 bg-slate-50/70">
                      <div className="text-[11px] font-medium text-slate-500 flex items-center gap-1">
                        <Award className="w-3.5 h-3.5 text-indigo-600" />
                        <span>Rata-rata Nilai</span>
                      </div>
                      <div className="text-lg font-bold text-indigo-700 font-mono tabular-nums mt-0.5">
                        {stats.totalAttempts > 0 ? stats.avgScore : '-'}
                      </div>
                    </div>

                    <div className="p-3 rounded-lg border border-slate-200 bg-slate-50/70">
                      <div className="text-[11px] font-medium text-slate-500">
                        Nilai Tertinggi
                      </div>
                      <div className="text-lg font-bold text-emerald-700 font-mono tabular-nums mt-0.5">
                        {stats.totalAttempts > 0 ? stats.maxScore : '-'}
                      </div>
                    </div>

                    <div className="p-3 rounded-lg border border-slate-200 bg-slate-50/70">
                      <div className="text-[11px] font-medium text-slate-500">
                        Tuntas (KKTP {kktp})
                      </div>
                      <div className="text-lg font-bold text-slate-900 font-mono tabular-nums mt-0.5">
                        {stats.passedCount}{' '}
                        <span className="text-xs font-normal text-slate-500">siswa</span>
                      </div>
                    </div>
                  </div>

                  {/* Export & Print Bar */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1 print:hidden">
                    <div className="text-xs text-slate-500">
                      {selectedExam.essay.length > 0 && (
                        <span>
                          Ujian ini memiliki <strong>{selectedExam.essay.length} soal uraian</strong>. Klik <strong>Periksa</strong> pada baris siswa untuk memberi skor uraian.
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        disabled={examAttempts.length === 0}
                        onClick={handleExportCsv}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-50 hover:bg-slate-100 disabled:opacity-50 border border-slate-200 rounded-lg transition-colors"
                      >
                        <Download className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Unduh Rekap (.csv)</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => window.print()}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors"
                      >
                        <Printer className="w-3.5 h-3.5" />
                        <span>Cetak Rekap</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Results Table */}
                <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                  <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
                    <h4 className="text-xs sm:text-sm font-bold text-slate-900">
                      Daftar Nilai Siswa ({examAttempts.length})
                    </h4>
                  </div>

                  {examAttempts.length === 0 ? (
                    <div className="p-10 text-center text-xs text-slate-500">
                      Belum ada siswa yang mengumpulkan ujian CBT ini. Hasil akan muncul otomatis di sini saat siswa selesai mengerjakan.
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-600 uppercase tracking-wider">
                            <th className="py-2.5 px-3 w-10">No</th>
                            <th className="py-2.5 px-3">Nama Siswa</th>
                            <th className="py-2.5 px-3">Kelas</th>
                            <th className="py-2.5 px-3">Waktu &amp; Durasi</th>
                            <th className="py-2.5 px-3 text-right">Benar PG</th>
                            <th className="py-2.5 px-3 text-right">Skor Akhir</th>
                            <th className="py-2.5 px-3">Status</th>
                            <th className="py-2.5 px-3 text-right print:hidden">Aksi</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {examAttempts.map((attempt, idx) => {
                            const clsName =
                              classes.find((c) => c.id === attempt.classId)?.name || '-';
                            const passed = attempt.finalScore >= kktp;
                            const needsEssayReview =
                              selectedExam.essay.length > 0 &&
                              attempt.essayScore === undefined;

                            return (
                              <tr
                                key={attempt.id}
                                className="hover:bg-slate-50/80 transition-colors"
                              >
                                <td className="py-2.5 px-3 font-mono tabular-nums text-slate-500">
                                  {idx + 1}
                                </td>
                                <td className="py-2.5 px-3 font-semibold text-slate-900">
                                  {attempt.studentName}
                                </td>
                                <td className="py-2.5 px-3 text-slate-600">{clsName}</td>
                                <td className="py-2.5 px-3 text-slate-500 font-mono tabular-nums">
                                  <div>{attempt.submittedAt}</div>
                                  {attempt.durationSpentSec !== undefined && (
                                    <div className="text-[10px] text-slate-400">
                                      Durasi: {formatDurationSpent(attempt.durationSpentSec)}
                                    </div>
                                  )}
                                </td>
                                <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-700">
                                  {attempt.pgTotal > 0
                                    ? `${attempt.pgCorrect}/${attempt.pgTotal}`
                                    : '-'}
                                </td>
                                <td className="py-2.5 px-3 text-right font-mono tabular-nums font-bold text-sm text-slate-900">
                                  {attempt.finalScore}
                                </td>
                                <td className="py-2.5 px-3">
                                  {needsEssayReview ? (
                                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded">
                                      <Clock className="w-3 h-3" />
                                      Perlu Nilai Uraian
                                    </span>
                                  ) : passed ? (
                                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded">
                                      <CheckCircle2 className="w-3 h-3" />
                                      Tuntas
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded">
                                      <XCircle className="w-3 h-3" />
                                      Belum Tuntas
                                    </span>
                                  )}
                                </td>
                                <td className="py-2.5 px-3 text-right print:hidden">
                                  <div className="inline-flex items-center gap-1.5">
                                    <button
                                      type="button"
                                      onClick={() => openInspectModal(attempt)}
                                      className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-md transition-colors"
                                    >
                                      <Eye className="w-3 h-3" />
                                      <span>Periksa</span>
                                    </button>

                                    {confirmDeleteAttemptId === attempt.id ? (
                                      <div className="inline-flex items-center gap-1 bg-rose-50 border border-rose-200 px-1.5 py-0.5 rounded">
                                        <button
                                          type="button"
                                          onClick={() => {
                                            deleteCbtAttempt(attempt.id);
                                            setConfirmDeleteAttemptId(null);
                                          }}
                                          className="text-[10px] font-semibold text-rose-700 hover:underline"
                                        >
                                          Hapus
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => setConfirmDeleteAttemptId(null)}
                                          className="text-[10px] text-slate-500"
                                        >
                                          Batal
                                        </button>
                                      </div>
                                    ) : (
                                      <button
                                        type="button"
                                        onClick={() => setConfirmDeleteAttemptId(attempt.id)}
                                        className="p-1 text-slate-400 hover:text-rose-600 rounded"
                                        title="Hapus hasil agar siswa dapat mengulang"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {/* Students Not Yet Submitted */}
                {pendingStudents.length > 0 && (
                  <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold text-slate-800">
                        Belum Mengerjakan ({pendingStudents.length} siswa)
                      </h4>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {pendingStudents.map((stu) => {
                        const clsName =
                          classes.find((c) => c.id === stu.classId)?.name || '';
                        return (
                          <span
                            key={stu.id}
                            className="text-[11px] text-slate-700 bg-slate-50 border border-slate-200 px-2.5 py-1 rounded-md"
                          >
                            {stu.name}
                            {clsName ? (
                              <span className="text-slate-400 ml-1">({clsName})</span>
                            ) : null}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                )}
              </>
            )}
          </section>
        </div>
      )}

      {/* Inspect Student Answers & Essay Grading Modal */}
      {inspectAttempt && selectedExam && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 print:hidden">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-3xl w-full max-h-[90vh] flex flex-col overflow-hidden">
            {/* Modal Header */}
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between gap-3 bg-slate-50">
              <div>
                <div className="text-[11px] font-semibold text-indigo-700 uppercase tracking-wide">
                  Rincian Jawaban CBT · {selectedExam.subject}
                </div>
                <h3 className="text-sm sm:text-base font-bold text-slate-900">
                  {inspectAttempt.studentName} ·{' '}
                  {classes.find((c) => c.id === inspectAttempt.classId)?.name || 'Kelas'}
                </h3>
                <p className="text-[11px] text-slate-500">
                  Dikumpulkan: {inspectAttempt.submittedAt} · Benar PG:{' '}
                  <strong className="font-mono tabular-nums">
                    {inspectAttempt.pgCorrect}/{inspectAttempt.pgTotal}
                  </strong>{' '}
                  (Skor PG: <strong className="font-mono tabular-nums">{inspectAttempt.pgScore}</strong>)
                </p>
              </div>
              <button
                type="button"
                onClick={() => setInspectAttempt(null)}
                className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-200 rounded-lg transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Scroll Body */}
            <div className="flex-1 overflow-y-auto p-5 space-y-5">
              {/* Grading Form */}
              <form
                onSubmit={handleSaveGrade}
                className="p-4 rounded-xl bg-indigo-50/60 border border-indigo-200 space-y-3"
              >
                <div className="text-xs font-bold text-indigo-900">
                  Penilaian &amp; Catatan Guru
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {selectedExam.essay.length > 0 && (
                    <div>
                      <label className="text-[11px] font-medium text-slate-700 block mb-1">
                        Skor Uraian (0–100)
                      </label>
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={draftEssayScore}
                        onChange={(e) => handleEssayScoreChange(e.target.value)}
                        placeholder="Misal: 85"
                        className="w-full text-xs font-mono font-bold px-3 py-1.5 border border-slate-300 rounded-lg bg-white"
                      />
                    </div>
                  )}
                  <div>
                    <label className="text-[11px] font-medium text-slate-700 block mb-1">
                      Nilai Akhir CBT (0–100)
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      required
                      value={draftFinalScore}
                      onChange={(e) => setDraftFinalScore(e.target.value)}
                      className="w-full text-xs font-mono font-bold px-3 py-1.5 border border-slate-300 rounded-lg bg-white"
                    />
                  </div>
                  <div className={selectedExam.essay.length > 0 ? '' : 'sm:col-span-2'}>
                    <label className="text-[11px] font-medium text-slate-700 block mb-1">
                      Catatan Guru (Opsional)
                    </label>
                    <input
                      type="text"
                      value={draftTeacherNote}
                      onChange={(e) => setDraftTeacherNote(e.target.value)}
                      placeholder="Evaluasi atau pesan untuk siswa..."
                      className="w-full text-xs px-3 py-1.5 border border-slate-300 rounded-lg bg-white"
                    />
                  </div>
                </div>
                <div className="flex items-center justify-between gap-2">
                  {gradeSavedBanner ? (
                    <span className="text-xs font-semibold text-emerald-700 flex items-center gap-1">
                      <Check className="w-4 h-4" />
                      <span>Nilai &amp; catatan berhasil disimpan ke Cloud!</span>
                    </span>
                  ) : (
                    <span className="text-[11px] text-slate-600">
                      {selectedExam.essay.length > 0 && selectedExam.multipleChoice.length > 0
                        ? 'Rumus saran otomatis: 70% Skor PG + 30% Skor Uraian.'
                        : 'Nilai akhir otomatis sinkron ke akun siswa & Ruang Guru.'}
                    </span>
                  )}
                  <button
                    type="submit"
                    className="px-4 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-xs transition-colors shrink-0"
                  >
                    Simpan Nilai
                  </button>
                </div>
              </form>

              {/* PG Answer Breakdown */}
              {selectedExam.multipleChoice.length > 0 && (
                <div className="space-y-2.5">
                  <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wide">
                    Jawaban Pilihan Ganda ({selectedExam.multipleChoice.length} Butir)
                  </h4>
                  <div className="space-y-2.5">
                    {selectedExam.multipleChoice.map((q, idx) => {
                      const chosen = inspectAttempt.pgAnswers[q.id];
                      const isCorrect = chosen === q.correctIndex;
                      return (
                        <div
                          key={q.id}
                          className={`p-3.5 rounded-xl border text-xs space-y-2 ${
                            isCorrect
                              ? 'bg-emerald-50/40 border-emerald-200'
                              : 'bg-rose-50/40 border-rose-200'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="font-medium text-slate-900">
                              <span className="font-bold mr-1.5">{idx + 1}.</span>
                              {q.question}
                            </div>
                            {isCorrect ? (
                              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 shrink-0">
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                Benar
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-700 shrink-0">
                                <AlertCircle className="w-3.5 h-3.5" />
                                {chosen === undefined ? 'Kosong' : 'Salah'}
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-700 flex flex-wrap gap-x-4 gap-y-1">
                            <span>
                              Jawaban Siswa:{' '}
                              <strong>
                                {chosen !== undefined
                                  ? `${OPTION_LABELS[chosen]}. ${q.options[chosen] || ''}`
                                  : 'Tidak dijawab'}
                              </strong>
                            </span>
                            <span>
                              Kunci:{' '}
                              <strong className="text-emerald-700">
                                {OPTION_LABELS[q.correctIndex]}.{' '}
                                {q.options[q.correctIndex] || ''}
                              </strong>
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Essay Answer Breakdown */}
              {selectedExam.essay.length > 0 && (
                <div className="space-y-2.5">
                  <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wide">
                    Jawaban Soal Uraian ({selectedExam.essay.length} Butir)
                  </h4>
                  <div className="space-y-3">
                    {selectedExam.essay.map((q, idx) => {
                      const ans = inspectAttempt.essayAnswers[q.id] || '';
                      return (
                        <div
                          key={q.id}
                          className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/70 space-y-2 text-xs"
                        >
                          <div className="font-semibold text-slate-900">
                            {idx + 1}. {q.question}
                          </div>
                          <div className="p-2.5 rounded-lg bg-white border border-slate-200 text-slate-800 whitespace-pre-wrap">
                            <span className="text-[10px] font-bold uppercase text-slate-400 block mb-0.5">
                              Jawaban Siswa:
                            </span>
                            {ans.trim() || (
                              <span className="italic text-slate-400">
                                (Tidak dijawab oleh siswa)
                              </span>
                            )}
                          </div>
                          <div className="p-2.5 rounded-lg bg-emerald-50/70 border border-emerald-200 text-emerald-900">
                            <span className="text-[10px] font-bold uppercase text-emerald-700 block mb-0.5">
                              Kunci / Rubrik Guru:
                            </span>
                            {q.answerKey}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
