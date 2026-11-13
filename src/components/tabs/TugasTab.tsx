import React, { useState } from 'react';
import { useLMS } from '../../context/LMSContext';
import { AddTaskModal } from '../modals/AddTaskModal';
import { GradeModal } from '../modals/GradeModal';
import { FileAttachmentBadge } from '../FileAttachmentBadge';
import { Submission, WhatsAppPrefill } from '../../types/lms';
import { Plus, ClipboardList, ChevronDown, ChevronUp, CheckCircle, Clock, Trash2, Edit3, MessageCircle, Bell, Paperclip, ExternalLink } from 'lucide-react';
import { getPrimarySubject } from '../../utils/subjects';

interface TugasTabProps {
  onShareToWhatsApp?: (prefill: WhatsAppPrefill) => void;
}

export const TugasTab: React.FC<TugasTabProps> = ({ onShareToWhatsApp }) => {
  const { tasks, deleteTask, submissions, activeClassId, activeSubject, classes, students, teacher } = useLMS();

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedSubmission, setSelectedSubmission] = useState<Submission | null>(null);
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const fallbackSubject = getPrimarySubject(teacher.subject);
  const activeClassObj = activeClassId !== 'all' ? classes.find((c) => c.id === activeClassId) : undefined;
  const activeClassSubject = activeClassObj?.subject?.trim();

  // Filter tasks based on active class (and its separated subject) and active subject
  const filteredTasks = tasks.filter((t) => {
    const isDirectClass = activeClassId === 'all' || t.classId === activeClassId;
    const isAllClass = t.classId === 'all';
    if (!isDirectClass && !isAllClass) return false;
    const itemSubject = t.subject?.trim() || fallbackSubject;
    if (activeSubject !== 'all') {
      return itemSubject.toLowerCase() === activeSubject.toLowerCase();
    }
    if (isAllClass && activeClassSubject && t.subject?.trim()) {
      return t.subject.trim().toLowerCase() === activeClassSubject.toLowerCase();
    }
    return true;
  });

  const getClassName = (classId: string) => {
    if (classId === 'all') return 'Semua Kelas';
    const found = classes.find((c) => c.id === classId);
    return found ? found.name : 'Kelas';
  };

  // Get eligible students for a task
  const getEligibleStudents = (taskClassId: string) => {
    if (taskClassId === 'all') {
      return activeClassId === 'all'
        ? students
        : students.filter((s) => s.classId === activeClassId);
    }
    return students.filter((s) => s.classId === taskClassId);
  };

  return (
    <div className="space-y-4">
      {/* Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">Penugasan & LKPD</h2>
          <p className="text-xs text-slate-500">
            Kelola tugas kelas, periksa hasil pekerjaan siswa, dan beri nilai langsung
          </p>
        </div>
        <button
          onClick={() => setIsAddModalOpen(true)}
          className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-xs transition-colors shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Buat Tugas Baru</span>
        </button>
      </div>

      {/* Tasks List */}
      {filteredTasks.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
          <ClipboardList className="w-8 h-8 text-slate-300 mx-auto mb-2" />
          <h3 className="text-sm font-semibold text-slate-800">Belum ada tugas</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            Klik tombol "Buat Tugas Baru" untuk menerbitkan LKPD atau pekerjaan rumah untuk siswa.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredTasks.map((task) => {
            const taskSubmissions = submissions.filter((s) => s.taskId === task.id);
            const eligibleStudents = getEligibleStudents(task.classId);
            const submittedStudentIds = new Set(taskSubmissions.map((s) => s.studentId));
            const gradedCount = taskSubmissions.filter((s) => s.score !== undefined).length;
            const isExpanded = expandedTaskId === task.id;

            return (
              <div
                key={task.id}
                className="bg-white rounded-xl border border-slate-200 overflow-hidden hover:border-slate-300 transition-all"
              >
                {/* Header Card */}
                <div className="p-5 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
                        <span className="font-medium text-indigo-700">{getClassName(task.classId)}</span>
                        <span className="font-medium text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                          {task.subject || fallbackSubject}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span>Tenggat: {task.dueDate}</span>
                      </div>
                      <h3 className="text-base font-semibold text-slate-900">{task.title}</h3>
                    </div>

                    <div className="flex items-center gap-1.5 flex-wrap justify-end">
                      {onShareToWhatsApp && (
                        <>
                          <button
                            type="button"
                            onClick={() =>
                              onShareToWhatsApp({
                                classId: task.classId,
                                message: `Halo {nama} ({kelas}),\n\nAda tugas baru mata pelajaran *${task.subject || fallbackSubject}*:\n*${task.title}*\nTenggat: *${task.dueDate}*\n\n${task.instructions}\n\nSilakan kerjakan dan kumpulkan di GuruMapel LMS.\nSalam,\n${teacher.name}`,
                              })
                            }
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-md transition-colors"
                            title="Bagikan info tugas ke WhatsApp"
                          >
                            <MessageCircle className="w-3.5 h-3.5" />
                            <span>Info WA</span>
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              onShareToWhatsApp({
                                classId: task.classId,
                                onlyUnsubmittedTaskId: task.id,
                                message: `Halo {nama} ({kelas}),\n\nPengingat tugas *${task.subject || fallbackSubject}*:\n*${task.title}*\nBatas pengumpulan: *${task.dueDate}*\n\nTercatat Anda belum mengumpulkan tugas ini di GuruMapel LMS. Mohon segera dikumpulkan ya.\nTerima kasih,\n${teacher.name}`,
                              })
                            }
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-md transition-colors"
                            title="Ingatkan via WhatsApp siswa yang belum mengumpulkan"
                          >
                            <Bell className="w-3.5 h-3.5" />
                            <span>Ingatkan WA</span>
                          </button>
                        </>
                      )}
                      {confirmDeleteId === task.id ? (
                        <div className="inline-flex items-center gap-1 bg-rose-50 border border-rose-200 px-2 py-1 rounded-md">
                          <button
                            type="button"
                            onClick={() => {
                              deleteTask(task.id);
                              setConfirmDeleteId(null);
                            }}
                            className="text-[11px] font-semibold text-white bg-rose-600 hover:bg-rose-700 px-2 py-0.5 rounded"
                          >
                            Hapus
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(null)}
                            className="text-[11px] text-slate-600 hover:text-slate-800 px-1.5 py-0.5"
                          >
                            Batal
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(task.id)}
                          className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors"
                          title="Hapus Tugas"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>

                  {task.instructions && (
                    <p className="text-xs text-slate-600 bg-slate-50 p-3 rounded-lg border border-slate-100 whitespace-pre-wrap">
                      {task.instructions}
                    </p>
                  )}

                  {task.attachment && (
                    <div className="space-y-1">
                      <span className="text-[11px] font-semibold text-slate-700 block">
                        Berkas Lembar Soal / LKPD Terlampir:
                      </span>
                      <FileAttachmentBadge attachment={task.attachment} showDownload={true} />
                    </div>
                  )}

                  {/* Submission Statistics & Toggle */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100">
                    <div className="flex items-center gap-4 text-xs">
                      <span className="text-slate-600 font-medium">
                        Pengumpulan:{' '}
                        <strong className="text-slate-900 font-mono">
                          {taskSubmissions.length}
                        </strong>{' '}
                        / {eligibleStudents.length} siswa
                      </span>
                      <span className="text-slate-500">
                        Dinilai:{' '}
                        <strong className="text-emerald-700 font-mono">
                          {gradedCount}
                        </strong>
                      </span>
                    </div>

                    <button
                      onClick={() => setExpandedTaskId(isExpanded ? null : task.id)}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-800 py-1 px-2 rounded-md hover:bg-indigo-50 transition-colors"
                    >
                      <span>{isExpanded ? 'Tutup Daftar Pengumpulan' : 'Periksa Hasil Tugas Siswa'}</span>
                      {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                {/* Submissions Section (Expanded) */}
                {isExpanded && (
                  <div className="bg-slate-50 p-5 border-t border-slate-200 space-y-4">
                    <h4 className="text-xs font-semibold text-slate-800 uppercase tracking-wider">
                      Daftar Pekerjaan Siswa ({taskSubmissions.length} Terkumpul)
                    </h4>

                    {taskSubmissions.length === 0 ? (
                      <p className="text-xs text-slate-500 italic bg-white p-4 rounded-lg border border-slate-200 text-center">
                        Belum ada siswa yang mengumpulkan tugas ini.
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {taskSubmissions.map((sub) => {
                          const isGraded = sub.score !== undefined;
                          return (
                            <div
                              key={sub.id}
                              className="bg-white p-3.5 rounded-lg border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                            >
                              <div className="space-y-1 flex-1">
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-semibold text-slate-900">
                                    {sub.studentName}
                                  </span>
                                  <span className="text-xs text-slate-400 font-mono">
                                    {sub.submittedAt}
                                  </span>
                                </div>
                                <p className="text-xs text-slate-600 line-clamp-1 italic">
                                  "{sub.workText}"
                                </p>
                                {(sub.attachment || sub.linkAttachment) && (
                                  <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                                    {sub.attachment && (
                                      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded">
                                        <Paperclip className="w-3 h-3" />
                                        <span className="truncate max-w-[180px]">{sub.attachment.name}</span>
                                        <span className="text-indigo-500">({sub.attachment.size})</span>
                                      </span>
                                    )}
                                    {sub.linkAttachment && (
                                      <a
                                        href={sub.linkAttachment}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="inline-flex items-center gap-1 text-[11px] font-medium text-sky-700 bg-sky-50 border border-sky-200 px-2 py-0.5 rounded hover:bg-sky-100"
                                      >
                                        <ExternalLink className="w-3 h-3" />
                                        <span>Tautan</span>
                                      </a>
                                    )}
                                  </div>
                                )}
                                {sub.note && (
                                  <p className="text-xs text-indigo-600">
                                    Catatan guru: {sub.note}
                                  </p>
                                )}
                              </div>

                              <div className="flex items-center gap-3 shrink-0">
                                {isGraded ? (
                                  <div className="flex items-center gap-1.5 text-xs text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-200">
                                    <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                                    <span>Nilai:</span>
                                    <strong className="font-mono text-sm">{sub.score}</strong>
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-1 text-xs text-amber-700 bg-amber-50 px-2.5 py-1 rounded-md border border-amber-200">
                                    <Clock className="w-3.5 h-3.5" />
                                    <span>Belum Dinilai</span>
                                  </div>
                                )}

                                <button
                                  onClick={() => setSelectedSubmission(sub)}
                                  className="inline-flex items-center gap-1 text-xs font-semibold px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg transition-colors"
                                >
                                  <Edit3 className="w-3 h-3" />
                                  <span>{isGraded ? 'Ubah Nilai' : 'Beri Nilai'}</span>
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Students who haven't submitted yet */}
                    {eligibleStudents.length > taskSubmissions.length && (
                      <div className="pt-2">
                        <span className="text-xs text-slate-500 font-medium block mb-1.5">
                          Siswa yang Belum Mengumpulkan ({eligibleStudents.length - taskSubmissions.length} orang):
                        </span>
                        <div className="flex flex-wrap gap-1.5">
                          {eligibleStudents
                            .filter((s) => !submittedStudentIds.has(s.id))
                            .map((s) => (
                              <span
                                key={s.id}
                                className="text-xs bg-white text-slate-600 px-2 py-0.5 rounded border border-slate-200"
                              >
                                {s.name}
                              </span>
                            ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <AddTaskModal isOpen={isAddModalOpen} onClose={() => setIsAddModalOpen(false)} />
      <GradeModal submission={selectedSubmission} onClose={() => setSelectedSubmission(null)} />
    </div>
  );
};
