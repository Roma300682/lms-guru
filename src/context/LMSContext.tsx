import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { User, onAuthStateChanged } from 'firebase/auth';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  where,
  writeBatch,
  serverTimestamp,
  deleteField,
} from 'firebase/firestore';
import {
  db,
  auth,
  BOOTSTRAP_ADMIN_EMAIL,
  OperationType,
  handleFirestoreError,
  signInWithGooglePopup,
  signInWithGoogleRedirect,
  signInAnonymousStudent,
  resolveGoogleRedirectResult,
  isEmbeddedInIframe,
  signOutFirebase,
} from '../firebase';
import {
  ClassRoom,
  Student,
  Material,
  Task,
  Submission,
  AttendanceRecord,
  TeacherProfile,
  AttendanceStatus,
  AuthSession,
  GeneratedQuestionSet,
  MaterialAttachment,
  CbtExam,
  CbtAttempt,
} from '../types/lms';
import {
  initialTeacher,
  initialClasses,
  initialStudents,
  initialMaterials,
  initialTasks,
  initialSubmissions,
  initialAttendance,
} from '../data/initialData';
import {
  saveFileAttachment,
  getFileAttachment,
  deleteFileAttachment,
} from '../utils/fileStorage';
import { parseSubjects, getPrimarySubject } from '../utils/subjects';

interface LMSContextType {
  // State
  teacher: TeacherProfile;
  teacherSubjects: string[];
  availableSubjects: string[];
  classes: ClassRoom[];
  students: Student[];
  materials: Material[];
  tasks: Task[];
  submissions: Submission[];
  attendance: AttendanceRecord[];
  questionSets: GeneratedQuestionSet[];
  cbtExams: CbtExam[];
  cbtResults: CbtAttempt[];
  activeClassId: string; // 'all' or classId
  activeSubject: string; // 'all' or subject name
  viewMode: 'teacher' | 'student';
  currentStudentId: string;

  // Firebase Auth & Cloud Sync State
  firebaseUser: User | null;
  authLoading: boolean;
  isCloudAdmin: boolean;
  isCloudConnected: boolean;
  isStudentCloudSynced: boolean;
  anonymousAuthBlocked: boolean;
  anonymousAuthError: string | null;
  retryAnonymousSync: () => Promise<boolean>;
  isInIframe: boolean;
  cloudAuthError: string | null;
  cloudAuthErrorCode: string | null;
  clearCloudAuthError: () => void;

  authSession: AuthSession | null;
  loginAsTeacher: (pin: string) => boolean;
  loginWithGoogleAsTeacher: () => Promise<boolean>;
  connectGoogleForStudent: () => Promise<boolean>;
  loginWithGoogleRedirect: (intendedRole: 'teacher' | 'student') => Promise<void>;
  loginAsStudent: (studentId: string, whatsapp?: string) => void;
  logout: () => void;
  resetTeacherPin: (newPin: string) => void;

  // Actions
  setActiveClassId: (id: string) => void;
  setActiveSubject: (subject: string) => void;
  setViewMode: (mode: 'teacher' | 'student') => void;
  setCurrentStudentId: (id: string) => void;
  updateTeacher: (profile: Partial<TeacherProfile>) => void;

  // Class & Student Actions
  addClass: (name: string) => string | null;
  updateClass: (id: string, patch: Partial<Pick<ClassRoom, 'name' | 'whatsappGroupUrl'>>) => void;
  deleteClass: (id: string) => void;
  deleteAllClasses: () => void;
  addStudent: (name: string, classId: string, whatsapp?: string) => void;
  updateStudent: (id: string, patch: Partial<Pick<Student, 'name' | 'classId' | 'whatsapp'>>) => void;
  addStudentsBatch: (newStudents: { name: string; classId: string; whatsapp?: string }[]) => void;
  deleteStudent: (id: string) => void;

  // Admin Backup & Restore & Cloud Sync
  exportBackup: () => void;
  importBackup: (jsonContent: string) => Promise<{ ok: boolean; message: string }>;
  syncLocalDataToCloud: () => Promise<{ ok: boolean; message: string }>;
  resetCloudDatabase: () => Promise<{ ok: boolean; message: string }>;

  // Material Actions
  addMaterial: (material: Omit<Material, 'id' | 'date'>) => void;
  deleteMaterial: (id: string) => void;

  // Task Actions
  addTask: (task: Omit<Task, 'id' | 'createdAt'>) => void;
  deleteTask: (id: string) => void;

  // Submission & Grading Actions
  submitTask: (
    taskId: string,
    studentId: string,
    workText: string,
    linkAttachment?: string,
    attachment?: MaterialAttachment | null
  ) => void;
  gradeSubmission: (submissionId: string, score: number, note?: string) => void;

  // Attendance Actions
  saveAttendance: (date: string, classId: string, topic: string, records: Record<string, AttendanceStatus>, subject?: string) => void;
  deleteAttendance: (id: string) => void;

  // AI Question Set Actions
  addQuestionSet: (qset: GeneratedQuestionSet) => void;
  updateQuestionSet: (id: string, updated: GeneratedQuestionSet) => void;
  deleteQuestionSet: (id: string) => void;

  // CBT Exam & Results Actions
  addCbtExam: (exam: Omit<CbtExam, 'id' | 'createdAt'>) => string | null;
  toggleCbtExamActive: (id: string, isActive: boolean) => void;
  deleteCbtExam: (id: string) => void;
  submitCbtAttempt: (attempt: Omit<CbtAttempt, 'id' | 'submittedAt'>) => CbtAttempt;
  gradeCbtAttempt: (
    attemptId: string,
    finalScore: number,
    essayScore?: number,
    teacherNote?: string
  ) => void;
  deleteCbtAttempt: (attemptId: string) => void;

  // Reset
  resetData: () => void;
}

const LMSContext = createContext<LMSContextType | undefined>(undefined);

const safeParse = <T,>(key: string, fallback: T): T => {
  try {
    const saved = localStorage.getItem(key);
    if (saved === null) return fallback;
    const parsed = JSON.parse(saved);
    if (parsed === null || parsed === undefined) return fallback;
    return parsed;
  } catch {
    return fallback;
  }
};

const clampStr = (val: unknown, max: number): string => {
  if (typeof val !== 'string') return '';
  return val.length > max ? val.slice(0, max) : val;
};

const sanitizePin = (pin?: string): string => {
  const cleaned = (pin || '1234').trim();
  if (cleaned.length < 4) return cleaned.padEnd(4, '0');
  return clampStr(cleaned, 20);
};

// Max base64 attachment size allowed in single Firestore document (leaves room below 1 MiB limit)
const MAX_FIRESTORE_ATTACHMENT_CHARS = 740000;

