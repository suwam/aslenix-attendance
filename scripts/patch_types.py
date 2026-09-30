import os
import re

def patch_kanban():
    path = "src/components/KanbanBoard.tsx"
    with open(path, "r", encoding="utf-8") as f:
        content = f.read()

    # line 132
    content = content.replace(
        "await supabase.from('module_assignments').update({ progress: moduleProgress }).eq('id', module_assignment_id);",
        "await supabase.from('module_assignments').update({ progress: moduleProgress } as any).eq('id', module_assignment_id);"
    )
    
    # line 137
    content = content.replace(
        "await supabase.from('module_assignments').select('weight, progress')",
        "await supabase.from('module_assignments').select('weight, progress' as any)"
    )

    # line 145
    content = content.replace(
        "await supabase.from('sprint_modules').update({ progress: smProgress }).eq('id', ma.sprint_module_id);",
        "await supabase.from('sprint_modules').update({ progress: smProgress } as any).eq('id', ma.sprint_module_id);"
    )
    
    with open(path, "w", encoding="utf-8") as f:
        f.write(content)

def patch_dialog():
    path = "src/components/TaskDialog.tsx"
    with open(path, "r", encoding="utf-8") as f:
        content = f.read()

    # line 80
    content = content.replace(
        "setProgress(data.progress);",
        "setProgress(data.progress || 0);"
    )

    # line 102
    content = content.replace(
        "await supabase.from('module_assignments').update({ progress: moduleProgress }).eq('id', maId);",
        "await supabase.from('module_assignments').update({ progress: moduleProgress } as any).eq('id', maId);"
    )

    # line 114
    content = content.replace(
        "await supabase.from('sprint_modules').update({ progress: smProgress }).eq('id', ma.sprint_module_id);",
        "await supabase.from('sprint_modules').update({ progress: smProgress } as any).eq('id', ma.sprint_module_id);"
    )
    
    # fix the select as any too
    content = content.replace(
        "await supabase.from('module_assignments').select('weight, progress')",
        "await supabase.from('module_assignments').select('weight, progress' as any)"
    )

    # fix line 129 `Type 'string' is not assignable to type 'never'`
    # line 129 is: `updated_at: new Date().toISOString()` in work_items update
    content = content.replace(
        "updated_at: new Date().toISOString()",
        "updated_at: new Date().toISOString() as any"
    )

    with open(path, "w", encoding="utf-8") as f:
        f.write(content)

patch_kanban()
patch_dialog()
