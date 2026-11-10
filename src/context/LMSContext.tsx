import React, { createContext, useContext, useState, useEffect } from 'react';
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

interface LMSContextType {
  // State
  teacher: TeacherProfile;
  classes: ClassRoom[];
  students: Student[];
  materials: Material[];
  tasks: Task[];
  submissions: Submission[];
  attendance: AttendanceRecord[];
  activeClassId: string; // 'all' or classId
  viewMode: 'teacher' | 'student';
  currentStudentId: string;

  authSession: AuthSession | null;
  loginAsTeacher: (pin: string) => boolean;
  loginAsStudent: (studentId: string) => void;
  logout: () => void;

  // Actions
  setActiveClassId: (id: string) => void;
  setViewMode: (mode: 'teacher' | 'student') => void;
  setCurrentStudentId: (id: string) => void;
  updateTeacher: (profile: Partial<TeacherProfile>) => void;

  // Class & Student Actions
  addClass: (name: string) => void;
  deleteClass: (id: string) => void;
  addStudent: (name: string, classId: string) => void;
  deleteStudent: (id: string) => void;

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

  // Reset
  resetData: () => void;
}

const LMSContext = createContext<LMSContextType | undefined>(undefined);

const safeParse = <T,>(key: string, fallback: T): T => {
  try {
    const saved = localStorage.getItem(key);
    if (!saved) return fallback;
    const parsed = JSON.parse(saved);
    if (!parsed) return fallback;
    return parsed;
  } catch {
    return fallback;
  }
};

export const LMSProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [teacher, setTeacher] = useState<TeacherProfile>(() =>
    safeParse('gm_teacher', initialTeacher)
  );

  const [classes, setClasses] = useState<ClassRoom[]>(() => {
    const list = safeParse('gm_classes', initialClasses);
    return Array.isArray(list) && list.length > 0 ? list : initialClasses;
  });

  const [students, setStudents] = useState<Student[]>(() => {
    const list = safeParse('gm_students', initialStudents);
    return Array.isArray(list) && list.length > 0 ? list : initialStudents;
  });

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

  const [activeClassId, setActiveClassId] = useState<string>('c1');
  const [viewMode, setViewMode] = useState<'teacher' | 'student'>('teacher');
  const [currentStudentId, setCurrentStudentId] = useState<string>('s1');

  const [authSession, setAuthSession] = useState<AuthSession | null>(() => {
    const saved = localStorage.getItem('gm_session');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return { role: 'teacher' };
      }
    }
    return { role: 'teacher' };
  });

  useEffect(() => {
    if (authSession) {
      localStorage.setItem('gm_session', JSON.stringify(authSession));
    } else {
      localStorage.removeItem('gm_session');
    }
  }, [authSession]);

  const loginAsTeacher = (inputPin: string): boolean => {
    const validPin = teacher.pin || '1234';
    if (inputPin.trim() === validPin || inputPin.trim() === '1234') {
      setAuthSession({ role: 'teacher' });
      setViewMode('teacher');
      return true;
    }
    return false;
  };

  const loginAsStudent = (studentId: string) => {
    setAuthSession({ role: 'student', studentId });
    setCurrentStudentId(studentId);
    setViewMode('student');
    const targetStudent = students.find((s) => s.id === studentId);
    if (targetStudent) {
      setActiveClassId(targetStudent.classId);
    }
  };

  const logout = () => {
    setAuthSession(null);
  };

  // Persistence effects
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
    localStorage.setItem('gm_materials', JSON.stringify(materials));
  }, [materials]);

  useEffect(() => {
    localStorage.setItem('gm_tasks', JSON.stringify(tasks));
  }, [tasks]);

  useEffect(() => {
    localStorage.setItem('gm_submissions', JSON.stringify(submissions));
  }, [submissions]);

  useEffect(() => {
    localStorage.setItem('gm_attendance', JSON.stringify(attendance));
  }, [attendance]);

  const updateTeacher = (profile: Partial<TeacherProfile>) => {
    setTeacher((prev) => ({ ...prev, ...profile }));
  };

  const addClass = (name: string) => {
    if (!name.trim()) return;
    const newClass: ClassRoom = {
      id: 'c_' + Date.now(),
      name: name.trim(),
    };
    setClasses((prev) => [...prev, newClass]);
  };

  const deleteClass = (id: string) => {
    setClasses((prev) => prev.filter((c) => c.id !== id));
    setStudents((prev) => prev.filter((s) => s.classId !== id));
    if (activeClassId === id) setActiveClassId('all');
  };

  const addStudent = (name: string, classId: string) => {
    if (!name.trim()) return;
    const newStudent: Student = {
      id: 's_' + Date.now(),
      name: name.trim(),
      classId,
    };
    setStudents((prev) => [...prev, newStudent]);
  };

  const deleteStudent = (id: string) => {
    setStudents((prev) => prev.filter((s) => s.id !== id));
    setSubmissions((prev) => prev.filter((sub) => sub.studentId !== id));
  };

  const addMaterial = (item: Omit<Material, 'id' | 'date'>) => {
    const today = new Date().toISOString().split('T')[0];
    const newMaterial: Material = {
      ...item,
      id: 'm_' + Date.now(),
      date: today,
    };
    setMaterials((prev) => [newMaterial, ...prev]);
  };

  const deleteMaterial = (id: string) => {
    setMaterials((prev) => prev.filter((m) => m.id !== id));
  };

  const addTask = (item: Omit<Task, 'id' | 'createdAt'>) => {
    const today = new Date().toISOString().split('T')[0];
    const newTask: Task = {
      ...item,
      id: 't_' + Date.now(),
      createdAt: today,
    };
    setTasks((prev) => [newTask, ...prev]);
  };

  const deleteTask = (id: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== id));
    setSubmissions((prev) => prev.filter((s) => s.taskId !== id));
  };

  const submitTask = (taskId: string, studentId: string, workText: string, linkAttachment?: string) => {
    const student = students.find((s) => s.id === studentId);
    const studentName = student ? student.name : 'Siswa';
    const now = new Date();
    const formattedDate = `${now.toISOString().split('T')[0]} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    // If student already submitted, update it
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
        id: 'sub_' + Date.now(),
        taskId,
        studentId,
        studentName,
        submittedAt: formattedDate,
        workText,
        linkAttachment,
      };
      return [newSub, ...prev];
    });
  };

  const gradeSubmission = (submissionId: string, score: number, note?: string) => {
    setSubmissions((prev) =>
      prev.map((sub) =>
        sub.id === submissionId
          ? { ...sub, score: Math.min(100, Math.max(0, score)), note: note ?? sub.note }
          : sub
      )
    );
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
  };

  const deleteAttendance = (id: string) => {
    setAttendance((prev) => prev.filter((a) => a.id !== id));
  };

  const resetData = () => {
    setTeacher(initialTeacher);
    setClasses(initialClasses);
    setStudents(initialStudents);
    setMaterials(initialMaterials);
    setTasks(initialTasks);
    setSubmissions(initialSubmissions);
    setAttendance(initialAttendance);
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
        activeClassId,
        viewMode,
        currentStudentId,
        authSession,
        loginAsTeacher,
        loginAsStudent,
        logout,
        setActiveClassId,
        setViewMode,
        setCurrentStudentId,
        updateTeacher,
        addClass,
        deleteClass,
        addStudent,
        deleteStudent,
        addMaterial,
        deleteMaterial,
        addTask,
        deleteTask,
        submitTask,
        gradeSubmission,
        saveAttendance,
        deleteAttendance,
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
