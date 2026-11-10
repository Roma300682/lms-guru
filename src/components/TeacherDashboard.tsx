import React from 'react';
import { useLMS } from '../context/LMSContext';
import { MateriTab } from './tabs/MateriTab';
import { TugasTab } from './tabs/TugasTab';
import { RekapTab } from './tabs/RekapTab';
import { Users, Settings, BookOpen } from 'lucide-react';

interface TeacherDashboardProps {
  activeTab: 'materi' | 'tugas' | 'rekap';
  onOpenProfile: () => void;
}

export const TeacherDashboard: React.FC<TeacherDashboardProps> = ({ activeTab, onOpenProfile }) => {
  const { teacher, classes, students, activeClassId, setActiveClassId } = useLMS();

  return (
    <div className="space-y-5">
      {/* Subject & Class Quick Bar */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Left: Subject & Teacher Info */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-700 shrink-0">
            <BookOpen className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold text-slate-900 leading-tight">
                Mata Pelajaran {teacher.subject}
              </h1>
              <span className="text-xs text-slate-500">· {teacher.name}</span>
            </div>
            <p className="text-xs text-slate-500 flex items-center gap-1.5 mt-0.5">
              <Users className="w-3.5 h-3.5" />
              <span>
                Total <strong>{students.length}</strong> siswa aktif di <strong>{classes.length}</strong> rombel kelas
              </span>
            </p>
          </div>
        </div>

        {/* Right: Class Switcher (Filter by Class) */}
        <div className="flex flex-wrap items-center gap-1.5 bg-slate-50 p-1.5 rounded-lg border border-slate-200">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider px-2">
            Pilih Kelas:
          </span>

          <button
            onClick={() => setActiveClassId('all')}
            className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
              activeClassId === 'all'
                ? 'bg-white text-indigo-700 shadow-xs border border-slate-200'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Semua Kelas
          </button>

          {classes.map((c) => {
            const count = students.filter((s) => s.classId === c.id).length;
            const isActive = activeClassId === c.id;
            return (
              <button
                key={c.id}
                onClick={() => setActiveClassId(c.id)}
                className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
                  isActive
                    ? 'bg-white text-indigo-700 shadow-xs border border-slate-200'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {c.name}{' '}
                <span className="text-[10px] font-normal text-slate-400">({count})</span>
              </button>
            );
          })}

          <button
            onClick={onOpenProfile}
            className="p-1 text-slate-400 hover:text-slate-700 rounded-md hover:bg-slate-200 transition-colors ml-1"
            title="Kelola Daftar Kelas & Siswa"
          >
            <Settings className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Main Tab Content */}
      <main>
        {activeTab === 'materi' && <MateriTab />}
        {activeTab === 'tugas' && <TugasTab />}
        {activeTab === 'rekap' && <RekapTab />}
      </main>
    </div>
  );
};
