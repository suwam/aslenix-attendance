import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/PageHeader";
import { KanbanBoard } from "@/components/KanbanBoard";

export const Route = createFileRoute("/_app/tasks")({ component: TasksPage });

function TasksPage() {
  return (
    <>
      <PageHeader
        title="My Tasks"
        subtitle="Track assigned work and submit progress updates"
      />
      <KanbanBoard scope="mine" />
    </>
  );
}
