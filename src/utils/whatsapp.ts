export function normalizeWhatsAppNumber(raw?: string): string {
  if (!raw) return '';
  const digits = raw.replace(/\D/g, '');
  if (!digits) return '';

  let normalized = digits;
  if (normalized.startsWith('0')) {
    normalized = '62' + normalized.slice(1);
  } else if (normalized.startsWith('8')) {
    normalized = '62' + normalized;
  }

  // Indonesian and international mobile numbers are generally 9 to 15 digits
  if (normalized.length < 9 || normalized.length > 15) {
    return '';
  }
  return normalized;
}

export function buildWaMeUrl(phone: string | undefined, message: string): string {
  const normalized = normalizeWhatsAppNumber(phone);
  const encoded = encodeURIComponent(message);
  if (!normalized) {
    return `https://wa.me/?text=${encoded}`;
  }
  return `https://wa.me/${normalized}?text=${encoded}`;
}

export function personalizeWhatsAppMessage(
  template: string,
  vars: {
    name: string;
    className: string;
    subject: string;
    teacherName: string;
  }
): string {
  return template
    .replace(/\{nama\}/gi, vars.name)
    .replace(/\{kelas\}/gi, vars.className)
    .replace(/\{mapel\}/gi, vars.subject)
    .replace(/\{guru\}/gi, vars.teacherName);
}
