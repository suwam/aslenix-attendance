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
// OKLCH -> sRGB CONVERTER & CSS SANITIZER FOR HTML2CANVAS
// -------------------------------------------------------------
function oklchToRgb(l: number, c: number, h: number, a = 1): string {
  const hr = (h * Math.PI) / 180;
  const a_ = c * Math.cos(hr);
  const b_ = c * Math.sin(hr);

  const l_ = l + 0.3963377774 * a_ + 0.2158037573 * b_;
  const m_ = l - 0.1055613458 * a_ - 0.0638541728 * b_;
  const s_ = l - 0.0894841775 * a_ - 1.291485548 * b_;

  const L = l_ * l_ * l_;
  const M = m_ * m_ * m_;
  const S = s_ * s_ * s_;

  const r = +4.0767416621 * L - 3.3077115913 * M + 0.2309699292 * S;
  const g = -1.2684380046 * L + 2.6097574011 * M - 0.3413193965 * S;
  const b = -0.0041960863 * L - 0.7034186147 * M + 1.707614701 * S;

  const toSRGB = (val: number) => {
    const clamped = Math.max(0, Math.min(1, val));
    return clamped <= 0.0031308
      ? 12.92 * clamped
      : 1.055 * Math.pow(clamped, 1 / 2.4) - 0.055;
  };

  const R = Math.round(toSRGB(r) * 255);
  const G = Math.round(toSRGB(g) * 255);
  const B = Math.round(toSRGB(b) * 255);

  return a < 1 ? `rgba(${R}, ${G}, ${B}, ${a})` : `rgb(${R}, ${G}, ${B})`;
}

function parseOklchMatch(str: string): string {
  try {
    const inner = str.replace(/^oklch\(/i, "").replace(/\)$/, "").trim();
    const [colorPart, alphaPart] = inner.split("/");
    const parts = colorPart.trim().split(/\s*,\s*|\s+/);
    if (parts.length < 3) return "rgb(0, 0, 0)";

    let l = parseFloat(parts[0]);
    if (parts[0].includes("%")) l = l / 100;
    if (isNaN(l)) l = 0;

    let c = parseFloat(parts[1]);
    if (parts[1].includes("%")) c = (c / 100) * 0.4;
    if (isNaN(c)) c = 0;

    const hStr = parts[2].toLowerCase();
    let h = parseFloat(hStr);
    if (hStr.includes("rad")) h = h * (180 / Math.PI);
    else if (hStr.includes("turn")) h = h * 360;
    if (isNaN(h)) h = 0;

    let a = 1;
    if (alphaPart) {
      const aVal = alphaPart.trim();
      a = parseFloat(aVal);
      if (aVal.includes("%")) a = a / 100;
      if (isNaN(a)) a = 1;
    }

    return oklchToRgb(l, c, h, a);
  } catch {
    return "rgb(0, 0, 0)";
  }
}

export function replaceOklchInString(str: string): string {
  if (!str || !str.includes("oklch")) return str;
  return str.replace(/oklch\([^)]+\)/gi, (match) => parseOklchMatch(match));
}

