import React, { useState } from 'react';
import { useLMS } from '../../context/LMSContext';
import { Users, Upload, Plus, Trash2, Search, Check, UserCheck, MessageCircle, Edit2 } from 'lucide-react';
import { UploadStudentsModal } from '../modals/UploadStudentsModal';
import { buildWaMeUrl, normalizeWhatsAppNumber } from '../../utils/whatsapp';

export const SiswaTab: React.FC = () => {
  const { students, classes, activeClassId, setActiveClassId, addStudent, updateStudent, deleteStudent } = useLMS();

  const [searchQuery, setSearchQuery] = useState('');
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [isAddingSingle, setIsAddingSingle] = useState(false);
  const [newStudentName, setNewStudentName] = useState('');
  const [newStudentWa, setNewStudentWa] = useState('');
  const [editingWaId, setEditingWaId] = useState<string | null>(null);
  const [editingWaValue, setEditingWaValue] = useState('');
  const [targetClassForSingle, setTargetClassForSingle] = useState(
    activeClassId !== 'all' ? activeClassId : classes[0]?.id || ''
  );
  const [importNotification, setImportNotification] = useState<string | null>(null);

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
    if (!newStudentName.trim() || !targetClassForSingle) return;
    addStudent(newStudentName.trim(), targetClassForSingle, newStudentWa.trim() || undefined);
    setNewStudentName('');
    setNewStudentWa('');
    setIsAddingSingle(false);
    if (activeClassId !== 'all' && activeClassId !== targetClassForSingle) {
      setActiveClassId(targetClassForSingle);
    }
  };

  const handleSaveStudentWa = (studentId: string) => {
    updateStudent(studentId, { whatsapp: editingWaValue.trim() || undefined });
    setEditingWaId(null);
    setEditingWaValue('');
  };

  const handleImportSuccess = (count: number, className: string) => {
    setImportNotification(`Berhasil mengimpor ${count} siswa ke ${className}!`);
    setTimeout(() => {
      setImportNotification(null);
    }, 4000);
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
            <h2 className="text-sm font-bold text-slate-900 leading-tight">
              Daftar Siswa {currentClassObj ? `· ${currentClassObj.name}` : '(Semua Kelas)'}
            </h2>
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

      {/* Inline Form Add Single Student */}
      {isAddingSingle && (
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
                        <div className="flex items-center gap-2 mt-1">
                          <span className="inline-block px-2 py-0.5 rounded-md text-[11px] font-medium bg-slate-100 text-slate-700 border border-slate-200">
                            {studentClass ? studentClass.name : 'Kelas'}
                          </span>
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">
                            <UserCheck className="w-3 h-3" />
                            <span>Siap</span>
                          </span>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          if (confirm(`Hapus siswa "${student.name}"?`)) {
                            deleteStudent(student.id);
                          }
                        }}
                        className="text-slate-400 hover:text-rose-600 p-1.5 rounded-md hover:bg-rose-50 transition-colors shrink-0"
                        title="Hapus Siswa"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    {isEditingThisWa ? (
                      <div className="flex items-center gap-1.5">
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
                          className="flex-1 px-2.5 py-1.5 text-xs border border-indigo-300 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-indigo-500 font-mono"
                          autoFocus
                        />
                        <button
                          type="button"
                          onClick={() => handleSaveStudentWa(student.id)}
                          className="px-3 py-1.5 text-xs font-semibold bg-emerald-600 text-white rounded-lg"
                        >
                          Simpan
                        </button>
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
                  <th className="py-3 px-4 w-28 text-center">Akses Login</th>
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
                              className="w-28 px-2 py-1 text-xs border border-indigo-300 rounded focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
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
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5">
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
                          </div>
                        )}
                      </td>
                      <td className="py-2.5 px-4 text-center">
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">
                          <UserCheck className="w-3 h-3" />
                          <span>Siap</span>
                        </span>
                      </td>
                      <td className="py-2.5 px-4 text-center">
                        <button
                          type="button"
                          onClick={() => {
                            if (confirm(`Hapus siswa "${student.name}"?`)) {
                              deleteStudent(student.id);
                            }
                          }}
                          className="text-slate-400 hover:text-rose-600 p-1 rounded-md hover:bg-rose-50 transition-colors"
                          title="Hapus Siswa"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
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
