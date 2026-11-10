import { ClassRoom, Student, Material, Task, Submission, AttendanceRecord, TeacherProfile } from '../types/lms';

export const initialTeacher: TeacherProfile = {
  name: 'Ibu Siti Rahmawati, S.Pd.',
  subject: 'Biologi',
  pin: '1234',
  kktp: 75,
  recoveryQuestion: 'Mata pelajaran apa yang Anda ampu?',
  recoveryAnswer: 'Biologi',
};

export const initialClasses: ClassRoom[] = [
  { id: 'c1', name: 'Kelas X-1' },
  { id: 'c2', name: 'Kelas X-2' },
  { id: 'c3', name: 'Kelas X-3' },
];

export const initialStudents: Student[] = [
  // Kelas X-1
  { id: 's1', name: 'Aditya Pratama', classId: 'c1' },
  { id: 's2', name: 'Annisa Fitriani', classId: 'c1' },
  { id: 's3', name: 'Bagus Setiawan', classId: 'c1' },
  { id: 's4', name: 'Dina Lestari', classId: 'c1' },
  { id: 's5', name: 'Fajar Hidayat', classId: 'c1' },
  { id: 's6', name: 'Nabila Zahra', classId: 'c1' },
  { id: 's7', name: 'Rizky Ramadhan', classId: 'c1' },
  { id: 's8', name: 'Siti Nurhaliza', classId: 'c1' },

  // Kelas X-2
  { id: 's9', name: 'Ahmad Fauzan', classId: 'c2' },
  { id: 's10', name: 'Dewi Anggraini', classId: 'c2' },
  { id: 's11', name: 'Gilang Saputra', classId: 'c2' },
  { id: 's12', name: 'Indah Permatasari', classId: 'c2' },
  { id: 's13', name: 'Muhammad Ilham', classId: 'c2' },
  { id: 's14', name: 'Putri Maharani', classId: 'c2' },
  { id: 's15', name: 'Rendi Wijaya', classId: 'c2' },

  // Kelas X-3
  { id: 's16', name: 'Bayu Nugroho', classId: 'c3' },
  { id: 's17', name: 'Citra Kirana', classId: 'c3' },
  { id: 's18', name: 'Dimas Prasetyo', classId: 'c3' },
  { id: 's19', name: 'Farhan Maulana', classId: 'c3' },
  { id: 's20', name: 'Tia Amanda', classId: 'c3' },
];

export const initialMaterials: Material[] = [
  {
    id: 'm1',
    title: 'Bab 1: Struktur Organel Sel Tumbuhan vs Sel Hewan',
    content: 'Sel adalah unit struktural dan fungsional terkecil penyusun makhluk hidup. Perbedaan utama antara sel tumbuhan dan sel hewan terletak pada keberadaan dinding sel, kloroplas, dan vakuola besar yang hanya ada pada tumbuhan.',
    linkUrl: 'https://id.wikipedia.org/wiki/Sel_(biologi)',
    classId: 'all',
    date: '2025-02-10',
  },
  {
    id: 'm2',
    title: 'Bab 2: Sistem Metabolisme Sel (Enzim & Katabolisme)',
    content: 'Enzim bekerja sebagai biokatalisator yang mempercepat reaksi kimia tanpa ikut bereaksi. Faktor yang mempengaruhi kerja enzim: suhu, pH, konsentrasi enzim, dan inhibitor.',
    linkUrl: 'https://youtube.com',
    classId: 'all',
    date: '2025-02-17',
  },
];

export const initialTasks: Task[] = [
  {
    id: 't1',
    title: 'Tugas 1: Tabel Perbandingan Sel Hewan & Tumbuhan',
    instructions: 'Buat tabel perbandingan organel sel hewan dan tumbuhan (membran sel, dinding sel, kloroplas, lisosom, sentrosom, vakuola). Tuliskan fungsi ringkas masing-masing organel.',
    dueDate: '2025-02-25',
    classId: 'all',
    createdAt: '2025-02-12',
  },
  {
    id: 't2',
    title: 'Tugas 2: Analisis Kerja Enzim Katalase',
    instructions: 'Jawab pertanyaan pengamatan: Mengapa enzim katalase yang dipanaskan pada suhu di atas 60°C tidak menghasilkan gelembung gas saat ditetesi H2O2?',
    dueDate: '2025-03-02',
    classId: 'c1',
    createdAt: '2025-02-18',
  },
];

export const initialSubmissions: Submission[] = [
  {
    id: 'sub1',
    taskId: 't1',
    studentId: 's1',
    studentName: 'Aditya Pratama',
    submittedAt: '2025-02-20 14:30',
    workText: 'Tabel perbandingan sudah dibuat. 1. Dinding sel hanya ada di tumbuhan, fungsi melindungi sel. 2. Kloroplas tempat fotosintesis. 3. Sentrosom hanya di hewan untuk pembelahan.',
    score: 88,
    note: 'Penjelasan ringkas dan tepat. Bagus!',
  },
  {
    id: 'sub2',
    taskId: 't1',
    studentId: 's2',
    studentName: 'Annisa Fitriani',
    submittedAt: '2025-02-21 09:15',
    workText: 'Tabel lengkap terlampir: Dinding sel (Tumbuhan), Klorofil (Tumbuhan), Lisosom (Hewan), Vakuola besar (Tumbuhan), Vakuola kecil/tidak ada (Hewan).',
    score: 95,
    note: 'Sangat rapi dan lengkap.',
  },
  {
    id: 'sub3',
    taskId: 't1',
    studentId: 's3',
    studentName: 'Bagus Setiawan',
    submittedAt: '2025-02-22 16:00',
    workText: 'Tugas perbandingan sel sudah selesai dikerjakan.',
    score: undefined, // Belum dinilai guru
    note: '',
  },
  {
    id: 'sub4',
    taskId: 't1',
    studentId: 's9',
    studentName: 'Ahmad Fauzan',
    submittedAt: '2025-02-21 20:00',
    workText: 'Organel sel tumbuhan memiliki dinding sel dari selulosa, hewan tidak punya dinding sel sehingga bentuk hewan lebih fleksibel.',
    score: 85,
    note: 'Pemahaman konsep baik.',
  },
];

export const initialAttendance: AttendanceRecord[] = [
  {
    id: 'att1',
    date: '2025-02-12',
    classId: 'c1',
    topic: 'Pertemuan 1: Pengantar Sel & Mikroskop',
    records: {
      s1: 'H',
      s2: 'H',
      s3: 'H',
      s4: 'S',
      s5: 'H',
      s6: 'H',
      s7: 'I',
      s8: 'H',
    },
  },
  {
    id: 'att2',
    date: '2025-02-19',
    classId: 'c1',
    topic: 'Pertemuan 2: Organel Sel & Fungsinya',
    records: {
      s1: 'H',
      s2: 'H',
      s3: 'H',
      s4: 'H',
      s5: 'H',
      s6: 'H',
      s7: 'H',
      s8: 'H',
    },
  },
];
