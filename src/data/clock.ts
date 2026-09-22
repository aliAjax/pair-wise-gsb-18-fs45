// 资料层：日期时间工具（仅格式化，不含业务规则）

const pad = (n: number) => String(n).padStart(2, "0");

/** YYYY-MM-DD */
export function dateKey(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** YYYY-MM-DD HH:mm */
export function stamp(d: Date = new Date()): string {
  return `${dateKey(d)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function shiftDays(days: number, from: Date = new Date()): Date {
  const d = new Date(from);
  d.setDate(d.getDate() + days);
  return d;
}

export function todayKey(): string {
  return dateKey(new Date());
}

export function tomorrowKey(): string {
  return dateKey(shiftDays(1));
}

/** 中文星期 */
export function weekdayKey(key: string): string {
  const names = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
  return names[new Date(`${key}T00:00:00`).getDay()];
}
