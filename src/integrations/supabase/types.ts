export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  public: {
    Tables: {
      activity_logs: {
        Row: {
          action: string;
          created_at: string;
          details: Json | null;
          id: string;
          user_id: string | null;
        };
        Insert: {
          action: string;
          created_at?: string;
          details?: Json | null;
          id?: string;
          user_id?: string | null;
        };
        Update: {
          action?: string;
          created_at?: string;
          details?: Json | null;
          id?: string;
          user_id?: string | null;
        };
        Relationships: [];
      };
      attendance: {
        Row: {
          check_in_time: string | null;
          check_out_time: string | null;
          created_at: string;
          date: string;
          id: string;
          is_late: boolean;
          remarks: string | null;
          status: Database["public"]["Enums"]["attendance_status"];
          user_id: string;
          work_hours: number | null;
        };
        Insert: {
          check_in_time?: string | null;
          check_out_time?: string | null;
          created_at?: string;
          date: string;
          id?: string;
          is_late?: boolean;
          remarks?: string | null;
          status?: Database["public"]["Enums"]["attendance_status"];
          user_id: string;
          work_hours?: number | null;
        };
        Update: {
          check_in_time?: string | null;
          check_out_time?: string | null;
          created_at?: string;
          date?: string;
          id?: string;
          is_late?: boolean;
          remarks?: string | null;
          status?: Database["public"]["Enums"]["attendance_status"];
          user_id?: string;
          work_hours?: number | null;
        };
        Relationships: [];
      };
      leave_requests: {
        Row: {
          admin_comment: string | null;
          created_at: string;
          end_date: string;
          id: string;
          leave_type: Database["public"]["Enums"]["leave_type"];
          reason: string | null;
          reviewed_by: string | null;
          start_date: string;
          status: Database["public"]["Enums"]["leave_status"];
          updated_at: string;
          user_id: string;
        };
        Insert: {
          admin_comment?: string | null;
          created_at?: string;
          end_date: string;
          id?: string;
          leave_type: Database["public"]["Enums"]["leave_type"];
          reason?: string | null;
          reviewed_by?: string | null;
          start_date: string;
          status?: Database["public"]["Enums"]["leave_status"];
          updated_at?: string;
          user_id: string;
        };
        Update: {
          admin_comment?: string | null;
          created_at?: string;
          end_date?: string;
          id?: string;
          leave_type?: Database["public"]["Enums"]["leave_type"];
          reason?: string | null;
          reviewed_by?: string | null;
          start_date?: string;
          status?: Database["public"]["Enums"]["leave_status"];
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      notifications: {
        Row: {
          created_at: string;
          id: string;
          is_read: boolean;
          message: string;
          title: string;
          type: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          is_read?: boolean;
          message: string;
          title: string;
          type?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          is_read?: boolean;
          message?: string;
          title?: string;
          type?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          address: string | null;
          approval_status: Database["public"]["Enums"]["approval_status"];
          avatar_url: string | null;
          blood_group: string | null;
          created_at: string;
          department: string | null;
          email: string;
          emergency_contact: string | null;
          employee_code: string | null;
          full_name: string;
          id: string;
          is_suspended: boolean;
          joining_date: string | null;
          phone: string | null;
          position: string | null;
          qr_generated_at: string | null;
          qr_status: Database["public"]["Enums"]["qr_status"];
          qr_token: string | null;
          salary: number | null;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          address?: string | null;
          approval_status?: Database["public"]["Enums"]["approval_status"];
          avatar_url?: string | null;
          blood_group?: string | null;
          created_at?: string;
          department?: string | null;
          email: string;
          emergency_contact?: string | null;
          employee_code?: string | null;
          full_name: string;
          id?: string;
          is_suspended?: boolean;
          joining_date?: string | null;
          phone?: string | null;
          position?: string | null;
          qr_generated_at?: string | null;
          qr_status?: Database["public"]["Enums"]["qr_status"];
          qr_token?: string | null;
          salary?: number | null;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          address?: string | null;
          approval_status?: Database["public"]["Enums"]["approval_status"];
          avatar_url?: string | null;
          blood_group?: string | null;
          created_at?: string;
          department?: string | null;
          email?: string;
          emergency_contact?: string | null;
          employee_code?: string | null;
          full_name?: string;
          id?: string;
          is_suspended?: boolean;
          joining_date?: string | null;
          phone?: string | null;
          position?: string | null;
          qr_generated_at?: string | null;
          qr_status?: Database["public"]["Enums"]["qr_status"];
          qr_token?: string | null;
          salary?: number | null;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      settings: {
        Row: {
          company_logo: string | null;
          company_name: string;
          id: string;
          late_after_time: string;
          office_end_time: string;
          office_start_time: string;
          updated_at: string;
        };
        Insert: {
          company_logo?: string | null;
          company_name?: string;
          id?: string;
          late_after_time?: string;
          office_end_time?: string;
          office_start_time?: string;
          updated_at?: string;
        };
        Update: {
          company_logo?: string | null;
          company_name?: string;
          id?: string;
          late_after_time?: string;
          office_end_time?: string;
          office_start_time?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      standups: {
        Row: {
          blockers: string | null;
          created_at: string;
          date: string;
          id: string;
          today: string | null;
          updated_at: string;
          user_id: string;
          work_hours: number | null;
          yesterday: string | null;
        };
        Insert: {
          blockers?: string | null;
          created_at?: string;
          date?: string;
          id?: string;
          today?: string | null;
          updated_at?: string;
          user_id: string;
          work_hours?: number | null;
          yesterday?: string | null;
        };
        Update: {
          blockers?: string | null;
          created_at?: string;
          date?: string;
          id?: string;
          today?: string | null;
          updated_at?: string;
          user_id?: string;
          work_hours?: number | null;
          yesterday?: string | null;
        };
        Relationships: [];
      };
      task_assignees: {
        Row: {
          assigned_at: string;
          task_id: string;
          user_id: string;
        };
        Insert: {
          assigned_at?: string;
          task_id: string;
          user_id: string;
        };
        Update: {
          assigned_at?: string;
          task_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "task_assignees_task_id_fkey";
            columns: ["task_id"];
            isOneToOne: false;
            referencedRelation: "tasks";
            referencedColumns: ["id"];
          },
        ];
      };
      task_attachments: {
        Row: {
          created_at: string;
          file_name: string;
          file_path: string;
          file_size: number | null;
          id: string;
          mime_type: string | null;
          task_id: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          file_name: string;
          file_path: string;
          file_size?: number | null;
          id?: string;
          mime_type?: string | null;
          task_id: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          file_name?: string;
          file_path?: string;
          file_size?: number | null;
          id?: string;
          mime_type?: string | null;
          task_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "task_attachments_task_id_fkey";
            columns: ["task_id"];
            isOneToOne: false;
            referencedRelation: "tasks";
            referencedColumns: ["id"];
          },
        ];
      };
      task_comments: {
        Row: {
          comment: string;
          created_at: string;
          id: string;
          task_id: string;
          user_id: string;
        };
        Insert: {
          comment: string;
          created_at?: string;
          id?: string;
          task_id: string;
          user_id: string;
        };
        Update: {
          comment?: string;
          created_at?: string;
          id?: string;
          task_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "task_comments_task_id_fkey";
            columns: ["task_id"];
            isOneToOne: false;
            referencedRelation: "tasks";
            referencedColumns: ["id"];
          },
        ];
      };
      tasks: {
        Row: {
          assigned_to: string;
          completed_at: string | null;
          created_at: string;
          created_by: string;
          deadline: string | null;
          description: string | null;
          id: string;
          priority: Database["public"]["Enums"]["task_priority"];
          progress: number;
          status: Database["public"]["Enums"]["task_status"];
          tags: string[] | null;
          title: string;
          updated_at: string;
        };
        Insert: {
          assigned_to: string;
          completed_at?: string | null;
          created_at?: string;
          created_by: string;
          deadline?: string | null;
          description?: string | null;
          id?: string;
          priority?: Database["public"]["Enums"]["task_priority"];
          progress?: number;
          status?: Database["public"]["Enums"]["task_status"];
          tags?: string[] | null;
          title: string;
          updated_at?: string;
        };
        Update: {
          assigned_to?: string;
          completed_at?: string | null;
          created_at?: string;
          created_by?: string;
          deadline?: string | null;
          description?: string | null;
          id?: string;
          priority?: Database["public"]["Enums"]["task_priority"];
          progress?: number;
          status?: Database["public"]["Enums"]["task_status"];
          tags?: string[] | null;
          title?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      user_roles: {
        Row: {
          created_at: string;
          id: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          role?: Database["public"]["Enums"]["app_role"];
          user_id?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"];
          _user_id: string;
        };
        Returns: boolean;
      };
      is_admin: { Args: { _user_id: string }; Returns: boolean };
      verify_employee_qr: {
        Args: { _token: string };
        Returns: {
          approval_status: Database["public"]["Enums"]["approval_status"];
          avatar_url: string;
          department: string;
          employee_code: string;
          full_name: string;
          is_valid: boolean;
          job_position: string;
          joining_date: string;
          qr_generated_at: string;
          qr_status: Database["public"]["Enums"]["qr_status"];
          role: Database["public"]["Enums"]["app_role"];
        }[];
      };
    };
    Enums: {
      app_role: "super_admin" | "admin" | "hr_manager" | "employee" | "viewer";
      approval_status: "pending" | "approved" | "rejected" | "suspended";
      attendance_status: "present" | "late" | "absent" | "leave" | "half_day" | "wfh";
      leave_status: "pending" | "approved" | "rejected" | "cancelled";
      leave_type: "sick" | "casual" | "vacation" | "emergency" | "wfh";
      qr_status: "active" | "inactive" | "revoked";
      task_priority: "low" | "medium" | "high" | "urgent";
      task_status: "todo" | "in_progress" | "review" | "completed";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      app_role: ["super_admin", "admin", "hr_manager", "employee", "viewer"],
      approval_status: ["pending", "approved", "rejected", "suspended"],
      attendance_status: ["present", "late", "absent", "leave", "half_day", "wfh"],
      leave_status: ["pending", "approved", "rejected", "cancelled"],
      leave_type: ["sick", "casual", "vacation", "emergency", "wfh"],
      qr_status: ["active", "inactive", "revoked"],
      task_priority: ["low", "medium", "high", "urgent"],
      task_status: ["todo", "in_progress", "review", "completed"],
    },
  },
} as const;
