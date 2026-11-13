import React, { useState } from 'react';
import { useLMS } from '../../context/LMSContext';
import { AddMaterialModal } from '../modals/AddMaterialModal';
import { FileAttachmentBadge } from '../FileAttachmentBadge';
import { WhatsAppPrefill } from '../../types/lms';
import { Plus, BookOpen, ExternalLink, Trash2, Search, MessageCircle } from 'lucide-react';

import { getPrimarySubject } from '../../utils/subjects';

interface MateriTabProps {
  onShareToWhatsApp?: (prefill: WhatsAppPrefill) => void;
}

export const MateriTab: React.FC<MateriTabProps> = ({ onShareToWhatsApp }) => {
  const { materials, deleteMaterial, activeClassId, setActiveClassId, activeSubject, setActiveSubject, classes, teacher } = useLMS();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const fallbackSubject = getPrimarySubject(teacher.subject);

  // Filter materials based on active class and active subject
  const filteredByClassAndSubject = materials.filter((m) => {
    const classMatch = activeClassId === 'all' || m.classId === 'all' || m.classId === activeClassId;
    const itemSubject = m.subject?.trim() || fallbackSubject;
    const subjectMatch =
      activeSubject === 'all' || itemSubject.toLowerCase() === activeSubject.toLowerCase();
    return classMatch && subjectMatch;
  });

  // Filter by search query
  const displayedMaterials = filteredByClassAndSubject.filter((m) => {
    const q = searchQuery.toLowerCase();
    return (
      m.title.toLowerCase().includes(q) ||
      m.content.toLowerCase().includes(q) ||
      (m.subject || '').toLowerCase().includes(q) ||
      m.attachment?.name.toLowerCase().includes(q)
    );
  });

  const getClassName = (classId: string) => {
    if (classId === 'all') return 'Semua Kelas';
    const found = classes.find((c) => c.id === classId);
    return found ? found.name : 'Kelas';
  };

  return (
    <div className="space-y-4">
      {/* Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-slate-900">Bahan Ajar & Modul</h2>
            <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
              {getClassName(activeClassId)}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Daftar rangkuman materi, dokumen Word/Excel/PDF, dan sumber belajar siswa
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {materials.length > 0 && (
            <div className="relative">
              <input
                type="text"
                placeholder="Cari materi / modul..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="text-xs pl-8 pr-3 py-1.5 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-indigo-500 w-full sm:w-48"
              />
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
            </div>
          )}

          <button
            onClick={() => setIsModalOpen(true)}
            className="inline-flex items-center justify-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-xs transition-colors shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Tambah Bahan Ajar</span>
          </button>
        </div>
      </div>

      {/* Materials List */}
      {displayedMaterials.length === 0 ? (
        materials.length > 0 && (activeClassId !== 'all' || activeSubject !== 'all') ? (
          /* Empty for current filter, but exists in other classes/subjects */
          <div className="bg-white rounded-xl border border-slate-200 p-10 text-center space-y-3">
            <BookOpen className="w-8 h-8 text-slate-300 mx-auto" />
            <h3 className="text-sm font-semibold text-slate-800">
              Belum ada materi untuk filter {getClassName(activeClassId)}
              {activeSubject !== 'all' ? ` · ${activeSubject}` : ''}
            </h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              Terdapat <strong>{materials.length}</strong> bahan ajar yang terdaftar di kelas atau mata pelajaran lain.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
              <button
                onClick={() => {
                  setActiveClassId('all');
                  setActiveSubject('all');
                }}
                className="px-3.5 py-1.5 text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-lg transition-colors"
              >
                Tampilkan Semua Kelas &amp; Mapel ({materials.length})
              </button>
              <button
                onClick={() => setIsModalOpen(true)}
                className="px-3.5 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-xs transition-colors"
              >
                + Tambah Materi Baru
              </button>
            </div>
          </div>
        ) : (
          /* Empty totally */
          <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
            <BookOpen className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <h3 className="text-sm font-semibold text-slate-800">
              {searchQuery ? 'Tidak ada materi yang cocok dengan pencarian' : 'Belum ada bahan ajar'}
            </h3>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              {searchQuery
                ? `Kata kunci "${searchQuery}" tidak ditemukan.`
                : 'Klik tombol "Tambah Bahan Ajar" untuk membagikan ringkasan materi atau upload file Word, Excel, dan PDF untuk siswa.'}
            </p>
            {!searchQuery && (
              <button
                onClick={() => setIsModalOpen(true)}
                className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-xs transition-colors"
              >
                <Plus className="w-4 h-4" />
                <span>Tambah Bahan Ajar Sekarang</span>
              </button>
            )}
          </div>
        )
      ) : (
        <div className="space-y-3">
          {displayedMaterials.map((mat) => (
            <div
              key={mat.id}
              className="bg-white rounded-xl border border-slate-200 p-5 hover:border-slate-300 transition-all space-y-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
                    <span className="font-semibold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">
                      {getClassName(mat.classId)}
                    </span>
                    <span className="font-medium text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                      {mat.subject || fallbackSubject}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>{mat.date}</span>
                  </div>
                  <h3 className="text-base font-semibold text-slate-900">{mat.title}</h3>
                </div>
                <div className="flex items-center gap-1">
                  {onShareToWhatsApp && (
                    <button
                      type="button"
                      onClick={() =>
                        onShareToWhatsApp({
                          classId: mat.classId,
                          message: `Halo {nama} ({kelas}),\n\nMateri baru mata pelajaran *${mat.subject || fallbackSubject}* telah dibagikan:\n*${mat.title}*\n\n${mat.content}${
                            mat.linkUrl ? `\n\nTautan referensi: ${mat.linkUrl}` : ''
                          }\n\nSilakan cek di GuruMapel LMS. Terima kasih,\n${teacher.name}`,
                        })
                      }
                      className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-md transition-colors"
                      title="Kirim info materi ini ke WhatsApp siswa / grup"
                    >
                      <MessageCircle className="w-3.5 h-3.5" />
                      <span>Kirim WA</span>
                    </button>
                  )}
                  <button
                    onClick={() => {
                      if (confirm(`Hapus bahan ajar "${mat.title}"?`)) {
                        deleteMaterial(mat.id);
                      }
                    }}
                    className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors"
                    title="Hapus Bahan Ajar"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {mat.content && (
                <div className="text-sm text-slate-700 leading-relaxed bg-slate-50/70 p-3.5 rounded-lg border border-slate-100 whitespace-pre-wrap">
                  {mat.content}
                </div>
              )}

              {mat.attachment && (
                <div className="pt-1">
                  <FileAttachmentBadge attachment={mat.attachment} showDownload={true} />
                </div>
              )}

              {mat.linkUrl && (
                <div className="pt-1">
                  <a
                    href={mat.linkUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-indigo-600 hover:text-indigo-800 hover:underline"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Buka Tautan Pembelajaran / Video Referensi</span>
                  </a>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <AddMaterialModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </div>
  );
};
