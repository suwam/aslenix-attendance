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
          check_in_accuracy_meters: number | null;
          check_in_latitude: number | null;
          check_in_longitude: number | null;
          check_in_time: string | null;
          check_out_accuracy_meters: number | null;
          check_out_latitude: number | null;
          check_out_longitude: number | null;
          check_out_time: string | null;
          created_at: string;
          date: string;
          is_edited: boolean;
          is_early_checkout: boolean;
          id: string;
          is_late: boolean;
          remarks: string | null;
          status: Database["public"]["Enums"]["attendance_status"];
          updated_at: string;
          user_id: string;
          work_hours: number | null;
          work_location: string;
          deleted_at: string | null;
        };
        Insert: {
          check_in_accuracy_meters?: number | null;
          check_in_latitude?: number | null;
          check_in_longitude?: number | null;
          check_in_time?: string | null;
          check_out_accuracy_meters?: number | null;
          check_out_latitude?: number | null;
          check_out_longitude?: number | null;
          check_out_time?: string | null;
          created_at?: string;
          date: string;
          is_edited?: boolean;
          is_early_checkout?: boolean;
          id?: string;
          is_late?: boolean;
          remarks?: string | null;
          status?: Database["public"]["Enums"]["attendance_status"];
          updated_at?: string;
          user_id: string;
          work_hours?: number | null;
          work_location?: string;
          deleted_at?: string | null;
        };
        Update: {
          check_in_accuracy_meters?: number | null;
          check_in_latitude?: number | null;
          check_in_longitude?: number | null;
          check_in_time?: string | null;
          check_out_accuracy_meters?: number | null;
          check_out_latitude?: number | null;
          check_out_longitude?: number | null;
          check_out_time?: string | null;
          created_at?: string;
          date?: string;
          is_edited?: boolean;
          is_early_checkout?: boolean;
          id?: string;
          is_late?: boolean;
          remarks?: string | null;
          status?: Database["public"]["Enums"]["attendance_status"];
          updated_at?: string;
          user_id?: string;
          work_hours?: number | null;
          work_location?: string;
          deleted_at?: string | null;
        };
        Relationships: [];
      };
      attendance_audit_logs: {
        Row: {
          attendance_id: string;
          created_at: string;
          edited_by: string;
          edited_by_name: string;
          employee_id: string;
          employee_name: string;
          id: string;
          original_value: Json;
          reason: string;
          source: string;
          updated_value: Json;
        };
        Insert: {
          attendance_id: string;
          created_at?: string;
          edited_by: string;
          edited_by_name: string;
          employee_id: string;
          employee_name: string;
          id?: string;
          original_value: Json;
          reason: string;
          source?: string;
          updated_value: Json;
        };
        Update: {
          attendance_id?: string;
          created_at?: string;
          edited_by?: string;
          edited_by_name?: string;
          employee_id?: string;
          employee_name?: string;
          id?: string;
          original_value?: Json;
          reason?: string;
          source?: string;
          updated_value?: Json;
        };
        Relationships: [
          {
            foreignKeyName: "attendance_audit_logs_attendance_id_fkey";
            columns: ["attendance_id"];
            isOneToOne: false;
            referencedRelation: "attendance";
            referencedColumns: ["id"];
          },
        ];
      };
      attendance_correction_requests: {
        Row: {
          admin_comment: string | null;
          attendance_id: string;
          created_at: string;
          employee_name: string;
          id: string;
          reason: string;
          requested_check_in_time: string | null;
          requested_check_out_time: string | null;
          requested_status: Database["public"]["Enums"]["attendance_status"] | null;
          requested_work_location: string | null;
          reviewed_at: string | null;
          reviewed_by: string | null;
          status: Database["public"]["Enums"]["leave_status"];
          updated_at: string;
          user_id: string;
        };
        Insert: {
          admin_comment?: string | null;
          attendance_id: string;
          created_at?: string;
          employee_name: string;
          id?: string;
          reason: string;
          requested_check_in_time?: string | null;
          requested_check_out_time?: string | null;
          requested_status?: Database["public"]["Enums"]["attendance_status"] | null;
          requested_work_location?: string | null;
          reviewed_at?: string | null;
          reviewed_by?: string | null;
          status?: Database["public"]["Enums"]["leave_status"];
          updated_at?: string;
          user_id: string;
        };
        Update: {
          admin_comment?: string | null;
          attendance_id?: string;
          created_at?: string;
          employee_name?: string;
          id?: string;
          reason?: string;
          requested_check_in_time?: string | null;
          requested_check_out_time?: string | null;
          requested_status?: Database["public"]["Enums"]["attendance_status"] | null;
          requested_work_location?: string | null;
          reviewed_at?: string | null;
          reviewed_by?: string | null;
          status?: Database["public"]["Enums"]["leave_status"];
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "attendance_correction_requests_attendance_id_fkey";
            columns: ["attendance_id"];
            isOneToOne: false;
            referencedRelation: "attendance";
            referencedColumns: ["id"];
          },
        ];
      };
      holidays: {
        Row: {
          created_at: string;
          date: string;
          id: string;
          is_active: boolean;
          name: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          date: string;
          id?: string;
          is_active?: boolean;
          name: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          date?: string;
          id?: string;
          is_active?: boolean;
          name?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      leave_balances: {
        Row: {
          balance: number;
          created_at: string;
          id: string;
          leave_type: Database["public"]["Enums"]["leave_type"];
          updated_at: string;
          used: number;
          user_id: string;
        };
        Insert: {
          balance?: number;
          created_at?: string;
          id?: string;
          leave_type: Database["public"]["Enums"]["leave_type"];
          updated_at?: string;
          used?: number;
          user_id: string;
        };
        Update: {
          balance?: number;
          created_at?: string;
          id?: string;
          leave_type?: Database["public"]["Enums"]["leave_type"];
          updated_at?: string;
          used?: number;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "leave_balances_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["user_id"];
          }
        ];
      };
      leave_requests: {
        Row: {
          admin_comment: string | null;
          created_at: string;
          end_date: string;
          half_day_session: string | null;
          id: string;
          is_half_day: boolean;
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
          half_day_session?: string | null;
          id?: string;
          is_half_day?: boolean;
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
          half_day_session?: string | null;
          id?: string;
          is_half_day?: boolean;
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
      leave_conflict_audit_logs: {
        Row: {
          action_performed: string;
          attendance_details: Json | null;
          created_at: string;
          id: string;
          leave_id: string;
          new_status: string;
          performed_by: string | null;
          performed_by_name: string;
          previous_status: string;
          reason: string | null;
        };
        Insert: {
          action_performed: string;
          attendance_details?: Json | null;
          created_at?: string;
          id?: string;
          leave_id: string;
          new_status: string;
          performed_by?: string | null;
          performed_by_name: string;
          previous_status: string;
          reason?: string | null;
        };
        Update: {
          action_performed?: string;
          attendance_details?: Json | null;
          created_at?: string;
          id?: string;
          leave_id?: string;
          new_status?: string;
          performed_by?: string | null;
          performed_by_name?: string;
          previous_status?: string;
          reason?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "leave_conflict_audit_logs_leave_id_fkey";
            columns: ["leave_id"];
            isOneToOne: false;
            referencedRelation: "leave_requests";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "leave_conflict_audit_logs_performed_by_fkey";
            columns: ["performed_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["user_id"];
          }
        ];
      };
      meetings: {
        Row: {
          agenda: string | null;
          created_at: string;
          created_by: string | null;
          id: string;
          location: string | null;
          meeting_link: string | null;
          meeting_time: string;
          title: string;
        };
        Insert: {
          agenda?: string | null;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          location?: string | null;
          meeting_link?: string | null;
          meeting_time: string;
          title: string;
        };
        Update: {
          agenda?: string | null;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          location?: string | null;
          meeting_link?: string | null;
          meeting_time?: string;
          title?: string;
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
      employee_achievements: {
        Row: {
          badge: string;
          badge_type: string;
          created_at: string;
          id: string;
          status: "Approved" | "Pending" | "Manual";
          updated_at: string;
          user_id: string;
        };
        Insert: {
          badge: string;
          badge_type: string;
          created_at?: string;
          id?: string;
          status?: "Approved" | "Pending" | "Manual";
          updated_at?: string;
          user_id: string;
        };
        Update: {
          badge?: string;
          badge_type?: string;
          created_at?: string;
          id?: string;
          status?: "Approved" | "Pending" | "Manual";
          updated_at?: string;
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
          is_eom_eligible: boolean;
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
          is_eom_eligible?: boolean;
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
          is_eom_eligible?: boolean;
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
          attendance_radius_meters: number;
          auto_checkout_time: string;
          company_logo: string | null;
          company_name: string;
          id: string;
          late_after_time: string;
          office_end_time: string;
          office_latitude: number | null;
          office_longitude: number | null;
          office_start_time: string;
          updated_at: string;
        };
        Insert: {
          attendance_radius_meters?: number;
          auto_checkout_time?: string;
          company_logo?: string | null;
          company_name?: string;
          id?: string;
          late_after_time?: string;
          office_end_time?: string;
          office_latitude?: number | null;
          office_longitude?: number | null;
          office_start_time?: string;
          updated_at?: string;
        };
        Update: {
          attendance_radius_meters?: number;
          auto_checkout_time?: string;
          company_logo?: string | null;
          company_name?: string;
          id?: string;
          late_after_time?: string;
          office_end_time?: string;
          office_latitude?: number | null;
          office_longitude?: number | null;
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
      task_progress_updates: {
        Row: {
          created_at: string;
          id: string;
          new_progress: number;
          note: string;
          old_progress: number;
          task_id: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          new_progress: number;
          note: string;
          old_progress: number;
          task_id: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          new_progress?: number;
          note?: string;
          old_progress?: number;
          task_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "task_progress_updates_task_id_fkey";
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
          task_complexity: Database["public"]["Enums"]["task_complexity"];
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
          task_complexity?: Database["public"]["Enums"]["task_complexity"];
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
          task_complexity?: Database["public"]["Enums"]["task_complexity"];
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
      weekly_feedback: {
        Row: {
          admin_id: string;
          created_at: string;
          employee_id: string;
          id: string;
          improvements: string | null;
          admin_notes: string | null;
          notes: string | null;
          rating: string;
          review_score: number;
          score: number;
          strengths: string | null;
          updated_at: string;
          week_number: number;
          week_start: string;
        };
        Insert: {
          admin_id: string;
          admin_notes?: string | null;
          created_at?: string;
          employee_id: string;
          id?: string;
          improvements?: string | null;
          notes?: string | null;
          rating: string;
          review_score?: number;
          score?: number;
          strengths?: string | null;
          updated_at?: string;
          week_number: number;
          week_start: string;
        };
        Update: {
          admin_id?: string;
          admin_notes?: string | null;
          created_at?: string;
          employee_id?: string;
          id?: string;
          improvements?: string | null;
          notes?: string | null;
          rating?: string;
          review_score?: number;
          score?: number;
          strengths?: string | null;
          updated_at?: string;
          week_number?: number;
          week_start?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      apply_admin_attendance_edit: {
        Args: {
          _attendance_id: string;
          _check_in_time: string | null;
          _check_out_time: string | null;
          _reason: string;
          _status: Database["public"]["Enums"]["attendance_status"];
          _work_location: string;
        };
        Returns: Database["public"]["Tables"]["attendance"]["Row"];
      };
      approve_attendance_correction_request: {
        Args: { _admin_comment?: string | null; _request_id: string };
        Returns: Database["public"]["Tables"]["attendance"]["Row"];
      };
      approve_leave_request: {
        Args: { p_admin_id: string; p_comment: string; p_leave_id: string };
        Returns: undefined;
      };
      attendance_edit_snapshot: {
        Args: { _row: Database["public"]["Tables"]["attendance"]["Row"] };
        Returns: Json;
      };
      cancel_leave_request: {
        Args: { p_comment: string; p_leave_id: string; p_user_id: string };
        Returns: undefined;
      };
      calculate_attendance_work_hours: {
        Args: { _check_in: string | null; _check_out: string | null };
        Returns: number;
      };
      get_admin_attendance_correction_requests: {
        Args: Record<PropertyKey, never>;
        Returns: {
          admin_comment: string | null;
          attendance_check_in_time: string | null;
          attendance_check_out_time: string | null;
          attendance_date: string | null;
          attendance_id: string;
          attendance_status: Database["public"]["Enums"]["attendance_status"] | null;
          attendance_work_location: string | null;
          created_at: string;
          employee_name: string;
          id: string;
          reason: string;
          requested_check_in_time: string | null;
          requested_check_out_time: string | null;
          requested_status: Database["public"]["Enums"]["attendance_status"] | null;
          requested_work_location: string | null;
          reviewed_at: string | null;
          reviewed_by: string | null;
          status: string;
          updated_at: string;
          user_id: string;
        }[];
      };
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"];
          _user_id: string;
        };
        Returns: boolean;
      };
      is_admin: { Args: { _user_id: string }; Returns: boolean };
      modify_leave_request: {
        Args: {
          p_admin_id: string;
          p_leave_id: string;
          p_new_end: string;
          p_new_start: string;
        };
        Returns: undefined;
      };
      reject_attendance_correction_request: {
        Args: { _admin_comment?: string | null; _request_id: string };
        Returns: Database["public"]["Tables"]["attendance_correction_requests"]["Row"];
      };
      reject_leave_request: {
        Args: { p_admin_id: string; p_comment: string; p_leave_id: string };
        Returns: undefined;
      };
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
      attendance_status:
        | "present"
        | "late"
        | "absent"
        | "leave"
        | "half_day"
        | "wfh"
        | "holiday"
        | "weekend"
        | "half_day_present";
      leave_status:
        | "pending"
        | "approved"
        | "rejected"
        | "cancelled"
        | "half_day_approved";
      leave_type: "sick" | "casual" | "vacation" | "emergency" | "wfh" | "holiday" | "weekend";
      qr_status: "active" | "inactive" | "revoked";
      task_complexity: "small" | "medium" | "large" | "epic";
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
      attendance_status: ["present", "late", "absent", "leave", "half_day", "wfh", "holiday", "weekend"],
      leave_status: ["pending", "approved", "rejected", "cancelled"],
      leave_type: ["sick", "casual", "vacation", "emergency", "wfh", "holiday", "weekend"],
      qr_status: ["active", "inactive", "revoked"],
      task_complexity: ["small", "medium", "large", "epic"],
      task_priority: ["low", "medium", "high", "urgent"],
      task_status: ["todo", "in_progress", "review", "completed"],
    },
  },
} as const;

