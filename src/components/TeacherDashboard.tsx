import React, { useState } from 'react';
import { useLMS } from '../context/LMSContext';
import { MateriTab } from './tabs/MateriTab';
import { TugasTab } from './tabs/TugasTab';
import { BuatSoalAITab } from './tabs/BuatSoalAITab';
import { WhatsAppTab } from './tabs/WhatsAppTab';
import { SiswaTab } from './tabs/SiswaTab';
import { RekapTab } from './tabs/RekapTab';
import { CbtGuruTab } from './tabs/CbtGuruTab';
import { WhatsAppPrefill } from '../types/lms';
import {
  Users,
  Settings,
  BookOpen,
  Upload,
  ClipboardList,
  Sparkles,
  MonitorCheck,
  MessageCircle,
  Award,
  X,
} from 'lucide-react';
import { UploadStudentsModal } from './modals/UploadStudentsModal';

type TeacherTabId = 'materi' | 'tugas' | 'soal-ai' | 'cbt' | 'whatsapp' | 'siswa' | 'rekap';

interface TeacherDashboardProps {
  activeTab: TeacherTabId;
  onOpenProfile: () => void;
  onNavigateTab?: (tab: TeacherTabId) => void;
  isMobileSidebarOpen?: boolean;
  onCloseMobileSidebar?: () => void;
}

