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
      cantina_menu_cache: {
        Row: {
          fetched_at: string
          id: number
          payload: Json
        }
        Insert: {
          fetched_at?: string
          id?: number
          payload: Json
        }
        Update: {
          fetched_at?: string
          id?: number
          payload?: Json
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
      class_schedules: {
        Row: {
          academic_year: string
          class_id: string
          created_at: string
          id: string
          notes: string | null
          updated_at: string
        }
        Insert: {
          academic_year: string
          class_id: string
          created_at?: string
          id?: string
          notes?: string | null
          updated_at?: string
        }
        Update: {
          academic_year?: string
          class_id?: string
          created_at?: string
          id?: string
          notes?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "class_schedules_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
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
      club_attendance: {
        Row: {
          checkin_at: string | null
          created_at: string
          id: string
          marked_by: string | null
          meeting_id: string
          notes: string | null
          status: Database["public"]["Enums"]["club_attendance_status"]
          student_id: string
          updated_at: string
        }
        Insert: {
          checkin_at?: string | null
          created_at?: string
          id?: string
          marked_by?: string | null
          meeting_id: string
          notes?: string | null
          status?: Database["public"]["Enums"]["club_attendance_status"]
          student_id: string
          updated_at?: string
        }
        Update: {
          checkin_at?: string | null
          created_at?: string
          id?: string
          marked_by?: string | null
          meeting_id?: string
          notes?: string | null
          status?: Database["public"]["Enums"]["club_attendance_status"]
          student_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "club_attendance_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "club_meetings"
            referencedColumns: ["id"]
          },
        ]
      }
      club_coordinators: {
        Row: {
          assigned_by: string
          club_id: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          assigned_by: string
          club_id: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          assigned_by?: string
          club_id?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "club_coordinators_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
        ]
      }
      club_enrollments: {
        Row: {
          club_id: string
          created_at: string
          enrolled_at: string
          id: string
          status: Database["public"]["Enums"]["club_enrollment_status"]
          student_id: string
          updated_at: string
          withdrawn_at: string | null
        }
        Insert: {
          club_id: string
          created_at?: string
          enrolled_at?: string
          id?: string
          status?: Database["public"]["Enums"]["club_enrollment_status"]
          student_id: string
          updated_at?: string
          withdrawn_at?: string | null
        }
        Update: {
          club_id?: string
          created_at?: string
          enrolled_at?: string
          id?: string
          status?: Database["public"]["Enums"]["club_enrollment_status"]
          student_id?: string
          updated_at?: string
          withdrawn_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "club_enrollments_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
        ]
      }
      club_meetings: {
        Row: {
          club_id: string
          created_at: string
          created_by: string
          date: string
          end_time: string
          id: string
          location: string | null
          notes: string | null
          qr_code_data: string
          start_time: string
          updated_at: string
        }
        Insert: {
          club_id: string
          created_at?: string
          created_by: string
          date: string
          end_time: string
          id?: string
          location?: string | null
          notes?: string | null
          qr_code_data?: string
          start_time: string
          updated_at?: string
        }
        Update: {
          club_id?: string
          created_at?: string
          created_by?: string
          date?: string
          end_time?: string
          id?: string
          location?: string | null
          notes?: string | null
          qr_code_data?: string
          start_time?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "club_meetings_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
        ]
      }
      clubs: {
        Row: {
          created_at: string
          created_by: string
          description: string | null
          eligible_classes: string[] | null
          eligible_grades: number[] | null
          enrollment_close_at: string | null
          enrollment_open_at: string | null
          frequency_label: string | null
          id: string
          location: string | null
          max_capacity: number | null
          max_per_class: number | null
          name: string
          session_id: string
          status: Database["public"]["Enums"]["club_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          description?: string | null
          eligible_classes?: string[] | null
          eligible_grades?: number[] | null
          enrollment_close_at?: string | null
          enrollment_open_at?: string | null
          frequency_label?: string | null
          id?: string
          location?: string | null
          max_capacity?: number | null
          max_per_class?: number | null
          name: string
          session_id: string
          status?: Database["public"]["Enums"]["club_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          description?: string | null
          eligible_classes?: string[] | null
          eligible_grades?: number[] | null
          enrollment_close_at?: string | null
          enrollment_open_at?: string | null
          frequency_label?: string | null
          id?: string
          location?: string | null
          max_capacity?: number | null
          max_per_class?: number | null
          name?: string
          session_id?: string
          status?: Database["public"]["Enums"]["club_status"]
          updated_at?: string
        }
        Relationships: []
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
      feedback_answers: {
        Row: {
          created_at: string
          id: string
          question_id: string
          response_id: string
          value: Json | null
        }
        Insert: {
          created_at?: string
          id?: string
          question_id: string
          response_id: string
          value?: Json | null
        }
        Update: {
          created_at?: string
          id?: string
          question_id?: string
          response_id?: string
          value?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "feedback_answers_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "feedback_questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feedback_answers_response_id_fkey"
            columns: ["response_id"]
            isOneToOne: false
            referencedRelation: "feedback_responses"
            referencedColumns: ["id"]
          },
        ]
      }
      feedback_forms: {
        Row: {
          anonymity: Database["public"]["Enums"]["feedback_anonymity"]
          audience: Database["public"]["Enums"]["feedback_audience"]
          closes_at: string | null
          created_at: string
          created_by: string
          description: string | null
          eligible_classes: string[] | null
          eligible_grades: number[] | null
          id: string
          opens_at: string | null
          session_id: string | null
          status: Database["public"]["Enums"]["feedback_form_status"]
          title: string
          type: Database["public"]["Enums"]["feedback_type"]
          updated_at: string
        }
        Insert: {
          anonymity?: Database["public"]["Enums"]["feedback_anonymity"]
          audience?: Database["public"]["Enums"]["feedback_audience"]
          closes_at?: string | null
          created_at?: string
          created_by: string
          description?: string | null
          eligible_classes?: string[] | null
          eligible_grades?: number[] | null
          id?: string
          opens_at?: string | null
          session_id?: string | null
          status?: Database["public"]["Enums"]["feedback_form_status"]
          title: string
          type?: Database["public"]["Enums"]["feedback_type"]
          updated_at?: string
        }
        Update: {
          anonymity?: Database["public"]["Enums"]["feedback_anonymity"]
          audience?: Database["public"]["Enums"]["feedback_audience"]
          closes_at?: string | null
          created_at?: string
          created_by?: string
          description?: string | null
          eligible_classes?: string[] | null
          eligible_grades?: number[] | null
          id?: string
          opens_at?: string | null
          session_id?: string | null
          status?: Database["public"]["Enums"]["feedback_form_status"]
          title?: string
          type?: Database["public"]["Enums"]["feedback_type"]
          updated_at?: string
        }
        Relationships: []
      }
      feedback_questions: {
        Row: {
          created_at: string
          form_id: string
          id: string
          options: Json | null
          position: number
          question_type: Database["public"]["Enums"]["feedback_question_type"]
          required: boolean
          scale_max: number | null
          scale_max_label: string | null
          scale_min: number | null
          scale_min_label: string | null
          text: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          form_id: string
          id?: string
          options?: Json | null
          position?: number
          question_type: Database["public"]["Enums"]["feedback_question_type"]
          required?: boolean
          scale_max?: number | null
          scale_max_label?: string | null
          scale_min?: number | null
          scale_min_label?: string | null
          text: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          form_id?: string
          id?: string
          options?: Json | null
          position?: number
          question_type?: Database["public"]["Enums"]["feedback_question_type"]
          required?: boolean
          scale_max?: number | null
          scale_max_label?: string | null
          scale_min?: number | null
          scale_min_label?: string | null
          text?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "feedback_questions_form_id_fkey"
            columns: ["form_id"]
            isOneToOne: false
            referencedRelation: "feedback_forms"
            referencedColumns: ["id"]
          },
        ]
      }
      feedback_responses: {
        Row: {
          class_id: string | null
          form_id: string
          id: string
          is_identified: boolean
          respondent_id: string | null
          subject_teacher_id: string | null
          submitted_at: string
          updated_at: string
        }
        Insert: {
          class_id?: string | null
          form_id: string
          id?: string
          is_identified?: boolean
          respondent_id?: string | null
          subject_teacher_id?: string | null
          submitted_at?: string
          updated_at?: string
        }
        Update: {
          class_id?: string | null
          form_id?: string
          id?: string
          is_identified?: boolean
          respondent_id?: string | null
          subject_teacher_id?: string | null
          submitted_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "feedback_responses_form_id_fkey"
            columns: ["form_id"]
            isOneToOne: false
            referencedRelation: "feedback_forms"
            referencedColumns: ["id"]
          },
        ]
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
          initials: string | null
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
          initials?: string | null
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
          initials?: string | null
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
          added_by_admin: string | null
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
          added_by_admin?: string | null
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
          added_by_admin?: string | null
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
      schedule_entries: {
        Row: {
          created_at: string
          day_of_week: number
          id: string
          period: number
          room: string | null
          schedule_id: string
          subject: string
          teacher_name: string | null
        }
        Insert: {
          created_at?: string
          day_of_week: number
          id?: string
          period: number
          room?: string | null
          schedule_id: string
          subject: string
          teacher_name?: string | null
        }
        Update: {
          created_at?: string
          day_of_week?: number
          id?: string
          period?: number
          room?: string | null
          schedule_id?: string
          subject?: string
          teacher_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "schedule_entries_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "class_schedules"
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
      subjects: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          name: string
          short_name: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          short_name?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          short_name?: string | null
          updated_at?: string
        }
        Relationships: []
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
      teacher_subjects: {
        Row: {
          created_at: string
          id: string
          subject_id: string
          teacher_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          subject_id: string
          teacher_id: string
        }
        Update: {
          created_at?: string
          id?: string
          subject_id?: string
          teacher_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "teacher_subjects_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
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
      volunteer_attendance: {
        Row: {
          checkin_at: string | null
          created_at: string
          day_id: string
          id: string
          marked_by: string | null
          notes: string | null
          status: Database["public"]["Enums"]["club_attendance_status"]
          student_id: string
          updated_at: string
        }
        Insert: {
          checkin_at?: string | null
          created_at?: string
          day_id: string
          id?: string
          marked_by?: string | null
          notes?: string | null
          status?: Database["public"]["Enums"]["club_attendance_status"]
          student_id: string
          updated_at?: string
        }
        Update: {
          checkin_at?: string | null
          created_at?: string
          day_id?: string
          id?: string
          marked_by?: string | null
          notes?: string | null
          status?: Database["public"]["Enums"]["club_attendance_status"]
          student_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "volunteer_attendance_day_id_fkey"
            columns: ["day_id"]
            isOneToOne: false
            referencedRelation: "volunteer_days"
            referencedColumns: ["id"]
          },
        ]
      }
      volunteer_coordinators: {
        Row: {
          assigned_by: string
          created_at: string
          id: string
          project_id: string
          user_id: string
        }
        Insert: {
          assigned_by: string
          created_at?: string
          id?: string
          project_id: string
          user_id: string
        }
        Update: {
          assigned_by?: string
          created_at?: string
          id?: string
          project_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "volunteer_coordinators_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "volunteer_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      volunteer_days: {
        Row: {
          created_at: string
          created_by: string
          date: string
          end_time: string
          id: string
          location: string | null
          notes: string | null
          project_id: string
          qr_code_data: string
          start_time: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          date: string
          end_time: string
          id?: string
          location?: string | null
          notes?: string | null
          project_id: string
          qr_code_data?: string
          start_time: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          date?: string
          end_time?: string
          id?: string
          location?: string | null
          notes?: string | null
          project_id?: string
          qr_code_data?: string
          start_time?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "volunteer_days_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "volunteer_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      volunteer_enrollments: {
        Row: {
          created_at: string
          enrolled_at: string
          id: string
          project_id: string
          status: Database["public"]["Enums"]["club_enrollment_status"]
          student_id: string
          updated_at: string
          withdrawn_at: string | null
        }
        Insert: {
          created_at?: string
          enrolled_at?: string
          id?: string
          project_id: string
          status?: Database["public"]["Enums"]["club_enrollment_status"]
          student_id: string
          updated_at?: string
          withdrawn_at?: string | null
        }
        Update: {
          created_at?: string
          enrolled_at?: string
          id?: string
          project_id?: string
          status?: Database["public"]["Enums"]["club_enrollment_status"]
          student_id?: string
          updated_at?: string
          withdrawn_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "volunteer_enrollments_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "volunteer_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      volunteer_projects: {
        Row: {
          created_at: string
          created_by: string
          description: string | null
          eligible_classes: string[] | null
          eligible_grades: number[] | null
          end_date: string
          enrollment_close_at: string | null
          enrollment_open_at: string | null
          id: string
          location: string | null
          max_capacity: number | null
          max_per_class: number | null
          name: string
          session_id: string
          start_date: string
          status: Database["public"]["Enums"]["volunteer_project_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          description?: string | null
          eligible_classes?: string[] | null
          eligible_grades?: number[] | null
          end_date: string
          enrollment_close_at?: string | null
          enrollment_open_at?: string | null
          id?: string
          location?: string | null
          max_capacity?: number | null
          max_per_class?: number | null
          name: string
          session_id: string
          start_date: string
          status?: Database["public"]["Enums"]["volunteer_project_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          description?: string | null
          eligible_classes?: string[] | null
          eligible_grades?: number[] | null
          end_date?: string
          enrollment_close_at?: string | null
          enrollment_open_at?: string | null
          id?: string
          location?: string | null
          max_capacity?: number | null
          max_per_class?: number | null
          name?: string
          session_id?: string
          start_date?: string
          status?: Database["public"]["Enums"]["volunteer_project_status"]
          updated_at?: string
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
      check_club_enrollment: {
        Args: { _club_id: string; _student_id: string }
        Returns: Json
      }
      check_feedback_submission: {
        Args: { _form_id: string; _teacher_id: string; _user_id: string }
        Returns: Json
      }
      check_volunteer_enrollment: {
        Args: { _project_id: string; _student_id: string }
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
      get_club_id_for_meeting: {
        Args: { _meeting_id: string }
        Returns: string
      }
      get_events_reserved_counts: {
        Args: { _event_ids: string[] }
        Returns: Json
      }
      get_form_id_for_question: {
        Args: { _question_id: string }
        Returns: string
      }
      get_form_id_for_response: {
        Args: { _response_id: string }
        Returns: string
      }
      get_project_id_for_day: { Args: { _day_id: string }; Returns: string }
      get_response_meta: {
        Args: { _response_id: string }
        Returns: {
          form_id: string
          respondent_id: string
          subject_teacher_id: string
        }[]
      }
      get_student_progress: {
        Args: { _session_id: string; _student_id: string }
        Returns: Json
      }
      get_teacher_initials_map: {
        Args: never
        Returns: {
          first_name: string
          initials: string
          last_name: string
        }[]
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
      is_club_coordinator: {
        Args: { _club_id: string; _user_id: string }
        Returns: boolean
      }
      is_club_creator: {
        Args: { _club_id: string; _user_id: string }
        Returns: boolean
      }
      is_club_enrolled: {
        Args: { _club_id: string; _user_id: string }
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
      is_feedback_creator: {
        Args: { _form_id: string; _user_id: string }
        Returns: boolean
      }
      is_feedback_subject_teacher: {
        Args: { _response_id: string; _user_id: string }
        Returns: boolean
      }
      is_student_eligible_for_form: {
        Args: { _form_id: string; _user_id: string }
        Returns: boolean
      }
      is_teacher_for_student: {
        Args: { _student_id: string; _teacher_id: string }
        Returns: boolean
      }
      is_volunteer_coordinator: {
        Args: { _project_id: string; _user_id: string }
        Returns: boolean
      }
      is_volunteer_creator: {
        Args: { _project_id: string; _user_id: string }
        Returns: boolean
      }
      is_volunteer_enrolled: {
        Args: { _project_id: string; _user_id: string }
        Returns: boolean
      }
      lookup_public_reservation: { Args: { p_code: string }; Returns: Json }
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
      club_attendance_status: "present" | "late" | "absent"
      club_enrollment_status: "enrolled" | "withdrawn"
      club_status: "draft" | "active" | "archived"
      event_status: "draft" | "published" | "closed" | "cancelled"
      feedback_anonymity: "anonymous" | "identified" | "anonymous_optional"
      feedback_audience: "students" | "teachers"
      feedback_form_status: "draft" | "active" | "closed"
      feedback_question_type:
        | "single_choice"
        | "multi_choice"
        | "dropdown"
        | "scale"
        | "open_text"
      feedback_type: "general" | "teacher_feedback" | "teacher_survey"
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
      volunteer_project_status: "draft" | "active" | "closed"
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
      club_attendance_status: ["present", "late", "absent"],
      club_enrollment_status: ["enrolled", "withdrawn"],
      club_status: ["draft", "active", "archived"],
      event_status: ["draft", "published", "closed", "cancelled"],
      feedback_anonymity: ["anonymous", "identified", "anonymous_optional"],
      feedback_audience: ["students", "teachers"],
      feedback_form_status: ["draft", "active", "closed"],
      feedback_question_type: [
        "single_choice",
        "multi_choice",
        "dropdown",
        "scale",
        "open_text",
      ],
      feedback_type: ["general", "teacher_feedback", "teacher_survey"],
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
      volunteer_project_status: ["draft", "active", "closed"],
    },
  },
} as const
