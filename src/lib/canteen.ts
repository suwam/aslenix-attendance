import { supabase } from "@/integrations/supabase/client";
import { format, addDays, parseISO } from "date-fns";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import { getNepaliDate, formatNepaliDate } from "@/lib/nepali-calendar";

export type CanteenPeriod = {
  id: string;
  title: string;
  start_date: string;
  end_date: string;
  is_locked: boolean;
  prepared_by: string;
  verified_by: string | null;
  created_at?: string;
  updated_at?: string;
};

export type CanteenEmployee = {
  id: string;
  serial_number: number;
  name: string;
  user_id: string | null;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
};

export type CanteenHoliday = {
  id: string;
  period_id: string;
  day_index: number; // 0 to 13
  date: string;
  type: "holiday" | "weekly_off";
  label: string; // e.g. "HOLIDAY", "WEEKLY OFF"
  is_enabled: boolean;
};

export type CanteenAttendanceRecord = {
  id: string;
  period_id: string;
  employee_id: string;
  user_id: string | null;
  date: string;
  ate: boolean;
  marked_by: string | null;
};

export const WEEK_DAYS = ["SUN", "MON", "TUES", "WED", "THU", "FRI", "SAT"] as const;

export type DayInfo = {
  dayIndex: number; // 0 to 13
  dateString: string; // YYYY-MM-DD (AD)
  dayName: (typeof WEEK_DAYS)[number];
  dayOfMonth: string; // Nepali day number e.g. "10"
  displayDate: string; // Nepali formatted e.g. "10 Kartik"
  nepaliDateString: string; // Nepali full date e.g. "2083/07/10"
  weekNumber: 1 | 2;
  isSaturday: boolean;
};

export function generatePeriodDays(startDateStr: string): DayInfo[] {
  const start = parseISO(startDateStr);
  const days: DayInfo[] = [];

  for (let i = 0; i < 14; i++) {
    const d = addDays(start, i);
    const dayOfWeek = d.getDay(); // 0 is Sunday, 6 is Saturday
    const dayName = WEEK_DAYS[dayOfWeek];
    const nepaliDate = getNepaliDate(d);
    days.push({
      dayIndex: i,
      dateString: format(d, "yyyy-MM-dd"),
      dayName,
      dayOfMonth: String(nepaliDate.getDate()),
      displayDate: nepaliDate.format("D MMMM"),
      nepaliDateString: nepaliDate.format("YYYY/MM/DD"),
      weekNumber: i < 7 ? 1 : 2,
      isSaturday: dayOfWeek === 6,
    });
  }

  return days;
}

// -------------------------------------------------------------
// PDF EXPORT
// -------------------------------------------------------------
export async function exportCanteenSheetToPDF(elementId: string, filename = "Canteen_Log_Sheet.pdf") {
  const el = document.getElementById(elementId);
  if (!el) throw new Error("Sheet element not found");

  const canvas = await html2canvas(el, {
    scale: 2,
    useCORS: true,
    backgroundColor: "#ffffff",
    logging: false,
    windowWidth: 1280,
  });

  const imgData = canvas.toDataURL("image/png");
  // A4 Landscape is 297mm x 210mm
  const pdf = new jsPDF({
    orientation: "landscape",
    unit: "mm",
    format: "a4",
  });

  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 6;
  const maxWidth = pageWidth - margin * 2;
  const maxHeight = pageHeight - margin * 2;

  let imgWidth = maxWidth;
  let imgHeight = (canvas.height * imgWidth) / canvas.width;

  if (imgHeight > maxHeight) {
    imgHeight = maxHeight;
    imgWidth = (canvas.width * imgHeight) / canvas.height;
  }

  const x = (pageWidth - imgWidth) / 2;
  const y = (pageHeight - imgHeight) / 2;

  pdf.addImage(imgData, "PNG", x, y, imgWidth, imgHeight);
  pdf.save(filename);
}

