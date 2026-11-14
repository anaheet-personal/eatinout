/** All dates are local calendar dates stored as YYYY-MM-DD. */

export function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function todayISO(): string {
  return toISODate(new Date());
}

export function parseISODate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(iso: string, days: number): string {
  const d = parseISODate(iso);
  d.setDate(d.getDate() + days);
  return toISODate(d);
}

export function daysBetween(fromISO: string, toISO: string): number {
  const ms = parseISODate(toISO).getTime() - parseISODate(fromISO).getTime();
  return Math.round(ms / 86_400_000);
}

export function formatShort(iso: string, today = todayISO()): string {
  const d = parseISODate(iso);
  const sameYear = d.getFullYear() === parseISODate(today).getFullYear();
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    ...(sameYear ? {} : { year: "numeric" }),
  });
}

export function formatRelative(iso: string, today = todayISO()): string {
  const n = daysBetween(iso, today);
  if (n <= 0) return "today";
  if (n === 1) return "yesterday";
  if (n < 7) return `${n} days ago`;
  if (n < 14) return "1 week ago";
  if (n < 60) return `${Math.floor(n / 7)} weeks ago`;
  if (n < 365) return `${Math.floor(n / 30)} months ago`;
  const years = Math.floor(n / 365);
  return years === 1 ? "1 year ago" : `${years} years ago`;
}
