export type AttendanceStatus = 'H' | 'S' | 'I' | 'A'; // Hadir, Sakit, Izin, Alpa

export interface Student {
  id: string;
  name: string;
  classId: string;
  whatsapp?: string; // Nomor WhatsApp siswa / orang tua (cth: 081234567890)
}

export interface ClassRoom {
  id: string;
  name: string; // misal: "Kelas X-1"
  whatsappGroupUrl?: string; // Link undangan Grup WhatsApp kelas (opsional)
}

export type MaterialFileType = 'pdf' | 'word' | 'excel' | 'image' | 'other';

export interface MaterialAttachment {
  name: string;
  size: string; // e.g. "245 KB" or "1.5 MB"
  type: MaterialFileType;
  dataUrl: string; // Base64 Data URL for instant download & viewing
}

export interface Material {
  id: string;
  title: string;
  subject?: string; // Mata pelajaran materi (bebas)
  content: string; // Teks rangkuman materi
  linkUrl?: string; // Link referensi (YouTube / Drive / Web)
  attachment?: MaterialAttachment; // Dokumen Word (.doc, .docx), Excel (.xls, .xlsx), atau PDF
  classId: string; // 'all' atau ID kelas tertentu
  date: string;
}

export interface Submission {
  id: string;
  taskId: string;
  studentId: string;
  studentName: string;
  submittedAt: string;
  workText: string;
  linkAttachment?: string;
  attachment?: MaterialAttachment;
  score?: number;
  note?: string;
}

export interface Task {
  id: string;
  title: string;
  subject?: string; // Mata pelajaran tugas (bebas)
  instructions: string;
  dueDate: string;
  classId: string; // 'all' atau ID kelas
  createdAt: string;
  attachment?: MaterialAttachment; // Dokumen file soal / LKPD (Word, Excel, PDF)
}

export interface AttendanceRecord {
  id: string;
  date: string;
  classId: string;
  subject?: string; // Mata pelajaran pertemuan (bebas)
  topic: string;
  records: Record<string, AttendanceStatus>; // studentId -> 'H'|'S'|'I'|'A'
}

export interface TeacherProfile {
  name: string;
  subject: string; // Daftar mata pelajaran (bisa lebih dari satu, pisahkan dengan koma)
  pin: string; // PIN masuk guru / admin (default "1234")
  nip?: string; // NIP Guru (opsional)
  kktp?: number; // Kriteria Ketuntasan Minimal / KKTP (default 75)
  recoveryQuestion?: string; // Pertanyaan pemulihan sandi
  recoveryAnswer?: string; // Jawaban pemulihan sandi
}

export interface AuthSession {
  role: 'teacher' | 'student';
  studentId?: string;
}

export interface GeneratedPGQuestion {
  id: string;
  question: string;
  options: string[]; // 4 opsi (A-D)
  correctIndex: number; // 0..3
  explanation?: string;
}

export interface GeneratedEssayQuestion {
  id: string;
  question: string;
  answerKey: string;
}

export interface GeneratedQuestionSet {
  id: string;
  title: string;
  subject: string;
  sourceMaterial: string;
  createdAt: string;
  pgCount: number;
  essayCount: number;
  multipleChoice: GeneratedPGQuestion[];
  essay: GeneratedEssayQuestion[];
}

export interface WhatsAppPrefill {
  message: string;
  classId?: string;
  onlyUnsubmittedTaskId?: string;
}

export interface CbtExam {
  id: string;
  questionSetId: string;
  title: string;
  subject: string;
  classId: string; // 'all' atau ID kelas tertentu
  durationMinutes: number;
  showResultToStudent: boolean; // Langsung tunjukkan nilai & pembahasan setelah selesai
  isActive: boolean;
  createdAt: string;
  multipleChoice: GeneratedPGQuestion[];
  essay: GeneratedEssayQuestion[];
}

export interface CbtAttempt {
  id: string;
  examId: string;
  examTitle: string;
  questionSetId?: string;
  studentId: string;
  studentName: string;
  classId: string;
  subject: string;
  pgAnswers: Record<string, number>;
  essayAnswers: Record<string, string>;
  pgCorrect: number;
  pgTotal: number;
  pgScore: number;
  essayScore?: number;
  finalScore: number;
  teacherNote?: string;
  submittedAt: string;
  durationSpentSec?: number;
}
