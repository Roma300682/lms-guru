import React, { useState } from 'react';
import { useLMS } from '../../context/LMSContext';
import { X, Plus, Trash2 } from 'lucide-react';

interface TeacherProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const TeacherProfileModal: React.FC<TeacherProfileModalProps> = ({ isOpen, onClose }) => {
  const { teacher, updateTeacher, classes, addClass, deleteClass, students, addStudent, deleteStudent } = useLMS();

  const [teacherName, setTeacherName] = useState(teacher.name);
  const [subject, setSubject] = useState(teacher.subject);
  const [pin, setPin] = useState(teacher.pin || '1234');

  // New Class Input
  const [newClassName, setNewClassName] = useState('');

  // Selected Class for adding student
  const [selectedClassForStudent, setSelectedClassForStudent] = useState(classes[0]?.id || '');
  const [newStudentName, setNewStudentName] = useState('');

  if (!isOpen) return null;

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    if (!teacherName.trim() || !subject.trim() || !pin.trim()) return;
    updateTeacher({ name: teacherName.trim(), subject: subject.trim(), pin: pin.trim() });
    onClose();
  };

  const handleAddClass = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClassName.trim()) return;
    addClass(newClassName);
    setNewClassName('');
  };

  const handleAddStudent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStudentName.trim() || !selectedClassForStudent) return;
    addStudent(newStudentName, selectedClassForStudent);
    setNewStudentName('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs">
      <div className="bg-white rounded-xl max-w-lg w-full border border-slate-200 shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 shrink-0">
          <div>
            <h3 className="text-base font-semibold text-slate-900">Pengaturan Guru & Rombel</h3>
            <p className="text-xs text-slate-500">Sesuaikan identitas mata pelajaran dan daftar kelas yang Anda ampu</p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6 overflow-y-auto flex-1">
          {/* Identity Form */}
          <form onSubmit={handleSaveProfile} className="space-y-3 pb-5 border-b border-slate-100">
            <h4 className="text-xs font-semibold text-slate-800 uppercase tracking-wider">
              Identitas Guru Mata Pelajaran
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Nama Lengkap & Gelar
                </label>
                <input
                  type="text"
                  required
                  value={teacherName}
                  onChange={(e) => setTeacherName(e.target.value)}
                  className="w-full text-sm px-3 py-2 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Mata Pelajaran
                </label>
                <input
                  type="text"
                  required
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Misal: Biologi"
                  className="w-full text-sm px-3 py-2 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  PIN Masuk Guru
                </label>
                <input
                  type="text"
                  maxLength={10}
                  required
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                  placeholder="1234"
                  className="w-full text-sm px-3 py-2 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-indigo-500 font-mono"
                />
              </div>
            </div>
            <button
              type="submit"
              className="text-xs font-semibold px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg transition-colors"
            >
              Simpan Identitas & PIN
            </button>
          </form>

          {/* Classes Manager */}
          <div className="space-y-3 pb-5 border-b border-slate-100">
            <h4 className="text-xs font-semibold text-slate-800 uppercase tracking-wider">
              Kelola Kelas / Rombel ({classes.length} Kelas)
            </h4>
            <form onSubmit={handleAddClass} className="flex gap-2">
              <input
                type="text"
                placeholder="Nama Kelas Baru (misal: Kelas XI-IPA 1)"
                value={newClassName}
                onChange={(e) => setNewClassName(e.target.value)}
                className="flex-1 text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
              />
              <button
                type="submit"
                className="inline-flex items-center gap-1 text-xs font-medium px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Tambah Kelas</span>
              </button>
            </form>

            <div className="space-y-1.5 max-h-36 overflow-y-auto">
              {classes.map((cls) => {
                const count = students.filter((s) => s.classId === cls.id).length;
                return (
                  <div
                    key={cls.id}
                    className="flex items-center justify-between px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                  >
                    <div>
                      <span className="font-semibold text-slate-800">{cls.name}</span>
                      <span className="text-slate-500 ml-2">({count} siswa)</span>
                    </div>
                    {classes.length > 1 && (
                      <button
                        type="button"
                        onClick={() => {
                          if (confirm(`Hapus ${cls.name}? Siswa di dalamnya juga akan terhapus.`)) {
                            deleteClass(cls.id);
                          }
                        }}
                        className="text-rose-500 hover:text-rose-700 p-1"
                        title="Hapus Kelas"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Add Student Quickly */}
          <div className="space-y-3">
            <h4 className="text-xs font-semibold text-slate-800 uppercase tracking-wider">
              Tambah Siswa Cepat
            </h4>
            <form onSubmit={handleAddStudent} className="space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <select
                  value={selectedClassForStudent}
                  onChange={(e) => setSelectedClassForStudent(e.target.value)}
                  className="text-xs px-2.5 py-2 border border-slate-300 rounded-lg bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                >
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
                <input
                  type="text"
                  placeholder="Nama Lengkap Siswa"
                  value={newStudentName}
                  onChange={(e) => setNewStudentName(e.target.value)}
                  className="text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <button
                type="submit"
                className="w-full text-xs font-medium py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors"
              >
                + Masukkan Siswa ke Kelas
              </button>
            </form>

            <div className="text-xs text-slate-500 bg-slate-50 p-2.5 rounded-lg border border-slate-200">
              Total <strong>{students.length}</strong> siswa terdaftar di seluruh kelas yang Anda ampu.
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end p-4 border-t border-slate-100 bg-slate-50 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-100 rounded-lg transition-colors"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
