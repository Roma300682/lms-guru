import React, { useState } from 'react';
import { useLMS } from '../../context/LMSContext';
import { AttendanceModal } from '../modals/AttendanceModal';
import { Download, Printer, UserCheck, Calendar, Trash2, CheckCircle, AlertCircle, Plus } from 'lucide-react';

export const RekapTab: React.FC = () => {
  const { students, tasks, submissions, attendance, deleteAttendance, activeClassId, classes, teacher } = useLMS();

  const [subTab, setSubTab] = useState<'nilai' | 'presensi'>('nilai');
  const [isAttendanceModalOpen, setIsAttendanceModalOpen] = useState(false);

  // Selected class
  const currentClass = classes.find((c) => c.id === activeClassId) || classes[0];
  const targetClassId = activeClassId === 'all' ? classes[0]?.id || 'c1' : activeClassId;
  const targetClassName = activeClassId === 'all' ? currentClass?.name || 'Kelas' : currentClass?.name;

  // Filter students
  const classStudents = students.filter((s) => s.classId === targetClassId);

  // Filter tasks for this class
  const classTasks = tasks.filter((t) => t.classId === 'all' || t.classId === targetClassId);

  // Filter attendance for this class
  const classAttendance = attendance.filter((a) => a.classId === targetClassId);

  // Export to CSV
  const handleExportCSV = () => {
    if (classStudents.length === 0) return;

    const headers = ['No', 'Nama Siswa', ...classTasks.map((t) => t.title), 'Rata-Rata', 'Status KKTP'];
    const rows = classStudents.map((student, idx) => {
      const studentScores = classTasks.map((task) => {
        const sub = submissions.find((s) => s.taskId === task.id && s.studentId === student.id);
        return sub && sub.score !== undefined ? sub.score : '-';
      });

      const validScores = studentScores.filter((sc): sc is number => typeof sc === 'number');
      const avg = validScores.length > 0
        ? Math.round(validScores.reduce((a, b) => a + b, 0) / validScores.length)
        : '-';

      const status = typeof avg === 'number' ? (avg >= 75 ? 'Tuntas' : 'Perlu Remedial') : '-';

      return [idx + 1, `"${student.name}"`, ...studentScores, avg, status].join(',');
    });

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Nilai_${teacher.subject}_${targetClassName.replace(/\s+/g, '_')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-4">
      {/* Sub-tab switcher & Action Buttons */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200">
        <div className="flex items-center gap-2">
          <div className="p-1 bg-slate-100 rounded-lg flex items-center">
            <button
              onClick={() => setSubTab('nilai')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                subTab === 'nilai'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Buku Rekap Nilai
            </button>
            <button
              onClick={() => setSubTab('presensi')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                subTab === 'presensi'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Presensi Pertemuan
            </button>
          </div>

          <span className="text-xs text-slate-500 hidden sm:inline">
            Menampilkan data <strong>{targetClassName}</strong>
          </span>
        </div>

        <div className="flex items-center gap-2">
          {subTab === 'nilai' ? (
            <>
              <button
                onClick={handleExportCSV}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 rounded-lg transition-colors"
                title="Unduh ke format Excel/CSV"
              >
                <Download className="w-3.5 h-3.5 text-slate-500" />
                <span>Unduh CSV</span>
              </button>
              <button
                onClick={handlePrint}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 rounded-lg transition-colors"
                title="Cetak lembar nilai"
              >
                <Printer className="w-3.5 h-3.5 text-slate-500" />
                <span>Cetak</span>
              </button>
            </>
          ) : (
            <button
              onClick={() => setIsAttendanceModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-xs transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>Catat Presensi Baru</span>
            </button>
          )}
        </div>
      </div>

      {/* CONTENT: Buku Nilai */}
      {subTab === 'nilai' && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">
                Buku Rekapitulasi Nilai {teacher.subject}
              </h3>
              <p className="text-xs text-slate-500">
                {targetClassName} · Kriteria Ketuntasan (KKTP): 75
              </p>
            </div>
            <div className="text-xs text-slate-500">
              Total <strong>{classStudents.length}</strong> siswa
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-700 font-semibold">
                  <th className="py-3 px-3 w-10 text-center">No</th>
                  <th className="py-3 px-4 min-w-[160px]">Nama Siswa</th>
                  {classTasks.map((t) => (
                    <th key={t.id} className="py-3 px-3 text-center min-w-[110px]" title={t.title}>
                      <span className="line-clamp-1">{t.title}</span>
                    </th>
                  ))}
                  <th className="py-3 px-4 text-center font-bold text-slate-900 bg-slate-100/70 min-w-[90px]">
                    Rata-Rata
                  </th>
                  <th className="py-3 px-4 text-center min-w-[120px]">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {classStudents.length === 0 ? (
                  <tr>
                    <td colSpan={classTasks.length + 4} className="py-8 text-center text-slate-400">
                      Tidak ada siswa di kelas ini.
                    </td>
                  </tr>
                ) : (
                  classStudents.map((student, idx) => {
                    const studentScores = classTasks.map((task) => {
                      const sub = submissions.find(
                        (s) => s.taskId === task.id && s.studentId === student.id
                      );
                      return sub?.score;
                    });

                    const validScores = studentScores.filter((sc): sc is number => typeof sc === 'number');
                    const avg = validScores.length > 0
                      ? Math.round(validScores.reduce((a, b) => a + b, 0) / validScores.length)
                      : null;

                    const isPass = avg !== null && avg >= 75;

                    return (
                      <tr key={student.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3 px-3 text-center text-slate-400 font-mono">
                          {idx + 1}
                        </td>
                        <td className="py-3 px-4 font-medium text-slate-900">
                          {student.name}
                        </td>
                        {classTasks.map((task) => {
                          const sub = submissions.find(
                            (s) => s.taskId === task.id && s.studentId === student.id
                          );
                          return (
                            <td key={task.id} className="py-3 px-3 text-center font-mono">
                              {sub ? (
                                sub.score !== undefined ? (
                                  <span className="font-semibold text-slate-800">{sub.score}</span>
                                ) : (
                                  <span className="text-amber-600 text-[11px]">Terkumpul</span>
                                )
                              ) : (
                                <span className="text-slate-300">-</span>
                              )}
                            </td>
                          );
                        })}
                        <td className="py-3 px-4 text-center font-mono font-bold text-slate-900 bg-slate-50/50">
                          {avg !== null ? (
                            <span className={avg >= 75 ? 'text-indigo-900' : 'text-rose-600'}>
                              {avg}
                            </span>
                          ) : (
                            <span className="text-slate-300 font-normal">-</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-center">
                          {avg !== null ? (
                            isPass ? (
                              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700">
                                <CheckCircle className="w-3 h-3 text-emerald-600" />
                                <span>Tuntas</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-rose-600">
                                <AlertCircle className="w-3 h-3 text-rose-500" />
                                <span>Remedial</span>
                              </span>
                            )
                          ) : (
                            <span className="text-slate-400 text-[11px]">-</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* CONTENT: Presensi Pertemuan */}
      {subTab === 'presensi' && (
        <div className="space-y-3">
          {classAttendance.length === 0 ? (
            <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
              <Calendar className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <h3 className="text-sm font-semibold text-slate-800">Belum ada catatan presensi</h3>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                Klik tombol "Catat Presensi Baru" untuk mengisi kehadiran siswa per pertemuan tatap muka / daring.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {classAttendance.map((att, idx) => {
                const totalStudents = classStudents.length;
                let countH = 0;
                let countS = 0;
                let countI = 0;
                let countA = 0;

                Object.values(att.records).forEach((st) => {
                  if (st === 'H') countH++;
                  else if (st === 'S') countS++;
                  else if (st === 'I') countI++;
                  else if (st === 'A') countA++;
                });

                return (
                  <div
                    key={att.id}
                    className="bg-white rounded-xl border border-slate-200 p-4 space-y-3 hover:border-slate-300 transition-all"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2 text-xs text-slate-500">
                          <span className="font-semibold text-indigo-700">
                            Pertemuan #{classAttendance.length - idx}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span>Tanggal: {att.date}</span>
                        </div>
                        <h4 className="text-sm font-semibold text-slate-900 mt-0.5">
                          {att.topic}
                        </h4>
                      </div>

                      <button
                        onClick={() => {
                          if (confirm('Hapus catatan presensi pertemuan ini?')) {
                            deleteAttendance(att.id);
                          }
                        }}
                        className="p-1 text-slate-400 hover:text-rose-600 rounded-md transition-colors"
                        title="Hapus Presensi"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="flex flex-wrap items-center gap-4 text-xs pt-1 border-t border-slate-100">
                      <span className="text-emerald-700 font-medium">
                        Hadir: <strong className="font-mono">{countH}</strong>
                      </span>
                      <span className="text-amber-700 font-medium">
                        Sakit: <strong className="font-mono">{countS}</strong>
                      </span>
                      <span className="text-blue-700 font-medium">
                        Izin: <strong className="font-mono">{countI}</strong>
                      </span>
                      <span className="text-rose-700 font-medium">
                        Alpa: <strong className="font-mono">{countA}</strong>
                      </span>
                      <span className="text-slate-500 ml-auto">
                        Total {totalStudents} Siswa Terdaftar
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      <AttendanceModal
        isOpen={isAttendanceModalOpen}
        onClose={() => setIsAttendanceModalOpen(false)}
      />
    </div>
  );
};
