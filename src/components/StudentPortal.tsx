import React, { useState } from 'react';
import { useLMS } from '../context/LMSContext';
import { BookOpen, ClipboardList, Award, ExternalLink, Send, CheckCircle, Clock } from 'lucide-react';
import { FileAttachmentBadge } from './FileAttachmentBadge';

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
    submitTask,
    authSession,
    logout,
  } = useLMS();

  const [activeTab, setActiveTab] = useState<'materi' | 'tugas' | 'rekap'>('materi');

  // Currently selected student
  const student = students.find((s) => s.id === currentStudentId) || students[0];
  const studentClass = classes.find((c) => c.id === student?.classId);

  // Filter materials for this student
  const studentMaterials = materials.filter(
    (m) => m.classId === 'all' || (student && m.classId === student.classId)
  );

  // Filter tasks for this student
  const studentTasks = tasks.filter(
    (t) => t.classId === 'all' || (student && t.classId === student.classId)
  );

  // Task answer submission form state
  const [submittingTaskId, setSubmittingTaskId] = useState<string | null>(null);
  const [workText, setWorkText] = useState('');
  const [linkAttachment, setLinkAttachment] = useState('');

  const handleOpenSubmit = (taskId: string) => {
    setSubmittingTaskId(taskId);
    const existing = submissions.find((s) => s.taskId === taskId && s.studentId === student?.id);
    setWorkText(existing ? existing.workText : '');
    setLinkAttachment(existing?.linkAttachment || '');
  };

  const handleSendSubmission = (e: React.FormEvent) => {
    e.preventDefault();
    if (!submittingTaskId || !student || !workText.trim()) return;

    submitTask(submittingTaskId, student.id, workText.trim(), linkAttachment.trim() || undefined);
    setSubmittingTaskId(null);
    setWorkText('');
    setLinkAttachment('');
  };

  return (
    <div className="space-y-6">
      {/* Student Banner & Switcher */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="text-xs text-indigo-600 font-semibold tracking-wide uppercase">
            Portal Belajar Siswa · {teacher.subject}
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
          <div className="flex items-center gap-2">
            <span className="text-xs text-emerald-800 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-200 font-semibold">
              Masuk sebagai: {student?.name}
            </span>
            <button
              onClick={logout}
              className="text-xs text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-lg transition-colors font-medium"
            >
              Ganti Siswa
            </button>
          </div>
        )}
      </div>

      {/* Navigation tabs for Student */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
        <button
          onClick={() => setActiveTab('materi')}
          className={`inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg transition-colors ${
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
          className={`inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg transition-colors ${
            activeTab === 'tugas'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <ClipboardList className="w-3.5 h-3.5" />
          <span>Tugas & LKPD ({studentTasks.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('rekap')}
          className={`inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg transition-colors ${
            activeTab === 'rekap'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <Award className="w-3.5 h-3.5" />
          <span>Nilai & Kehadiran Saya</span>
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
                  <span className="font-semibold text-indigo-700">Materi Pembelajaran</span>
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
                      <div className="text-xs text-slate-500">
                        Tenggat Waktu: <strong className="text-slate-800">{task.dueDate}</strong>
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
                    <div className="bg-indigo-50/50 p-3.5 rounded-lg border border-indigo-100 space-y-2 text-xs">
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
                        <Send className="w-3.5 h-3.5" />
                        <span>{mySubmission ? 'Ubah Jawaban Saya' : 'Kumpulkan Tugas'}</span>
                      </button>
                    </div>
                  ) : (
                    /* Submission Form */
                    <form onSubmit={handleSendSubmission} className="bg-slate-50 p-4 rounded-lg border border-slate-200 space-y-3">
                      <h4 className="text-xs font-semibold text-slate-800">
                        {mySubmission ? 'Ubah Pengumpulan Tugas' : 'Form Pengumpulan Tugas'}
                      </h4>

                      <div>
                        <label className="block text-xs font-medium text-slate-700 mb-1">
                          Tuliskan Jawaban / Hasil Tugas Anda
                        </label>
                        <textarea
                          required
                          rows={4}
                          value={workText}
                          onChange={(e) => setWorkText(e.target.value)}
                          placeholder="Ketikkan teks jawaban, rangkuman, atau penjelasan tugas di sini..."
                          className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-slate-700 mb-1">
                          Tautan Dokumen / Google Drive / Foto Tugas (Opsional)
                        </label>
                        <input
                          type="url"
                          value={linkAttachment}
                          onChange={(e) => setLinkAttachment(e.target.value)}
                          placeholder="https://drive.google.com/..."
                          className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>

                      <div className="flex items-center gap-2 pt-1">
                        <button
                          type="submit"
                          className="px-4 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-xs transition-colors"
                        >
                          Kirim Sekarang
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
            <h3 className="text-sm font-semibold text-slate-900 flex items-center justify-between">
              <span>Rekap Nilai Tugas</span>
              <span className="text-xs font-normal text-slate-500">{teacher.subject}</span>
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
                    <span className="font-medium text-slate-800 line-clamp-1">{task.title}</span>
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
              {attendance
                .filter((a) => a.classId === student?.classId)
                .map((att) => {
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
                        <div className="text-[11px] text-slate-400">{att.date}</div>
                      </div>
                      <span className={`px-2.5 py-0.5 rounded text-xs font-semibold border ${colorMap[status]}`}>
                        {labelMap[status]}
                      </span>
                    </div>
                  );
                })}
              {attendance.filter((a) => a.classId === student?.classId).length === 0 && (
                <p className="text-xs text-slate-400 py-6 text-center">
                  Belum ada catatan presensi untuk kelas ini.
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
