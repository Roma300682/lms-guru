import React from 'react';
import { MaterialAttachment, MaterialFileType } from '../types/lms';
import { FileText, FileSpreadsheet, File, Image as ImageIcon, Download, Eye, X } from 'lucide-react';

interface FileAttachmentBadgeProps {
  attachment: MaterialAttachment;
  onRemove?: () => void;
  showDownload?: boolean;
}

export const getFileTypeInfo = (type: MaterialFileType) => {
  switch (type) {
    case 'pdf':
      return {
        label: 'PDF Document',
        badgeText: 'PDF',
        bgColor: 'bg-rose-50',
        borderColor: 'border-rose-200',
        textColor: 'text-rose-700',
        badgeBg: 'bg-rose-100 text-rose-800',
        icon: FileText,
      };
    case 'word':
      return {
        label: 'Dokumen Word',
        badgeText: 'WORD',
        bgColor: 'bg-blue-50',
        borderColor: 'border-blue-200',
        textColor: 'text-blue-700',
        badgeBg: 'bg-blue-100 text-blue-800',
        icon: FileText,
      };
    case 'excel':
      return {
        label: 'Lembar Kerja Excel',
        badgeText: 'EXCEL',
        bgColor: 'bg-emerald-50',
        borderColor: 'border-emerald-200',
        textColor: 'text-emerald-700',
        badgeBg: 'bg-emerald-100 text-emerald-800',
        icon: FileSpreadsheet,
      };
    case 'image':
      return {
        label: 'Foto / Gambar Tugas',
        badgeText: 'FOTO',
        bgColor: 'bg-indigo-50',
        borderColor: 'border-indigo-200',
        textColor: 'text-indigo-700',
        badgeBg: 'bg-indigo-100 text-indigo-800',
        icon: ImageIcon,
      };
    default:
      return {
        label: 'Dokumen Lampiran',
        badgeText: 'FILE',
        bgColor: 'bg-slate-50',
        borderColor: 'border-slate-200',
        textColor: 'text-slate-700',
        badgeBg: 'bg-slate-200 text-slate-800',
        icon: File,
      };
  }
};

export const detectFileType = (fileName: string, mimeType?: string): MaterialFileType => {
  const ext = fileName.toLowerCase().split('.').pop() || '';
  if (ext === 'pdf' || mimeType?.includes('pdf')) return 'pdf';
  if (['doc', 'docx'].includes(ext) || mimeType?.includes('word') || mimeType?.includes('msword')) return 'word';
  if (['xls', 'xlsx', 'csv'].includes(ext) || mimeType?.includes('excel') || mimeType?.includes('spreadsheet')) return 'excel';
  if (['jpg', 'jpeg', 'png', 'webp', 'gif', 'heic'].includes(ext) || mimeType?.startsWith('image/')) return 'image';
  return 'other';
};

export const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
};

/**
 * Compresses an uploaded image dataUrl via canvas so smartphone photos fit cleanly
 * inside Firestore's single-document sync limit while remaining crisp and legible.
 */
export const readFileAsAttachment = (file: File): Promise<MaterialAttachment> => {
  return new Promise((resolve, reject) => {
    const type = detectFileType(file.name, file.type);
    const reader = new FileReader();

    reader.onerror = () => reject(new Error('Gagal membaca berkas. Silakan coba lagi.'));
    reader.onload = (event) => {
      const rawDataUrl = event.target?.result as string;
      if (!rawDataUrl) {
        reject(new Error('Berkas kosong atau tidak terbaca.'));
        return;
      }

      if (type !== 'image' || rawDataUrl.length <= 450000) {
        resolve({
          name: file.name,
          size: formatFileSize(file.size),
          type,
          dataUrl: rawDataUrl,
        });
        return;
      }

      const img = new window.Image();
      img.onerror = () => {
        resolve({
          name: file.name,
          size: formatFileSize(file.size),
          type,
          dataUrl: rawDataUrl,
        });
      };
      img.onload = () => {
        const MAX_DIM = 1400;
        let { width, height } = img;
        if (width > MAX_DIM || height > MAX_DIM) {
          if (width >= height) {
            height = Math.round((height * MAX_DIM) / width);
            width = MAX_DIM;
          } else {
            width = Math.round((width * MAX_DIM) / height);
            height = MAX_DIM;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve({
            name: file.name,
            size: formatFileSize(file.size),
            type,
            dataUrl: rawDataUrl,
          });
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        const compressedUrl = canvas.toDataURL('image/jpeg', 0.78);
        const finalUrl = compressedUrl.length < rawDataUrl.length ? compressedUrl : rawDataUrl;
        const approxBytes = Math.round((finalUrl.length * 3) / 4);
        resolve({
          name: file.name,
          size: formatFileSize(approxBytes),
          type,
          dataUrl: finalUrl,
        });
      };
      img.src = rawDataUrl;
    };

    reader.readAsDataURL(file);
  });
};

export const FileAttachmentBadge: React.FC<FileAttachmentBadgeProps> = ({
  attachment,
  onRemove,
  showDownload = true,
}) => {
  const info = getFileTypeInfo(attachment.type);
  const Icon = info.icon;

  return (
    <div
      className={`rounded-xl border ${info.bgColor} ${info.borderColor} transition-all overflow-hidden`}
    >
      <div className="flex items-center justify-between gap-3 p-3">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div
            className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 border ${info.borderColor} bg-white ${info.textColor}`}
          >
            <Icon className="w-5 h-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span
                className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider ${info.badgeBg}`}
              >
                {info.badgeText}
              </span>
              <span className="text-[11px] text-slate-500 font-medium">{attachment.size}</span>
            </div>
            <p
              className="text-xs font-semibold text-slate-800 truncate mt-0.5"
              title={attachment.name}
            >
              {attachment.name}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {showDownload && attachment.dataUrl && (
            <>
              {(attachment.type === 'pdf' || attachment.type === 'image') && (
                <a
                  href={attachment.dataUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors shadow-2xs"
                  title="Buka Lampiran"
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Buka</span>
                </a>
              )}
              <a
                href={attachment.dataUrl}
                download={attachment.name}
                className={`inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-white rounded-lg shadow-2xs transition-colors ${
                  attachment.type === 'pdf'
                    ? 'bg-rose-600 hover:bg-rose-700'
                    : attachment.type === 'word'
                    ? 'bg-blue-600 hover:bg-blue-700'
                    : attachment.type === 'excel'
                    ? 'bg-emerald-600 hover:bg-emerald-700'
                    : attachment.type === 'image'
                    ? 'bg-indigo-600 hover:bg-indigo-700'
                    : 'bg-slate-800 hover:bg-slate-900'
                }`}
                title="Unduh Berkas ke Komputer / HP"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Unduh File</span>
              </a>
            </>
          )}

          {onRemove && (
            <button
              type="button"
              onClick={onRemove}
              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-white rounded-lg transition-colors"
              title="Hapus Lampiran"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {attachment.type === 'image' && attachment.dataUrl && (
        <div className="px-3 pb-3">
          <img
            src={attachment.dataUrl}
            alt={attachment.name}
            className="max-h-56 w-auto rounded-lg border border-indigo-200 bg-white object-contain"
          />
        </div>
      )}
    </div>
  );
};
