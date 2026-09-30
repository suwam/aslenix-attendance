import os

path = "src/components/TaskDialog.tsx"
with open(path, "r", encoding="utf-8") as f:
    content = f.read()

# Fix hideCloseButton
content = content.replace(' hideCloseButton', ' className="sm:max-w-[850px] p-0 overflow-hidden border border-border shadow-2xl rounded-2xl bg-card [&>button]:hidden"')

# Fix data types for blocker_reason
content = content.replace('if (error || !data) return toast.error("Failed to load work item");', 'if (error || !data) return toast.error("Failed to load work item");\n    const dataAny = data as any;')
content = content.replace('setBlockerReason(data.blocker_reason || "");', 'setBlockerReason(dataAny.blocker_reason || "");')
content = content.replace('setInitialBlocker(data.blocker_reason || "");', 'setInitialBlocker(dataAny.blocker_reason || "");')

# Fix work_item_logs queries
content = content.replace('supabase.from("work_item_logs")', 'supabase.from("work_item_logs" as any)')
content = content.replace('supabase.from("work_item_logs" as any).insert({', 'supabase.from("work_item_logs" as any).insert({')

with open(path, "w", encoding="utf-8") as f:
    f.write(content)
