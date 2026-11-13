import React, { useState, useEffect } from 'react';
import { useLMS } from '../../context/LMSContext';
import { UploadStudentsModal } from './UploadStudentsModal';
import {
  X,
  Plus,
  Trash2,
  Upload,
  Download,
  RefreshCw,
  ShieldCheck,
  Check,
  CloudUpload,
  AlertCircle,
  Loader2,
  Mail,
  Lock,
  Users,
  Database,
  UserCog,
  Pencil,
  Cloud,
} from 'lucide-react';

interface TeacherProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenDeployGuide?: () => void;
}

type AdminSectionTab = 'profil' | 'rombel' | 'cloud';

export const TeacherProfileModal: React.FC<TeacherProfileModalProps> = ({
  isOpen,
  onClose,
  onOpenDeployGuide,
}) => {
  const {
    teacher,
    updateTeacher,
    classes,
    addClass,
    updateClass,
    deleteClass,
    deleteAllClasses,
    students,
    materials,
    tasks,
    submissions,
    attendance,
    questionSets,
    addStudent,
    exportBackup,
    importBackup,
    syncLocalDataToCloud,
    resetCloudDatabase,
    firebaseUser,
    isCloudConnected,
    isCloudAdmin,
    authSession,
  } = useLMS();

  const [adminTab, setAdminTab] = useState<AdminSectionTab>('profil');

  // Teacher profile state
  const [teacherName, setTeacherName] = useState(teacher.name);
  const [teacherSubject, setTeacherSubject] = useState(teacher.subject || '');
  const [nip, setNip] = useState(teacher.nip || '');
  const [kktp, setKktp] = useState(String(teacher.kktp || 75));
  const [profileSaved, setProfileSaved] = useState(false);

  // Class management state
  const [newClassName, setNewClassName] = useState('');
  const [newClassSubject, setNewClassSubject] = useState('');
  const [editingClassId, setEditingClassId] = useState<string | null>(null);
  const [editingClassName, setEditingClassName] = useState('');
  const [editingClassSubject, setEditingClassSubject] = useState('');
  const [confirmDeleteAll, setConfirmDeleteAll] = useState(false);
  const [confirmDeleteClassId, setConfirmDeleteClassId] = useState<string | null>(null);

  // Single student quick-add state
  const [selectedClassForStudent, setSelectedClassForStudent] = useState(classes[0]?.id || '');
  const [newStudentName, setNewStudentName] = useState('');
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);

  // Cloud & backup sync state
  const [isSyncingCloud, setIsSyncingCloud] = useState(false);
  const [isResettingCloud, setIsResettingCloud] = useState(false);
  const [confirmResetCloud, setConfirmResetCloud] = useState(false);
  const [cloudSyncStatus, setCloudSyncStatus] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  useEffect(() => {
    if (isOpen) {
      setTeacherName(teacher.name);
      setTeacherSubject(teacher.subject || '');
      setNip(teacher.nip || '');
      setKktp(String(teacher.kktp || 75));
      setConfirmDeleteAll(false);
      setConfirmDeleteClassId(null);
      setConfirmResetCloud(false);
      setEditingClassId(null);
      setCloudSyncStatus(null);
      if (classes.length > 0 && !classes.some((c) => c.id === selectedClassForStudent)) {
        setSelectedClassForStudent(classes[0].id);
      }
    }
  }, [isOpen, teacher.name, teacher.subject, teacher.nip, teacher.kktp, classes, selectedClassForStudent]);

  if (!isOpen || authSession?.role !== 'teacher' || !isCloudAdmin || !isCloudConnected) {
    return null;
  }

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    if (!teacherName.trim()) return;
    const cleanedSubject = teacherSubject.trim() || 'Mata Pelajaran';
    setTeacherSubject(cleanedSubject);
    updateTeacher({
      name: teacherName.trim(),
      subject: cleanedSubject,
      nip: nip.trim() || undefined,
      kktp: parseInt(kktp, 10) || 75,
    });
    setProfileSaved(true);
    setTimeout(() => setProfileSaved(false), 2500);
  };

  const handleAddClass = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClassName.trim()) return;
    addClass(newClassName, newClassSubject.trim() || undefined);
    setNewClassName('');
    setNewClassSubject('');
  };

  const handleSaveClassRename = (classId: string) => {
    if (!editingClassName.trim()) return;
    updateClass(classId, {
      name: editingClassName.trim(),
      subject: editingClassSubject.trim(),
    });
    setEditingClassId(null);
    setEditingClassName('');
    setEditingClassSubject('');
  };

  const handleAddStudent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStudentName.trim() || !selectedClassForStudent) return;
    addStudent(newStudentName, selectedClassForStudent);
    setNewStudentName('');
  };

  const handleRestoreFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const content = event.target?.result as string;
      if (!content) return;
      setCloudSyncStatus(null);
      setIsSyncingCloud(true);
      try {
        const res = await importBackup(content);
        setCloudSyncStatus({
          type: res.ok ? 'success' : 'error',
          text: res.message,
        });
      } finally {
        setIsSyncingCloud(false);
      }
    };
    reader.readAsText(file);
  };

  const handleSyncLocalToCloud = async () => {
    setCloudSyncStatus(null);
    setIsSyncingCloud(true);
    try {
      const res = await syncLocalDataToCloud();
      setCloudSyncStatus({
        type: res.ok ? 'success' : 'error',
        text: res.message,
      });
    } finally {
      setIsSyncingCloud(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-3 sm:p-4 backdrop-blur-xs">
        <div className="bg-white rounded-xl max-w-xl w-full border border-slate-200 shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 max-h-[92vh] flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-slate-100 shrink-0">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-700 flex items-center justify-center font-bold shrink-0">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-1.5">
                  <h3 className="text-sm sm:text-base font-semibold text-slate-900">
                    Menu Admin &amp; Pengaturan Guru
                  </h3>
                  <span className="text-[10px] font-semibold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full">
                    Google Cloud Aktif
                  </span>
                </div>
                <p className="text-[11px] sm:text-xs text-slate-500 truncate">
                  Identitas guru, rombel kelas, siswa &amp; sinkronisasi database
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 shrink-0"
              title="Tutup Menu Admin"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Sub-Tab Navigation */}
          <div className="grid grid-cols-3 p-1.5 bg-slate-100 border-b border-slate-200 shrink-0 gap-1">
            <button
              type="button"
              onClick={() => setAdminTab('profil')}
              className={`flex items-center justify-center gap-1.5 py-2 px-2 text-xs font-semibold rounded-lg transition-all ${
                adminTab === 'profil'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <UserCog className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
              <span className="truncate">Profil &amp; Akses</span>
            </button>

            <button
              type="button"
              onClick={() => setAdminTab('rombel')}
              className={`flex items-center justify-center gap-1.5 py-2 px-2 text-xs font-semibold rounded-lg transition-all ${
                adminTab === 'rombel'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Users className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
              <span className="truncate">Rombel &amp; Siswa</span>
            </button>

            <button
              type="button"
              onClick={() => setAdminTab('cloud')}
              className={`flex items-center justify-center gap-1.5 py-2 px-2 text-xs font-semibold rounded-lg transition-all ${
                adminTab === 'cloud'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Database className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <span className="truncate">Cloud &amp; Backup</span>
            </button>
          </div>

          {/* Modal Body */}
          <div className="p-4 sm:p-6 space-y-5 overflow-y-auto flex-1 text-xs">
            {/* TAB 1: Profil Guru & Keamanan Akses */}
            {adminTab === 'profil' && (
              <div className="space-y-5">
                {/* Verified Admin Account & Role Lock Card */}
                <div className="rounded-xl bg-indigo-50/70 border border-indigo-100 p-3.5 space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0 text-indigo-950">
                      <Mail className="w-4 h-4 text-indigo-600 shrink-0" />
                      <span className="text-xs truncate">
                        Admin Google: <strong>{firebaseUser?.email}</strong>
                      </span>
                    </div>
                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 shrink-0">
                      <Check className="w-3 h-3" /> Terverifikasi
                    </span>
                  </div>
                  <div className="flex items-start gap-2 text-[11px] text-indigo-900/80 pt-0.5">
                    <Lock className="w-3.5 h-3.5 text-indigo-600 shrink-0 mt-0.5" />
                    <span>
                      <strong>Akses Terkunci Otomatis:</strong> Hanya akun Google Guru/Admin terdaftar yang dapat membuka ruang ini. Akun siswa otomatis diblokir dari menu Guru &amp; Admin.
                    </span>
                  </div>
                </div>

                {/* Teacher Identity Form */}
                <form onSubmit={handleSaveProfile} className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h4 className="font-semibold text-slate-900 uppercase tracking-wider">
                      Identitas Guru &amp; Mata Pelajaran
                    </h4>
                    {profileSaved && (
                      <span className="text-emerald-700 font-medium flex items-center gap-1">
                        <Check className="w-3.5 h-3.5" /> Tersimpan ke Cloud!
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block font-medium text-slate-700 mb-1">
                        Nama Lengkap &amp; Gelar
                      </label>
                      <input
                        type="text"
                        required
                        value={teacherName}
                        onChange={(e) => setTeacherName(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-indigo-500 text-xs"
                      />
                    </div>
                    <div>
                      <label className="block font-medium text-slate-700 mb-1">
                        NIP Guru (Opsional)
                      </label>
                      <input
                        type="text"
                        value={nip}
                        onChange={(e) => setNip(e.target.value)}
                        placeholder="19850101..."
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-indigo-500 text-xs font-mono"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block font-medium text-slate-700 mb-1">
                        Mata Pelajaran Utama (Bawaan)
                      </label>
                      <input
                        type="text"
                        value={teacherSubject}
                        onChange={(e) => setTeacherSubject(e.target.value)}
                        placeholder="Misal: Biologi, Matematika, dll."
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-indigo-500 text-xs"
                      />
                      <p className="text-[10px] text-slate-500 mt-1">
                        Untuk memisahkan mapel per kelas agar tidak membingungkan siswa, atur Mapel tiap kelas di tab <strong>Rombel &amp; Siswa</strong>.
                      </p>
                    </div>
                    <div>
                      <label className="block font-medium text-slate-700 mb-1">
                        Standar KKTP (Nilai Tuntas)
                      </label>
                      <input
                        type="number"
                        min="50"
                        max="100"
                        required
                        value={kktp}
                        onChange={(e) => setKktp(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-indigo-500 text-xs font-mono"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="w-full sm:w-auto font-semibold px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg transition-colors cursor-pointer"
                  >
                    Simpan Perubahan Identitas Guru
                  </button>
                </form>

                {/* Deploy & Vercel Domain Shortcut (handy on mobile too) */}
                {onOpenDeployGuide && (
                  <div className="pt-4 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                    <div>
                      <h5 className="font-semibold text-slate-900">Hosting &amp; Domain Vercel</h5>
                      <p className="text-[11px] text-slate-500">
                        Panduan Authorized Domains Firebase &amp; Environment Variable Vercel.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        onOpenDeployGuide();
                      }}
                      className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-lg transition-colors shrink-0"
                    >
                      <Cloud className="w-3.5 h-3.5" />
                      <span>Buka Panduan Vercel</span>
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* TAB 2: Manage Classes & Students */}
            {adminTab === 'rombel' && (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h4 className="font-semibold text-slate-900 uppercase tracking-wider">
                      Kelola Rombel &amp; Upload Siswa
                    </h4>
                    <p className="text-slate-500 text-[11px]">
                      Total {students.length} siswa di {classes.length} rombel kelas
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {classes.length > 0 &&
                      (confirmDeleteAll ? (
                        <div className="inline-flex items-center gap-1.5 bg-rose-50 border border-rose-200 px-2.5 py-1 rounded-lg">
                          <span className="text-[11px] font-medium text-rose-900">Hapus semua?</span>
                          <button
                            type="button"
                            onClick={() => {
                              deleteAllClasses();
                              setConfirmDeleteAll(false);
                            }}
                            className="text-[11px] font-semibold px-2 py-0.5 bg-rose-600 hover:bg-rose-700 text-white rounded"
                          >
                            Ya
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteAll(false)}
                            className="text-[11px] font-medium px-2 py-0.5 text-slate-700 hover:bg-rose-100 rounded"
                          >
                            Batal
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteAll(true)}
                          className="inline-flex items-center gap-1 font-medium text-[11px] px-2.5 py-1.5 text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg transition-colors"
                          title="Kosongkan seluruh kelas dan data siswa"
                        >
                          <Trash2 className="w-3 h-3" />
                          <span>Hapus Semua</span>
                        </button>
                      ))}

                    <button
                      type="button"
                      onClick={() => setIsUploadModalOpen(true)}
                      className="inline-flex items-center gap-1.5 font-semibold px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg shadow-xs transition-colors"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      <span>Upload Siswa (CSV/Excel)</span>
                    </button>
                  </div>
                </div>

                {/* Add Class Form */}
                <form onSubmit={handleAddClass} className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                  <input
                    type="text"
                    placeholder="Nama Rombel Baru (misal: Kelas XI-1)"
                    value={newClassName}
                    onChange={(e) => setNewClassName(e.target.value)}
                    className="sm:col-span-5 px-3 py-2 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-indigo-500 text-xs"
                  />
                  <input
                    type="text"
                    placeholder="Mata Pelajaran kelas ini (cth: Biologi)"
                    value={newClassSubject}
                    onChange={(e) => setNewClassSubject(e.target.value)}
                    className="sm:col-span-4 px-3 py-2 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-indigo-500 text-xs"
                  />
                  <button
                    type="submit"
                    className="sm:col-span-3 inline-flex items-center justify-center gap-1 font-medium px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg transition-colors shrink-0"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Tambah Rombel</span>
                  </button>
                </form>

                {/* Class List with Rename, Per-Class Subject & Inline Delete */}
                {classes.length === 0 ? (
                  <div className="py-5 px-3 text-center bg-slate-50 border border-dashed border-slate-300 rounded-lg text-slate-500 text-xs">
                    Belum ada rombel kelas yang terdaftar. Silakan masukkan nama rombel baru di atas atau gunakan tombol <strong>Upload Siswa</strong>.
                  </div>
                ) : (
                  <div className="space-y-1.5 max-h-56 overflow-y-auto">
                    {classes.map((cls) => {
                      const count = students.filter((s) => s.classId === cls.id).length;
                      const isConfirming = confirmDeleteClassId === cls.id;
                      const isEditing = editingClassId === cls.id;
                      return (
                        <div
                          key={cls.id}
                          className="flex items-center justify-between gap-2 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg"
                        >
                          {isEditing ? (
                            <div className="flex flex-col sm:flex-row sm:items-center gap-1.5 flex-1">
                              <input
                                type="text"
                                value={editingClassName}
                                onChange={(e) => setEditingClassName(e.target.value)}
                                placeholder="Nama Kelas"
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    e.preventDefault();
                                    handleSaveClassRename(cls.id);
                                  } else if (e.key === 'Escape') {
                                    setEditingClassId(null);
                                  }
                                }}
                                className="flex-1 px-2.5 py-1 border border-indigo-300 rounded bg-white text-xs focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
                                autoFocus
                              />
                              <input
                                type="text"
                                value={editingClassSubject}
                                onChange={(e) => setEditingClassSubject(e.target.value)}
                                placeholder="Mapel kelas ini"
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    e.preventDefault();
                                    handleSaveClassRename(cls.id);
                                  } else if (e.key === 'Escape') {
                                    setEditingClassId(null);
                                  }
                                }}
                                className="flex-1 px-2.5 py-1 border border-indigo-300 rounded bg-white text-xs focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
                              />
                              <div className="flex items-center gap-1 shrink-0">
                                <button
                                  type="button"
                                  onClick={() => handleSaveClassRename(cls.id)}
                                  className="text-[11px] font-semibold px-2.5 py-1 bg-indigo-600 text-white rounded"
                                >
                                  Simpan
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setEditingClassId(null)}
                                  className="text-[11px] px-2 py-1 text-slate-600 hover:bg-slate-200 rounded"
                                >
                                  Batal
                                </button>
                              </div>
                            </div>
                          ) : (
                            <>
                              <div className="min-w-0 flex flex-wrap items-center gap-1.5">
                                <span className="font-semibold text-slate-800">{cls.name}</span>
                                {cls.subject?.trim() ? (
                                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200">
                                    {cls.subject.trim()}
                                  </span>
                                ) : (
                                  <span className="text-[10px] text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                                    Mapel belum diatur
                                  </span>
                                )}
                                <span className="text-slate-500">({count} siswa)</span>
                              </div>
                              {isConfirming ? (
                                <div className="inline-flex items-center gap-1.5 shrink-0">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      deleteClass(cls.id);
                                      setConfirmDeleteClassId(null);
                                    }}
                                    className="text-[11px] font-semibold px-2 py-0.5 bg-rose-600 hover:bg-rose-700 text-white rounded"
                                  >
                                    Hapus
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setConfirmDeleteClassId(null)}
                                    className="text-[11px] px-2 py-0.5 text-slate-600 hover:bg-slate-200 rounded"
                                  >
                                    Batal
                                  </button>
                                </div>
                              ) : (
                                <div className="inline-flex items-center gap-1 shrink-0">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setEditingClassId(cls.id);
                                      setEditingClassName(cls.name);
                                      setEditingClassSubject(cls.subject || '');
                                      setConfirmDeleteClassId(null);
                                    }}
                                    className="text-slate-500 hover:text-indigo-700 hover:bg-indigo-50 p-1.5 rounded-md transition-colors"
                                    title={`Ubah nama & mapel kelas ${cls.name}`}
                                  >
                                    <Pencil className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setConfirmDeleteClassId(cls.id);
                                      setEditingClassId(null);
                                    }}
                                    className="text-rose-500 hover:text-rose-700 hover:bg-rose-50 p-1.5 rounded-md transition-colors"
                                    title={`Hapus kelas ${cls.name}`}
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Quick Add Single Student */}
                <div className="pt-3 border-t border-slate-200">
                  <span className="block font-medium text-slate-700 mb-1.5">
                    Tambah Siswa Manual (Satu per Satu):
                  </span>
                  {classes.length === 0 ? (
                    <p className="text-slate-400 italic text-[11px]">
                      Tambahkan minimal 1 kelas rombel terlebih dahulu di atas sebelum menambah siswa.
                    </p>
                  ) : (
                    <form onSubmit={handleAddStudent} className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <select
                        value={selectedClassForStudent || classes[0]?.id || ''}
                        onChange={(e) => setSelectedClassForStudent(e.target.value)}
                        className="px-2.5 py-2 sm:py-1.5 border border-slate-300 rounded-lg bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500 text-xs"
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
                        className="px-3 py-2 sm:py-1.5 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-indigo-500 text-xs"
                      />
                      <button
                        type="submit"
                        className="font-medium py-2 sm:py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors text-xs"
                      >
                        + Simpan Siswa
                      </button>
                    </form>
                  )}
                </div>
              </div>
            )}

            {/* TAB 3: Cloud Sync & JSON Backup / Restore */}
            {adminTab === 'cloud' && (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h4 className="font-semibold text-slate-900 uppercase tracking-wider">
                    Database Cloud &amp; Cadangan Data
                  </h4>
                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                    <Check className="w-3 h-3" /> Cloud Firestore Tersinkron
                  </span>
                </div>

                {/* Live Cloud Data Summary */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 text-center">
                    <div className="text-base font-bold text-slate-900 font-mono">{classes.length}</div>
                    <div className="text-[11px] text-slate-500">Rombel Kelas</div>
                  </div>
                  <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 text-center">
                    <div className="text-base font-bold text-slate-900 font-mono">{students.length}</div>
                    <div className="text-[11px] text-slate-500">Siswa</div>
                  </div>
                  <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 text-center">
                    <div className="text-base font-bold text-slate-900 font-mono">{materials.length}</div>
                    <div className="text-[11px] text-slate-500">Materi</div>
                  </div>
                  <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 text-center">
                    <div className="text-base font-bold text-slate-900 font-mono">{tasks.length}</div>
                    <div className="text-[11px] text-slate-500">Tugas</div>
                  </div>
                </div>

                <div className="text-[11px] text-slate-500 flex flex-wrap gap-x-4 gap-y-1 px-1">
                  <span>Jawaban Siswa: <strong className="text-slate-800 font-mono">{submissions.length}</strong></span>
                  <span>Presensi Pertemuan: <strong className="text-slate-800 font-mono">{attendance.length}</strong></span>
                  <span>Paket Soal AI: <strong className="text-slate-800 font-mono">{questionSets.length}</strong></span>
                </div>

                <p className="text-slate-600 text-[11px] leading-relaxed">
                  Semua perubahan materi, tugas, absensi, soal AI, dan nilai tersimpan real-time di Database Cloud sehingga otomatis sama di Laptop, HP Guru, maupun HP Siswa.
                </p>

                <div className="flex flex-col sm:flex-row sm:flex-wrap gap-2.5">
                  <button
                    type="button"
                    disabled={isSyncingCloud || isResettingCloud}
                    onClick={handleSyncLocalToCloud}
                    className="inline-flex items-center justify-center gap-1.5 font-semibold px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 disabled:text-slate-500 text-white rounded-lg transition-colors cursor-pointer"
                  >
                    {isSyncingCloud ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <CloudUpload className="w-3.5 h-3.5" />
                    )}
                    <span>
                      {isSyncingCloud ? 'Mengunggah ke Cloud...' : 'Unggah Data Lokal Browser ke Cloud'}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={exportBackup}
                    className="inline-flex items-center justify-center gap-1.5 font-medium px-3.5 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-lg transition-colors cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Unduh Cadangan (JSON)</span>
                  </button>

                  <label
                    className={`inline-flex items-center justify-center gap-1.5 font-medium px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 rounded-lg transition-colors ${
                      isSyncingCloud || isResettingCloud ? 'opacity-60 pointer-events-none' : 'cursor-pointer'
                    }`}
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isSyncingCloud ? 'animate-spin' : ''}`} />
                    <span>Pulihkan File JSON ke Cloud</span>
                    <input
                      type="file"
                      accept=".json"
                      disabled={isSyncingCloud || isResettingCloud}
                      onChange={handleRestoreFile}
                      className="hidden"
                    />
                  </label>
                </div>

                {cloudSyncStatus && (
                  <div
                    className={`flex items-start gap-2 p-2.5 rounded-lg border text-[11px] leading-relaxed ${
                      cloudSyncStatus.type === 'success'
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                        : 'bg-rose-50 border-rose-200 text-rose-900'
                    }`}
                  >
                    {cloudSyncStatus.type === 'success' ? (
                      <Check className="w-4 h-4 shrink-0 text-emerald-600 mt-0.5" />
                    ) : (
                      <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
                    )}
                    <span>{cloudSyncStatus.text}</span>
                  </div>
                )}

                {/* Reset & Kosongkan Database Cloud */}
                <div className="pt-4 border-t border-rose-200/80 space-y-2.5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 p-3.5 rounded-xl bg-rose-50/70 border border-rose-200">
                    <div className="space-y-0.5">
                      <h5 className="font-semibold text-rose-950 flex items-center gap-1.5">
                        <Trash2 className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                        <span>Reset &amp; Kosongkan Database Cloud</span>
                      </h5>
                      <p className="text-[11px] text-rose-900/80 leading-relaxed">
                        Menghapus seluruh rombel kelas, siswa, materi, tugas, jawaban, absensi, dan soal AI di Firestore Cloud hingga menjadi 0 (kosong bersih). Identitas guru &amp; akses admin tetap terjaga.
                      </p>
                    </div>

                    {!confirmResetCloud && (
                      <button
                        type="button"
                        disabled={isSyncingCloud || isResettingCloud}
                        onClick={() => {
                          setConfirmResetCloud(true);
                          setCloudSyncStatus(null);
                        }}
                        className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 disabled:bg-rose-300 rounded-lg transition-colors shrink-0 self-start sm:self-center"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Reset Data Cloud</span>
                      </button>
                    )}
                  </div>

                  {confirmResetCloud && (
                    <div className="p-3.5 rounded-xl bg-rose-100/80 border border-rose-300 space-y-2.5 text-xs text-rose-950">
                      <div className="flex items-start gap-2">
                        <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                        <span className="leading-relaxed">
                          <strong>Konfirmasi Pengosongan Total Cloud:</strong> Semua kelas, data siswa, materi, tugas, nilai, absensi, dan paket soal AI di Cloud akan dihapus permanen menjadi kosong. Unduh Cadangan (JSON) terlebih dahulu bila masih diperlukan.
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          disabled={isResettingCloud}
                          onClick={async () => {
                            setIsResettingCloud(true);
                            setCloudSyncStatus(null);
                            try {
                              const res = await resetCloudDatabase();
                              setCloudSyncStatus({
                                type: res.ok ? 'success' : 'error',
                                text: res.message,
                              });
                              setConfirmResetCloud(false);
                            } finally {
                              setIsResettingCloud(false);
                            }
                          }}
                          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 font-semibold text-white bg-rose-600 hover:bg-rose-700 disabled:bg-rose-400 rounded-lg transition-colors"
                        >
                          {isResettingCloud ? (
                            <>
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              <span>Mengosongkan Cloud...</span>
                            </>
                          ) : (
                            <span>Ya, Kosongkan Cloud Sekarang</span>
                          )}
                        </button>
                        <button
                          type="button"
                          disabled={isResettingCloud}
                          onClick={() => setConfirmResetCloud(false)}
                          className="px-3.5 py-1.5 font-medium text-slate-700 bg-white hover:bg-slate-100 border border-slate-300 rounded-lg transition-colors"
                        >
                          Batal
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                <p className="text-[11px] text-slate-500 bg-slate-50 border border-slate-200/80 rounded-lg px-3 py-2 leading-relaxed">
                  <strong>Catatan Migrasi:</strong> Gunakan tombol <strong>Unduh Cadangan (JSON)</strong> untuk arsip offline atau memindahkan data lama dari browser/perangkat lain lewat <strong>Pulihkan File JSON ke Cloud</strong>.
                </p>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 border-t border-slate-100 bg-slate-50 shrink-0">
            <span className="text-[11px] text-slate-500 truncate">
              Hak Akses: Guru &amp; Administrator Mapel
            </span>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors shrink-0"
            >
              Tutup Panel
            </button>
          </div>
        </div>
      </div>

      <UploadStudentsModal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        defaultClassId={selectedClassForStudent}
      />
    </>
  );
};
