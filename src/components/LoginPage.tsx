import React, { useState } from 'react';
import { useLMS } from '../context/LMSContext';
import { GraduationCap, User, Lock, ArrowRight, Check, AlertCircle, Cloud, MessageCircle, Loader2, LogIn, ExternalLink } from 'lucide-react';
import { DeployGuideModal } from './modals/DeployGuideModal';
import { ForgotPasswordModal } from './modals/ForgotPasswordModal';
import { normalizeWhatsAppNumber } from '../utils/whatsapp';

export const LoginPage: React.FC = () => {
  const {
    teacher,
    classes,
    students,
    loginAsTeacher,
    loginWithGoogleAsTeacher,
    connectGoogleForStudent,
    loginWithGoogleRedirect,
    loginAsStudent,
    firebaseUser,
    isCloudConnected,
    isInIframe,
    cloudAuthError,
    clearCloudAuthError,
  } = useLMS();

  const [role, setRole] = useState<'teacher' | 'student'>('teacher');
  const [isDeployGuideOpen, setIsDeployGuideOpen] = useState(false);
  const [isForgotPasswordOpen, setIsForgotPasswordOpen] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);

  // Teacher login state
  const [pin, setPin] = useState('');
  const [teacherError, setTeacherError] = useState('');

  // Student login state
  const [selectedClassId, setSelectedClassId] = useState<string>(classes[0]?.id || '');
  const [selectedStudentId, setSelectedStudentId] = useState<string>('');
  const [studentWhatsapp, setStudentWhatsapp] = useState<string>(() => {
    const first = students.find((s) => s.classId === (classes[0]?.id || ''));
    return first?.whatsapp || '';
  });
  const [studentWaError, setStudentWaError] = useState('');

  const effectiveClassId = classes.some((c) => c.id === selectedClassId)
    ? selectedClassId
    : classes[0]?.id || '';

  const classStudents = students.filter((s) => s.classId === effectiveClassId);

  const syncStudentWhatsapp = (studentId: string) => {
    const found = students.find((s) => s.id === studentId);
    setStudentWhatsapp(found?.whatsapp || '');
    setStudentWaError('');
  };

  // Set default student when class changes
  const handleClassChange = (newClassId: string) => {
    setSelectedClassId(newClassId);
    const firstStudentInClass = students.find((s) => s.classId === newClassId);
    const nextId = firstStudentInClass?.id || '';
    setSelectedStudentId(nextId);
    syncStudentWhatsapp(nextId);
  };

  const handleTeacherGoogleLogin = async () => {
    setTeacherError('');
    clearCloudAuthError();
    setIsGoogleLoading(true);
    try {
      await loginWithGoogleAsTeacher();
    } finally {
      setIsGoogleLoading(false);
    }
  };

  const handleStudentGoogleConnect = async () => {
    clearCloudAuthError();
    setIsGoogleLoading(true);
    try {
      await connectGoogleForStudent();
    } finally {
      setIsGoogleLoading(false);
    }
  };

  const handleTeacherSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setTeacherError('');
    clearCloudAuthError();
    const success = loginAsTeacher(pin);
    if (!success) {
      setTeacherError('PIN salah. Silakan periksa kembali PIN Anda.');
    }
  };

  const handleStudentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setStudentWaError('');
    const studentToLogin = selectedStudentId || classStudents[0]?.id;
    if (!studentToLogin) return;

    const trimmedWa = studentWhatsapp.trim();
    if (trimmedWa && !normalizeWhatsAppNumber(trimmedWa)) {
      setStudentWaError('Format nomor WhatsApp tidak valid. Contoh: 081234567890');
      return;
    }

    loginAsStudent(studentToLogin, trimmedWa || undefined);
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
          LMS Mandiri &amp; Panel Admin Mata Pelajaran {teacher.subject}
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
              clearCloudAuthError();
            }}
            className={`flex items-center justify-center gap-1.5 py-2.5 text-xs font-semibold rounded-xl transition-all ${
              role === 'teacher'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <GraduationCap className="w-4 h-4 text-indigo-600" />
            <span>Guru &amp; Admin</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setRole('student');
              clearCloudAuthError();
              const activeStudentId = selectedStudentId || classStudents[0]?.id || '';
              if (!selectedStudentId && classStudents[0]) {
                setSelectedStudentId(classStudents[0].id);
              }
              if (activeStudentId) {
                syncStudentWhatsapp(activeStudentId);
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
            <div className="space-y-4">
              <div className="bg-slate-50 rounded-xl p-3 border border-slate-200 text-xs">
                <span className="text-slate-500 block">Guru &amp; Administrator Mapel:</span>
                <span className="font-semibold text-slate-900 text-sm">{teacher.name}</span>
                <span className="text-indigo-600 block text-xs mt-0.5">Mata Pelajaran: {teacher.subject}</span>
              </div>

              <button
                type="button"
                disabled={isGoogleLoading}
                onClick={handleTeacherGoogleLogin}
                className="w-full flex items-center justify-center gap-2 py-2.5 px-4 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 rounded-xl transition-colors shadow-xs"
              >
                {isGoogleLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Menghubungkan Akun Google...</span>
                  </>
                ) : (
                  <>
                    <LogIn className="w-4 h-4" />
                    <span>Masuk Guru via Google (Database Cloud)</span>
                  </>
                )}
              </button>

              {cloudAuthError && (
                <div className="text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-xl p-3 space-y-2">
                  <div className="flex items-start gap-1.5">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
                    <span>{cloudAuthError}</span>
                  </div>
                  <div className="flex flex-wrap gap-2 pt-0.5">
                    {isInIframe ? (
                      <a
                        href={typeof window !== 'undefined' ? window.location.href : '#'}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span>Buka di Tab Browser Baru</span>
                      </a>
                    ) : (
                      <button
                        type="button"
                        onClick={() => void loginWithGoogleRedirect('teacher')}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors"
                      >
                        <LogIn className="w-3.5 h-3.5" />
                        <span>Login Google Tanpa Pop-up (Redirect)</span>
                      </button>
                    )}
                  </div>
                </div>
              )}

              <div className="relative flex items-center py-1">
                <div className="flex-grow border-t border-slate-200" />
                <span className="shrink mx-3 text-[11px] text-slate-400">atau masuk cepat dengan PIN</span>
                <div className="flex-grow border-t border-slate-200" />
              </div>

              <form onSubmit={handleTeacherSubmit} className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Masukkan PIN Guru / Admin
                  </label>
                  <div className="relative">
                    <input
                      type="password"
                      maxLength={20}
                      value={pin}
                      onChange={(e) => {
                        setPin(e.target.value);
                        setTeacherError('');
                      }}
                      placeholder="Masukkan PIN keamanan"
                      className="w-full text-sm px-3.5 py-2.5 pl-9 border border-slate-300 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-indigo-500 font-mono"
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
                  <span>Masuk ke Ruang Guru &amp; Admin</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </form>
            </div>
          ) : (
            <div className="space-y-4">
              {!isCloudConnected ? (
                <div className="p-3.5 rounded-xl bg-emerald-50/70 border border-emerald-200 space-y-2.5">
                  <div className="text-xs text-emerald-950 font-semibold">
                    Hubungkan Akun Google Siswa
                  </div>
                  <p className="text-[11px] text-emerald-800 leading-relaxed">
                    Masuk dengan Google agar data kelas, materi, tugas, nomor WhatsApp, dan jawaban Anda tersimpan langsung di database kelas.
                  </p>
                  <button
                    type="button"
                    disabled={isGoogleLoading}
                    onClick={handleStudentGoogleConnect}
                    className="w-full flex items-center justify-center gap-2 py-2 px-3 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 disabled:bg-emerald-400 rounded-lg transition-colors"
                  >
                    {isGoogleLoading ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Menghubungkan...</span>
                      </>
                    ) : (
                      <>
                        <LogIn className="w-3.5 h-3.5" />
                        <span>Hubungkan Google Sekarang</span>
                      </>
                    )}
                  </button>
                </div>
              ) : (
                <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 flex items-center justify-between gap-2">
                  <span className="truncate font-medium">
                    Akun Google: {firebaseUser?.email}
                  </span>
                </div>
              )}

              {cloudAuthError && (
                <div className="text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-xl p-3 space-y-2">
                  <div className="flex items-start gap-1.5">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
                    <span>{cloudAuthError}</span>
                  </div>
                  <div className="flex flex-wrap gap-2 pt-0.5">
                    {isInIframe ? (
                      <a
                        href={typeof window !== 'undefined' ? window.location.href : '#'}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg transition-colors"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span>Buka di Tab Browser Baru</span>
                      </a>
                    ) : (
                      <button
                        type="button"
                        onClick={() => void loginWithGoogleRedirect('student')}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg transition-colors"
                      >
                        <LogIn className="w-3.5 h-3.5" />
                        <span>Hubungkan Google Tanpa Pop-up (Redirect)</span>
                      </button>
                    )}
                  </div>
                </div>
              )}

              {classes.length === 0 ? (
                <div className="space-y-3 py-1">
                  <div className="bg-amber-50 border border-amber-200 text-amber-800 p-3.5 rounded-xl text-xs">
                    <span className="font-semibold block mb-1">Belum Ada Kelas Terdaftar</span>
                    Guru belum menambahkan rombel kelas atau mengunggah data siswa. Guru mata pelajaran dapat masuk melalui tab <strong>Guru &amp; Admin</strong> untuk membuat kelas atau mengupload daftar siswa.
                  </div>
                </div>
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
                      value={effectiveClassId}
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

                  {classStudents.length === 0 ? (
                    <div className="text-xs text-amber-700 bg-amber-50 p-3 rounded-xl border border-amber-200">
                      Belum ada siswa terdaftar di {classes.find((c) => c.id === effectiveClassId)?.name || 'kelas ini'}. Guru dapat mengunggah daftar siswa melalui Panel Guru &amp; Admin.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div>
                        <label className="block text-xs font-medium text-slate-700 mb-1">
                          Pilih Nama Siswa ({classStudents.length} siswa terdaftar)
                        </label>
                        <select
                          value={selectedStudentId || classStudents[0]?.id || ''}
                          onChange={(e) => {
                            setSelectedStudentId(e.target.value);
                            syncStudentWhatsapp(e.target.value);
                          }}
                          className="w-full text-xs font-medium px-3 py-2.5 border border-slate-300 rounded-xl bg-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                        >
                          {classStudents.map((s, idx) => (
                            <option key={s.id} value={s.id}>
                              {idx + 1}. {s.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-slate-700 mb-1">
                          No. WhatsApp Siswa / Orang Tua
                        </label>
                        <div className="relative">
                          <input
                            type="tel"
                            value={studentWhatsapp}
                            onChange={(e) => {
                              setStudentWhatsapp(e.target.value);
                              setStudentWaError('');
                            }}
                            placeholder="Contoh: 081234567890"
                            className="w-full text-xs px-3.5 py-2.5 pl-9 border border-slate-300 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-emerald-500 font-mono"
                          />
                          <MessageCircle className="w-4 h-4 text-emerald-600 absolute left-3 top-2.5" />
                        </div>
                        {studentWaError ? (
                          <p className="text-[11px] text-rose-600 mt-1 flex items-center gap-1">
                            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                            <span>{studentWaError}</span>
                          </p>
                        ) : (
                          <p className="text-[11px] text-slate-500 mt-1">
                            Tersimpan otomatis untuk menerima info materi &amp; tugas dari guru lewat WhatsApp.
                          </p>
                        )}
                      </div>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={classStudents.length === 0}
                    className={`w-full flex items-center justify-center gap-2 py-2.5 text-xs font-semibold text-white rounded-xl transition-colors shadow-xs ${
                      classStudents.length === 0
                        ? 'bg-slate-300 cursor-not-allowed'
                        : 'bg-emerald-700 hover:bg-emerald-800'
                    }`}
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Masuk ke Ruang Belajar Siswa</span>
                  </button>

                  <p className="text-[11px] text-slate-400 text-center pt-1">
                    Pilih kelas dan nama Anda serta isi nomor WhatsApp aktif untuk mulai belajar.
                  </p>
                </form>
              )}
            </div>
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
