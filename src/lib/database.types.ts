export type Json = string | number | boolean | null | { [key: string]: Json } | Json[];

interface ClientRow {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  documents_submitted: number;
  documents_required: number;
  status: 'active' | 'overdue' | 'complete';
  issues: number;
  assigned_staff: string | null;
  last_activity: string;
  auth_user_id: string | null;
  created_at: string;
}

interface DocumentRequirementRow {
  id: string;
  client_id: string;
  name: string;
  doc_type: string;
  tax_year: string;
  required: boolean;
  created_at: string;
}

interface DocumentUploadRow {
  id: string;
  client_id: string;
  requirement_id: string | null;
  file_name: string;
  storage_path: string;
  file_size: number | null;
  mime_type: string | null;
  ai_status: 'pending' | 'verified' | 'flagged' | 'rejected';
  uploaded_by: string | null;
  uploaded_at: string;
}

interface AiFlagRow {
  id: string;
  client_id: string;
  upload_id: string | null;
  flag_type: 'wrong-year' | 'duplicate' | 'unexpected' | 'missing';
  severity: 'HIGH' | 'MEDIUM' | 'LOW';
  description: string;
  detected_by: string;
  resolved: boolean;
  resolved_at: string | null;
  created_at: string;
}

interface ActivityLogRow {
  id: string;
  client_id: string | null;
  actor: string;
  actor_type: 'ai' | 'staff' | 'client';
  action: string;
  meta: Json | null;
  created_at: string;
}

interface ReminderRow {
  id: string;
  client_id: string;
  sent_by: string | null;
  to_email: string;
  subject: string;
  body: string;
  sent_at: string;
}

export interface Database {
  public: {
    Tables: {
      clients: {
        Row: ClientRow;
        Insert: Omit<ClientRow, 'id' | 'created_at'> & { id?: string; created_at?: string };
        Update: Partial<Omit<ClientRow, 'id' | 'created_at'> & { id?: string; created_at?: string }>;
        Relationships: [];
      };
      document_requirements: {
        Row: DocumentRequirementRow;
        Insert: Omit<DocumentRequirementRow, 'id' | 'created_at'> & { id?: string; created_at?: string };
        Update: Partial<Omit<DocumentRequirementRow, 'id' | 'created_at'> & { id?: string; created_at?: string }>;
        Relationships: [];
      };
      document_uploads: {
        Row: DocumentUploadRow;
        Insert: Omit<DocumentUploadRow, 'id' | 'uploaded_at'> & { id?: string; uploaded_at?: string };
        Update: Partial<Omit<DocumentUploadRow, 'id' | 'uploaded_at'> & { id?: string; uploaded_at?: string }>;
        Relationships: [];
      };
      ai_flags: {
        Row: AiFlagRow;
        Insert: Omit<AiFlagRow, 'id' | 'created_at'> & { id?: string; created_at?: string };
        Update: Partial<Omit<AiFlagRow, 'id' | 'created_at'> & { id?: string; created_at?: string }>;
        Relationships: [];
      };
      activity_log: {
        Row: ActivityLogRow;
        Insert: Omit<ActivityLogRow, 'id' | 'created_at' | 'meta'> & { id?: string; created_at?: string; meta?: Json | null };
        Update: Partial<Omit<ActivityLogRow, 'id' | 'created_at'> & { id?: string; created_at?: string }>;
        Relationships: [];
      };
      reminders: {
        Row: ReminderRow;
        Insert: Omit<ReminderRow, 'id' | 'sent_at'> & { id?: string; sent_at?: string };
        Update: Partial<Omit<ReminderRow, 'id' | 'sent_at'> & { id?: string; sent_at?: string }>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
