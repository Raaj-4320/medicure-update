export const emailLocalPart = (email?: string | null): string => {
  const value = (email || '').trim();
  if (!value.includes('@')) return value;
  return value.split('@')[0] || value;
};

export type DisplayNameInput = {
  name?: string | null;
  email?: string | null;
  id?: string | null;
  fallback?: string;
};

export const resolveDisplayName = ({ name, email, id, fallback = 'User' }: DisplayNameInput): string => {
  const cleanName = (name || '').trim();
  if (cleanName) return cleanName;

  const local = emailLocalPart(email);
  if (local) return local;

  const cleanId = (id || '').trim();
  if (cleanId) return cleanId;

  return fallback;
};
