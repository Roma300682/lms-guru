import React, { useState, useRef } from 'react';
import { useLMS } from '../../context/LMSContext';
import { MaterialAttachment } from '../../types/lms';
import { FileAttachmentBadge, detectFileType, formatFileSize } from '../FileAttachmentBadge';
import { X, UploadCloud, FileText, AlertCircle, FileSpreadsheet } from 'lucide-react';

interface AddMaterialModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AddMaterialModal: React.FC<AddMaterialModalProps> = ({ isOpen, onClose }) => {
  const { classes, addMaterial, activeClassId, setActiveClassId, activeSubject, teacherSubjects } = useLMS();

  const resolveDefaultClass = () => {
    if (activeClassId && activeClassId !== 'all' && classes.some((c) => c.id === activeClassId)) {
      return activeClassId;
    }
    return classes[0]?.id || 'all';
  };

  const resolveSubjectForClass = (classId: string) => {
    const clsSubj = classes.find((c) => c.id === classId)?.subject?.trim();
    if (clsSubj) return clsSubj;
    return activeSubject !== 'all' ? activeSubject : (teacherSubjects[0] || '');
  };

  const initialClass = resolveDefaultClass();
  const [title, setTitle] = useState('');
  const [targetClass, setTargetClass] = useState(initialClass);
  const [subject, setSubject] = useState(() => resolveSubjectForClass(initialClass));
  const [content, setContent] = useState('');
  const [linkUrl, setLinkUrl] = useState('');

  // File upload state
  const [attachment, setAttachment] = useState<MaterialAttachment | null>(null);
  const [fileError, setFileError] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync targetClass & per-class subject whenever modal opens
  React.useEffect(() => {
    if (isOpen) {
      const nextClass =
        activeClassId && activeClassId !== 'all' && classes.some((c) => c.id === activeClassId)
          ? activeClassId
          : (classes[0]?.id || 'all');
      setTargetClass(nextClass);
      const clsSubj = classes.find((c) => c.id === nextClass)?.subject?.trim();
      setSubject(clsSubj || (activeSubject !== 'all' ? activeSubject : (teacherSubjects[0] || '')));
    }
  }, [isOpen, activeClassId, classes, activeSubject, teacherSubjects]);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileError('');

