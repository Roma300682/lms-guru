import React, { useState } from 'react';
import { useLMS } from '../../context/LMSContext';
import { UploadStudentsModal } from './UploadStudentsModal';
import { X, Plus, Trash2, Upload, Download, RefreshCw, ShieldCheck, Check, CloudUpload, AlertCircle, Loader2 } from 'lucide-react';

interface TeacherProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const TeacherProfileModal: React.FC<TeacherProfileModalProps> = ({ isOpen, onClose }) => {
  const {
    teacher,
    updateTeacher,
    classes,
    addClass,
    deleteClass,
    deleteAllClasses,
    students,
    addStudent,
    deleteStudent,
    exportBackup,
    importBackup,
    syncLocalDataToCloud,
    isCloudConnected,
    isCloudAdmin,
  } = useLMS();

  const [teacherName, setTeacherName] = useState(teacher.name);
  const [subject, setSubject] = useState(teacher.subject);
  const [pin, setPin] = useState(teacher.pin || '1234');
  const [nip, setNip] = useState(teacher.nip || '');
  const [kktp, setKktp] = useState(String(teacher.kktp || 75));
  const [recoveryQuestion, setRecoveryQuestion] = useState(
    teacher.recoveryQuestion || 'Mata pelajaran apa yang Anda ampu?'
  );
  const [recoveryAnswer, setRecoveryAnswer] = useState(
    teacher.recoveryAnswer || 'Biologi'
  );
  const [profileSaved, setProfileSaved] = useState(false);

  // New Class Input
  const [newClassName, setNewClassName] = useState('');

  // Selected Class for adding student
  const [selectedClassForStudent, setSelectedClassForStudent] = useState(classes[0]?.id || '');
  const [newStudentName, setNewStudentName] = useState('');

