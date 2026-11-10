import React, { useState } from 'react';
import { useLMS } from '../../context/LMSContext';
import { X, KeyRound, Check, AlertCircle, ShieldAlert } from 'lucide-react';

interface ForgotPasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ForgotPasswordModal: React.FC<ForgotPasswordModalProps> = ({ isOpen, onClose }) => {
  const { teacher, resetTeacherPin } = useLMS();

  const [step, setStep] = useState<'verify' | 'new-pin' | 'success'>('verify');
  const [answerInput, setAnswerInput] = useState('');
  const [nameInput, setNameInput] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // New PIN state
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');

  if (!isOpen) return null;

  const currentQuestion = teacher.recoveryQuestion || 'Mata pelajaran apa yang Anda ampu?';
  const correctAnswer = (teacher.recoveryAnswer || teacher.subject || 'Biologi').trim().toLowerCase();
  const correctName = teacher.name.trim().toLowerCase();

  const handleVerify = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    const inputAns = answerInput.trim().toLowerCase();
    const inputNm = nameInput.trim().toLowerCase();

    // Verify either matching recovery answer OR matching full name
    const answerMatches = inputAns.length > 0 && inputAns === correctAnswer;
    const nameMatches = inputNm.length > 0 && inputNm === correctName;

    if (answerMatches || nameMatches) {
      setStep('new-pin');
      setErrorMsg('');
    } else {
      setErrorMsg('Jawaban atau nama guru tidak cocok. Silakan coba lagi.');
    }
  };

  const handleSetNewPin = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (newPin.trim().length < 4) {
      setErrorMsg('PIN minimal harus terdiri dari 4 digit/karakter.');
      return;
    }

    if (newPin !== confirmPin) {
      setErrorMsg('Konfirmasi PIN baru tidak cocok.');
      return;
    }

    resetTeacherPin(newPin.trim());
    setStep('success');
  };

  const handleEmergencyReset = () => {
    if (confirm('Atur ulang PIN darurat ke 1234?')) {
      resetTeacherPin('1234');
      setStep('success');
      setNewPin('1234');
    }
  };

  const handleClose = () => {
    setStep('verify');
    setAnswerInput('');
    setNameInput('');
    setNewPin('');
    setConfirmPin('');
    setErrorMsg('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs">
      <div className="bg-white rounded-2xl max-w-md w-full border border-slate-200 shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center font-bold">
              <KeyRound className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-slate-900">
                Lupa PIN Guru / Admin
              </h3>
              <p className="text-xs text-slate-500">
                Pulihkan atau atur ulang PIN keamanan Anda
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6">
          {step === 'verify' && (
            <form onSubmit={handleVerify} className="space-y-4">
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 text-xs space-y-1">
                <span className="text-slate-500 block">Pertanyaan Pemulihan Keamanan:</span>
                <span className="font-semibold text-slate-900 text-sm block">
                  "{currentQuestion}"
                </span>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Jawaban Pertanyaan Keamanan
                </label>
                <input
                  type="text"
                  required
                  value={answerInput}
                  onChange={(e) => {
                    setAnswerInput(e.target.value);
                    setErrorMsg('');
                  }}
                  placeholder="Ketikkan jawaban keamanan..."
                  className="w-full text-xs px-3 py-2.5 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-amber-500"
                  autoFocus
                />
              </div>

              <div className="border-t border-slate-100 pt-3">
                <label className="block text-xs font-medium text-slate-500 mb-1">
                  Atau Verifikasi via Nama Lengkap Guru yang Terdaftar:
                </label>
                <input
                  type="text"
                  value={nameInput}
                  onChange={(e) => {
                    setNameInput(e.target.value);
                    setErrorMsg('');
                  }}
                  placeholder="Nama Lengkap Guru (misal: Ibu Siti Rahmawati, S.Pd.)"
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-amber-500"
                />
              </div>

              {errorMsg && (
                <div className="text-xs text-rose-600 flex items-center gap-1.5 p-2 bg-rose-50 rounded-lg border border-rose-200">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              <button
                type="submit"
                className="w-full py-2.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-xl transition-colors shadow-xs"
              >
                Verifikasi Identitas & Lanjut
              </button>

              <div className="pt-2 text-center">
                <button
                  type="button"
                  onClick={handleEmergencyReset}
                  className="text-[11px] text-amber-700 hover:text-amber-900 hover:underline inline-flex items-center gap-1"
                >
                  <ShieldAlert className="w-3 h-3" />
                  <span>Atur Ulang Darurat ke PIN Bawaan (1234)</span>
                </button>
              </div>
            </form>
          )}

          {step === 'new-pin' && (
            <form onSubmit={handleSetNewPin} className="space-y-4">
              <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-3 rounded-xl text-xs flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Identitas terverifikasi! Masukkan PIN baru Anda di bawah ini:</span>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  PIN Baru (Minimal 4 Digit)
                </label>
                <input
                  type="password"
                  maxLength={10}
                  required
                  value={newPin}
                  onChange={(e) => setNewPin(e.target.value)}
                  placeholder="Masukkan PIN baru"
                  className="w-full text-sm font-mono px-3.5 py-2.5 border border-slate-300 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Ulangi / Konfirmasi PIN Baru
                </label>
                <input
                  type="password"
                  maxLength={10}
                  required
                  value={confirmPin}
                  onChange={(e) => setConfirmPin(e.target.value)}
                  placeholder="Ketik ulang PIN baru"
                  className="w-full text-sm font-mono px-3.5 py-2.5 border border-slate-300 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {errorMsg && (
                <div className="text-xs text-rose-600 flex items-center gap-1.5 p-2 bg-rose-50 rounded-lg border border-rose-200">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              <button
                type="submit"
                className="w-full py-2.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-colors shadow-xs"
              >
                Simpan & Terapkan PIN Baru
              </button>
            </form>
          )}

          {step === 'success' && (
            <div className="text-center py-4 space-y-4">
              <div className="w-12 h-12 bg-emerald-100 text-emerald-700 rounded-full flex items-center justify-center mx-auto">
                <Check className="w-6 h-6" />
              </div>
              <div>
                <h4 className="text-base font-bold text-slate-900">
                  PIN Berhasil Diperbarui!
                </h4>
                <p className="text-xs text-slate-500 mt-1">
                  Gunakan PIN baru Anda untuk masuk ke Ruang Guru & Admin.
                </p>
              </div>

              <button
                type="button"
                onClick={handleClose}
                className="w-full py-2.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-xl transition-colors"
              >
                Kembali ke Halaman Masuk
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
