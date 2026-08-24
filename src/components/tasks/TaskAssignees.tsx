import { useState, useMemo } from "react";
import { Label } from "@/components/ui/label";
import { X, UserPlus, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export interface UserOption {
  user_id: string;
  full_name: string;
  avatar_url?: string | null;
  role: string;
}

interface TaskAssigneesProps {
  label: string;
  options: UserOption[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  disabled?: boolean;
  maxSelections?: number;
  icon?: React.ReactNode;
}

export function TaskAssignees({
  label,
  options,
  selectedIds,
  onChange,
  disabled = false,
  maxSelections,
  icon = <Users size={16} className="text-primary" />,
}: TaskAssigneesProps) {
  const [open, setOpen] = useState(false);

  const selectedUsers = useMemo(() => {
    return selectedIds
      .map((id) => options.find((o) => o.user_id === id))
      .filter((u): u is UserOption => Boolean(u));
  }, [options, selectedIds]);

  const toggleSelection = (userId: string) => {
    if (disabled) return;
    if (selectedIds.includes(userId)) {
      onChange(selectedIds.filter((id) => id !== userId));
    } else {
      if (maxSelections && selectedIds.length >= maxSelections) return;
      onChange([...selectedIds, userId]);
    }
  };

  const removeSelection = (e: React.MouseEvent, userId: string) => {
    e.stopPropagation();
    if (disabled) return;
    onChange(selectedIds.filter((id) => id !== userId));
  };

  return (
    <div className="flex flex-col gap-2">
      <Label className="flex items-center gap-2 text-sm font-semibold">
        {icon}
        {label}
      </Label>

      <div className="flex flex-wrap gap-2">
        {selectedUsers.map((user) => (
          <div
            key={user.user_id}
            className="flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 pl-1 pr-3 py-1 text-sm shadow-sm transition-all duration-300 hover:bg-primary/15 hover:border-primary/40"
          >
            <Avatar className="h-6 w-6 border border-primary/20">
              <AvatarImage src={user.avatar_url || ""} />
              <AvatarFallback className="text-[10px]">
                {user.full_name.substring(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <span className="max-w-[120px] truncate font-medium">{user.full_name}</span>
            {!disabled && (
              <button
                type="button"
                onClick={(e) => removeSelection(e, user.user_id)}
                className="ml-1 rounded-full p-0.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
              >
                <X size={14} />
              </button>
            )}
          </div>
        ))}

        {!disabled && (!maxSelections || selectedIds.length < maxSelections) && (
          <DropdownMenu open={open} onOpenChange={setOpen}>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="h-8 rounded-full border-dashed border-primary/30 text-primary hover:bg-primary/10 px-3 text-xs"
              >
                <UserPlus size={14} className="mr-1.5" />
                Add
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-[200px] max-h-60 overflow-y-auto">
              {options.length === 0 ? (
                <div className="p-2 text-center text-xs text-muted-foreground">
                  No users available
                </div>
              ) : (
                options.map((user) => (
                  <DropdownMenuCheckboxItem
                    key={user.user_id}
                    checked={selectedIds.includes(user.user_id)}
                    onCheckedChange={() => toggleSelection(user.user_id)}
                    className="flex items-center gap-2"
                  >
                    <Avatar className="h-5 w-5 mr-1">
                      <AvatarImage src={user.avatar_url || ""} />
                      <AvatarFallback className="text-[8px]">
                        {user.full_name.substring(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <span className="truncate">{user.full_name}</span>
                  </DropdownMenuCheckboxItem>
                ))
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </div>
  );
}
