export const WEEKLY_OFF_DAY = 6;
export const WEEKLY_OFF_LABEL = "Weekly off";

export function isWeeklyOffDate(date: Date | string) {
  return getLocalDate(date).getDay() === WEEKLY_OFF_DAY;
}

export function getLocalDate(date: Date | string) {
  if (date instanceof Date) return date;

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (match) {
    return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  }

  return new Date(date);
}