// -------------------------------------------------------------
// PDF EXPORT (A4 LANDSCAPE ORIENTATION)
// -------------------------------------------------------------
export async function exportCanteenSheetToPDF(elementId: string, filename = "Canteen_Log_Sheet.pdf") {
  const el = document.getElementById(elementId);
  if (!el) throw new Error("Sheet element not found");

  // Intercept getComputedStyle to safely prevent html2canvas crashing on CSS Color 4 "oklch"
  const originalGetComputedStyle = window.getComputedStyle;
  const proxyCache = new WeakMap<CSSStyleDeclaration, CSSStyleDeclaration>();

  window.getComputedStyle = function (elt: Element, pseudoElt?: string | null) {
    const originalDecl = originalGetComputedStyle.call(window, elt, pseudoElt);
    if (proxyCache.has(originalDecl)) {
      return proxyCache.get(originalDecl)!;
    }
    const proxy = new Proxy(originalDecl, {
      get(target, prop, receiver) {
        const val = Reflect.get(target, prop, receiver);
        if (typeof val === "string" && val.includes("oklch")) {
          return replaceOklchInString(val);
        }
        return typeof val === "function" ? val.bind(target) : val;
      },
    });
    proxyCache.set(originalDecl, proxy);
    return proxy;
  };

  try {
    const canvas = await html2canvas(el, {
      scale: 2,
      useCORS: true,
      backgroundColor: "#ffffff",
      logging: false,
      windowWidth: 1400,
      onclone: (clonedDoc: Document) => {
        // Also wrap cloned iframe's getComputedStyle if it has defaultView
        if (clonedDoc.defaultView) {
          const cloneGetComputedStyle = clonedDoc.defaultView.getComputedStyle;
          const cloneProxyCache = new WeakMap<CSSStyleDeclaration, CSSStyleDeclaration>();
          clonedDoc.defaultView.getComputedStyle = function (elt: Element, pseudoElt?: string | null) {
            const originalDecl = cloneGetComputedStyle.call(clonedDoc.defaultView, elt, pseudoElt);
            if (cloneProxyCache.has(originalDecl)) {
              return cloneProxyCache.get(originalDecl)!;
            }
            const proxy = new Proxy(originalDecl, {
              get(target, prop, receiver) {
                const val = Reflect.get(target, prop, receiver);
                if (typeof val === "string" && val.includes("oklch")) {
                  return replaceOklchInString(val);
                }
                return typeof val === "function" ? val.bind(target) : val;
              },
            });
            cloneProxyCache.set(originalDecl, proxy);
            return proxy;
          };
        }

        // Replace all oklch in cloned document's <style> tags
        clonedDoc.querySelectorAll("style").forEach((styleTag) => {
          if (styleTag.textContent && styleTag.textContent.includes("oklch")) {
            styleTag.textContent = replaceOklchInString(styleTag.textContent);
          }
        });

        // Replace any inline oklch declarations on elements
        clonedDoc.querySelectorAll("[style*='oklch']").forEach((element) => {
          const styleAttr = element.getAttribute("style");
          if (styleAttr) {
            element.setAttribute("style", replaceOklchInString(styleAttr));
          }
        });

        // Ensure background is pure clean white
        clonedDoc.documentElement.style.backgroundColor = "#ffffff";
        clonedDoc.documentElement.style.color = "#000000";
        if (clonedDoc.body) {
          clonedDoc.body.style.backgroundColor = "#ffffff";
          clonedDoc.body.style.color = "#000000";
        }

        // Hide interactive touch prompts ("Tap" buttons, "(You)" badges) for official print/PDF export
        clonedDoc.querySelectorAll(".print\\:hidden").forEach((node) => {
          (node as HTMLElement).style.display = "none";
        });

        // Format sheet to full wide landscape layout (1320px) so all 17+ columns fit with crisp padding
        const clonedSheet = clonedDoc.getElementById(elementId);
        if (clonedSheet) {
          clonedSheet.style.width = "1320px";
          clonedSheet.style.minWidth = "1320px";
          clonedSheet.style.maxWidth = "1320px";
          clonedSheet.style.overflow = "visible";
          clonedSheet.style.backgroundColor = "#ffffff";
          clonedSheet.style.color = "#000000";
          clonedSheet.style.padding = "16px";
          clonedSheet.style.boxSizing = "border-box";
        }

        const clonedContainer = clonedDoc.getElementById("canteen-log-sheet-container");
        if (clonedContainer) {
          clonedContainer.style.width = "1320px";
          clonedContainer.style.minWidth = "1320px";
          clonedContainer.style.maxWidth = "1320px";
          clonedContainer.style.overflow = "visible";
          clonedContainer.style.padding = "0";
          clonedContainer.style.margin = "0";
          clonedContainer.style.border = "none";
          clonedContainer.style.boxShadow = "none";
          clonedContainer.style.backgroundColor = "#ffffff";
        }
      },
    });

    const imgData = canvas.toDataURL("image/png");

    // Standard A4 Landscape is 297mm (width) x 210mm (height)
    const pdf = new jsPDF({
      orientation: "landscape",
      unit: "mm",
      format: "a4",
    });

    const pageWidth = pdf.internal.pageSize.getWidth(); // 297 mm
    const pageHeight = pdf.internal.pageSize.getHeight(); // 210 mm
    const margin = 8; // 8 mm margin on each side
    const maxWidth = pageWidth - margin * 2; // 281 mm printable width
    const maxHeight = pageHeight - margin * 2; // 194 mm printable height

    let imgWidth = maxWidth;
    let imgHeight = (canvas.height * imgWidth) / canvas.width;

    // If height exceeds printable area, scale proportionally to fit cleanly on single A4 landscape page
    if (imgHeight > maxHeight) {
      imgHeight = maxHeight;
      imgWidth = (canvas.width * imgHeight) / canvas.height;
    }

    // Center horizontally and vertically within the landscape sheet
    const x = (pageWidth - imgWidth) / 2;
    const y = (pageHeight - imgHeight) / 2;

    pdf.addImage(imgData, "PNG", x, y, imgWidth, imgHeight, undefined, "FAST");
    pdf.save(filename);
  } finally {
    // Restore original getComputedStyle
    window.getComputedStyle = originalGetComputedStyle;
  }
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
