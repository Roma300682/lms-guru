import React, { useState, useEffect, useMemo } from 'react';
import { useLMS } from '../../context/LMSContext';
import { WhatsAppPrefill } from '../../types/lms';
import {
  buildWaMeUrl,
  normalizeWhatsAppNumber,
  personalizeWhatsAppMessage,
} from '../../utils/whatsapp';
import { getPrimarySubject } from '../../utils/subjects';
import { buildStudentPortalLink } from '../../utils/phoneAuth';
import {
  MessageCircle,
  Send,
  Users,
  Check,
  Copy,
  BookOpen,
  ClipboardList,
  Bell,
  ExternalLink,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Edit2,
  RotateCcw,
  Link2,
} from 'lucide-react';

interface WhatsAppTabProps {
  prefill?: WhatsAppPrefill | null;
  onClearPrefill?: () => void;
}

interface BroadcastResultItem {
  id: string;
  name: string;
  phone: string;
  ok: boolean;
  detail: string;
}

export const WhatsAppTab: React.FC<WhatsAppTabProps> = ({ prefill, onClearPrefill }) => {
  const {
    teacher,
    classes,
    students,
    materials,
    tasks,
    submissions,
    activeClassId,
    activeSubject,
    updateStudent,
    updateClass,
  } = useLMS();

  const defaultSubject = activeSubject !== 'all' ? activeSubject : getPrimarySubject(teacher.subject);

  const [targetClassId, setTargetClassId] = useState<string>(activeClassId || 'all');
  const [filterMode, setFilterMode] = useState<'all' | 'unsubmitted'>('all');
  const [selectedTaskId, setSelectedTaskId] = useState<string>(tasks[0]?.id || '');
  const [selectedMaterialId, setSelectedMaterialId] = useState<string>(materials[0]?.id || '');

  const [messageTemplate, setMessageTemplate] = useState<string>(
    `Halo {nama} ({kelas}),\n\nInformasi terbaru mata pelajaran *{mapel}* dari {guru}:\n\nSilakan cek materi dan tugas terbaru di portal GuruMapel LMS. Terima kasih.`
  );

  // Per-student sent/edited state
  const [sentIds, setSentIds] = useState<Record<string, boolean>>({});
  const [editingWaId, setEditingWaId] = useState<string | null>(null);
  const [editingWaVal, setEditingWaVal] = useState('');

  // Class WA Group URL editing
  const [groupUrlDraft, setGroupUrlDraft] = useState('');
  const [groupSavedToast, setGroupSavedToast] = useState(false);

  // Copy feedback
  const [copiedType, setCopiedType] = useState<'msg' | 'phones' | null>(null);

  // Server WhatsApp Gateway status & broadcast state
  const [gatewayStatus, setGatewayStatus] = useState<{ configured: boolean; provider: string }>({
    configured: false,
    provider: 'fonnte',
  });
  const [isSendingServer, setIsSendingServer] = useState(false);
  const [serverSummary, setServerSummary] = useState<{
    sentCount: number;
    failedCount: number;
    results: BroadcastResultItem[];
  } | null>(null);
  const [serverError, setServerError] = useState('');

  useEffect(() => {
    fetch('/api/whatsapp/status')
      .then(async (res) => {
        if (!res.ok) return null;
        const txt = await res.text();
        if (!txt.trim()) return null;
        try {
          return JSON.parse(txt);
        } catch {
          return null;
        }
      })
      .then((data) => {
        if (data && typeof data.configured === 'boolean') {
          setGatewayStatus(data);
        }
      })
      .catch(() => {
        // Ignore silent status check errors; direct wa.me always works
      });
  }, []);

  // Apply external prefill (from MateriTab or TugasTab)
  useEffect(() => {
    if (!prefill) return;
    setMessageTemplate(prefill.message);
    if (prefill.classId) {
      setTargetClassId(prefill.classId);
    }
    if (prefill.onlyUnsubmittedTaskId) {
      setFilterMode('unsubmitted');
      setSelectedTaskId(prefill.onlyUnsubmittedTaskId);
    } else {
      setFilterMode('all');
    }
    setSentIds({});
    setServerSummary(null);
    setServerError('');
    if (onClearPrefill) onClearPrefill();
  }, [prefill, onClearPrefill]);

  // Sync group URL draft when selected class changes
  const selectedClassObj = classes.find((c) => c.id === targetClassId) || null;
  useEffect(() => {
    setGroupUrlDraft(selectedClassObj?.whatsappGroupUrl || '');
  }, [selectedClassObj?.id, selectedClassObj?.whatsappGroupUrl]);

  const getClassName = (cId: string) => {
    const found = classes.find((c) => c.id === cId);
    return found ? found.name : 'Kelas';
  };

  // Filtered target students
  const targetStudents = useMemo(() => {
    let base =
      targetClassId === 'all'
        ? students
        : students.filter((s) => s.classId === targetClassId);

    if (filterMode === 'unsubmitted' && selectedTaskId) {
      const submittedSet = new Set(
        submissions.filter((sub) => sub.taskId === selectedTaskId).map((sub) => sub.studentId)
      );
      base = base.filter((s) => !submittedSet.has(s.id));
    }

    return base;
  }, [students, targetClassId, filterMode, selectedTaskId, submissions]);

  const readyStudents = useMemo(
    () => targetStudents.filter((s) => Boolean(normalizeWhatsAppNumber(s.whatsapp))),
    [targetStudents]
  );

  const nextUnsentStudent = useMemo(
    () => readyStudents.find((s) => !sentIds[s.id]) || null,
    [readyStudents, sentIds]
  );

  const sentCount = useMemo(
    () => readyStudents.filter((s) => sentIds[s.id]).length,
    [readyStudents, sentIds]
  );

  const activeContextSubject =
    (filterMode === 'unsubmitted' && tasks.find((t) => t.id === selectedTaskId)?.subject?.trim()) ||
    defaultSubject;

  const buildPersonalizedForStudent = (
    studentName: string,
    studentClassId: string,
    studentId?: string
  ) =>
    personalizeWhatsAppMessage(messageTemplate, {
      name: studentName,
      className: getClassName(studentClassId),
      subject: activeContextSubject,
      teacherName: teacher.name,
      link: buildStudentPortalLink(studentId),
    });

  const generalBroadcastMessage = personalizeWhatsAppMessage(messageTemplate, {
    name: 'Siswa/i',
    className: targetClassId === 'all' ? 'Semua Kelas' : getClassName(targetClassId),
    subject: activeContextSubject,
    teacherName: teacher.name,
    link: buildStudentPortalLink(),
  });

  // Template fillers
  const applyMaterialTemplate = (matId: string) => {
    setSelectedMaterialId(matId);
    const mat = materials.find((m) => m.id === matId);
    if (!mat) return;
    setFilterMode('all');
    if (mat.classId !== 'all') setTargetClassId(mat.classId);
    const subjLabel = mat.subject?.trim() || defaultSubject;
    setMessageTemplate(
      `Halo {nama} ({kelas}),\n\nMateri baru mata pelajaran *${subjLabel}* telah dibagikan:\n*${mat.title}*\n\n${mat.content}${
        mat.linkUrl ? `\n\nTautan referensi: ${mat.linkUrl}` : ''
      }\n\nSilakan buka GuruMapel LMS untuk membaca materi dan mengunduh lampirannya.\nSalam,\n${teacher.name}`
    );
  };

  const applyTaskTemplate = (taskId: string, reminderMode: boolean) => {
    setSelectedTaskId(taskId);
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;
    if (task.classId !== 'all') setTargetClassId(task.classId);
    setFilterMode(reminderMode ? 'unsubmitted' : 'all');
    const subjLabel = task.subject?.trim() || defaultSubject;

    if (reminderMode) {
      setMessageTemplate(
        `Halo {nama} ({kelas}),\n\nPengingat tugas *${subjLabel}*:\n*${task.title}*\nBatas pengumpulan: *${task.dueDate}*\n\nTercatat Anda belum mengumpulkan tugas ini di GuruMapel LMS. Mohon segera diselesaikan dan dikumpulkan tepat waktu ya.\nTerima kasih,\n${teacher.name}`
      );
    } else {
      setMessageTemplate(
        `Halo {nama} ({kelas}),\n\nAda tugas baru mata pelajaran *${subjLabel}*:\n*${task.title}*\nTenggat: *${task.dueDate}*\n\nInstruksi:\n${task.instructions}\n\nSilakan kerjakan dan kumpulkan melalui GuruMapel LMS.\nSalam,\n${teacher.name}`
      );
    }
  };

  const handleSaveClassGroup = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClassObj) return;
    updateClass(selectedClassObj.id, { whatsappGroupUrl: groupUrlDraft.trim() || undefined });
    setGroupSavedToast(true);
    setTimeout(() => setGroupSavedToast(false), 2000);
  };

  const handleSaveWaNumber = (studentId: string) => {
    updateStudent(studentId, { whatsapp: editingWaVal.trim() || undefined });
    setEditingWaId(null);
    setEditingWaVal('');
  };

  const handleCopyText = async (text: string, type: 'msg' | 'phones') => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedType(type);
      setTimeout(() => setCopiedType(null), 2000);
    } catch {
      setServerError('Browser memblokir salin otomatis. Silakan salin teks secara manual.');
    }
  };

  const handleServerBroadcastAll = async () => {
    setServerError('');
    setServerSummary(null);
    if (readyStudents.length === 0) {
      setServerError('Belum ada siswa dengan nomor WhatsApp valid pada target kelas ini.');
      return;
    }

    setIsSendingServer(true);
    try {
      const recipients = readyStudents.map((s) => ({
        id: s.id,
        name: s.name,
        phone: normalizeWhatsAppNumber(s.whatsapp),
        message: buildPersonalizedForStudent(s.name, s.classId, s.id),
      }));

      const res = await fetch('/api/whatsapp/broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipients }),
      });

      const rawText = await res.text();
      let data: {
        error?: string;
        sentCount?: number;
        failedCount?: number;
        results?: BroadcastResultItem[];
      } = {};
      if (rawText.trim()) {
        try {
          data = JSON.parse(rawText);
        } catch {
          throw new Error(`Respons server tidak valid (HTTP ${res.status}).`);
        }
      } else {
        throw new Error(`Server tidak mengembalikan data (HTTP ${res.status}).`);
      }

      if (!res.ok) {
        throw new Error(data?.error || 'Gagal mengirim broadcast WhatsApp.');
      }

      const results: BroadcastResultItem[] = Array.isArray(data.results) ? data.results : [];
      const newSentMap: Record<string, boolean> = { ...sentIds };
      results.forEach((r) => {
        if (r.ok) newSentMap[r.id] = true;
      });
      setSentIds(newSentMap);

      setServerSummary({
        sentCount: Number(data.sentCount || 0),
        failedCount: Number(data.failedCount || 0),
        results,
      });
    } catch (err) {
      setServerError(err instanceof Error ? err.message : 'Gagal mengirim broadcast WhatsApp.');
    } finally {
      setIsSendingServer(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Header Banner */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-xs">
            <MessageCircle className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm sm:text-base font-bold text-slate-900">
              Kirim Pesan &amp; Broadcast WhatsApp ke Semua Siswa
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Bagikan materi, info tugas, atau pengingat ke grup kelas maupun ke semua nomor WhatsApp siswa sekaligus.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <span
            className={`inline-flex items-center gap-1.5 text-[11px] font-semibold px-3 py-1.5 rounded-lg border ${
              gatewayStatus.configured
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : 'bg-slate-50 text-slate-700 border-slate-200'
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full ${
                gatewayStatus.configured ? 'bg-emerald-500' : 'bg-amber-500'
              }`}
            />
            <span>
              {gatewayStatus.configured
                ? `Gateway Otomatis Aktif (${gatewayStatus.provider.toUpperCase()})`
                : 'Mode WhatsApp Web / wa.me Langsung'}
            </span>
          </span>
        </div>
      </div>

      {/* Main Grid: Composer + Target Controls */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left: Target & Message Composer */}
        <div className="lg:col-span-6 space-y-4">
          {/* Target Filter Card */}
          <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3.5">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                <Users className="w-4 h-4 text-emerald-600" />
                <span>1. Target Penerima</span>
              </h3>
              <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                {readyStudents.length} / {targetStudents.length} punya No. WA
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Pilih Kelas
                </label>
                <select
                  value={targetClassId}
                  onChange={(e) => {
                    setTargetClassId(e.target.value);
                    setSentIds({});
                  }}
                  className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2 bg-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="all">Semua Kelas ({students.length} siswa)</option>
                  {classes.map((c) => {
                    const count = students.filter((s) => s.classId === c.id).length;
                    return (
                      <option key={c.id} value={c.id}>
                        {c.name} ({count} siswa)
                      </option>
                    );
                  })}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Filter Siswa
                </label>
                <select
                  value={filterMode}
                  onChange={(e) => {
                    setFilterMode(e.target.value as 'all' | 'unsubmitted');
                    setSentIds({});
                  }}
                  className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2 bg-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="all">Semua Siswa di Target Kelas</option>
                  <option value="unsubmitted">Hanya yang Belum Kumpul Tugas</option>
                </select>
              </div>
            </div>

            {filterMode === 'unsubmitted' && (
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Pilih Tugas untuk Pengingat
                </label>
                {tasks.length === 0 ? (
                  <p className="text-xs text-slate-500 italic">Belum ada tugas tersimpan.</p>
                ) : (
                  <select
                    value={selectedTaskId}
                    onChange={(e) => {
                      setSelectedTaskId(e.target.value);
                      setSentIds({});
                    }}
                    className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2 bg-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                  >
                    {tasks.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.title} (Tenggat: {t.dueDate})
                      </option>
                    ))}
                  </select>
                )}
              </div>
            )}

            {/* Class WA Group Link */}
            {selectedClassObj && (
              <form
                onSubmit={handleSaveClassGroup}
                className="pt-2 border-t border-slate-100 space-y-2"
              >
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-semibold text-slate-700 flex items-center gap-1">
                    <Link2 className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Link Grup WhatsApp {selectedClassObj.name} (Opsional)</span>
                  </label>
                  {groupSavedToast && (
                    <span className="text-[11px] text-emerald-700 font-semibold flex items-center gap-1">
                      <Check className="w-3 h-3" /> Tersimpan
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    type="url"
                    value={groupUrlDraft}
                    onChange={(e) => setGroupUrlDraft(e.target.value)}
                    placeholder="https://chat.whatsapp.com/..."
                    className="w-full sm:flex-1 sm:min-w-0 text-xs px-3 py-2 sm:py-1.5 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                  />
                  <button
                    type="submit"
                    className="px-3 py-2 sm:py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors shrink-0"
                  >
                    Simpan
                  </button>
                  {selectedClassObj.whatsappGroupUrl && (
                    <a
                      href={selectedClassObj.whatsappGroupUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => handleCopyText(generalBroadcastMessage, 'msg')}
                      className="inline-flex items-center gap-1 px-3 py-2 sm:py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors shrink-0"
                      title="Salin pesan otomatis lalu buka Grup WA kelas"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>Buka Grup</span>
                    </a>
                  )}
                </div>
              </form>
            )}
          </div>

          {/* Message Composer Card */}
          <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              2. Isi Pesan &amp; Template Cepat
            </h3>

            {/* Quick Template Loaders */}
            <div className="flex flex-wrap items-center gap-1.5">
              {materials.length > 0 && (
                <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1">
                  <BookOpen className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                  <select
                    value={selectedMaterialId}
                    onChange={(e) => applyMaterialTemplate(e.target.value)}
                    className="text-[11px] bg-transparent font-medium text-slate-700 focus:outline-hidden max-w-[160px]"
                  >
                    <option value="">Isi dari Materi...</option>
                    {materials.map((m) => (
                      <option key={m.id} value={m.id}>
                        Materi: {m.title}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {tasks.length > 0 && (
                <>
                  <button
                    type="button"
                    onClick={() => applyTaskTemplate(selectedTaskId || tasks[0].id, false)}
                    className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-lg transition-colors"
                  >
                    <ClipboardList className="w-3.5 h-3.5" />
                    <span>Template Info Tugas</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => applyTaskTemplate(selectedTaskId || tasks[0].id, true)}
                    className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-lg transition-colors"
                  >
                    <Bell className="w-3.5 h-3.5" />
                    <span>Pengingat Belum Kumpul</span>
                  </button>
                </>
              )}
            </div>

            <textarea
              rows={7}
              value={messageTemplate}
              onChange={(e) => setMessageTemplate(e.target.value)}
              placeholder="Tulis pesan untuk semua siswa... Gunakan {nama} dan {kelas} agar pesan otomatis menyebut nama masing-masing siswa."
              className="w-full text-xs sm:text-sm p-3 border border-slate-300 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-emerald-500 leading-relaxed"
            />

            {/* Variable tags */}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500">
                <span>Sisipkan otomatis:</span>
                {['{nama}', '{kelas}', '{mapel}', '{guru}', '{link}'].map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => setMessageTemplate((prev) => `${prev}${prev.endsWith(' ') ? '' : ' '}${tag}`)}
                    className="px-2 py-0.5 font-mono bg-slate-100 hover:bg-slate-200 text-slate-700 rounded border border-slate-200 transition-colors"
                  >
                    {tag}
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={() => handleCopyText(generalBroadcastMessage, 'msg')}
                className="inline-flex items-center gap-1 text-xs font-medium text-slate-700 hover:text-slate-900 px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 transition-colors"
              >
                {copiedType === 'msg' ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                    <span className="text-emerald-700 font-semibold">Pesan Disalin</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Salin Pesan</span>
                  </>
                )}
              </button>
            </div>

            {/* Action Buttons */}
            <div className="pt-2 border-t border-slate-100 space-y-2.5">
              <div className="flex flex-wrap items-center gap-2">
                {gatewayStatus.configured && (
                  <button
                    type="button"
                    disabled={isSendingServer || readyStudents.length === 0}
                    onClick={handleServerBroadcastAll}
                    className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 rounded-xl shadow-xs transition-colors"
                  >
                    {isSendingServer ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Mengirim ke {readyStudents.length} Siswa...</span>
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4" />
                        <span>Kirim Otomatis ke Semua ({readyStudents.length} Nomor)</span>
                      </>
                    )}
                  </button>
                )}

                <a
                  href={buildWaMeUrl(undefined, generalBroadcastMessage)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-xs transition-colors text-center"
                >
                  <MessageCircle className="w-4 h-4" />
                  <span>Buka WhatsApp &amp; Pilih Grup / Siaran</span>
                </a>
              </div>

              {!gatewayStatus.configured && (
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  Gunakan tombol <strong>Buka WhatsApp &amp; Pilih Grup</strong> untuk langsung meneruskan ke Grup Kelas atau Daftar Siaran WA Anda, atau kirim personal satu per satu lewat antrean di sebelah kanan. (Untuk kirim otomatis 1-klik di background, atur <code className="bg-slate-100 px-1 rounded">WHATSAPP_TOKEN</code> di environment server.)
                </p>
              )}
            </div>

            {serverError && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{serverError}</span>
              </div>
            )}

            {serverSummary && (
              <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs space-y-1">
                <div className="flex items-center gap-1.5 font-semibold">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>
                    Broadcast selesai: {serverSummary.sentCount} terkirim, {serverSummary.failedCount} gagal.
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right: Send-to-All Student Queue */}
        <div className="lg:col-span-6 bg-white rounded-xl border border-slate-200 p-4 flex flex-col space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                3. Antrean Kirim Personal ke Semua Siswa
              </h3>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Progres: <strong className="text-emerald-700">{sentCount}</strong> / {readyStudents.length} siswa terkirim
              </p>
            </div>

            <div className="flex items-center gap-1.5">
              {readyStudents.length > 0 && (
                <button
                  type="button"
                  onClick={() =>
                    handleCopyText(
                      readyStudents.map((s) => `${s.name} - ${normalizeWhatsAppNumber(s.whatsapp)}`).join('\n'),
                      'phones'
                    )
                  }
                  className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                >
                  {copiedType === 'phones' ? (
                    <>
                      <Check className="w-3 h-3 text-emerald-600" />
                      <span>Nomor Disalin</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3" />
                      <span>Salin Nomor</span>
                    </>
                  )}
                </button>
              )}

              {sentCount > 0 && (
                <button
                  type="button"
                  onClick={() => setSentIds({})}
                  className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Reset</span>
                </button>
              )}
            </div>
          </div>

          {/* Smart Next Unsent Action */}
          {readyStudents.length > 0 && (
            <div className="p-3 rounded-xl bg-emerald-50/70 border border-emerald-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
              {nextUnsentStudent ? (
                <>
                  <div className="text-xs text-emerald-950 min-w-0">
                    <span className="text-[11px] text-emerald-700 font-semibold block">
                      Antrean Berikutnya ({sentCount + 1} dari {readyStudents.length}):
                    </span>
                    <strong className="truncate block">
                      {nextUnsentStudent.name} ({nextUnsentStudent.whatsapp})
                    </strong>
                  </div>
                  <a
                    href={buildWaMeUrl(
                      nextUnsentStudent.whatsapp,
                      buildPersonalizedForStudent(
                        nextUnsentStudent.name,
                        nextUnsentStudent.classId,
                        nextUnsentStudent.id
                      )
                    )}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => setSentIds((prev) => ({ ...prev, [nextUnsentStudent.id]: true }))}
                    className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-xs transition-colors shrink-0"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Kirim ke Siswa Berikutnya</span>
                  </a>
                </>
              ) : (
                <div className="flex items-center gap-2 text-xs font-semibold text-emerald-800">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Semua {readyStudents.length} siswa dengan nomor WhatsApp sudah dikirimi pesan!</span>
                </div>
              )}
            </div>
          )}

          {/* Recipients List */}
          {targetStudents.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-500">
              Tidak ada siswa pada filter kelas/tugas saat ini.
            </div>
          ) : (
            <div className="divide-y divide-slate-100 max-h-[460px] overflow-y-auto pr-1">
              {targetStudents.map((student, idx) => {
                const validPhone = normalizeWhatsAppNumber(student.whatsapp);
                const isSent = Boolean(sentIds[student.id]);
                const isEditing = editingWaId === student.id;
                const serverItem = serverSummary?.results.find((r) => r.id === student.id);

                return (
                  <div
                    key={student.id}
                    className={`py-2.5 flex items-center justify-between gap-2 text-xs ${
                      isSent ? 'bg-emerald-50/30' : ''
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[11px] font-mono text-slate-400">{idx + 1}.</span>
                        <span className="font-semibold text-slate-900 truncate">{student.name}</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 shrink-0">
                          {getClassName(student.classId)}
                        </span>
                      </div>

                      {isEditing ? (
                        <div className="flex items-center gap-1 mt-1">
                          <input
                            type="text"
                            value={editingWaVal}
                            onChange={(e) => setEditingWaVal(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                handleSaveWaNumber(student.id);
                              } else if (e.key === 'Escape') {
                                setEditingWaId(null);
                              }
                            }}
                            placeholder="081234567890"
                            className="w-36 px-2 py-1 text-xs border border-emerald-400 rounded focus:outline-hidden"
                            autoFocus
                          />
                          <button
                            type="button"
                            onClick={() => handleSaveWaNumber(student.id)}
                            className="px-2 py-1 text-[11px] font-semibold bg-emerald-600 text-white rounded"
                          >
                            Simpan
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span
                            className={`text-[11px] font-mono ${
                              validPhone ? 'text-slate-600' : 'text-amber-600 italic font-sans'
                            }`}
                          >
                            {validPhone ? student.whatsapp : 'Nomor WA belum diisi'}
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingWaId(student.id);
                              setEditingWaVal(student.whatsapp || '');
                            }}
                            className="text-slate-400 hover:text-indigo-600 p-0.5 rounded"
                            title="Isi atau ubah nomor WhatsApp"
                          >
                            <Edit2 className="w-3 h-3" />
                          </button>
                          {serverItem && !serverItem.ok && (
                            <span className="text-[10px] text-rose-600 font-medium">
                              ({serverItem.detail})
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="shrink-0">
                      {validPhone ? (
                        <a
                          href={buildWaMeUrl(
                            student.whatsapp,
                            buildPersonalizedForStudent(
                              student.name,
                              student.classId,
                              student.id
                            )
                          )}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={() => setSentIds((prev) => ({ ...prev, [student.id]: true }))}
                          className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold transition-colors ${
                            isSent
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                              : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                          }`}
                        >
                          {isSent ? (
                            <>
                              <Check className="w-3 h-3" />
                              <span>Terkirim</span>
                            </>
                          ) : (
                            <>
                              <MessageCircle className="w-3 h-3" />
                              <span>Kirim WA</span>
                            </>
                          )}
                        </a>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setEditingWaId(student.id);
                            setEditingWaVal('');
                          }}
                          className="px-2.5 py-1.5 rounded-lg text-[11px] font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
                        >
                          + No. WA
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
