import { normalizeWhatsAppNumber } from './whatsapp';

export async function hashStudentPhone(rawPhone?: string): Promise<string> {
  const normalized = normalizeWhatsAppNumber(rawPhone);
  if (!normalized) return '';
  const input = `gurumapel-student-phone-v1:${normalized}`;

  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const bytes = new TextEncoder().encode(input);
    const digest = await crypto.subtle.digest('SHA-256', bytes);
    return Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }

  // Deterministic fallback when SubtleCrypto is unavailable
  let h1 = 0x811c9dc5;
  let h2 = 0x9e3779b9;
  for (let i = 0; i < input.length; i++) {
    const ch = input.charCodeAt(i);
    h1 ^= ch;
    h1 = Math.imul(h1, 0x01000193);
    h2 ^= ch + i;
    h2 = Math.imul(h2, 0x85ebca6b);
  }
  return `fb_${(h1 >>> 0).toString(16).padStart(8, '0')}${(h2 >>> 0).toString(16).padStart(8, '0')}`;
}

export function buildStudentPortalLink(studentId?: string): string {
  if (typeof window === 'undefined') return '';
  const url = new URL(window.location.origin);
  url.searchParams.set('role', 'student');
  if (studentId) {
    url.searchParams.set('student', studentId);
  }
  return url.toString();
}

export interface StudentLinkParams {
  isStudentLink: boolean;
  studentId?: string;
  classId?: string;
}

export function parseStudentLinkParams(): StudentLinkParams {
  if (typeof window === 'undefined') {
    return { isStudentLink: false };
  }
  try {
    const params = new URLSearchParams(window.location.search);
    const roleParam = (params.get('role') || params.get('mode') || params.get('portal') || '').toLowerCase();
    const studentId = (params.get('student') || params.get('siswa') || '').trim() || undefined;
    const classId = (params.get('kelas') || params.get('classId') || '').trim() || undefined;
    const isStudentLink =
      roleParam === 'student' ||
      roleParam === 'siswa' ||
      Boolean(studentId) ||
      Boolean(classId);
    return {
      isStudentLink,
      studentId,
      classId,
    };
  } catch {
    return { isStudentLink: false };
  }
}
