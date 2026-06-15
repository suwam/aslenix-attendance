import { format } from "date-fns";
import NepaliDate from "nepali-date-converter";

export function getNepaliDate(date: Date | string = new Date()) {
  return new NepaliDate(toLocalDate(date));
}

export function formatNepaliDate(date: Date | string = new Date(), pattern = "ddd DD, MMMM YYYY") {
  return getNepaliDate(date).format(pattern);
}

export function getCurrentNepaliMonthRange(date: Date | string = new Date()) {
  return getNepaliMonthRange(0, date);
}

export function getNepaliMonthRange(offset = 0, date: Date | string = new Date()) {
  const bsDate = getNepaliDate(date);
  const absoluteMonth = bsDate.getYear() * 12 + bsDate.getMonth() + offset;
  const year = Math.floor(absoluteMonth / 12);
  const month = ((absoluteMonth % 12) + 12) % 12;
  const start = new NepaliDate(year, month, 1).toJsDate();
  const nextMonthYear = month === 11 ? year + 1 : year;
  const nextMonth = month === 11 ? 0 : month + 1;
  const end = new NepaliDate(nextMonthYear, nextMonth, 1).toJsDate();
  end.setDate(end.getDate() - 1);

  return {
    bsYear: year,
    bsMonth: month,
    startAd: format(start, "yyyy-MM-dd"),
    endAd: format(end, "yyyy-MM-dd"),
    label: new NepaliDate(year, month, 1).format("MMMM YYYY"),
  };
}

export function getNepaliMonthLabel(offset = 0, date: Date | string = new Date()) {
  const bsDate = getNepaliDate(date);
  const absoluteMonth = bsDate.getYear() * 12 + bsDate.getMonth() + offset;
  const year = Math.floor(absoluteMonth / 12);
  const month = ((absoluteMonth % 12) + 12) % 12;
  return new NepaliDate(year, month, 1).format("MMMM YYYY");
}

export function toAdDateFromBs(year: number, month: number, date: number) {
  return new NepaliDate(year, month - 1, date).toJsDate();
}

export function formatBsInput(date: Date | string = new Date()) {
  const bsDate = getNepaliDate(date);
  return [
    bsDate.getYear(),
    String(bsDate.getMonth() + 1).padStart(2, "0"),
    String(bsDate.getDate()).padStart(2, "0"),
  ].join("-");
}

export function formatBsMonthInput(date: Date | string = new Date()) {
  const bsDate = getNepaliDate(date);
  return [bsDate.getYear(), String(bsDate.getMonth() + 1).padStart(2, "0")].join("-");
}

export function bsMonthInputToAdRange(value: string) {
  const match = /^(\d{4})-(\d{2})$/.exec(value);
  if (!match) return null;

  const year = Number(match[1]);
  const monthIndex = Number(match[2]) - 1;
  const start = new NepaliDate(year, monthIndex, 1).toJsDate();
  const nextMonthYear = monthIndex === 11 ? year + 1 : year;
  const nextMonth = monthIndex === 11 ? 0 : monthIndex + 1;
  const end = new NepaliDate(nextMonthYear, nextMonth, 1).toJsDate();
  end.setDate(end.getDate() - 1);

  return {
    startAd: format(start, "yyyy-MM-dd"),
    endAd: format(end, "yyyy-MM-dd"),
    label: new NepaliDate(year, monthIndex, 1).format("MMMM YYYY"),
  };
}

export function bsInputToAdDateString(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;

  const [, year, month, date] = match;
  const adDate = toAdDateFromBs(Number(year), Number(month), Number(date));
  if (Number.isNaN(adDate.getTime())) return null;
  return format(adDate, "yyyy-MM-dd");
}

function toLocalDate(date: Date | string) {
  if (date instanceof Date) return date;

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (match) {
    return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  }

  return new Date(date);
}
