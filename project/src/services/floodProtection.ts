const timestamps: number[] = [];
const LIMIT = 10;
const WINDOW_MS = 60_000;

export const ADMIN_EMAIL = 'mazen@mazen.engineer';

export function checkFloodLimit(email?: string): { allowed: boolean; remaining: number; cooldownSeconds: number } {
  if (email === ADMIN_EMAIL) {
    return { allowed: true, remaining: LIMIT, cooldownSeconds: 0 };
  }

  const now = Date.now();
  const recent = timestamps.filter((t) => now - t < WINDOW_MS);
  timestamps.length = 0;
  timestamps.push(...recent);

  if (recent.length >= LIMIT) {
    const oldest = recent[0];
    const cooldownMs = (oldest + WINDOW_MS) - now;
    const cooldownSeconds = Math.ceil(Math.max(0, cooldownMs) / 1000);
    return { allowed: false, remaining: 0, cooldownSeconds };
  }

  timestamps.push(now);
  return { allowed: true, remaining: LIMIT - recent.length - 1, cooldownSeconds: 0 };
}

export function resetFloodLimit(): void {
  timestamps.length = 0;
}
