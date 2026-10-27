import React from "react";
import logoMarkUrl from "@/assets/aslenix-mark.png";
import {
  CanteenPeriod,
  CanteenEmployee,
  CanteenHoliday,
  DayInfo,
} from "@/lib/canteen";
import { formatNepaliDate } from "@/lib/nepali-calendar";

type CanteenLogSheetProps = {
  period: CanteenPeriod;
  employees: CanteenEmployee[];
  days: DayInfo[];
  holidays: Record<number, CanteenHoliday>;
  attendance: Record<string, boolean>; // key: `${empId}_${date}`
  onToggleAttendance: (employeeId: string, date: string, currentVal: boolean) => void;
  canEditEmployee: (employee: CanteenEmployee) => boolean;
  currentUserId?: string | null;
  currentUserName?: string | null;
  isAdmin: boolean;
  highlightEmployeeId?: string | null;
  showTotalColumn?: boolean;
};

export function CanteenLogSheet({
  period,
  employees,
  days,
  holidays,
  attendance,
  onToggleAttendance,
  canEditEmployee,
  isAdmin,
  highlightEmployeeId,
  showTotalColumn = true,
}: CanteenLogSheetProps) {
  const week1Days = days.slice(0, 7);
  const week2Days = days.slice(7, 14);

  // Formatted date range in Nepali BS e.g. "2083/07/09 – 2083/07/22 BS"
  const formattedDateRange = `${formatNepaliDate(period.start_date, "YYYY/MM/DD")} – ${formatNepaliDate(period.end_date, "YYYY/MM/DD")} BS`;

  return (
    <div
      id="canteen-log-sheet-container"
      className="w-full max-w-full overflow-x-auto bg-white p-3 sm:p-6 rounded-xl shadow-md border border-neutral-300 text-black print:p-0 print:border-none print:shadow-none [scrollbar-width:thin] [scrollbar-color:#94a3b8_#f1f5f9] transition-all"
      style={{ WebkitOverflowScrolling: "touch" }}
    >
      <div id="canteen-log-sheet" className="w-full min-w-[1020px] bg-white text-black p-1 sm:p-2 print:p-0 print:min-w-0">
        {/* =========================================================
            HEADER SECTION
            ========================================================= */}
        <div className="relative mb-3 flex items-center justify-between border-b-2 border-black pb-3">
          {/* Logo on Left */}
          <div className="flex items-center gap-2.5 w-48">
            <img
              src={logoMarkUrl}
              alt="ASLENIX Logo"
              className="h-12 w-12 object-contain"
            />
            <div className="flex flex-col leading-tight">
              <span className="font-extrabold tracking-wider text-base text-black">ASLENIX</span>
              <span className="text-[8px] font-bold tracking-[0.18em] text-neutral-700 uppercase">
                TECH &amp; SOLUTION
              </span>
            </div>
          </div>

          {/* Centered Company Title */}
          <div className="text-center flex-1">
            <h1 className="text-2xl font-black uppercase tracking-wide text-black sm:text-3xl">
              ASLENIX TECH AND SOLUTION
            </h1>
            <p className="text-base font-bold text-neutral-800 mt-0.5">
              (Canteen Log Sheet)
            </p>
          </div>

          {/* Right Spacer for balance */}
          <div className="w-48 text-right text-xs text-neutral-500 print:text-[10px]">
            {period.is_locked ? (
              <span className="inline-flex items-center rounded border border-red-600 bg-red-50 px-2 py-0.5 font-bold text-red-700">
                🔒 LOCKED
              </span>
            ) : (
              <span className="inline-flex items-center rounded border border-emerald-600 bg-emerald-50 px-2 py-0.5 font-bold text-emerald-700">
                ● ACTIVE
              </span>
            )}
          </div>
        </div>

        {/* =========================================================
            HEADER INFORMATION ROW
            ========================================================= */}
        <div className="mb-2 flex items-center justify-between text-xs sm:text-sm font-semibold border-b border-black pb-2 px-1">
          {/* Left: Legend */}
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <span className="font-bold text-base leading-none">✓</span>
              <span>= Ate</span>
            </div>
            <div className="text-neutral-700">
              Blank = Did not eat
            </div>
          </div>

          {/* Center: Instruction */}
          <div className="text-center font-bold text-neutral-900 tracking-wide text-sm sm:text-base">
            Tick ✓ when you go to eat
          </div>

          {/* Right: Date Range (Displayed in Red) */}
          <div className="text-right font-bold text-red-600 text-sm sm:text-base tracking-wide">
            DATE = {formattedDateRange}
          </div>
        </div>

        {/* =========================================================
            ATTENDANCE SPREADSHEET TABLE
            ========================================================= */}
        <table
          className="w-full border-collapse border-2 border-black text-center text-xs sm:text-sm"
          style={{ tableLayout: "fixed" }}
        >
          {/* Column widths */}
          <colgroup>
            <col style={{ width: "42px" }} />
            <col style={{ width: "190px" }} />
            {/* Week 1: 7 days */}
            <col style={{ width: "52px" }} />
            <col style={{ width: "52px" }} />
            <col style={{ width: "52px" }} />
            <col style={{ width: "52px" }} />
            <col style={{ width: "52px" }} />
            <col style={{ width: "52px" }} />
            <col style={{ width: "56px" }} />
            {/* Week 2: 7 days */}
            <col style={{ width: "52px" }} />
            <col style={{ width: "52px" }} />
            <col style={{ width: "52px" }} />
            <col style={{ width: "52px" }} />
            <col style={{ width: "52px" }} />
            <col style={{ width: "52px" }} />
            <col style={{ width: "56px" }} />
            {showTotalColumn && <col style={{ width: "62px" }} />}
          </colgroup>

          {/* Header Rows */}
          <thead>
            {/* First Header Row */}
            <tr className="bg-neutral-100 font-bold border-b border-black">
              <th
                rowSpan={2}
                className="border border-black py-2 text-center text-xs font-black uppercase text-black sticky left-0 z-20 bg-neutral-100 print:static"
              >
                SN
              </th>
              <th
                rowSpan={2}
                className="border border-black px-3 py-2 text-left text-xs font-black uppercase text-black sticky left-[42px] z-20 bg-neutral-100 print:static shadow-[1px_0_0_0_#000]"
              >
                Name
              </th>
              <th
                colSpan={7}
                className="border border-black py-1.5 text-center text-xs sm:text-sm font-black uppercase tracking-wider text-black bg-neutral-200"
              >
                WEEK 1
              </th>
              <th
                colSpan={7}
                className="border border-black py-1.5 text-center text-xs sm:text-sm font-black uppercase tracking-wider text-black bg-neutral-200"
              >
                WEEK 2
              </th>
              {showTotalColumn && (
                <th
                  rowSpan={2}
                  className="border border-black py-2 text-center text-[11px] sm:text-xs font-black uppercase tracking-tight text-black bg-neutral-100"
                >
                  Total Meals
                </th>
              )}
            </tr>

            {/* Second Header Row */}
            <tr className="bg-neutral-50 font-bold border-b-2 border-black">
              {/* Week 1 Days */}
              {week1Days.map((d) => (
                <th
                  key={d.dayIndex}
                  className={`border border-black py-1 text-center font-bold ${
                    d.isSaturday
                      ? "text-[#ea580c] bg-orange-50 font-black"
                      : "text-black"
                  }`}
                >
                  <div className="text-xs uppercase leading-none">{d.dayName}</div>
                  <div className="text-[10px] font-normal text-neutral-600 mt-0.5">
                    {d.dayOfMonth}
                  </div>
                </th>
              ))}

              {/* Week 2 Days */}
              {week2Days.map((d) => (
                <th
                  key={d.dayIndex}
                  className={`border border-black py-1 text-center font-bold ${
                    d.isSaturday
                      ? "text-[#ea580c] bg-orange-50 font-black"
                      : "text-black"
                  }`}
                >
                  <div className="text-xs uppercase leading-none">{d.dayName}</div>
                  <div className="text-[10px] font-normal text-neutral-600 mt-0.5">
                    {d.dayOfMonth}
                  </div>
                </th>
              ))}
            </tr>
          </thead>

          {/* Body Rows */}
          <tbody>
            {employees.length === 0 ? (
              <tr>
                <td
                  colSpan={showTotalColumn ? 17 : 16}
                  className="border border-black py-8 text-center text-neutral-500 italic"
                >
                  No employees in roster. Add employees via the admin controls.
                </td>
              </tr>
            ) : (
              employees.map((emp, empIdx) => {
                const isHighlighted = highlightEmployeeId === emp.id;
                const canEdit = canEditEmployee(emp);

                // Compute total meals for this employee in this period
                let mealsCount = 0;
                days.forEach((d) => {
                  const hol = holidays[d.dayIndex];
                  if (!hol || !hol.is_enabled) {
                    if (attendance[`${emp.id}_${d.dateString}`]) {
                      mealsCount++;
                    }
                  }
                });

                return (
                  <tr
                    key={emp.id}
                    className={`border-b border-black transition-colors ${
                      isHighlighted
                        ? "bg-amber-100"
                        : empIdx % 2 === 1
                          ? "bg-neutral-50/60"
                          : "bg-white"
                    }`}
                    style={{ height: "38px" }}
                  >
                    {/* SN */}
                    <td
                      className={`border border-black text-center font-bold text-xs text-black sticky left-0 z-10 print:static ${
                        isHighlighted
                          ? "bg-amber-100"
                          : empIdx % 2 === 1
                            ? "bg-neutral-100"
                            : "bg-white"
                      }`}
                    >
                      {emp.serial_number}
                    </td>

                    {/* Employee Name */}
                    <td
                      className={`border border-black px-2.5 py-1 text-left font-medium text-xs sm:text-sm text-black truncate sticky left-[42px] z-10 print:static shadow-[1px_0_0_0_#000] ${
                        isHighlighted
                          ? "bg-amber-100"
                          : empIdx % 2 === 1
                            ? "bg-neutral-100"
                            : "bg-white"
                      }`}
                    >
                      <span>{emp.name}</span>
                      {canEdit && !isAdmin && (
                        <span className="ml-1.5 inline-block text-[10px] font-semibold text-neutral-500 print:hidden">
                          (You)
                        </span>
                      )}
                    </td>

                    {/* 14 Day Columns */}
                    {days.map((d) => {
                      const hol = holidays[d.dayIndex];
                      const isMerged = hol && hol.is_enabled;

                      if (isMerged) {
                        // Merged vertically across all employee rows on the first row
                        if (empIdx === 0) {
                          return (
                            <td
                              key={d.dayIndex}
                              rowSpan={employees.length}
                              className="border border-black text-center p-0 align-middle bg-neutral-100 select-none"
                              style={{
                                verticalAlign: "middle",
                                height: `${employees.length * 38}px`,
                              }}
                            >
                              <div
                                className="mx-auto flex items-center justify-center font-black tracking-[0.25em] text-red-600 text-xs sm:text-sm"
                                style={{
                                  writingMode: "vertical-rl",
                                  transform: "rotate(180deg)",
                                  textOrientation: "mixed",
                                  whiteSpace: "nowrap",
                                  fontWeight: 900,
                                }}
                              >
                                {hol.label}
                              </div>
                            </td>
                          );
                        }
                        // Omit cell in subsequent employee rows because of rowSpan
                        return null;
                      }

                      // Normal working day cell
                      const cellKey = `${emp.id}_${d.dateString}`;
                      const hasAte = Boolean(attendance[cellKey]);
                      const isCellEditable = canEdit && !period.is_locked;

                      return (
                        <td
                          key={d.dayIndex}
                          onClick={() => {
                            if (isCellEditable) {
                              onToggleAttendance(emp.id, d.dateString, hasAte);
                            }
                          }}
                          className={`border border-black p-0 text-center select-none transition-colors ${
                            isCellEditable
                              ? "cursor-pointer hover:bg-neutral-200/80 active:bg-neutral-300"
                              : "cursor-default"
                          } ${d.isSaturday ? "bg-orange-50/40" : ""}`}
                          title={
                            isCellEditable
                              ? `Click to toggle: ${emp.name} on ${d.displayDate} (${d.nepaliDateString} BS)`
                              : period.is_locked
                                ? "Period is locked"
                                : "Only this employee or an admin can mark attendance"
                          }
                        >
                          <div className="flex h-full w-full min-h-[36px] items-center justify-center">
                            {hasAte ? (
                              <span
                                className="font-black text-lg sm:text-xl text-black leading-none"
                                style={{ fontFamily: "Arial, sans-serif" }}
                              >
                                ✓
                              </span>
                            ) : null}
                          </div>
                        </td>
                      );
                    })}

                    {/* Total Meals Column */}
                    {showTotalColumn && (
                      <td className="border border-black text-center font-bold text-xs sm:text-sm text-black bg-neutral-100/70">
                        {mealsCount}
                      </td>
                    )}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>

        {/* =========================================================
            FOOTER SECTION
            ========================================================= */}
        <div className="mt-4 flex flex-col sm:flex-row items-end justify-end text-xs font-semibold text-black gap-2 pt-2 px-1">
          <div className="text-right space-y-1">
            <div>
              <span className="font-bold">Office record:</span> Prepared by:{" "}
              <span className="font-bold underline decoration-neutral-400 underline-offset-2">
                {period.prepared_by}
              </span>
            </div>
            <div>
              Verified by:{" "}
              <span className="font-mono">
                {period.verified_by ? period.verified_by : "________________________"}
              </span>
              &nbsp;&nbsp;&nbsp;&nbsp;
              Date:{" "}
              <span className="font-bold text-neutral-800">
                [{formatNepaliDate(period.end_date, "YYYY/MM/DD")} BS]
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
