import React, { useState, useEffect } from 'react';
import { useLMS } from '../../context/LMSContext';
import {
  GeneratedQuestionSet,
  GeneratedPGQuestion,
  GeneratedEssayQuestion,
  MaterialAttachment,
} from '../../types/lms';
import {
  Sparkles,
  Loader2,
  Eye,
  EyeOff,
  Download,
  Copy,
  Check,
  Printer,
  Send,
  Trash2,
  BookOpen,
  History,
  AlertCircle,
  CheckCircle2,
  FileText,
  MonitorCheck,
} from 'lucide-react';
import { getPrimarySubject } from '../../utils/subjects';

const OPTION_LABELS = ['A', 'B', 'C', 'D'] as const;

const escapeHtml = (str: string) =>
  str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const buildWordHtml = (set: GeneratedQuestionSet, includeAnswerKey: boolean, teacherName: string): string => {
  const pgHtml =
    set.multipleChoice.length > 0
      ? `
      <h3>A. Soal Pilihan Ganda (${set.multipleChoice.length} Butir)</h3>
      <ol>
        ${set.multipleChoice
          .map(
            (q) => `
          <li style="margin-bottom: 12px;">
            <div>${escapeHtml(q.question).replace(/\n/g, '<br/>')}</div>
            <div style="margin-top: 4px; margin-left: 12px;">
              ${q.options
                .map((opt, oIdx) => {
                  const isCorrect = includeAnswerKey && oIdx === q.correctIndex;
                  return `<div${isCorrect ? ' style="font-weight:bold; color:#047857;"' : ''}>${OPTION_LABELS[oIdx]}. ${escapeHtml(opt)}${isCorrect ? ' [KUNCI]' : ''}</div>`;
                })
                .join('')}
            </div>
            ${
              includeAnswerKey && q.explanation
                ? `<div style="margin-top:4px; font-size:11px; color:#334155;"><em>Pembahasan: ${escapeHtml(q.explanation)}</em></div>`
                : ''
            }
          </li>`
          )
          .join('')}
      </ol>`
      : '';

  const essayHtml =
    set.essay.length > 0
      ? `
      <h3>${set.multipleChoice.length > 0 ? 'B' : 'A'}. Soal Uraian (${set.essay.length} Butir)</h3>
      <ol>
        ${set.essay
          .map(
            (q) => `
          <li style="margin-bottom: 14px;">
            <div>${escapeHtml(q.question).replace(/\n/g, '<br/>')}</div>
            ${
              includeAnswerKey
                ? `<div style="margin-top:4px; font-size:11px; color:#047857;"><strong>Kunci Jawaban:</strong> ${escapeHtml(q.answerKey).replace(/\n/g, '<br/>')}</div>`
                : `<div style="margin-top:8px; border-bottom:1px dotted #94a3b8; height:22px;"></div>
                   <div style="margin-top:8px; border-bottom:1px dotted #94a3b8; height:22px;"></div>`
            }
          </li>`
          )
          .join('')}
      </ol>`
      : '';

  return `<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
<head>
<meta charset="utf-8" />
<title>${escapeHtml(set.title)}</title>
<style>
  body { font-family: Calibri, Arial, sans-serif; font-size: 12pt; line-height: 1.45; color: #0f172a; }
  h2 { margin: 0 0 4px 0; font-size: 15pt; }
  .meta { font-size: 10.5pt; color: #475569; margin-bottom: 14px; border-bottom: 1px solid #cbd5e1; padding-bottom: 8px; }
  h3 { font-size: 12.5pt; margin-top: 16px; margin-bottom: 8px; }
</style>
</head>
<body>
  <h2>${escapeHtml(set.title)}${includeAnswerKey ? ' (Kunci & Pembahasan)' : ''}</h2>
  <div class="meta">
    Mata Pelajaran: <strong>${escapeHtml(set.subject)}</strong> &nbsp;|&nbsp;
    Guru: ${escapeHtml(teacherName)} &nbsp;|&nbsp;
    Jumlah: ${set.multipleChoice.length} PG, ${set.essay.length} Uraian
  </div>
  ${pgHtml}
  ${essayHtml}
</body>
</html>`;
};

const toBase64DataUrl = (html: string): string => {
  const bytes = new TextEncoder().encode('\ufeff' + html);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return `data:application/msword;base64,${btoa(binary)}`;
};

const formatSize = (byteCount: number): string => {
  if (byteCount < 1024) return `${byteCount} B`;
  const kb = byteCount / 1024;
  return kb < 1024 ? `${kb.toFixed(1)} KB` : `${(kb / 1024).toFixed(1)} MB`;
};

interface BuatSoalAITabProps {
  onNavigateToTasks?: () => void;
  onNavigateToCbt?: () => void;
}

