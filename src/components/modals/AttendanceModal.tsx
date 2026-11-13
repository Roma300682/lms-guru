import React, { useState } from 'react';
import { useLMS } from '../../context/LMSContext';
import { AttendanceStatus } from '../../types/lms';
import { X, CheckCheck, Plus } from 'lucide-react';

interface AttendanceModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AttendanceModal: React.FC<AttendanceModalProps> = ({ isOpen, onClose }) => {
  const { classes, students, activeClassId, activeSubject, availableSubjects, teacherSubjects, addClass, setActiveClassId, saveAttendance } = useLMS();

  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [classId, setClassId] = useState(activeClassId === 'all' ? classes[0]?.id || 'c1' : activeClassId);
  const [newClassName, setNewClassName] = useState('');
  const [subject, setSubject] = useState(
    activeSubject !== 'all' ? activeSubject : (teacherSubjects[0] || '')
  );
  const [topic, setTopic] = useState('');

  // Local state for student attendance
  const [statuses, setStatuses] = useState<Record<string, AttendanceStatus>>({});

  React.useEffect(() => {
    if (isOpen) {
      setSubject(activeSubject !== 'all' ? activeSubject : (teacherSubjects[0] || ''));
      if (classes.length > 0 && !classes.some((c) => c.id === classId)) {
        setClassId(activeClassId !== 'all' && classes.some((c) => c.id === activeClassId) ? activeClassId : classes[0].id);
      }
    }
  }, [isOpen, activeSubject, teacherSubjects, classes, activeClassId, classId]);

  if (!isOpen) return null;

  const currentClassStudents = students.filter((s) => s.classId === classId);

  // Initialize or get student status
  const getStudentStatus = (studentId: string): AttendanceStatus => {
    return statuses[studentId] || 'H'; // Default Hadir
  };

  const handleSetStatus = (studentId: string, status: AttendanceStatus) => {
    setStatuses((prev) => ({ ...prev, [studentId]: status }));
  };

  const handleMarkAllPresent = () => {
    const allPresent: Record<string, AttendanceStatus> = {};
    currentClassStudents.forEach((s) => {
      allPresent[s.id] = 'H';
    });
    setStatuses(allPresent);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!classId) return;

    // Fill defaults for any unset students
    const finalRecords: Record<string, AttendanceStatus> = {};
    currentClassStudents.forEach((s) => {
      finalRecords[s.id] = statuses[s.id] || 'H';
    });

    saveAttendance(date, classId, topic || `Pertemuan Tanggal ${date}`, finalRecords, subject.trim() || undefined);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs">
      <div className="bg-white rounded-xl max-w-xl w-full border border-slate-200 shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 shrink-0">
          <div>
            <h3 className="text-base font-semibold text-slate-900">Catat Presensi Kelas</h3>
            <p className="text-xs text-slate-500">Isi kehadiran siswa per pertemuan tatap muka / daring</p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {classes.length === 0 ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!newClassName.trim()) return;
              const createdId = addClass(newClassName.trim());
              if (createdId) {
                setClassId(createdId);
                setActiveClassId(createdId);
              }
              setNewClassName('');
            }}
            className="p-6 space-y-4"
          >
            <div className="p-4 bg-amber-50 border border-amber-200 text-amber-900 text-xs rounded-xl space-y-1">
              <span className="font-semibold block">Belum Ada Rombel Kelas Terdaftar</span>
              <span className="block text-amber-800">
                Buat rombel kelas pertama di bawah ini sebelum mencatat presensi.
              </span>
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                required
                value={newClassName}
                onChange={(e) => setNewClassName(e.target.value)}
                placeholder="Nama Rombel Baru (cth: Kelas X IPA 1)"
                className="flex-1 text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                autoFocus
              />
              <button
                type="submit"
                className="inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Buat Kelas</span>
              </button>
            </div>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                Tutup
              </button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleSave} className="flex flex-col flex-1 overflow-hidden">
            <div className="p-6 space-y-4 shrink-0 border-b border-slate-100">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Pilih Kelas
                  </label>
                  <select
                    value={classId || classes[0]?.id || ''}
                    onChange={(e) => {
                      setClassId(e.target.value);
                      setStatuses({});
                    }}
                    className="w-full text-sm px-3 py-2 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-indigo-500 bg-white"
                  >
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Tanggal Pertemuan
                </label>
                <input
                  type="date"
                  required
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full text-sm px-3 py-2 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Mata Pelajaran (Bebas)
                </label>
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Misal: Biologi, Kimia, dll."
                  className="w-full text-sm px-3 py-2 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                />
                {availableSubjects.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {availableSubjects.map((subj) => (
                      <button
                        key={subj}
                        type="button"
                        onClick={() => setSubject(subj)}
                        className={`px-2 py-0.5 text-[10px] font-medium rounded border transition-colors ${
                          subject.trim().toLowerCase() === subj.toLowerCase()
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

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Topik / Materi yang Diajarkan
                </label>
                <input
                  type="text"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder="Misal: Pertemuan 3: Pembelahan Sel"
                  className="w-full text-sm px-3 py-2 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            <div className="flex items-center justify-between pt-1">
              <span className="text-xs text-slate-600 font-medium">
                Daftar Siswa ({currentClassStudents.length} orang)
              </span>
              <button
                type="button"
                onClick={handleMarkAllPresent}
                className="inline-flex items-center gap-1 text-xs text-indigo-700 font-medium hover:bg-indigo-50 px-2 py-1 rounded-md transition-colors"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                <span>Tandai Semua Hadir</span>
              </button>
            </div>
          </div>

          {/* Student list */}
          <div className="flex-1 overflow-y-auto p-6 space-y-2">
            {currentClassStudents.length === 0 ? (
              <p className="text-xs text-slate-500 text-center py-6">
                Belum ada siswa di kelas ini.
              </p>
            ) : (
              currentClassStudents.map((s, idx) => {
                const currentStatus = getStudentStatus(s.id);
                return (
                  <div
                    key={s.id}
                    className="flex items-center justify-between p-2.5 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-400 font-mono w-5">
                        {idx + 1}.
                      </span>
                      <span className="text-sm font-medium text-slate-800">
                        {s.name}
                      </span>
                    </div>

                    <div className="flex items-center gap-1">
                      {(['H', 'S', 'I', 'A'] as AttendanceStatus[]).map((st) => {
                        const isActive = currentStatus === st;
                        const labelMap = {
                          H: 'Hadir',
                          S: 'Sakit',
                          I: 'Izin',
                          A: 'Alpa',
                        };
                        const colorMap = {
                          H: isActive ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200',
                          S: isActive ? 'bg-amber-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200',
                          I: isActive ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200',
                          A: isActive ? 'bg-rose-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200',
                        };

                        return (
                          <button
                            key={st}
                            type="button"
                            onClick={() => handleSetStatus(s.id, st)}
                            className={`w-7 h-7 text-xs font-semibold rounded-md transition-colors ${colorMap[st]}`}
                            title={labelMap[st]}
                          >
                            {st}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <div className="flex items-center justify-end gap-2 p-4 border-t border-slate-100 shrink-0 bg-slate-50">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-200 rounded-lg transition-colors"
            >
              Batal
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-xs transition-colors"
            >
              Simpan Presensi
            </button>
          </div>
        </form>
      )}
    </div>
  </div>
);
};
