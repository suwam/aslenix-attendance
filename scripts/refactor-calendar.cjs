const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src', 'components', 'NepaliCalendar.jsx');
let content = fs.readFileSync(filePath, 'utf-8');

// Add import
if (!content.includes('import NepaliDate')) {
  content = content.replace('import { format } from "date-fns";', 'import { format } from "date-fns";\nimport NepaliDate from "nepali-date-converter";');
}

// Remove CALENDAR_DATA
const calDataStart = content.indexOf('const CALENDAR_DATA = {');
if (calDataStart !== -1) {
  const calDataEnd = content.indexOf('};', calDataStart) + 2;
  content = content.substring(0, calDataStart) + content.substring(calDataEnd);
}

// Rewrite buildMonth
const buildMonthRegex = /function buildMonth\([\s\S]*?\n\}/g;
content = content.replace(buildMonthRegex, `function buildMonth(year, month) {
  const meta = getMonthMeta(year, month);
  if (!meta) return [];

  const firstAd = bsToAd(meta.year, meta.month, 1);
  const leading = firstAd.getDay();
  
  // Get days in Nepali Month
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
}`);

// Rewrite getMonthMeta
const getMonthMetaRegex = /function getMonthMeta\([\s\S]*?\n\}/g;
content = content.replace(getMonthMetaRegex, `function getMonthMeta(year, month) {
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
}`);

// Rewrite adToBs
const adToBsRegex = /function adToBs\([\s\S]*?\n\}/g;
content = content.replace(adToBsRegex, `function adToBs(adDate) {
  try {
    const nd = new NepaliDate(adDate);
    return {
      year: nd.getYear(),
      month: nd.getMonth(),
      date: nd.getDate(),
      formatted: \`\${MONTHS[nd.getMonth()]} \${nd.getDate()}, \${nd.getYear()}\`,
    };
  } catch (e) {
    return null;
  }
}`);

// Rewrite bsToAd
const bsToAdRegex = /function bsToAd\([\s\S]*?\n\}/g;
content = content.replace(bsToAdRegex, `function bsToAd(year, month, date) {
  return new NepaliDate(year, month, date).toJsDate();
}`);

// Rewrite isValidBsDate
const isValidBsDateRegex = /function isValidBsDate\([\s\S]*?\n\}/g;
content = content.replace(isValidBsDateRegex, `function isValidBsDate(value) {
  const match = /^(\\d{4})-(\\d{2})-(\\d{2})$/.exec(value);
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
}`);

// Remove unused functions if they exist
content = content.replace(/function parseAdDate[\s\S]*?\n\}\n/g, '');
content = content.replace(/function differenceInDays[\s\S]*?\n\}\n/g, '');

fs.writeFileSync(filePath, content);
console.log('Successfully refactored NepaliCalendar.jsx');
