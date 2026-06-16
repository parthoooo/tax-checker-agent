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
  public: {
    Tables: {
      activity_log: {
        Row: {
          action: string
          actor: string
          actor_type: string
          client_id: string | null
          created_at: string
          id: string
          meta: Json | null
        }
        Insert: {
          action: string
          actor: string
          actor_type: string
          client_id?: string | null
          created_at?: string
          id?: string
          meta?: Json | null
        }
        Update: {
          action?: string
          actor?: string
          actor_type?: string
          client_id?: string | null
          created_at?: string
          id?: string
          meta?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "activity_log_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_flags: {
        Row: {
          client_id: string
          created_at: string
          description: string
          detected_by: string
          flag_type: string
          id: string
          resolved: boolean
          resolved_at: string | null
          severity: string
          upload_id: string | null
        }
        Insert: {
          client_id: string
          created_at?: string
          description: string
          detected_by?: string
          flag_type: string
          id?: string
          resolved?: boolean
          resolved_at?: string | null
          severity?: string
          upload_id?: string | null
        }
        Update: {
          client_id?: string
          created_at?: string
          description?: string
          detected_by?: string
          flag_type?: string
          id?: string
          resolved?: boolean
          resolved_at?: string | null
          severity?: string
          upload_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_flags_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_flags_upload_id_fkey"
            columns: ["upload_id"]
            isOneToOne: false
            referencedRelation: "document_uploads"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          assigned_preparer: string | null
          assigned_staff: string | null
          auth_user_id: string | null
          created_at: string
          documents_required: number
          documents_submitted: number
          email: string
          id: string
          issues: number
          last_activity: string
          name: string
          phone: string | null
          reminder_cadence_days: number
          status: string
        }
        Insert: {
          assigned_preparer?: string | null
          assigned_staff?: string | null
          auth_user_id?: string | null
          created_at?: string
          documents_required?: number
          documents_submitted?: number
          email: string
          id?: string
          issues?: number
          last_activity?: string
          name: string
          phone?: string | null
          reminder_cadence_days?: number
          status?: string
        }
        Update: {
          assigned_preparer?: string | null
          assigned_staff?: string | null
          auth_user_id?: string | null
          created_at?: string
          documents_required?: number
          documents_submitted?: number
          email?: string
          id?: string
          issues?: number
          last_activity?: string
          name?: string
          phone?: string | null
          reminder_cadence_days?: number
          status?: string
        }
        Relationships: []
      }
      document_requirements: {
        Row: {
          client_id: string
          created_at: string
          doc_type: string
          id: string
          name: string
          required: boolean
          tax_year: string
        }
        Insert: {
          client_id: string
          created_at?: string
          doc_type: string
          id?: string
          name: string
          required?: boolean
          tax_year?: string
        }
        Update: {
          client_id?: string
          created_at?: string
          doc_type?: string
          id?: string
          name?: string
          required?: boolean
          tax_year?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_requirements_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      document_uploads: {
        Row: {
          ai_status: string
          client_id: string
          file_name: string
          file_size: number | null
          id: string
          is_prior_year: boolean
          mime_type: string | null
          requirement_id: string | null
          storage_path: string
          tax_year: string
          uploaded_at: string
          uploaded_by: string | null
        }
        Insert: {
          ai_status?: string
          client_id: string
          file_name: string
          file_size?: number | null
          id?: string
          is_prior_year?: boolean
          mime_type?: string | null
          requirement_id?: string | null
          storage_path: string
          tax_year?: string
          uploaded_at?: string
          uploaded_by?: string | null
        }
        Update: {
          ai_status?: string
          client_id?: string
          file_name?: string
          file_size?: number | null
          id?: string
          is_prior_year?: boolean
          mime_type?: string | null
          requirement_id?: string | null
          storage_path?: string
          tax_year?: string
          uploaded_at?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "document_uploads_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_uploads_requirement_id_fkey"
            columns: ["requirement_id"]
            isOneToOne: false
            referencedRelation: "document_requirements"
            referencedColumns: ["id"]
          },
        ]
      }
      email_drafts: {
        Row: {
          body: string
          client_id: string
          created_at: string
          created_by: string | null
          from_label: string | null
          id: string
          sent_at: string | null
          status: string
          subject: string
          to_email: string
        }
        Insert: {
          body: string
          client_id: string
          created_at?: string
          created_by?: string | null
          from_label?: string | null
          id?: string
          sent_at?: string | null
          status?: string
          subject: string
          to_email: string
        }
        Update: {
          body?: string
          client_id?: string
          created_at?: string
          created_by?: string | null
          from_label?: string | null
          id?: string
          sent_at?: string | null
          status?: string
          subject?: string
          to_email?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_drafts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      input_sheet_entries: {
        Row: {
          ai_populated: boolean
          client_id: string
          created_at: string
          field_name: string
          field_value: string | null
          id: string
          section: string
          tax_year: string
          verified: boolean
        }
        Insert: {
          ai_populated?: boolean
          client_id: string
          created_at?: string
          field_name: string
          field_value?: string | null
          id?: string
          section: string
          tax_year?: string
          verified?: boolean
        }
        Update: {
          ai_populated?: boolean
          client_id?: string
          created_at?: string
          field_name?: string
          field_value?: string | null
          id?: string
          section?: string
          tax_year?: string
          verified?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "input_sheet_entries_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      magic_link_tokens: {
        Row: {
          client_id: string
          created_at: string
          expires_at: string
          id: string
          token: string
          used_at: string | null
        }
        Insert: {
          client_id: string
          created_at?: string
          expires_at?: string
          id?: string
          token?: string
          used_at?: string | null
        }
        Update: {
          client_id?: string
          created_at?: string
          expires_at?: string
          id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "magic_link_tokens_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      reminders: {
        Row: {
          body: string
          client_id: string
          id: string
          sent_at: string
          sent_by: string | null
          subject: string
          to_email: string
        }
        Insert: {
          body: string
          client_id: string
          id?: string
          sent_at?: string
          sent_by?: string | null
          subject: string
          to_email: string
        }
        Update: {
          body?: string
          client_id?: string
          id?: string
          sent_at?: string
          sent_by?: string | null
          subject?: string
          to_email?: string
        }
        Relationships: [
          {
            foreignKeyName: "reminders_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      time_entries: {
        Row: {
          client_id: string
          created_at: string
          ended_at: string | null
          id: string
          note: string | null
          started_at: string
          user_id: string | null
        }
        Insert: {
          client_id: string
          created_at?: string
          ended_at?: string | null
          id?: string
          note?: string | null
          started_at?: string
          user_id?: string | null
        }
        Update: {
          client_id?: string
          created_at?: string
          ended_at?: string | null
          id?: string
          note?: string | null
          started_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "time_entries_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      client_has_active_magic_token: {
        Args: { _client_id: string }
        Returns: boolean
      }
      is_admin: { Args: never; Returns: boolean }
      resolve_magic_link: {
        Args: { _token: string }
        Returns: {
          assigned_preparer: string
          client_email: string
          client_id: string
          client_name: string
          expires_at: string
          token_id: string
        }[]
      }
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
