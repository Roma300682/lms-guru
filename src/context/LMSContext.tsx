import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { User, onAuthStateChanged } from 'firebase/auth';
import {
  collection,
  doc,
  getDoc,
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

interface LMSContextType {
  // State
  teacher: TeacherProfile;
  classes: ClassRoom[];
  students: Student[];
  materials: Material[];
  tasks: Task[];
  submissions: Submission[];
  attendance: AttendanceRecord[];
  questionSets: GeneratedQuestionSet[];
  activeClassId: string; // 'all' or classId
  viewMode: 'teacher' | 'student';
  currentStudentId: string;

  // Firebase Auth & Cloud Sync State
  firebaseUser: User | null;
  authLoading: boolean;
  isCloudAdmin: boolean;
  isCloudConnected: boolean;
  isInIframe: boolean;
  cloudAuthError: string | null;
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
  setViewMode: (mode: 'teacher' | 'student') => void;
  setCurrentStudentId: (id: string) => void;
  updateTeacher: (profile: Partial<TeacherProfile>) => void;

  // Class & Student Actions
  addClass: (name: string) => void;
  updateClass: (id: string, patch: Partial<Pick<ClassRoom, 'name' | 'whatsappGroupUrl'>>) => void;
  deleteClass: (id: string) => void;
  deleteAllClasses: () => void;
  addStudent: (name: string, classId: string, whatsapp?: string) => void;
  updateStudent: (id: string, patch: Partial<Pick<Student, 'name' | 'classId' | 'whatsapp'>>) => void;
  addStudentsBatch: (newStudents: { name: string; classId: string; whatsapp?: string }[]) => void;
  deleteStudent: (id: string) => void;

  // Admin Backup & Restore
  exportBackup: () => void;
  importBackup: (jsonContent: string) => boolean;

  // Material Actions
  addMaterial: (material: Omit<Material, 'id' | 'date'>) => void;
  deleteMaterial: (id: string) => void;

  // Task Actions
  addTask: (task: Omit<Task, 'id' | 'createdAt'>) => void;
  deleteTask: (id: string) => void;

  // Submission & Grading Actions
  submitTask: (taskId: string, studentId: string, workText: string, linkAttachment?: string) => void;
  gradeSubmission: (submissionId: string, score: number, note?: string) => void;

  // Attendance Actions
  saveAttendance: (date: string, classId: string, topic: string, records: Record<string, AttendanceStatus>) => void;
  deleteAttendance: (id: string) => void;

  // AI Question Set Actions
  addQuestionSet: (qset: GeneratedQuestionSet) => void;
  updateQuestionSet: (id: string, updated: GeneratedQuestionSet) => void;
  deleteQuestionSet: (id: string) => void;

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

  const [activeClassId, setActiveClassId] = useState<string>('c1');
  const [viewMode, setViewMode] = useState<'teacher' | 'student'>('teacher');
  const [currentStudentId, setCurrentStudentId] = useState<string>('s1');

  const [authSession, setAuthSession] = useState<AuthSession | null>(() => {
    localStorage.removeItem('gm_session');
    return null;
  });

  // Firebase Auth state
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState<boolean>(true);
  const [isCloudAdmin, setIsCloudAdmin] = useState<boolean>(false);
  const [cloudAuthError, setCloudAuthError] = useState<string | null>(null);

  // Track Firestore document ownership & student claim metadata
  const teacherOwnerUidRef = useRef<string>('');
  const studentOwnerMapRef = useRef<Record<string, string>>({});
  const studentClaimedMapRef = useRef<Record<string, string>>({});
  const taskOwnerMapRef = useRef<Record<string, string>>({});
  const submissionStudentUidMapRef = useRef<Record<string, string>>({});
  const hasSeededCloudRef = useRef<boolean>(false);

  // Keep latest local state refs for initial cloud bootstrap
  const latestLocalRef = useRef({
    teacher,
    classes,
    studentsRoster,
    materials,
    tasks,
    attendance,
    questionSets,
  });
  latestLocalRef.current = {
    teacher,
    classes,
    studentsRoster,
    materials,
    tasks,
    attendance,
    questionSets,
  };

  const isCloudConnected = Boolean(firebaseUser && firebaseUser.emailVerified);

  // Merge roster + isolated private WA contacts
  const students: Student[] = React.useMemo(
    () =>
      studentsRoster.map((s) => ({
        ...s,
        whatsapp: studentContacts[s.id] !== undefined ? studentContacts[s.id] || undefined : s.whatsapp,
      })),
    [studentsRoster, studentContacts]
  );

  const clearCloudAuthError = useCallback(() => setCloudAuthError(null), []);

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
              `Akun (${redirectUser.email || 'ini'}) bukan Guru/Admin terdaftar. Masuk melalui tab "Masuk Siswa" atau gunakan PIN Guru.`
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
      });

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!active) return;
      setFirebaseUser(user);
      if (user && user.emailVerified) {
        try {
          const adminFlag = await checkUserAdminStatus(user);
          if (!active) return;
          setIsCloudAdmin(adminFlag);
          if (adminFlag && !authSession) {
            setAuthSession({ role: 'teacher' });
            setViewMode('teacher');
          }
        } catch {
          if (active) setIsCloudAdmin(false);
        }
      } else {
        setIsCloudAdmin(false);
        hasSeededCloudRef.current = false;
      }
      setAuthLoading(false);
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, [checkUserAdminStatus]);

  // Seed existing local LMS data into an empty Cloud Firestore on first Admin connection
  const seedCloudDatabaseIfEmpty = useCallback(async (adminUid: string) => {
    if (hasSeededCloudRef.current) return;
    hasSeededCloudRef.current = true;

    try {
      const pubSnap = await getDoc(doc(db, 'settings', 'teacherPublic'));
      if (pubSnap.exists()) return;

      const snapshot = latestLocalRef.current;
      const ops: Array<{ ref: ReturnType<typeof doc>; data: Record<string, unknown> }> = [];

      ops.push({
        ref: doc(db, 'settings', 'teacherPublic'),
        data: {
          name: clampStr(snapshot.teacher.name || 'Guru Mata Pelajaran', 120),
          subject: clampStr(snapshot.teacher.subject || 'Mata Pelajaran', 120),
          kktp: typeof snapshot.teacher.kktp === 'number' ? snapshot.teacher.kktp : 75,
          visibility: 'classroom',
          ownerUid: adminUid,
          updatedAt: serverTimestamp(),
        },
      });

      const privateData: Record<string, unknown> = {
        pin: sanitizePin(snapshot.teacher.pin),
        ownerUid: adminUid,
        updatedAt: serverTimestamp(),
      };
      if (snapshot.teacher.nip) privateData.nip = clampStr(snapshot.teacher.nip, 50);
      if (snapshot.teacher.recoveryQuestion) {
        privateData.recoveryQuestion = clampStr(snapshot.teacher.recoveryQuestion, 200);
      }
      if (snapshot.teacher.recoveryAnswer) {
        privateData.recoveryAnswer = clampStr(snapshot.teacher.recoveryAnswer, 100);
      }
      ops.push({
        ref: doc(db, 'settings', 'teacherPrivate'),
        data: privateData,
      });

      const seedClasses = snapshot.classes.length > 0 ? snapshot.classes : initialClasses;
      const validClassSet = new Set(seedClasses.map((c) => c.id));

      for (const cls of seedClasses) {
        const clsData: Record<string, unknown> = {
          name: clampStr(cls.name || 'Kelas', 80),
          visibility: 'classroom',
          ownerUid: adminUid,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        };
        if (cls.whatsappGroupUrl) {
          clsData.whatsappGroupUrl = clampStr(cls.whatsappGroupUrl, 300);
        }
        ops.push({ ref: doc(db, 'classes', cls.id), data: clsData });
      }

      for (const stu of snapshot.studentsRoster) {
        const targetClassId = validClassSet.has(stu.classId) ? stu.classId : seedClasses[0].id;
        ops.push({
          ref: doc(db, 'students', stu.id),
          data: {
            name: clampStr(stu.name || 'Siswa', 120),
            classId: targetClassId,
            visibility: 'classroom',
            ownerUid: adminUid,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          },
        });
        if (stu.whatsapp) {
          ops.push({
            ref: doc(db, 'students', stu.id, 'private', 'contact'),
            data: {
              whatsapp: clampStr(stu.whatsapp, 30),
              ownerUid: adminUid,
              updatedAt: serverTimestamp(),
            },
          });
        }
      }

      for (const mat of snapshot.materials) {
        const classId = mat.classId === 'all' || validClassSet.has(mat.classId) ? mat.classId : seedClasses[0].id;
        const matData: Record<string, unknown> = {
          title: clampStr(mat.title || 'Materi', 200),
          content: clampStr(mat.content || '', 20000),
          classId,
          date: clampStr(mat.date || new Date().toISOString().split('T')[0], 30),
          visibility: 'classroom',
          ownerUid: adminUid,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        };
        if (mat.linkUrl) matData.linkUrl = clampStr(mat.linkUrl, 500);
        if (mat.attachment) {
          matData.attachmentName = clampStr(mat.attachment.name, 200);
          matData.attachmentSize = clampStr(mat.attachment.size, 40);
          matData.attachmentType = mat.attachment.type;
          if (mat.attachment.dataUrl && mat.attachment.dataUrl.length <= MAX_FIRESTORE_ATTACHMENT_CHARS) {
            matData.attachmentDataUrl = mat.attachment.dataUrl;
          }
        }
        ops.push({ ref: doc(db, 'materials', mat.id), data: matData });
      }

      for (const tsk of snapshot.tasks) {
        const classId = tsk.classId === 'all' || validClassSet.has(tsk.classId) ? tsk.classId : seedClasses[0].id;
        const taskData: Record<string, unknown> = {
          title: clampStr(tsk.title || 'Tugas', 200),
          instructions: clampStr(tsk.instructions || '', 30000),
          dueDate: clampStr(tsk.dueDate || '', 30),
          classId,
          createdAtStr: clampStr(tsk.createdAt || new Date().toISOString().split('T')[0], 30),
          visibility: 'classroom',
          ownerUid: adminUid,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        };
        if (tsk.attachment) {
          taskData.attachmentName = clampStr(tsk.attachment.name, 200);
          taskData.attachmentSize = clampStr(tsk.attachment.size, 40);
          taskData.attachmentType = tsk.attachment.type;
          if (tsk.attachment.dataUrl && tsk.attachment.dataUrl.length <= MAX_FIRESTORE_ATTACHMENT_CHARS) {
            taskData.attachmentDataUrl = tsk.attachment.dataUrl;
          }
        }
        ops.push({ ref: doc(db, 'tasks', tsk.id), data: taskData });
      }

      for (const att of snapshot.attendance) {
        if (!validClassSet.has(att.classId)) continue;
        ops.push({
          ref: doc(db, 'attendance', att.id),
          data: {
            date: clampStr(att.date, 30),
            classId: att.classId,
            topic: clampStr(att.topic || 'Pertemuan', 200),
            records: att.records || {},
            visibility: 'classroom',
            ownerUid: adminUid,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          },
        });
      }

      for (const qs of snapshot.questionSets) {
        ops.push({
          ref: doc(db, 'questionSets', qs.id),
          data: {
            title: clampStr(qs.title || 'Paket Soal AI', 200),
            subject: clampStr(qs.subject || snapshot.teacher.subject || 'Umum', 120),
            sourceMaterial: clampStr(qs.sourceMaterial || '', 35000),
            createdAtStr: clampStr(qs.createdAt || new Date().toISOString().split('T')[0], 30),
            pgCount: Math.min(50, Math.max(0, Math.trunc(qs.pgCount || qs.multipleChoice.length))),
            essayCount: Math.min(5, Math.max(0, Math.trunc(qs.essayCount || qs.essay.length))),
            multipleChoice: (qs.multipleChoice || []).slice(0, 50),
            essay: (qs.essay || []).slice(0, 5),
            ownerUid: adminUid,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          },
        });
      }

      // Commit in batches of max 350 operations
      const CHUNK_SIZE = 350;
      for (let i = 0; i < ops.length; i += CHUNK_SIZE) {
        const batch = writeBatch(db);
        for (const op of ops.slice(i, i + CHUNK_SIZE)) {
          batch.set(op.ref, op.data);
        }
        await batch.commit();
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'bootstrap_seed');
    }
  }, []);

  // Trigger seed check when admin logs in
  useEffect(() => {
    if (firebaseUser && firebaseUser.emailVerified && isCloudAdmin) {
      void seedCloudDatabaseIfEmpty(firebaseUser.uid);
    }
  }, [firebaseUser, isCloudAdmin, seedCloudDatabaseIfEmpty]);

  // Real-time Firestore subscriptions for classroom entities when authenticated
  useEffect(() => {
    if (!firebaseUser || !firebaseUser.emailVerified) return;

    const unsubscribers: Array<() => void> = [];

    // 1. Public Teacher Profile
    unsubscribers.push(
      onSnapshot(
        doc(db, 'settings', 'teacherPublic'),
        (snap) => {
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
          const list: ClassRoom[] = snap.docs.map((docSnap) => {
            const d = docSnap.data();
            return {
              id: docSnap.id,
              name: d.name || '',
              whatsappGroupUrl: d.whatsappGroupUrl || undefined,
            };
          });
          list.sort((a, b) => a.name.localeCompare(b.name, 'id'));
          if (list.length > 0 || !hasSeededCloudRef.current) {
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
          const list: Material[] = snap.docs.map((docSnap) => {
            const d = docSnap.data();
            const hasAttachment = Boolean(d.attachmentName);
            return {
              id: docSnap.id,
              title: d.title || '',
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
          const ownerMap: Record<string, string> = {};
          const list: Task[] = snap.docs.map((docSnap) => {
            const d = docSnap.data();
            if (typeof d.ownerUid === 'string') ownerMap[docSnap.id] = d.ownerUid;
            const hasAttachment = Boolean(d.attachmentName);
            return {
              id: docSnap.id,
              title: d.title || '',
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
          const list: AttendanceRecord[] = snap.docs.map((docSnap) => {
            const d = docSnap.data();
            return {
              id: docSnap.id,
              date: d.date || '',
              classId: d.classId || '',
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
          const sUidMap: Record<string, string> = {};
          const list: Submission[] = snap.docs.map((docSnap) => {
            const d = docSnap.data();
            if (typeof d.studentUid === 'string') sUidMap[docSnap.id] = d.studentUid;
            return {
              id: docSnap.id,
              taskId: d.taskId || '',
              studentId: d.studentId || '',
              studentName: d.studentName || '',
              submittedAt: d.submittedAt || '',
              workText: d.workText || '',
              linkAttachment: d.linkAttachment || undefined,
              score: typeof d.score === 'number' ? d.score : undefined,
              note: typeof d.note === 'string' ? d.note : undefined,
            };
          });
          submissionStudentUidMapRef.current = sUidMap;
          list.sort((a, b) => b.id.localeCompare(a.id));
          setSubmissions(list);
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

    return () => {
      unsubscribers.forEach((unsub) => unsub());
    };
  }, [firebaseUser, isCloudAdmin]);

  // Isolated Private WhatsApp Contacts Listener (per student doc to avoid unindexed collectionGroup errors)
  useEffect(() => {
    if (!firebaseUser || !firebaseUser.emailVerified) {
      setStudentContacts({});
      return;
    }

    const targetIds: string[] = isCloudAdmin
      ? studentsRoster.map((s) => s.id)
      : authSession?.role === 'student' && currentStudentId &&
        (!studentClaimedMapRef.current[currentStudentId] ||
          studentClaimedMapRef.current[currentStudentId] === firebaseUser.uid)
      ? [currentStudentId]
      : [];

    if (targetIds.length === 0) return;

    const unsubs = targetIds.map((studentId) =>
      onSnapshot(
        doc(db, 'students', studentId, 'private', 'contact'),
        (snap) => {
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
  }, [firebaseUser, isCloudAdmin, studentsRoster, authSession?.role, currentStudentId]);

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
    setCloudAuthError(null);
    try {
      sessionStorage.setItem('gm_google_redirect_role', intendedRole);
      await signInWithGoogleRedirect();
    } catch (err) {
      await handleGoogleAuthFailure(err, intendedRole);
    }
  };

  // Authentication Handlers
  const loginWithGoogleAsTeacher = async (): Promise<boolean> => {
    setCloudAuthError(null);
    try {
      const user = await signInWithGooglePopup();
      if (!user.emailVerified) {
        setCloudAuthError('Email Google Anda belum terverifikasi.');
        return false;
      }
      const adminOk = await checkUserAdminStatus(user);
      if (!adminOk) {
        setCloudAuthError(
          `Akun (${user.email || 'ini'}) bukan Guru/Admin terdaftar. Masuk melalui tab "Masuk Siswa" atau gunakan PIN Guru.`
        );
        await signOutFirebase();
        return false;
      }
      setIsCloudAdmin(true);
      setAuthSession({ role: 'teacher' });
      setViewMode('teacher');
      return true;
    } catch (err) {
      await handleGoogleAuthFailure(err, 'teacher');
      return false;
    }
  };

  const connectGoogleForStudent = async (): Promise<boolean> => {
    setCloudAuthError(null);
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

  const loginAsTeacher = (inputPin: string): boolean => {
    const validPin = teacher.pin || '1234';
    if (inputPin.trim() === validPin) {
      setAuthSession({ role: 'teacher' });
      setViewMode('teacher');
      return true;
    }
    return false;
  };

  const syncStudentClaimAndWa = async (studentId: string, cleanWa?: string) => {
    if (!firebaseUser || !firebaseUser.emailVerified) return;

    const existingOwner =
      studentOwnerMapRef.current[studentId] || teacherOwnerUidRef.current || firebaseUser.uid;
    const claimedBy = studentClaimedMapRef.current[studentId];

    // Claim student record for this authenticated student account if not yet claimed
    if (!isCloudAdmin && (!claimedBy || claimedBy === firebaseUser.uid)) {
      try {
        await updateDoc(doc(db, 'students', studentId), {
          claimedByUid: firebaseUser.uid,
          updatedAt: serverTimestamp(),
        });
        studentClaimedMapRef.current[studentId] = firebaseUser.uid;
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, `students/${studentId}`);
      }
    }

    if (cleanWa) {
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
    const cleanWa = whatsapp?.trim();
    if (cleanWa) {
      setStudentsRoster((prev) =>
        prev.map((s) => (s.id === studentId ? { ...s, whatsapp: cleanWa } : s))
      );
      setStudentContacts((prev) => ({ ...prev, [studentId]: cleanWa }));
    }
    setAuthSession({ role: 'student', studentId });
    setCurrentStudentId(studentId);
    setViewMode('student');
    const targetStudent = studentsRoster.find((s) => s.id === studentId);
    if (targetStudent) {
      setActiveClassId(targetStudent.classId);
    }

    if (firebaseUser && firebaseUser.emailVerified) {
      void syncStudentClaimAndWa(studentId, cleanWa);
    }
  };

  const logout = () => {
    setAuthSession(null);
    if (firebaseUser) {
      void signOutFirebase();
    }
  };

  const resetTeacherPin = (newPin: string) => {
    const cleanPin = sanitizePin(newPin);
    if (!newPin.trim()) return;
    setTeacher((prev) => ({ ...prev, pin: cleanPin }));
    if (firebaseUser && isCloudAdmin) {
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
    }
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

  // Self-heal: ensure all students belong to an existing class (local mode only; Firestore is authoritative in cloud mode)
  useEffect(() => {
    if (isCloudConnected) return;
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
  }, [classes, isCloudConnected]);

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

  // Actions
  const updateTeacher = (profile: Partial<TeacherProfile>) => {
    const next = { ...teacher, ...profile };
    setTeacher(next);

    if (firebaseUser && isCloudAdmin) {
      void setDoc(
        doc(db, 'settings', 'teacherPublic'),
        {
          name: clampStr(next.name || 'Guru Mapel', 120),
          subject: clampStr(next.subject || 'Mata Pelajaran', 120),
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
    }
  };

  const addClass = (name: string) => {
    if (!name.trim()) return;
    const newClass: ClassRoom = {
      id: 'c_' + Date.now(),
      name: clampStr(name.trim(), 80),
    };
    setClasses((prev) => [...prev, newClass]);

    if (firebaseUser && isCloudAdmin) {
      void setDoc(doc(db, 'classes', newClass.id), {
        name: newClass.name,
        visibility: 'classroom',
        ownerUid: firebaseUser.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }).catch((err) => handleFirestoreError(err, OperationType.CREATE, `classes/${newClass.id}`));
    }
  };

  const updateClass = (id: string, patch: Partial<Pick<ClassRoom, 'name' | 'whatsappGroupUrl'>>) => {
    setClasses((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)));

    if (firebaseUser && isCloudAdmin) {
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
    }
  };

  const deleteClass = (id: string) => {
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

    if (firebaseUser && isCloudAdmin) {
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
    }
  };

  const deleteAllClasses = () => {
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
    if (!name.trim()) return;
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

    if (firebaseUser && isCloudAdmin) {
      const writeStudent = async () => {
        try {
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
    }
  };

  const updateStudent = (id: string, patch: Partial<Pick<Student, 'name' | 'classId' | 'whatsapp'>>) => {
    setStudentsRoster((prev) =>
      prev.map((s) => (s.id === id ? { ...s, ...patch } : s))
    );
    if (patch.whatsapp !== undefined) {
      const cleanWa = patch.whatsapp.trim();
      setStudentContacts((prev) => ({ ...prev, [id]: cleanWa }));
    }

    if (firebaseUser && firebaseUser.emailVerified) {
      if (isCloudAdmin) {
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
      } else if (patch.whatsapp !== undefined) {
        // Student self-service WhatsApp update
        void syncStudentClaimAndWa(id, patch.whatsapp.trim());
      }
    }
  };

  const deleteStudent = (id: string) => {
    const removedSubs = submissions.filter((sub) => sub.studentId === id).map((sub) => sub.id);
    setStudentsRoster((prev) => prev.filter((s) => s.id !== id));
    setSubmissions((prev) => prev.filter((sub) => sub.studentId !== id));

    if (firebaseUser && isCloudAdmin) {
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
    }
  };

  const addStudentsBatch = (newStudents: { name: string; classId: string; whatsapp?: string }[]) => {
    const validClassIds = new Set(classes.map((c) => c.id));
    const fallbackClassId = classes[0]?.id || 'c1';

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
    const data = {
      teacher,
      classes,
      students,
      materials,
      tasks,
      submissions,
      attendance,
      questionSets,
      exportDate: new Date().toISOString(),
      version: '1.1',
    };
    const jsonStr = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Backup_LMS_${teacher.subject.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const importBackup = (jsonContent: string): boolean => {
    try {
      const data = JSON.parse(jsonContent);
      if (!data.classes || !data.students) return false;
      if (data.teacher) setTeacher(data.teacher);
      if (Array.isArray(data.classes)) setClasses(data.classes);
      if (Array.isArray(data.students)) setStudentsRoster(data.students);
      if (Array.isArray(data.materials)) setMaterials(data.materials);
      if (Array.isArray(data.tasks)) setTasks(data.tasks);
      if (Array.isArray(data.submissions)) setSubmissions(data.submissions);
      if (Array.isArray(data.attendance)) setAttendance(data.attendance);
      if (Array.isArray(data.questionSets)) setQuestionSets(data.questionSets);
      return true;
    } catch {
      return false;
    }
  };

  const addMaterial = (item: Omit<Material, 'id' | 'date'>) => {
    const today = new Date().toISOString().split('T')[0];
    const newMaterial: Material = {
      ...item,
      id: 'm_' + Date.now(),
      date: today,
    };
    if (newMaterial.attachment?.dataUrl) {
      saveFileAttachment(newMaterial.id, newMaterial.attachment.dataUrl);
    }
    setMaterials((prev) => [newMaterial, ...prev]);

    if (firebaseUser && isCloudAdmin) {
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
    }
  };

  const deleteMaterial = (id: string) => {
    deleteFileAttachment(id);
    setMaterials((prev) => prev.filter((m) => m.id !== id));

    if (firebaseUser && isCloudAdmin) {
      void deleteDoc(doc(db, 'materials', id)).catch((err) =>
        handleFirestoreError(err, OperationType.DELETE, `materials/${id}`)
      );
    }
  };

  const addTask = (item: Omit<Task, 'id' | 'createdAt'>) => {
    const today = new Date().toISOString().split('T')[0];
    const newTask: Task = {
      ...item,
      id: 't_' + Date.now(),
      createdAt: today,
    };
    if (newTask.attachment?.dataUrl) {
      saveFileAttachment(newTask.id, newTask.attachment.dataUrl);
    }
    setTasks((prev) => [newTask, ...prev]);

    if (firebaseUser && isCloudAdmin) {
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
    }
  };

  const deleteTask = (id: string) => {
    deleteFileAttachment(id);
    const removedSubs = submissions.filter((s) => s.taskId === id).map((s) => s.id);
    setTasks((prev) => prev.filter((t) => t.id !== id));
    setSubmissions((prev) => prev.filter((s) => s.taskId !== id));

    if (firebaseUser && isCloudAdmin) {
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
    }
  };

  const submitTask = (taskId: string, studentId: string, workText: string, linkAttachment?: string) => {
    const student = studentsRoster.find((s) => s.id === studentId);
    const studentName = student ? student.name : 'Siswa';
    const now = new Date();
    const formattedDate = `${now.toISOString().split('T')[0]} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    const existingSub = submissions.find((s) => s.taskId === taskId && s.studentId === studentId);
    const subId = existingSub ? existingSub.id : 'sub_' + Date.now();

    setSubmissions((prev) => {
      const existingIndex = prev.findIndex((s) => s.taskId === taskId && s.studentId === studentId);
      if (existingIndex >= 0) {
        const updated = [...prev];
        updated[existingIndex] = {
          ...updated[existingIndex],
          submittedAt: formattedDate,
          workText,
          linkAttachment,
        };
        return updated;
      }
      const newSub: Submission = {
        id: subId,
        taskId,
        studentId,
        studentName,
        submittedAt: formattedDate,
        workText,
        linkAttachment,
      };
      return [newSub, ...prev];
    });

    if (firebaseUser && firebaseUser.emailVerified) {
      const canUpdateExisting =
        existingSub && submissionStudentUidMapRef.current[existingSub.id] === firebaseUser.uid;
      if (canUpdateExisting) {
        const updatePayload: Record<string, unknown> = {
          submittedAt: clampStr(formattedDate, 40),
          workText: clampStr(workText, 20000),
          updatedAt: serverTimestamp(),
        };
        if (linkAttachment) {
          updatePayload.linkAttachment = clampStr(linkAttachment, 500);
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
          workText: clampStr(workText, 20000),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        };
        if (linkAttachment) {
          newPayload.linkAttachment = clampStr(linkAttachment, 500);
        }
        void setDoc(doc(db, 'submissions', subId), newPayload).catch((err) =>
          handleFirestoreError(err, OperationType.CREATE, `submissions/${subId}`)
        );
      }
    }
  };

  const gradeSubmission = (submissionId: string, score: number, note?: string) => {
    const cleanScore = Math.min(100, Math.max(0, score));
    setSubmissions((prev) =>
      prev.map((sub) =>
        sub.id === submissionId
          ? { ...sub, score: cleanScore, note: note ?? sub.note }
          : sub
      )
    );

    if (firebaseUser && isCloudAdmin) {
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
    }
  };

  const saveAttendance = (
    date: string,
    classId: string,
    topic: string,
    records: Record<string, AttendanceStatus>
  ) => {
    const newRecord: AttendanceRecord = {
      id: 'att_' + Date.now(),
      date,
      classId,
      topic,
      records,
    };
    setAttendance((prev) => [newRecord, ...prev]);

    if (firebaseUser && isCloudAdmin) {
      void setDoc(doc(db, 'attendance', newRecord.id), {
        date: clampStr(date, 30),
        classId,
        topic: clampStr(topic || 'Pertemuan', 200),
        records,
        visibility: 'classroom',
        ownerUid: firebaseUser.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }).catch((err) => handleFirestoreError(err, OperationType.CREATE, `attendance/${newRecord.id}`));
    }
  };

  const deleteAttendance = (id: string) => {
    setAttendance((prev) => prev.filter((a) => a.id !== id));

    if (firebaseUser && isCloudAdmin) {
      void deleteDoc(doc(db, 'attendance', id)).catch((err) =>
        handleFirestoreError(err, OperationType.DELETE, `attendance/${id}`)
      );
    }
  };

  // AI Question Sets Actions
  const addQuestionSet = (qset: GeneratedQuestionSet) => {
    setQuestionSets((prev) => [qset, ...prev.slice(0, 14)]);

    if (firebaseUser && isCloudAdmin) {
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
    }
  };

  const updateQuestionSet = (id: string, updated: GeneratedQuestionSet) => {
    setQuestionSets((prev) => prev.map((s) => (s.id === id ? updated : s)));

    if (firebaseUser && isCloudAdmin) {
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
    }
  };

  const deleteQuestionSet = (id: string) => {
    setQuestionSets((prev) => prev.filter((s) => s.id !== id));

    if (firebaseUser && isCloudAdmin) {
      void deleteDoc(doc(db, 'questionSets', id)).catch((err) =>
        handleFirestoreError(err, OperationType.DELETE, `questionSets/${id}`)
      );
    }
  };

  const resetData = () => {
    setTeacher(initialTeacher);
    setClasses(initialClasses);
    setStudentsRoster(initialStudents);
    setStudentContacts({});
    setMaterials(initialMaterials);
    setTasks(initialTasks);
    setSubmissions(initialSubmissions);
    setAttendance(initialAttendance);
    setQuestionSets([]);
    setActiveClassId('c1');
    setCurrentStudentId('s1');
    localStorage.clear();
  };

  return (
    <LMSContext.Provider
      value={{
        teacher,
        classes,
        students,
        materials,
        tasks,
        submissions,
        attendance,
        questionSets,
        activeClassId,
        viewMode,
        currentStudentId,
        firebaseUser,
        authLoading,
        isCloudAdmin,
        isCloudConnected,
        isInIframe,
        cloudAuthError,
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
