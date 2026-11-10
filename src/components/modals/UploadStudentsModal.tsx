import React, { useState } from 'react';
import { useLMS } from '../../context/LMSContext';
import { X, Upload, FileText, Check, AlertCircle, Users } from 'lucide-react';

interface UploadStudentsModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultClassId?: string;
}

export const UploadStudentsModal: React.FC<UploadStudentsModalProps> = ({
  isOpen,
  onClose,
  defaultClassId,
}) => {
  const { classes, addStudentsBatch } = useLMS();

  const [targetClassId, setTargetClassId] = useState<string>(
    defaultClassId && defaultClassId !== 'all' ? defaultClassId : classes[0]?.id || 'c1'
  );
  const [inputText, setInputText] = useState('');
  const [parsedNames, setParsedNames] = useState<string[]>([]);
  const [fileName, setFileName] = useState<string | null>(null);

  if (!isOpen) return null;

  // Clean lines into student names
  const parseLinesToNames = (text: string) => {
    const lines = text.split(/\r?\n/);
    const names: string[] = [];

    lines.forEach((line) => {
      let trimmed = line.trim();
      if (!trimmed) return;

      // If CSV format (comma separated), take first column if it's text
      if (trimmed.includes(',')) {
        const parts = trimmed.split(',');
        // Check if first column is a number (like No), take second
        if (/^\d+$/.test(parts[0].trim()) && parts[1]) {
          trimmed = parts[1].trim();
        } else {
          trimmed = parts[0].trim();
        }
      }

      // If semicolon separated
      if (trimmed.includes(';')) {
        const parts = trimmed.split(';');
        if (/^\d+$/.test(parts[0].trim()) && parts[1]) {
          trimmed = parts[1].trim();
        } else {
          trimmed = parts[0].trim();
        }
      }

      // Strip leading numbering: "1. ", "01. ", "1) ", "1 - "
      trimmed = trimmed.replace(/^(\d+[\.\)\-]\s*)/, '');
      // Strip surrounding quotes
      trimmed = trimmed.replace(/^["']|["']$/g, '').trim();

      // Ignore common table header names
      const lower = trimmed.toLowerCase();
      if (lower === 'nama' || lower === 'nama siswa' || lower === 'name' || lower === 'no') {
        return;
      }

      if (trimmed.length > 1) {
        names.push(trimmed);
      }
    });

    return names;
  };

  const handleTextChange = (text: string) => {
    setInputText(text);
    const names = parseLinesToNames(text);
    setParsedNames(names);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        setInputText(content);
        const names = parseLinesToNames(content);
        setParsedNames(names);
      }
    };
    reader.readAsText(file);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (parsedNames.length === 0 || !targetClassId) return;

    const toImport = parsedNames.map((name) => ({
      name,
      classId: targetClassId,
    }));

    addStudentsBatch(toImport);
    onClose();
    setInputText('');
    setParsedNames([]);
    setFileName(null);
  };

  const selectedClass = classes.find((c) => c.id === targetClassId);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs">
      <div className="bg-white rounded-xl max-w-xl w-full border border-slate-200 shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] flex flex-col">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-700 flex items-center justify-center">
              <Upload className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-slate-900">
                Upload & Impor Siswa Massal
              </h3>
              <p className="text-xs text-slate-500">
                Unggah file CSV/TXT atau tempel daftar nama siswa dari Excel
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
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <div className="p-6 space-y-4 overflow-y-auto flex-1">
            {/* Target Class Selection */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Pilih Kelas Tujuan
              </label>
              <select
                value={targetClassId}
                onChange={(e) => setTargetClassId(e.target.value)}
                className="w-full text-xs font-medium px-3 py-2 border border-slate-300 rounded-lg bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
              >
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            {/* File Upload Trigger */}
            <div className="border border-dashed border-slate-300 rounded-xl p-4 text-center bg-slate-50/60 hover:bg-slate-50 transition-colors">
              <label className="cursor-pointer block">
                <FileText className="w-6 h-6 text-indigo-600 mx-auto mb-1.5" />
                <span className="text-xs font-semibold text-slate-800 block">
                  {fileName ? `File terpilih: ${fileName}` : 'Klik untuk Unggah File (.csv / .txt)'}
                </span>
                <span className="text-[11px] text-slate-500 block mt-0.5">
                  Mendukung daftar nama dari Excel yang disimpan sebagai CSV
                </span>
                <input
                  type="file"
                  accept=".csv,.txt"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>
            </div>

            {/* Direct Paste Box */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-slate-700">
                  Atau Tempel / Ketik Daftar Nama Siswa:
                </label>
                {parsedNames.length > 0 && (
                  <span className="text-xs font-mono font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                    {parsedNames.length} siswa terdeteksi
                  </span>
                )}
              </div>
              <textarea
                rows={6}
                value={inputText}
                onChange={(e) => handleTextChange(e.target.value)}
                placeholder={"Contoh:\n1. Aditya Pratama\n2. Annisa Fitriani\n3. Bagus Setiawan\n(Bisa langsung salin satu kolom nama dari Excel)"}
                className="w-full text-xs font-mono px-3 py-2 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-indigo-500 leading-relaxed"
              />
            </div>

            {/* Parsed Preview */}
            {parsedNames.length > 0 && (
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-1.5">
                <span className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-indigo-600" />
                  Pratinjau Siswa yang Akan Diimpor ke {selectedClass?.name}:
                </span>
                <div className="max-h-28 overflow-y-auto divide-y divide-slate-100 text-xs">
                  {parsedNames.slice(0, 10).map((name, i) => (
                    <div key={i} className="py-1 flex items-center justify-between text-slate-800">
                      <span>{i + 1}. {name}</span>
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                    </div>
                  ))}
                  {parsedNames.length > 10 && (
                    <div className="py-1 text-slate-500 italic text-[11px]">
                      ...dan {parsedNames.length - 10} siswa lainnya.
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Modal Footer */}
          <div className="flex items-center justify-between p-4 border-t border-slate-100 bg-slate-50 shrink-0">
            <span className="text-xs text-slate-500">
              Total <strong>{parsedNames.length}</strong> siswa
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-3.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-200 rounded-lg transition-colors"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={parsedNames.length === 0}
                className="px-4 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg shadow-xs transition-colors"
              >
                Impor Siswa Sekarang
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
