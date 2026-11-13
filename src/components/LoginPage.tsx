import React, { useState, useEffect, useRef } from 'react';
import { useLMS } from '../context/LMSContext';
import { GraduationCap, User, Check, AlertCircle, Cloud, MessageCircle, Loader2, LogIn, ExternalLink, Copy } from 'lucide-react';
import { DeployGuideModal } from './modals/DeployGuideModal';
import { normalizeWhatsAppNumber } from '../utils/whatsapp';
import firebaseConfig from '../../firebase-applet-config.json';

export const LoginPage: React.FC = () => {
  const {
    classes,
    students,
    loginWithGoogleAsTeacher,
    connectGoogleForStudent,
    loginWithGoogleRedirect,
    loginAsStudent,
    firebaseUser,
    isCloudConnected,
    isCloudAdmin,
    isInIframe,
    cloudAuthError,
    cloudAuthErrorCode,
    clearCloudAuthError,
    logout,
  } = useLMS();
  const [copiedHost, setCopiedHost] = useState(false);

  const currentHost = typeof window !== 'undefined' ? window.location.hostname : '';
  const firebaseAuthSettingsUrl = `https://console.firebase.google.com/project/${firebaseConfig.projectId}/authentication/settings`;

  const handleCopyHost = () => {
    if (!currentHost) return;
    navigator.clipboard.writeText(currentHost);
    setCopiedHost(true);
    setTimeout(() => setCopiedHost(false), 2000);
  };

  const [role, setRole] = useState<'teacher' | 'student'>(() => {
    try {
      const saved = sessionStorage.getItem('gm_login_role_tab');
      return saved === 'student' ? 'student' : 'teacher';
    } catch {
      return 'teacher';
    }
  });
  const [isDeployGuideOpen, setIsDeployGuideOpen] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);

  const switchRoleTab = (nextRole: 'teacher' | 'student') => {
    setRole(nextRole);
    try {
      sessionStorage.setItem('gm_login_role_tab', nextRole);
    } catch {
      // ignore sessionStorage error
    }
  };

  // Auto-switch to Student tab once when a non-admin student Google account is detected
  const hasAutoSwitchedStudentRef = useRef(false);
  useEffect(() => {
    if (isCloudConnected && !isCloudAdmin && !hasAutoSwitchedStudentRef.current) {
      hasAutoSwitchedStudentRef.current = true;
      if (role === 'teacher' && !cloudAuthError) {
        setRole('student');
        try {
          sessionStorage.setItem('gm_login_role_tab', 'student');
        } catch {
          // ignore
        }
      }
    }
    if (!isCloudConnected) {
      hasAutoSwitchedStudentRef.current = false;
    }
  }, [isCloudConnected, isCloudAdmin, role, cloudAuthError]);

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
          Platform Pembelajaran &amp; Database Cloud Guru Mata Pelajaran
        </p>
      </div>

      {/* Login Card */}
      <div className="w-full max-w-md bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {/* Role Selector Tabs */}
        <div className="grid grid-cols-2 p-1.5 bg-slate-100 border-b border-slate-200">
          <button
            type="button"
            onClick={() => {
              switchRoleTab('teacher');
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
              switchRoleTab('student');
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
              <div className="bg-indigo-50/70 rounded-xl p-4 border border-indigo-100 text-xs space-y-1">
                <span className="font-bold text-indigo-950 block">
                  Masuk Ruang Guru &amp; Administrator
                </span>
                <p className="text-[11px] text-indigo-900/80 leading-relaxed">
                  Gunakan akun Google Guru terdaftar agar semua data kelas, materi, tugas, soal AI, WhatsApp, dan nilai tersinkron otomatis di Laptop &amp; HP.
                </p>
              </div>

              {isCloudConnected && !isCloudAdmin ? (
                <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 space-y-3 text-xs text-rose-900">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <span className="font-bold block">Akses Ruang Guru &amp; Admin Ditolak</span>
                      <p className="text-[11px] leading-relaxed">
                        Akun Google yang terhubung (<strong>{firebaseUser?.email}</strong>) adalah akun <strong>Siswa</strong> dan tidak diperbolehkan masuk ke Ruang Guru maupun Admin.
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        clearCloudAuthError();
                        switchRoleTab('student');
                      }}
                      className="flex-1 py-2 px-3 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg transition-colors"
                    >
                      Lanjut ke Masuk Siswa
                    </button>
                    <button
                      type="button"
                      onClick={logout}
                      className="py-2 px-3 text-xs font-medium text-rose-800 bg-white hover:bg-rose-100 border border-rose-200 rounded-lg transition-colors"
                    >
                      Ganti Akun Google
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <button
                    type="button"
                    disabled={isGoogleLoading}
                    onClick={handleTeacherGoogleLogin}
                    className="w-full flex items-center justify-center gap-2 py-3 px-4 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 rounded-xl transition-colors shadow-xs"
                  >
                    {isGoogleLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Menghubungkan Akun Google...</span>
                      </>
                    ) : (
                      <>
                        <LogIn className="w-4 h-4" />
                        <span>Masuk Guru via Google</span>
                      </>
                    )}
                  </button>

                  {!isInIframe && (
                    <button
                      type="button"
                      disabled={isGoogleLoading}
                      onClick={() => void loginWithGoogleRedirect('teacher')}
                      className="w-full flex items-center justify-center gap-1.5 py-2 px-3 text-[11px] font-semibold text-indigo-900 bg-white hover:bg-indigo-50 border border-indigo-200 rounded-xl transition-colors"
                    >
                      <LogIn className="w-3.5 h-3.5" />
                      <span>Login Google Alternatif (Jika Pop-up Diblokir)</span>
                    </button>
                  )}
                </div>
              )}

              {cloudAuthError && (
                <div className="text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-xl p-3 space-y-2">
                  <div className="flex items-start gap-1.5">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
                    <span>{cloudAuthError}</span>
                  </div>
                  <div className="flex flex-wrap gap-2 pt-0.5">
                    {cloudAuthErrorCode === 'auth/unauthorized-domain' ? (
                      <>
                        <button
                          type="button"
                          onClick={handleCopyHost}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-semibold text-slate-800 bg-white border border-rose-200 hover:bg-slate-50 rounded-lg transition-colors"
                        >
                          {copiedHost ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                          <span>{copiedHost ? 'Domain Tersalin!' : `Salin: ${currentHost}`}</span>
                        </button>
                        <a
                          href={firebaseAuthSettingsUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          <span>Buka Authorized Domains Firebase</span>
                        </a>
                      </>
                    ) : isInIframe ? (
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
            </div>
          ) : (
            <div className="space-y-4">
              {!isCloudConnected ? (
                <div className="p-4 rounded-xl bg-emerald-50/80 border border-emerald-200 space-y-3">
                  <div className="space-y-1">
                    <div className="text-xs text-emerald-950 font-bold">
                      1. Hubungkan Akun Google Siswa Terlebih Dahulu
                    </div>
                    <p className="text-[11px] text-emerald-800 leading-relaxed">
                      Wajib login Google agar daftar kelas, nama siswa, materi, tugas, nomor WhatsApp, dan nilai langsung tersinkron dengan Guru.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <button
                      type="button"
                      disabled={isGoogleLoading}
                      onClick={handleStudentGoogleConnect}
                      className="w-full flex items-center justify-center gap-2 py-2.5 px-3 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 disabled:bg-emerald-400 rounded-lg transition-colors shadow-xs"
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

                    {!isInIframe && (
                      <button
                        type="button"
                        disabled={isGoogleLoading}
                        onClick={() => void loginWithGoogleRedirect('student')}
                        className="w-full flex items-center justify-center gap-1.5 py-2 px-3 text-[11px] font-semibold text-emerald-900 bg-white hover:bg-emerald-100/60 border border-emerald-300 rounded-lg transition-colors"
                      >
                        <LogIn className="w-3.5 h-3.5" />
                        <span>Login Google Alternatif (Jika Pop-up HP Diblokir)</span>
                      </button>
                    )}
                  </div>

                  <p className="text-[10px] text-emerald-900/80 bg-white/70 border border-emerald-200/70 rounded-lg px-2.5 py-1.5 leading-relaxed">
                    <strong>Buka dari WhatsApp?</strong> Jika tombol Google gagal di browser dalam WhatsApp, ketuk menu <strong>⋮</strong> (pojok kanan atas) lalu pilih <strong>Buka di Chrome / Browser</strong>.
                  </p>
                </div>
              ) : (
                <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 flex items-center justify-between gap-2">
                  <span className="truncate font-medium">
                    Terhubung Cloud: {firebaseUser?.email}
                  </span>
                  <button
                    type="button"
                    onClick={logout}
                    className="text-[11px] font-semibold text-emerald-800 hover:underline shrink-0"
                  >
                    Ganti Akun
                  </button>
                </div>
              )}

              {cloudAuthError && (
                <div className="text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-xl p-3 space-y-2">
                  <div className="flex items-start gap-1.5">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
                    <span>{cloudAuthError}</span>
                  </div>
                  <div className="flex flex-wrap gap-2 pt-0.5">
                    {cloudAuthErrorCode === 'auth/unauthorized-domain' ? (
                      <>
                        <button
                          type="button"
                          onClick={handleCopyHost}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-semibold text-slate-800 bg-white border border-rose-200 hover:bg-slate-50 rounded-lg transition-colors"
                        >
                          {copiedHost ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                          <span>{copiedHost ? 'Domain Tersalin!' : `Salin: ${currentHost}`}</span>
                        </button>
                        <a
                          href={firebaseAuthSettingsUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg transition-colors"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          <span>Buka Authorized Domains Firebase</span>
                        </a>
                      </>
                    ) : isInIframe ? (
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

              {isCloudConnected && (
                classes.length === 0 ? (
                  <div className="space-y-3 py-1">
                    <div className="bg-amber-50 border border-amber-200 text-amber-800 p-3.5 rounded-xl text-xs">
                      <span className="font-semibold block mb-1">Belum Ada Kelas Terdaftar</span>
                      Guru belum menambahkan rombel kelas atau mengunggah data siswa ke Database Cloud. Minta guru untuk masuk lewat tab <strong>Guru &amp; Admin</strong> terlebih dahulu.
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
                )
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
    </div>
  );
};
