import React, { useState, useEffect, useRef } from 'react';
import { useLMS } from '../context/LMSContext';
import { BookOpen, ClipboardList, Award, ExternalLink, Send, CheckCircle, Clock, MessageCircle, Check, Edit2, AlertCircle, Cloud, Loader2, UploadCloud } from 'lucide-react';
import { FileAttachmentBadge, readFileAsAttachment } from './FileAttachmentBadge';
import { MaterialAttachment } from '../types/lms';
import { normalizeWhatsAppNumber } from '../utils/whatsapp';
import { parseSubjects, getPrimarySubject } from '../utils/subjects';

export const StudentPortal: React.FC = () => {
  const {
    students,
    classes,
    materials,
    tasks,
    submissions,
    attendance,
    teacher,
    currentStudentId,
    setCurrentStudentId,
    updateStudent,
    submitTask,
    authSession,
    isCloudConnected,
    connectGoogleForStudent,
    cloudAuthError,
    logout,
  } = useLMS();
  const [isConnectingGoogle, setIsConnectingGoogle] = useState(false);

  const [activeTab, setActiveTab] = useState<'materi' | 'tugas' | 'rekap'>('materi');
  const [selectedSubject, setSelectedSubject] = useState<string>('all');

  // Currently selected student
  const student = students.find((s) => s.id === currentStudentId) || students[0];
  const studentClass = classes.find((c) => c.id === student?.classId);

  const teacherSubjects = parseSubjects(teacher.subject);
  const fallbackSubject = getPrimarySubject(teacher.subject);

  // Materials, tasks, and attendance matching the student's class
  const classScopedMaterials = materials.filter(
    (m) => m.classId === 'all' || (student && m.classId === student.classId)
  );
  const classScopedTasks = tasks.filter(
    (t) => t.classId === 'all' || (student && t.classId === student.classId)
  );
  const classScopedAttendance = attendance.filter((a) => a.classId === student?.classId);

  // Build available subjects for student filter
  const studentSubjects: string[] = [];
  const seenSubjectKeys = new Set<string>();
  const registerStudentSubject = (raw?: string) => {
    const val = raw?.trim();
    if (!val) return;
    const key = val.toLowerCase();
    if (!seenSubjectKeys.has(key)) {
      seenSubjectKeys.add(key);
      studentSubjects.push(val);
    }
  };
  teacherSubjects.forEach(registerStudentSubject);
  classScopedMaterials.forEach((m) => registerStudentSubject(m.subject));
  classScopedTasks.forEach((t) => registerStudentSubject(t.subject));
  classScopedAttendance.forEach((a) => registerStudentSubject(a.subject));

  useEffect(() => {
    if (
      selectedSubject !== 'all' &&
      !studentSubjects.some((s) => s.toLowerCase() === selectedSubject.toLowerCase())
    ) {
      setSelectedSubject('all');
    }
  }, [selectedSubject, studentSubjects.join('|')]);

  const matchesSelectedSubject = (itemSubject?: string) => {
    if (selectedSubject === 'all') return true;
    const resolved = itemSubject?.trim() || fallbackSubject;
    return resolved.toLowerCase() === selectedSubject.toLowerCase();
  };

  // Filter materials & tasks for this student + subject filter
  const studentMaterials = classScopedMaterials.filter((m) => matchesSelectedSubject(m.subject));
  const studentTasks = classScopedTasks.filter((t) => matchesSelectedSubject(t.subject));
  const studentAttendance = classScopedAttendance.filter((a) => matchesSelectedSubject(a.subject));

  // Task answer submission form state
  const [submittingTaskId, setSubmittingTaskId] = useState<string | null>(null);
  const [workText, setWorkText] = useState('');
  const [linkAttachment, setLinkAttachment] = useState('');
  const [submissionAttachment, setSubmissionAttachment] = useState<MaterialAttachment | null>(null);
  const [submissionFileError, setSubmissionFileError] = useState('');
  const [submissionFileWarning, setSubmissionFileWarning] = useState('');
  const [submissionFormError, setSubmissionFormError] = useState('');
  const [isReadingFile, setIsReadingFile] = useState(false);
  const submissionFileInputRef = useRef<HTMLInputElement>(null);

  // Student self-service WhatsApp number editing
  const [isEditingWa, setIsEditingWa] = useState(false);
  const [waDraft, setWaDraft] = useState(student?.whatsapp || '');
  const [waError, setWaError] = useState('');
  const [waSavedBanner, setWaSavedBanner] = useState(false);

  useEffect(() => {
    setWaDraft(student?.whatsapp || '');
    setIsEditingWa(false);
    setWaError('');
  }, [student?.id, student?.whatsapp]);

  const handleSaveMyWa = (e: React.FormEvent) => {
    e.preventDefault();
    if (!student) return;
    const trimmed = waDraft.trim();
    if (!trimmed || !normalizeWhatsAppNumber(trimmed)) {
      setWaError('Masukkan nomor WhatsApp yang valid, contoh: 081234567890');
      return;
    }
    updateStudent(student.id, { whatsapp: trimmed });
    setIsEditingWa(false);
    setWaError('');
    setWaSavedBanner(true);
    setTimeout(() => setWaSavedBanner(false), 3000);
  };

  const handleOpenSubmit = (taskId: string) => {
    setSubmittingTaskId(taskId);
    const existing = submissions.find((s) => s.taskId === taskId && s.studentId === student?.id);
    setWorkText(existing ? existing.workText : '');
    setLinkAttachment(existing?.linkAttachment || '');
    setSubmissionAttachment(existing?.attachment || null);
    setSubmissionFileError('');
    setSubmissionFileWarning('');
    setSubmissionFormError('');
  };

  const handleSubmissionFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSubmissionFileError('');
    setSubmissionFileWarning('');
    setSubmissionFormError('');

    const MAX_SIZE = 5 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      setSubmissionFileError('Ukuran berkas maksimal 5 MB.');
      if (submissionFileInputRef.current) submissionFileInputRef.current.value = '';
      return;
    }

    setIsReadingFile(true);
    try {
      const att = await readFileAsAttachment(file);
      setSubmissionAttachment(att);
      if (att.dataUrl.length > 740000) {
        setSubmissionFileWarning(
          'Ukuran dokumen melebihi ~500 KB: berkas tersimpan di perangkat ini. Untuk sinkronisasi Cloud otomatis ke guru, gunakan foto, dokumen ≤ 500 KB, atau tautan Google Drive.'
        );
      }
    } catch (err) {
      setSubmissionFileError(
        err instanceof Error ? err.message : 'Gagal memproses berkas tugas. Silakan coba lagi.'
      );
    } finally {
      setIsReadingFile(false);
    }
  };

  const handleRemoveSubmissionAttachment = () => {
    setSubmissionAttachment(null);
    setSubmissionFileError('');
    setSubmissionFileWarning('');
    if (submissionFileInputRef.current) submissionFileInputRef.current.value = '';
  };

  const handleSendSubmission = (e: React.FormEvent) => {
    e.preventDefault();
    if (!submittingTaskId || !student) return;
    if (!workText.trim() && !submissionAttachment && !linkAttachment.trim()) {
      setSubmissionFormError('Tuliskan jawaban, upload file tugas, atau sertakan tautan sebelum mengirim.');
      return;
    }

    submitTask(
      submittingTaskId,
      student.id,
      workText.trim(),
      linkAttachment.trim() || undefined,
      submissionAttachment
    );
    setSubmittingTaskId(null);
    setWorkText('');
    setLinkAttachment('');
    setSubmissionAttachment(null);
    setSubmissionFileError('');
    setSubmissionFileWarning('');
    setSubmissionFormError('');
  };

  return (
    <div className="space-y-6">
      {authSession?.role === 'student' && !isCloudConnected && (
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2 text-xs text-slate-700">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <div className="flex items-start gap-2">
              <Cloud className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <span>
                <strong>Mode Tanpa Google Aktif:</strong> Anda masuk langsung tanpa akun Google. Hubungkan Google (opsional) kapan saja bila ingin menyinkronkan tugas &amp; nilai ke Cloud Guru.
              </span>
            </div>
            <button
              type="button"
              disabled={isConnectingGoogle}
              onClick={async () => {
                setIsConnectingGoogle(true);
                try {
                  await connectGoogleForStudent();
                } finally {
                  setIsConnectingGoogle(false);
                }
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 disabled:opacity-60 rounded-lg transition-colors shrink-0 self-start sm:self-auto"
            >
              {isConnectingGoogle ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Menghubungkan...</span>
                </>
              ) : (
                <>
                  <Cloud className="w-3.5 h-3.5" />
                  <span>Hubungkan Google (Opsional)</span>
                </>
              )}
            </button>
          </div>
          {cloudAuthError && (
            <p className="text-[11px] text-rose-600 flex items-center gap-1">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span>{cloudAuthError}</span>
            </p>
          )}
        </div>
      )}

      {/* Student Banner & Switcher */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="text-xs text-indigo-600 font-semibold tracking-wide uppercase">
            Portal Belajar Siswa · {teacherSubjects.length > 0 ? teacherSubjects.join(' · ') : teacher.subject}
          </div>
          <h2 className="text-lg font-bold text-slate-900">
            Halo, {student ? student.name : 'Siswa'}!
          </h2>
          <p className="text-xs text-slate-500">
            {studentClass?.name || 'Kelas'} · Guru Pengampu: {teacher.name}
          </p>
        </div>

        {/* Student Switcher / Account Status */}
        {authSession?.role === 'teacher' ? (
          <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200 shrink-0">
            <label className="block text-[11px] font-medium text-slate-500 mb-1">
              Ganti Profil Siswa (Simulasi Guru):
            </label>
            <select
              value={currentStudentId}
              onChange={(e) => {
                setCurrentStudentId(e.target.value);
                setSubmittingTaskId(null);
              }}
              className="text-xs font-medium px-2.5 py-1.5 border border-slate-300 rounded-md bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
            >
              {students.map((s) => {
                const cls = classes.find((c) => c.id === s.classId);
                return (
                  <option key={s.id} value={s.id}>
                    {s.name} ({cls?.name || 'Kelas'})
                  </option>
                );
              })}
            </select>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-emerald-800 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-200 font-semibold truncate max-w-[200px]">
              Masuk sebagai: {student?.name}
            </span>
            <button
              onClick={logout}
              className="text-xs text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-lg transition-colors font-medium shrink-0"
            >
              Ganti Siswa
            </button>
          </div>
        )}
      </div>

      {/* Student WhatsApp Self-Service Card */}
      {student && (
        <div
          className={`rounded-xl border p-4 transition-colors ${
            normalizeWhatsAppNumber(student.whatsapp)
              ? 'bg-white border-slate-200'
              : 'bg-emerald-50/70 border-emerald-200'
          }`}
        >
          {!normalizeWhatsAppNumber(student.whatsapp) || isEditingWa ? (
            <form onSubmit={handleSaveMyWa} className="space-y-2.5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-start gap-2">
                  <MessageCircle className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <div>
                    <h3 className="text-xs font-bold text-slate-900">
                      {normalizeWhatsAppNumber(student.whatsapp)
                        ? 'Perbarui Nomor WhatsApp Anda'
                        : 'Isi Nomor WhatsApp Anda Sekarang'}
                    </h3>
                    <p className="text-[11px] text-slate-600">
                      Nomor ini otomatis tersimpan di daftar guru untuk menerima info materi, tugas, dan pengingat lewat WhatsApp.
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="tel"
                  value={waDraft}
                  onChange={(e) => {
                    setWaDraft(e.target.value);
                    setWaError('');
                  }}
                  placeholder="Contoh: 081234567890"
                  className="flex-1 min-w-[200px] text-xs font-mono px-3 py-2 border border-slate-300 rounded-lg bg-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                />
                <button
                  type="submit"
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-xs transition-colors"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Simpan No. WhatsApp</span>
                </button>
                {isEditingWa && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsEditingWa(false);
                      setWaDraft(student.whatsapp || '');
                      setWaError('');
                    }}
                    className="px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg"
                  >
                    Batal
                  </button>
                )}
              </div>

              {waError && (
                <p className="text-[11px] text-rose-600 flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  <span>{waError}</span>
                </p>
              )}
            </form>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2">
                <MessageCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                <span className="text-slate-600">Nomor WhatsApp Terdaftar:</span>
                <span className="font-mono font-semibold text-emerald-800 bg-emerald-50 px-2.5 py-0.5 rounded-md border border-emerald-200">
                  {student.whatsapp}
                </span>
                {waSavedBanner && (
                  <span className="text-[11px] font-semibold text-emerald-700 flex items-center gap-1">
                    <CheckCircle className="w-3.5 h-3.5" /> Tersimpan otomatis ke data guru!
                  </span>
                )}
              </div>

              <button
                type="button"
                onClick={() => setIsEditingWa(true)}
                className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium text-slate-600 hover:text-indigo-700 bg-slate-100 hover:bg-indigo-50 rounded-lg transition-colors"
              >
                <Edit2 className="w-3 h-3" />
                <span>Ubah No. WA</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* Subject Filter Strip when more than 1 subject exists */}
      {studentSubjects.length > 1 && (
        <div className="flex flex-wrap items-center gap-1.5 bg-white rounded-xl border border-slate-200 px-3.5 py-2.5">
          <span className="text-[11px] font-semibold text-slate-500 mr-1">Mata Pelajaran:</span>
          <button
            type="button"
            onClick={() => setSelectedSubject('all')}
            className={`px-2.5 py-1 text-xs font-medium rounded-lg border transition-colors ${
              selectedSubject === 'all'
                ? 'bg-indigo-600 text-white border-indigo-600'
                : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
            }`}
          >
            Semua Mapel
          </button>
          {studentSubjects.map((subj) => {
            const active = selectedSubject.toLowerCase() === subj.toLowerCase();
            return (
              <button
                key={subj}
                type="button"
                onClick={() => setSelectedSubject(subj)}
                className={`px-2.5 py-1 text-xs font-medium rounded-lg border transition-colors ${
                  active
                    ? 'bg-indigo-600 text-white border-indigo-600'
                    : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                }`}
              >
                {subj}
              </button>
            );
          })}
        </div>
      )}

      {/* Navigation tabs for Student */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2 overflow-x-auto no-scrollbar">
        <button
          onClick={() => setActiveTab('materi')}
          className={`inline-flex items-center gap-1.5 px-3.5 sm:px-4 py-2 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 ${
            activeTab === 'materi'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <BookOpen className="w-3.5 h-3.5" />
          <span>Bahan Ajar ({studentMaterials.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('tugas')}
          className={`inline-flex items-center gap-1.5 px-3.5 sm:px-4 py-2 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 ${
            activeTab === 'tugas'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <ClipboardList className="w-3.5 h-3.5" />
          <span>Tugas &amp; LKPD ({studentTasks.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('rekap')}
          className={`inline-flex items-center gap-1.5 px-3.5 sm:px-4 py-2 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 ${
            activeTab === 'rekap'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <Award className="w-3.5 h-3.5" />
          <span>Nilai &amp; Kehadiran ({studentTasks.length})</span>
        </button>
      </div>

      {/* TAB 1: Bahan Ajar Siswa */}
      {activeTab === 'materi' && (
        <div className="space-y-4">
          {studentMaterials.length === 0 ? (
            <div className="bg-white rounded-xl border border-slate-200 p-12 text-center text-slate-500 text-xs">
              Belum ada materi pembelajaran yang dibagikan guru.
            </div>
          ) : (
            studentMaterials.map((mat) => (
              <div
                key={mat.id}
                className="bg-white rounded-xl border border-slate-200 p-5 space-y-3 shadow-xs"
              >
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-indigo-700">Materi Pembelajaran</span>
                    <span className="text-[11px] font-medium text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded">
                      {mat.subject?.trim() || fallbackSubject}
                    </span>
                  </div>
                  <span>{mat.date}</span>
                </div>
                <h3 className="text-base font-bold text-slate-900">{mat.title}</h3>
                {mat.content && (
                  <div className="text-sm text-slate-700 leading-relaxed bg-slate-50 p-4 rounded-lg border border-slate-100 whitespace-pre-wrap">
                    {mat.content}
                  </div>
                )}
                {mat.attachment && (
                  <div className="pt-1">
                    <FileAttachmentBadge attachment={mat.attachment} showDownload={true} />
                  </div>
                )}
                {mat.linkUrl && (
                  <div className="pt-1">
                    <a
                      href={mat.linkUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-600 hover:underline"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>Buka Referensi Pembelajaran / Video</span>
                    </a>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* TAB 2: Tugas Siswa */}
      {activeTab === 'tugas' && (
        <div className="space-y-4">
          {studentTasks.length === 0 ? (
            <div className="bg-white rounded-xl border border-slate-200 p-12 text-center text-slate-500 text-xs">
              Belum ada tugas untuk kelas Anda.
            </div>
          ) : (
            studentTasks.map((task) => {
              const mySubmission = submissions.find(
                (s) => s.taskId === task.id && s.studentId === student?.id
              );
              const isGraded = mySubmission && mySubmission.score !== undefined;
              const isSubmitting = submittingTaskId === task.id;

              return (
                <div
                  key={task.id}
                  className="bg-white rounded-xl border border-slate-200 p-5 space-y-4 shadow-xs"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                        <span>
                          Tenggat Waktu: <strong className="text-slate-800">{task.dueDate}</strong>
                        </span>
                        <span className="text-[11px] font-medium text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded">
                          {task.subject?.trim() || fallbackSubject}
                        </span>
                      </div>
                      <h3 className="text-base font-bold text-slate-900 mt-0.5">{task.title}</h3>
                    </div>

                    <div>
                      {mySubmission ? (
                        isGraded ? (
                          <div className="inline-flex items-center gap-1.5 text-xs text-emerald-800 bg-emerald-50 px-3 py-1 rounded-md border border-emerald-200">
                            <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                            <span>Sudah Dinilai:</span>
                            <strong className="font-mono text-sm">{mySubmission.score}</strong>
                          </div>
                        ) : (
                          <div className="inline-flex items-center gap-1.5 text-xs text-indigo-700 bg-indigo-50 px-3 py-1 rounded-md border border-indigo-200">
                            <Clock className="w-3.5 h-3.5" />
                            <span>Terkumpul (Menunggu Penilaian)</span>
                          </div>
                        )
                      ) : (
                        <span className="text-xs font-medium text-rose-600 bg-rose-50 px-2.5 py-1 rounded-md border border-rose-200">
                          Belum Dikumpulkan
                        </span>
                      )}
                    </div>
                  </div>

                  {task.instructions && (
                    <div>
                      <span className="text-xs font-semibold text-slate-700 block mb-1">
                        Petunjuk Tugas:
                      </span>
                      <p className="text-xs text-slate-600 bg-slate-50 p-3 rounded-lg border border-slate-100 whitespace-pre-wrap">
                        {task.instructions}
                      </p>
                    </div>
                  )}

                  {task.attachment && (
                    <div className="space-y-1.5 pt-1">
                      <span className="text-xs font-semibold text-slate-800 flex items-center gap-1.5">
                        <span>Berkas Lembar Soal / LKPD untuk Dikerjakan:</span>
                      </span>
                      <FileAttachmentBadge attachment={task.attachment} showDownload={true} />
                    </div>
                  )}

                  {/* Submission detail if exists */}
                  {mySubmission && !isSubmitting && (
                    <div className="bg-indigo-50/50 p-3.5 rounded-lg border border-indigo-100 space-y-2.5 text-xs">
                      <div className="flex items-center justify-between text-slate-500">
                        <span>Pekerjaan Anda dikirim pada:</span>
                        <span className="font-mono">{mySubmission.submittedAt}</span>
                      </div>
                      <div>
                        <span className="font-medium text-slate-800 block mb-0.5">Jawaban Anda:</span>
                        <p className="bg-white p-2.5 rounded border border-indigo-100 text-slate-800 whitespace-pre-wrap">
                          {mySubmission.workText}
                        </p>
                      </div>
                      {mySubmission.attachment && (
                        <div className="space-y-1">
                          <span className="font-medium text-slate-800 block">
                            Berkas Tugas yang Anda Upload:
                          </span>
                          <FileAttachmentBadge attachment={mySubmission.attachment} showDownload={true} />
                        </div>
                      )}
                      {mySubmission.linkAttachment && (
                        <div>
                          <a
                            href={mySubmission.linkAttachment}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-indigo-600 hover:underline"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                            <span>Lampiran Tautan yang Anda sertakan</span>
                          </a>
                        </div>
                      )}
                      {mySubmission.note && (
                        <div className="pt-1 text-indigo-900 bg-white p-2 rounded border border-indigo-200 font-medium">
                          Catatan dari Guru: "{mySubmission.note}"
                        </div>
                      )}
                    </div>
                  )}

                  {/* Submit / Edit button */}
                  {!isSubmitting ? (
                    <div>
                      <button
                        onClick={() => handleOpenSubmit(task.id)}
                        className="inline-flex items-center gap-1.5 text-xs font-semibold px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg shadow-xs transition-colors"
                      >
                        <UploadCloud className="w-3.5 h-3.5" />
                        <span>{mySubmission ? 'Ubah Jawaban / Upload Ulang' : 'Upload & Kumpulkan Tugas'}</span>
                      </button>
                    </div>
                  ) : (
                    /* Submission Form */
                    <form onSubmit={handleSendSubmission} className="bg-slate-50 p-4 rounded-lg border border-slate-200 space-y-3.5">
                      <h4 className="text-xs font-semibold text-slate-800">
                        {mySubmission ? 'Ubah Pengumpulan & Upload Tugas' : 'Form Upload & Pengumpulan Tugas'}
                      </h4>

                      {/* Upload Berkas Tugas (Foto / PDF / Word / Excel) */}
                      <div className="space-y-1.5">
                        <label className="block text-xs font-medium text-slate-700">
                          Upload File Tugas (Foto Jawaban, PDF, Word, atau Excel)
                        </label>

                        {!submissionAttachment ? (
                          <div
                            onClick={() => submissionFileInputRef.current?.click()}
                            className="border-2 border-dashed border-slate-300 hover:border-indigo-400 hover:bg-indigo-50/40 rounded-xl p-4 text-center cursor-pointer transition-all bg-white"
                          >
                            <input
                              ref={submissionFileInputRef}
                              type="file"
                              accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.webp"
                              onChange={handleSubmissionFileChange}
                              className="hidden"
                            />
                            <div className="w-9 h-9 bg-indigo-50 text-indigo-600 rounded-lg flex items-center justify-center mx-auto mb-1.5">
                              {isReadingFile ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <UploadCloud className="w-4 h-4" />
                              )}
                            </div>
                            <div className="text-xs font-semibold text-slate-800">
                              {isReadingFile ? 'Sedang memproses file...' : 'Klik untuk Pilih / Upload Berkas Tugas'}
                            </div>
                            <p className="text-[11px] text-slate-500 mt-0.5">
                              Mendukung <strong>Foto (.jpg/.png)</strong>, <strong>PDF</strong>, <strong>Word</strong>, &amp; <strong>Excel</strong> (Foto otomatis dikompres agar cepat terkirim)
                            </p>
                          </div>
                        ) : (
                          <div className="space-y-1">
                            <FileAttachmentBadge
                              attachment={submissionAttachment}
                              onRemove={handleRemoveSubmissionAttachment}
                              showDownload={true}
                            />
                            <p className="text-[11px] text-emerald-700 font-medium">
                              Berkas siap dikirim bersama pengumpulan tugas.
                            </p>
                          </div>
                        )}

                        {submissionFileError && (
                          <p className="text-[11px] text-rose-600 flex items-center gap-1 bg-rose-50 p-2 rounded-lg border border-rose-200">
                            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                            <span>{submissionFileError}</span>
                          </p>
                        )}
                        {submissionFileWarning && (
                          <p className="text-[11px] text-amber-800 flex items-start gap-1.5 bg-amber-50 p-2 rounded-lg border border-amber-200">
                            <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                            <span>{submissionFileWarning}</span>
                          </p>
                        )}
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-slate-700 mb-1">
                          Jawaban Teks / Catatan untuk Guru{' '}
                          <span className="text-slate-400 font-normal">
                            ({submissionAttachment || linkAttachment.trim() ? 'Opsional jika sudah upload file/link' : 'Wajib jika tanpa upload file'})
                          </span>
                        </label>
                        <textarea
                          rows={3}
                          value={workText}
                          onChange={(e) => {
                            setWorkText(e.target.value);
                            setSubmissionFormError('');
                          }}
                          placeholder="Ketikkan teks jawaban, ringkasan, atau catatan pengerjaan di sini..."
                          className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-slate-700 mb-1">
                          Tautan Dokumen / Google Drive (Opsional)
                        </label>
                        <input
                          type="url"
                          value={linkAttachment}
                          onChange={(e) => {
                            setLinkAttachment(e.target.value);
                            setSubmissionFormError('');
                          }}
                          placeholder="https://drive.google.com/..."
                          className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>

                      {submissionFormError && (
                        <p className="text-[11px] text-rose-600 flex items-center gap-1 bg-rose-50 p-2 rounded-lg border border-rose-200">
                          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                          <span>{submissionFormError}</span>
                        </p>
                      )}

                      <div className="flex items-center gap-2 pt-1">
                        <button
                          type="submit"
                          disabled={isReadingFile}
                          className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 rounded-lg shadow-xs transition-colors"
                        >
                          <Send className="w-3.5 h-3.5" />
                          <span>{submissionAttachment ? 'Upload & Kirim Tugas' : 'Kirim Sekarang'}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setSubmittingTaskId(null)}
                          className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-200 rounded-lg transition-colors"
                        >
                          Batal
                        </button>
                      </div>
                    </form>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* TAB 3: Nilai & Kehadiran Saya */}
      {activeTab === 'rekap' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Card 1: Nilai Tugas */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4 shadow-xs">
            <h3 className="text-sm font-semibold text-slate-900 flex items-center justify-between gap-2">
              <span>Rekap Nilai Tugas</span>
              <span className="text-xs font-normal text-slate-500 text-right">
                {selectedSubject === 'all'
                  ? (teacherSubjects.join(' · ') || teacher.subject)
                  : selectedSubject}
              </span>
            </h3>

            <div className="space-y-2">
              {studentTasks.map((task) => {
                const sub = submissions.find(
                  (s) => s.taskId === task.id && s.studentId === student?.id
                );
                return (
                  <div
                    key={task.id}
                    className="flex items-center justify-between p-3 rounded-lg border border-slate-100 bg-slate-50 text-xs"
                  >
                    <div className="min-w-0 pr-2">
                      <span className="font-medium text-slate-800 line-clamp-1 block">{task.title}</span>
                      {task.subject && (
                        <span className="text-[10px] text-indigo-600 font-medium">{task.subject}</span>
                      )}
                    </div>
                    <span className="font-mono font-bold text-slate-900 shrink-0 ml-2">
                      {sub?.score !== undefined ? (
                        <span className={sub.score >= 75 ? 'text-emerald-700' : 'text-rose-600'}>
                          {sub.score}
                        </span>
                      ) : sub ? (
                        <span className="text-amber-600 font-normal">Belum Dinilai</span>
                      ) : (
                        <span className="text-slate-400 font-normal">Belum Kumpul</span>
                      )}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Card 2: Kehadiran / Presensi */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4 shadow-xs">
            <h3 className="text-sm font-semibold text-slate-900 flex items-center justify-between">
              <span>Riwayat Presensi Pertemuan</span>
              <span className="text-xs font-normal text-slate-500">{studentClass?.name}</span>
            </h3>

            <div className="space-y-2">
              {studentAttendance.map((att) => {
                const status = student ? att.records[student.id] || 'H' : 'H';
                const labelMap = { H: 'Hadir', S: 'Sakit', I: 'Izin', A: 'Alpa' };
                const colorMap = {
                  H: 'text-emerald-700 bg-emerald-50 border-emerald-200',
                  S: 'text-amber-700 bg-amber-50 border-amber-200',
                  I: 'text-blue-700 bg-blue-50 border-blue-200',
                  A: 'text-rose-700 bg-rose-50 border-rose-200',
                };

                return (
                  <div
                    key={att.id}
                    className="flex items-center justify-between p-3 rounded-lg border border-slate-100 bg-slate-50 text-xs"
                  >
                    <div>
                      <div className="font-medium text-slate-800">{att.topic}</div>
                      <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
                        <span>{att.date}</span>
                        {att.subject && (
                          <>
                            <span>·</span>
                            <span className="text-indigo-600 font-medium">{att.subject}</span>
                          </>
                        )}
                      </div>
                    </div>
                    <span className={`px-2.5 py-0.5 rounded text-xs font-semibold border ${colorMap[status]}`}>
                      {labelMap[status]}
                    </span>
                  </div>
                );
              })}
              {studentAttendance.length === 0 && (
                <p className="text-xs text-slate-400 py-6 text-center">
                  Belum ada catatan presensi untuk kelas/mapel ini.
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