export const TeacherDashboard: React.FC<TeacherDashboardProps> = ({
  activeTab,
  onOpenProfile,
  onNavigateTab,
  isMobileSidebarOpen = false,
  onCloseMobileSidebar,
}) => {
  const {
    teacher,
    classes,
    students,
    materials,
    tasks,
    questionSets,
    cbtExams,
    activeClassId,
    setActiveClassId,
  } = useLMS();
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [waPrefill, setWaPrefill] = useState<WhatsAppPrefill | null>(null);

  const selectedClassObj = activeClassId !== 'all' ? classes.find((c) => c.id === activeClassId) : undefined;
  const fallbackSubject = teacher.subject?.split(',')[0]?.trim() || 'Mata Pelajaran';
  const activeCbtCount = cbtExams.filter((ex) => ex.isActive).length;

  const handleSelectTab = (tab: TeacherTabId) => {
    if (onNavigateTab) {
      onNavigateTab(tab);
    }
    if (onCloseMobileSidebar) {
      onCloseMobileSidebar();
    }
  };

  const handleShareToWhatsApp = (prefill: WhatsAppPrefill) => {
    setWaPrefill(prefill);
    handleSelectTab('whatsapp');
  };

  const sidebarItems: Array<{
    id: TeacherTabId;
    label: string;
    icon: React.ReactNode;
    badge?: string | number;
    badgeHighlight?: boolean;
    activeClass: string;
  }> = [
    {
      id: 'materi',
      label: 'Materi Ajar',
      icon: <BookOpen className="w-4 h-4 shrink-0" />,
      badge: materials.length,
      activeClass: 'bg-slate-900 text-white shadow-xs',
    },
    {
      id: 'tugas',
      label: 'Tugas & Nilai',
      icon: <ClipboardList className="w-4 h-4 shrink-0" />,
      badge: tasks.length,
      activeClass: 'bg-slate-900 text-white shadow-xs',
    },
    {
      id: 'soal-ai',
      label: 'Buat Soal AI',
      icon: <Sparkles className="w-4 h-4 shrink-0" />,
      badge: questionSets.length,
      activeClass: 'bg-indigo-600 text-white shadow-xs',
    },
    {
      id: 'cbt',
      label: 'CBT & Hasil',
      icon: <MonitorCheck className="w-4 h-4 shrink-0" />,
      badge: activeCbtCount > 0 ? `${activeCbtCount} Aktif` : cbtExams.length,
      badgeHighlight: activeCbtCount > 0,
      activeClass: 'bg-emerald-600 text-white shadow-xs',
    },
    {
      id: 'whatsapp',
      label: 'WhatsApp',
      icon: <MessageCircle className="w-4 h-4 shrink-0" />,
      activeClass: 'bg-emerald-600 text-white shadow-xs',
    },
    {
      id: 'siswa',
      label: 'Daftar Siswa',
      icon: <Users className="w-4 h-4 shrink-0" />,
      badge: students.length,
      activeClass: 'bg-slate-900 text-white shadow-xs',
    },
    {
      id: 'rekap',
      label: 'Buku Nilai & Absensi',
      icon: <Award className="w-4 h-4 shrink-0" />,
      activeClass: 'bg-slate-900 text-white shadow-xs',
    },
  ];

  const renderSidebarNav = () => (
    <div className="bg-white rounded-xl border border-slate-200 p-3 shadow-xs space-y-1">
      <div className="px-2.5 pt-1 pb-2 text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
        <span>Menu Ruang Guru</span>
        {onCloseMobileSidebar && (
          <button
            type="button"
            onClick={onCloseMobileSidebar}
            className="md:hidden p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100"
            aria-label="Tutup Menu"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {sidebarItems.map((item) => {
        const isActive = activeTab === item.id;
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => handleSelectTab(item.id)}
            className={`w-full flex items-center justify-between gap-2 px-3 py-2.5 text-xs font-semibold rounded-lg transition-colors text-left ${
              isActive
                ? item.activeClass
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/80'
            }`}
          >
            <span className="flex items-center gap-2.5 min-w-0">
              {item.icon}
              <span className="truncate">{item.label}</span>
            </span>
            {item.badge !== undefined && (
              <span
                className={`text-[10px] font-mono px-1.5 py-0.5 rounded-md shrink-0 ${
                  isActive
                    ? 'bg-white/20 text-white'
                    : item.badgeHighlight
                    ? 'bg-emerald-100 text-emerald-800 font-bold'
                    : 'bg-slate-100 text-slate-600'
                }`}
              >
                {item.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );

  return (
    <div className="flex flex-col md:flex-row gap-5 items-start">
      {/* Desktop / Tablet Sticky Left Sidebar */}
      <aside className="hidden md:block w-56 lg:w-60 shrink-0 md:sticky md:top-20 print:hidden">
        {renderSidebarNav()}
      </aside>

      {/* Mobile Left Slide-Over Drawer */}
      {isMobileSidebarOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex print:hidden">
          <div
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs"
            onClick={onCloseMobileSidebar}
          />
          <aside className="relative w-72 max-w-[82vw] h-full bg-slate-50 p-3 overflow-y-auto shadow-xl z-10 animate-in slide-in-from-left duration-150">
            {renderSidebarNav()}
          </aside>
        </div>
      )}

      {/* Right Main Content Column */}
      <div className="flex-1 min-w-0 w-full space-y-5">
        {/* Subject & Class Quick Bar */}
        <div className="bg-white rounded-xl border border-slate-200 p-3.5 sm:p-4 shadow-xs space-y-3 print:hidden">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 sm:gap-4">
            {/* Left: Target Class Subject & Teacher Info */}
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-700 shrink-0">
                <BookOpen className="w-4 h-4 sm:w-5 sm:h-5" />
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                  <h1 className="text-sm sm:text-base font-bold text-slate-900 leading-tight truncate">
                    {selectedClassObj
                      ? `${selectedClassObj.name} · ${selectedClassObj.subject?.trim() || fallbackSubject}`
                      : classes.length > 0
                      ? `Semua Rombel (${classes.length} Kelas)`
                      : fallbackSubject}
                  </h1>
                  <span className="text-xs text-slate-500 truncate">· {teacher.name}</span>
                </div>
                <p className="text-[11px] sm:text-xs text-slate-500 flex items-center gap-1.5 mt-0.5">
                  <Users className="w-3.5 h-3.5 shrink-0" />
                  <span>
                    {selectedClassObj ? (
                      <>
                        <strong>{students.filter((s) => s.classId === selectedClassObj.id).length}</strong> siswa di kelas ini
                        {!selectedClassObj.subject?.trim() && (
                          <button
                            type="button"
                            onClick={onOpenProfile}
                            className="ml-2 text-indigo-600 hover:underline font-medium"
                          >
                            (Atur Mapel Kelas)
                          </button>
                        )}
                      </>
                    ) : (
                      <>
                        <strong>{students.length}</strong> siswa aktif di <strong>{classes.length}</strong> rombel (pilih kelas untuk memisahkan mapel)
                      </>
                    )}
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
                      {c.name}
                      {c.subject?.trim() && (
                        <span className="text-[10px] font-medium text-indigo-600 ml-1">
                          · {c.subject.trim()}
                        </span>
                      )}{' '}
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
              onNavigateToTasks={() => handleSelectTab('tugas')}
              onNavigateToCbt={() => handleSelectTab('cbt')}
            />
          )}
          {activeTab === 'cbt' && (
            <CbtGuruTab
              onNavigateToSoalAI={() => handleSelectTab('soal-ai')}
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
      </div>

      <UploadStudentsModal
        isOpen={isUploadOpen}
        onClose={() => setIsUploadOpen(false)}
        defaultClassId={activeClassId}
        onSuccess={() => {
          handleSelectTab('siswa');
        }}
      />
    </div>
  );
};
