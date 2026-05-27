type EomProfileLike = {
  department?: string | null;
  position?: string | null;
  is_eom_eligible?: boolean | null;
};

function isExcludedRoleLabel(value?: string | null) {
  const label = (value || "").trim().toLowerCase();
  return (
    label === "hr" ||
    label.includes("human resources") ||
    label.includes("supervisor") ||
    label.startsWith("hr ")
  );
}

export function isEomEligible(profile: EomProfileLike) {
  if (profile.is_eom_eligible === false) return false;
  return !isExcludedRoleLabel(profile.department) && !isExcludedRoleLabel(profile.position);
}

export function eomEligibilityLabel(profile: EomProfileLike) {
  return isEomEligible(profile) ? "EOM Eligible" : "Excluded from EOM";
}
