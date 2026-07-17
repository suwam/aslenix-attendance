import re
import os

filepath = r"d:\aslenix-attendance\src\components\NepaliCalendar.jsx"

with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

# Add NepaliDate import
if 'import NepaliDate' not in content:
    content = content.replace('import { format } from "date-fns";', 'import { format } from "date-fns";\nimport NepaliDate from "nepali-date-converter";')

# Remove CALENDAR_DATA completely
content = re.sub(r'const CALENDAR_DATA = \{\s*2083: \{\s*anchorAd: "2026-04-14",\s*monthDays: \[.*?\],\s*\},\s*\};\s*', '', content)

# Rewrite buildMonth
content = re.sub(r'function buildMonth\(year, month\) \{[\s\S]*?\n\}', '''function buildMonth(year, month) {
  const meta = getMonthMeta(year, month);
  if (!meta) return [];

  const firstAd = bsToAd(meta.year, meta.month, 1);
  const leading = firstAd.getDay();
  
  const nextMonthYear = meta.month === 11 ? meta.year + 1 : meta.year;
  const nextMonth = meta.month === 11 ? 0 : meta.month + 1;
  const lastDayAd = bsToAd(nextMonthYear, nextMonth, 1);
  lastDayAd.setDate(lastDayAd.getDate() - 1);
  const totalDays = new NepaliDate(lastDayAd).getDate();
  
  const days = Array.from({ length: leading }, () => null);

  for (let date = 1; date <= totalDays; date += 1) {
    const adDate = bsToAd(meta.year, meta.month, date);
    days.push({
      year: meta.year,
      month: meta.month,
      date,
      adDate,
      weekday: adDate.getDay(),
      bsDate: formatBsDate(meta.year, meta.month, date),
    });
  }

  while (days.length % 7 !== 0) days.push(null);
  return days;
}''', content)

# Rewrite getMonthMeta
content = re.sub(r'function getMonthMeta\(year, month\) \{[\s\S]*?\n\}', '''function getMonthMeta(year, month) {
  let nextYear = year;
  let nextMonth = month;
  if (nextMonth < 0) {
    nextYear -= 1;
    nextMonth = 11;
  }
  if (nextMonth > 11) {
    nextYear += 1;
    nextMonth = 0;
  }
  try {
    new NepaliDate(nextYear, nextMonth, 1);
    return { year: nextYear, month: nextMonth };
  } catch (e) {
    return null;
  }
}''', content)

# Rewrite adToBs
content = re.sub(r'function adToBs\(adDate\) \{[\s\S]*?\n\}', '''function adToBs(adDate) {
  try {
    const nd = new NepaliDate(adDate);
    return {
      year: nd.getYear(),
      month: nd.getMonth(),
      date: nd.getDate(),
      formatted: `${MONTHS[nd.getMonth()]} ${nd.getDate()}, ${nd.getYear()}`,
    };
  } catch (e) {
    return null;
  }
}''', content)

# Rewrite bsToAd
content = re.sub(r'function bsToAd\(year, month, date\) \{[\s\S]*?\n\}', '''function bsToAd(year, month, date) {
  return new NepaliDate(year, month, date).toJsDate();
}''', content)

# Rewrite isValidBsDate
content = re.sub(r'function isValidBsDate\(value\) \{[\s\S]*?\n\}', '''function isValidBsDate(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  const date = Number(match[3]);
  try {
    const nd = new NepaliDate(year, month, date);
    return nd.getYear() === year && nd.getMonth() === month && nd.getDate() === date;
  } catch (e) {
    return false;
  }
}''', content)

# Remove unused functions
content = re.sub(r'function parseAdDate\(value\) \{[\s\S]*?\n\}\n*', '', content)
content = re.sub(r'function differenceInDays\(laterDate, earlierDate\) \{[\s\S]*?\n\}\n*', '', content)

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)
print("Done")
