import { AslenixSmartGreetingModal } from "./AslenixSmartGreetingModal";

export interface CheckoutGreetingModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userName?: string;
  employeeId?: string;
  checkInTime?: string | null;
  checkOutTime?: string | null;
  workHours?: number | string | null;
  isEarly?: boolean;
  earlyMinutes?: number;
  overtimeMinutes?: number;
  shiftName?: string;
  gregorianDate?: string;
  nepaliDate?: string;
}

export function CheckoutGreetingModal({
  open,
  onOpenChange,
  userName = "Team Member",
  employeeId,
}: CheckoutGreetingModalProps) {
  return (
    <AslenixSmartGreetingModal
      open={open}
      onOpenChange={onOpenChange}
      mode="goodbye"
      employeeName={userName}
      employeeId={employeeId}
    />
  );
}
