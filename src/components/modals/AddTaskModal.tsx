import React, { useState, useRef } from 'react';
import { useLMS } from '../../context/LMSContext';
import { MaterialAttachment } from '../../types/lms';
import { FileAttachmentBadge, detectFileType, formatFileSize } from '../FileAttachmentBadge';
import { X, UploadCloud, AlertCircle } from 'lucide-react';

interface AddTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AddTaskModal: React.FC<AddTaskModalProps> = ({ isOpen, onClose }) => {
  const { classes, addTask, activeClassId, setActiveClassId, activeSubject, teacherSubjects } = useLMS();

  const [title, setTitle] = useState('');
  const [subject, setSubject] = useState(
    activeSubject !== 'all' ? activeSubject : (teacherSubjects[0] || '')
  );
  const [instructions, setInstructions] = useState('');
  const [dueDate, setDueDate] = useState(() => {
    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);
    return nextWeek.toISOString().split('T')[0];
  });
  const [targetClass, setTargetClass] = useState(() =>
    activeClassId && activeClassId !== 'all' && classes.some((c) => c.id === activeClassId)
      ? activeClassId
      : 'all'
  );

  // File soal / LKPD attachment state
  const [attachment, setAttachment] = useState<MaterialAttachment | null>(null);
  const [fileError, setFileError] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync targetClass & default subject whenever modal opens
  React.useEffect(() => {
    if (isOpen) {
      if (activeClassId && activeClassId !== 'all' && classes.some((c) => c.id === activeClassId)) {
        setTargetClass(activeClassId);
      } else {
        setTargetClass('all');
      }
      setSubject(activeSubject !== 'all' ? activeSubject : (teacherSubjects[0] || ''));
    }
  }, [isOpen, activeClassId, classes, activeSubject, teacherSubjects]);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileError('');

    // Check size limit (max 5 MB)
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

        // Prefill title if empty
        if (!title.trim()) {
          const rawName = file.name.replace(/\.[^/.]+$/, '');
          setTitle(`Tugas: ${rawName}`);
        }
      }
      setIsUploading(false);
    };

    reader.onerror = () => {
      setFileError('Gagal membaca file soal. Silakan coba lagi.');
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

    addTask({
      title: title.trim(),
      subject: subject.trim() || undefined,
      instructions: instructions.trim() || (attachment ? `Kerjakan soal yang terlampir pada berkas ${attachment.name}` : ''),
      dueDate,
      classId: targetClass,
      attachment: attachment || undefined,
    });

    // Ensure view switches to target class so task is immediately visible
    if (targetClass !== 'all' && activeClassId !== targetClass && activeClassId !== 'all') {
      setActiveClassId(targetClass);
    }

    // Reset form
    setTitle('');
    setInstructions('');
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
            <h3 className="text-base font-semibold text-slate-900">Buat Tugas Baru & Upload Soal</h3>
            <p className="text-xs text-slate-500">Berikan tugas atau unggah lembar soal (Word, Excel, PDF) untuk siswa</p>
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
          {/* Judul Tugas */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Judul Tugas / LKPD <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Contoh: Tugas 1: Lembar Analisis Pewarisan Sifat"
              className="w-full text-sm px-3.5 py-2 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Tenggat Waktu */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Tenggat Pengumpulan (Deadline)
              </label>
              <input
                type="date"
                required
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full text-sm px-3.5 py-2 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            {/* Untuk Kelas */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Untuk Kelas Target
              </label>
              <select
                value={targetClass}
                onChange={(e) => setTargetClass(e.target.value)}
                className="w-full text-sm px-3.5 py-2 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-indigo-500 bg-white"
              >
                <option value="all">Semua Kelas yang Diampu</option>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Mata Pelajaran */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-slate-700">
              Mata Pelajaran
            </label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Misal: Biologi, Matematika, Informatika..."
              className="w-full text-sm px-3.5 py-2 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* Upload File Soal / LKPD */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-slate-700">
              Upload Berkas Lembar Soal (Word, Excel, PDF)
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
                  {isUploading ? 'Sedang memproses file soal...' : 'Klik untuk Unggah File Soal / LKPD'}
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  Mendukung format: <strong className="text-blue-700">Word (.doc, .docx)</strong>,{' '}
                  <strong className="text-emerald-700">Excel (.xls, .xlsx)</strong>, &{' '}
                  <strong className="text-rose-700">PDF (.pdf)</strong>
                </p>
                <span className="inline-block text-[10px] text-slate-400 bg-white px-2 py-0.5 rounded border border-slate-200 mt-2">
                  Siswa dapat langsung membuka & mengunduh berkas ini
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
                  <span>✓ Berkas lembar soal siap diunduh oleh siswa</span>
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

          {/* Petunjuk Pengerjaan */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Petunjuk Pengerjaan Tugas <span className="text-slate-400 font-normal">(Opsional jika sudah ada di file soal)</span>
            </label>
            <textarea
              rows={4}
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              placeholder="Jelaskan petunjuk pengerjaan tugas, instruksi pengerjaan lembar soal, dan format pengumpulan..."
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
              Terbitkan Tugas
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
