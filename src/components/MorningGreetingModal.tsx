import { AslenixSmartGreetingModal } from "./AslenixSmartGreetingModal";

export interface MorningGreetingModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userName?: string;
  nepaliDate?: string;
  gregorianDate?: string;
  shiftName?: string;
  shiftTime?: string;
  isCheckedIn?: boolean;
  checkInTime?: string | null;
  onCheckIn?: () => void;
  isWeeklyOff?: boolean;
}

export function MorningGreetingModal({
  open,
  onOpenChange,
  userName = "Team Member",
  onCheckIn,
}: MorningGreetingModalProps) {
  return (
    <AslenixSmartGreetingModal
      open={open}
      onOpenChange={onOpenChange}
      mode="morning"
      employeeName={userName}
      onAction={onCheckIn}
    />
  );
}
