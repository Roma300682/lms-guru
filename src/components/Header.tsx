import React from 'react';
import { useLMS } from '../context/LMSContext';
import { GraduationCap, UserCheck, BookOpen, LogOut, RotateCcw, Cloud, ShieldCheck, Sparkles, MessageCircle } from 'lucide-react';

interface HeaderProps {
  activeTab: 'materi' | 'tugas' | 'soal-ai' | 'whatsapp' | 'siswa' | 'rekap';
  setActiveTab: (tab: 'materi' | 'tugas' | 'soal-ai' | 'whatsapp' | 'siswa' | 'rekap') => void;
  onOpenProfile: () => void;
  onOpenDeployGuide?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ activeTab, setActiveTab, onOpenProfile, onOpenDeployGuide }) => {
  const { viewMode, setViewMode, teacher, resetData, authSession, logout, students, currentStudentId } = useLMS();

  const currentStudent = students.find((s) => s.id === currentStudentId);

  return (
    <header className="sticky top-0 z-30 bg-white border-b border-slate-200">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
        {/* Zone 1: Brand title */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="w-9 h-9 rounded-lg bg-indigo-600 text-white flex items-center justify-center font-bold text-lg shadow-xs">
            <GraduationCap className="w-5 h-5" />
          </div>
          <div>
            <span className="text-base font-bold tracking-tight text-slate-900 block leading-tight">
              GuruMapel
            </span>
            <span className="text-xs text-slate-500 block">
              {teacher.subject}
            </span>
          </div>
        </div>

        {/* Zone 2: Navigation Links (Teacher Mode only) */}
        {viewMode === 'teacher' ? (
          <nav className="flex items-center gap-1 sm:gap-2 overflow-x-auto">
            <button
              onClick={() => setActiveTab('materi')}
              className={`px-2.5 sm:px-3 py-1.5 text-xs sm:text-sm font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                activeTab === 'materi'
                  ? 'bg-slate-100 text-slate-900 font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Materi Ajar
            </button>
            <button
              onClick={() => setActiveTab('tugas')}
              className={`px-2.5 sm:px-3 py-1.5 text-xs sm:text-sm font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                activeTab === 'tugas'
                  ? 'bg-slate-100 text-slate-900 font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Tugas & Nilai
            </button>
            <button
              onClick={() => setActiveTab('soal-ai')}
              className={`inline-flex items-center gap-1 px-2.5 sm:px-3 py-1.5 text-xs sm:text-sm font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                activeTab === 'soal-ai'
                  ? 'bg-indigo-50 text-indigo-700 font-semibold border border-indigo-200'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
              <span>Buat Soal AI</span>
            </button>
            <button
              onClick={() => setActiveTab('whatsapp')}
              className={`inline-flex items-center gap-1 px-2.5 sm:px-3 py-1.5 text-xs sm:text-sm font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                activeTab === 'whatsapp'
                  ? 'bg-emerald-50 text-emerald-700 font-semibold border border-emerald-200'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <MessageCircle className="w-3.5 h-3.5 text-emerald-600" />
              <span>WhatsApp</span>
            </button>
            <button
              onClick={() => setActiveTab('siswa')}
              className={`px-2.5 sm:px-3 py-1.5 text-xs sm:text-sm font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                activeTab === 'siswa'
                  ? 'bg-slate-100 text-slate-900 font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Daftar Siswa
            </button>
            <button
              onClick={() => setActiveTab('rekap')}
              className={`px-2.5 sm:px-3 py-1.5 text-xs sm:text-sm font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                activeTab === 'rekap'
                  ? 'bg-slate-100 text-slate-900 font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Buku Nilai & Absensi
            </button>
          </nav>
        ) : (
          <div className="text-xs text-slate-600 flex items-center gap-2">
            <span className="font-semibold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
              Siswa: {currentStudent ? currentStudent.name : 'Siswa'}
            </span>
            <span aria-hidden="true" className="hidden sm:inline">·</span>
            <span className="hidden sm:inline">{teacher.subject}</span>
          </div>
        )}

        {/* Zone 3: Actions & Logout */}
        <div className="flex items-center gap-2 shrink-0">
          {viewMode === 'teacher' ? (
            <>
              <button
                onClick={onOpenProfile}
                className="hidden md:flex items-center gap-1.5 px-3 py-1.5 text-xs text-slate-700 hover:text-slate-900 hover:bg-slate-50 rounded-lg border border-slate-200 transition-colors"
                title="Panel Pengaturan Guru & Administrator"
              >
                <ShieldCheck className="w-3.5 h-3.5 text-indigo-600" />
                <span className="truncate max-w-[130px] font-medium">{teacher.name}</span>
                <span className="text-[10px] bg-slate-100 text-slate-700 px-1.5 py-0.2 rounded font-semibold uppercase">
                  Admin
                </span>
              </button>

              <button
                onClick={onOpenDeployGuide}
                className="hidden lg:flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-lg transition-colors whitespace-nowrap"
                title="Panduan Deploy ke Vercel atau Hosting"
              >
                <Cloud className="w-3.5 h-3.5" />
                <span>Deploy Vercel</span>
              </button>

              <button
                onClick={() => setViewMode('student')}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200 hover:bg-indigo-100 rounded-lg transition-colors whitespace-nowrap"
                title="Pratinjau tampilan yang dilihat siswa"
              >
                <UserCheck className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Pratinjau</span> Siswa
              </button>
            </>
          ) : (
            authSession?.role === 'teacher' && (
              <button
                onClick={() => setViewMode('teacher')}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg shadow-xs transition-colors whitespace-nowrap"
              >
                <GraduationCap className="w-3.5 h-3.5" />
                <span>Ke Ruang Guru</span>
              </button>
            )
          )}

          {/* Logout button */}
          <button
            onClick={() => {
              logout();
            }}
            className="flex items-center gap-1 p-1.5 text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50 rounded-lg border border-rose-200 transition-colors"
            title="Keluar / Ganti Akun"
          >
            <LogOut className="w-4 h-4" />
            <span className="hidden md:inline font-medium">Keluar</span>
          </button>

          <button
            onClick={() => {
              if (confirm('Muat ulang data contoh awal? Perubahan lokal akan dikembalikan ke data bawaan.')) {
                resetData();
              }
            }}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-md hover:bg-slate-100"
            title="Reset ke data contoh"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
};
