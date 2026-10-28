export const DEPARTMENTS = [
  "Frontend",
  "Backend",
  "Administrator",
  "Software Developer",
  "Digital Marketing",
  "HR",
] as const;

export type Department = (typeof DEPARTMENTS)[number];

export const DEPARTMENT_SHORT_CODES: Record<string, string> = {
  Frontend: "FE",
  Backend: "BE",
  Administrator: "ADM",
  "Software Developer": "SD",
  "Digital Marketing": "DM",
  HR: "HR",
};

export function getDepartmentShortCode(dept?: string | null): string {
  if (!dept) return "STAFF";
  if (DEPARTMENT_SHORT_CODES[dept]) return DEPARTMENT_SHORT_CODES[dept];
  const v = dept.toLowerCase().trim().replace(/[^a-z0-9\s/&-]/g, "");
  if (!v) return "STAFF";
  if (v.includes("software") || v === "sd") return "SD";
  if (v.includes("frontend") || v === "fe") return "FE";
  if (v.includes("backend") || v === "be") return "BE";
  if (v.includes("marketing") || v === "dm") return "DM";
  if (v.includes("human") || v === "hr") return "HR";
  if (v.includes("admin") || v === "adm") return "ADM";
  if (v.includes("ui") || v.includes("ux") || v.includes("design")) return "UIUX";
  if (v.includes("qa")) return "QA";
  const words = v.split(/\s+/).filter(Boolean);
  if (words.length > 1) {
    return words.map((w) => w[0].toUpperCase()).join("");
  }
  return v.length <= 4 ? v.toUpperCase() : v.slice(0, 3).toUpperCase();
}

export const DEPARTMENT_POSITIONS: Record<string, string[]> = {
  Frontend: [
    "UI/UX Designer",
    "UI/UX Developer",
    "Frontend Developer",
    "Senior Frontend Developer",
    "React Developer",
    "Web Designer",
  ],
  Backend: [
    "Backend Developer",
    "Senior Backend Developer",
    "Node.js Developer",
    "Python Developer",
    "API Engineer",
    "Database Administrator",
    "DevOps Engineer",
  ],
  Administrator: [
    "Administrator",
    "System Administrator",
    "Operations Manager",
    "Office Administrator",
    "IT Support Specialist",
  ],
  "Software Developer": [
    "Software Developer",
    "Software Engineer",
    "Full Stack Developer",
    "Mobile App Developer",
    "Flutter Developer",
    "QA Engineer",
  ],
  "Digital Marketing": [
    "Digital Marketing Specialist",
    "SEO Specialist",
    "Social Media Manager",
    "Content Strategist",
    "Marketing Executive",
    "Growth Marketer",
  ],
  HR: [
    "HR Manager",
    "HR Officer",
    "Talent Acquisition Specialist",
    "HR Specialist",
    "Recruiter",
  ],
};

export const ADMIN_DEPARTMENT_FILTERS = ["All", ...DEPARTMENTS] as const;
