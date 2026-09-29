export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      activity_logs: {
        Row: {
          action: string
          created_at: string
          details: Json | null
          id: string
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          details?: Json | null
          id?: string
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          details?: Json | null
          id?: string
          user_id?: string | null
        }
        Relationships: []
      }
      attendance: {
        Row: {
          admin_attendance_reason: string | null
          attendance_method: string | null
          card_uid_hash: string | null
          card_uid_last4: string | null
          check_in_accuracy_meters: number | null
          check_in_latitude: number | null
          check_in_longitude: number | null
          check_in_time: string | null
          check_out_accuracy_meters: number | null
          check_out_latitude: number | null
          check_out_longitude: number | null
          check_out_time: string | null
          created_at: string
          created_by_admin_id: string | null
          date: string
          deleted_at: string | null
          id: string
          is_early_checkout: boolean
          is_edited: boolean
          is_late: boolean
          reader_id: string | null
          remarks: string | null
          status: Database["public"]["Enums"]["attendance_status"]
          updated_at: string
          user_id: string
          work_hours: number | null
          work_location: string
        }
        Insert: {
          admin_attendance_reason?: string | null
          attendance_method?: string | null
          card_uid_hash?: string | null
          card_uid_last4?: string | null
          check_in_accuracy_meters?: number | null
          check_in_latitude?: number | null
          check_in_longitude?: number | null
          check_in_time?: string | null
          check_out_accuracy_meters?: number | null
          check_out_latitude?: number | null
          check_out_longitude?: number | null
          check_out_time?: string | null
          created_at?: string
          created_by_admin_id?: string | null
          date: string
          deleted_at?: string | null
          id?: string
          is_early_checkout?: boolean
          is_edited?: boolean
          is_late?: boolean
          reader_id?: string | null
          remarks?: string | null
          status?: Database["public"]["Enums"]["attendance_status"]
          updated_at?: string
          user_id: string
          work_hours?: number | null
          work_location?: string
        }
        Update: {
          admin_attendance_reason?: string | null
          attendance_method?: string | null
          card_uid_hash?: string | null
          card_uid_last4?: string | null
          check_in_accuracy_meters?: number | null
          check_in_latitude?: number | null
          check_in_longitude?: number | null
          check_in_time?: string | null
          check_out_accuracy_meters?: number | null
          check_out_latitude?: number | null
          check_out_longitude?: number | null
          check_out_time?: string | null
          created_at?: string
          created_by_admin_id?: string | null
          date?: string
          deleted_at?: string | null
          id?: string
          is_early_checkout?: boolean
          is_edited?: boolean
          is_late?: boolean
          reader_id?: string | null
          remarks?: string | null
          status?: Database["public"]["Enums"]["attendance_status"]
          updated_at?: string
          user_id?: string
          work_hours?: number | null
          work_location?: string
        }
        Relationships: []
      }
      attendance_audit_logs: {
        Row: {
          attendance_id: string
          created_at: string
          edited_by: string
          edited_by_name: string
          employee_id: string
          employee_name: string
          id: string
          original_value: Json
          reason: string
          source: string
          updated_value: Json
        }
        Insert: {
          attendance_id: string
          created_at?: string
          edited_by: string
          edited_by_name: string
          employee_id: string
          employee_name: string
          id?: string
          original_value: Json
          reason: string
          source?: string
          updated_value: Json
        }
        Update: {
          attendance_id?: string
          created_at?: string
          edited_by?: string
          edited_by_name?: string
          employee_id?: string
          employee_name?: string
          id?: string
          original_value?: Json
          reason?: string
          source?: string
          updated_value?: Json
        }
        Relationships: [
          {
            foreignKeyName: "attendance_audit_logs_attendance_id_fkey"
            columns: ["attendance_id"]
            isOneToOne: false
            referencedRelation: "attendance"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance_correction_requests: {
        Row: {
          admin_comment: string | null
          attendance_id: string
          created_at: string
          employee_name: string
          id: string
          reason: string
          requested_check_in_time: string | null
          requested_check_out_time: string | null
          requested_status:
            | Database["public"]["Enums"]["attendance_status"]
            | null
          requested_work_location: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["leave_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          admin_comment?: string | null
          attendance_id: string
          created_at?: string
          employee_name: string
          id?: string
          reason: string
          requested_check_in_time?: string | null
          requested_check_out_time?: string | null
          requested_status?:
            | Database["public"]["Enums"]["attendance_status"]
            | null
          requested_work_location?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["leave_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          admin_comment?: string | null
          attendance_id?: string
          created_at?: string
          employee_name?: string
          id?: string
          reason?: string
          requested_check_in_time?: string | null
          requested_check_out_time?: string | null
          requested_status?:
            | Database["public"]["Enums"]["attendance_status"]
            | null
          requested_work_location?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["leave_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_correction_requests_attendance_id_fkey"
            columns: ["attendance_id"]
            isOneToOne: false
            referencedRelation: "attendance"
            referencedColumns: ["id"]
          },
        ]
      }
      calendar_events: {
        Row: {
          ad_date: string
          bs_date: string
          created_at: string
          id: string
          is_active: boolean
          title: string
          updated_at: string
        }
        Insert: {
          ad_date: string
          bs_date: string
          created_at?: string
          id?: string
          is_active?: boolean
          title: string
          updated_at?: string
        }
        Update: {
          ad_date?: string
          bs_date?: string
          created_at?: string
          id?: string
          is_active?: boolean
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      card_reader_attendance_events: {
        Row: {
          action: string
          admin_id: string | null
          attendance_id: string | null
          attendance_method: string
          card_uid_hash: string
          card_uid_last4: string | null
          created_at: string
          employee_id: string | null
          id: string
          metadata: Json
          reader_id: string | null
          reader_name: string | null
          reason: string | null
        }
        Insert: {
          action: string
          admin_id?: string | null
          attendance_id?: string | null
          attendance_method?: string
          card_uid_hash: string
          card_uid_last4?: string | null
          created_at?: string
          employee_id?: string | null
          id?: string
          metadata?: Json
          reader_id?: string | null
          reader_name?: string | null
          reason?: string | null
        }
        Update: {
          action?: string
          admin_id?: string | null
          attendance_id?: string | null
          attendance_method?: string
          card_uid_hash?: string
          card_uid_last4?: string | null
          created_at?: string
          employee_id?: string | null
          id?: string
          metadata?: Json
          reader_id?: string | null
          reader_name?: string | null
          reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "card_reader_attendance_events_attendance_id_fkey"
            columns: ["attendance_id"]
            isOneToOne: false
            referencedRelation: "attendance"
            referencedColumns: ["id"]
          },
        ]
      }
      card_readers: {
        Row: {
          created_at: string
          id: string
          last_card_uid_hash: string | null
          last_card_uid_last4: string | null
          last_seen_at: string
          name: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id: string
          last_card_uid_hash?: string | null
          last_card_uid_last4?: string | null
          last_seen_at?: string
          name: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          last_card_uid_hash?: string | null
          last_card_uid_last4?: string | null
          last_seen_at?: string
          name?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      chat_conversations: {
        Row: {
          archived_by_admin: boolean
          created_at: string
          employee_id: string
          id: string
          last_message_at: string
          pinned_by_admin: boolean
        }
        Insert: {
          archived_by_admin?: boolean
          created_at?: string
          employee_id: string
          id?: string
          last_message_at?: string
          pinned_by_admin?: boolean
        }
        Update: {
          archived_by_admin?: boolean
          created_at?: string
          employee_id?: string
          id?: string
          last_message_at?: string
          pinned_by_admin?: boolean
        }
        Relationships: []
      }
      chat_messages: {
        Row: {
          attachment_name: string | null
          attachment_path: string | null
          attachment_size: number | null
          attachment_type: string | null
          body: string | null
          conversation_id: string
          created_at: string
          delivered_at: string
          id: string
          reactions: Json | null
          read_at: string | null
          recipient_id: string | null
          sender_id: string
          sender_ip: unknown
          sender_is_admin: boolean
        }
        Insert: {
          attachment_name?: string | null
          attachment_path?: string | null
          attachment_size?: number | null
          attachment_type?: string | null
          body?: string | null
          conversation_id: string
          created_at?: string
          delivered_at?: string
          id?: string
          reactions?: Json | null
          read_at?: string | null
          recipient_id?: string | null
          sender_id: string
          sender_ip?: unknown
          sender_is_admin: boolean
        }
        Update: {
          attachment_name?: string | null
          attachment_path?: string | null
          attachment_size?: number | null
          attachment_type?: string | null
          body?: string | null
          conversation_id?: string
          created_at?: string
          delivered_at?: string
          id?: string
          reactions?: Json | null
          read_at?: string | null
          recipient_id?: string | null
          sender_id?: string
          sender_ip?: unknown
          sender_is_admin?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "chat_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_presence: {
        Row: {
          is_online: boolean
          last_seen_at: string
          typing_conversation_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          is_online?: boolean
          last_seen_at?: string
          typing_conversation_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          is_online?: boolean
          last_seen_at?: string
          typing_conversation_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_presence_typing_conversation_id_fkey"
            columns: ["typing_conversation_id"]
            isOneToOne: false
            referencedRelation: "chat_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      comment_mentions: {
        Row: {
          comment_id: string | null
          created_at: string
          id: string
          mentioned_user_id: string | null
        }
        Insert: {
          comment_id?: string | null
          created_at?: string
          id?: string
          mentioned_user_id?: string | null
        }
        Update: {
          comment_id?: string | null
          created_at?: string
          id?: string
          mentioned_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "comment_mentions_comment_id_fkey"
            columns: ["comment_id"]
            isOneToOne: false
            referencedRelation: "task_comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comment_mentions_mentioned_user_id_fkey"
            columns: ["mentioned_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      employee_cards: {
        Row: {
          card_uid_hash: string
          card_uid_last4: string | null
          deactivated_at: string | null
          employee_id: string
          id: string
          notes: string | null
          registered_at: string
          registered_by: string
          status: string
        }
        Insert: {
          card_uid_hash: string
          card_uid_last4?: string | null
          deactivated_at?: string | null
          employee_id: string
          id?: string
          notes?: string | null
          registered_at?: string
          registered_by: string
          status?: string
        }
        Update: {
          card_uid_hash?: string
          card_uid_last4?: string | null
          deactivated_at?: string | null
          employee_id?: string
          id?: string
          notes?: string | null
          registered_at?: string
          registered_by?: string
          status?: string
        }
        Relationships: []
      }
      employee_month_awards: {
        Row: {
          admin_id: string
          created_at: string
          employee_id: string
          id: string
          internal_notes: string | null
          month_start: string
          public_message: string | null
          rating: string
          score: number
          updated_at: string
        }
        Insert: {
          admin_id: string
          created_at?: string
          employee_id: string
          id?: string
          internal_notes?: string | null
          month_start: string
          public_message?: string | null
          rating?: string
          score?: number
          updated_at?: string
        }
        Update: {
          admin_id?: string
          created_at?: string
          employee_id?: string
          id?: string
          internal_notes?: string | null
          month_start?: string
          public_message?: string | null
          rating?: string
          score?: number
          updated_at?: string
        }
        Relationships: []
      }
      holidays: {
        Row: {
          created_at: string
          date: string
          id: string
          is_active: boolean
          name: string
          scope: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          date: string
          id?: string
          is_active?: boolean
          name: string
          scope?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          date?: string
          id?: string
          is_active?: boolean
          name?: string
          scope?: string
          updated_at?: string
        }
        Relationships: []
      }
      leave_balances: {
        Row: {
          balance: number
          created_at: string
          id: string
          leave_type: Database["public"]["Enums"]["leave_type"]
          updated_at: string
          used: number
          user_id: string
        }
        Insert: {
          balance?: number
          created_at?: string
          id?: string
          leave_type: Database["public"]["Enums"]["leave_type"]
          updated_at?: string
          used?: number
          user_id: string
        }
        Update: {
          balance?: number
          created_at?: string
          id?: string
          leave_type?: Database["public"]["Enums"]["leave_type"]
          updated_at?: string
          used?: number
          user_id?: string
        }
        Relationships: []
      }
      leave_conflict_audit_logs: {
        Row: {
          action_performed: string
          attendance_details: Json | null
          created_at: string
          id: string
          leave_id: string
          new_status: string
          performed_by: string | null
          performed_by_name: string
          previous_status: string
          reason: string | null
        }
        Insert: {
          action_performed: string
          attendance_details?: Json | null
          created_at?: string
          id?: string
          leave_id: string
          new_status: string
          performed_by?: string | null
          performed_by_name: string
          previous_status: string
          reason?: string | null
        }
        Update: {
          action_performed?: string
          attendance_details?: Json | null
          created_at?: string
          id?: string
          leave_id?: string
          new_status?: string
          performed_by?: string | null
          performed_by_name?: string
          previous_status?: string
          reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "leave_conflict_audit_logs_leave_id_fkey"
            columns: ["leave_id"]
            isOneToOne: false
            referencedRelation: "leave_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      leave_requests: {
        Row: {
          admin_comment: string | null
          created_at: string
          end_date: string
          half_day_session: string | null
          id: string
          is_half_day: boolean
          leave_type: Database["public"]["Enums"]["leave_type"]
          reason: string | null
          reviewed_by: string | null
          start_date: string
          status: Database["public"]["Enums"]["leave_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          admin_comment?: string | null
          created_at?: string
          end_date: string
          half_day_session?: string | null
          id?: string
          is_half_day?: boolean
          leave_type: Database["public"]["Enums"]["leave_type"]
          reason?: string | null
          reviewed_by?: string | null
          start_date: string
          status?: Database["public"]["Enums"]["leave_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          admin_comment?: string | null
          created_at?: string
          end_date?: string
          half_day_session?: string | null
          id?: string
          is_half_day?: boolean
          leave_type?: Database["public"]["Enums"]["leave_type"]
          reason?: string | null
          reviewed_by?: string | null
          start_date?: string
          status?: Database["public"]["Enums"]["leave_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      meetings: {
        Row: {
          agenda: string | null
          created_at: string
          created_by: string | null
          id: string
          location: string | null
          meeting_link: string | null
          meeting_time: string
          title: string
        }
        Insert: {
          agenda?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          location?: string | null
          meeting_link?: string | null
          meeting_time: string
          title: string
        }
        Update: {
          agenda?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          location?: string | null
          meeting_link?: string | null
          meeting_time?: string
          title?: string
        }
        Relationships: []
      }
      mood_logs: {
        Row: {
          created_at: string
          id: string
          log_date: string
          mood: string
          note: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          log_date?: string
          mood: string
          note?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          log_date?: string
          mood?: string
          note?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          is_read: boolean
          message: string
          reference_id: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_read?: boolean
          message: string
          reference_id?: string | null
          title: string
          type?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_read?: boolean
          message?: string
          reference_id?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          address: string | null
          approval_status: Database["public"]["Enums"]["approval_status"]
          avatar_url: string | null
          blood_group: string | null
          created_at: string
          department: string | null
          email: string
          emergency_contact: string | null
          employee_code: string | null
          full_name: string
          id: string
          is_eom_eligible: boolean
          is_suspended: boolean
          joining_date: string | null
          phone: string | null
          position: string | null
          qr_generated_at: string | null
          qr_status: Database["public"]["Enums"]["qr_status"]
          qr_token: string | null
          salary: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          address?: string | null
          approval_status?: Database["public"]["Enums"]["approval_status"]
          avatar_url?: string | null
          blood_group?: string | null
          created_at?: string
          department?: string | null
          email: string
          emergency_contact?: string | null
          employee_code?: string | null
          full_name: string
          id?: string
          is_eom_eligible?: boolean
          is_suspended?: boolean
          joining_date?: string | null
          phone?: string | null
          position?: string | null
          qr_generated_at?: string | null
          qr_status?: Database["public"]["Enums"]["qr_status"]
          qr_token?: string | null
          salary?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          address?: string | null
          approval_status?: Database["public"]["Enums"]["approval_status"]
          avatar_url?: string | null
          blood_group?: string | null
          created_at?: string
          department?: string | null
          email?: string
          emergency_contact?: string | null
          employee_code?: string | null
          full_name?: string
          id?: string
          is_eom_eligible?: boolean
          is_suspended?: boolean
          joining_date?: string | null
          phone?: string | null
          position?: string | null
          qr_generated_at?: string | null
          qr_status?: Database["public"]["Enums"]["qr_status"]
          qr_token?: string | null
          salary?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      project_members: {
        Row: {
          created_at: string
          id: string
          project_id: string
          role: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          project_id: string
          role?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          project_id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_members_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_sprints: {
        Row: {
          created_at: string
          end_date: string | null
          id: string
          name: string
          project_id: string
          start_date: string | null
        }
        Insert: {
          created_at?: string
          end_date?: string | null
          id?: string
          name: string
          project_id: string
          start_date?: string | null
        }
        Update: {
          created_at?: string
          end_date?: string | null
          id?: string
          name?: string
          project_id?: string
          start_date?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "project_sprints_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          created_at: string
          created_by: string
          description: string | null
          id: string
          name: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          description?: string | null
          id?: string
          name: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          description?: string | null
          id?: string
          name?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      settings: {
        Row: {
          attendance_radius_meters: number
          auto_checkout_time: string
          company_logo: string | null
          company_name: string
          id: string
          late_after_time: string
          office_end_time: string
          office_latitude: number | null
          office_longitude: number | null
          office_start_time: string
          updated_at: string
        }
        Insert: {
          attendance_radius_meters?: number
          auto_checkout_time?: string
          company_logo?: string | null
          company_name?: string
          id?: string
          late_after_time?: string
          office_end_time?: string
          office_latitude?: number | null
          office_longitude?: number | null
          office_start_time?: string
          updated_at?: string
        }
        Update: {
          attendance_radius_meters?: number
          auto_checkout_time?: string
          company_logo?: string | null
          company_name?: string
          id?: string
          late_after_time?: string
          office_end_time?: string
          office_latitude?: number | null
          office_longitude?: number | null
          office_start_time?: string
          updated_at?: string
        }
        Relationships: []
      }
      task_activity_logs: {
        Row: {
          action: string
          created_at: string
          id: string
          new_value: Json | null
          old_value: Json | null
          task_id: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          id?: string
          new_value?: Json | null
          old_value?: Json | null
          task_id?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          id?: string
          new_value?: Json | null
          old_value?: Json | null
          task_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "task_activity_logs_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_activity_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      task_assignees: {
        Row: {
          assigned_at: string
          complexity: Database["public"]["Enums"]["task_complexity"]
          due_date: string | null
          id: string
          notes: string | null
          progress: number
          responsibility: string
          status: Database["public"]["Enums"]["task_assignment_status"]
          task_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          assigned_at?: string
          complexity?: Database["public"]["Enums"]["task_complexity"]
          due_date?: string | null
          id?: string
          notes?: string | null
          progress?: number
          responsibility: string
          status?: Database["public"]["Enums"]["task_assignment_status"]
          task_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          assigned_at?: string
          complexity?: Database["public"]["Enums"]["task_complexity"]
          due_date?: string | null
          id?: string
          notes?: string | null
          progress?: number
          responsibility?: string
          status?: Database["public"]["Enums"]["task_assignment_status"]
          task_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_assignees_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      task_attachments: {
        Row: {
          created_at: string
          file_name: string
          file_path: string
          file_size: number | null
          id: string
          mime_type: string | null
          task_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          file_name: string
          file_path: string
          file_size?: number | null
          id?: string
          mime_type?: string | null
          task_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          file_name?: string
          file_path?: string
          file_size?: number | null
          id?: string
          mime_type?: string | null
          task_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_attachments_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      task_comments: {
        Row: {
          attachment: Json | null
          comment: string
          created_at: string
          edited_at: string | null
          id: string
          parent_comment_id: string | null
          task_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          attachment?: Json | null
          comment: string
          created_at?: string
          edited_at?: string | null
          id?: string
          parent_comment_id?: string | null
          task_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          attachment?: Json | null
          comment?: string
          created_at?: string
          edited_at?: string | null
          id?: string
          parent_comment_id?: string | null
          task_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_comments_parent_comment_id_fkey"
            columns: ["parent_comment_id"]
            isOneToOne: false
            referencedRelation: "task_comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_comments_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      task_progress_updates: {
        Row: {
          created_at: string
          id: string
          new_progress: number
          note: string
          old_progress: number
          task_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          new_progress: number
          note: string
          old_progress: number
          task_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          new_progress?: number
          note?: string
          old_progress?: number
          task_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_progress_updates_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      task_team_leads: {
        Row: {
          assigned_at: string
          task_id: string
          user_id: string
        }
        Insert: {
          assigned_at?: string
          task_id: string
          user_id: string
        }
        Update: {
          assigned_at?: string
          task_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_team_leads_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_team_leads_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      tasks: {
        Row: {
          assigned_to: string
          completed_at: string | null
          created_at: string
          created_by: string
          deadline: string | null
          description: string | null
          id: string
          priority: Database["public"]["Enums"]["task_priority"]
          progress: number
          project_id: string | null
          sprint_id: string | null
          status: Database["public"]["Enums"]["task_status"]
          tags: string[] | null
          task_complexity: Database["public"]["Enums"]["task_complexity"]
          title: string
          updated_at: string
          weight: number
        }
        Insert: {
          assigned_to: string
          completed_at?: string | null
          created_at?: string
          created_by: string
          deadline?: string | null
          description?: string | null
          id?: string
          priority?: Database["public"]["Enums"]["task_priority"]
          progress?: number
          project_id?: string | null
          sprint_id?: string | null
          status?: Database["public"]["Enums"]["task_status"]
          tags?: string[] | null
          task_complexity?: Database["public"]["Enums"]["task_complexity"]
          title: string
          updated_at?: string
          weight?: number
        }
        Update: {
          assigned_to?: string
          completed_at?: string | null
          created_at?: string
          created_by?: string
          deadline?: string | null
          description?: string | null
          id?: string
          priority?: Database["public"]["Enums"]["task_priority"]
          progress?: number
          project_id?: string | null
          sprint_id?: string | null
          status?: Database["public"]["Enums"]["task_status"]
          tags?: string[] | null
          task_complexity?: Database["public"]["Enums"]["task_complexity"]
          title?: string
          updated_at?: string
          weight?: number
        }
        Relationships: [
          {
            foreignKeyName: "tasks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_sprint_id_fkey"
            columns: ["sprint_id"]
            isOneToOne: false
            referencedRelation: "project_sprints"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      weekly_standup_reports: {
        Row: {
          ai_summary: Json
          analytics_data: Json
          created_at: string
          id: string
          status: string
          updated_at: string
          user_id: string
          week_end: string
          week_start: string
        }
        Insert: {
          ai_summary?: Json
          analytics_data?: Json
          created_at?: string
          id?: string
          status?: string
          updated_at?: string
          user_id: string
          week_end: string
          week_start: string
        }
        Update: {
          ai_summary?: Json
          analytics_data?: Json
          created_at?: string
          id?: string
          status?: string
          updated_at?: string
          user_id?: string
          week_end?: string
          week_start?: string
        }
        Relationships: [
          {
            foreignKeyName: "weekly_standup_reports_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_card_reader_audit_history: {
        Args: never
        Returns: {
          action: string
          admin_id: string
          admin_name: string
          attendance_id: string
          attendance_method: string
          card_uid: string
          created_at: string
          employee_code: string
          employee_id: string
          employee_name: string
          id: string
          reader_id: string
          reader_name: string
          reason: string
        }[]
      }
      admin_card_reader_record_attendance: {
        Args: {
          _action: string
          _card_uid: string
          _employee_id: string
          _reader_id: string
          _reason?: string
        }
        Returns: Json
      }
      admin_card_reader_scan: {
        Args: { _card_uid: string; _reader_id: string; _reader_name?: string }
        Returns: Json
      }
      admin_card_reader_status: {
        Args: { _reader_id: string; _reader_name?: string }
        Returns: Json
      }
      apply_admin_attendance_edit: {
        Args: {
          _attendance_id: string
          _check_in_time: string
          _check_out_time: string
          _reason: string
          _status: Database["public"]["Enums"]["attendance_status"]
          _work_location: string
        }
        Returns: {
          admin_attendance_reason: string | null
          attendance_method: string | null
          card_uid_hash: string | null
          card_uid_last4: string | null
          check_in_accuracy_meters: number | null
          check_in_latitude: number | null
          check_in_longitude: number | null
          check_in_time: string | null
          check_out_accuracy_meters: number | null
          check_out_latitude: number | null
          check_out_longitude: number | null
          check_out_time: string | null
          created_at: string
          created_by_admin_id: string | null
          date: string
          deleted_at: string | null
          id: string
          is_early_checkout: boolean
          is_edited: boolean
          is_late: boolean
          reader_id: string | null
          remarks: string | null
          status: Database["public"]["Enums"]["attendance_status"]
          updated_at: string
          user_id: string
          work_hours: number | null
          work_location: string
        }
        SetofOptions: {
          from: "*"
          to: "attendance"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      approve_attendance_correction_request: {
        Args: { _admin_comment?: string; _request_id: string }
        Returns: {
          admin_attendance_reason: string | null
          attendance_method: string | null
          card_uid_hash: string | null
          card_uid_last4: string | null
          check_in_accuracy_meters: number | null
          check_in_latitude: number | null
          check_in_longitude: number | null
          check_in_time: string | null
          check_out_accuracy_meters: number | null
          check_out_latitude: number | null
          check_out_longitude: number | null
          check_out_time: string | null
          created_at: string
          created_by_admin_id: string | null
          date: string
          deleted_at: string | null
          id: string
          is_early_checkout: boolean
          is_edited: boolean
          is_late: boolean
          reader_id: string | null
          remarks: string | null
          status: Database["public"]["Enums"]["attendance_status"]
          updated_at: string
          user_id: string
          work_hours: number | null
          work_location: string
        }
        SetofOptions: {
          from: "*"
          to: "attendance"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      approve_leave_request: {
        Args: { p_admin_id: string; p_comment: string; p_leave_id: string }
        Returns: undefined
      }
      attendance_edit_snapshot: {
        Args: { _row: Database["public"]["Tables"]["attendance"]["Row"] }
        Returns: Json
      }
      auto_checkout_unchecked_attendance: { Args: never; Returns: number }
      calculate_attendance_work_hours: {
        Args: { _check_in: string; _check_out: string }
        Returns: number
      }
      cancel_leave_request: {
        Args: { p_comment: string; p_leave_id: string; p_user_id: string }
        Returns: undefined
      }
      card_uid_hash: { Args: { _card_uid: string }; Returns: string }
      card_uid_last4: { Args: { _card_uid: string }; Returns: string }
      distance_meters: {
        Args: { lat1: number; lat2: number; lon1: number; lon2: number }
        Returns: number
      }
      get_admin_attendance_correction_requests: {
        Args: never
        Returns: {
          admin_comment: string
          attendance_check_in_time: string
          attendance_check_out_time: string
          attendance_date: string
          attendance_id: string
          attendance_status: Database["public"]["Enums"]["attendance_status"]
          attendance_work_location: string
          created_at: string
          employee_name: string
          id: string
          reason: string
          requested_check_in_time: string
          requested_check_out_time: string
          requested_status: Database["public"]["Enums"]["attendance_status"]
          requested_work_location: string
          reviewed_at: string
          reviewed_by: string
          status: string
          updated_at: string
          user_id: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: { _user_id: string }; Returns: boolean }
      is_task_team_lead: {
        Args: { _task_id: string; _user_id: string }
        Returns: boolean
      }
      mark_chat_messages_read: {
        Args: { _conversation_id: string }
        Returns: undefined
      }
      mask_card_uid: { Args: { _card_uid: string }; Returns: string }
      modify_leave_request: {
        Args: {
          p_admin_id: string
          p_leave_id: string
          p_new_end: string
          p_new_start: string
        }
        Returns: undefined
      }
      notify_admins_task_review_requested: {
        Args: { _task_id: string }
        Returns: number
      }
      process_daily_attendance: { Args: { p_date: string }; Returns: undefined }
      register_employee_card: {
        Args: {
          _card_uid: string
          _employee_id: string
          _reader_id?: string
          _reason?: string
        }
        Returns: Json
      }
      reject_attendance_correction_request: {
        Args: { _admin_comment?: string; _request_id: string }
        Returns: {
          admin_comment: string | null
          attendance_id: string
          created_at: string
          employee_name: string
          id: string
          reason: string
          requested_check_in_time: string | null
          requested_check_out_time: string | null
          requested_status:
            | Database["public"]["Enums"]["attendance_status"]
            | null
          requested_work_location: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["leave_status"]
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "attendance_correction_requests"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      reject_leave_request: {
        Args: { p_admin_id: string; p_comment: string; p_leave_id: string }
        Returns: undefined
      }
      resolve_leave_attendance_conflict: {
        Args: {
          p_action: string
          p_admin_id: string
          p_comment: string
          p_leave_id: string
          p_reason: string
        }
        Returns: undefined
      }
      revert_leave_conflict_resolution: {
        Args: { p_admin_id: string; p_leave_id: string }
        Returns: undefined
      }
      set_chat_conversation_flags: {
        Args: {
          _archived?: boolean
          _conversation_id: string
          _pinned?: boolean
        }
        Returns: undefined
      }
      verify_employee_qr: {
        Args: { _token: string }
        Returns: {
          approval_status: Database["public"]["Enums"]["approval_status"]
          avatar_url: string
          department: string
          employee_code: string
          full_name: string
          is_valid: boolean
          job_position: string
          joining_date: string
          qr_generated_at: string
          qr_status: Database["public"]["Enums"]["qr_status"]
          role: Database["public"]["Enums"]["app_role"]
        }[]
      }
    }
    Enums: {
      app_role:
        | "super_admin"
        | "admin"
        | "hr_manager"
        | "employee"
        | "viewer"
        | "team_lead"
      approval_status: "pending" | "approved" | "rejected" | "suspended"
      attendance_status:
        | "present"
        | "late"
        | "absent"
        | "leave"
        | "half_day"
        | "wfh"
        | "holiday"
        | "weekend"
        | "half_day_present"
      leave_status:
        | "pending"
        | "approved"
        | "rejected"
        | "cancelled"
        | "half_day_approved"
      leave_type: "sick" | "casual" | "vacation" | "emergency" | "wfh"
      qr_status: "active" | "inactive" | "revoked"
      task_assignment_status:
        | "not_started"
        | "in_progress"
        | "under_review"
        | "completed"
        | "blocked"
        | "approved"
        | "rejected"
      task_complexity: "small" | "medium" | "large" | "epic"
      task_priority: "low" | "medium" | "high" | "urgent"
      task_status:
        | "todo"
        | "in_progress"
        | "review"
        | "completed"
        | "waiting"
        | "verified"
        | "blocked"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      app_role: [
        "super_admin",
        "admin",
        "hr_manager",
        "employee",
        "viewer",
        "team_lead",
      ],
      approval_status: ["pending", "approved", "rejected", "suspended"],
      attendance_status: [
        "present",
        "late",
        "absent",
        "leave",
        "half_day",
        "wfh",
        "holiday",
        "weekend",
        "half_day_present",
      ],
      leave_status: [
        "pending",
        "approved",
        "rejected",
        "cancelled",
        "half_day_approved",
      ],
      leave_type: ["sick", "casual", "vacation", "emergency", "wfh"],
      qr_status: ["active", "inactive", "revoked"],
      task_assignment_status: [
        "not_started",
        "in_progress",
        "under_review",
        "completed",
        "blocked",
        "approved",
        "rejected",
      ],
      task_complexity: ["small", "medium", "large", "epic"],
      task_priority: ["low", "medium", "high", "urgent"],
      task_status: [
        "todo",
        "in_progress",
        "review",
        "completed",
        "waiting",
        "verified",
        "blocked",
      ],
    },
  },
} as const
