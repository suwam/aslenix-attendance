export const DEPARTMENTS = [
  "Frontend",
  "Backend",
  "Administrator",
  "Software Developer",
  "Digital Marketing",
  "HR",
] as const;

export type Department = (typeof DEPARTMENTS)[number];

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
