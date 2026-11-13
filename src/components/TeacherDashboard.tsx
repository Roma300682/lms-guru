import React, { useState } from 'react';
import { useLMS } from '../context/LMSContext';
import { MateriTab } from './tabs/MateriTab';
import { TugasTab } from './tabs/TugasTab';
import { BuatSoalAITab } from './tabs/BuatSoalAITab';
import { WhatsAppTab } from './tabs/WhatsAppTab';
import { SiswaTab } from './tabs/SiswaTab';
import { RekapTab } from './tabs/RekapTab';
import { WhatsAppPrefill } from '../types/lms';
import { Users, Settings, BookOpen, Upload } from 'lucide-react';
import { UploadStudentsModal } from './modals/UploadStudentsModal';

interface TeacherDashboardProps {
  activeTab: 'materi' | 'tugas' | 'soal-ai' | 'whatsapp' | 'siswa' | 'rekap';
  onOpenProfile: () => void;
  onNavigateTab?: (tab: 'materi' | 'tugas' | 'soal-ai' | 'whatsapp' | 'siswa' | 'rekap') => void;
}

export const TeacherDashboard: React.FC<TeacherDashboardProps> = ({
  activeTab,
  onOpenProfile,
  onNavigateTab,
}) => {
  const {
    teacher,
    teacherSubjects,
    availableSubjects,
    classes,
    students,
    activeClassId,
    setActiveClassId,
    activeSubject,
    setActiveSubject,
  } = useLMS();
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [waPrefill, setWaPrefill] = useState<WhatsAppPrefill | null>(null);

  const handleShareToWhatsApp = (prefill: WhatsAppPrefill) => {
    setWaPrefill(prefill);
    if (onNavigateTab) {
      onNavigateTab('whatsapp');
    }
  };

  return (
    <div className="space-y-5">
      {/* Subject & Class Quick Bar */}
      <div className="bg-white rounded-xl border border-slate-200 p-3.5 sm:p-4 shadow-xs space-y-3 print:hidden">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 sm:gap-4">
          {/* Left: Subject & Teacher Info */}
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-700 shrink-0">
              <BookOpen className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                <h1 className="text-sm sm:text-base font-bold text-slate-900 leading-tight truncate">
                  {teacherSubjects.length > 0 ? teacherSubjects.join(' · ') : teacher.subject}
                </h1>
                <span className="text-xs text-slate-500 truncate">· {teacher.name}</span>
              </div>
              <p className="text-[11px] sm:text-xs text-slate-500 flex items-center gap-1.5 mt-0.5">
                <Users className="w-3.5 h-3.5 shrink-0" />
                <span>
                  <strong>{students.length}</strong> siswa aktif di <strong>{classes.length}</strong> rombel
                </span>
              </p>
            </div>
          </div>

          {/* Right: Class Switcher (Filter by Class) */}
          <div className="flex items-center gap-1.5 bg-slate-50 p-1.5 rounded-lg border border-slate-200 overflow-x-auto no-scrollbar sm:flex-wrap">
            <span className="hidden sm:inline text-[11px] font-semibold text-slate-500 uppercase tracking-wider px-2 shrink-0">
              Kelas:
            </span>

            <button
              onClick={() => setActiveClassId('all')}
              className={`px-3 py-1.5 sm:py-1 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 ${
                activeClassId === 'all'
                  ? 'bg-white text-indigo-700 shadow-xs border border-slate-200'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Semua
            </button>

            {classes.length === 0 ? (
              <button
                onClick={onOpenProfile}
                className="text-xs text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 px-2.5 py-1.5 sm:py-1 rounded-md font-medium transition-colors whitespace-nowrap shrink-0"
              >
                + Tambah Kelas
              </button>
            ) : (
              classes.map((c) => {
                const count = students.filter((s) => s.classId === c.id).length;
                const isActive = activeClassId === c.id;
                return (
                  <button
                    key={c.id}
                    onClick={() => setActiveClassId(c.id)}
                    className={`px-3 py-1.5 sm:py-1 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 ${
                      isActive
                        ? 'bg-white text-indigo-700 shadow-xs border border-slate-200'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {c.name}{' '}
                    <span className="text-[10px] font-normal text-slate-400">({count})</span>
                  </button>
                );
              })
            )}

            <button
              onClick={() => setIsUploadOpen(true)}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 sm:py-1 text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-md transition-colors ml-auto sm:ml-1 whitespace-nowrap shrink-0"
              title="Upload Data Siswa Massal (CSV/Excel)"
            >
              <Upload className="w-3 h-3" />
              <span>Upload</span>
            </button>

            <button
              onClick={onOpenProfile}
              className="p-1.5 sm:p-1 text-slate-400 hover:text-slate-700 rounded-md hover:bg-slate-200 transition-colors shrink-0"
              title="Panel Pengaturan Guru & Admin"
            >
              <Settings className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Multi-Subject Filter Strip */}
        <div className="flex items-center gap-1.5 bg-slate-50/80 px-2 py-1.5 rounded-lg border border-slate-200/80 overflow-x-auto no-scrollbar sm:flex-wrap">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider px-1.5 shrink-0">
            Mapel:
          </span>

          <button
            type="button"
            onClick={() => setActiveSubject('all')}
            className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 ${
              activeSubject === 'all'
                ? 'bg-white text-indigo-700 shadow-xs border border-slate-200'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Semua Mapel
          </button>

          {availableSubjects.map((subj) => {
            const isSelected = activeSubject.toLowerCase() === subj.toLowerCase();
            return (
              <button
                key={subj}
                type="button"
                onClick={() => setActiveSubject(subj)}
                className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 ${
                  isSelected
                    ? 'bg-white text-indigo-700 shadow-xs border border-slate-200'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {subj}
              </button>
            );
          })}

          <button
            type="button"
            onClick={onOpenProfile}
            className="text-[11px] font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 px-2.5 py-1 rounded-md transition-colors ml-auto whitespace-nowrap shrink-0"
          >
            + Atur Mapel
          </button>
        </div>
      </div>

      {/* Main Tab Content */}
      <main>
        {activeTab === 'materi' && (
          <MateriTab onShareToWhatsApp={handleShareToWhatsApp} />
        )}
        {activeTab === 'tugas' && (
          <TugasTab onShareToWhatsApp={handleShareToWhatsApp} />
        )}
        {activeTab === 'soal-ai' && (
          <BuatSoalAITab
            onNavigateToTasks={onNavigateTab ? () => onNavigateTab('tugas') : undefined}
          />
        )}
        {activeTab === 'whatsapp' && (
          <WhatsAppTab
            prefill={waPrefill}
            onClearPrefill={() => setWaPrefill(null)}
          />
        )}
        {activeTab === 'siswa' && <SiswaTab />}
        {activeTab === 'rekap' && <RekapTab />}
      </main>

      <UploadStudentsModal
        isOpen={isUploadOpen}
        onClose={() => setIsUploadOpen(false)}
        defaultClassId={activeClassId}
        onSuccess={() => {
          if (onNavigateTab) {
            onNavigateTab('siswa');
          }
        }}
      />
    </div>
  );
};
