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

  const navItems: Array<{
    id: 'materi' | 'tugas' | 'soal-ai' | 'whatsapp' | 'siswa' | 'rekap';
    label: string;
    mobileLabel: string;
    icon?: React.ReactNode;
    activeClass: string;
  }> = [
    {
      id: 'materi',
      label: 'Materi Ajar',
      mobileLabel: 'Materi',
      activeClass: 'bg-slate-900 text-white md:bg-slate-100 md:text-slate-900 font-semibold',
    },
    {
      id: 'tugas',
      label: 'Tugas & Nilai',
      mobileLabel: 'Tugas',
      activeClass: 'bg-slate-900 text-white md:bg-slate-100 md:text-slate-900 font-semibold',
    },
    {
      id: 'soal-ai',
      label: 'Buat Soal AI',
      mobileLabel: 'Soal AI',
      icon: <Sparkles className="w-3.5 h-3.5 shrink-0" />,
      activeClass: 'bg-indigo-600 text-white md:bg-indigo-50 md:text-indigo-700 md:border md:border-indigo-200 font-semibold',
    },
    {
      id: 'whatsapp',
      label: 'WhatsApp',
      mobileLabel: 'WhatsApp',
      icon: <MessageCircle className="w-3.5 h-3.5 shrink-0" />,
      activeClass: 'bg-emerald-600 text-white md:bg-emerald-50 md:text-emerald-700 md:border md:border-emerald-200 font-semibold',
    },
    {
      id: 'siswa',
      label: 'Daftar Siswa',
      mobileLabel: 'Siswa',
      activeClass: 'bg-slate-900 text-white md:bg-slate-100 md:text-slate-900 font-semibold',
    },
    {
      id: 'rekap',
      label: 'Buku Nilai & Absensi',
      mobileLabel: 'Nilai & Absen',
      activeClass: 'bg-slate-900 text-white md:bg-slate-100 md:text-slate-900 font-semibold',
    },
  ];

  return (
    <header className="sticky top-0 z-30 bg-white border-b border-slate-200 print:hidden">
      <div className="max-w-6xl mx-auto px-3 sm:px-6 h-14 sm:h-16 flex items-center justify-between gap-2 sm:gap-4">
        {/* Zone 1: Brand title */}
        <div className="flex items-center gap-2.5 sm:gap-3 shrink-0 min-w-0">
          <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg bg-indigo-600 text-white flex items-center justify-center font-bold text-lg shadow-xs shrink-0">
            <GraduationCap className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
          <div className="min-w-0">
            <span className="text-sm sm:text-base font-bold tracking-tight text-slate-900 block leading-tight">
              GuruMapel
            </span>
            <span className="text-[11px] sm:text-xs text-slate-500 block truncate max-w-[110px] sm:max-w-[160px]">
              {teacher.subject}
            </span>
          </div>
        </div>

        {/* Zone 2: Desktop Navigation Links (Teacher Mode only) */}
        {viewMode === 'teacher' ? (
          <nav className="hidden md:flex items-center gap-1 lg:gap-2 overflow-x-auto no-scrollbar">
            {navItems.map((item) => {
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`inline-flex items-center gap-1 px-2.5 lg:px-3 py-1.5 text-xs lg:text-sm font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                    isActive
                      ? item.activeClass
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                  }`}
                >
                  {item.icon}
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
        ) : (
          <div className="text-xs text-slate-600 flex items-center gap-2 min-w-0">
            <span className="font-semibold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 truncate max-w-[140px] sm:max-w-none">
              Siswa: {currentStudent ? currentStudent.name : 'Siswa'}
            </span>
            <span aria-hidden="true" className="hidden sm:inline">·</span>
            <span className="hidden sm:inline truncate">{teacher.subject}</span>
          </div>
        )}

        {/* Zone 3: Actions & Logout */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {viewMode === 'teacher' ? (
            <>
              <button
                onClick={onOpenProfile}
                className="flex items-center gap-1.5 p-1.5 md:px-3 md:py-1.5 text-xs text-slate-700 hover:text-slate-900 hover:bg-slate-50 rounded-lg border border-slate-200 transition-colors"
                title="Panel Pengaturan Guru & Administrator"
              >
                <ShieldCheck className="w-4 h-4 md:w-3.5 md:h-3.5 text-indigo-600" />
                <span className="hidden md:inline truncate max-w-[110px] font-medium">{teacher.name}</span>
                <span className="hidden lg:inline text-[10px] bg-slate-100 text-slate-700 px-1.5 py-0.2 rounded font-semibold uppercase">
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
                className="flex items-center gap-1 px-2.5 sm:px-3 py-1.5 text-xs font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200 hover:bg-indigo-100 rounded-lg transition-colors whitespace-nowrap"
                title="Pratinjau tampilan yang dilihat siswa"
              >
                <UserCheck className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Pratinjau</span>
                <span>Siswa</span>
              </button>
            </>
          ) : (
            authSession?.role === 'teacher' && (
              <button
                onClick={() => setViewMode('teacher')}
                className="flex items-center gap-1 px-2.5 sm:px-3 py-1.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg shadow-xs transition-colors whitespace-nowrap"
              >
                <GraduationCap className="w-3.5 h-3.5" />
                <span>Ruang Guru</span>
              </button>
            )
          )}

          {/* Logout button */}
          <button
            onClick={() => {
              logout();
            }}
            className="flex items-center gap-1 p-1.5 sm:px-2.5 sm:py-1.5 text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50 rounded-lg border border-rose-200 transition-colors"
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

      {/* Dedicated Mobile Navigation Strip (Teacher Mode) */}
      {viewMode === 'teacher' && (
        <nav className="md:hidden border-t border-slate-100 bg-slate-50/80 px-3 py-2 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                  isActive
                    ? item.activeClass
                    : 'bg-white text-slate-600 border border-slate-200 hover:text-slate-900'
                }`}
              >
                {item.icon}
                <span>{item.mobileLabel}</span>
              </button>
            );
          })}
        </nav>
      )}
    </header>
  );
};
