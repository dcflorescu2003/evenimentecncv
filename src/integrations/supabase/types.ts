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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      attendance_log: {
        Row: {
          changed_at: string
          changed_by: string
          id: string
          new_status: Database["public"]["Enums"]["ticket_status"]
          notes: string | null
          previous_status: Database["public"]["Enums"]["ticket_status"] | null
          ticket_id: string
        }
        Insert: {
          changed_at?: string
          changed_by: string
          id?: string
          new_status: Database["public"]["Enums"]["ticket_status"]
          notes?: string | null
          previous_status?: Database["public"]["Enums"]["ticket_status"] | null
          ticket_id: string
        }
        Update: {
          changed_at?: string
          changed_by?: string
          id?: string
          new_status?: Database["public"]["Enums"]["ticket_status"]
          notes?: string | null
          previous_status?: Database["public"]["Enums"]["ticket_status"] | null
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_log_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          created_at: string
          details: Json | null
          entity_id: string | null
          entity_type: string
          id: string
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          details?: Json | null
          entity_id?: string | null
          entity_type: string
          id?: string
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          details?: Json | null
          entity_id?: string | null
          entity_type?: string
          id?: string
          user_id?: string | null
        }
        Relationships: []
      }
      class_participation_rules: {
        Row: {
          class_id: string
          created_at: string
          enforcement_mode: string
          id: string
          max_hours: number | null
          notes: string | null
          required_value: number
          requirement_type: string
          session_id: string
          updated_at: string
        }
        Insert: {
          class_id: string
          created_at?: string
          enforcement_mode?: string
          id?: string
          max_hours?: number | null
          notes?: string | null
          required_value: number
          requirement_type?: string
          session_id: string
          updated_at?: string
        }
        Update: {
          class_id?: string
          created_at?: string
          enforcement_mode?: string
          id?: string
          max_hours?: number | null
          notes?: string | null
          required_value?: number
          requirement_type?: string
          session_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "class_participation_rules_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_participation_rules_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "program_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      classes: {
        Row: {
          academic_year: string
          created_at: string
          display_name: string
          grade_number: number
          homeroom_teacher_id: string | null
          id: string
          is_active: boolean
          section: string | null
          updated_at: string
        }
        Insert: {
          academic_year: string
          created_at?: string
          display_name: string
          grade_number: number
          homeroom_teacher_id?: string | null
          id?: string
          is_active?: boolean
          section?: string | null
          updated_at?: string
        }
        Update: {
          academic_year?: string
          created_at?: string
          display_name?: string
          grade_number?: number
          homeroom_teacher_id?: string | null
          id?: string
          is_active?: boolean
          section?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "classes_homeroom_teacher_id_fkey"
            columns: ["homeroom_teacher_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      coordinator_assignments: {
        Row: {
          created_at: string
          event_id: string
          id: string
          teacher_id: string
        }
        Insert: {
          created_at?: string
          event_id: string
          id?: string
          teacher_id: string
        }
        Update: {
          created_at?: string
          event_id?: string
          id?: string
          teacher_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "coordinator_assignments_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coordinator_assignments_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      email_send_log: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          message_id: string | null
          metadata: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email?: string
          status?: string
          template_name?: string
        }
        Relationships: []
      }
      email_send_state: {
        Row: {
          auth_email_ttl_minutes: number
          batch_size: number
          id: number
          retry_after_until: string | null
          send_delay_ms: number
          transactional_email_ttl_minutes: number
          updated_at: string
        }
        Insert: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Update: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      email_unsubscribe_tokens: {
        Row: {
          created_at: string
          email: string
          id: string
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          token: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: []
      }
      event_files: {
        Row: {
          description: string | null
          event_id: string
          file_category: Database["public"]["Enums"]["file_category"]
          file_name: string
          file_type: string | null
          id: string
          is_required: boolean
          notes: string | null
          storage_path: string
          title: string
          uploaded_at: string
          uploaded_by: string
        }
        Insert: {
          description?: string | null
          event_id: string
          file_category: Database["public"]["Enums"]["file_category"]
          file_name: string
          file_type?: string | null
          id?: string
          is_required?: boolean
          notes?: string | null
          storage_path: string
          title: string
          uploaded_at?: string
          uploaded_by: string
        }
        Update: {
          description?: string | null
          event_id?: string
          file_category?: Database["public"]["Enums"]["file_category"]
          file_name?: string
          file_type?: string | null
          id?: string
          is_required?: boolean
          notes?: string | null
          storage_path?: string
          title?: string
          uploaded_at?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_files_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      event_student_assistants: {
        Row: {
          assigned_by: string
          created_at: string
          event_id: string
          id: string
          student_id: string
        }
        Insert: {
          assigned_by: string
          created_at?: string
          event_id: string
          id?: string
          student_id: string
        }
        Update: {
          assigned_by?: string
          created_at?: string
          event_id?: string
          id?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_student_assistants_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_student_assistants_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          booking_close_at: string | null
          booking_open_at: string | null
          computed_duration_display: string | null
          counted_duration_hours: number
          created_at: string
          created_by: string | null
          date: string
          description: string | null
          eligible_classes: string[] | null
          eligible_grades: number[] | null
          end_time: string
          id: string
          is_cse: boolean
          is_public: boolean
          location: string | null
          max_capacity: number
          max_per_class: number | null
          notes_for_teachers: string | null
          published: boolean
          room_details: string | null
          session_id: string
          start_time: string
          status: Database["public"]["Enums"]["event_status"]
          title: string
          updated_at: string
        }
        Insert: {
          booking_close_at?: string | null
          booking_open_at?: string | null
          computed_duration_display?: string | null
          counted_duration_hours: number
          created_at?: string
          created_by?: string | null
          date: string
          description?: string | null
          eligible_classes?: string[] | null
          eligible_grades?: number[] | null
          end_time: string
          id?: string
          is_cse?: boolean
          is_public?: boolean
          location?: string | null
          max_capacity: number
          max_per_class?: number | null
          notes_for_teachers?: string | null
          published?: boolean
          room_details?: string | null
          session_id: string
          start_time: string
          status?: Database["public"]["Enums"]["event_status"]
          title: string
          updated_at?: string
        }
        Update: {
          booking_close_at?: string | null
          booking_open_at?: string | null
          computed_duration_display?: string | null
          counted_duration_hours?: number
          created_at?: string
          created_by?: string | null
          date?: string
          description?: string | null
          eligible_classes?: string[] | null
          eligible_grades?: number[] | null
          end_time?: string
          id?: string
          is_cse?: boolean
          is_public?: boolean
          location?: string | null
          max_capacity?: number
          max_per_class?: number | null
          notes_for_teachers?: string | null
          published?: boolean
          room_details?: string | null
          session_id?: string
          start_time?: string
          status?: Database["public"]["Enums"]["event_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "events_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "program_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      fcm_tokens: {
        Row: {
          created_at: string
          id: string
          platform: string
          token: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          platform?: string
          token: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          platform?: string
          token?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      form_submissions: {
        Row: {
          admin_notes: string | null
          event_id: string
          file_name: string
          file_type: string | null
          form_title: string
          id: string
          related_template_id: string | null
          status: Database["public"]["Enums"]["form_submission_status"]
          storage_path: string
          student_id: string
          uploaded_at: string
          uploaded_by: string
        }
        Insert: {
          admin_notes?: string | null
          event_id: string
          file_name: string
          file_type?: string | null
          form_title: string
          id?: string
          related_template_id?: string | null
          status?: Database["public"]["Enums"]["form_submission_status"]
          storage_path: string
          student_id: string
          uploaded_at?: string
          uploaded_by: string
        }
        Update: {
          admin_notes?: string | null
          event_id?: string
          file_name?: string
          file_type?: string | null
          form_title?: string
          id?: string
          related_template_id?: string | null
          status?: Database["public"]["Enums"]["form_submission_status"]
          storage_path?: string
          student_id?: string
          uploaded_at?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "form_submissions_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "form_submissions_related_template_id_fkey"
            columns: ["related_template_id"]
            isOneToOne: false
            referencedRelation: "event_files"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "form_submissions_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      import_batches: {
        Row: {
          error_count: number
          file_name: string
          id: string
          imported_at: string
          imported_by: string
          row_count: number
          status: Database["public"]["Enums"]["import_batch_status"]
          success_count: number
          summary_json: Json | null
        }
        Insert: {
          error_count?: number
          file_name: string
          id?: string
          imported_at?: string
          imported_by: string
          row_count?: number
          status?: Database["public"]["Enums"]["import_batch_status"]
          success_count?: number
          summary_json?: Json | null
        }
        Update: {
          error_count?: number
          file_name?: string
          id?: string
          imported_at?: string
          imported_by?: string
          row_count?: number
          status?: Database["public"]["Enums"]["import_batch_status"]
          success_count?: number
          summary_json?: Json | null
        }
        Relationships: []
      }
      notifications: {
        Row: {
          body: string
          created_at: string
          id: string
          is_read: boolean
          related_event_id: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          is_read?: boolean
          related_event_id?: string | null
          title: string
          type?: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          is_read?: boolean
          related_event_id?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_related_event_id_fkey"
            columns: ["related_event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          email: string | null
          first_name: string
          id: string
          is_active: boolean
          last_name: string
          must_change_password: boolean
          student_identifier: string | null
          teaching_norm: number | null
          updated_at: string
          username: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          email?: string | null
          first_name: string
          id: string
          is_active?: boolean
          last_name: string
          must_change_password?: boolean
          student_identifier?: string | null
          teaching_norm?: number | null
          updated_at?: string
          username: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          email?: string | null
          first_name?: string
          id?: string
          is_active?: boolean
          last_name?: string
          must_change_password?: boolean
          student_identifier?: string | null
          teaching_norm?: number | null
          updated_at?: string
          username?: string
        }
        Relationships: []
      }
      program_sessions: {
        Row: {
          academic_year: string
          created_at: string
          end_date: string
          id: string
          min_participants: number | null
          name: string
          start_date: string
          status: Database["public"]["Enums"]["session_status"]
          updated_at: string
        }
        Insert: {
          academic_year: string
          created_at?: string
          end_date: string
          id?: string
          min_participants?: number | null
          name: string
          start_date: string
          status?: Database["public"]["Enums"]["session_status"]
          updated_at?: string
        }
        Update: {
          academic_year?: string
          created_at?: string
          end_date?: string
          id?: string
          min_participants?: number | null
          name?: string
          start_date?: string
          status?: Database["public"]["Enums"]["session_status"]
          updated_at?: string
        }
        Relationships: []
      }
      public_reservations: {
        Row: {
          created_at: string
          event_id: string
          guest_email: string | null
          guest_name: string
          guest_phone: string | null
          id: string
          reservation_code: string
          status: string
        }
        Insert: {
          created_at?: string
          event_id: string
          guest_email?: string | null
          guest_name: string
          guest_phone?: string | null
          id?: string
          reservation_code?: string
          status?: string
        }
        Update: {
          created_at?: string
          event_id?: string
          guest_email?: string | null
          guest_name?: string
          guest_phone?: string | null
          id?: string
          reservation_code?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "public_reservations_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      public_tickets: {
        Row: {
          attendee_name: string
          checkin_timestamp: string | null
          created_at: string
          id: string
          public_reservation_id: string
          qr_code_data: string
          status: string
        }
        Insert: {
          attendee_name: string
          checkin_timestamp?: string | null
          created_at?: string
          id?: string
          public_reservation_id: string
          qr_code_data?: string
          status?: string
        }
        Update: {
          attendee_name?: string
          checkin_timestamp?: string | null
          created_at?: string
          id?: string
          public_reservation_id?: string
          qr_code_data?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "public_tickets_public_reservation_id_fkey"
            columns: ["public_reservation_id"]
            isOneToOne: false
            referencedRelation: "public_reservations"
            referencedColumns: ["id"]
          },
        ]
      }
      push_subscriptions: {
        Row: {
          auth_key: string
          created_at: string
          endpoint: string
          id: string
          p256dh: string
          user_id: string
        }
        Insert: {
          auth_key: string
          created_at?: string
          endpoint: string
          id?: string
          p256dh: string
          user_id: string
        }
        Update: {
          auth_key?: string
          created_at?: string
          endpoint?: string
          id?: string
          p256dh?: string
          user_id?: string
        }
        Relationships: []
      }
      reservations: {
        Row: {
          cancelled_at: string | null
          created_at: string
          event_id: string
          id: string
          reservation_code: string
          status: Database["public"]["Enums"]["reservation_status"]
          student_id: string
        }
        Insert: {
          cancelled_at?: string | null
          created_at?: string
          event_id: string
          id?: string
          reservation_code?: string
          status?: Database["public"]["Enums"]["reservation_status"]
          student_id: string
        }
        Update: {
          cancelled_at?: string | null
          created_at?: string
          event_id?: string
          id?: string
          reservation_code?: string
          status?: Database["public"]["Enums"]["reservation_status"]
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reservations_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservations_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      student_class_assignments: {
        Row: {
          academic_year: string
          class_id: string
          created_at: string
          id: string
          student_id: string
        }
        Insert: {
          academic_year: string
          class_id: string
          created_at?: string
          id?: string
          student_id: string
        }
        Update: {
          academic_year?: string
          class_id?: string
          created_at?: string
          id?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_class_assignments_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_class_assignments_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      suppressed_emails: {
        Row: {
          created_at: string
          email: string
          id: string
          metadata: Json | null
          reason: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          metadata?: Json | null
          reason: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          metadata?: Json | null
          reason?: string
        }
        Relationships: []
      }
      tickets: {
        Row: {
          checkin_timestamp: string | null
          created_at: string
          id: string
          qr_code_data: string
          reservation_id: string
          status: Database["public"]["Enums"]["ticket_status"]
          updated_at: string
        }
        Insert: {
          checkin_timestamp?: string | null
          created_at?: string
          id?: string
          qr_code_data?: string
          reservation_id: string
          status?: Database["public"]["Enums"]["ticket_status"]
          updated_at?: string
        }
        Update: {
          checkin_timestamp?: string | null
          created_at?: string
          id?: string
          qr_code_data?: string
          reservation_id?: string
          status?: Database["public"]["Enums"]["ticket_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tickets_reservation_id_fkey"
            columns: ["reservation_id"]
            isOneToOne: true
            referencedRelation: "reservations"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      check_booking_eligibility: {
        Args: { _event_id: string; _student_id: string }
        Returns: Json
      }
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
      get_assistant_event_student_ids: {
        Args: { _assistant_id: string }
        Returns: string[]
      }
      get_events_reserved_counts: {
        Args: { _event_ids: string[] }
        Returns: Json
      }
      get_student_progress: {
        Args: { _session_id: string; _student_id: string }
        Returns: Json
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_assistant_for_event: {
        Args: { _event_id: string; _student_id: string }
        Returns: boolean
      }
      is_assistant_for_public_reservation: {
        Args: { _public_reservation_id: string; _student_id: string }
        Returns: boolean
      }
      is_assistant_for_reservation_event: {
        Args: { _reservation_id: string; _student_id: string }
        Returns: boolean
      }
      is_coordinator_for_event: {
        Args: { _event_id: string; _user_id: string }
        Returns: boolean
      }
      is_event_creator: {
        Args: { _event_id: string; _user_id: string }
        Returns: boolean
      }
      is_teacher_for_student: {
        Args: { _student_id: string; _teacher_id: string }
        Returns: boolean
      }
      move_to_dlq: {
        Args: {
          dlq_name: string
          message_id: number
          payload: Json
          source_queue: string
        }
        Returns: number
      }
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
      }
    }
    Enums: {
      app_role:
        | "admin"
        | "student"
        | "homeroom_teacher"
        | "coordinator_teacher"
        | "teacher"
        | "manager"
        | "cse"
      event_status: "draft" | "published" | "closed" | "cancelled"
      file_category: "event_dossier" | "form_template"
      form_submission_status: "uploaded" | "reviewed" | "accepted" | "rejected"
      import_batch_status: "pending" | "processing" | "completed" | "failed"
      reservation_status: "reserved" | "cancelled"
      session_status: "draft" | "active" | "closed" | "archived"
      ticket_status:
        | "reserved"
        | "cancelled"
        | "present"
        | "late"
        | "absent"
        | "excused"
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: [
        "admin",
        "student",
        "homeroom_teacher",
        "coordinator_teacher",
        "teacher",
        "manager",
        "cse",
      ],
      event_status: ["draft", "published", "closed", "cancelled"],
      file_category: ["event_dossier", "form_template"],
      form_submission_status: ["uploaded", "reviewed", "accepted", "rejected"],
      import_batch_status: ["pending", "processing", "completed", "failed"],
      reservation_status: ["reserved", "cancelled"],
      session_status: ["draft", "active", "closed", "archived"],
      ticket_status: [
        "reserved",
        "cancelled",
        "present",
        "late",
        "absent",
        "excused",
      ],
    },
  },
} as const
