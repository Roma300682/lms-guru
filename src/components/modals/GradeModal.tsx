import React, { useState } from 'react';
import { useLMS } from '../../context/LMSContext';
import { Submission } from '../../types/lms';
import { X, ExternalLink, Check } from 'lucide-react';

interface GradeModalProps {
  submission: Submission | null;
  onClose: () => void;
}

export const GradeModal: React.FC<GradeModalProps> = ({ submission, onClose }) => {
  const { gradeSubmission, tasks } = useLMS();

  const [score, setScore] = useState<string>(
    submission?.score !== undefined ? String(submission.score) : '85'
  );
  const [note, setNote] = useState<string>(submission?.note || '');

  if (!submission) return null;

  const currentTask = tasks.find((t) => t.id === submission.taskId);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const numScore = parseFloat(score);
    if (isNaN(numScore)) return;

    gradeSubmission(submission.id, numScore, note);
    onClose();
  };

  const quickFeedbackPresets = [
    'Penjelasan sangat lengkap, tepat, dan rapi!',
    'Pemahaman konsep baik, terus pertahankan.',
    'Jawaban sudah cukup baik, perlu sedikit ketelitian.',
    'Perlu direvisi pada bagian analisis.',
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs">
      <div className="bg-white rounded-xl max-w-lg w-full border border-slate-200 shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div>
            <h3 className="text-base font-semibold text-slate-900">
              Penilaian Tugas Siswa
            </h3>
            <p className="text-xs text-slate-500">
              {submission.studentName} · {currentTask?.title || 'Tugas'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSave} className="p-6 space-y-4">
          <div className="bg-slate-50 rounded-lg p-3.5 border border-slate-200 text-xs text-slate-700 space-y-2">
            <div className="flex items-center justify-between text-slate-500">
              <span>Waktu Pengumpulan:</span>
              <span className="font-mono">{submission.submittedAt}</span>
            </div>
            <div>
              <span className="font-medium text-slate-800 block mb-1">Hasil Pekerjaan Siswa:</span>
              <p className="bg-white p-2.5 rounded-md border border-slate-200 text-slate-800 whitespace-pre-wrap leading-relaxed">
                {submission.workText}
              </p>
            </div>
            {submission.linkAttachment && (
              <div className="pt-1">
                <a
                  href={submission.linkAttachment}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-indigo-600 hover:underline"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Buka Lampiran Tautan / File Siswa</span>
                </a>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Nilai (0 - 100)
              </label>
              <input
                type="number"
                min="0"
                max="100"
                required
                value={score}
                onChange={(e) => setScore(e.target.value)}
                className="w-full text-base font-bold font-mono px-3 py-2 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div className="sm:col-span-2 text-xs text-slate-500 pb-2">
              Kriteria ketuntasan (KKTP) umum: nilai $\ge 75$ tuntas.
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Catatan / Feedback Guru untuk Siswa
            </label>
            <textarea
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Berikan apresiasi atau catatan perbaikan..."
              className="w-full text-sm px-3 py-2 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <span className="block text-xs font-medium text-slate-500 mb-1.5">
              Template Cepat Feedback:
            </span>
            <div className="flex flex-wrap gap-1.5">
              {quickFeedbackPresets.map((preset, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setNote(preset)}
                  className="text-xs px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md transition-colors text-left"
                >
                  {preset}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
            >
              Batal
            </button>
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-xs transition-colors"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Simpan Nilai</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
