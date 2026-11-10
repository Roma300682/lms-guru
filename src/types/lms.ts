export type AttendanceStatus = 'H' | 'S' | 'I' | 'A'; // Hadir, Sakit, Izin, Alpa

export interface Student {
  id: string;
  name: string;
  classId: string;
}

export interface ClassRoom {
  id: string;
  name: string; // misal: "Kelas X-1"
}

export interface Material {
  id: string;
  title: string;
  content: string; // Teks rangkuman materi
  linkUrl?: string; // Link referensi (YouTube / Drive / Web)
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
  score?: number;
  note?: string;
}

export interface Task {
  id: string;
  title: string;
  instructions: string;
  dueDate: string;
  classId: string; // 'all' atau ID kelas
  createdAt: string;
}

export interface AttendanceRecord {
  id: string;
  date: string;
  classId: string;
  topic: string;
  records: Record<string, AttendanceStatus>; // studentId -> 'H'|'S'|'I'|'A'
}

export interface TeacherProfile {
  name: string;
  subject: string; // Mata pelajaran (misal: "Biologi")
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