export const BuatSoalAITab: React.FC<BuatSoalAITabProps> = ({
  onNavigateToTasks,
  onNavigateToCbt,
}) => {
  const {
    teacher,
    materials,
    classes,
    activeClassId,
    activeSubject,
    availableSubjects,
    addTask,
    addCbtExam,
    questionSets: savedSets,
    addQuestionSet,
    updateQuestionSet,
    deleteQuestionSet,
  } = useLMS();

  const [questionSubject, setQuestionSubject] = useState<string>(() =>
    activeSubject !== 'all' ? activeSubject : getPrimarySubject(teacher.subject)
  );
  const [uraianMateri, setUraianMateri] = useState('');
  const [pgCount, setPgCount] = useState<number>(10);
  const [essayCount, setEssayCount] = useState<number>(2);
  const [selectedMaterialId, setSelectedMaterialId] = useState('');

  const [isGenerating, setIsGenerating] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const [activeSetId, setActiveSetId] = useState<string | null>(() => savedSets[0]?.id || null);

  const [showAnswerKey, setShowAnswerKey] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Share to Task inline drawer
  const [isShareOpen, setIsShareOpen] = useState(false);
  const [shareClassId, setShareClassId] = useState<string>(activeClassId || 'all');
  const [shareDueDate, setShareDueDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 3);
    return d.toISOString().split('T')[0];
  });
  const [shareSuccessMsg, setShareSuccessMsg] = useState('');

  // Publish to Online CBT inline drawer
  const [isCbtOpen, setIsCbtOpen] = useState(false);
  const [cbtClassId, setCbtClassId] = useState<string>(activeClassId || 'all');
  const [cbtDurationMinutes, setCbtDurationMinutes] = useState<number>(45);
  const [cbtShowResult, setCbtShowResult] = useState<boolean>(true);
  const [cbtSuccessMsg, setCbtSuccessMsg] = useState('');

  useEffect(() => {
    if (!activeSetId && savedSets.length > 0) {
      setActiveSetId(savedSets[0].id);
    } else if (activeSetId && savedSets.length > 0 && !savedSets.some((s) => s.id === activeSetId)) {
      setActiveSetId(savedSets[0].id);
    }
  }, [savedSets, activeSetId]);

  useEffect(() => {
    setShareClassId(activeClassId || 'all');
    setCbtClassId(activeClassId || 'all');
  }, [activeClassId]);

  useEffect(() => {
    if (activeSubject !== 'all') {
      setQuestionSubject(activeSubject);
    } else {
      setQuestionSubject((prev) => prev || getPrimarySubject(teacher.subject));
    }
  }, [activeSubject, teacher.subject]);

  const activeSet = savedSets.find((s) => s.id === activeSetId) || null;

  const handlePgCountChange = (val: string) => {
    if (val === '') {
      setPgCount(0);
      return;
    }
    const n = Math.trunc(Number(val));
    if (!Number.isNaN(n)) {
      setPgCount(Math.min(50, Math.max(0, n)));
    }
  };

  const handleEssayCountChange = (val: string) => {
    if (val === '') {
      setEssayCount(0);
      return;
    }
    const n = Math.trunc(Number(val));
    if (!Number.isNaN(n)) {
      setEssayCount(Math.min(5, Math.max(0, n)));
    }
  };

  const handleImportFromMaterial = (matId: string) => {
    setSelectedMaterialId(matId);
    const mat = materials.find((m) => m.id === matId);
    if (!mat) return;
    if (mat.subject?.trim()) {
      setQuestionSubject(mat.subject.trim());
    }
    const combined = `${mat.title}\n\n${mat.content}`.trim();
    setUraianMateri(combined);
    setErrorMsg('');
  };

  const safeReadJson = async (response: Response) => {
    const rawText = await response.text();
    if (!rawText.trim()) {
      if (response.status === 405) {
        throw new Error(
          'Endpoint /api/generate-questions belum ditangani backend (HTTP 405). Pastikan backend Node.js (server.ts) atau fungsi serverless /api di Vercel aktif.'
        );
      }
      throw new Error(
        `Server tidak mengembalikan data (HTTP ${response.status}). Pastikan server backend aktif atau kurangi jumlah soal per proses.`
      );
    }
    try {
      return JSON.parse(rawText);
    } catch {
      throw new Error(
        response.ok
          ? 'Respons server bukan format JSON yang valid.'
          : `Server mengembalikan respons tidak valid (HTTP ${response.status}). Pastikan endpoint /api berjalan.`
      );
    }
  };

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setShareSuccessMsg('');

    const trimmed = uraianMateri.trim();
    if (trimmed.length < 10) {
      setErrorMsg('Masukkan uraian materi minimal 10 karakter agar AI dapat menyusun soal yang akurat.');
      return;
    }
    if (pgCount + essayCount === 0) {
      setErrorMsg('Minimal jumlah soal adalah 1. Atur jumlah PG (0–50) atau Uraian (0–5).');
      return;
    }

    setIsGenerating(true);
    try {
      // Split large requests (> 10 PG) into clean sequential batches to prevent gateway timeouts
      const MAX_BATCH_PG = 10;
      const batches: Array<{ pg: number; essay: number }> = [];
      if (pgCount === 0) {
        batches.push({ pg: 0, essay: essayCount });
      } else {
        let rem = pgCount;
        let first = true;
        while (rem > 0) {
          const take = Math.min(MAX_BATCH_PG, rem);
          batches.push({ pg: take, essay: first ? essayCount : 0 });
          rem -= take;
          first = false;
        }
      }

      const mcList: GeneratedPGQuestion[] = [];
      const esList: GeneratedEssayQuestion[] = [];
      let resolvedTitle = '';

      const resolvedSubject = questionSubject.trim() || getPrimarySubject(teacher.subject);

      for (let i = 0; i < batches.length; i++) {
        const b = batches[i];
        const response = await fetch('/api/generate-questions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            uraianMateri: trimmed,
            pgCount: b.pg,
            essayCount: b.essay,
            subject: resolvedSubject,
          }),
        });

        const data = await safeReadJson(response);
        if (!response.ok) {
          throw new Error(data?.error || 'Gagal membuat soal dari server AI.');
        }

        if (!resolvedTitle && typeof data.title === 'string' && data.title.trim()) {
          resolvedTitle = data.title.trim();
        }
        if (Array.isArray(data.multipleChoice)) {
          mcList.push(...data.multipleChoice);
        }
        if (Array.isArray(data.essay)) {
          esList.push(...data.essay);
        }
      }

      const newSet: GeneratedQuestionSet = {
        id: `qset_${Date.now()}`,
        title: resolvedTitle || `Latihan ${resolvedSubject}`,
        subject: resolvedSubject,
        sourceMaterial: trimmed,
        createdAt: new Date().toISOString().split('T')[0],
        pgCount: mcList.length,
        essayCount: esList.length,
        multipleChoice: mcList,
        essay: esList,
      };

      addQuestionSet(newSet);
      setActiveSetId(newSet.id);
      setIsShareOpen(false);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Terjadi kesalahan saat membuat soal.');
    } finally {
      setIsGenerating(false);
    }
  };

  const updateActiveSet = (updater: (current: GeneratedQuestionSet) => GeneratedQuestionSet) => {
    if (!activeSet) return;
    const updated = updater(activeSet);
    updateQuestionSet(activeSet.id, updated);
  };

  const handleUpdateTitle = (title: string) => {
    updateActiveSet((s) => ({ ...s, title }));
  };

  const handleUpdatePG = (qId: string, patch: Partial<GeneratedPGQuestion>) => {
    updateActiveSet((s) => ({
      ...s,
      multipleChoice: s.multipleChoice.map((q) => (q.id === qId ? { ...q, ...patch } : q)),
    }));
  };

  const handleUpdatePGOption = (qId: string, optIdx: number, val: string) => {
    updateActiveSet((s) => ({
      ...s,
      multipleChoice: s.multipleChoice.map((q) => {
        if (q.id !== qId) return q;
        const nextOpts = [...q.options];
        nextOpts[optIdx] = val;
        return { ...q, options: nextOpts };
      }),
    }));
  };

  const handleDeletePG = (qId: string) => {
    updateActiveSet((s) => {
      const next = s.multipleChoice.filter((q) => q.id !== qId);
      return { ...s, multipleChoice: next, pgCount: next.length };
    });
  };

  const handleUpdateEssay = (qId: string, patch: Partial<GeneratedEssayQuestion>) => {
    updateActiveSet((s) => ({
      ...s,
      essay: s.essay.map((q) => (q.id === qId ? { ...q, ...patch } : q)),
    }));
  };

  const handleDeleteEssay = (qId: string) => {
    updateActiveSet((s) => {
      const next = s.essay.filter((q) => q.id !== qId);
      return { ...s, essay: next, essayCount: next.length };
    });
  };

  const handleDeleteSet = (id: string) => {
    const remaining = savedSets.filter((s) => s.id !== id);
    deleteQuestionSet(id);
    if (activeSetId === id) {
      setActiveSetId(remaining[0]?.id || null);
    }
  };

  const handleDownloadWord = (includeKey: boolean) => {
    if (!activeSet) return;
    const html = buildWordHtml(activeSet, includeKey, teacher.name);
    const blob = new Blob(['\ufeff' + html], { type: 'application/msword;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const safeTitle = activeSet.title.replace(/[^a-zA-Z0-9_-]+/g, '_').replace(/^_+|_+$/g, '') || 'Soal_AI';
    a.href = url;
    a.download = `${safeTitle}${includeKey ? '_Kunci_Pembahasan' : '_Naskah_Soal'}.doc`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleCopyText = async () => {
    if (!activeSet) return;
    const lines: string[] = [];
    lines.push(activeSet.title.toUpperCase());
    lines.push(`Mata Pelajaran: ${activeSet.subject}`);
    lines.push('');

    if (activeSet.multipleChoice.length > 0) {
      lines.push(`A. PILIHAN GANDA (${activeSet.multipleChoice.length} Soal)`);
      activeSet.multipleChoice.forEach((q, idx) => {
        lines.push(`${idx + 1}. ${q.question}`);
        q.options.forEach((opt, oIdx) => {
          lines.push(`   ${OPTION_LABELS[oIdx]}. ${opt}`);
        });
        if (showAnswerKey) {
          lines.push(`   [Kunci: ${OPTION_LABELS[q.correctIndex]}]${q.explanation ? ` — ${q.explanation}` : ''}`);
        }
        lines.push('');
      });
    }

    if (activeSet.essay.length > 0) {
      lines.push(`${activeSet.multipleChoice.length > 0 ? 'B' : 'A'}. URAIAN (${activeSet.essay.length} Soal)`);
      activeSet.essay.forEach((q, idx) => {
        lines.push(`${idx + 1}. ${q.question}`);
        if (showAnswerKey && q.answerKey) {
          lines.push(`   [Kunci Jawaban]: ${q.answerKey}`);
        }
        lines.push('');
      });
    }

    try {
      await navigator.clipboard.writeText(lines.join('\n'));
      setCopiedId(activeSet.id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      setErrorMsg('Browser tidak mengizinkan salin otomatis. Gunakan tombol Unduh Word.');
    }
  };

  const handlePublishToTask = () => {
    if (!activeSet) return;
    const htmlWithoutKey = buildWordHtml(activeSet, false, teacher.name);
    const dataUrl = toBase64DataUrl(htmlWithoutKey);
    const safeName = activeSet.title.replace(/[^a-zA-Z0-9_-]+/g, '_').replace(/^_+|_+$/g, '') || 'Soal_AI';

    const attachment: MaterialAttachment = {
      name: `${safeName}.doc`,
      size: formatSize(new TextEncoder().encode(htmlWithoutKey).length),
      type: 'word',
      dataUrl,
    };

    const previewLines: string[] = [];
    previewLines.push(
      `Kerjakan latihan soal berikut (${activeSet.multipleChoice.length} Pilihan Ganda${
        activeSet.essay.length > 0 ? ` dan ${activeSet.essay.length} Uraian` : ''
      }). Unduh lembar soal Word terlampir atau baca soal di bawah ini:`
    );
    previewLines.push('');
    if (activeSet.multipleChoice.length > 0) {
      previewLines.push('=== PILIHAN GANDA ===');
      activeSet.multipleChoice.forEach((q, i) => {
        previewLines.push(`${i + 1}. ${q.question}`);
        q.options.forEach((o, oi) => {
          previewLines.push(`   ${OPTION_LABELS[oi]}. ${o}`);
        });
      });
    }
    if (activeSet.essay.length > 0) {
      previewLines.push('');
      previewLines.push('=== URAIAN ===');
      activeSet.essay.forEach((q, i) => {
        previewLines.push(`${i + 1}. ${q.question}`);
      });
    }

    addTask({
      title: activeSet.title,
      subject: activeSet.subject,
      instructions: previewLines.join('\n'),
      dueDate: shareDueDate,
      classId: shareClassId || 'all',
      attachment,
    });

    setIsShareOpen(false);
    setShareSuccessMsg('Paket soal berhasil diterbitkan ke menu Tugas & Nilai (tanpa kunci jawaban).');
  };

  const handlePublishToCbt = () => {
    if (!activeSet) return;
    const examId = addCbtExam({
      questionSetId: activeSet.id,
      title: activeSet.title,
      subject: activeSet.subject,
      classId: cbtClassId || 'all',
      durationMinutes: Math.min(240, Math.max(1, Math.trunc(cbtDurationMinutes || 45))),
      showResultToStudent: cbtShowResult,
      isActive: true,
      multipleChoice: activeSet.multipleChoice,
      essay: activeSet.essay,
    });
    if (!examId) {
      setErrorMsg('Pastikan Anda masuk sebagai Guru/Admin Cloud terverifikasi untuk menerbitkan CBT.');
      return;
    }
    setIsCbtOpen(false);
    setCbtSuccessMsg(
      `Ujian CBT "${activeSet.title}" resmi aktif! Siswa kini bisa mengerjakan di menu Ujian CBT & nilai langsung masuk ke Ruang Guru.`
    );
  };

  return (
    <div className="space-y-5">
      {/* Header Banner */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 print:hidden">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-xs">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm sm:text-base font-bold text-slate-900">
              Pembuat Soal Otomatis AI
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Masukkan uraian materi ajar, atur jumlah soal Pilihan Ganda (maks 50 / 0) &amp; Uraian (maks 5 / 0), lalu AI menyusun soal lengkap dengan kunci jawaban.
            </p>
          </div>
        </div>
        <div className="text-xs text-slate-600 bg-slate-50 border border-slate-200 px-3 py-2 rounded-lg shrink-0">
          Mapel Soal: <strong className="text-indigo-700">{questionSubject.trim() || getPrimarySubject(teacher.subject)}</strong>
        </div>
      </div>

      {/* Generator Form */}
      <form onSubmit={handleGenerate} className="bg-white rounded-xl border border-slate-200 p-5 space-y-4 print:hidden">
        {/* Mata Pelajaran Soal (Bebas) */}
        <div className="space-y-1.5">
          <div className="flex flex-col sm:flex-row sm:items-center gap-2">
            <label htmlFor="soal-subject" className="text-xs font-semibold text-slate-800 shrink-0">
              Mata Pelajaran Soal (Bebas):
            </label>
            <input
              id="soal-subject"
              type="text"
              value={questionSubject}
              onChange={(e) => setQuestionSubject(e.target.value)}
              placeholder="Ketik nama mapel apa saja..."
              className="w-full sm:max-w-xs text-xs px-3 py-1.5 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-indigo-500 bg-white"
            />
          </div>
          {availableSubjects.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] text-slate-500">Pilih cepat:</span>
              {availableSubjects.map((subj) => (
                <button
                  key={subj}
                  type="button"
                  onClick={() => setQuestionSubject(subj)}
                  className={`px-2 py-0.5 text-[11px] font-medium rounded-md border transition-colors ${
                    questionSubject.trim().toLowerCase() === subj.toLowerCase()
                      ? 'bg-indigo-50 text-indigo-700 border-indigo-200 font-semibold'
                      : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {subj}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <label htmlFor="uraian-materi" className="text-xs font-semibold text-slate-800 flex items-center gap-1.5">
            <BookOpen className="w-4 h-4 text-indigo-600" />
            <span>Uraian Materi Ajar</span>
          </label>

          {materials.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-slate-500">Ambil dari Bahan Ajar:</span>
              <select
                value={selectedMaterialId}
                onChange={(e) => handleImportFromMaterial(e.target.value)}
                className="text-xs border border-slate-300 rounded-lg px-2.5 py-1 bg-white text-slate-700 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 max-w-[220px]"
              >
                <option value="">-- Pilih materi tersimpan --</option>
                {materials.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.title}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        <textarea
          id="uraian-materi"
          rows={6}
          value={uraianMateri}
          onChange={(e) => setUraianMateri(e.target.value)}
          placeholder="Tempel atau tulis ringkasan/uraian materi pembelajaran di sini... (misal: Sel prokariotik vs eukariotik, organel sel, fotosintesis, rumus atau teks bacaan yang ingin dijadikan soal)"
          className="w-full text-xs sm:text-sm p-3.5 border border-slate-300 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-indigo-500 bg-slate-50/40 text-slate-800 leading-relaxed"
        />

        {/* PG & Essay Count Controls */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Pilihan Ganda */}
          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 space-y-2.5">
            <div className="flex items-center justify-between">
              <div>
                <label htmlFor="pg-count" className="text-xs font-semibold text-slate-800 block">
                  Jumlah Soal Pilihan Ganda (PG)
                </label>
                <span className="text-[11px] text-slate-500">Maksimal 50 soal (isi 0 jika tidak ada)</span>
              </div>
              <input
                id="pg-count"
                type="number"
                min={0}
                max={50}
                value={pgCount}
                onChange={(e) => handlePgCountChange(e.target.value)}
                className="w-20 text-center text-sm font-bold text-indigo-700 bg-white border border-slate-300 rounded-lg py-1.5 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              {[0, 5, 10, 20, 30, 50].map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setPgCount(preset)}
                  className={`px-2.5 py-1 text-[11px] font-semibold rounded-md border transition-colors ${
                    pgCount === preset
                      ? 'bg-indigo-600 text-white border-indigo-600'
                      : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {preset === 0 ? '0 (Tanpa PG)' : `${preset} Soal`}
                </button>
              ))}
            </div>
          </div>

          {/* Uraian */}
          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 space-y-2.5">
            <div className="flex items-center justify-between">
              <div>
                <label htmlFor="essay-count" className="text-xs font-semibold text-slate-800 block">
                  Jumlah Soal Uraian / Esai
                </label>
                <span className="text-[11px] text-slate-500">Maksimal 5 soal (isi 0 jika tidak ada)</span>
              </div>
              <input
                id="essay-count"
                type="number"
                min={0}
                max={5}
                value={essayCount}
                onChange={(e) => handleEssayCountChange(e.target.value)}
                className="w-20 text-center text-sm font-bold text-indigo-700 bg-white border border-slate-300 rounded-lg py-1.5 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              {[0, 1, 2, 3, 5].map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setEssayCount(preset)}
                  className={`px-2.5 py-1 text-[11px] font-semibold rounded-md border transition-colors ${
                    essayCount === preset
                      ? 'bg-indigo-600 text-white border-indigo-600'
                      : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {preset === 0 ? '0 (Tanpa Uraian)' : `${preset} Soal`}
                </button>
              ))}
            </div>
          </div>
        </div>

        {errorMsg && (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
          <div className="text-xs text-slate-500">
            Komposisi saat ini:{' '}
            <strong className="text-slate-800">
              {pgCount} Pilihan Ganda
            </strong>{' '}
            dan{' '}
            <strong className="text-slate-800">
              {essayCount} Uraian
            </strong>
            {pgCount + essayCount === 0 && (
              <span className="text-rose-600 ml-1">(minimal total 1 soal)</span>
            )}
          </div>

          <button
            type="submit"
            disabled={isGenerating || pgCount + essayCount === 0}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 text-xs sm:text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 disabled:cursor-not-allowed rounded-xl shadow-xs transition-colors"
          >
            {isGenerating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>AI Sedang Menyusun {pgCount + essayCount} Soal...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                <span>Buat Soal dengan AI</span>
              </>
            )}
          </button>
        </div>
      </form>

      {/* Main Content Area: Active Question Set + Saved History */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-5">
        {/* Saved Question History Sidebar */}
        {savedSets.length > 0 && (
          <aside className="order-2 lg:order-1 lg:col-span-1 space-y-2.5 print:hidden">
            <div className="bg-white rounded-xl border border-slate-200 p-3.5 space-y-2.5">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-800">
                <History className="w-4 h-4 text-indigo-600" />
                <span>Riwayat Paket Soal ({savedSets.length})</span>
              </div>
              <div className="space-y-1.5 max-h-[420px] overflow-y-auto pr-0.5">
                {savedSets.map((setItem) => {
                  const isActive = setItem.id === activeSet?.id;
                  return (
                    <div
                      key={setItem.id}
                      className={`group flex items-start justify-between gap-2 p-2.5 rounded-lg border text-left transition-colors cursor-pointer ${
                        isActive
                          ? 'bg-indigo-50 border-indigo-200 text-indigo-900'
                          : 'bg-slate-50/70 border-slate-200 hover:bg-slate-100 text-slate-700'
                      }`}
                      onClick={() => {
                        setActiveSetId(setItem.id);
                        setShareSuccessMsg('');
                      }}
                    >
                      <div className="min-w-0">
                        <div className="text-xs font-semibold truncate">{setItem.title}</div>
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          {setItem.multipleChoice.length} PG · {setItem.essay.length} Uraian · {setItem.createdAt}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={(ev) => {
                          ev.stopPropagation();
                          if (confirm('Hapus paket soal ini dari riwayat?')) {
                            handleDeleteSet(setItem.id);
                          }
                        }}
                        className="p-1 text-slate-400 hover:text-rose-600 rounded transition-colors shrink-0"
                        title="Hapus Paket Soal"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          </aside>
        )}

        {/* Active Generated Question Editor & Preview */}
        <section className={savedSets.length > 0 ? 'order-1 lg:order-2 lg:col-span-3' : 'lg:col-span-4'}>
          {!activeSet ? (
            <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
              <FileText className="w-9 h-9 text-slate-300 mx-auto mb-2.5" />
              <h3 className="text-sm font-semibold text-slate-800">Belum Ada Paket Soal Dibuat</h3>
              <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                Masukkan uraian materi di atas, pilih jumlah soal Pilihan Ganda (0–50) dan Uraian (0–5), lalu klik{' '}
                <strong>Buat Soal dengan AI</strong>.
              </p>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-5">
              {/* Paket Header & Toolbar */}
              <div className="space-y-3 border-b border-slate-200 pb-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <input
                      type="text"
                      value={activeSet.title}
                      onChange={(e) => handleUpdateTitle(e.target.value)}
                      className="w-full text-base font-bold text-slate-900 bg-transparent border-b border-transparent hover:border-slate-300 focus:border-indigo-500 focus:outline-hidden pb-0.5"
                    />
                    <div className="text-xs text-slate-500 mt-1 flex flex-wrap items-center gap-2">
                      <span>Mapel: <strong>{activeSet.subject}</strong></span>
                      <span aria-hidden="true">·</span>
                      <span>{activeSet.multipleChoice.length} Pilihan Ganda</span>
                      <span aria-hidden="true">·</span>
                      <span>{activeSet.essay.length} Uraian</span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setShowAnswerKey((v) => !v)}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors print:hidden shrink-0 ${
                      showAnswerKey
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {showAnswerKey ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                    <span>{showAnswerKey ? 'Kunci Jawaban Tampil' : 'Kunci Tersembunyi'}</span>
                  </button>
                </div>

                {/* Export & LMS Publish Buttons */}
                <div className="flex flex-wrap items-center gap-2 print:hidden">
                  <button
                    type="button"
                    onClick={() => {
                      setIsCbtOpen((v) => !v);
                      setIsShareOpen(false);
                      setCbtSuccessMsg('');
                    }}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-xs transition-colors"
                  >
                    <MonitorCheck className="w-3.5 h-3.5" />
                    <span>Terbitkan CBT Online</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setIsShareOpen((v) => !v);
                      setIsCbtOpen(false);
                      setShareSuccessMsg('');
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-xs transition-colors"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Bagikan ke Tugas Kelas</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleDownloadWord(false)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors"
                  >
                    <Download className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Unduh Soal (.doc)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleDownloadWord(true)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors"
                  >
                    <Download className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Unduh Soal + Kunci (.doc)</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleCopyText}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors"
                  >
                    {copiedId === activeSet.id ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                        <span className="text-emerald-700 font-semibold">Tersalin</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Salin Teks</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => window.print()}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>Cetak / PDF</span>
                  </button>
                </div>

                {/* Inline Publish CBT Online Drawer */}
                {isCbtOpen && (
                  <div className="p-3.5 rounded-xl bg-emerald-50/70 border border-emerald-200 space-y-3 print:hidden">
                    <div className="text-xs font-semibold text-emerald-900 flex items-center gap-1.5">
                      <MonitorCheck className="w-4 h-4 text-emerald-700" />
                      <span>Terbitkan Paket Soal Ini Menjadi Ujian CBT Online</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 items-end">
                      <div>
                        <label className="text-[11px] font-medium text-slate-700 block mb-1">
                          Target Kelas Peserta
                        </label>
                        <select
                          value={cbtClassId}
                          onChange={(e) => setCbtClassId(e.target.value)}
                          className="w-full text-xs border border-slate-300 rounded-lg px-2.5 py-1.5 bg-white"
                        >
                          <option value="all">Semua Kelas</option>
                          {classes.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="text-[11px] font-medium text-slate-700 block mb-1">
                          Durasi Pengerjaan (Menit)
                        </label>
                        <input
                          type="number"
                          min={5}
                          max={240}
                          value={cbtDurationMinutes}
                          onChange={(e) =>
                            setCbtDurationMinutes(Math.min(240, Math.max(1, Number(e.target.value) || 30)))
                          }
                          className="w-full text-xs font-mono font-bold border border-slate-300 rounded-lg px-2.5 py-1.5 bg-white"
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={handlePublishToCbt}
                          className="flex-1 px-3 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors"
                        >
                          Aktifkan Ujian CBT
                        </button>
                        <button
                          type="button"
                          onClick={() => setIsCbtOpen(false)}
                          className="px-3 py-1.5 text-xs font-medium text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg"
                        >
                          Batal
                        </button>
                      </div>
                    </div>
                    <label className="flex items-center gap-2 text-xs text-emerald-900 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={cbtShowResult}
                        onChange={(e) => setCbtShowResult(e.target.checked)}
                        className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                      />
                      <span>
                        Langsung tampilkan skor CBT, kunci jawaban &amp; pembahasan ke siswa setelah selesai mengerjakan
                      </span>
                    </label>
                  </div>
                )}

                {cbtSuccessMsg && (
                  <div className="flex items-center justify-between gap-2 p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs print:hidden">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 shrink-0" />
                      <span>{cbtSuccessMsg}</span>
                    </div>
                    {onNavigateToCbt && (
                      <button
                        type="button"
                        onClick={onNavigateToCbt}
                        className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md font-semibold text-[11px] shrink-0"
                      >
                        Lihat Hasil CBT di Ruang Guru
                      </button>
                    )}
                  </div>
                )}

                {/* Inline Share to Tugas Kelas Drawer */}
                {isShareOpen && (
                  <div className="p-3.5 rounded-xl bg-indigo-50/70 border border-indigo-200 space-y-3 print:hidden">
                    <div className="text-xs font-semibold text-indigo-900">
                      Terbitkan sebagai Tugas / Latihan Soal di Menu Tugas &amp; Nilai
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 items-end">
                      <div>
                        <label className="text-[11px] font-medium text-slate-700 block mb-1">
                          Target Kelas
                        </label>
                        <select
                          value={shareClassId}
                          onChange={(e) => setShareClassId(e.target.value)}
                          className="w-full text-xs border border-slate-300 rounded-lg px-2.5 py-1.5 bg-white"
                        >
                          <option value="all">Semua Kelas</option>
                          {classes.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="text-[11px] font-medium text-slate-700 block mb-1">
                          Tenggat Pengumpulan
                        </label>
                        <input
                          type="date"
                          value={shareDueDate}
                          onChange={(e) => setShareDueDate(e.target.value)}
                          className="w-full text-xs border border-slate-300 rounded-lg px-2.5 py-1.5 bg-white"
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={handlePublishToTask}
                          className="flex-1 px-3 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors"
                        >
                          Terbitkan Tugas
                        </button>
                        <button
                          type="button"
                          onClick={() => setIsShareOpen(false)}
                          className="px-3 py-1.5 text-xs font-medium text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg"
                        >
                          Batal
                        </button>
                      </div>
                    </div>
                    <p className="text-[11px] text-indigo-800">
                      File Word soal otomatis dilampirkan tanpa kunci jawaban agar siswa hanya menerima naskah soal.
                    </p>
                  </div>
                )}

                {shareSuccessMsg && (
                  <div className="flex items-center justify-between gap-2 p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs print:hidden">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 shrink-0" />
                      <span>{shareSuccessMsg}</span>
                    </div>
                    {onNavigateToTasks && (
                      <button
                        type="button"
                        onClick={onNavigateToTasks}
                        className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md font-semibold text-[11px] shrink-0"
                      >
                        Lihat di Tugas &amp; Nilai
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Section A: Multiple Choice */}
              {activeSet.multipleChoice.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-xs sm:text-sm font-bold text-slate-900 uppercase tracking-wide">
                    A. Soal Pilihan Ganda ({activeSet.multipleChoice.length} Butir)
                  </h3>
                  <div className="space-y-3">
                    {activeSet.multipleChoice.map((q, idx) => (
                      <div
                        key={q.id}
                        className="p-4 rounded-xl border border-slate-200 bg-slate-50/40 space-y-2.5"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-start gap-2 flex-1">
                            <span className="text-xs font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-md px-2 py-0.5 shrink-0 mt-0.5">
                              {idx + 1}
                            </span>
                            <textarea
                              rows={2}
                              value={q.question}
                              onChange={(e) => handleUpdatePG(q.id, { question: e.target.value })}
                              className="w-full text-xs sm:text-sm font-medium text-slate-800 bg-transparent border border-transparent hover:border-slate-200 focus:border-indigo-400 focus:bg-white rounded-lg p-1 focus:outline-hidden resize-y"
                            />
                          </div>
                          <button
                            type="button"
                            onClick={() => handleDeletePG(q.id)}
                            className="p-1 text-slate-400 hover:text-rose-600 rounded print:hidden shrink-0"
                            title="Hapus butir soal ini"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pl-0 sm:pl-8">
                          {q.options.map((opt, oIdx) => {
                            const isCorrect = oIdx === q.correctIndex;
                            const highlight = showAnswerKey && isCorrect;
                            return (
                              <div
                                key={oIdx}
                                className={`flex items-center gap-2 p-2 rounded-lg border text-xs ${
                                  highlight
                                    ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                                    : 'bg-white border-slate-200 text-slate-700'
                                }`}
                              >
                                <button
                                  type="button"
                                  onClick={() => handleUpdatePG(q.id, { correctIndex: oIdx })}
                                  title="Klik untuk jadikan kunci jawaban"
                                  className={`w-6 h-6 rounded-md font-bold text-[11px] flex items-center justify-center shrink-0 border transition-colors ${
                                    highlight
                                      ? 'bg-emerald-600 text-white border-emerald-600'
                                      : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-indigo-50 hover:text-indigo-700'
                                  }`}
                                >
                                  {OPTION_LABELS[oIdx]}
                                </button>
                                <input
                                  type="text"
                                  value={opt}
                                  onChange={(e) => handleUpdatePGOption(q.id, oIdx, e.target.value)}
                                  className="w-full bg-transparent text-xs focus:outline-hidden"
                                />
                              </div>
                            );
                          })}
                        </div>

                        {showAnswerKey && (
                          <div className="pl-0 sm:pl-8 pt-1">
                            <div className="text-[11px] text-emerald-800 bg-emerald-50/70 border border-emerald-200 rounded-lg px-3 py-1.5 flex flex-col sm:flex-row sm:items-center gap-1.5">
                              <span className="font-bold shrink-0">
                                Kunci: {OPTION_LABELS[q.correctIndex]}
                              </span>
                              <span className="hidden sm:inline text-emerald-400">|</span>
                              <input
                                type="text"
                                value={q.explanation || ''}
                                onChange={(e) => handleUpdatePG(q.id, { explanation: e.target.value })}
                                placeholder="Tambahkan pembahasan singkat..."
                                className="w-full bg-transparent text-[11px] text-slate-700 focus:outline-hidden"
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Section B: Essay */}
              {activeSet.essay.length > 0 && (
                <div className="space-y-3 pt-2">
                  <h3 className="text-xs sm:text-sm font-bold text-slate-900 uppercase tracking-wide">
                    {activeSet.multipleChoice.length > 0 ? 'B' : 'A'}. Soal Uraian / Esai ({activeSet.essay.length} Butir)
                  </h3>
                  <div className="space-y-3">
                    {activeSet.essay.map((q, idx) => (
                      <div
                        key={q.id}
                        className="p-4 rounded-xl border border-slate-200 bg-slate-50/40 space-y-2.5"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-start gap-2 flex-1">
                            <span className="text-xs font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-md px-2 py-0.5 shrink-0 mt-0.5">
                              {idx + 1}
                            </span>
                            <textarea
                              rows={2}
                              value={q.question}
                              onChange={(e) => handleUpdateEssay(q.id, { question: e.target.value })}
                              className="w-full text-xs sm:text-sm font-medium text-slate-800 bg-transparent border border-transparent hover:border-slate-200 focus:border-indigo-400 focus:bg-white rounded-lg p-1 focus:outline-hidden resize-y"
                            />
                          </div>
                          <button
                            type="button"
                            onClick={() => handleDeleteEssay(q.id)}
                            className="p-1 text-slate-400 hover:text-rose-600 rounded print:hidden shrink-0"
                            title="Hapus soal uraian ini"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        {showAnswerKey && (
                          <div className="pl-0 sm:pl-8">
                            <div className="bg-emerald-50/70 border border-emerald-200 rounded-lg p-2.5 space-y-1">
                              <span className="text-[11px] font-bold text-emerald-800 block">
                                Kunci Jawaban / Rubrik Penilaian:
                              </span>
                              <textarea
                                rows={2}
                                value={q.answerKey}
                                onChange={(e) => handleUpdateEssay(q.id, { answerKey: e.target.value })}
                                className="w-full bg-transparent text-xs text-slate-700 focus:outline-hidden resize-y"
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  );
};
