import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { KanbanBoard } from "@/components/KanbanBoard";
import { TaskDialog } from "@/components/TaskDialog";

export const Route = createFileRoute("/_app/tasks")({ component: TasksPage });

function TasksPage() {
  const [open, setOpen] = useState(false);
  const [refresh, setRefresh] = useState(0);
  return (
    <>
      <PageHeader
        title="My Tasks"
        subtitle="Plan, track, and ship your daily work"
        actions={
          <Button onClick={() => setOpen(true)} className="neon-button rounded-xl">
            <Plus size={16} className="mr-1.5" /> New task
          </Button>
        }
      />
      <KanbanBoard key={refresh} scope="mine" />
      <TaskDialog open={open} onOpenChange={setOpen} onSaved={() => setRefresh((r) => r + 1)} />
    </>
  );
}
