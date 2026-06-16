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
  assigned_preparer: string | null;
  reminder_cadence_days: number;
  last_activity: string;
  auth_user_id: string | null;
  business_type: 'employee' | 'freelancer' | 'partnership';
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
  tax_year: string;
  is_prior_year: boolean;
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

interface MagicLinkTokenRow {
  id: string;
  client_id: string;
  token: string;
  expires_at: string;
  used_at: string | null;
  created_at: string;
}

interface EmailDraftRow {
  id: string;
  client_id: string;
  to_email: string;
  from_label: string | null;
  subject: string;
  body: string;
  status: 'pending' | 'approved' | 'sent' | 'dismissed';
  /** Discriminates outbox emails from scheduled reminder emails. Null treated as 'outbox'. */
  type: 'outbox' | 'reminder' | null;
  created_by: string | null;
  sent_at: string | null;
  created_at: string;
}

interface InputSheetEntryRow {
  id: string;
  client_id: string;
  tax_year: string;
  section: string;
  field_name: string;
  field_value: string | null;
  ai_populated: boolean;
  verified: boolean;
  created_at: string;
}

interface TimeEntryRow {
  id: string;
  client_id: string;
  user_id: string | null;
  started_at: string;
  ended_at: string | null;
  note: string | null;
  created_at: string;
}

interface SignupRequestRow {
  id: string;
  auth_user_id: string;
  email: string;
  full_name: string;
  provider: string;
  status: 'pending' | 'approved' | 'rejected';
  approved_role: 'client' | 'preparer' | 'admin' | null;
  approved_by: string | null;
  approved_at: string | null;
  rejected_reason: string | null;
  created_at: string;
}

interface ClientCorrectionRow {
  id: string;
  client_id: string;
  tax_year: string;
  comparison_snapshot: Json;
  staff_message: string | null;
  status: 'sent' | 'resolved';
  sent_by: string | null;
  sent_at: string;
  resolved_at: string | null;
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
        Insert: Omit<AiFlagRow, 'id' | 'created_at' | 'resolved' | 'resolved_at'> & {
          id?: string;
          created_at?: string;
          resolved?: boolean;
          resolved_at?: string | null;
        };
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
      magic_link_tokens: {
        Row: MagicLinkTokenRow;
        Insert: Omit<MagicLinkTokenRow, 'id' | 'created_at'> & { id?: string; created_at?: string };
        Update: Partial<MagicLinkTokenRow>;
        Relationships: [];
      };
      email_drafts: {
        Row: EmailDraftRow;
        Insert: Omit<EmailDraftRow, 'id' | 'created_at' | 'created_by' | 'sent_at' | 'from_label' | 'type'> & {
          id?: string;
          created_at?: string;
          created_by?: string | null;
          sent_at?: string | null;
          from_label?: string | null;
          type?: 'outbox' | 'reminder' | null;
        };
        Update: Partial<EmailDraftRow>;
        Relationships: [];
      };
      input_sheet_entries: {
        Row: InputSheetEntryRow;
        Insert: Omit<InputSheetEntryRow, 'id' | 'created_at'> & { id?: string; created_at?: string };
        Update: Partial<InputSheetEntryRow>;
        Relationships: [];
      };
      time_entries: {
        Row: TimeEntryRow;
        Insert: Omit<TimeEntryRow, 'id' | 'created_at'> & { id?: string; created_at?: string };
        Update: Partial<TimeEntryRow>;
        Relationships: [];
      };
      signup_requests: {
        Row: SignupRequestRow;
        Insert: Omit<SignupRequestRow, 'id' | 'created_at' | 'status' | 'approved_role' | 'approved_by' | 'approved_at' | 'rejected_reason'> & {
          id?: string;
          created_at?: string;
          status?: SignupRequestRow['status'];
          approved_role?: SignupRequestRow['approved_role'];
          approved_by?: string | null;
          approved_at?: string | null;
          rejected_reason?: string | null;
        };
        Update: Partial<SignupRequestRow>;
        Relationships: [];
      };
      client_corrections: {
        Row: ClientCorrectionRow;
        Insert: Omit<ClientCorrectionRow, 'id' | 'sent_at' | 'resolved_at'> & {
          id?: string;
          sent_at?: string;
          resolved_at?: string | null;
        };
        Update: Partial<ClientCorrectionRow>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
