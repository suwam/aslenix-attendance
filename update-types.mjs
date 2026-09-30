import fs from 'fs';

const typesPath = 'src/integrations/supabase/types.ts';
let content = fs.readFileSync(typesPath, 'utf8');

const newTables = `
      module_assignments: {
        Row: {
          created_at: string | null
          id: string
          role: string
          sprint_module_id: string | null
          user_id: string | null
          weight: number | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          role: string
          sprint_module_id?: string | null
          user_id?: string | null
          weight?: number | null
        }
        Update: {
          created_at?: string | null
          id?: string
          role?: string
          sprint_module_id?: string | null
          user_id?: string | null
          weight?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "module_assignments_sprint_module_id_fkey"
            columns: ["sprint_module_id"]
            isOneToOne: false
            referencedRelation: "sprint_modules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "module_assignments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          }
        ]
      }
      modules: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          name: string
          project_id: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          name: string
          project_id?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          name?: string
          project_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "modules_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          }
        ]
      }
      sprint_modules: {
        Row: {
          created_at: string | null
          id: string
          module_id: string | null
          priority: string | null
          sprint_id: string | null
          target_date: string | null
          team_id: string | null
          weight: number | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          module_id?: string | null
          priority?: string | null
          sprint_id?: string | null
          target_date?: string | null
          team_id?: string | null
          weight?: number | null
        }
        Update: {
          created_at?: string | null
          id?: string
          module_id?: string | null
          priority?: string | null
          sprint_id?: string | null
          target_date?: string | null
          team_id?: string | null
          weight?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "sprint_modules_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "modules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sprint_modules_sprint_id_fkey"
            columns: ["sprint_id"]
            isOneToOne: false
            referencedRelation: "weekly_sprints"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sprint_modules_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "sprint_teams"
            referencedColumns: ["id"]
          }
        ]
      }
      sprint_team_members: {
        Row: {
          created_at: string | null
          id: string
          role: string
          team_id: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          role: string
          team_id?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          role?: string
          team_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sprint_team_members_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "sprint_teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sprint_team_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          }
        ]
      }
      sprint_teams: {
        Row: {
          created_at: string | null
          id: string
          name: string
          sprint_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          name: string
          sprint_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
          sprint_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sprint_teams_sprint_id_fkey"
            columns: ["sprint_id"]
            isOneToOne: false
            referencedRelation: "weekly_sprints"
            referencedColumns: ["id"]
          }
        ]
      }
      target_requirements: {
        Row: {
          completion_condition: string | null
          created_at: string | null
          id: string
          module_assignment_id: string | null
          target_id: string | null
        }
        Insert: {
          completion_condition?: string | null
          created_at?: string | null
          id?: string
          module_assignment_id?: string | null
          target_id?: string | null
        }
        Update: {
          completion_condition?: string | null
          created_at?: string | null
          id?: string
          module_assignment_id?: string | null
          target_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "target_requirements_module_assignment_id_fkey"
            columns: ["module_assignment_id"]
            isOneToOne: false
            referencedRelation: "module_assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "target_requirements_target_id_fkey"
            columns: ["target_id"]
            isOneToOne: false
            referencedRelation: "weekly_targets"
            referencedColumns: ["id"]
          }
        ]
      }
      weekly_sprints: {
        Row: {
          created_at: string | null
          end_date: string | null
          id: string
          project_id: string | null
          sprint_goal: string | null
          start_date: string | null
          target_date: string | null
          week_number: number | null
        }
        Insert: {
          created_at?: string | null
          end_date?: string | null
          id?: string
          project_id?: string | null
          sprint_goal?: string | null
          start_date?: string | null
          target_date?: string | null
          week_number?: number | null
        }
        Update: {
          created_at?: string | null
          end_date?: string | null
          id?: string
          project_id?: string | null
          sprint_goal?: string | null
          start_date?: string | null
          target_date?: string | null
          week_number?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "weekly_sprints_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          }
        ]
      }
      weekly_targets: {
        Row: {
          created_at: string | null
          id: string
          name: string
          sprint_id: string | null
          status: string | null
          target_date: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          name: string
          sprint_id?: string | null
          status?: string | null
          target_date?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
          sprint_id?: string | null
          status?: string | null
          target_date?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "weekly_targets_sprint_id_fkey"
            columns: ["sprint_id"]
            isOneToOne: false
            referencedRelation: "weekly_sprints"
            referencedColumns: ["id"]
          }
        ]
      }
      work_items: {
        Row: {
          created_at: string | null
          description: string | null
          due_date: string | null
          id: string
          module_assignment_id: string | null
          notes: string | null
          priority: string | null
          progress: number | null
          review_status: string | null
          status: string | null
          title: string
          weight: number | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          module_assignment_id?: string | null
          notes?: string | null
          priority?: string | null
          progress?: number | null
          review_status?: string | null
          status?: string | null
          title: string
          weight?: number | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          module_assignment_id?: string | null
          notes?: string | null
          priority?: string | null
          progress?: number | null
          review_status?: string | null
          status?: string | null
          title?: string
          weight?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "work_items_module_assignment_id_fkey"
            columns: ["module_assignment_id"]
            isOneToOne: false
            referencedRelation: "module_assignments"
            referencedColumns: ["id"]
          }
        ]
      }
`;

const searchStr = '  public: {\n    Tables: {';
if (!content.includes('weekly_sprints: {')) {
  if (content.includes(searchStr)) {
    content = content.replace(searchStr, searchStr + '\n' + newTables);
    fs.writeFileSync(typesPath, content, 'utf8');
    console.log('Types updated.');
  } else {
    console.log('Could not find public: { Tables: {');
  }
} else {
  console.log('Types already updated.');
}
