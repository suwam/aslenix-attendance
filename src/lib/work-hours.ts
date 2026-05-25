export function formatWorkHours(value: number | string | null | undefined) {
  const hoursValue = Number(value || 0);
  if (!Number.isFinite(hoursValue) || hoursValue <= 0) return "0m";

  const totalMinutes = Math.round(hoursValue * 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours > 0 && minutes > 0) return `${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h`;
  return `${minutes}m`;
}
