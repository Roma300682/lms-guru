export const parseSubjects = (raw?: string): string[] => {
  if (!raw) return [];
  const seen = new Set<string>();
  const result: string[] = [];
  raw
    .split(/[,;\n]+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .forEach((item) => {
      const key = item.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        result.push(item);
      }
    });
  return result;
};

export const formatSubjects = (list: string[]): string => {
  const seen = new Set<string>();
  const cleaned: string[] = [];
  list
    .map((s) => s.trim())
    .filter(Boolean)
    .forEach((item) => {
      const key = item.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        cleaned.push(item);
      }
    });
  return cleaned.join(', ');
};

export const getPrimarySubject = (raw?: string): string => {
  return parseSubjects(raw)[0] || 'Mata Pelajaran';
};
