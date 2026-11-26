import { ShieldAlert } from "lucide-react";

export function AccessDenied() {
  return (
    <main className="flex min-h-[65vh] items-center justify-center px-4">
      <section className="max-w-md rounded-3xl border border-border bg-card p-8 text-center shadow-xl">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
          <ShieldAlert size={28} />
        </div>
        <h1 className="mt-5 text-xl font-semibold">Access denied</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Your account does not have permission to open this area. Contact a Super Admin if you need access.
        </p>
      </section>
    </main>
  );
}