// -------------------------------------------------------------
// EXCEL (.xls) HTML TABLE EXPORT (Preserves merged cells and colors)
// -------------------------------------------------------------
export function exportCanteenSheetToExcel(
  period: CanteenPeriod,
  employees: CanteenEmployee[],
  days: DayInfo[],
  holidays: Record<number, CanteenHoliday>,
  attendance: Record<string, boolean>,
  filename = "Canteen_Log_Sheet.xls",
) {
  const week1Days = days.slice(0, 7);
  const week2Days = days.slice(7, 14);

  let html = `
    <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
    <head>
      <!--[if gte mso 9]>
      <xml>
        <x:ExcelWorkbook>
          <x:ExcelWorksheets>
            <x:ExcelWorksheet>
              <x:Name>Canteen Log Sheet</x:Name>
              <x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions>
            </x:ExcelWorksheet>
          </x:ExcelWorksheets>
        </x:ExcelWorkbook>
      </xml>
      <![endif]-->
      <meta http-equiv="content-type" content="text/plain; charset=UTF-8"/>
      <style>
        table { border-collapse: collapse; font-family: Arial, sans-serif; font-size: 11pt; }
        th, td { border: 1px solid #000000; text-align: center; vertical-align: middle; padding: 6px; }
        .header-title { font-size: 16pt; font-weight: bold; text-align: center; }
        .header-sub { font-size: 12pt; text-align: center; font-weight: bold; }
        .sat-header { color: #ea580c; font-weight: bold; }
        .vertical-label { color: #dc2626; font-weight: bold; }
        .emp-name { text-align: left; padding-left: 8px; }
        .date-range { color: #dc2626; font-weight: bold; }
        .ate-mark { font-size: 14pt; font-weight: bold; }
      </style>
    </head>
    <body>
      <table>
        <tr>
          <td colspan="17" class="header-title">ASLENIX TECH AND SOLUTION</td>
        </tr>
        <tr>
          <td colspan="17" class="header-sub">(Canteen Log Sheet)</td>
        </tr>
        <tr>
          <td colspan="4" style="text-align: left; font-weight: bold;">
            ✓ = Ate<br/>Blank = Did not eat
          </td>
          <td colspan="7" style="text-align: center; font-weight: bold;">
            Tick ✓ when you go to eat
          </td>
          <td colspan="6" style="text-align: right;" class="date-range">
            DATE = ${formatNepaliDate(period.start_date, "YYYY/MM/DD")} – ${formatNepaliDate(period.end_date, "YYYY/MM/DD")} BS
          </td>
        </tr>
        <tr>
          <th rowspan="2">SN</th>
          <th rowspan="2" style="width: 200px;">Name</th>
          <th colspan="7">WEEK 1</th>
          <th colspan="7">WEEK 2</th>
          <th rowspan="2">Total Meals</th>
        </tr>
        <tr>
          ${week1Days.map((d) => `<th class="${d.isSaturday ? "sat-header" : ""}">${d.dayName}<br/><span style="font-size: 8pt; font-weight: normal;">${d.dayOfMonth}</span></th>`).join("")}
          ${week2Days.map((d) => `<th class="${d.isSaturday ? "sat-header" : ""}">${d.dayName}<br/><span style="font-size: 8pt; font-weight: normal;">${d.dayOfMonth}</span></th>`).join("")}
        </tr>
  `;

  employees.forEach((emp, empIdx) => {
    let rowMeals = 0;
    html += `<tr>`;
    html += `<td>${emp.serial_number}</td>`;
    html += `<td class="emp-name">${emp.name}</td>`;

    days.forEach((d) => {
      const hol = holidays[d.dayIndex];
      const isMerged = hol && hol.is_enabled;

      if (isMerged) {
        if (empIdx === 0) {
          html += `<td rowspan="${employees.length}" class="vertical-label">${hol.label}</td>`;
        }
      } else {
        const key = `${emp.id}_${d.dateString}`;
        const hasAte = attendance[key];
        if (hasAte) rowMeals++;
        html += `<td class="ate-mark">${hasAte ? "✓" : ""}</td>`;
      }
    });

    // Total meals column
    days.forEach((d) => {
      const hol = holidays[d.dayIndex];
      if (!hol || !hol.is_enabled) {
        // already counted in rowMeals
      }
    });

    html += `<td><strong>${rowMeals}</strong></td>`;
    html += `</tr>`;
  });

  html += `
        <tr>
          <td colspan="17" style="text-align: right; padding-top: 15px; border: none; font-size: 10pt;">
            Office record: Prepared by: ${period.prepared_by}&nbsp;&nbsp;&nbsp;&nbsp;Verified by: ${period.verified_by || "__________________"}&nbsp;&nbsp;&nbsp;&nbsp;Date: ${formatNepaliDate(period.end_date, "YYYY/MM/DD")} BS
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;

  const blob = new Blob([html], { type: "application/vnd.ms-excel;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// -------------------------------------------------------------
// CSV EXPORT
// -------------------------------------------------------------
export function exportCanteenSheetToCSV(
  period: CanteenPeriod,
  employees: CanteenEmployee[],
  days: DayInfo[],
  holidays: Record<number, CanteenHoliday>,
  attendance: Record<string, boolean>,
  filename = "Canteen_Log_Sheet.csv",
) {
  const rows: string[][] = [];

  rows.push(["ASLENIX TECH AND SOLUTION"]);
  rows.push(["(Canteen Log Sheet)"]);
  rows.push([
    "✓ = Ate | Blank = Did not eat",
    "",
    "Tick ✓ when you go to eat",
    "",
    "",
    "",
    "",
    "",
    "",
    `DATE = ${formatNepaliDate(period.start_date, "YYYY/MM/DD")} - ${formatNepaliDate(period.end_date, "YYYY/MM/DD")} BS`,
  ]);
  rows.push([]);

  // Header 1
  const h1 = ["SN", "Name"];
  for (let i = 0; i < 7; i++) h1.push("WEEK 1");
  for (let i = 0; i < 7; i++) h1.push("WEEK 2");
  h1.push("Total Meals");
  rows.push(h1);

  // Header 2
  const h2 = ["", ""];
  days.forEach((d) => h2.push(`${d.dayName} (${d.dayOfMonth})`));
  h2.push("");
  rows.push(h2);

  // Employee rows
  employees.forEach((emp) => {
    let totalMeals = 0;
    const r = [String(emp.serial_number), emp.name];
    days.forEach((d) => {
      const hol = holidays[d.dayIndex];
      if (hol && hol.is_enabled) {
        r.push(hol.label);
      } else {
        const key = `${emp.id}_${d.dateString}`;
        const hasAte = attendance[key];
        if (hasAte) {
          totalMeals++;
          r.push("✓");
        } else {
          r.push("");
        }
      }
    });
    r.push(String(totalMeals));
    rows.push(r);
  });

  rows.push([]);
  rows.push([
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    `Office record: Prepared by: ${period.prepared_by} | Verified by: ${period.verified_by || "Pending"} | Date: ${formatNepaliDate(period.end_date, "YYYY/MM/DD")} BS`,
  ]);

  const csvContent =
    "\uFEFF" +
    rows
      .map((row) =>
        row
          .map((cell) => {
            const str = String(cell ?? "");
            if (str.includes(",") || str.includes('"') || str.includes("\n")) {
              return `"${str.replaceAll('"', '""')}"`;
            }
            return str;
          })
          .join(","),
      )
      .join("\r\n");

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
