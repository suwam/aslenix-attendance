import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Database } from "@/integrations/supabase/types";

export type TaskAssignmentStatus = Database["public"]["Enums"]["task_assignment_status"];

export interface WorkAssignmentData {
  id?: string;
  user_id: string;
  responsibility: string;
  status: TaskAssignmentStatus;
  due_date: string | null;
  notes: string | null;
}

interface UserOption {
  user_id: string;
  full_name: string;
}

interface WorkAssignmentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (data: WorkAssignmentData) => void;
  initialData?: WorkAssignmentData | null;
  employees: UserOption[];
  existingResponsibilities: string[];
}

export function WorkAssignmentModal({
  open,
  onOpenChange,
  onSave,
  initialData,
  employees,
  existingResponsibilities,
}: WorkAssignmentModalProps) {
  const [userId, setUserId] = useState<string>("");
  const [responsibility, setResponsibility] = useState("");
  const [status, setStatus] = useState<TaskAssignmentStatus>("not_started");
  const [dueDate, setDueDate] = useState<string>("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      if (initialData) {
        setUserId(initialData.user_id);
        setResponsibility(initialData.responsibility);
        setStatus(initialData.status);
        setDueDate(initialData.due_date || "");
        setNotes(initialData.notes || "");
      } else {
        setUserId("");
        setResponsibility("");
        setStatus("not_started");
        setDueDate("");
        setNotes("");
      }
      setError("");
    }
  }, [open, initialData]);

  const handleSave = () => {
    if (!userId) {
      setError("Please select an employee.");
      return;
    }
    if (!responsibility.trim()) {
      setError("Responsibility is required.");
      return;
    }
    const cleanResponsibility = responsibility.trim();
    if (
      (!initialData || initialData.responsibility.toLowerCase() !== cleanResponsibility.toLowerCase()) &&
      existingResponsibilities.some((r) => r.toLowerCase() === cleanResponsibility.toLowerCase())
    ) {
      setError("This responsibility is already assigned within this task.");
      return;
    }

    onSave({
      id: initialData?.id,
      user_id: userId,
      responsibility: cleanResponsibility,
      status,
      due_date: dueDate || null,
      notes: notes.trim() || null,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{initialData ? "Edit Work Assignment" : "Add Work Assignment"}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label>Employee</Label>
            <Select value={userId} onValueChange={setUserId}>
              <SelectTrigger>
                <SelectValue placeholder="Select employee" />
              </SelectTrigger>
              <SelectContent>
                {employees.map((emp) => (
                  <SelectItem key={emp.user_id} value={emp.user_id}>
                    {emp.full_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label>Responsibility</Label>
            <Input
              value={responsibility}
              onChange={(e) => setResponsibility(e.target.value)}
              placeholder="e.g. Frontend Dashboard Development"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label>Status</Label>
              <Select value={status} onValueChange={(val: TaskAssignmentStatus) => setStatus(val)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="not_started">Not Started</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="under_review">Under Review</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="blocked">Blocked</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Due Date</Label>
              <Input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>
          </div>
          <div className="grid gap-2">
            <Label>Notes (Optional)</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any specific notes or deliverables..."
              className="resize-none"
              rows={3}
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} className="neon-button">Save Assignment</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
