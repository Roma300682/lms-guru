import React, { useState } from 'react';
import { useLMS } from '../../context/LMSContext';
import { Users, Upload, Plus, Trash2, Search, Check, MessageCircle, Edit2, Link2, Lock, Copy } from 'lucide-react';
import { UploadStudentsModal } from '../modals/UploadStudentsModal';
import { buildWaMeUrl, normalizeWhatsAppNumber } from '../../utils/whatsapp';
import { buildStudentPortalLink } from '../../utils/phoneAuth';

export const SiswaTab: React.FC = () => {
  const { students, classes, activeClassId, setActiveClassId, addClass, addStudent, updateStudent, deleteStudent } = useLMS();

  const [searchQuery, setSearchQuery] = useState('');
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [isAddingSingle, setIsAddingSingle] = useState(false);
  const [newClassName, setNewClassName] = useState('');
  const [newClassSubject, setNewClassSubject] = useState('');
  const [newStudentName, setNewStudentName] = useState('');
  const [newStudentWa, setNewStudentWa] = useState('');
  const [editingWaId, setEditingWaId] = useState<string | null>(null);
  const [editingWaValue, setEditingWaValue] = useState('');
  const [targetClassForSingle, setTargetClassForSingle] = useState(
    activeClassId !== 'all' ? activeClassId : classes[0]?.id || ''
  );
  const [importNotification, setImportNotification] = useState<string | null>(null);
  const [copiedLinkKey, setCopiedLinkKey] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Filter students based on activeClassId
  const filteredByClass =
    activeClassId === 'all'
      ? students
      : students.filter((s) => s.classId === activeClassId);

  // Filter by search query
  const displayedStudents = filteredByClass.filter((s) =>
    s.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const currentClassObj = classes.find((c) => c.id === activeClassId);

  const handleAddSingleStudent = (e: React.FormEvent) => {
    e.preventDefault();
    const resolvedClassId =
      targetClassForSingle && classes.some((c) => c.id === targetClassForSingle)
        ? targetClassForSingle
        : classes[0]?.id || '';
    if (!newStudentName.trim() || !resolvedClassId) return;
    addStudent(newStudentName.trim(), resolvedClassId, newStudentWa.trim() || undefined);
    setNewStudentName('');
    setNewStudentWa('');
    setIsAddingSingle(false);
    if (activeClassId !== 'all' && activeClassId !== resolvedClassId) {
      setActiveClassId(resolvedClassId);
    }
  };

  const handleQuickCreateClass = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = newClassName.trim();
    if (!cleaned) return;
    const createdId = addClass(cleaned, newClassSubject.trim() || undefined);
    if (createdId) {
      setTargetClassForSingle(createdId);
      setActiveClassId(createdId);
    }
    setNewClassName('');
    setNewClassSubject('');
  };

  const handleSaveStudentWa = (studentId: string) => {
    updateStudent(studentId, { whatsapp: editingWaValue.trim() });
    setEditingWaId(null);
    setEditingWaValue('');
  };

  const handleDeleteStudentWa = (studentId: string) => {
    updateStudent(studentId, { whatsapp: '' });
    if (editingWaId === studentId) {
      setEditingWaId(null);
      setEditingWaValue('');
    }
  };

  const handleImportSuccess = (count: number, className: string) => {
    setImportNotification(`Berhasil mengimpor ${count} siswa ke ${className}!`);
    setTimeout(() => {
      setImportNotification(null);
    }, 4000);
  };

  const handleCopyStudentLink = async (studentId?: string) => {
    const key = studentId || 'portal';
    try {
      await navigator.clipboard.writeText(buildStudentPortalLink(studentId));
      setCopiedLinkKey(key);
      setTimeout(() => {
        setCopiedLinkKey((prev) => (prev === key ? null : prev));
      }, 2200);
    } catch {
      // Ignore clipboard permission errors silently
    }
  };

  return (
    <div className="space-y-4">
      {/* Success Notification Banner */}
      {importNotification && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-3 rounded-xl text-xs flex items-center justify-between animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex items-center gap-2">
            <Check className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="font-semibold">{importNotification}</span>
          </div>
          <button
            onClick={() => setImportNotification(null)}
            className="text-xs text-emerald-600 hover:text-emerald-800 font-medium"
          >
            Tutup
          </button>
        </div>
      )}

      {/* Control & Search Bar */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-700 flex items-center justify-center shrink-0">
            <Users className="w-4 h-4" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-1.5">
              <h2 className="text-sm font-bold text-slate-900 leading-tight">
                Daftar Siswa {currentClassObj ? `· ${currentClassObj.name}` : '(Semua Kelas)'}
              </h2>
              {currentClassObj?.subject?.trim() && (
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200">
                  {currentClassObj.subject.trim()}
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500">
              {filteredByClass.length} siswa terdaftar {classes.length > 0 ? `di ${classes.length} rombel` : ''}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Search box */}
          <div className="relative flex-1 sm:flex-initial">
            <input
              type="text"
              placeholder="Cari nama siswa..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="text-xs pl-8 pr-3 py-1.5 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-indigo-500 w-full sm:w-48"
            />
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
          </div>

          <button
            type="button"
            onClick={() => handleCopyStudentLink()}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors ${
              copiedLinkKey === 'portal'
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
            }`}
            title="Salin tautan Portal Siswa (siswa wajib memasukkan No. HP masing-masing saat masuk)"
          >
            {copiedLinkKey === 'portal' ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-600" />
                <span>Link Portal Disalin</span>
              </>
            ) : (
              <>
                <Link2 className="w-3.5 h-3.5 text-indigo-600" />
                <span>Salin Link Login Siswa</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={() => setIsAddingSingle(!isAddingSingle)}
            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Tambah Siswa</span>
          </button>

          <button
            type="button"
            onClick={() => setIsUploadModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-xs transition-colors"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Upload / Impor Siswa</span>
          </button>
        </div>
      </div>

      {/* Inline Prompt to Create First Class when no rombel exists */}
      {classes.length === 0 && (
        <form
          onSubmit={handleQuickCreateClass}
          className="bg-amber-50 border border-amber-200 p-4 rounded-xl space-y-2.5 text-xs"
        >
          <div>
            <h3 className="font-bold text-amber-950">Belum Ada Rombel Kelas Terdaftar</h3>
            <p className="text-amber-800 mt-0.5">
              Tambahkan minimal 1 rombel kelas terlebih dahulu sebelum menambahkan atau mengimpor siswa.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
            <input
              type="text"
              required
              placeholder="Nama Rombel Baru (cth: Kelas X IPA 1)"
              value={newClassName}
              onChange={(e) => setNewClassName(e.target.value)}
              className="sm:col-span-5 px-3 py-2 bg-white border border-amber-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-indigo-500 text-xs"
            />
            <input
              type="text"
              placeholder="Mata Pelajaran kelas ini (cth: Biologi)"
              value={newClassSubject}
              onChange={(e) => setNewClassSubject(e.target.value)}
              className="sm:col-span-4 px-3 py-2 bg-white border border-amber-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-indigo-500 text-xs"
            />
            <button
              type="submit"
              className="sm:col-span-3 inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg shadow-xs transition-colors shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Buat Rombel Kelas</span>
            </button>
          </div>
        </form>
      )}

      {/* Inline Form Add Single Student */}
      {isAddingSingle && classes.length > 0 && (
        <form
          onSubmit={handleAddSingleStudent}
          className="bg-indigo-50/50 border border-indigo-100 p-3.5 rounded-xl flex flex-wrap items-center gap-2 text-xs animate-in fade-in duration-150"
        >
          <span className="font-semibold text-indigo-900 shrink-0">Tambah Siswa Baru:</span>
          <select
            value={targetClassForSingle || classes[0]?.id || ''}
            onChange={(e) => setTargetClassForSingle(e.target.value)}
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
            required
            placeholder="Nama Lengkap Siswa"
            value={newStudentName}
            onChange={(e) => setNewStudentName(e.target.value)}
            className="w-full sm:flex-1 sm:min-w-[160px] px-3 py-2 sm:py-1.5 border border-slate-300 rounded-lg bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500 text-xs"
            autoFocus
          />
          <input
            type="text"
            placeholder="No. WhatsApp (cth: 0812...)"
            value={newStudentWa}
            onChange={(e) => setNewStudentWa(e.target.value)}
            className="w-full sm:w-44 px-3 py-2 sm:py-1.5 border border-slate-300 rounded-lg bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500 text-xs"
          />
          <button
            type="submit"
            className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg shadow-xs transition-colors"
          >
            Simpan
          </button>
          <button
            type="button"
            onClick={() => setIsAddingSingle(false)}
            className="px-2.5 py-1.5 text-slate-500 hover:text-slate-800"
          >
            Batal
          </button>
        </form>
      )}

      {/* Student List Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
        {displayedStudents.length === 0 ? (
          <div className="p-10 text-center space-y-3">
            <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mx-auto text-slate-400">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-800">
                {searchQuery
                  ? 'Tidak ada siswa yang sesuai pencarian'
                  : 'Belum Ada Siswa di Kelas Ini'}
              </h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
                {searchQuery
                  ? `Kata kunci "${searchQuery}" tidak ditemukan.`
                  : 'Unggah file Excel/CSV atau tempel daftar nama siswa agar siswa dapat langsung login dan mengumpulkan tugas.'}
              </p>
            </div>
            {!searchQuery && (
              <button
                type="button"
                onClick={() => setIsUploadModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-xs transition-colors"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Upload Siswa Sekarang</span>
              </button>
            )}
          </div>
        ) : (
          <>
            {/* Mobile Card View (< md) */}
            <div className="md:hidden divide-y divide-slate-100">
              {displayedStudents.map((student, idx) => {
                const studentClass = classes.find((c) => c.id === student.classId);
                const validWa = normalizeWhatsAppNumber(student.whatsapp);
                const isEditingThisWa = editingWaId === student.id;
                return (
                  <div key={student.id} className="p-3.5 space-y-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[11px] font-mono text-slate-400">{idx + 1}.</span>
                          <span className="text-sm font-semibold text-slate-900 truncate">
                            {student.name}
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5 mt-1">
                          <span className="inline-block px-2 py-0.5 rounded-md text-[11px] font-medium bg-slate-100 text-slate-700 border border-slate-200">
                            {studentClass ? studentClass.name : 'Kelas'}
                          </span>
                          {validWa || student.phoneHash ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">
                              <Lock className="w-3 h-3" />
                              <span>Terkunci No. HP</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-800 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                              <span>Belum Ada No. HP</span>
                            </span>
                          )}
                          <button
                            type="button"
                            onClick={() => handleCopyStudentLink(student.id)}
                            className={`inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full border transition-colors ${
                              copiedLinkKey === student.id
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : 'bg-white text-indigo-700 border-indigo-200 hover:bg-indigo-50'
                            }`}
                          >
                            {copiedLinkKey === student.id ? (
                              <>
                                <Check className="w-3 h-3" />
                                <span>Tersalin</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-3 h-3" />
                                <span>Link</span>
                              </>
                            )}
                          </button>
                        </div>
                      </div>

                      {confirmDeleteId === student.id ? (
                        <div className="inline-flex items-center gap-1 bg-rose-50 border border-rose-200 px-1.5 py-1 rounded-md shrink-0">
                          <button
                            type="button"
                            onClick={() => {
                              deleteStudent(student.id);
                              setConfirmDeleteId(null);
                            }}
                            className="text-[11px] font-semibold text-white bg-rose-600 hover:bg-rose-700 px-2 py-0.5 rounded"
                          >
                            Hapus
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(null)}
                            className="text-[11px] text-slate-600 px-1.5 py-0.5"
                          >
                            Batal
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(student.id)}
                          className="text-slate-400 hover:text-rose-600 p-1.5 rounded-md hover:bg-rose-50 transition-colors shrink-0"
                          title="Hapus Siswa"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>

                    {isEditingThisWa ? (
                      <div className="flex flex-wrap items-center gap-1.5">
                        <input
                          type="tel"
                          value={editingWaValue}
                          onChange={(e) => setEditingWaValue(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleSaveStudentWa(student.id);
                            } else if (e.key === 'Escape') {
                              setEditingWaId(null);
                            }
                          }}
                          placeholder="081234567890"
                          className="flex-1 min-w-[140px] px-2.5 py-1.5 text-xs border border-indigo-300 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-indigo-500 font-mono"
                          autoFocus
                        />
                        <button
                          type="button"
                          onClick={() => handleSaveStudentWa(student.id)}
                          className="px-3 py-1.5 text-xs font-semibold bg-emerald-600 text-white rounded-lg"
                        >
                          Simpan
                        </button>
                        {(validWa || student.phoneHash) && (
                          <button
                            type="button"
                            onClick={() => handleDeleteStudentWa(student.id)}
                            className="px-2.5 py-1.5 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg"
                            title="Hapus nomor telepon/WhatsApp siswa ini"
                          >
                            Hapus No.
                          </button>
                        )}
                      </div>
                    ) : (
                      <div className="flex items-center justify-between gap-2 bg-slate-50 px-2.5 py-1.5 rounded-lg border border-slate-100">
                        {validWa ? (
                          <a
                            href={buildWaMeUrl(student.whatsapp, `Halo ${student.name},`)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 text-xs font-mono font-medium text-emerald-700"
                          >
                            <MessageCircle className="w-3.5 h-3.5" />
                            <span>{student.whatsapp}</span>
                          </a>
                        ) : (
                          <span className="text-[11px] text-slate-400 italic">No. WA belum diisi</span>
                        )}
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingWaId(student.id);
                              setEditingWaValue(student.whatsapp || '');
                            }}
                            className="inline-flex items-center gap-1 text-[11px] font-medium text-indigo-600 px-2 py-1 rounded hover:bg-indigo-50"
                          >
                            <Edit2 className="w-3 h-3" />
                            <span>{validWa ? 'Ubah' : 'Isi WA'}</span>
                          </button>
                          {(validWa || student.phoneHash) && (
                            <button
                              type="button"
                              onClick={() => handleDeleteStudentWa(student.id)}
                              className="inline-flex items-center gap-1 text-[11px] font-medium text-rose-600 px-2 py-1 rounded hover:bg-rose-50"
                              title="Hapus No. Telpon / WA"
                            >
                              <Trash2 className="w-3 h-3" />
                              <span>Hapus</span>
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Desktop Table View (md+) */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-700 font-semibold">
                  <th className="py-3 px-3 w-12 text-center">No</th>
                  <th className="py-3 px-4">Nama Lengkap Siswa</th>
                  <th className="py-3 px-4 w-36">Rombel Kelas</th>
                  <th className="py-3 px-4 w-48">No. WhatsApp</th>
                  <th className="py-3 px-4 w-44 text-center">Kunci Login &amp; Link</th>
                  <th className="py-3 px-4 w-16 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {displayedStudents.map((student, idx) => {
                  const studentClass = classes.find((c) => c.id === student.classId);
                  const validWa = normalizeWhatsAppNumber(student.whatsapp);
                  const isEditingThisWa = editingWaId === student.id;
                  return (
                    <tr key={student.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-2.5 px-3 text-center text-slate-400 font-mono">
                        {idx + 1}
                      </td>
                      <td className="py-2.5 px-4 font-semibold text-slate-900">
                        {student.name}
                      </td>
                      <td className="py-2.5 px-4">
                        <span className="inline-block px-2 py-0.5 rounded-md text-[11px] font-medium bg-slate-100 text-slate-700 border border-slate-200">
                          {studentClass ? studentClass.name : 'Kelas Tidak Diketahui'}
                        </span>
                      </td>
                      <td className="py-2.5 px-4">
                        {isEditingThisWa ? (
                          <div className="flex items-center gap-1">
                            <input
                              type="text"
                              value={editingWaValue}
                              onChange={(e) => setEditingWaValue(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  handleSaveStudentWa(student.id);
                                } else if (e.key === 'Escape') {
                                  setEditingWaId(null);
                                }
                              }}
                              placeholder="0812..."
                              className="w-28 px-2 py-1 text-xs border border-indigo-300 rounded focus:outline-hidden focus:ring-1 focus:ring-indigo-500 font-mono"
                              autoFocus
                            />
                            <button
                              type="button"
                              onClick={() => handleSaveStudentWa(student.id)}
                              className="p-1 text-emerald-700 hover:bg-emerald-50 rounded"
                              title="Simpan Nomor WA"
                            >
                              <Check className="w-3.5 h-3.5" />
                            </button>
                            {(validWa || student.phoneHash) && (
                              <button
                                type="button"
                                onClick={() => handleDeleteStudentWa(student.id)}
                                className="p-1 text-rose-600 hover:bg-rose-50 rounded"
                                title="Hapus No. Telpon / WA"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        ) : (
                          <div className="flex items-center gap-1">
                            {validWa ? (
                              <a
                                href={buildWaMeUrl(student.whatsapp, `Halo ${student.name},`)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-[11px] font-mono font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-2 py-0.5 rounded border border-emerald-200 transition-colors"
                                title="Buka chat WhatsApp"
                              >
                                <MessageCircle className="w-3 h-3" />
                                <span>{student.whatsapp}</span>
                              </a>
                            ) : (
                              <span className="text-[11px] text-slate-400 italic">Belum diisi</span>
                            )}
                            <button
                              type="button"
                              onClick={() => {
                                setEditingWaId(student.id);
                                setEditingWaValue(student.whatsapp || '');
                              }}
                              className="p-1 text-slate-400 hover:text-indigo-600 rounded hover:bg-indigo-50 transition-colors"
                              title="Ubah Nomor WhatsApp"
                            >
                              <Edit2 className="w-3 h-3" />
                            </button>
                            {(validWa || student.phoneHash) && (
                              <button
                                type="button"
                                onClick={() => handleDeleteStudentWa(student.id)}
                                className="p-1 text-slate-400 hover:text-rose-600 rounded hover:bg-rose-50 transition-colors"
                                title="Hapus No. Telpon / WA siswa ini"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="py-2.5 px-4 text-center">
                        <div className="inline-flex items-center gap-1.5">
                          {validWa || student.phoneHash ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">
                              <Lock className="w-3 h-3" />
                              <span>Terkunci HP</span>
                            </span>
                          ) : (
                            <span
                              className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-800 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200"
                              title="Isi No. WhatsApp agar siswa ini bisa login"
                            >
                              <span>Belum Ada HP</span>
                            </span>
                          )}
                          <button
                            type="button"
                            onClick={() => handleCopyStudentLink(student.id)}
                            className={`inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded border transition-colors ${
                              copiedLinkKey === student.id
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : 'bg-white text-indigo-700 border-slate-200 hover:bg-indigo-50 hover:border-indigo-200'
                            }`}
                            title="Salin tautan masuk khusus siswa ini (tetap wajib verifikasi No. HP)"
                          >
                            {copiedLinkKey === student.id ? (
                              <>
                                <Check className="w-3 h-3 text-emerald-600" />
                                <span>Tersalin</span>
                              </>
                            ) : (
                              <>
                                <Link2 className="w-3 h-3" />
                                <span>Link</span>
                              </>
                            )}
                          </button>
                        </div>
                      </td>
                      <td className="py-2.5 px-4 text-center">
                        {confirmDeleteId === student.id ? (
                          <div className="inline-flex items-center gap-1 bg-rose-50 border border-rose-200 px-1.5 py-0.5 rounded">
                            <button
                              type="button"
                              onClick={() => {
                                deleteStudent(student.id);
                                setConfirmDeleteId(null);
                              }}
                              className="text-[10px] font-semibold text-white bg-rose-600 hover:bg-rose-700 px-1.5 py-0.5 rounded"
                            >
                              Hapus
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteId(null)}
                              className="text-[10px] text-slate-600 px-1 py-0.5"
                            >
                              Batal
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(student.id)}
                            className="text-slate-400 hover:text-rose-600 p-1 rounded-md hover:bg-rose-50 transition-colors"
                            title="Hapus Siswa"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          </>
        )}
      </div>

      <UploadStudentsModal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        defaultClassId={activeClassId}
        onSuccess={handleImportSuccess}
      />
    </div>
  );
};
