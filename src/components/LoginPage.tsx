import React, { useState, useEffect, useRef } from 'react';
import { useLMS } from '../context/LMSContext';
import { GraduationCap, User, Check, AlertCircle, Cloud, MessageCircle, Loader2, LogIn, ExternalLink, Copy, Lock } from 'lucide-react';
import { DeployGuideModal } from './modals/DeployGuideModal';
import { normalizeWhatsAppNumber } from '../utils/whatsapp';
import { parseStudentLinkParams } from '../utils/phoneAuth';
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
    isStudentCloudSynced,
    anonymousAuthBlocked,
    retryAnonymousSync,
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
  const firebaseAuthProvidersUrl = `https://console.firebase.google.com/project/${firebaseConfig.projectId}/authentication/providers`;

  const handleCopyHost = () => {
    if (!currentHost) return;
    navigator.clipboard.writeText(currentHost);
    setCopiedHost(true);
    setTimeout(() => setCopiedHost(false), 2000);
  };

  const linkParams = React.useMemo(() => parseStudentLinkParams(), []);
  const [lockedLinkStudentId, setLockedLinkStudentId] = useState<string>(linkParams.studentId || '');

  const [role, setRole] = useState<'teacher' | 'student'>(() => {
    if (linkParams.isStudentLink) return 'student';
    try {
      const saved = sessionStorage.getItem('gm_login_role_tab');
      return saved === 'student' ? 'student' : 'teacher';
    } catch {
      return 'teacher';
    }
  });
  const [isDeployGuideOpen, setIsDeployGuideOpen] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [isVerifyingStudent, setIsVerifyingStudent] = useState(false);

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

  // Student login state (persisted in sessionStorage across Google redirect/popup)
  const readStudentDraft = (): { classId?: string; studentId?: string; whatsapp?: string } => {
    try {
      const raw = sessionStorage.getItem('gm_student_login_draft');
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  };

  const initialDraft = readStudentDraft();

  const [selectedClassId, setSelectedClassId] = useState<string>(
    linkParams.classId || initialDraft.classId || classes[0]?.id || ''
  );
  const [selectedStudentId, setSelectedStudentId] = useState<string>(
    linkParams.studentId || initialDraft.studentId || ''
  );
  // NEVER auto-prefill another student's registered phone number
  const [studentWhatsapp, setStudentWhatsapp] = useState<string>(
    initialDraft.whatsapp || ''
  );
  const [studentWaError, setStudentWaError] = useState('');

  const saveStudentDraft = (classId: string, studentId: string, whatsapp: string) => {
    try {
      sessionStorage.setItem(
        'gm_student_login_draft',
        JSON.stringify({ classId, studentId, whatsapp })
      );
    } catch {
      // ignore sessionStorage error
    }
  };

  const linkedStudent = lockedLinkStudentId
    ? students.find((s) => s.id === lockedLinkStudentId) || null
    : null;

  useEffect(() => {
    if (linkedStudent) {
      setSelectedClassId(linkedStudent.classId);
      setSelectedStudentId(linkedStudent.id);
    }
  }, [linkedStudent]);

  const effectiveClassId = linkedStudent
    ? linkedStudent.classId
    : classes.some((c) => c.id === selectedClassId)
    ? selectedClassId
    : classes[0]?.id || '';

  const classStudents = students.filter((s) => s.classId === effectiveClassId);
  const effectiveStudentId = linkedStudent
    ? linkedStudent.id
    : classStudents.some((s) => s.id === selectedStudentId)
    ? selectedStudentId
    : classStudents[0]?.id || '';

  const effectiveStudentObj = students.find((s) => s.id === effectiveStudentId) || null;
  const effectiveStudentHasPhone = Boolean(
    effectiveStudentObj?.phoneHash || normalizeWhatsAppNumber(effectiveStudentObj?.whatsapp)
  );

  const resetForStudentSelection = (studentId: string, nextClassId = effectiveClassId) => {
    setStudentWhatsapp('');
    setStudentWaError('');
    saveStudentDraft(nextClassId, studentId, '');
  };

  // Set default student when class changes
  const handleClassChange = (newClassId: string) => {
    setSelectedClassId(newClassId);
    const firstStudentInClass = students.find((s) => s.classId === newClassId);
    const nextId = firstStudentInClass?.id || '';
    setSelectedStudentId(nextId);
    resetForStudentSelection(nextId, newClassId);
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

  const validateAndPersistPreGoogleDraft = (): boolean => {
    setStudentWaError('');
    const trimmedWa = studentWhatsapp.trim();
    if (trimmedWa && !normalizeWhatsAppNumber(trimmedWa)) {
      setStudentWaError('Format nomor HP / WhatsApp tidak valid. Contoh: 081234567890');
      return false;
    }
    saveStudentDraft(effectiveClassId, effectiveStudentId, studentWhatsapp);
    return true;
  };

  const handleStudentGoogleConnect = async () => {
    if (!validateAndPersistPreGoogleDraft()) return;
    clearCloudAuthError();
    setIsGoogleLoading(true);
    try {
      await connectGoogleForStudent();
    } finally {
      setIsGoogleLoading(false);
    }
  };

  const handleStudentGoogleRedirect = async () => {
    if (!validateAndPersistPreGoogleDraft()) return;
    await loginWithGoogleRedirect('student');
  };

  const handleStudentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStudentWaError('');
    const studentToLogin = effectiveStudentId;
    if (!studentToLogin) return;

    const trimmedWa = studentWhatsapp.trim();
    if (!trimmedWa) {
      setStudentWaError('Masukkan No. HP / WhatsApp Anda yang terdaftar untuk verifikasi akun.');
      return;
    }
    if (!normalizeWhatsAppNumber(trimmedWa)) {
      setStudentWaError('Format nomor HP / WhatsApp tidak valid. Contoh: 081234567890');
      return;
    }

    setIsVerifyingStudent(true);
    try {
      const result = await loginAsStudent(studentToLogin, trimmedWa);
      if (!result.ok) {
        setStudentWaError(
          result.error || 'No. HP tidak sesuai dengan akun siswa yang dipilih.'
        );
        return;
      }
      try {
        sessionStorage.removeItem('gm_student_login_draft');
      } catch {
        // ignore
      }
    } finally {
      setIsVerifyingStudent(false);
    }
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
              const activeStudentId = effectiveStudentId;
              if (!selectedStudentId && activeStudentId) {
                setSelectedStudentId(activeStudentId);
              }
              if (activeStudentId) {
                resetForStudentSelection(activeStudentId);
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
              {isCloudConnected ? (
                <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 flex items-center justify-between gap-2">
                  <span className="truncate font-medium">
                    Terhubung Google Cloud: {firebaseUser?.email}
                  </span>
                  <button
                    type="button"
                    onClick={logout}
                    className="text-[11px] font-semibold text-emerald-800 hover:underline shrink-0"
                  >
                    Ganti Akun
                  </button>
                </div>
              ) : anonymousAuthBlocked ? (
                <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-[11px] text-amber-900 space-y-2 leading-relaxed">
                  <div className="font-bold text-amber-950 flex items-center gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                    <span>Sinkron Otomatis Menunggu Aktivasi 1x di Firebase</span>
                  </div>
                  <p>
                    Agar siswa di browser mana pun langsung tersinkron tanpa login Google, Admin perlu mengaktifkan provider <strong>Anonymous</strong> di Firebase Console (Authentication → Sign-in method → Anonymous → Enable).
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <a
                      href={firebaseAuthProvidersUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-semibold text-white bg-amber-700 hover:bg-amber-800 rounded-lg transition-colors"
                    >
                      <ExternalLink className="w-3 h-3" />
                      <span>Buka Sign-in Method Firebase</span>
                    </a>
                    <button
                      type="button"
                      onClick={() => void retryAnonymousSync()}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-semibold text-amber-900 bg-white hover:bg-amber-100 border border-amber-300 rounded-lg transition-colors"
                    >
                      <span>Coba Sinkron Lagi</span>
                    </button>
                  </div>
                </div>
              ) : null}

              <form onSubmit={handleStudentSubmit} className="space-y-3.5">
                {linkedStudent && (
                  <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-950 space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold flex items-center gap-1.5 text-emerald-800">
                        <Lock className="w-3.5 h-3.5 shrink-0" />
                        <span>Tautan Login Khusus Siswa</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setLockedLinkStudentId('');
                          setStudentWhatsapp('');
                          setStudentWaError('');
                          try {
                            const url = new URL(window.location.href);
                            url.searchParams.delete('student');
                            url.searchParams.delete('siswa');
                            window.history.replaceState({}, '', url.toString());
                          } catch {
                            // ignore
                          }
                        }}
                        className="text-[11px] font-semibold text-emerald-700 hover:underline shrink-0"
                      >
                        Bukan nama Anda? Ganti
                      </button>
                    </div>
                    <div>
                      Akun tujuan: <strong>{linkedStudent.name}</strong> (
                      {classes.find((c) => c.id === linkedStudent.classId)?.name || 'Kelas'}). Masukkan No. HP yang terdaftar untuk membuka akun ini.
                    </div>
                  </div>
                )}

                {classes.length === 0 ? (
                  <div className="bg-amber-50 border border-amber-200 text-amber-800 p-3.5 rounded-xl text-xs">
                    <span className="font-semibold block mb-1">Belum Ada Kelas Terdaftar</span>
                    {isStudentCloudSynced
                      ? 'Guru belum menambahkan rombel kelas atau mengunggah data siswa ke Database Cloud.'
                      : 'Daftar kelas belum tersedia di browser ini. Aktifkan sinkron otomatis atau hubungkan Google di bawah jika guru membagikan data lewat Cloud.'}
                  </div>
                ) : !linkedStudent ? (
                  <>
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
                        Belum ada siswa terdaftar di {classes.find((c) => c.id === effectiveClassId)?.name || 'kelas ini'}.
                      </div>
                    ) : (
                      <div>
                        <label className="block text-xs font-medium text-slate-700 mb-1">
                          Pilih Nama Siswa ({classStudents.length} siswa terdaftar)
                        </label>
                        <select
                          value={effectiveStudentId}
                          onChange={(e) => {
                            const nextId = e.target.value;
                            setSelectedStudentId(nextId);
                            resetForStudentSelection(nextId);
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
                    )}
                  </>
                ) : null}

                {effectiveStudentObj && !effectiveStudentHasPhone && (
                  <div className="text-[11px] text-amber-900 bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <span>
                      No. HP untuk siswa <strong>{effectiveStudentObj.name}</strong> belum didaftarkan oleh guru. Hubungi guru untuk mengisi No. HP Anda agar dapat login.
                    </span>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Verifikasi No. HP / WhatsApp Anda (Wajib Sesuai Data Terdaftar)
                  </label>
                  <div className="relative">
                    <input
                      type="tel"
                      required
                      value={studentWhatsapp}
                      onChange={(e) => {
                        const val = e.target.value;
                        setStudentWhatsapp(val);
                        setStudentWaError('');
                        saveStudentDraft(effectiveClassId, effectiveStudentId, val);
                      }}
                      placeholder="Masukkan No. HP Anda (contoh: 081234567890)"
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
                    <p className="text-[11px] text-slate-500 mt-1 flex items-center gap-1">
                      <Lock className="w-3 h-3 text-slate-400 shrink-0" />
                      <span>Akun terkunci per siswa: hanya dapat dibuka dengan No. HP pemilik akun yang terdaftar.</span>
                    </p>
                  )}
                </div>

                {/* Primary Student Enter Button - No Google Required */}
                <div className="space-y-2 pt-1">
                  <button
                    type="submit"
                    disabled={
                      isVerifyingStudent ||
                      classes.length === 0 ||
                      classStudents.length === 0 ||
                      !effectiveStudentId
                    }
                    className={`w-full flex items-center justify-center gap-2 py-2.5 text-xs font-semibold text-white rounded-xl transition-colors shadow-xs ${
                      isVerifyingStudent || classes.length === 0 || classStudents.length === 0 || !effectiveStudentId
                        ? 'bg-slate-300 cursor-not-allowed'
                        : 'bg-emerald-700 hover:bg-emerald-800'
                    }`}
                  >
                    {isVerifyingStudent ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Memverifikasi No. HP...</span>
                      </>
                    ) : (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        <span>Verifikasi &amp; Masuk Ruang Belajar</span>
                      </>
                    )}
                  </button>

                  <p className="text-[11px] text-slate-400 text-center">
                    Pastikan nama dan No. HP Anda sesuai data kelas agar tidak membuka akun siswa lain.
                  </p>
                </div>

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
                          onClick={() => void handleStudentGoogleRedirect()}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg transition-colors"
                        >
                          <LogIn className="w-3.5 h-3.5" />
                          <span>Hubungkan Google Tanpa Pop-up (Redirect)</span>
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {!isCloudConnected && (
                  <div className="pt-2 border-t border-slate-100 space-y-2">
                    <div className="text-[11px] text-slate-500 leading-relaxed">
                      <span className="font-semibold text-slate-700">Akun Google Siswa (Opsional):</span>{' '}
                      {isStudentCloudSynced
                        ? 'Sinkronisasi ke Cloud Guru sudah berjalan otomatis. Hubungkan Google hanya jika ingin mengikat riwayat nilai permanen saat berpindah HP.'
                        : 'Tidak wajib. Hubungkan Google hanya jika ingin mengambil daftar kelas/materi terbaru dari HP lain atau mengirim tugas langsung ke Dashboard Guru.'}
                    </div>

                    <div className="flex flex-col sm:flex-row gap-2">
                      <button
                        type="button"
                        disabled={isGoogleLoading}
                        onClick={handleStudentGoogleConnect}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 text-[11px] font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 disabled:opacity-60 rounded-xl transition-colors"
                      >
                        {isGoogleLoading ? (
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

                      {!isInIframe && (
                        <button
                          type="button"
                          disabled={isGoogleLoading}
                          onClick={() => void handleStudentGoogleRedirect()}
                          className="flex items-center justify-center gap-1.5 py-2 px-3 text-[11px] font-medium text-slate-600 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl transition-colors"
                        >
                          <LogIn className="w-3.5 h-3.5" />
                          <span>Alternatif Redirect</span>
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </form>
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
