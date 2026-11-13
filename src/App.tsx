/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { LMSProvider, useLMS } from './context/LMSContext';
import { Header } from './components/Header';
import { TeacherDashboard } from './components/TeacherDashboard';
import { StudentPortal } from './components/StudentPortal';
import { TeacherProfileModal } from './components/modals/TeacherProfileModal';
import { DeployGuideModal } from './components/modals/DeployGuideModal';
import { LoginPage } from './components/LoginPage';

const MainContent: React.FC = () => {
  const { viewMode, authSession } = useLMS();
  const [activeTab, setActiveTab] = useState<'materi' | 'tugas' | 'soal-ai' | 'whatsapp' | 'siswa' | 'rekap'>('materi');
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isDeployModalOpen, setIsDeployModalOpen] = useState(false);

  // If user is not logged in, show clean lightweight LoginPage
  if (!authSession) {
    return <LoginPage />;
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onOpenProfile={() => setIsProfileModalOpen(true)}
        onOpenDeployGuide={() => setIsDeployModalOpen(true)}
      />

      <div className="flex-1 max-w-6xl w-full mx-auto px-3 sm:px-6 py-4 sm:py-6">
        {viewMode === 'teacher' && authSession.role === 'teacher' ? (
          <TeacherDashboard
            activeTab={activeTab}
            onOpenProfile={() => setIsProfileModalOpen(true)}
            onNavigateTab={setActiveTab}
          />
        ) : (
          <StudentPortal />
        )}
      </div>

      <footer className="border-t border-slate-200 bg-white py-4 text-center text-xs text-slate-500">
        <p>
          GuruMapel LMS · Sistem Pembelajaran Daring Ringan & Praktis Khusus Guru Mata Pelajaran
        </p>
      </footer>

      <TeacherProfileModal
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
      />

      <DeployGuideModal
        isOpen={isDeployModalOpen}
        onClose={() => setIsDeployModalOpen(false)}
      />
    </div>
  );
};

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; errorText: string }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, errorText: '' };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, errorText: error.message || 'Terjadi kesalahan sistem' };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center">
          <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm max-w-md w-full space-y-4">
            <h2 className="text-base font-bold text-slate-900">Kendala Tampilan Aplikasi</h2>
            <p className="text-xs text-slate-500">
              Terjadi sedikit kendala saat memuat data tampilan.
            </p>
            {this.state.errorText && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg font-mono text-left overflow-auto max-h-32">
                {this.state.errorText}
              </div>
            )}
            <button
              onClick={() => {
                localStorage.clear();
                window.location.reload();
              }}
              className="w-full py-2.5 px-4 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-colors shadow-xs"
            >
              Reset Data & Muat Ulang
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  return (
    <ErrorBoundary>
      <LMSProvider>
        <MainContent />
      </LMSProvider>
    </ErrorBoundary>
  );
}
