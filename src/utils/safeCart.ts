export function parseStoredCart(rawValue: string | null, context: string): any[] {
  try {
    const parsed = rawValue ? JSON.parse(rawValue) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.warn(`Failed to parse cart from localStorage (${context})`, error);
    return [];
  }
}