  // Upload students modal
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);

  // Cloud & backup sync state
  const [isSyncingCloud, setIsSyncingCloud] = useState(false);
  const [cloudSyncStatus, setCloudSyncStatus] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  if (!isOpen) return null;

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    if (!teacherName.trim() || !subject.trim() || !pin.trim()) return;
    updateTeacher({
      name: teacherName.trim(),
      subject: subject.trim(),
      pin: pin.trim(),
      nip: nip.trim() || undefined,
      kktp: parseInt(kktp) || 75,
      recoveryQuestion: recoveryQuestion.trim(),
      recoveryAnswer: recoveryAnswer.trim(),
    });
    setProfileSaved(true);
    setTimeout(() => setProfileSaved(false), 2500);
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
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs">
        <div className="bg-white rounded-xl max-w-xl w-full border border-slate-200 shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 shrink-0">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-700 flex items-center justify-center font-bold">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-semibold text-slate-900">
                    Panel Guru & Administrator
                  </h3>
                  <span className="text-[10px] font-semibold bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded-full uppercase">
                    Admin LMS
                  </span>
                </div>
                <p className="text-xs text-slate-500">
                  Kelola mata pelajaran, PIN admin, kelas rombel, dan data siswa
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Modal Body */}
          <div className="p-6 space-y-6 overflow-y-auto flex-1 text-xs">
            {/* Section 1: Teacher & Admin Credentials */}
            <form onSubmit={handleSaveProfile} className="space-y-3 pb-5 border-b border-slate-200">
              <div className="flex items-center justify-between">
                <h4 className="font-semibold text-slate-900 uppercase tracking-wider">
                  Identitas Guru & Keamanan Admin
                </h4>
                {profileSaved && (
                  <span className="text-emerald-700 font-medium flex items-center gap-1">
                    <Check className="w-3.5 h-3.5" /> Tersimpan!
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">
                    Nama Lengkap & Gelar
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
                    Mata Pelajaran
                  </label>
                  <input
                    type="text"
                    required
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="Misal: Biologi, Matematika, dll."
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-indigo-500 text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
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

                <div>
                  <label className="block font-medium text-slate-700 mb-1">
                    PIN Keamanan Guru/Admin
                  </label>
                  <input
                    type="text"
                    maxLength={10}
                    required
                    value={pin}
                    onChange={(e) => setPin(e.target.value)}
                    placeholder="PIN login"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-indigo-500 text-xs font-mono font-semibold"
                  />
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

              {/* Recovery Question & Answer for Forgot PIN */}
              <div className="bg-amber-50/60 p-3 rounded-lg border border-amber-200/70 space-y-2">
                <span className="block font-semibold text-amber-900 text-[11px]">
                  Pemulihan Keamanan (Jika Guru/Admin Lupa PIN):
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] font-medium text-slate-700 mb-0.5">
                      Pertanyaan Pemulihan
                    </label>
                    <input
                      type="text"
                      required
                      value={recoveryQuestion}
                      onChange={(e) => setRecoveryQuestion(e.target.value)}
                      placeholder="Contoh: Nama hewan peliharaan pertama?"
                      className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white focus:outline-hidden focus:ring-2 focus:ring-amber-500 text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-slate-700 mb-0.5">
                      Jawaban Pemulihan
                    </label>
                    <input
                      type="text"
                      required
                      value={recoveryAnswer}
                      onChange={(e) => setRecoveryAnswer(e.target.value)}
                      placeholder="Jawaban rahasia Anda"
                      className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white focus:outline-hidden focus:ring-2 focus:ring-amber-500 text-xs"
                    />
                  </div>
                </div>
              </div>

              <button
                type="submit"
                className="font-semibold px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg transition-colors"
              >
                Simpan Perubahan Identitas & PIN
              </button>
            </form>

            {/* Section 2: Manage Classes and Batch Upload */}
            <div className="space-y-3 pb-5 border-b border-slate-200">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-semibold text-slate-900 uppercase tracking-wider">
                    Kelola Rombel & Upload Siswa
                  </h4>
                  <p className="text-slate-500 text-[11px]">
                    Total {students.length} siswa di {classes.length} rombel kelas
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  {classes.length > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        if (
                          confirm(
                            'PERINGATAN: Apakah Anda yakin ingin MENGHAPUS SEMUA KELAS? Seluruh siswa dan data nilai/presensi di semua kelas akan dikosongkan.'
                          )
                        ) {
                          deleteAllClasses();
                        }
                      }}
                      className="inline-flex items-center gap-1 font-medium text-[11px] px-2.5 py-1.5 text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg transition-colors"
                      title="Kosongkan seluruh kelas dan data siswa"
                    >
                      <Trash2 className="w-3 h-3" />
                      <span>Hapus Semua Kelas</span>
                    </button>
                  )}

                  {/* Primary Student Upload Trigger */}
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
              <form onSubmit={handleAddClass} className="flex gap-2">
                <input
                  type="text"
                  placeholder="Nama Rombel Baru (misal: Kelas XI-1)"
                  value={newClassName}
                  onChange={(e) => setNewClassName(e.target.value)}
                  className="flex-1 px-3 py-2 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-indigo-500 text-xs"
                />
                <button
                  type="submit"
                  className="inline-flex items-center gap-1 font-medium px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Tambah Rombel</span>
                </button>
              </form>

              {/* Class List */}
              {classes.length === 0 ? (
                <div className="py-4 px-3 text-center bg-slate-50 border border-dashed border-slate-300 rounded-lg text-slate-500 text-xs">
                  Belum ada rombel kelas yang terdaftar. Silakan masukkan nama rombel baru di atas atau gunakan tombol <strong>Upload Siswa</strong>.
                </div>
              ) : (
                <div className="space-y-1.5 max-h-40 overflow-y-auto">
                  {classes.map((cls) => {
                    const count = students.filter((s) => s.classId === cls.id).length;
                    return (
                      <div
                        key={cls.id}
                        className="flex items-center justify-between px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg"
                      >
                        <div>
                          <span className="font-semibold text-slate-800">{cls.name}</span>
                          <span className="text-slate-500 ml-2">({count} siswa)</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            if (
                              confirm(
                                `Hapus kelas "${cls.name}"? Semua data siswa, nilai, dan presensi di rombel ini akan dihapus.`
                              )
                            ) {
                              deleteClass(cls.id);
                            }
                          }}
                          className="text-rose-500 hover:text-rose-700 hover:bg-rose-50 p-1.5 rounded-md transition-colors"
                          title={`Hapus kelas ${cls.name}`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Quick Add Single Student */}
              <div className="pt-2">
                <span className="block font-medium text-slate-600 mb-1.5">
                  Tambah Siswa Manual (Satu per Satu):
                </span>
                {classes.length === 0 ? (
                  <p className="text-slate-400 italic text-[11px]">
                    Tambahkan minimal 1 kelas rombel terlebih dahulu di atas sebelum menambah siswa.
                  </p>
                ) : (
                  <form onSubmit={handleAddStudent} className="grid grid-cols-3 gap-2">
                    <select
                      value={selectedClassForStudent || classes[0]?.id || ''}
                      onChange={(e) => setSelectedClassForStudent(e.target.value)}
                      className="px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500 text-xs"
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
                      className="px-3 py-1.5 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-indigo-500 text-xs"
                    />
                    <button
                      type="submit"
                      className="font-medium py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors text-xs"
                    >
                      + Simpan Siswa
                    </button>
                  </form>
                )}
              </div>
            </div>

            {/* Section 3: Data Backup, Restore & Cloud Sync (Admin Control) */}
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h4 className="font-semibold text-slate-900 uppercase tracking-wider">
                  Pusat Data Administrator (Backup, Restore & Cloud)
                </h4>
                {isCloudConnected && isCloudAdmin ? (
                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                    <Check className="w-3 h-3" /> Cloud Firestore Aktif
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
                    Mode Lokal (PIN)
                  </span>
                )}
              </div>

              <p className="text-slate-500 text-[11px] leading-relaxed">
                Unggah data dari penyimpanan lokal browser ini ke Database Cloud Firestore, atau cadangkan/pulihkan lewat file JSON agar data dapat dipindahkan antar browser maupun domain Vercel.
              </p>

              <div className="flex flex-wrap items-center gap-2.5 pt-1">
                <button
                  type="button"
                  disabled={isSyncingCloud || !isCloudAdmin}
                  onClick={handleSyncLocalToCloud}
                  className="inline-flex items-center gap-1.5 font-semibold px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 disabled:text-slate-500 text-white rounded-lg transition-colors cursor-pointer disabled:cursor-not-allowed"
                  title={
                    isCloudAdmin
                      ? 'Unggah data lokal browser ini ke Database Cloud Firestore'
                      : 'Masuk dengan akun Google Guru untuk mengunggah ke Database Cloud'
                  }
                >
                  {isSyncingCloud ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <CloudUpload className="w-3.5 h-3.5" />
                  )}
                  <span>
                    {isSyncingCloud ? 'Mengunggah ke Cloud...' : 'Upload Data Browser Lokal ke Cloud'}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={exportBackup}
                  className="inline-flex items-center gap-1.5 font-medium px-3.5 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-lg transition-colors cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Cadangkan / Unduh Data (JSON)</span>
                </button>

                <label
                  className={`inline-flex items-center gap-1.5 font-medium px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 rounded-lg transition-colors ${
                    isSyncingCloud ? 'opacity-60 pointer-events-none' : 'cursor-pointer'
                  }`}
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isSyncingCloud ? 'animate-spin' : ''}`} />
                  <span>Pulihkan Data dari File</span>
                  <input
                    type="file"
                    accept=".json"
                    disabled={isSyncingCloud}
                    onChange={handleRestoreFile}
                    className="hidden"
                  />
                </label>
              </div>

              {!isCloudAdmin && (
                <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-[11px] leading-relaxed">
                  Saat ini Anda masuk menggunakan PIN lokal. Untuk mengimpor atau menyinkronkan data ke <strong>Database Cloud Firestore</strong>, silakan keluar terlebih dahulu lalu masuk lewat tombol <strong>Masuk Guru via Google (Database Cloud)</strong>.
                </div>
              )}

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

              <p className="text-[11px] text-slate-500 bg-slate-50 border border-slate-200/80 rounded-lg px-3 py-2 leading-relaxed">
                <strong>Tips pindah browser / Vercel:</strong> Jika data lokal tersimpan di browser lain, klik <strong>Cadangkan / Unduh Data (JSON)</strong> di browser tersebut, lalu buka situs tujuan, masuk via Google Guru, dan pilih <strong>Pulihkan Data dari File</strong> (otomatis terunggah ke Cloud).
              </p>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between p-4 border-t border-slate-100 bg-slate-50 shrink-0">
            <span className="text-[11px] text-slate-500">
              Hak Akses: Guru & Administrator Mapel
            </span>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors"
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
