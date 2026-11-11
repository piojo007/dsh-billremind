// 日期推算：信用卡账单日 / 还款日（每月）与年费扣取日（每年）的下一次到期日与剩余天数。
// 约定：目标日落在当月不存在时（如 31 日遇到 30 天的月份），按当月最后一天处理。

const MS_DAY = 24 * 60 * 60 * 1000;
export const DEFAULT_TIME_ZONE = 'Asia/Shanghai';

function calendarParts(now, timeZone = DEFAULT_TIME_ZONE) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  return Object.fromEntries(parts.filter((part) => part.type !== 'literal').map((part) => [part.type, Number(part.value)]));
}

export function daysInMonth(year, month) {
  // month: 1-12
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function clampDay(year, month, day) {
  return Math.min(day, daysInMonth(year, month));
}

export function startOfToday(now = new Date(), timeZone = DEFAULT_TIME_ZONE) {
  const { year, month, day } = calendarParts(now, timeZone);
  return new Date(Date.UTC(year, month - 1, day));
}

/** 每月固定日（1-31）的下一次发生日（含今天）。返回 Date（零点）。 */
export function nextMonthlyDate(day, now = new Date(), timeZone = DEFAULT_TIME_ZONE) {
  const today = startOfToday(now, timeZone);
  let y = today.getUTCFullYear();
  let m = today.getUTCMonth() + 1;
  let target = new Date(Date.UTC(y, m - 1, clampDay(y, m, day)));
  if (target.getTime() < today.getTime()) {
    m += 1;
    if (m > 12) { m = 1; y += 1; }
    target = new Date(Date.UTC(y, m - 1, clampDay(y, m, day)));
  }
  return target;
}

/** 每年固定月日（month 1-12, day 1-31）的下一次发生日（含今天）。 */
export function nextAnnualDate(month, day, now = new Date(), timeZone = DEFAULT_TIME_ZONE) {
  const today = startOfToday(now, timeZone);
  const y = today.getUTCFullYear();
  let target = new Date(Date.UTC(y, month - 1, clampDay(y, month, day)));
  if (target.getTime() < today.getTime()) {
    const ny = y + 1;
    target = new Date(Date.UTC(ny, month - 1, clampDay(ny, month, day)));
  }
  return target;
}

/** 距目标日剩余天数（今天 = 0）。 */
export function daysUntil(target, now = new Date(), timeZone = DEFAULT_TIME_ZONE) {
  return Math.round((target.getTime() - startOfToday(now, timeZone).getTime()) / MS_DAY);
}

export function formatDate(date) {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function pad2(n) {
  return String(n).padStart(2, '0');
}