    // Check size limit (max 5 MB for browser local storage)
    const MAX_SIZE = 5 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      setFileError('Ukuran file maksimal 5 MB agar dapat disimpan lancar di browser.');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    const type = detectFileType(file.name, file.type);
    setIsUploading(true);

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      if (dataUrl) {
        setAttachment({
          name: file.name,
          size: formatFileSize(file.size),
          type,
          dataUrl,
        });

        // Automatically prefill title if empty
        if (!title.trim()) {
          const rawName = file.name.replace(/\.[^/.]+$/, '');
          setTitle(rawName);
        }
      }
      setIsUploading(false);
    };

    reader.onerror = () => {
      setFileError('Gagal membaca file. Silakan coba lagi.');
      setIsUploading(false);
    };

    reader.readAsDataURL(file);
  };

  const handleRemoveAttachment = () => {
    setAttachment(null);
    setFileError('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    addMaterial({
      title: title.trim(),
      subject: subject.trim() || undefined,
      content: content.trim() || (attachment ? `Materi terlampir dalam file ${attachment.name}` : ''),
      linkUrl: linkUrl.trim() || undefined,
      attachment: attachment || undefined,
      classId: targetClass,
    });

    // Ensure view switches to target class so material is immediately visible
    if (targetClass !== 'all' && activeClassId !== targetClass && activeClassId !== 'all') {
      setActiveClassId(targetClass);
    }

    // Reset form
    setTitle('');
    setContent('');
    setLinkUrl('');
    setAttachment(null);
    setFileError('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs">
      <div className="bg-white rounded-xl max-w-xl w-full border border-slate-200 shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 shrink-0">
          <div>
            <h3 className="text-base font-semibold text-slate-900">Tambah Bahan Ajar & Modul</h3>
            <p className="text-xs text-slate-500">
              Bagikan modul belajar, ringkasan materi, atau upload dokumen Word, Excel & PDF
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto flex-1">
          {/* Judul Materi */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Judul Materi / Bab <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Contoh: Bab 2: Struktur Organel Sel dan Fungsinya"
              className="w-full text-sm px-3.5 py-2 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Untuk Kelas */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Untuk Kelas Target
              </label>
              <select
                value={targetClass}
                onChange={(e) => {
                  const nextId = e.target.value;
                  setTargetClass(nextId);
                  if (nextId !== 'all') {
                    const clsSubj = classes.find((c) => c.id === nextId)?.subject?.trim();
                    if (clsSubj) setSubject(clsSubj);
                  }
                }}
                className="w-full text-sm px-3.5 py-2 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-indigo-500 bg-white"
              >
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}{c.subject?.trim() ? ` · ${c.subject.trim()}` : ''}
                  </option>
                ))}
                <option value="all">Semua Kelas (Mapel Sama)</option>
              </select>
            </div>

            {/* Mata Pelajaran */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Mata Pelajaran
              </label>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Misal: Biologi, Matematika, dll."
                className="w-full text-sm px-3.5 py-2 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          {/* Upload File Dokumen (Word, Excel, PDF) */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-slate-700">
              Lampirkan File Dokumen (Word, Excel, PDF)
            </label>

            {!attachment ? (
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-slate-300 hover:border-indigo-400 hover:bg-indigo-50/30 rounded-xl p-4 text-center cursor-pointer transition-all group bg-slate-50/50"
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.doc,.docx,.xls,.xlsx"
                  onChange={handleFileChange}
                  className="hidden"
                />

                <div className="w-10 h-10 bg-indigo-50 group-hover:bg-indigo-100 text-indigo-600 rounded-xl flex items-center justify-center mx-auto mb-2 transition-colors">
                  <UploadCloud className="w-5 h-5" />
                </div>

                <div className="text-xs font-semibold text-slate-800">
                  {isUploading ? 'Sedang memproses file...' : 'Klik untuk Pilih File Dokumen'}
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  Mendukung format: <strong className="text-blue-700">Word (.doc, .docx)</strong>,{' '}
                  <strong className="text-emerald-700">Excel (.xls, .xlsx)</strong>, &{' '}
                  <strong className="text-rose-700">PDF (.pdf)</strong>
                </p>
                <span className="inline-block text-[10px] text-slate-400 bg-white px-2 py-0.5 rounded border border-slate-200 mt-2">
                  Ukuran maksimal 5 MB
                </span>
              </div>
            ) : (
              <div className="space-y-1">
                <FileAttachmentBadge
                  attachment={attachment}
                  onRemove={handleRemoveAttachment}
                  showDownload={false}
                />
                <p className="text-[11px] text-emerald-700 font-medium flex items-center gap-1 px-1">
                  <span>✓ Berkas siap dibagikan ke siswa</span>
                </p>
              </div>
            )}

            {fileError && (
              <p className="text-xs text-rose-600 flex items-center gap-1.5 p-2 bg-rose-50 rounded-lg border border-rose-200">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{fileError}</span>
              </p>
            )}
          </div>

          {/* Rangkuman Materi / Deskripsi Catatan */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Catatan / Rangkuman Materi <span className="text-slate-400 font-normal">(Opsional jika ada file)</span>
            </label>
            <textarea
              rows={4}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Tulis ringkasan poin-poin materi, petunjuk membaca modul, atau pengantar belajar untuk siswa..."
              className="w-full text-sm px-3.5 py-2 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* Tautan Pendukung (YouTube / Drive / Web) */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Tautan Pendukung / Video / Google Drive (Opsional)
            </label>
            <input
              type="url"
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              placeholder="https://youtube.com/... atau tautan Google Drive / Web artikel"
              className="w-full text-sm px-3.5 py-2 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* Footer actions */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isUploading}
              className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 rounded-lg shadow-xs transition-colors"
            >
              Simpan & Bagikan Materi
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
