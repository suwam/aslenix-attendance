import { AslenixSmartGreetingModal } from "./AslenixSmartGreetingModal";

export interface MorningGreetingModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userName?: string;
  employeeId?: string;
  nepaliDate?: string;
  gregorianDate?: string;
  shiftName?: string;
  shiftTime?: string;
  isCheckedIn?: boolean;
  checkInTime?: string | null;
  isWeeklyOff?: boolean;
}

export function MorningGreetingModal({
  open,
  onOpenChange,
  userName = "Team Member",
  employeeId,
  isCheckedIn,
}: MorningGreetingModalProps) {
  return (
    <AslenixSmartGreetingModal
      open={open}
      onOpenChange={onOpenChange}
      mode="welcome"
      employeeName={userName}
      employeeId={employeeId}
      isCheckedIn={isCheckedIn}
    />
  );
}