export const LMSProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [teacher, setTeacher] = useState<TeacherProfile>(() =>
    safeParse('gm_teacher', initialTeacher)
  );
  const [classes, setClasses] = useState<ClassRoom[]>(() =>
    safeParse<ClassRoom[]>('gm_classes', initialClasses)
  );
  const [studentsRoster, setStudentsRoster] = useState<Student[]>(() =>
    safeParse<Student[]>('gm_students', initialStudents)
  );
  const [studentContacts, setStudentContacts] = useState<Record<string, string>>({});
  const [materials, setMaterials] = useState<Material[]>(() =>
    safeParse('gm_materials', initialMaterials)
  );
  const [tasks, setTasks] = useState<Task[]>(() =>
    safeParse('gm_tasks', initialTasks)
  );
  const [submissions, setSubmissions] = useState<Submission[]>(() =>
    safeParse('gm_submissions', initialSubmissions)
  );
  const [attendance, setAttendance] = useState<AttendanceRecord[]>(() =>
    safeParse('gm_attendance', initialAttendance)
  );
  const [questionSets, setQuestionSets] = useState<GeneratedQuestionSet[]>(() =>
    safeParse<GeneratedQuestionSet[]>('gm_ai_questions', [])
  );
  const [cbtExams, setCbtExams] = useState<CbtExam[]>(() =>
    safeParse<CbtExam[]>('gm_cbt_exams', [])
  );
  const [cbtResults, setCbtResults] = useState<CbtAttempt[]>(() =>
    safeParse<CbtAttempt[]>('gm_cbt_results', [])
  );

  const [activeClassId, setActiveClassId] = useState<string>('c1');
  const [activeSubject, setActiveSubject] = useState<string>('all');
  const [viewMode, setViewModeState] = useState<'teacher' | 'student'>('student');
  const [currentStudentId, setCurrentStudentId] = useState<string>(() => {
    const saved = safeParse<{ role?: string; studentId?: string } | null>('gm_student_session', null);
    if (saved?.role === 'student' && typeof saved.studentId === 'string' && saved.studentId) {
      return saved.studentId;
    }
    return 's1';
  });

  const [authSession, setAuthSession] = useState<AuthSession | null>(() => {
    localStorage.removeItem('gm_session');
    const saved = safeParse<{ role?: string; studentId?: string } | null>('gm_student_session', null);
    if (saved?.role === 'student' && typeof saved.studentId === 'string' && saved.studentId) {
      return { role: 'student', studentId: saved.studentId };
    }
    return null;
  });

  // Firebase Auth state
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState<boolean>(true);
  const [redirectCheckDone, setRedirectCheckDone] = useState<boolean>(false);
  const [isCloudAdmin, setIsCloudAdmin] = useState<boolean>(false);
  const [cloudAuthError, setCloudAuthError] = useState<string | null>(null);
  const [cloudAuthErrorCode, setCloudAuthErrorCode] = useState<string | null>(null);
  const [anonymousAuthBlocked, setAnonymousAuthBlocked] = useState<boolean>(false);
  const [anonymousAuthError, setAnonymousAuthError] = useState<string | null>(null);
  const anonAttemptInFlightRef = useRef<boolean>(false);

  // Track Firestore document ownership & student claim metadata
  const teacherOwnerUidRef = useRef<string>('');
  const studentOwnerMapRef = useRef<Record<string, string>>({});
  const studentClaimedMapRef = useRef<Record<string, string>>({});
  const taskOwnerMapRef = useRef<Record<string, string>>({});
  const cbtExamOwnerMapRef = useRef<Record<string, string>>({});
  const submissionStudentUidMapRef = useRef<Record<string, string>>({});
  const pendingClassWritesRef = useRef<Record<string, Promise<void>>>({});
  const hasSeededCloudRef = useRef<boolean>(false);
  const isSeedingCloudRef = useRef<boolean>(false);
  const cloudIdsRef = useRef<{
    hasTeacherPublic: boolean;
    hasTeacherPrivate: boolean;
    classes: Set<string>;
    students: Set<string>;
    contacts: Set<string>;
    materials: Set<string>;
    tasks: Set<string>;
    attendance: Set<string>;
    questionSets: Set<string>;
    submissions: Set<string>;
    cbtExams: Set<string>;
    cbtResults: Set<string>;
  }>({
    hasTeacherPublic: false,
    hasTeacherPrivate: false,
    classes: new Set(),
    students: new Set(),
    contacts: new Set(),
    materials: new Set(),
    tasks: new Set(),
    attendance: new Set(),
    questionSets: new Set(),
    submissions: new Set(),
    cbtExams: new Set(),
    cbtResults: new Set(),
  });

  // Keep latest local state refs for initial cloud bootstrap & pre-cloud backup
  const latestLocalRef = useRef({
    teacher,
    classes,
    studentsRoster,
    materials,
    tasks,
    submissions,
    attendance,
    questionSets,
    cbtExams,
    cbtResults,
  });
  latestLocalRef.current = {
    teacher,
    classes,
    studentsRoster,
    materials,
    tasks,
    submissions,
    attendance,
    questionSets,
    cbtExams,
    cbtResults,
  };

  const isCloudConnected = Boolean(firebaseUser && firebaseUser.emailVerified);
  const canAccessStudentCloud = Boolean(
    firebaseUser && (firebaseUser.emailVerified || firebaseUser.isAnonymous)
  );
  const isStudentCloudSynced = canAccessStudentCloud;

  // Multi-subject helpers: configured teacher subjects + any free subject attached to materials/tasks/attendance/questionSets
  const teacherSubjects: string[] = React.useMemo(
    () => parseSubjects(teacher.subject),
    [teacher.subject]
  );

  const availableSubjects: string[] = React.useMemo(() => {
    const seen = new Set<string>();
    const list: string[] = [];
    const pushItem = (raw?: string) => {
      const cleaned = raw?.trim();
      if (!cleaned) return;
      const key = cleaned.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        list.push(cleaned);
      }
    };
    teacherSubjects.forEach(pushItem);
    materials.forEach((m) => pushItem(m.subject));
    tasks.forEach((t) => pushItem(t.subject));
    attendance.forEach((a) => pushItem(a.subject));
    questionSets.forEach((q) => pushItem(q.subject));
    cbtExams.forEach((ex) => pushItem(ex.subject));
    return list;
  }, [teacherSubjects, materials, tasks, attendance, questionSets, cbtExams]);

  useEffect(() => {
    if (
      activeSubject !== 'all' &&
      !availableSubjects.some((s) => s.toLowerCase() === activeSubject.toLowerCase())
    ) {
      setActiveSubject('all');
    }
  }, [activeSubject, availableSubjects]);

  // Merge roster + isolated private WA contacts
  const students: Student[] = React.useMemo(
    () =>
      studentsRoster.map((s) => ({
        ...s,
        whatsapp: studentContacts[s.id] !== undefined ? studentContacts[s.id] || undefined : s.whatsapp,
      })),
    [studentsRoster, studentContacts]
  );

  const clearCloudAuthError = useCallback(() => {
    setCloudAuthError(null);
    setCloudAuthErrorCode(null);
  }, []);

  const isInIframe = isEmbeddedInIframe();

  // Resolve whether authenticated Firebase user is an Admin
  const checkUserAdminStatus = useCallback(async (user: User): Promise<boolean> => {
    if (!user.emailVerified) return false;
    if (user.email?.toLowerCase() === BOOTSTRAP_ADMIN_EMAIL.toLowerCase()) return true;
    try {
      const adminSnap = await getDoc(doc(db, 'admins', user.uid));
      return adminSnap.exists();
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, `admins/${user.uid}`);
    }
  }, []);

  // Listen to Firebase Auth state and process any pending Google Redirect result
  useEffect(() => {
    let active = true;

    void resolveGoogleRedirectResult()
      .then(async (redirectUser) => {
        if (!active || !redirectUser) return;
        const intendedRole = sessionStorage.getItem('gm_google_redirect_role');
        sessionStorage.removeItem('gm_google_redirect_role');
        if (intendedRole === 'teacher') {
          if (!redirectUser.emailVerified) {
            setCloudAuthError('Email Google Anda belum terverifikasi.');
            return;
          }
          const adminOk = await checkUserAdminStatus(redirectUser);
          if (!adminOk) {
            setCloudAuthError(
              `Akses ditolak: Akun Google (${redirectUser.email || 'ini'}) bukan Guru/Admin terdaftar. Siswa tidak diperbolehkan masuk ke ruang Guru & Admin. Silakan masuk melalui tab "Masuk Siswa".`
            );
            await signOutFirebase();
          }
        }
      })
      .catch((err) => {
        if (!active) return;
        const code = (err as { code?: string })?.code || '';
        const msg = err instanceof Error ? err.message : String(err);
        if (code && code !== 'auth/popup-closed-by-user') {
          setCloudAuthError(`Gagal menyelesaikan login Google (${code}: ${msg}).`);
        }
      })
      .finally(() => {
        if (active) setRedirectCheckDone(true);
      });

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!active) return;
      if (user && user.emailVerified) {
        // Preserve browser's localStorage snapshot before cloud listeners overwrite state
        // (Skip overwriting gm_precloud_backup on simple page reload while already signed in as the same UID)
        try {
          const prevCloudUid = localStorage.getItem('gm_cloud_uid');
          if (prevCloudUid !== user.uid || !localStorage.getItem('gm_precloud_backup')) {
            const snap = latestLocalRef.current;
            localStorage.setItem(
              'gm_precloud_backup',
              JSON.stringify({
                teacher: snap.teacher,
                classes: snap.classes,
                students: snap.studentsRoster,
                materials: snap.materials,
                tasks: snap.tasks,
                submissions: snap.submissions,
                attendance: snap.attendance,
                questionSets: snap.questionSets,
                savedAt: new Date().toISOString(),
              })
            );
            localStorage.setItem('gm_cloud_uid', user.uid);
          }
        } catch {
          // ignore localStorage quota error
        }
      }
      setFirebaseUser(user);
      if (user && (user.emailVerified || user.isAnonymous)) {
        setAnonymousAuthBlocked(false);
        setAnonymousAuthError(null);
      }

      if (user && user.emailVerified) {
        try {
          const adminFlag = await checkUserAdminStatus(user);
          if (!active) return;
          setIsCloudAdmin(adminFlag);
          if (adminFlag) {
            setAuthSession((prev) => prev ?? { role: 'teacher' });
            setViewModeState('teacher');
          } else {
            setAuthSession((prev) => (prev?.role === 'teacher' ? null : prev));
            setViewModeState('student');
          }
        } catch {
          if (active) {
            setIsCloudAdmin(false);
            setAuthSession((prev) => (prev?.role === 'teacher' ? null : prev));
            setViewModeState('student');
          }
        }
      } else {
        setIsCloudAdmin(false);
        setAuthSession((prev) => (prev?.role === 'student' ? prev : null));
        setViewModeState('student');
        if (!user) {
          hasSeededCloudRef.current = false;
          cloudIdsRef.current = {
            hasTeacherPublic: false,
            hasTeacherPrivate: false,
            classes: new Set(),
            students: new Set(),
            contacts: new Set(),
            materials: new Set(),
            tasks: new Set(),
            attendance: new Set(),
            questionSets: new Set(),
            submissions: new Set(),
            cbtExams: new Set(),
            cbtResults: new Set(),
          };
        }
      }
      setAuthLoading(false);
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, [checkUserAdminStatus]);

  // Ensure student browsers automatically get a Firebase Anonymous session so Cloud sync works without Google
  const ensureAnonymousStudentSession = useCallback(async (force = false): Promise<boolean> => {
    if (auth.currentUser) {
      setAnonymousAuthBlocked(false);
      setAnonymousAuthError(null);
      return true;
    }
    if (anonAttemptInFlightRef.current && !force) return false;
    anonAttemptInFlightRef.current = true;
    try {
      await signInAnonymousStudent();
      setAnonymousAuthBlocked(false);
      setAnonymousAuthError(null);
      return true;
    } catch (err) {
      const code = (err as { code?: string })?.code || '';
      const msg = err instanceof Error ? err.message : String(err);
      if (
        code === 'auth/operation-not-allowed' ||
        code === 'auth/admin-restricted-operation'
      ) {
        setAnonymousAuthBlocked(true);
        setAnonymousAuthError(
          `Sinkronisasi otomatis tanpa Google belum diaktifkan di Firebase Console (${code}).`
        );
      } else {
        setAnonymousAuthError(
          `Gagal menyambungkan sesi siswa ke Cloud (${code || msg}).`
        );
      }
      return false;
    } finally {
      anonAttemptInFlightRef.current = false;
    }
  }, []);

  useEffect(() => {
    if (!authLoading && redirectCheckDone && !firebaseUser && !anonymousAuthBlocked) {
      void ensureAnonymousStudentSession();
    }
  }, [
    authLoading,
    redirectCheckDone,
    firebaseUser,
    anonymousAuthBlocked,
    ensureAnonymousStudentSession,
  ]);

  const retryAnonymousSync = useCallback(async (): Promise<boolean> => {
    setAnonymousAuthBlocked(false);
    setAnonymousAuthError(null);
    return ensureAnonymousStudentSession(true);
  }, [ensureAnonymousStudentSession]);

  // Continuous fail-closed enforcement: students can never hold teacher viewMode or teacher session
  const setViewMode = useCallback(
    (mode: 'teacher' | 'student') => {
      if (mode === 'teacher' && (!isCloudAdmin || !firebaseUser?.emailVerified || authSession?.role !== 'teacher')) {
        setViewModeState('student');
        return;
      }
      setViewModeState(mode);
    },
    [isCloudAdmin, firebaseUser, authSession?.role]
  );

  useEffect(() => {
    if (authSession?.role === 'student' && viewMode !== 'student') {
      setViewModeState('student');
    }
    if (
      authSession?.role === 'teacher' &&
      !authLoading &&
      (!firebaseUser || !firebaseUser.emailVerified || !isCloudAdmin)
    ) {
      setAuthSession(null);
      setViewModeState('student');
    }
  }, [authSession, firebaseUser, isCloudAdmin, authLoading, viewMode]);

  // Phased, rules-compliant dataset uploader to Cloud Firestore
  const pushDatasetToFirestore = useCallback(
    async (
      adminUid: string,
      dataset: {
        teacher?: TeacherProfile;
        classes?: ClassRoom[];
        students?: Student[];
        materials?: Material[];
        tasks?: Task[];
        submissions?: Submission[];
        attendance?: AttendanceRecord[];
        questionSets?: GeneratedQuestionSet[];
      }
    ): Promise<{ classes: number; students: number; materials: number; tasks: number; attendance: number; questionSets: number }> => {
      const toValidId = (raw: unknown, prefix: string, idx: number): string => {
        const cleaned = String(raw || '').replace(/[^a-zA-Z0-9_\-]/g, '_').slice(0, 120);
        return cleaned.length > 0 ? cleaned : `${prefix}_${Date.now()}_${idx}`;
      };

      const commitBatchOps = async (
        ops: Array<{ mode: 'set' | 'update'; ref: ReturnType<typeof doc>; data: Record<string, unknown> }>
      ) => {
        const CHUNK_SIZE = 350;
        for (let i = 0; i < ops.length; i += CHUNK_SIZE) {
          const batch = writeBatch(db);
          for (const op of ops.slice(i, i + CHUNK_SIZE)) {
            if (op.mode === 'update') {
              batch.update(op.ref, op.data);
            } else {
              batch.set(op.ref, op.data);
            }
          }
          await batch.commit();
        }
      };

      // Phase 1: Teacher settings + Classes (must commit before students/materials/tasks/attendance)
      const phase1Ops: Array<{ mode: 'set' | 'update'; ref: ReturnType<typeof doc>; data: Record<string, unknown> }> = [];
      const srcTeacher = dataset.teacher || latestLocalRef.current.teacher;

      const pubSnap = await getDoc(doc(db, 'settings', 'teacherPublic'));
      const privSnap = await getDoc(doc(db, 'settings', 'teacherPrivate'));

      if (pubSnap.exists()) {
        phase1Ops.push({
          mode: 'update',
          ref: doc(db, 'settings', 'teacherPublic'),
          data: {
            name: clampStr(srcTeacher.name || 'Guru Mata Pelajaran', 120),
            subject: clampStr(srcTeacher.subject || 'Mata Pelajaran', 300),
            kktp: typeof srcTeacher.kktp === 'number' ? Math.min(100, Math.max(0, srcTeacher.kktp)) : 75,
            visibility: 'classroom',
            updatedAt: serverTimestamp(),
          },
        });
      } else {
        phase1Ops.push({
          mode: 'set',
          ref: doc(db, 'settings', 'teacherPublic'),
          data: {
            name: clampStr(srcTeacher.name || 'Guru Mata Pelajaran', 120),
            subject: clampStr(srcTeacher.subject || 'Mata Pelajaran', 300),
            kktp: typeof srcTeacher.kktp === 'number' ? Math.min(100, Math.max(0, srcTeacher.kktp)) : 75,
            visibility: 'classroom',
            ownerUid: adminUid,
            updatedAt: serverTimestamp(),
          },
        });
      }

      const privData: Record<string, unknown> = {
        pin: sanitizePin(srcTeacher.pin),
        updatedAt: serverTimestamp(),
      };
      if (srcTeacher.nip) privData.nip = clampStr(srcTeacher.nip, 50);
      if (srcTeacher.recoveryQuestion) privData.recoveryQuestion = clampStr(srcTeacher.recoveryQuestion, 200);
      if (srcTeacher.recoveryAnswer) privData.recoveryAnswer = clampStr(srcTeacher.recoveryAnswer, 100);
      if (privSnap.exists()) {
        phase1Ops.push({
          mode: 'update',
          ref: doc(db, 'settings', 'teacherPrivate'),
          data: privData,
        });
      } else {
        phase1Ops.push({
          mode: 'set',
          ref: doc(db, 'settings', 'teacherPrivate'),
          data: { ...privData, ownerUid: adminUid },
        });
      }

      const inputClasses = Array.isArray(dataset.classes) && dataset.classes.length > 0 ? dataset.classes : initialClasses;
      const classIdMap = new Map<string, string>();
      const validClassIds = new Set<string>();

      inputClasses.forEach((cls, idx) => {
        const cid = toValidId(cls.id, 'c', idx);
        classIdMap.set(cls.id, cid);
        validClassIds.add(cid);
        const exists = cloudIdsRef.current.classes.has(cid);
        const baseCls: Record<string, unknown> = {
          name: clampStr(cls.name || 'Kelas', 80),
          visibility: 'classroom',
          updatedAt: serverTimestamp(),
        };
        if (cls.whatsappGroupUrl) baseCls.whatsappGroupUrl = clampStr(cls.whatsappGroupUrl, 300);

        if (exists) {
          phase1Ops.push({ mode: 'update', ref: doc(db, 'classes', cid), data: baseCls });
        } else {
          phase1Ops.push({
            mode: 'set',
            ref: doc(db, 'classes', cid),
            data: { ...baseCls, ownerUid: adminUid, createdAt: serverTimestamp() },
          });
        }
      });

      await commitBatchOps(phase1Ops);

      // Phase 2: Students + Contacts, Materials, Tasks, Attendance, QuestionSets
      const phase2Ops: Array<{ mode: 'set' | 'update'; ref: ReturnType<typeof doc>; data: Record<string, unknown> }> = [];
      const fallbackClassId =
        Array.from(validClassIds)[0] || Array.from(cloudIdsRef.current.classes)[0] || 'c1';
      const isKnownClass = (cid: string) => validClassIds.has(cid) || cloudIdsRef.current.classes.has(cid);

      const inputStudents = Array.isArray(dataset.students) ? dataset.students : [];
      const studentIdMap = new Map<string, string>();
      const validStudentIds = new Set<string>();

      inputStudents.forEach((stu, idx) => {
        const sid = toValidId(stu.id, 's', idx);
        studentIdMap.set(stu.id, sid);
        validStudentIds.add(sid);
        const mappedClassId = classIdMap.get(stu.classId) || stu.classId;
        const targetClassId = isKnownClass(mappedClassId) ? mappedClassId : fallbackClassId;
        const exists = cloudIdsRef.current.students.has(sid);

        const baseStu: Record<string, unknown> = {
          name: clampStr(stu.name || 'Siswa', 120),
          classId: targetClassId,
          visibility: 'classroom',
          updatedAt: serverTimestamp(),
        };
        if (exists) {
          phase2Ops.push({ mode: 'update', ref: doc(db, 'students', sid), data: baseStu });
        } else {
          phase2Ops.push({
            mode: 'set',
            ref: doc(db, 'students', sid),
            data: { ...baseStu, ownerUid: adminUid, createdAt: serverTimestamp() },
          });
        }

        if (stu.whatsapp && stu.whatsapp.trim()) {
          const contactExists = cloudIdsRef.current.contacts.has(sid);
          if (contactExists) {
            phase2Ops.push({
              mode: 'update',
              ref: doc(db, 'students', sid, 'private', 'contact'),
              data: {
                whatsapp: clampStr(stu.whatsapp.trim(), 30),
                updatedAt: serverTimestamp(),
              },
            });
          } else {
            phase2Ops.push({
              mode: 'set',
              ref: doc(db, 'students', sid, 'private', 'contact'),
              data: {
                whatsapp: clampStr(stu.whatsapp.trim(), 30),
                ownerUid: adminUid,
                updatedAt: serverTimestamp(),
              },
            });
          }
        }
      });

      const inputMaterials = Array.isArray(dataset.materials) ? dataset.materials : [];
      inputMaterials.forEach((mat, idx) => {
        const mid = toValidId(mat.id, 'm', idx);
        const mappedClassId = mat.classId === 'all' ? 'all' : classIdMap.get(mat.classId) || mat.classId;
        const classId = mappedClassId === 'all' || isKnownClass(mappedClassId) ? mappedClassId : fallbackClassId;
        const exists = cloudIdsRef.current.materials.has(mid);
        const baseMat: Record<string, unknown> = {
          title: clampStr(mat.title || 'Materi', 200),
          content: clampStr(mat.content || '', 20000),
          classId,
          date: clampStr(mat.date || new Date().toISOString().split('T')[0], 30),
          visibility: 'classroom',
          updatedAt: serverTimestamp(),
        };
        if (mat.subject && mat.subject.trim()) baseMat.subject = clampStr(mat.subject.trim(), 120);
        if (mat.linkUrl) baseMat.linkUrl = clampStr(mat.linkUrl, 500);
        if (mat.attachment) {
          baseMat.attachmentName = clampStr(mat.attachment.name, 200);
          baseMat.attachmentSize = clampStr(mat.attachment.size, 40);
          baseMat.attachmentType = mat.attachment.type;
          if (mat.attachment.dataUrl && mat.attachment.dataUrl.length <= MAX_FIRESTORE_ATTACHMENT_CHARS) {
            baseMat.attachmentDataUrl = mat.attachment.dataUrl;
          }
        }
        if (exists) {
          phase2Ops.push({ mode: 'update', ref: doc(db, 'materials', mid), data: baseMat });
        } else {
          phase2Ops.push({
            mode: 'set',
            ref: doc(db, 'materials', mid),
            data: { ...baseMat, ownerUid: adminUid, createdAt: serverTimestamp() },
          });
        }
      });

      const inputTasks = Array.isArray(dataset.tasks) ? dataset.tasks : [];
      const taskIdMap = new Map<string, string>();
      const validTaskIds = new Set<string>();

      inputTasks.forEach((tsk, idx) => {
        const tid = toValidId(tsk.id, 't', idx);
        taskIdMap.set(tsk.id, tid);
        validTaskIds.add(tid);
        const mappedClassId = tsk.classId === 'all' ? 'all' : classIdMap.get(tsk.classId) || tsk.classId;
        const classId = mappedClassId === 'all' || isKnownClass(mappedClassId) ? mappedClassId : fallbackClassId;
        const exists = cloudIdsRef.current.tasks.has(tid);
        const baseTask: Record<string, unknown> = {
          title: clampStr(tsk.title || 'Tugas', 200),
          instructions: clampStr(tsk.instructions || '', 30000),
          dueDate: clampStr(tsk.dueDate || '', 30),
          classId,
          createdAtStr: clampStr(tsk.createdAt || new Date().toISOString().split('T')[0], 30),
          visibility: 'classroom',
          updatedAt: serverTimestamp(),
        };
        if (tsk.subject && tsk.subject.trim()) baseTask.subject = clampStr(tsk.subject.trim(), 120);
        if (tsk.attachment) {
          baseTask.attachmentName = clampStr(tsk.attachment.name, 200);
          baseTask.attachmentSize = clampStr(tsk.attachment.size, 40);
          baseTask.attachmentType = tsk.attachment.type;
          if (tsk.attachment.dataUrl && tsk.attachment.dataUrl.length <= MAX_FIRESTORE_ATTACHMENT_CHARS) {
            baseTask.attachmentDataUrl = tsk.attachment.dataUrl;
          }
        }
        if (exists) {
          phase2Ops.push({ mode: 'update', ref: doc(db, 'tasks', tid), data: baseTask });
        } else {
          phase2Ops.push({
            mode: 'set',
            ref: doc(db, 'tasks', tid),
            data: { ...baseTask, ownerUid: adminUid, createdAt: serverTimestamp() },
          });
        }
      });

      const inputAttendance = Array.isArray(dataset.attendance) ? dataset.attendance : [];
      let syncedAttendanceCount = 0;
      inputAttendance.forEach((att, idx) => {
        const aid = toValidId(att.id, 'att', idx);
        const mappedClassId = classIdMap.get(att.classId) || att.classId;
        if (!isKnownClass(mappedClassId)) return;
        syncedAttendanceCount++;
        const exists = cloudIdsRef.current.attendance.has(aid);
        const baseAtt: Record<string, unknown> = {
          date: clampStr(att.date, 30),
          classId: mappedClassId,
          topic: clampStr(att.topic || 'Pertemuan', 200),
          records: att.records || {},
          visibility: 'classroom',
          updatedAt: serverTimestamp(),
        };
        if (att.subject && att.subject.trim()) baseAtt.subject = clampStr(att.subject.trim(), 120);
        if (exists) {
          phase2Ops.push({ mode: 'update', ref: doc(db, 'attendance', aid), data: baseAtt });
        } else {
          phase2Ops.push({
            mode: 'set',
            ref: doc(db, 'attendance', aid),
            data: { ...baseAtt, ownerUid: adminUid, createdAt: serverTimestamp() },
          });
        }
      });

      const inputQSets = Array.isArray(dataset.questionSets) ? dataset.questionSets : [];
      inputQSets.forEach((qs, idx) => {
        const qid = toValidId(qs.id, 'qset', idx);
        const exists = cloudIdsRef.current.questionSets.has(qid);
        const baseQs: Record<string, unknown> = {
          title: clampStr(qs.title || 'Paket Soal AI', 200),
          subject: clampStr(qs.subject || srcTeacher.subject || 'Umum', 120),
          sourceMaterial: clampStr(qs.sourceMaterial || '', 35000),
          createdAtStr: clampStr(qs.createdAt || new Date().toISOString().split('T')[0], 30),
          pgCount: Math.min(50, Math.max(0, Math.trunc(qs.pgCount || qs.multipleChoice?.length || 0))),
          essayCount: Math.min(5, Math.max(0, Math.trunc(qs.essayCount || qs.essay?.length || 0))),
          multipleChoice: (qs.multipleChoice || []).slice(0, 50),
          essay: (qs.essay || []).slice(0, 5),
          updatedAt: serverTimestamp(),
        };
        if (exists) {
          phase2Ops.push({ mode: 'update', ref: doc(db, 'questionSets', qid), data: baseQs });
        } else {
          phase2Ops.push({
            mode: 'set',
            ref: doc(db, 'questionSets', qid),
            data: { ...baseQs, ownerUid: adminUid, createdAt: serverTimestamp() },
          });
        }
      });

      await commitBatchOps(phase2Ops);

      // Phase 3 & 4: Submissions (only if matching taskId & studentId exist; create without score/note, then grade)
      const inputSubs = Array.isArray(dataset.submissions) ? dataset.submissions : [];
      const phase3Ops: Array<{ mode: 'set' | 'update'; ref: ReturnType<typeof doc>; data: Record<string, unknown> }> = [];
      const phase4Ops: Array<{ mode: 'set' | 'update'; ref: ReturnType<typeof doc>; data: Record<string, unknown> }> = [];

      inputSubs.forEach((sub, idx) => {
        const subId = toValidId(sub.id, 'sub', idx);
        const mappedTaskId = taskIdMap.get(sub.taskId) || sub.taskId;
        const mappedStudentId = studentIdMap.get(sub.studentId) || sub.studentId;
        const taskOk = validTaskIds.has(mappedTaskId) || cloudIdsRef.current.tasks.has(mappedTaskId);
        const studentOk = validStudentIds.has(mappedStudentId) || cloudIdsRef.current.students.has(mappedStudentId);
        if (!taskOk || !studentOk) return;

        const exists = cloudIdsRef.current.submissions.has(subId);
        if (!exists) {
          const createSub: Record<string, unknown> = {
            taskId: mappedTaskId,
            studentId: mappedStudentId,
            studentName: clampStr(sub.studentName || 'Siswa', 120),
            studentUid: adminUid,
            ownerUid: taskOwnerMapRef.current[mappedTaskId] || adminUid,
            submittedAt: clampStr(sub.submittedAt || new Date().toISOString().split('T')[0], 40),
            workText: clampStr(sub.workText || '-', 20000),
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          };
          if (sub.linkAttachment) createSub.linkAttachment = clampStr(sub.linkAttachment, 500);
          if (sub.attachment) {
            createSub.attachmentName = clampStr(sub.attachment.name, 200);
            createSub.attachmentSize = clampStr(sub.attachment.size, 40);
            createSub.attachmentType = sub.attachment.type;
            if (
              sub.attachment.dataUrl &&
              sub.attachment.dataUrl.length <= MAX_FIRESTORE_ATTACHMENT_CHARS
            ) {
              createSub.attachmentDataUrl = sub.attachment.dataUrl;
            }
          }
          phase3Ops.push({ mode: 'set', ref: doc(db, 'submissions', subId), data: createSub });
        }

        if (typeof sub.score === 'number' || (typeof sub.note === 'string' && sub.note.trim())) {
          const gradePatch: Record<string, unknown> = { updatedAt: serverTimestamp() };
          if (typeof sub.score === 'number') {
            gradePatch.score = Math.min(100, Math.max(0, sub.score));
          }
          if (typeof sub.note === 'string' && sub.note.trim()) {
            gradePatch.note = clampStr(sub.note, 1000);
          }
          phase4Ops.push({ mode: 'update', ref: doc(db, 'submissions', subId), data: gradePatch });
        }
      });

      if (phase3Ops.length > 0) await commitBatchOps(phase3Ops);
      if (phase4Ops.length > 0) await commitBatchOps(phase4Ops);

      return {
        classes: inputClasses.length,
        students: inputStudents.length,
        materials: inputMaterials.length,
        tasks: inputTasks.length,
        attendance: syncedAttendanceCount,
        questionSets: inputQSets.length,
      };
    },
    []
  );

  // Seed existing local LMS data into an empty Cloud Firestore on first Admin connection
  const seedCloudDatabaseIfEmpty = useCallback(
    async (adminUid: string) => {
      if (hasSeededCloudRef.current) return;
      hasSeededCloudRef.current = true;

      try {
        const pubSnap = await getDoc(doc(db, 'settings', 'teacherPublic'));
        if (pubSnap.exists()) return;

        isSeedingCloudRef.current = true;
        const snapshot = latestLocalRef.current;
        await pushDatasetToFirestore(adminUid, {
          teacher: snapshot.teacher,
          classes: snapshot.classes,
          students: snapshot.studentsRoster,
          materials: snapshot.materials,
          tasks: snapshot.tasks,
          attendance: snapshot.attendance,
          questionSets: snapshot.questionSets,
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, 'bootstrap_seed');
      } finally {
        isSeedingCloudRef.current = false;
      }
    },
    [pushDatasetToFirestore]
  );

  // Trigger seed check when admin logs in
  useEffect(() => {
    if (firebaseUser && firebaseUser.emailVerified && isCloudAdmin) {
      void seedCloudDatabaseIfEmpty(firebaseUser.uid);
    }
  }, [firebaseUser, isCloudAdmin, seedCloudDatabaseIfEmpty]);

  // Real-time Firestore subscriptions for classroom entities when authenticated (verified Google or anonymous student)
  useEffect(() => {
    if (!canAccessStudentCloud || !firebaseUser) return;

    const unsubscribers: Array<() => void> = [];

    // 1. Public Teacher Profile
    unsubscribers.push(
      onSnapshot(
        doc(db, 'settings', 'teacherPublic'),
        (snap) => {
          cloudIdsRef.current.hasTeacherPublic = snap.exists();
          if (snap.exists()) {
            const d = snap.data();
            if (typeof d.ownerUid === 'string') {
              teacherOwnerUidRef.current = d.ownerUid;
            }
            setTeacher((prev) => ({
              ...prev,
              name: typeof d.name === 'string' ? d.name : prev.name,
              subject: typeof d.subject === 'string' ? d.subject : prev.subject,
              kktp: typeof d.kktp === 'number' ? d.kktp : prev.kktp,
            }));
          }
        },
        (error) => handleFirestoreError(error, OperationType.GET, 'settings/teacherPublic')
      )
    );

    // 2. Classes
    unsubscribers.push(
      onSnapshot(
        query(collection(db, 'classes'), where('visibility', '==', 'classroom')),
        (snap) => {
          cloudIdsRef.current.classes = new Set(snap.docs.map((d) => d.id));
          const list: ClassRoom[] = snap.docs.map((docSnap) => {
            const d = docSnap.data();
            return {
              id: docSnap.id,
              name: d.name || '',
              whatsappGroupUrl: d.whatsappGroupUrl || undefined,
            };
          });
          list.sort((a, b) => a.name.localeCompare(b.name, 'id'));
          if (!isSeedingCloudRef.current || list.length > 0) {
            setClasses(list);
          }
        },
        (error) => handleFirestoreError(error, OperationType.LIST, 'classes')
      )
    );

    // 3. Students Roster
    unsubscribers.push(
      onSnapshot(
        query(collection(db, 'students'), where('visibility', '==', 'classroom')),
        (snap) => {
          cloudIdsRef.current.students = new Set(snap.docs.map((d) => d.id));
          const ownerMap: Record<string, string> = {};
          const claimMap: Record<string, string> = {};
          const list: Student[] = snap.docs.map((docSnap) => {
            const d = docSnap.data();
            if (typeof d.ownerUid === 'string') ownerMap[docSnap.id] = d.ownerUid;
            if (typeof d.claimedByUid === 'string') claimMap[docSnap.id] = d.claimedByUid;
            return {
              id: docSnap.id,
              name: d.name || '',
              classId: d.classId || '',
            };
          });
          studentOwnerMapRef.current = ownerMap;
          studentClaimedMapRef.current = claimMap;
          setStudentsRoster(list);
        },
        (error) => handleFirestoreError(error, OperationType.LIST, 'students')
      )
    );

    // 4. Materials
    unsubscribers.push(
      onSnapshot(
        query(collection(db, 'materials'), where('visibility', '==', 'classroom')),
        (snap) => {
          cloudIdsRef.current.materials = new Set(snap.docs.map((d) => d.id));
          const list: Material[] = snap.docs.map((docSnap) => {
            const d = docSnap.data();
            const hasAttachment = Boolean(d.attachmentName);
            return {
              id: docSnap.id,
              title: d.title || '',
              subject: typeof d.subject === 'string' && d.subject.trim() ? d.subject.trim() : undefined,
              content: d.content || '',
              linkUrl: d.linkUrl || undefined,
              classId: d.classId || 'all',
              date: d.date || '',
              attachment: hasAttachment
                ? {
                    name: d.attachmentName,
                    size: d.attachmentSize || '',
                    type: d.attachmentType || 'other',
                    dataUrl: d.attachmentDataUrl || '',
                  }
                : undefined,
            };
          });
          list.sort((a, b) => b.id.localeCompare(a.id));
          setMaterials(list);
          // Hydrate any oversized attachments stored locally in IndexedDB
          list.forEach((m) => {
            if (m.attachment && !m.attachment.dataUrl) {
              void getFileAttachment(m.id).then((url) => {
                if (url) {
                  setMaterials((prev) =>
                    prev.map((item) =>
                      item.id === m.id && item.attachment && !item.attachment.dataUrl
                        ? { ...item, attachment: { ...item.attachment, dataUrl: url } }
                        : item
                    )
                  );
                }
              });
            }
          });
        },
        (error) => handleFirestoreError(error, OperationType.LIST, 'materials')
      )
    );

    // 5. Tasks
    unsubscribers.push(
      onSnapshot(
        query(collection(db, 'tasks'), where('visibility', '==', 'classroom')),
        (snap) => {
          cloudIdsRef.current.tasks = new Set(snap.docs.map((d) => d.id));
          const ownerMap: Record<string, string> = {};
          const list: Task[] = snap.docs.map((docSnap) => {
            const d = docSnap.data();
            if (typeof d.ownerUid === 'string') ownerMap[docSnap.id] = d.ownerUid;
            const hasAttachment = Boolean(d.attachmentName);
            return {
              id: docSnap.id,
              title: d.title || '',
              subject: typeof d.subject === 'string' && d.subject.trim() ? d.subject.trim() : undefined,
              instructions: d.instructions || '',
              dueDate: d.dueDate || '',
              classId: d.classId || 'all',
              createdAt: d.createdAtStr || '',
              attachment: hasAttachment
                ? {
                    name: d.attachmentName,
                    size: d.attachmentSize || '',
                    type: d.attachmentType || 'other',
                    dataUrl: d.attachmentDataUrl || '',
                  }
                : undefined,
            };
          });
          taskOwnerMapRef.current = ownerMap;
          list.sort((a, b) => b.id.localeCompare(a.id));
          setTasks(list);
          list.forEach((t) => {
            if (t.attachment && !t.attachment.dataUrl) {
              void getFileAttachment(t.id).then((url) => {
                if (url) {
                  setTasks((prev) =>
                    prev.map((item) =>
                      item.id === t.id && item.attachment && !item.attachment.dataUrl
                        ? { ...item, attachment: { ...item.attachment, dataUrl: url } }
                        : item
                    )
                  );
                }
              });
            }
          });
        },
        (error) => handleFirestoreError(error, OperationType.LIST, 'tasks')
      )
    );

    // 6. Attendance
    unsubscribers.push(
      onSnapshot(
        query(collection(db, 'attendance'), where('visibility', '==', 'classroom')),
        (snap) => {
          cloudIdsRef.current.attendance = new Set(snap.docs.map((d) => d.id));
          const list: AttendanceRecord[] = snap.docs.map((docSnap) => {
            const d = docSnap.data();
            return {
              id: docSnap.id,
              date: d.date || '',
              classId: d.classId || '',
              subject: typeof d.subject === 'string' && d.subject.trim() ? d.subject.trim() : undefined,
              topic: d.topic || '',
              records: d.records || {},
            };
          });
          list.sort((a, b) => b.date.localeCompare(a.date));
          setAttendance(list);
        },
        (error) => handleFirestoreError(error, OperationType.LIST, 'attendance')
      )
    );

    // 7. Submissions (Admin reads all owned/bootstrap; Student reads only their own studentUid)
    const submissionsQuery = isCloudAdmin
      ? firebaseUser.email === BOOTSTRAP_ADMIN_EMAIL
        ? collection(db, 'submissions')
        : query(collection(db, 'submissions'), where('ownerUid', '==', firebaseUser.uid))
      : query(collection(db, 'submissions'), where('studentUid', '==', firebaseUser.uid));

    unsubscribers.push(
      onSnapshot(
        submissionsQuery,
        (snap) => {
          cloudIdsRef.current.submissions = new Set(snap.docs.map((d) => d.id));
          const sUidMap: Record<string, string> = {};
          const list: Submission[] = snap.docs.map((docSnap) => {
            const d = docSnap.data();
            if (typeof d.studentUid === 'string') sUidMap[docSnap.id] = d.studentUid;
            const hasAttachment = Boolean(d.attachmentName);
            return {
              id: docSnap.id,
              taskId: d.taskId || '',
              studentId: d.studentId || '',
              studentName: d.studentName || '',
              submittedAt: d.submittedAt || '',
              workText: d.workText || '',
              linkAttachment: d.linkAttachment || undefined,
              attachment: hasAttachment
                ? {
                    name: d.attachmentName,
                    size: d.attachmentSize || '',
                    type: d.attachmentType || 'other',
                    dataUrl: d.attachmentDataUrl || '',
                  }
                : undefined,
              score: typeof d.score === 'number' ? d.score : undefined,
              note: typeof d.note === 'string' ? d.note : undefined,
            };
          });
          submissionStudentUidMapRef.current = sUidMap;
          list.sort((a, b) => b.id.localeCompare(a.id));
          setSubmissions(list);
          list.forEach((sub) => {
            if (sub.attachment && !sub.attachment.dataUrl) {
              void getFileAttachment(sub.id).then((url) => {
                if (url) {
                  setSubmissions((prev) =>
                    prev.map((item) =>
                      item.id === sub.id && item.attachment && !item.attachment.dataUrl
                        ? { ...item, attachment: { ...item.attachment, dataUrl: url } }
                        : item
                    )
                  );
                }
              });
            }
          });
        },
        (error) => handleFirestoreError(error, OperationType.LIST, 'submissions')
      )
    );

    // 8. Admin-only Teacher Private Settings & AI Question Sets
    if (isCloudAdmin) {
      unsubscribers.push(
        onSnapshot(
          doc(db, 'settings', 'teacherPrivate'),
          (snap) => {
            cloudIdsRef.current.hasTeacherPrivate = snap.exists();
            if (snap.exists()) {
              const d = snap.data();
              setTeacher((prev) => ({
                ...prev,
                pin: typeof d.pin === 'string' ? d.pin : prev.pin,
                nip: typeof d.nip === 'string' ? d.nip : prev.nip,
                recoveryQuestion:
                  typeof d.recoveryQuestion === 'string' ? d.recoveryQuestion : prev.recoveryQuestion,
                recoveryAnswer:
                  typeof d.recoveryAnswer === 'string' ? d.recoveryAnswer : prev.recoveryAnswer,
              }));
            }
          },
          (error) => handleFirestoreError(error, OperationType.GET, 'settings/teacherPrivate')
        )
      );

      const qSetsQuery =
        firebaseUser.email === BOOTSTRAP_ADMIN_EMAIL
          ? collection(db, 'questionSets')
          : query(collection(db, 'questionSets'), where('ownerUid', '==', firebaseUser.uid));

      unsubscribers.push(
        onSnapshot(
          qSetsQuery,
          (snap) => {
            cloudIdsRef.current.questionSets = new Set(snap.docs.map((d) => d.id));
            const list: GeneratedQuestionSet[] = snap.docs.map((docSnap) => {
              const d = docSnap.data();
              return {
                id: docSnap.id,
                title: d.title || '',
                subject: d.subject || '',
                sourceMaterial: d.sourceMaterial || '',
                createdAt: d.createdAtStr || '',
                pgCount: typeof d.pgCount === 'number' ? d.pgCount : 0,
                essayCount: typeof d.essayCount === 'number' ? d.essayCount : 0,
                multipleChoice: Array.isArray(d.multipleChoice) ? d.multipleChoice : [],
                essay: Array.isArray(d.essay) ? d.essay : [],
              };
            });
            list.sort((a, b) => b.id.localeCompare(a.id));
            setQuestionSets(list);
          },
          (error) => handleFirestoreError(error, OperationType.LIST, 'questionSets')
        )
      );
    }

    // 9. Online CBT Exams (Classroom-scoped for all students and teachers)
    unsubscribers.push(
      onSnapshot(
        query(collection(db, 'cbtExams'), where('visibility', '==', 'classroom')),
        (snap) => {
          cloudIdsRef.current.cbtExams = new Set(snap.docs.map((d) => d.id));
          const ownerMap: Record<string, string> = {};
          const list: CbtExam[] = snap.docs.map((docSnap) => {
            const d = docSnap.data();
            if (typeof d.ownerUid === 'string') ownerMap[docSnap.id] = d.ownerUid;
            return {
              id: docSnap.id,
              questionSetId: typeof d.questionSetId === 'string' ? d.questionSetId : '',
              title: d.title || '',
              subject: d.subject || '',
              classId: d.classId || 'all',
              durationMinutes: typeof d.durationMinutes === 'number' ? d.durationMinutes : 30,
              showResultToStudent: Boolean(d.showResultToStudent),
              isActive: d.isActive !== false,
              createdAt: d.createdAtStr || '',
              multipleChoice: Array.isArray(d.multipleChoice) ? d.multipleChoice : [],
              essay: Array.isArray(d.essay) ? d.essay : [],
            };
          });
          cbtExamOwnerMapRef.current = ownerMap;
          list.sort((a, b) => b.id.localeCompare(a.id));
          setCbtExams(list);
        },
        (error) => handleFirestoreError(error, OperationType.LIST, 'cbtExams')
      )
    );

    // 10. CBT Results (Admin reads all owned/bootstrap; Student reads only their own studentUid)
    const cbtResultsQuery = isCloudAdmin
      ? firebaseUser.email === BOOTSTRAP_ADMIN_EMAIL
        ? collection(db, 'cbtResults')
        : query(collection(db, 'cbtResults'), where('ownerUid', '==', firebaseUser.uid))
      : query(collection(db, 'cbtResults'), where('studentUid', '==', firebaseUser.uid));

    unsubscribers.push(
      onSnapshot(
        cbtResultsQuery,
        (snap) => {
          cloudIdsRef.current.cbtResults = new Set(snap.docs.map((d) => d.id));
          const list: CbtAttempt[] = snap.docs.map((docSnap) => {
            const d = docSnap.data();
            return {
              id: docSnap.id,
              examId: d.examId || '',
              examTitle: d.examTitle || '',
              questionSetId: typeof d.questionSetId === 'string' ? d.questionSetId : undefined,
              studentId: d.studentId || '',
              studentName: d.studentName || '',
              classId: d.classId || '',
              subject: d.subject || '',
              pgAnswers: (d.pgAnswers as Record<string, number>) || {},
              essayAnswers: (d.essayAnswers as Record<string, string>) || {},
              pgCorrect: typeof d.pgCorrect === 'number' ? d.pgCorrect : 0,
              pgTotal: typeof d.pgTotal === 'number' ? d.pgTotal : 0,
              pgScore: typeof d.pgScore === 'number' ? d.pgScore : 0,
              essayScore: typeof d.essayScore === 'number' ? d.essayScore : undefined,
              finalScore: typeof d.finalScore === 'number' ? d.finalScore : 0,
              teacherNote: typeof d.teacherNote === 'string' ? d.teacherNote : undefined,
              submittedAt: d.submittedAt || '',
              durationSpentSec: typeof d.durationSpentSec === 'number' ? d.durationSpentSec : undefined,
            };
          });
          list.sort((a, b) => b.id.localeCompare(a.id));
          setCbtResults(list);
        },
        (error) => handleFirestoreError(error, OperationType.LIST, 'cbtResults')
      )
    );

    return () => {
      unsubscribers.forEach((unsub) => unsub());
    };
  }, [firebaseUser, isCloudAdmin, canAccessStudentCloud]);

  // Isolated Private WhatsApp Contacts Listener (per student doc to avoid unindexed collectionGroup errors)
  useEffect(() => {
    if (!canAccessStudentCloud || !firebaseUser) {
      setStudentContacts({});
      return;
    }

    const targetIds: string[] = isCloudAdmin
      ? studentsRoster.map((s) => s.id)
      : authSession?.role === 'student' &&
        currentStudentId &&
        studentClaimedMapRef.current[currentStudentId] === firebaseUser.uid
      ? [currentStudentId]
      : [];

    if (targetIds.length === 0) return;

    const unsubs = targetIds.map((studentId) =>
      onSnapshot(
        doc(db, 'students', studentId, 'private', 'contact'),
        (snap) => {
          if (snap.exists()) {
            cloudIdsRef.current.contacts.add(studentId);
          } else {
            cloudIdsRef.current.contacts.delete(studentId);
          }
          const waVal = snap.exists() ? String(snap.data().whatsapp || '') : '';
          setStudentContacts((prev) => {
            if (prev[studentId] === waVal) return prev;
            return { ...prev, [studentId]: waVal };
          });
        },
        (error) =>
          handleFirestoreError(error, OperationType.GET, `students/${studentId}/private/contact`)
      )
    );

    return () => {
      unsubs.forEach((unsub) => unsub());
    };
  }, [firebaseUser, isCloudAdmin, canAccessStudentCloud, studentsRoster, authSession?.role, currentStudentId]);

  const handleGoogleAuthFailure = async (
    err: unknown,
    intendedRole: 'teacher' | 'student'
  ): Promise<void> => {
    const code = (err as { code?: string })?.code || '';
    const rawMsg = err instanceof Error ? err.message : String(err);
    console.error('Google Auth failure:', code, err);

    if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
      return;
    }

    setCloudAuthErrorCode(code || 'auth/unknown');

    if (code === 'auth/popup-blocked') {
      if (!isInIframe) {
        try {
          sessionStorage.setItem('gm_google_redirect_role', intendedRole);
          await signInWithGoogleRedirect();
          return;
        } catch (redirectErr) {
          console.error('Google redirect fallback failed:', redirectErr);
        }
      }
      setCloudAuthError(
        'Pop-up login Google diblokir oleh browser atau mode pratinjau. Izinkan pop-up pada browser Anda atau buka aplikasi di tab baru.'
      );
      return;
    }

    if (code === 'auth/unauthorized-domain') {
      const host = typeof window !== 'undefined' ? window.location.hostname : '';
      setCloudAuthError(
        `Domain (${host}) belum terdaftar di Authorized Domains Firebase Auth (${code}). Tambahkan domain ini di Firebase Console → Authentication → Settings → Authorized domains.`
      );
      return;
    }

    if (code === 'auth/operation-not-allowed') {
      setCloudAuthError(
        `Provider Login Google belum aktif di Firebase Console (${code}).`
      );
      return;
    }

    if (code === 'auth/web-storage-unsupported' || rawMsg.toLowerCase().includes('storage')) {
      setCloudAuthError(
        `Browser memblokir cookie/penyimpanan untuk login Google (${code || 'storage-blocked'}). Buka di tab baru atau nonaktifkan pemblokiran cookie pihak ketiga.`
      );
      return;
    }

    if (code === 'auth/network-request-failed') {
      setCloudAuthError(
        'Gagal terhubung ke server Google. Periksa koneksi internet Anda lalu coba lagi.'
      );
      return;
    }

    setCloudAuthError(
      `Gagal masuk dengan Google (${code || rawMsg}). Izinkan pop-up browser atau buka aplikasi di tab baru.`
    );
  };

  const loginWithGoogleRedirect = async (intendedRole: 'teacher' | 'student'): Promise<void> => {
    clearCloudAuthError();
    try {
      sessionStorage.setItem('gm_google_redirect_role', intendedRole);
      await signInWithGoogleRedirect();
    } catch (err) {
      await handleGoogleAuthFailure(err, intendedRole);
    }
  };

  // Authentication Handlers
  const loginWithGoogleAsTeacher = async (): Promise<boolean> => {
    clearCloudAuthError();
    try {
      const user = await signInWithGooglePopup();
      if (!user.emailVerified) {
        setCloudAuthError('Email Google Anda belum terverifikasi.');
        return false;
      }
      const adminOk = await checkUserAdminStatus(user);
      if (!adminOk) {
        setCloudAuthError(
          `Akses ditolak: Akun Google (${user.email || 'ini'}) bukan Guru/Admin terdaftar. Siswa tidak diperbolehkan masuk ke ruang Guru & Admin. Silakan masuk melalui tab "Masuk Siswa".`
        );
        await signOutFirebase();
        return false;
      }
      setIsCloudAdmin(true);
      setAuthSession({ role: 'teacher' });
      setViewModeState('teacher');
      return true;
    } catch (err) {
      await handleGoogleAuthFailure(err, 'teacher');
      return false;
    }
  };

  const connectGoogleForStudent = async (): Promise<boolean> => {
    clearCloudAuthError();
    try {
      const user = await signInWithGooglePopup();
      if (!user.emailVerified) {
        setCloudAuthError('Email Google Anda belum terverifikasi.');
        return false;
      }
      return true;
    } catch (err) {
      await handleGoogleAuthFailure(err, 'student');
      return false;
    }
  };

  // Disabled local PIN bypass: teacher/admin access strictly requires verified Google Cloud Admin
  const loginAsTeacher = (_inputPin: string): boolean => {
    if (firebaseUser && firebaseUser.emailVerified && isCloudAdmin) {
      setAuthSession({ role: 'teacher' });
      setViewModeState('teacher');
      return true;
    }
    return false;
  };

  const syncStudentClaimAndWa = async (studentId: string, cleanWa?: string) => {
    if (!canAccessStudentCloud || !firebaseUser) return;

    const existingOwner =
      studentOwnerMapRef.current[studentId] || teacherOwnerUidRef.current || firebaseUser.uid;
    const claimedBy = studentClaimedMapRef.current[studentId];
    let canWriteContact = isCloudAdmin || claimedBy === firebaseUser.uid;

    // Claim student record for this authenticated student session if not yet claimed
    if (!isCloudAdmin && !claimedBy) {
      try {
        await updateDoc(doc(db, 'students', studentId), {
          claimedByUid: firebaseUser.uid,
          updatedAt: serverTimestamp(),
        });
        studentClaimedMapRef.current[studentId] = firebaseUser.uid;
        canWriteContact = true;
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, `students/${studentId}`);
      }
    }

    if (cleanWa && canWriteContact) {
      const contactPath = `students/${studentId}/private/contact`;
      try {
        await setDoc(doc(db, 'students', studentId, 'private', 'contact'), {
          whatsapp: clampStr(cleanWa, 30),
          studentUid: isCloudAdmin ? claimedBy || '' : firebaseUser.uid,
          ownerUid: existingOwner,
          updatedAt: serverTimestamp(),
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, contactPath);
      }
    }
  };

  const loginAsStudent = (studentId: string, whatsapp?: string) => {
    clearCloudAuthError();
    const cleanWa = whatsapp?.trim();
    if (cleanWa) {
      setStudentsRoster((prev) =>
        prev.map((s) => (s.id === studentId ? { ...s, whatsapp: cleanWa } : s))
      );
      setStudentContacts((prev) => ({ ...prev, [studentId]: cleanWa }));
    }
    const session: AuthSession = { role: 'student', studentId };
    setAuthSession(session);
    try {
      localStorage.setItem('gm_student_session', JSON.stringify(session));
    } catch {
      // ignore localStorage quota error
    }
    setCurrentStudentId(studentId);
    setViewModeState('student');
    const targetStudent = studentsRoster.find((s) => s.id === studentId);
    if (targetStudent) {
      setActiveClassId(targetStudent.classId);
    }

    if (canAccessStudentCloud) {
      void syncStudentClaimAndWa(studentId, cleanWa);
    }
  };

  // When a student session becomes synced (anonymous or optional Google), sync their claim & WA
  useEffect(() => {
    if (canAccessStudentCloud && authSession?.role === 'student' && currentStudentId) {
      const localWa =
        studentContacts[currentStudentId] ||
        studentsRoster.find((s) => s.id === currentStudentId)?.whatsapp;
      void syncStudentClaimAndWa(currentStudentId, localWa);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firebaseUser?.uid, canAccessStudentCloud, authSession?.role, currentStudentId]);

  const logout = () => {
    setAuthSession(null);
    setViewModeState('student');
    setIsCloudAdmin(false);
    localStorage.removeItem('gm_cloud_uid');
    localStorage.removeItem('gm_student_session');
    // Only sign out of Google sessions; keep anonymous session intact so browser retains Cloud sync & submission ownership
    if (firebaseUser && !firebaseUser.isAnonymous) {
      void signOutFirebase();
    }
  };

  const resetTeacherPin = (newPin: string) => {
    if (!firebaseUser || !firebaseUser.emailVerified || !isCloudAdmin || authSession?.role !== 'teacher') return;
    const cleanPin = sanitizePin(newPin);
    if (!newPin.trim()) return;
    setTeacher((prev) => ({ ...prev, pin: cleanPin }));
    void setDoc(
      doc(db, 'settings', 'teacherPrivate'),
      {
        pin: cleanPin,
        ...(teacher.nip ? { nip: clampStr(teacher.nip, 50) } : {}),
        ...(teacher.recoveryQuestion ? { recoveryQuestion: clampStr(teacher.recoveryQuestion, 200) } : {}),
        ...(teacher.recoveryAnswer ? { recoveryAnswer: clampStr(teacher.recoveryAnswer, 100) } : {}),
        ownerUid: firebaseUser.uid,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    ).catch((error) => handleFirestoreError(error, OperationType.WRITE, 'settings/teacherPrivate'));
  };

  // LocalStorage mirror effects (provides fast cache + offline/demo fallback)
  useEffect(() => {
    localStorage.setItem('gm_teacher', JSON.stringify(teacher));
  }, [teacher]);

  useEffect(() => {
    localStorage.setItem('gm_classes', JSON.stringify(classes));
  }, [classes]);

  useEffect(() => {
    localStorage.setItem('gm_students', JSON.stringify(students));
  }, [students]);

  useEffect(() => {
    try {
      localStorage.setItem('gm_ai_questions', JSON.stringify(questionSets));
    } catch (e) {
      console.warn('LocalStorage save failed for questionSets:', e);
    }
  }, [questionSets]);

  useEffect(() => {
    try {
      localStorage.setItem('gm_cbt_exams', JSON.stringify(cbtExams));
    } catch (e) {
      console.warn('LocalStorage save failed for cbtExams:', e);
    }
  }, [cbtExams]);

  useEffect(() => {
    try {
      localStorage.setItem('gm_cbt_results', JSON.stringify(cbtResults));
    } catch (e) {
      console.warn('LocalStorage save failed for cbtResults:', e);
    }
  }, [cbtResults]);

  // Self-heal: ensure all students belong to an existing class (local mode only; Firestore is authoritative in cloud mode)
  useEffect(() => {
    if (canAccessStudentCloud) return;
    if (classes.length > 0) {
      const validClassIds = new Set(classes.map((c) => c.id));
      setStudentsRoster((prev) => {
        let changed = false;
        const updated = prev.map((s) => {
          if (!validClassIds.has(s.classId)) {
            changed = true;
            return { ...s, classId: classes[0].id };
          }
          return s;
        });
        return changed ? updated : prev;
      });
    }
  }, [classes, canAccessStudentCloud]);

  // Materials persistence with IndexedDB fallback
  useEffect(() => {
    try {
      localStorage.setItem('gm_materials', JSON.stringify(materials));
    } catch {
      const safeMaterials = materials.map((m) => {
        if (m.attachment?.dataUrl) {
          saveFileAttachment(m.id, m.attachment.dataUrl);
          return { ...m, attachment: { ...m.attachment, dataUrl: '' } };
        }
        return m;
      });
      try {
        localStorage.setItem('gm_materials', JSON.stringify(safeMaterials));
      } catch (e) {
        console.warn('LocalStorage save failed for materials:', e);
      }
    }
  }, [materials]);

  // Tasks persistence with IndexedDB fallback
  useEffect(() => {
    try {
      localStorage.setItem('gm_tasks', JSON.stringify(tasks));
    } catch {
      const safeTasks = tasks.map((t) => {
        if (t.attachment?.dataUrl) {
          saveFileAttachment(t.id, t.attachment.dataUrl);
          return { ...t, attachment: { ...t.attachment, dataUrl: '' } };
        }
        return t;
      });
      try {
        localStorage.setItem('gm_tasks', JSON.stringify(safeTasks));
      } catch (e) {
        console.warn('LocalStorage save failed for tasks:', e);
      }
    }
  }, [tasks]);

  // Hydrate attachments from IndexedDB on initial mount
  useEffect(() => {
    materials.forEach((m) => {
      if (m.attachment && !m.attachment.dataUrl) {
        void getFileAttachment(m.id).then((url) => {
          if (url) {
            setMaterials((prev) =>
              prev.map((item) =>
                item.id === m.id && item.attachment ? { ...item, attachment: { ...item.attachment, dataUrl: url } } : item
              )
            );
          }
        });
      }
    });
    tasks.forEach((t) => {
      if (t.attachment && !t.attachment.dataUrl) {
        void getFileAttachment(t.id).then((url) => {
          if (url) {
            setTasks((prev) =>
              prev.map((item) =>
                item.id === t.id && item.attachment ? { ...item, attachment: { ...item.attachment, dataUrl: url } } : item
              )
            );
          }
        });
      }
    });
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem('gm_submissions', JSON.stringify(submissions));
    } catch (e) {
      console.warn('LocalStorage save failed for submissions:', e);
    }
  }, [submissions]);

  useEffect(() => {
    try {
      localStorage.setItem('gm_attendance', JSON.stringify(attendance));
    } catch (e) {
      console.warn('LocalStorage save failed for attendance:', e);
    }
  }, [attendance]);

  // Actions (guarded so students can never invoke teacher/admin mutations)
  const isAuthorizedTeacher = Boolean(
    firebaseUser && firebaseUser.emailVerified && isCloudAdmin && authSession?.role === 'teacher'
  );

  const updateTeacher = (profile: Partial<TeacherProfile>) => {
    if (!isAuthorizedTeacher || !firebaseUser) return;
    const next = { ...teacher, ...profile };
    setTeacher(next);

    void setDoc(
      doc(db, 'settings', 'teacherPublic'),
      {
        name: clampStr(next.name || 'Guru Mapel', 120),
        subject: clampStr(next.subject || 'Mata Pelajaran', 300),
        kktp: typeof next.kktp === 'number' ? Math.min(100, Math.max(0, next.kktp)) : 75,
        visibility: 'classroom',
        ownerUid: teacherOwnerUidRef.current || firebaseUser.uid,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    ).catch((err) => handleFirestoreError(err, OperationType.WRITE, 'settings/teacherPublic'));

    const privPayload: Record<string, unknown> = {
      pin: sanitizePin(next.pin),
      ownerUid: teacherOwnerUidRef.current || firebaseUser.uid,
      updatedAt: serverTimestamp(),
    };
    if (next.nip) privPayload.nip = clampStr(next.nip, 50);
    if (next.recoveryQuestion) privPayload.recoveryQuestion = clampStr(next.recoveryQuestion, 200);
    if (next.recoveryAnswer) privPayload.recoveryAnswer = clampStr(next.recoveryAnswer, 100);

    void setDoc(doc(db, 'settings', 'teacherPrivate'), privPayload, { merge: true }).catch((err) =>
      handleFirestoreError(err, OperationType.WRITE, 'settings/teacherPrivate')
    );
  };

  const addClass = (name: string): string | null => {
    if (!isAuthorizedTeacher || !firebaseUser || !name.trim()) return null;
    const newClass: ClassRoom = {
      id: 'c_' + Date.now(),
      name: clampStr(name.trim(), 80),
    };
    setClasses((prev) => [...prev, newClass]);

    const writePromise = setDoc(doc(db, 'classes', newClass.id), {
      name: newClass.name,
      visibility: 'classroom',
      ownerUid: firebaseUser.uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
      .then(() => {
        cloudIdsRef.current.classes.add(newClass.id);
      })
      .catch((err) => handleFirestoreError(err, OperationType.CREATE, `classes/${newClass.id}`))
      .finally(() => {
        delete pendingClassWritesRef.current[newClass.id];
      });

    pendingClassWritesRef.current[newClass.id] = writePromise;
    return newClass.id;
  };

  const updateClass = (id: string, patch: Partial<Pick<ClassRoom, 'name' | 'whatsappGroupUrl'>>) => {
    if (!isAuthorizedTeacher) return;
    setClasses((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)));

    const payload: Record<string, unknown> = { updatedAt: serverTimestamp() };
    if (patch.name !== undefined) payload.name = clampStr(patch.name.trim() || 'Kelas', 80);
    if (patch.whatsappGroupUrl !== undefined) {
      payload.whatsappGroupUrl = patch.whatsappGroupUrl.trim()
        ? clampStr(patch.whatsappGroupUrl.trim(), 300)
        : deleteField();
    }
    void updateDoc(doc(db, 'classes', id), payload).catch((err) =>
      handleFirestoreError(err, OperationType.UPDATE, `classes/${id}`)
    );
  };

  const deleteClass = (id: string) => {
    if (!isAuthorizedTeacher) return;
    const removedStudentIds = studentsRoster.filter((s) => s.classId === id).map((s) => s.id);
    const removedMaterialIds = materials.filter((m) => m.classId === id).map((m) => m.id);
    const removedTaskIds = tasks.filter((t) => t.classId === id).map((t) => t.id);
    const removedAttIds = attendance.filter((a) => a.classId === id).map((a) => a.id);

    setClasses((prev) => prev.filter((c) => c.id !== id));
    setStudentsRoster((prev) => prev.filter((s) => s.classId !== id));
    setMaterials((prev) => prev.filter((m) => m.classId !== id));
    setTasks((prev) => prev.filter((t) => t.classId !== id));
    setAttendance((prev) => prev.filter((a) => a.classId !== id));
    if (activeClassId === id) setActiveClassId('all');

    const runDelete = async () => {
      try {
        const batch = writeBatch(db);
        batch.delete(doc(db, 'classes', id));
        removedStudentIds.forEach((sid) => {
          batch.delete(doc(db, 'students', sid));
          batch.delete(doc(db, 'students', sid, 'private', 'contact'));
        });
        removedMaterialIds.forEach((mid) => batch.delete(doc(db, 'materials', mid)));
        removedTaskIds.forEach((tid) => batch.delete(doc(db, 'tasks', tid)));
        removedAttIds.forEach((aid) => batch.delete(doc(db, 'attendance', aid)));
        await batch.commit();
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, `classes/${id}`);
      }
    };
    void runDelete();
  };

  const deleteAllClasses = () => {
    if (!isAuthorizedTeacher) return;
    const allClassIds = classes.map((c) => c.id);
    const allStudentIds = studentsRoster.map((s) => s.id);
    const classMaterialIds = materials.filter((m) => m.classId !== 'all').map((m) => m.id);
    const classTaskIds = tasks.filter((t) => t.classId !== 'all').map((t) => t.id);
    const allAttIds = attendance.map((a) => a.id);

    setClasses([]);
    setStudentsRoster([]);
    setStudentContacts({});
    setMaterials((prev) => prev.filter((m) => m.classId === 'all'));
    setTasks((prev) => prev.filter((t) => t.classId === 'all'));
    setAttendance([]);
    setActiveClassId('all');

    if (firebaseUser && isCloudAdmin) {
      const runDeleteAll = async () => {
        try {
          const refs = [
            ...allClassIds.map((cid) => doc(db, 'classes', cid)),
            ...allStudentIds.map((sid) => doc(db, 'students', sid)),
            ...allStudentIds.map((sid) => doc(db, 'students', sid, 'private', 'contact')),
            ...classMaterialIds.map((mid) => doc(db, 'materials', mid)),
            ...classTaskIds.map((tid) => doc(db, 'tasks', tid)),
            ...allAttIds.map((aid) => doc(db, 'attendance', aid)),
          ];
          for (let i = 0; i < refs.length; i += 350) {
            const batch = writeBatch(db);
            refs.slice(i, i + 350).forEach((r) => batch.delete(r));
            await batch.commit();
          }
        } catch (err) {
          handleFirestoreError(err, OperationType.DELETE, 'classes');
        }
      };
      void runDeleteAll();
    }
  };

  const addStudent = (name: string, classId: string, whatsapp?: string) => {
    if (!isAuthorizedTeacher || !firebaseUser || !name.trim()) return;
    const cleanWa = whatsapp?.trim() || undefined;
    const newStudent: Student = {
      id: 's_' + Date.now(),
      name: clampStr(name.trim(), 120),
      classId,
      whatsapp: cleanWa,
    };
    setStudentsRoster((prev) => [...prev, newStudent]);
    if (cleanWa) {
      setStudentContacts((prev) => ({ ...prev, [newStudent.id]: cleanWa }));
    }

    const writeStudent = async () => {
      try {
        const pendingClass = pendingClassWritesRef.current[newStudent.classId];
        if (pendingClass) {
          await pendingClass;
        }
        const batch = writeBatch(db);
        batch.set(doc(db, 'students', newStudent.id), {
          name: newStudent.name,
          classId: newStudent.classId,
          visibility: 'classroom',
          ownerUid: firebaseUser.uid,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        if (cleanWa) {
          batch.set(doc(db, 'students', newStudent.id, 'private', 'contact'), {
            whatsapp: clampStr(cleanWa, 30),
            ownerUid: firebaseUser.uid,
            updatedAt: serverTimestamp(),
          });
        }
        await batch.commit();
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, `students/${newStudent.id}`);
      }
    };
    void writeStudent();
  };

  const updateStudent = (id: string, patch: Partial<Pick<Student, 'name' | 'classId' | 'whatsapp'>>) => {
    if (isAuthorizedTeacher && firebaseUser && firebaseUser.emailVerified) {
      setStudentsRoster((prev) =>
        prev.map((s) => (s.id === id ? { ...s, ...patch } : s))
      );
      if (patch.whatsapp !== undefined) {
        const cleanWa = patch.whatsapp.trim();
        setStudentContacts((prev) => ({ ...prev, [id]: cleanWa }));
      }
      if (patch.name !== undefined || patch.classId !== undefined) {
        const stuPatch: Record<string, unknown> = { updatedAt: serverTimestamp() };
        if (patch.name !== undefined) stuPatch.name = clampStr(patch.name.trim() || 'Siswa', 120);
        if (patch.classId !== undefined) stuPatch.classId = patch.classId;
        void updateDoc(doc(db, 'students', id), stuPatch).catch((err) =>
          handleFirestoreError(err, OperationType.UPDATE, `students/${id}`)
        );
      }
      if (patch.whatsapp !== undefined) {
        const cleanWa = clampStr(patch.whatsapp.trim(), 30);
        const ownerUid = studentOwnerMapRef.current[id] || firebaseUser.uid;
        void setDoc(
          doc(db, 'students', id, 'private', 'contact'),
          {
            whatsapp: cleanWa,
            ownerUid,
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        ).catch((err) =>
          handleFirestoreError(err, OperationType.WRITE, `students/${id}/private/contact`)
        );
      }
    } else if (authSession?.role === 'student' && id === currentStudentId && patch.whatsapp !== undefined) {
      // Student self-service WhatsApp update (syncs automatically via Anonymous Auth or Google Cloud sync)
      const cleanWa = patch.whatsapp.trim();
      setStudentsRoster((prev) =>
        prev.map((s) => (s.id === id ? { ...s, whatsapp: cleanWa } : s))
      );
      setStudentContacts((prev) => ({ ...prev, [id]: cleanWa }));
      if (canAccessStudentCloud) {
        void syncStudentClaimAndWa(id, cleanWa);
      }
    }
  };

  const deleteStudent = (id: string) => {
    if (!isAuthorizedTeacher) return;
    const removedSubs = submissions.filter((sub) => sub.studentId === id).map((sub) => sub.id);
    setStudentsRoster((prev) => prev.filter((s) => s.id !== id));
    setSubmissions((prev) => prev.filter((sub) => sub.studentId !== id));

    const runDel = async () => {
      try {
        const batch = writeBatch(db);
        batch.delete(doc(db, 'students', id));
        batch.delete(doc(db, 'students', id, 'private', 'contact'));
        removedSubs.forEach((subId) => batch.delete(doc(db, 'submissions', subId)));
        await batch.commit();
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, `students/${id}`);
      }
    };
    void runDel();
  };

  const addStudentsBatch = (newStudents: { name: string; classId: string; whatsapp?: string }[]) => {
    if (!isAuthorizedTeacher || !firebaseUser) return;
    const validClassIds = new Set([
      ...classes.map((c) => c.id),
      ...Object.keys(pendingClassWritesRef.current),
    ]);
    const fallbackClassId = classes[0]?.id || newStudents[0]?.classId || 'c1';

    const toAdd: Student[] = newStudents
      .filter((s) => s.name && s.name.trim().length > 0)
      .map((s, idx) => {
        const assignedClassId = validClassIds.has(s.classId) ? s.classId : fallbackClassId;
        return {
          id: 's_' + Date.now() + '_' + idx + '_' + Math.random().toString(36).substring(2, 7),
          name: clampStr(s.name.trim(), 120),
          classId: assignedClassId,
          whatsapp: s.whatsapp?.trim() || undefined,
        };
      });
    if (toAdd.length === 0) return;

    setStudentsRoster((prev) => [...prev, ...toAdd]);
    const contactUpdates: Record<string, string> = {};
    toAdd.forEach((s) => {
      if (s.whatsapp) contactUpdates[s.id] = s.whatsapp;
    });
    if (Object.keys(contactUpdates).length > 0) {
      setStudentContacts((prev) => ({ ...prev, ...contactUpdates }));
    }

    if (firebaseUser && isCloudAdmin) {
      const writeBatchStudents = async () => {
        try {
          const referencedClassIds = Array.from(new Set(toAdd.map((s) => s.classId)));
          await Promise.all(
            referencedClassIds
              .map((cid) => pendingClassWritesRef.current[cid])
              .filter((p): p is Promise<void> => Boolean(p))
          );

          const ops: Array<{ ref: ReturnType<typeof doc>; data: Record<string, unknown> }> = [];
          toAdd.forEach((s) => {
            ops.push({
              ref: doc(db, 'students', s.id),
              data: {
                name: s.name,
                classId: s.classId,
                visibility: 'classroom',
                ownerUid: firebaseUser.uid,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
              },
            });
            if (s.whatsapp) {
              ops.push({
                ref: doc(db, 'students', s.id, 'private', 'contact'),
                data: {
                  whatsapp: clampStr(s.whatsapp, 30),
                  ownerUid: firebaseUser.uid,
                  updatedAt: serverTimestamp(),
                },
              });
            }
          });
          for (let i = 0; i < ops.length; i += 350) {
            const batch = writeBatch(db);
            ops.slice(i, i + 350).forEach((op) => batch.set(op.ref, op.data));
            await batch.commit();
          }
        } catch (err) {
          handleFirestoreError(err, OperationType.CREATE, 'students_batch');
        }
      };
      void writeBatchStudents();
    }
  };

  const exportBackup = () => {
    if (!isAuthorizedTeacher) return;
    const data = {
      teacher,
      classes,
      students,
      materials,
      tasks,
      submissions,
      attendance,
      questionSets,
      cbtExams,
      cbtResults,
      exportDate: new Date().toISOString(),
      version: '1.2',
    };
    const jsonStr = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const safeSubj = getPrimarySubject(teacher.subject).replace(/[^a-zA-Z0-9_-]+/g, '_');
    a.download = `Backup_LMS_${safeSubj}_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const hydrateAttachmentsForUpload = async (
    mats: Material[],
    tsks: Task[]
  ): Promise<{ materials: Material[]; tasks: Task[] }> => {
    const hydratedMats = await Promise.all(
      mats.map(async (m) => {
        if (m.attachment && !m.attachment.dataUrl) {
          const url = await getFileAttachment(m.id);
          if (url) {
            return { ...m, attachment: { ...m.attachment, dataUrl: url } };
          }
        }
        return m;
      })
    );
    const hydratedTasks = await Promise.all(
      tsks.map(async (t) => {
        if (t.attachment && !t.attachment.dataUrl) {
          const url = await getFileAttachment(t.id);
          if (url) {
            return { ...t, attachment: { ...t.attachment, dataUrl: url } };
          }
        }
        return t;
      })
    );
    return { materials: hydratedMats, tasks: hydratedTasks };
  };

  const syncLocalDataToCloud = async (): Promise<{ ok: boolean; message: string }> => {
    if (!firebaseUser || !firebaseUser.emailVerified || !isCloudAdmin || authSession?.role !== 'teacher') {
      return {
        ok: false,
        message:
          'Akses ditolak: Hanya Guru & Admin terdaftar yang dapat mengunggah data ke Database Cloud.',
      };
    }

    const precloud = safeParse<{
      teacher?: TeacherProfile;
      classes?: ClassRoom[];
      students?: Student[];
      materials?: Material[];
      tasks?: Task[];
      submissions?: Submission[];
      attendance?: AttendanceRecord[];
      questionSets?: GeneratedQuestionSet[];
    } | null>('gm_precloud_backup', null);

    const localTeacher = precloud?.teacher || safeParse('gm_teacher', teacher);
    const localClasses =
      Array.isArray(precloud?.classes) && precloud.classes.length > 0
        ? precloud.classes
        : safeParse<ClassRoom[]>('gm_classes', classes);
    const localStudents =
      Array.isArray(precloud?.students) && precloud.students.length > 0
        ? precloud.students
        : safeParse<Student[]>('gm_students', students);
    const rawMaterials =
      Array.isArray(precloud?.materials) && precloud.materials.length > 0
        ? precloud.materials
        : safeParse<Material[]>('gm_materials', materials);
    const rawTasks =
      Array.isArray(precloud?.tasks) && precloud.tasks.length > 0
        ? precloud.tasks
        : safeParse<Task[]>('gm_tasks', tasks);
    const localSubmissions =
      Array.isArray(precloud?.submissions) && precloud.submissions.length > 0
        ? precloud.submissions
        : safeParse<Submission[]>('gm_submissions', submissions);
    const localAttendance =
      Array.isArray(precloud?.attendance) && precloud.attendance.length > 0
        ? precloud.attendance
        : safeParse<AttendanceRecord[]>('gm_attendance', attendance);
    const localQSets =
      Array.isArray(precloud?.questionSets) && precloud.questionSets.length > 0
        ? precloud.questionSets
        : safeParse<GeneratedQuestionSet[]>('gm_ai_questions', questionSets);

    try {
      const hydrated = await hydrateAttachmentsForUpload(rawMaterials, rawTasks);
      const stats = await pushDatasetToFirestore(firebaseUser.uid, {
        teacher: localTeacher,
        classes: localClasses,
        students: localStudents,
        materials: hydrated.materials,
        tasks: hydrated.tasks,
        submissions: localSubmissions,
        attendance: localAttendance,
        questionSets: localQSets,
      });

      return {
        ok: true,
        message: `Berhasil mengunggah data lokal browser ke Database Cloud (${stats.classes} kelas, ${stats.students} siswa, ${stats.materials} materi, ${stats.tasks} tugas, ${stats.attendance} absensi, ${stats.questionSets} soal AI).`,
      };
    } catch (error) {
      let errMsg = 'Terjadi kesalahan saat mengunggah data ke Database Cloud.';
      try {
        handleFirestoreError(error, OperationType.WRITE, 'sync_local_to_cloud');
      } catch (wrapped) {
        if (wrapped instanceof Error) {
          errMsg = `Gagal mengunggah ke Cloud Firestore: ${error instanceof Error ? error.message : wrapped.message}`;
        }
      }
      return { ok: false, message: errMsg };
    }
  };

  const importBackup = async (jsonContent: string): Promise<{ ok: boolean; message: string }> => {
    if (!isAuthorizedTeacher) {
      return {
        ok: false,
        message: 'Akses ditolak: Hanya Guru & Admin terdaftar yang dapat memulihkan data.',
      };
    }
    let data: {
      teacher?: TeacherProfile;
      classes?: ClassRoom[];
      students?: Student[];
      materials?: Material[];
      tasks?: Task[];
      submissions?: Submission[];
      attendance?: AttendanceRecord[];
      questionSets?: GeneratedQuestionSet[];
    };

    try {
      data = JSON.parse(jsonContent);
    } catch {
      return {
        ok: false,
        message: 'File backup bukan format JSON yang valid.',
      };
    }

    if (!data || !Array.isArray(data.classes) || !Array.isArray(data.students)) {
      return {
        ok: false,
        message: 'Struktur file backup tidak lengkap (data kelas atau siswa tidak ditemukan).',
      };
    }

    if (data.teacher) setTeacher(data.teacher);
    setClasses(data.classes);
    setStudentsRoster(data.students);

    const nextContacts: Record<string, string> = {};
    data.students.forEach((s) => {
      if (s.whatsapp && s.whatsapp.trim()) {
        nextContacts[s.id] = s.whatsapp.trim();
      }
    });
    setStudentContacts(nextContacts);

    const restoredMaterials = Array.isArray(data.materials) ? data.materials : [];
    const restoredTasks = Array.isArray(data.tasks) ? data.tasks : [];
    const restoredSubmissions = Array.isArray(data.submissions) ? data.submissions : [];
    const restoredAttendance = Array.isArray(data.attendance) ? data.attendance : [];
    const restoredQSets = Array.isArray(data.questionSets) ? data.questionSets : [];
    const restoredCbtExams = Array.isArray((data as { cbtExams?: CbtExam[] }).cbtExams)
      ? ((data as { cbtExams?: CbtExam[] }).cbtExams as CbtExam[])
      : [];
    const restoredCbtResults = Array.isArray((data as { cbtResults?: CbtAttempt[] }).cbtResults)
      ? ((data as { cbtResults?: CbtAttempt[] }).cbtResults as CbtAttempt[])
      : [];

    restoredMaterials.forEach((m) => {
      if (m.attachment?.dataUrl) saveFileAttachment(m.id, m.attachment.dataUrl);
    });
    restoredTasks.forEach((t) => {
      if (t.attachment?.dataUrl) saveFileAttachment(t.id, t.attachment.dataUrl);
    });
    restoredSubmissions.forEach((sub) => {
      if (sub.attachment?.dataUrl) saveFileAttachment(sub.id, sub.attachment.dataUrl);
    });

    setMaterials(restoredMaterials);
    setTasks(restoredTasks);
    setSubmissions(restoredSubmissions);
    setAttendance(restoredAttendance);
    setQuestionSets(restoredQSets);
    setCbtExams(restoredCbtExams);
    setCbtResults(restoredCbtResults);

    // Save to gm_precloud_backup so it stays available even before cloud login
    try {
      localStorage.setItem(
        'gm_precloud_backup',
        JSON.stringify({
          teacher: data.teacher || teacher,
          classes: data.classes,
          students: data.students,
          materials: restoredMaterials,
          tasks: restoredTasks,
          submissions: restoredSubmissions,
          attendance: restoredAttendance,
          questionSets: restoredQSets,
          savedAt: new Date().toISOString(),
        })
      );
    } catch {
      // ignore quota limits
    }

    if (firebaseUser && firebaseUser.emailVerified && isCloudAdmin) {
      try {
        const stats = await pushDatasetToFirestore(firebaseUser.uid, {
          teacher: data.teacher || teacher,
          classes: data.classes,
          students: data.students,
          materials: restoredMaterials,
          tasks: restoredTasks,
          submissions: restoredSubmissions,
          attendance: restoredAttendance,
          questionSets: restoredQSets,
        });
        return {
          ok: true,
          message: `Data backup berhasil dipulihkan & disimpan ke Database Cloud (${stats.classes} kelas, ${stats.students} siswa, ${stats.materials} materi, ${stats.tasks} tugas, ${stats.attendance} absensi, ${stats.questionSets} soal AI)!`,
        };
      } catch (error) {
        try {
          handleFirestoreError(error, OperationType.WRITE, 'import_backup');
        } catch {
          // logged structured error above
        }
        return {
          ok: false,
          message: `Data sudah dimuat di browser ini, tetapi gagal diunggah ke Database Cloud: ${error instanceof Error ? error.message : String(error)}`,
        };
      }
    }

    return {
      ok: true,
      message:
        'Data berhasil dipulihkan ke browser lokal! Masuk sebagai Guru via Google untuk menyinkronkannya ke Database Cloud.',
    };
  };

  const addMaterial = (item: Omit<Material, 'id' | 'date'>) => {
    if (!isAuthorizedTeacher || !firebaseUser) return;
    const today = new Date().toISOString().split('T')[0];
    const cleanSubject = item.subject?.trim() || undefined;
    const newMaterial: Material = {
      ...item,
      subject: cleanSubject,
      id: 'm_' + Date.now(),
      date: today,
    };
    if (newMaterial.attachment?.dataUrl) {
      saveFileAttachment(newMaterial.id, newMaterial.attachment.dataUrl);
    }
    setMaterials((prev) => [newMaterial, ...prev]);

    const matData: Record<string, unknown> = {
      title: clampStr(newMaterial.title || 'Materi', 200),
      content: clampStr(newMaterial.content || '', 20000),
      classId: newMaterial.classId || 'all',
      date: clampStr(today, 30),
      visibility: 'classroom',
      ownerUid: firebaseUser.uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    if (cleanSubject) matData.subject = clampStr(cleanSubject, 120);
    if (newMaterial.linkUrl) matData.linkUrl = clampStr(newMaterial.linkUrl, 500);
    if (newMaterial.attachment) {
      matData.attachmentName = clampStr(newMaterial.attachment.name, 200);
      matData.attachmentSize = clampStr(newMaterial.attachment.size, 40);
      matData.attachmentType = newMaterial.attachment.type;
      if (
        newMaterial.attachment.dataUrl &&
        newMaterial.attachment.dataUrl.length <= MAX_FIRESTORE_ATTACHMENT_CHARS
      ) {
        matData.attachmentDataUrl = newMaterial.attachment.dataUrl;
      }
    }
    void setDoc(doc(db, 'materials', newMaterial.id), matData).catch((err) =>
      handleFirestoreError(err, OperationType.CREATE, `materials/${newMaterial.id}`)
    );
  };

  const deleteMaterial = (id: string) => {
    if (!isAuthorizedTeacher) return;
    deleteFileAttachment(id);
    setMaterials((prev) => prev.filter((m) => m.id !== id));

    void deleteDoc(doc(db, 'materials', id)).catch((err) =>
      handleFirestoreError(err, OperationType.DELETE, `materials/${id}`)
    );
  };

  const addTask = (item: Omit<Task, 'id' | 'createdAt'>) => {
    if (!isAuthorizedTeacher || !firebaseUser) return;
    const today = new Date().toISOString().split('T')[0];
    const cleanSubject = item.subject?.trim() || undefined;
    const newTask: Task = {
      ...item,
      subject: cleanSubject,
      id: 't_' + Date.now(),
      createdAt: today,
    };
    if (newTask.attachment?.dataUrl) {
      saveFileAttachment(newTask.id, newTask.attachment.dataUrl);
    }
    setTasks((prev) => [newTask, ...prev]);

    const taskData: Record<string, unknown> = {
      title: clampStr(newTask.title || 'Tugas', 200),
      instructions: clampStr(newTask.instructions || '', 30000),
      dueDate: clampStr(newTask.dueDate || today, 30),
      classId: newTask.classId || 'all',
      createdAtStr: clampStr(today, 30),
      visibility: 'classroom',
      ownerUid: firebaseUser.uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    if (cleanSubject) taskData.subject = clampStr(cleanSubject, 120);
    if (newTask.attachment) {
      taskData.attachmentName = clampStr(newTask.attachment.name, 200);
      taskData.attachmentSize = clampStr(newTask.attachment.size, 40);
      taskData.attachmentType = newTask.attachment.type;
      if (
        newTask.attachment.dataUrl &&
        newTask.attachment.dataUrl.length <= MAX_FIRESTORE_ATTACHMENT_CHARS
      ) {
        taskData.attachmentDataUrl = newTask.attachment.dataUrl;
      }
    }
    void setDoc(doc(db, 'tasks', newTask.id), taskData).catch((err) =>
      handleFirestoreError(err, OperationType.CREATE, `tasks/${newTask.id}`)
    );
  };

  const deleteTask = (id: string) => {
    if (!isAuthorizedTeacher) return;
    deleteFileAttachment(id);
    const removedSubs = submissions.filter((s) => s.taskId === id).map((s) => s.id);
    removedSubs.forEach((sid) => deleteFileAttachment(sid));
    setTasks((prev) => prev.filter((t) => t.id !== id));
    setSubmissions((prev) => prev.filter((s) => s.taskId !== id));

    const runDelTask = async () => {
      try {
        const batch = writeBatch(db);
        batch.delete(doc(db, 'tasks', id));
        removedSubs.forEach((sid) => batch.delete(doc(db, 'submissions', sid)));
        await batch.commit();
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, `tasks/${id}`);
      }
    };
    void runDelTask();
  };

  const submitTask = (
    taskId: string,
    studentId: string,
    workText: string,
    linkAttachment?: string,
    attachment?: MaterialAttachment | null
  ) => {
    const student = studentsRoster.find((s) => s.id === studentId);
    const studentName = student ? student.name : 'Siswa';
    const now = new Date();
    const formattedDate = `${now.toISOString().split('T')[0]} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    const existingSub = submissions.find((s) => s.taskId === taskId && s.studentId === studentId);
    const canUpdateExisting = Boolean(
      canAccessStudentCloud &&
      firebaseUser &&
      existingSub &&
      submissionStudentUidMapRef.current[existingSub.id] === firebaseUser.uid
    );
    const subId =
      existingSub && (!canAccessStudentCloud || canUpdateExisting)
        ? existingSub.id
        : 'sub_' + Date.now();
    const nextAttachment = attachment || undefined;
    const resolvedWorkText =
      workText.trim() ||
      (nextAttachment
        ? `[Lampiran berkas: ${nextAttachment.name}]`
        : linkAttachment?.trim()
        ? `[Lampiran tautan: ${linkAttachment.trim()}]`
        : '-');

    if (nextAttachment?.dataUrl) {
      void saveFileAttachment(subId, nextAttachment.dataUrl);
    } else {
      void deleteFileAttachment(subId);
    }

    setSubmissions((prev) => {
      const existingIndex = prev.findIndex((s) => s.taskId === taskId && s.studentId === studentId);
      if (existingIndex >= 0) {
        const updated = [...prev];
        updated[existingIndex] = {
          ...updated[existingIndex],
          id: subId,
          submittedAt: formattedDate,
          workText: resolvedWorkText,
          linkAttachment: linkAttachment?.trim() || undefined,
          attachment: nextAttachment,
        };
        return updated;
      }
      const newSub: Submission = {
        id: subId,
        taskId,
        studentId,
        studentName,
        submittedAt: formattedDate,
        workText: resolvedWorkText,
        linkAttachment: linkAttachment?.trim() || undefined,
        attachment: nextAttachment,
      };
      return [newSub, ...prev];
    });

    if (canAccessStudentCloud && firebaseUser) {
      if (canUpdateExisting && existingSub) {
        const updatePayload: Record<string, unknown> = {
          submittedAt: clampStr(formattedDate, 40),
          workText: clampStr(resolvedWorkText, 20000),
          updatedAt: serverTimestamp(),
        };
        if (linkAttachment?.trim()) {
          updatePayload.linkAttachment = clampStr(linkAttachment.trim(), 500);
        } else if (existingSub.linkAttachment) {
          updatePayload.linkAttachment = deleteField();
        }
        if (nextAttachment) {
          updatePayload.attachmentName = clampStr(nextAttachment.name, 200);
          updatePayload.attachmentSize = clampStr(nextAttachment.size, 40);
          updatePayload.attachmentType = nextAttachment.type;
          if (
            nextAttachment.dataUrl &&
            nextAttachment.dataUrl.length <= MAX_FIRESTORE_ATTACHMENT_CHARS
          ) {
            updatePayload.attachmentDataUrl = nextAttachment.dataUrl;
          } else {
            updatePayload.attachmentDataUrl = deleteField();
          }
        } else if (existingSub.attachment) {
          updatePayload.attachmentName = deleteField();
          updatePayload.attachmentSize = deleteField();
          updatePayload.attachmentType = deleteField();
          updatePayload.attachmentDataUrl = deleteField();
        }
        void updateDoc(doc(db, 'submissions', existingSub.id), updatePayload).catch((err) =>
          handleFirestoreError(err, OperationType.UPDATE, `submissions/${existingSub.id}`)
        );
      } else {
        const taskOwnerUid =
          taskOwnerMapRef.current[taskId] || teacherOwnerUidRef.current || firebaseUser.uid;
        const newPayload: Record<string, unknown> = {
          taskId,
          studentId,
          studentName: clampStr(studentName, 120),
          studentUid: firebaseUser.uid,
          ownerUid: taskOwnerUid,
          submittedAt: clampStr(formattedDate, 40),
          workText: clampStr(resolvedWorkText, 20000),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        };
        if (linkAttachment?.trim()) {
          newPayload.linkAttachment = clampStr(linkAttachment.trim(), 500);
        }
        if (nextAttachment) {
          newPayload.attachmentName = clampStr(nextAttachment.name, 200);
          newPayload.attachmentSize = clampStr(nextAttachment.size, 40);
          newPayload.attachmentType = nextAttachment.type;
          if (
            nextAttachment.dataUrl &&
            nextAttachment.dataUrl.length <= MAX_FIRESTORE_ATTACHMENT_CHARS
          ) {
            newPayload.attachmentDataUrl = nextAttachment.dataUrl;
          }
        }
        void setDoc(doc(db, 'submissions', subId), newPayload).catch((err) =>
          handleFirestoreError(err, OperationType.CREATE, `submissions/${subId}`)
        );
      }
    }
  };

  const gradeSubmission = (submissionId: string, score: number, note?: string) => {
    if (!isAuthorizedTeacher) return;
    const cleanScore = Math.min(100, Math.max(0, score));
    setSubmissions((prev) =>
      prev.map((sub) =>
        sub.id === submissionId
          ? { ...sub, score: cleanScore, note: note ?? sub.note }
          : sub
      )
    );

    const payload: Record<string, unknown> = {
      score: cleanScore,
      updatedAt: serverTimestamp(),
    };
    if (note !== undefined) {
      payload.note = clampStr(note, 1000);
    }
    void updateDoc(doc(db, 'submissions', submissionId), payload).catch((err) =>
      handleFirestoreError(err, OperationType.UPDATE, `submissions/${submissionId}`)
    );
  };

  const saveAttendance = (
    date: string,
    classId: string,
    topic: string,
    records: Record<string, AttendanceStatus>,
    subject?: string
  ) => {
    if (!isAuthorizedTeacher || !firebaseUser) return;
    const cleanSubject = subject?.trim() || undefined;
    const newRecord: AttendanceRecord = {
      id: 'att_' + Date.now(),
      date,
      classId,
      subject: cleanSubject,
      topic,
      records,
    };
    setAttendance((prev) => [newRecord, ...prev]);

    const attPayload: Record<string, unknown> = {
      date: clampStr(date, 30),
      classId,
      topic: clampStr(topic || 'Pertemuan', 200),
      records,
      visibility: 'classroom',
      ownerUid: firebaseUser.uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    if (cleanSubject) attPayload.subject = clampStr(cleanSubject, 120);

    const writeAtt = async () => {
      try {
        const pendingClass = pendingClassWritesRef.current[classId];
        if (pendingClass) {
          await pendingClass;
        }
        await setDoc(doc(db, 'attendance', newRecord.id), attPayload);
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, `attendance/${newRecord.id}`);
      }
    };
    void writeAtt();
  };

  const deleteAttendance = (id: string) => {
    if (!isAuthorizedTeacher) return;
    setAttendance((prev) => prev.filter((a) => a.id !== id));

    void deleteDoc(doc(db, 'attendance', id)).catch((err) =>
      handleFirestoreError(err, OperationType.DELETE, `attendance/${id}`)
    );
  };

  // AI Question Sets Actions
  const addQuestionSet = (qset: GeneratedQuestionSet) => {
    if (!isAuthorizedTeacher || !firebaseUser) return;
    setQuestionSets((prev) => [qset, ...prev.slice(0, 14)]);

    void setDoc(doc(db, 'questionSets', qset.id), {
      title: clampStr(qset.title || 'Paket Soal AI', 200),
      subject: clampStr(qset.subject || teacher.subject || 'Umum', 120),
      sourceMaterial: clampStr(qset.sourceMaterial || '', 35000),
      createdAtStr: clampStr(qset.createdAt || new Date().toISOString().split('T')[0], 30),
      pgCount: Math.min(50, Math.max(0, Math.trunc(qset.pgCount))),
      essayCount: Math.min(5, Math.max(0, Math.trunc(qset.essayCount))),
      multipleChoice: (qset.multipleChoice || []).slice(0, 50),
      essay: (qset.essay || []).slice(0, 5),
      ownerUid: firebaseUser.uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }).catch((err) => handleFirestoreError(err, OperationType.CREATE, `questionSets/${qset.id}`));
  };

  const updateQuestionSet = (id: string, updated: GeneratedQuestionSet) => {
    if (!isAuthorizedTeacher) return;
    setQuestionSets((prev) => prev.map((s) => (s.id === id ? updated : s)));

    void updateDoc(doc(db, 'questionSets', id), {
      title: clampStr(updated.title || 'Paket Soal AI', 200),
      subject: clampStr(updated.subject || teacher.subject || 'Umum', 120),
      sourceMaterial: clampStr(updated.sourceMaterial || '', 35000),
      createdAtStr: clampStr(updated.createdAt || '', 30),
      pgCount: Math.min(50, Math.max(0, Math.trunc(updated.pgCount))),
      essayCount: Math.min(5, Math.max(0, Math.trunc(updated.essayCount))),
      multipleChoice: (updated.multipleChoice || []).slice(0, 50),
      essay: (updated.essay || []).slice(0, 5),
      updatedAt: serverTimestamp(),
    }).catch((err) => handleFirestoreError(err, OperationType.UPDATE, `questionSets/${id}`));
  };

  const deleteQuestionSet = (id: string) => {
    if (!isAuthorizedTeacher) return;
    setQuestionSets((prev) => prev.filter((s) => s.id !== id));

    void deleteDoc(doc(db, 'questionSets', id)).catch((err) =>
      handleFirestoreError(err, OperationType.DELETE, `questionSets/${id}`)
    );
  };

  // Online CBT Exam & Attempt Actions
  const addCbtExam = (exam: Omit<CbtExam, 'id' | 'createdAt'>): string | null => {
    if (!isAuthorizedTeacher || !firebaseUser) return null;
    const now = new Date();
    const todayStr = `${now.toISOString().split('T')[0]} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const examId = 'cbt_' + Date.now();
    const cleanDuration = Math.min(240, Math.max(1, Math.trunc(exam.durationMinutes || 30)));
    const sanitizedMC: GeneratedQuestionSet['multipleChoice'] = (exam.multipleChoice || [])
      .slice(0, 50)
      .map((q) => ({
        id: clampStr(q.id || `pg_${Math.random().toString(36).slice(2, 7)}`, 64),
        question: clampStr(q.question || '', 2000),
        options: Array.isArray(q.options) ? q.options.slice(0, 4).map((o) => clampStr(String(o || ''), 500)) : [],
        correctIndex: typeof q.correctIndex === 'number' ? Math.min(3, Math.max(0, Math.trunc(q.correctIndex))) : 0,
        explanation: q.explanation ? clampStr(q.explanation, 1000) : '',
      }));
    const sanitizedEssay: GeneratedQuestionSet['essay'] = (exam.essay || [])
      .slice(0, 5)
      .map((q) => ({
        id: clampStr(q.id || `es_${Math.random().toString(36).slice(2, 7)}`, 64),
        question: clampStr(q.question || '', 2000),
        answerKey: clampStr(q.answerKey || '', 2000),
      }));

    const newExam: CbtExam = {
      id: examId,
      questionSetId: clampStr(exam.questionSetId || '', 128),
      title: clampStr(exam.title.trim() || 'Ujian CBT Online', 200),
      subject: clampStr(exam.subject.trim() || getPrimarySubject(teacher.subject), 120),
      classId: exam.classId || 'all',
      durationMinutes: cleanDuration,
      showResultToStudent: Boolean(exam.showResultToStudent),
      isActive: exam.isActive !== false,
      createdAt: todayStr,
      multipleChoice: sanitizedMC,
      essay: sanitizedEssay,
    };

    setCbtExams((prev) => [newExam, ...prev]);
    cbtExamOwnerMapRef.current[newExam.id] = firebaseUser.uid;

    const writeCbt = async () => {
      try {
        if (newExam.classId !== 'all') {
          const pendingClass = pendingClassWritesRef.current[newExam.classId];
          if (pendingClass) {
            await pendingClass;
          }
        }
        await setDoc(doc(db, 'cbtExams', newExam.id), {
          questionSetId: newExam.questionSetId,
          title: newExam.title,
          subject: newExam.subject,
          classId: newExam.classId,
          durationMinutes: newExam.durationMinutes,
          showResultToStudent: newExam.showResultToStudent,
          isActive: newExam.isActive,
          createdAtStr: clampStr(todayStr, 30),
          multipleChoice: newExam.multipleChoice,
          essay: newExam.essay,
          visibility: 'classroom',
          ownerUid: firebaseUser.uid,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, `cbtExams/${newExam.id}`);
      }
    };
    void writeCbt();
    return newExam.id;
  };

  const toggleCbtExamActive = (id: string, isActive: boolean) => {
    if (!isAuthorizedTeacher) return;
    setCbtExams((prev) => prev.map((ex) => (ex.id === id ? { ...ex, isActive } : ex)));
    void updateDoc(doc(db, 'cbtExams', id), {
      isActive,
      updatedAt: serverTimestamp(),
    }).catch((err) => handleFirestoreError(err, OperationType.UPDATE, `cbtExams/${id}`));
  };

  const deleteCbtExam = (id: string) => {
    if (!isAuthorizedTeacher) return;
    const removedAttemptIds = cbtResults.filter((r) => r.examId === id).map((r) => r.id);
    setCbtExams((prev) => prev.filter((ex) => ex.id !== id));
    setCbtResults((prev) => prev.filter((r) => r.examId !== id));

    const runDelCbt = async () => {
      try {
        const batch = writeBatch(db);
        batch.delete(doc(db, 'cbtExams', id));
        removedAttemptIds.forEach((rid) => batch.delete(doc(db, 'cbtResults', rid)));
        await batch.commit();
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, `cbtExams/${id}`);
      }
    };
    void runDelCbt();
  };

  const submitCbtAttempt = (
    attempt: Omit<CbtAttempt, 'id' | 'submittedAt'>
  ): CbtAttempt => {
    const now = new Date();
    const submittedAt = `${now.toISOString().split('T')[0]} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const resultId =
      'cbtres_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);

    const sanitizedPgAnswers: Record<string, number> = {};
    Object.entries(attempt.pgAnswers || {}).forEach(([k, v]) => {
      if (typeof v === 'number' && !Number.isNaN(v)) {
        sanitizedPgAnswers[clampStr(k, 64)] = Math.min(3, Math.max(0, Math.trunc(v)));
      }
    });

    const sanitizedEssayAnswers: Record<string, string> = {};
    Object.entries(attempt.essayAnswers || {}).forEach(([k, v]) => {
      sanitizedEssayAnswers[clampStr(k, 64)] = clampStr(String(v || ''), 5000);
    });

    const cleanPgTotal = Math.min(50, Math.max(0, Math.trunc(attempt.pgTotal)));
    const cleanPgCorrect = Math.min(cleanPgTotal, Math.max(0, Math.trunc(attempt.pgCorrect)));
    const cleanPgScore = Math.min(100, Math.max(0, Math.round(attempt.pgScore)));
    const cleanFinalScore = Math.min(100, Math.max(0, Math.round(attempt.finalScore)));
    const cleanDurationSpent =
      typeof attempt.durationSpentSec === 'number'
        ? Math.min(30000, Math.max(0, Math.trunc(attempt.durationSpentSec)))
        : undefined;

    const newAttempt: CbtAttempt = {
      id: resultId,
      examId: attempt.examId,
      examTitle: clampStr(attempt.examTitle || 'Ujian CBT', 200),
      questionSetId: attempt.questionSetId ? clampStr(attempt.questionSetId, 128) : undefined,
      studentId: attempt.studentId,
      studentName: clampStr(attempt.studentName || 'Siswa', 120),
      classId: attempt.classId || 'all',
      subject: clampStr(attempt.subject || getPrimarySubject(teacher.subject), 120),
      pgAnswers: sanitizedPgAnswers,
      essayAnswers: sanitizedEssayAnswers,
      pgCorrect: cleanPgCorrect,
      pgTotal: cleanPgTotal,
      pgScore: cleanPgScore,
      finalScore: cleanFinalScore,
      submittedAt,
      durationSpentSec: cleanDurationSpent,
    };

    setCbtResults((prev) => [newAttempt, ...prev]);

    if (canAccessStudentCloud && firebaseUser) {
      const ownerUid =
        cbtExamOwnerMapRef.current[newAttempt.examId] ||
        teacherOwnerUidRef.current ||
        firebaseUser.uid;
      const payload: Record<string, unknown> = {
        examId: newAttempt.examId,
        examTitle: newAttempt.examTitle,
        ...(newAttempt.questionSetId ? { questionSetId: newAttempt.questionSetId } : {}),
        studentId: newAttempt.studentId,
        studentName: newAttempt.studentName,
        classId: newAttempt.classId,
        subject: newAttempt.subject,
        studentUid: firebaseUser.uid,
        ownerUid,
        pgAnswers: newAttempt.pgAnswers,
        essayAnswers: newAttempt.essayAnswers,
        pgCorrect: newAttempt.pgCorrect,
        pgTotal: newAttempt.pgTotal,
        pgScore: newAttempt.pgScore,
        finalScore: newAttempt.finalScore,
        submittedAt: clampStr(newAttempt.submittedAt, 40),
        ...(cleanDurationSpent !== undefined ? { durationSpentSec: cleanDurationSpent } : {}),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      void setDoc(doc(db, 'cbtResults', newAttempt.id), payload).catch((err) =>
        handleFirestoreError(err, OperationType.CREATE, `cbtResults/${newAttempt.id}`)
      );
    }

    return newAttempt;
  };

  const gradeCbtAttempt = (
    attemptId: string,
    finalScore: number,
    essayScore?: number,
    teacherNote?: string
  ) => {
    if (!isAuthorizedTeacher) return;
    const cleanFinal = Math.min(100, Math.max(0, Math.round(finalScore)));
    const cleanEssay =
      typeof essayScore === 'number' && !Number.isNaN(essayScore)
        ? Math.min(100, Math.max(0, Math.round(essayScore)))
        : undefined;

    setCbtResults((prev) =>
      prev.map((r) =>
        r.id === attemptId
          ? {
              ...r,
              finalScore: cleanFinal,
              essayScore: cleanEssay ?? r.essayScore,
              teacherNote: teacherNote !== undefined ? teacherNote : r.teacherNote,
            }
          : r
      )
    );

    const payload: Record<string, unknown> = {
      finalScore: cleanFinal,
      updatedAt: serverTimestamp(),
    };
    if (cleanEssay !== undefined) {
      payload.essayScore = cleanEssay;
    }
    if (teacherNote !== undefined) {
      payload.teacherNote = clampStr(teacherNote, 1000);
    }
    void updateDoc(doc(db, 'cbtResults', attemptId), payload).catch((err) =>
      handleFirestoreError(err, OperationType.UPDATE, `cbtResults/${attemptId}`)
    );
  };

  const deleteCbtAttempt = (attemptId: string) => {
    if (!isAuthorizedTeacher) return;
    setCbtResults((prev) => prev.filter((r) => r.id !== attemptId));
    void deleteDoc(doc(db, 'cbtResults', attemptId)).catch((err) =>
      handleFirestoreError(err, OperationType.DELETE, `cbtResults/${attemptId}`)
    );
  };

  const resetCloudDatabase = async (): Promise<{ ok: boolean; message: string }> => {
    if (!isAuthorizedTeacher || !firebaseUser) {
      return {
        ok: false,
        message: 'Hanya Guru / Admin Google terverifikasi yang dapat mereset database Cloud.',
      };
    }

    try {
      // Ensure settings/teacherPublic stays initialized so seedCloudDatabaseIfEmpty will never re-upload dummy data
      const pubSnap = await getDoc(doc(db, 'settings', 'teacherPublic'));
      if (!pubSnap.exists()) {
        await setDoc(doc(db, 'settings', 'teacherPublic'), {
          name: clampStr(teacher.name || 'Guru Mapel', 120),
          subject: clampStr(teacher.subject || 'Mata Pelajaran', 120),
          kktp: typeof teacher.kktp === 'number' ? Math.min(100, Math.max(0, teacher.kktp)) : 75,
          visibility: 'classroom',
          ownerUid: firebaseUser.uid,
          updatedAt: serverTimestamp(),
        });
      }

      const subsQuery =
        firebaseUser.email?.toLowerCase() === BOOTSTRAP_ADMIN_EMAIL.toLowerCase()
          ? collection(db, 'submissions')
          : query(collection(db, 'submissions'), where('ownerUid', '==', firebaseUser.uid));
      const qSetsQuery =
        firebaseUser.email?.toLowerCase() === BOOTSTRAP_ADMIN_EMAIL.toLowerCase()
          ? collection(db, 'questionSets')
          : query(collection(db, 'questionSets'), where('ownerUid', '==', firebaseUser.uid));
      const cbtResQuery =
        firebaseUser.email?.toLowerCase() === BOOTSTRAP_ADMIN_EMAIL.toLowerCase()
          ? collection(db, 'cbtResults')
          : query(collection(db, 'cbtResults'), where('ownerUid', '==', firebaseUser.uid));

      const [classSnap, studentSnap, matSnap, taskSnap, attSnap, subSnap, qSetSnap, cbtExamSnap, cbtResSnap] =
        await Promise.all([
          getDocs(query(collection(db, 'classes'), where('visibility', '==', 'classroom'))),
          getDocs(query(collection(db, 'students'), where('visibility', '==', 'classroom'))),
          getDocs(query(collection(db, 'materials'), where('visibility', '==', 'classroom'))),
          getDocs(query(collection(db, 'tasks'), where('visibility', '==', 'classroom'))),
          getDocs(query(collection(db, 'attendance'), where('visibility', '==', 'classroom'))),
          getDocs(subsQuery),
          getDocs(qSetsQuery),
          getDocs(query(collection(db, 'cbtExams'), where('visibility', '==', 'classroom'))),
          getDocs(cbtResQuery),
        ]);

      const classIds = new Set([...classSnap.docs.map((d) => d.id), ...cloudIdsRef.current.classes, ...classes.map((c) => c.id)]);
      const studentIds = new Set([...studentSnap.docs.map((d) => d.id), ...cloudIdsRef.current.students, ...studentsRoster.map((s) => s.id)]);
      const materialIds = new Set([...matSnap.docs.map((d) => d.id), ...cloudIdsRef.current.materials, ...materials.map((m) => m.id)]);
      const taskIds = new Set([...taskSnap.docs.map((d) => d.id), ...cloudIdsRef.current.tasks, ...tasks.map((t) => t.id)]);
      const attendanceIds = new Set([...attSnap.docs.map((d) => d.id), ...cloudIdsRef.current.attendance, ...attendance.map((a) => a.id)]);
      const submissionIds = new Set([...subSnap.docs.map((d) => d.id), ...cloudIdsRef.current.submissions, ...submissions.map((s) => s.id)]);
      const qSetIds = new Set([...qSetSnap.docs.map((d) => d.id), ...cloudIdsRef.current.questionSets, ...questionSets.map((q) => q.id)]);
      const cbtExamIds = new Set([...cbtExamSnap.docs.map((d) => d.id), ...cloudIdsRef.current.cbtExams, ...cbtExams.map((e) => e.id)]);
      const cbtResultIds = new Set([...cbtResSnap.docs.map((d) => d.id), ...cloudIdsRef.current.cbtResults, ...cbtResults.map((r) => r.id)]);

      const refs = [
        ...Array.from(classIds).map((id) => doc(db, 'classes', id)),
        ...Array.from(studentIds).flatMap((id) => [
          doc(db, 'students', id),
          doc(db, 'students', id, 'private', 'contact'),
        ]),
        ...Array.from(materialIds).map((id) => doc(db, 'materials', id)),
        ...Array.from(taskIds).map((id) => doc(db, 'tasks', id)),
        ...Array.from(attendanceIds).map((id) => doc(db, 'attendance', id)),
        ...Array.from(submissionIds).map((id) => doc(db, 'submissions', id)),
        ...Array.from(qSetIds).map((id) => doc(db, 'questionSets', id)),
        ...Array.from(cbtExamIds).map((id) => doc(db, 'cbtExams', id)),
        ...Array.from(cbtResultIds).map((id) => doc(db, 'cbtResults', id)),
      ];

      for (let i = 0; i < refs.length; i += 350) {
        const batch = writeBatch(db);
        refs.slice(i, i + 350).forEach((r) => batch.delete(r));
        await batch.commit();
      }

      materialIds.forEach((id) => deleteFileAttachment(id));
      taskIds.forEach((id) => deleteFileAttachment(id));
      submissionIds.forEach((id) => deleteFileAttachment(id));

      cloudIdsRef.current.classes = new Set();
      cloudIdsRef.current.students = new Set();
      cloudIdsRef.current.contacts = new Set();
      cloudIdsRef.current.materials = new Set();
      cloudIdsRef.current.tasks = new Set();
      cloudIdsRef.current.attendance = new Set();
      cloudIdsRef.current.submissions = new Set();
      cloudIdsRef.current.questionSets = new Set();
      cloudIdsRef.current.cbtExams = new Set();
      cloudIdsRef.current.cbtResults = new Set();
      hasSeededCloudRef.current = true;

      setClasses([]);
      setStudentsRoster([]);
      setStudentContacts({});
      setMaterials([]);
      setTasks([]);
      setSubmissions([]);
      setAttendance([]);
      setQuestionSets([]);
      setCbtExams([]);
      setCbtResults([]);
      setActiveClassId('all');
      setCurrentStudentId('');

      [
        'gm_classes',
        'gm_students',
        'gm_materials',
        'gm_tasks',
        'gm_submissions',
        'gm_attendance',
        'gm_ai_questions',
        'gm_cbt_exams',
        'gm_cbt_results',
        'gm_precloud_backup',
        'gm_student_session',
      ].forEach((k) => localStorage.removeItem(k));

      return {
        ok: true,
        message: 'Database Cloud dan perangkat ini berhasil dikosongkan total (0 rombel, 0 siswa, 0 materi, 0 tugas, 0 absensi, 0 jawaban, 0 soal AI, 0 CBT).',
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        ok: false,
        message: `Gagal mereset database Cloud: ${msg}`,
      };
    }
  };

  const resetData = () => {
    if (!isAuthorizedTeacher) return;
    void resetCloudDatabase();
  };

  return (
    <LMSContext.Provider
      value={{
        teacher,
        teacherSubjects,
        availableSubjects,
        classes,
        students,
        materials,
        tasks,
        submissions,
        attendance,
        questionSets,
        cbtExams,
        cbtResults,
        activeClassId,
        activeSubject,
        viewMode,
        currentStudentId,
        firebaseUser,
        authLoading,
        isCloudAdmin,
        isCloudConnected,
        isStudentCloudSynced,
        anonymousAuthBlocked,
        anonymousAuthError,
        retryAnonymousSync,
        isInIframe,
        cloudAuthError,
        cloudAuthErrorCode,
        clearCloudAuthError,
        authSession,
        loginAsTeacher,
        loginWithGoogleAsTeacher,
        connectGoogleForStudent,
        loginWithGoogleRedirect,
        loginAsStudent,
        logout,
        resetTeacherPin,
        setActiveClassId,
        setActiveSubject,
        setViewMode,
        setCurrentStudentId,
        updateTeacher,
        addClass,
        updateClass,
        deleteClass,
        deleteAllClasses,
        addStudent,
        updateStudent,
        addStudentsBatch,
        deleteStudent,
        exportBackup,
        importBackup,
        syncLocalDataToCloud,
        resetCloudDatabase,
        addMaterial,
        deleteMaterial,
        addTask,
        deleteTask,
        submitTask,
        gradeSubmission,
        saveAttendance,
        deleteAttendance,
        addQuestionSet,
        updateQuestionSet,
        deleteQuestionSet,
        addCbtExam,
        toggleCbtExamActive,
        deleteCbtExam,
        submitCbtAttempt,
        gradeCbtAttempt,
        deleteCbtAttempt,
        resetData,
      }}
    >
      {children}
    </LMSContext.Provider>
  );
};

export const useLMS = () => {
  const context = useContext(LMSContext);
  if (!context) {
    throw new Error('useLMS must be used within an LMSProvider');
  }
  return context;
};
