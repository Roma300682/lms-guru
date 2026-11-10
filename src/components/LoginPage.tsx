import React, { useState } from 'react';
import { useLMS } from '../context/LMSContext';
import { GraduationCap, User, Lock, ArrowRight, Check, AlertCircle, Cloud } from 'lucide-react';
import { DeployGuideModal } from './modals/DeployGuideModal';
import { ForgotPasswordModal } from './modals/ForgotPasswordModal';

export const LoginPage: React.FC = () => {
  const { teacher, classes, students, loginAsTeacher, loginAsStudent } = useLMS();

  const [role, setRole] = useState<'teacher' | 'student'>('teacher');
  const [isDeployGuideOpen, setIsDeployGuideOpen] = useState(false);
  const [isForgotPasswordOpen, setIsForgotPasswordOpen] = useState(false);

  // Teacher login state
  const [pin, setPin] = useState('');
  const [teacherError, setTeacherError] = useState('');

  // Student login state
  const [selectedClassId, setSelectedClassId] = useState<string>(classes[0]?.id || 'c1');
  const [selectedStudentId, setSelectedStudentId] = useState<string>('');

  const classStudents = students.filter((s) => s.classId === selectedClassId);

  // Set default student when class changes
  const handleClassChange = (newClassId: string) => {
    setSelectedClassId(newClassId);
    const firstStudentInClass = students.find((s) => s.classId === newClassId);
    setSelectedStudentId(firstStudentInClass?.id || '');
  };

  const handleTeacherSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setTeacherError('');
    const success = loginAsTeacher(pin);
    if (!success) {
      setTeacherError('PIN salah. Silakan periksa kembali PIN Anda.');
    }
  };

  const handleStudentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const studentToLogin = selectedStudentId || classStudents[0]?.id;
    if (!studentToLogin) return;
    loginAsStudent(studentToLogin);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center items-center px-4 py-8">
      {/* Brand Header */}
      <div className="w-full max-w-md text-center mb-6">
        <div className="w-12 h-12 bg-indigo-600 rounded-2xl text-white flex items-center justify-center mx-auto mb-3 shadow-sm">
          <GraduationCap className="w-6 h-6" />
        </div>
        <h1 className="text-xl font-bold tracking-tight text-slate-900">
          GuruMapel LMS
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          LMS Mandiri & Panel Admin Mata Pelajaran {teacher.subject}
        </p>
      </div>

      {/* Login Card */}
      <div className="w-full max-w-md bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {/* Role Selector Tabs */}
        <div className="grid grid-cols-2 p-1.5 bg-slate-100 border-b border-slate-200">
          <button
            type="button"
            onClick={() => {
              setRole('teacher');
              setTeacherError('');
            }}
            className={`flex items-center justify-center gap-1.5 py-2.5 text-xs font-semibold rounded-xl transition-all ${
              role === 'teacher'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <GraduationCap className="w-4 h-4 text-indigo-600" />
            <span>Guru & Admin</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setRole('student');
              if (!selectedStudentId && classStudents[0]) {
                setSelectedStudentId(classStudents[0].id);
              }
            }}
            className={`flex items-center justify-center gap-1.5 py-2.5 text-xs font-semibold rounded-xl transition-all ${
              role === 'student'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <User className="w-4 h-4 text-emerald-600" />
            <span>Masuk Siswa</span>
          </button>
        </div>

        {/* Form Body */}
        <div className="p-6">
          {role === 'teacher' ? (
            <form onSubmit={handleTeacherSubmit} className="space-y-4">
              <div className="bg-slate-50 rounded-xl p-3 border border-slate-200 text-xs">
                <span className="text-slate-500 block">Guru & Administrator Mapel:</span>
                <span className="font-semibold text-slate-900 text-sm">{teacher.name}</span>
                <span className="text-indigo-600 block text-xs mt-0.5">Mata Pelajaran: {teacher.subject}</span>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Masukkan PIN Guru / Admin
                </label>
                <div className="relative">
                  <input
                    type="password"
                    maxLength={10}
                    value={pin}
                    onChange={(e) => {
                      setPin(e.target.value);
                      setTeacherError('');
                    }}
                    placeholder="Masukkan PIN keamanan"
                    className="w-full text-sm px-3.5 py-2.5 pl-9 border border-slate-300 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-indigo-500 font-mono"
                    autoFocus
                  />
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                </div>
                {teacherError && (
                  <p className="text-xs text-rose-600 mt-1.5 flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5" />
                    <span>{teacherError}</span>
                  </p>
                )}

                <div className="flex justify-end mt-2">
                  <button
                    type="button"
                    onClick={() => setIsForgotPasswordOpen(true)}
                    className="text-[11px] text-indigo-600 hover:text-indigo-800 hover:underline font-medium transition-colors"
                  >
                    Lupa PIN Guru / Admin?
                  </button>
                </div>
              </div>

              <button
                type="submit"
                className="w-full flex items-center justify-center gap-2 py-2.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-xl transition-colors shadow-xs"
              >
                <span>Masuk ke Ruang Guru & Admin</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </form>
          ) : (
            <form onSubmit={handleStudentSubmit} className="space-y-4">
              <div className="text-xs text-slate-600">
                Pilih rombel kelas dan nama Anda untuk langsung masuk ke materi dan tugas:
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Pilih Kelas Anda
                </label>
                <select
                  value={selectedClassId}
                  onChange={(e) => handleClassChange(e.target.value)}
                  className="w-full text-xs font-medium px-3 py-2.5 border border-slate-300 rounded-xl bg-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
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
                  Pilih Nama Siswa ({classStudents.length} siswa terdaftar)
                </label>
                <select
                  value={selectedStudentId || classStudents[0]?.id || ''}
                  onChange={(e) => setSelectedStudentId(e.target.value)}
                  className="w-full text-xs font-medium px-3 py-2.5 border border-slate-300 rounded-xl bg-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                >
                  {classStudents.map((s, idx) => (
                    <option key={s.id} value={s.id}>
                      {idx + 1}. {s.name}
                    </option>
                  ))}
                </select>
              </div>

              <button
                type="submit"
                className="w-full flex items-center justify-center gap-2 py-2.5 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-xl transition-colors shadow-xs"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Masuk ke Ruang Belajar Siswa</span>
              </button>

              <p className="text-[11px] text-slate-400 text-center pt-1">
                Siswa tidak perlu password rumit. Cukup pilih nama untuk mengerjakan tugas & cek nilai.
              </p>
            </form>
          )}
        </div>
      </div>

      {/* Footer Info & Deploy Guide Link */}
      <div className="flex flex-col items-center gap-2 text-center text-[11px] text-slate-400 mt-6">
        <span>GuruMapel LMS · Khusus Guru Mata Pelajaran & Siswa</span>
        <button
          type="button"
          onClick={() => setIsDeployGuideOpen(true)}
          className="inline-flex items-center gap-1.5 text-xs text-indigo-600 hover:text-indigo-800 font-medium hover:underline bg-indigo-50/60 px-3 py-1 rounded-full border border-indigo-100 transition-colors"
        >
          <Cloud className="w-3.5 h-3.5" />
          <span>Cara Deploy Aplikasi ini (Vercel / Hosting)</span>
        </button>
      </div>

      <DeployGuideModal
        isOpen={isDeployGuideOpen}
        onClose={() => setIsDeployGuideOpen(false)}
      />

      <ForgotPasswordModal
        isOpen={isForgotPasswordOpen}
        onClose={() => setIsForgotPasswordOpen(false)}
      />
    </div>
  );
};
