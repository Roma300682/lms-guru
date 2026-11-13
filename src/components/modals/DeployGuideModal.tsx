import React, { useState } from 'react';
import { X, Check, Copy, ExternalLink, Zap, Globe, ArrowRight } from 'lucide-react';
import firebaseConfig from '../../../firebase-applet-config.json';

interface DeployGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const DeployGuideModal: React.FC<DeployGuideModalProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<'vercel' | 'aeonfree'>('vercel');
  const [copiedCmd, setCopiedCmd] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCmd(id);
    setTimeout(() => setCopiedCmd(null), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs">
      <div className="bg-white rounded-xl max-w-xl w-full border border-slate-200 shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 shrink-0">
          <div>
            <h3 className="text-base font-semibold text-slate-900">
              Panduan Deploy Aplikasi
            </h3>
            <p className="text-xs text-slate-500">
              Pilih platform hosting gratis yang ingin Anda gunakan
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="grid grid-cols-2 p-1.5 bg-slate-100 border-b border-slate-200 shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('vercel')}
            className={`flex items-center justify-center gap-1.5 py-2 text-xs font-semibold rounded-lg transition-all ${
              activeTab === 'vercel'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Zap className="w-3.5 h-3.5 text-indigo-600" />
            <span>Vercel (Sangat Direkomendasikan)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('aeonfree')}
            className={`flex items-center justify-center gap-1.5 py-2 text-xs font-semibold rounded-lg transition-all ${
              activeTab === 'aeonfree'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Globe className="w-3.5 h-3.5 text-emerald-600" />
            <span>Aeonfree / cPanel</span>
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4 overflow-y-auto text-xs text-slate-700 leading-relaxed">
          {activeTab === 'vercel' ? (
            <div className="space-y-4">
              <div className="bg-indigo-50/70 border border-indigo-200 rounded-lg p-3 text-indigo-900 space-y-1">
                <span className="font-semibold block text-indigo-950 flex items-center gap-1">
                  <Zap className="w-3.5 h-3.5 text-indigo-600" />
                  Mengapa Vercel Jauh Lebih Baik & Bebas Blank?
                </span>
                <p>
                  Vercel dirancang khusus untuk React & Vite. Server Vercel secara otomatis mengatur header MIME type JavaScript dengan sempurna, sehingga <strong>tidak akan pernah mengalami blank putih</strong> seperti di hosting cPanel jadul.
                </p>
              </div>

              <div className="space-y-3">
                <h4 className="font-semibold text-slate-900 text-xs uppercase tracking-wider">
                  Cara 1: Deploy Instan Lewat GitHub (Paling Mudah)
                </h4>
                <ol className="list-decimal list-inside space-y-2 pl-1">
                  <li>
                    Unggah kode proyek ini ke repositori <strong>GitHub</strong> Anda.
                  </li>
                  <li>
                    Buka{' '}
                    <a
                      href="https://vercel.com"
                      target="_blank"
                      rel="noreferrer"
                      className="text-indigo-600 font-semibold inline-flex items-center gap-0.5 hover:underline"
                    >
                      vercel.com <ExternalLink className="w-3 h-3" />
                    </a>{' '}
                    dan login menggunakan akun GitHub Anda.
                  </li>
                  <li>
                    Klik tombol <strong>"Add New Project"</strong> lalu pilih repositori proyek Anda.
                  </li>
                  <li>
                    Vercel akan otomatis mendeteksi framework <strong>Vite</strong> dan konfigurasi file{' '}
                    <code className="font-mono bg-slate-100 px-1 py-0.5 rounded text-slate-800">vercel.json</code> yang sudah kami sertakan.
                  </li>
                  <li>
                    Klik tombol <strong>"Deploy"</strong>. Selesai! Web Anda langsung online dengan domain gratis (contoh: <code className="font-mono text-indigo-700 bg-indigo-50 px-1 py-0.5 rounded">https://gurumapel.vercel.app</code>) dengan sertifikat SSL HTTPS resmi.
                  </li>
                </ol>
              </div>

              <div className="border-t border-slate-200 pt-3 space-y-2">
                <h4 className="font-semibold text-slate-900 text-xs uppercase tracking-wider">
                  Cara 2: Deploy Cepat via Terminal Komputer (Vercel CLI)
                </h4>
                <p className="text-slate-600">
                  Jika Anda memiliki Node.js di komputer, cukup jalankan perintah berikut di folder proyek:
                </p>
                <div className="flex items-center justify-between bg-slate-900 text-slate-100 p-2.5 rounded-lg font-mono text-xs">
                  <span>npx vercel</span>
                  <button
                    type="button"
                    onClick={() => handleCopy('npx vercel', 'vercel-cli')}
                    className="flex items-center gap-1 text-[11px] text-slate-300 hover:text-white bg-slate-800 px-2 py-0.5 rounded transition-colors"
                  >
                    {copiedCmd === 'vercel-cli' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedCmd === 'vercel-cli' ? 'Tersalin' : 'Salin'}</span>
                  </button>
                </div>
                <p className="text-[11px] text-slate-500">
                  Ikuti panduan di layar terminal (tekan Enter untuk opsi default). Aplikasi akan langsung terpublikasi dalam hitungan detik.
                </p>
              </div>

              <div className="bg-amber-50 p-3 rounded-lg border border-amber-200 text-amber-900 text-[11px] space-y-1.5">
                <strong className="block">Penting Setelah Deploy ke Vercel (Agar Login Google &amp; Database Aktif):</strong>
                <ol className="list-decimal list-inside space-y-1">
                  <li>
                    Salin domain Vercel Anda (misal <code className="font-mono bg-white px-1 rounded border border-amber-200">lms-guru-kappa.vercel.app</code>).
                  </li>
                  <li>
                    Buka{' '}
                    <a
                      href={`https://console.firebase.google.com/project/${firebaseConfig.projectId}/authentication/settings`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-indigo-700 font-semibold underline inline-flex items-center gap-0.5"
                    >
                      Firebase Console &rarr; Authentication &rarr; Authorized domains <ExternalLink className="w-3 h-3" />
                    </a>
                    , klik <strong>Add domain</strong>, lalu tempel domain Vercel Anda.
                  </li>
                  <li>
                    Di Dashboard Vercel &rarr; <strong>Settings &rarr; Environment Variables</strong>, tambahkan <code className="font-mono bg-white px-1 rounded border border-amber-200">GEMINI_API_KEY</code> agar fitur <strong>Buat Soal AI</strong> berjalan di Vercel.
                  </li>
                </ol>
              </div>

              <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 text-[11px] text-slate-500">
                Konfigurasi <strong>vercel.json</strong> sudah siap di dalam proyek untuk menangani routing SPA dan API secara otomatis.
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="bg-amber-50 p-3 rounded-lg border border-amber-200 text-amber-900 text-[11px] space-y-1">
                <strong>Catatan penting untuk Aeonfree:</strong> Pastikan file <code className="font-mono bg-white px-1 py-0.5 rounded border border-amber-200">.htaccess</code> yang ada di dalam folder <code className="font-mono">dist/</code> ikut terunggah ke <code className="font-mono">htdocs</code> agar tidak terjadi error blank MIME type.
              </div>

              <ol className="list-decimal list-inside space-y-2.5">
                <li>
                  Jalankan build di terminal:
                  <div className="my-1.5 flex items-center justify-between bg-slate-900 text-slate-100 p-2 rounded-lg font-mono text-xs">
                    <span>npm run build</span>
                    <button
                      type="button"
                      onClick={() => handleCopy('npm run build', 'aeon-build')}
                      className="text-[11px] text-slate-300 hover:text-white bg-slate-800 px-2 py-0.5 rounded"
                    >
                      {copiedCmd === 'aeon-build' ? 'Tersalin' : 'Salin'}
                    </button>
                  </div>
                </li>
                <li>
                  Buka cPanel Aeonfree &rarr; Online File Manager.
                </li>
                <li>
                  Buka folder <strong>htdocs/</strong>. Centang "Show Hidden Files" di Settings File Manager.
                </li>
                <li>
                  Unggah seluruh isi folder <strong>dist/</strong> (yaitu <code className="font-mono">index.html</code>, folder <code className="font-mono">assets/</code>, dan <code className="font-mono">.htaccess</code>).
                </li>
              </ol>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t border-slate-100 bg-slate-50 shrink-0">
          <span className="text-[11px] text-slate-500">
            {activeTab === 'vercel' ? 'Status Vercel: Siap 100%' : 'Status Aeonfree: Siap'}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
