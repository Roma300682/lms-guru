import React, { useState } from 'react';
import { useLMS } from '../../context/LMSContext';
import { AddMaterialModal } from '../modals/AddMaterialModal';
import { FileAttachmentBadge } from '../FileAttachmentBadge';
import { Plus, BookOpen, ExternalLink, Trash2 } from 'lucide-react';

export const MateriTab: React.FC = () => {
  const { materials, deleteMaterial, activeClassId, classes } = useLMS();
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Filter materials based on active class
  const filteredMaterials = materials.filter((m) => {
    if (activeClassId === 'all') return true;
    return m.classId === 'all' || m.classId === activeClassId;
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
          <h2 className="text-sm font-semibold text-slate-900">Bahan Ajar & Modul</h2>
          <p className="text-xs text-slate-500">
            Daftar rangkuman materi dan sumber belajar daring untuk siswa
          </p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-xs transition-colors shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Tambah Bahan Ajar</span>
        </button>
      </div>

      {/* Materials List */}
      {filteredMaterials.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
          <BookOpen className="w-8 h-8 text-slate-300 mx-auto mb-2" />
          <h3 className="text-sm font-semibold text-slate-800">Belum ada bahan ajar</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            Klik tombol "Tambah Bahan Ajar" untuk membagikan ringkasan materi atau tautan belajar ke siswa.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredMaterials.map((mat) => (
            <div
              key={mat.id}
              className="bg-white rounded-xl border border-slate-200 p-5 hover:border-slate-300 transition-all space-y-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <span className="font-medium text-indigo-700">{getClassName(mat.classId)}</span>
                    <span aria-hidden="true">·</span>
                    <span>{mat.date}</span>
                  </div>
                  <h3 className="text-base font-semibold text-slate-900">{mat.title}</h3>
                </div>
                <button
                  onClick={() => {
                    if (confirm('Hapus bahan ajar ini?')) {
                      deleteMaterial(mat.id);
                    }
                  }}
                  className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors"
                  title="Hapus Bahan Ajar"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
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
