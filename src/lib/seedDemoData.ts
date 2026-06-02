/**
 * Presentation demo seeder.
 * Populates the DB with a full, realistic dataset so every screen has rich
 * content without needing to upload real files.
 *
 * Safe to run multiple times — clears existing AI-generated data first.
 */

import { supabase as typedSupabase } from './supabase';
import { generateInputSheetData, generateEmailDraft } from './aiSimulation';

const supabase: any = typedSupabase;

const TAX_YEAR = '2024';

// ── Types ────────────────────────────────────────────────────────────────────

interface UploadDef {
  file_name: string;
  ai_status: 'verified' | 'flagged' | 'rejected';
  file_size: number;
  mime_type: string;
}

interface FlagDef {
  flag_type: 'wrong-year' | 'duplicate' | 'unexpected' | 'missing';
  severity: 'HIGH' | 'MEDIUM' | 'LOW';
  description: string;
  detected_by?: string;
  upload_index: number | null;
  resolved?: boolean;
  resolvedMinutesAgo?: number;
}

interface ActivityDef {
  actor: string;
  actor_type: 'ai' | 'staff' | 'client';
  action: string;
  minutesAgo: number;
}

interface EmailDef {
  subject: string;
  missingDocs: string[];
  preparer: string;
  status: 'pending' | 'sent';
  sentMinutesAgo?: number;
}

interface ReminderDef {
  subject: string;
  body: string;
  minutesAgo: number;
}

interface TimeSessionDef {
  hours: number;
  hoursAgoStart: number; // when session started, in hours ago
  note: string;
}

interface RequirementDef {
  name: string;
  doc_type: string;
}

interface Scenario {
  requirements: RequirementDef[];
  uploads: UploadDef[];
  flags: FlagDef[];
  activities: ActivityDef[];
  emails: EmailDef[];
  reminders: ReminderDef[];
  timeSessions: TimeSessionDef[];
  inputFileNames: string[];
}

// ── Reusable activity packs ──────────────────────────────────────────────────

const agentLine = (
  actor: string,
  action: string,
  minutesAgo: number,
): ActivityDef => ({ actor, actor_type: 'ai', action, minutesAgo });

const clientLine = (
  actor: string,
  action: string,
  minutesAgo: number,
): ActivityDef => ({ actor, actor_type: 'client', action, minutesAgo });

const staffLine = (
  actor: string,
  action: string,
  minutesAgo: number,
): ActivityDef => ({ actor, actor_type: 'staff', action, minutesAgo });

// ── Per-client scenarios ─────────────────────────────────────────────────────

const SCENARIOS: Record<string, Scenario> = {

  // ── John Smith — Active, partially done, wrong-year flag + history ────────
  'John Smith': {
    requirements: [
      { name: 'W-2 (Goldman Sachs)',    doc_type: 'w2'       },
      { name: '1099-INT (Fidelity)',    doc_type: '1099-int' },
      { name: '1099-NEC',               doc_type: '1099-nec' },
      { name: '1098 Mortgage',          doc_type: '1098'     },
      { name: 'K-1 Partnership',        doc_type: 'k1'       },
    ],
    uploads: [
      { file_name: 'W2_2024_GoldmanSachs.pdf',  ai_status: 'verified', file_size: 248320, mime_type: 'application/pdf' },
      { file_name: 'W2_2023_old.pdf',            ai_status: 'flagged',  file_size: 212000, mime_type: 'application/pdf' },
      { file_name: '1099-INT_fidelity_2024.pdf', ai_status: 'verified', file_size: 134144, mime_type: 'application/pdf' },
      { file_name: '1099-NEC_2024_client.pdf',   ai_status: 'verified', file_size: 125000, mime_type: 'application/pdf' },
      { file_name: '1099-NEC_2024_client_copy.pdf', ai_status: 'flagged', file_size: 125000, mime_type: 'application/pdf' },
      { file_name: '1098_mortgage_chase_2024.pdf', ai_status: 'verified', file_size: 198000, mime_type: 'application/pdf' },
      { file_name: 'random_receipt.jpg',         ai_status: 'rejected', file_size: 86000,  mime_type: 'image/jpeg' },
    ],
    flags: [
      { flag_type: 'wrong-year', severity: 'HIGH',
        description: 'W2_2023_old.pdf — tax year 2023 detected, 2024 required. Client must re-upload.',
        upload_index: 1, detected_by: 'Doc Classifier Agent' },
      { flag_type: 'duplicate', severity: 'MEDIUM',
        description: 'Duplicate 1099-NEC: 1099-NEC_2024_client_copy.pdf matches an earlier upload.',
        upload_index: 4, detected_by: 'Duplicate Detector Agent' },
      { flag_type: 'unexpected', severity: 'LOW',
        description: 'random_receipt.jpg is not a recognized tax form. Auto-rejected.',
        upload_index: 6, detected_by: 'Doc Classifier Agent',
        resolved: true, resolvedMinutesAgo: 40 },
      { flag_type: 'missing', severity: 'MEDIUM',
        description: 'K-1 Partnership statement still outstanding — reminder queued.',
        upload_index: null, detected_by: 'Missing Doc Tracker Agent' },
    ],
    emails: [
      { subject: 'Action Required: Wrong Tax Year — W2_2023_old.pdf',
        missingDocs: ['2024 W-2 (re-upload)'], preparer: 'Sean Mansoor', status: 'pending' },
      { subject: 'Welcome to the 2024 Tax Season',
        missingDocs: ['W-2', '1099-INT', '1099-NEC', '1098', 'K-1'],
        preparer: 'Sean Mansoor', status: 'sent', sentMinutesAgo: 1440 * 4 },
      { subject: 'Reminder: K-1 Partnership Statement Outstanding',
        missingDocs: ['K-1 Partnership'], preparer: 'Sean Mansoor', status: 'sent', sentMinutesAgo: 1440 },
    ],
    reminders: [
      { subject: 'Reminder: Missing Tax Documents',
        body: 'Hi John, friendly reminder that we are still waiting on your K-1 partnership statement.',
        minutesAgo: 1440 },
      { subject: 'Welcome — Secure upload link inside',
        body: 'Hi John, your secure upload portal is ready. Please get started when convenient.',
        minutesAgo: 1440 * 5 },
    ],
    timeSessions: [
      { hours: 1.5, hoursAgoStart: 6,   note: 'Initial document review — Sean' },
      { hours: 0.75, hoursAgoStart: 30, note: 'Wrong-year follow-up email drafting — Sean' },
      { hours: 0.5,  hoursAgoStart: 54, note: 'Input sheet review — Girik' },
    ],
    activities: [
      clientLine('John Smith', 'Opened secure upload portal',                                                  1440 * 5),
      agentLine('Doc Classifier Agent', 'Created document checklist for John Smith (5 required)',              1440 * 5 - 10),
      clientLine('John Smith', 'Uploaded W2_2024_GoldmanSachs.pdf via magic link portal',                       95),
      agentLine('Doc Classifier Agent', 'Verified W2_2024_GoldmanSachs.pdf — Goldman Sachs, confidence 98%',    94),
      clientLine('John Smith', 'Uploaded W2_2023_old.pdf via magic link portal',                                88),
      agentLine('Doc Classifier Agent', 'Wrong year detected in W2_2023_old.pdf — 2023 doc, 2024 required',     87),
      agentLine('Follow-up Sender Agent', 'Drafted correction email for wrong-year document — pending approval', 86),
      clientLine('John Smith', 'Uploaded 1099-INT_fidelity_2024.pdf',                                            70),
      agentLine('Doc Classifier Agent', 'Verified 1099-INT_fidelity_2024.pdf — interest income, confidence 96%', 69),
      clientLine('John Smith', 'Uploaded 1099-NEC_2024_client.pdf',                                              65),
      agentLine('Doc Classifier Agent', 'Verified 1099-NEC_2024_client.pdf — payer detected, confidence 95%',    64),
      clientLine('John Smith', 'Uploaded 1099-NEC_2024_client_copy.pdf',                                         60),
      agentLine('Duplicate Detector Agent', 'Blocked duplicate 1099-NEC upload — identical to earlier file',     59),
      clientLine('John Smith', 'Uploaded 1098_mortgage_chase_2024.pdf',                                          55),
      agentLine('Doc Classifier Agent', 'Verified 1098_mortgage_chase_2024.pdf — Chase Home Lending',            54),
      clientLine('John Smith', 'Uploaded random_receipt.jpg',                                                     45),
      agentLine('Doc Classifier Agent', 'random_receipt.jpg rejected — not a recognized tax form',                44),
      staffLine('Sean Mansoor', 'Marked unexpected-file flag as resolved',                                        40),
      agentLine('Missing Doc Tracker Agent', 'John Smith still missing K-1 Partnership — reminder queued',        30),
    ],
    inputFileNames: ['W2_2024_GoldmanSachs.pdf', '1099-INT_fidelity_2024.pdf', '1099-NEC_2024_client.pdf', '1098_mortgage_chase_2024.pdf'],
  },

  // ── Michael Brown — Overdue, several flags, history of sent reminders ─────
  'Michael Brown': {
    requirements: [
      { name: 'W-2',               doc_type: 'w2'       },
      { name: '1099-NEC (Upwork)', doc_type: '1099-nec' },
      { name: '1098 Mortgage',     doc_type: '1098'     },
      { name: 'Schedule C',        doc_type: 'sched-c'  },
      { name: '1099-INT',          doc_type: '1099-int' },
    ],
    uploads: [
      { file_name: 'bankstatement_jan2024.pdf', ai_status: 'flagged',  file_size: 98304,  mime_type: 'application/pdf' },
      { file_name: '1099-NEC_2024_mbrown.pdf',  ai_status: 'verified', file_size: 128000, mime_type: 'application/pdf' },
      { file_name: 'W2_2023_mbrown.pdf',        ai_status: 'flagged',  file_size: 188000, mime_type: 'application/pdf' },
      { file_name: 'receipt_unrelated.png',     ai_status: 'rejected', file_size: 64000,  mime_type: 'image/png' },
      { file_name: '1098_mortgage_2024_mb.pdf', ai_status: 'verified', file_size: 175000, mime_type: 'application/pdf' },
    ],
    flags: [
      { flag_type: 'unexpected', severity: 'MEDIUM',
        description: 'Bank statement (bankstatement_jan2024.pdf) is not a required 2024 tax document.',
        upload_index: 0, detected_by: 'Doc Classifier Agent' },
      { flag_type: 'wrong-year', severity: 'HIGH',
        description: 'W2_2023_mbrown.pdf is for tax year 2023, not 2024.',
        upload_index: 2, detected_by: 'Doc Classifier Agent' },
      { flag_type: 'unexpected', severity: 'LOW',
        description: 'receipt_unrelated.png — image not recognized as a tax form.',
        upload_index: 3, detected_by: 'Doc Classifier Agent',
        resolved: true, resolvedMinutesAgo: 120 },
      { flag_type: 'missing', severity: 'HIGH',
        description: 'Still missing: W-2 (2024), Schedule C, 1099-INT after 7 days of inactivity.',
        upload_index: null, detected_by: 'Missing Doc Tracker Agent' },
    ],
    emails: [
      { subject: 'Action Required: Missing Tax Documents',
        missingDocs: ['W-2 (2024)', '1098 Mortgage Interest Statement', 'Schedule C', '1099-INT'],
        preparer: 'Girik Patel', status: 'pending' },
      { subject: 'Wrong Tax Year on W-2 Upload',
        missingDocs: ['W-2 (2024)'], preparer: 'Girik Patel', status: 'pending' },
      { subject: 'Reminder — 2024 Tax Filing Documents',
        missingDocs: ['W-2', '1098', 'Schedule C'], preparer: 'Girik Patel',
        status: 'sent', sentMinutesAgo: 1440 * 2 },
    ],
    reminders: [
      { subject: 'Urgent: Outstanding Tax Documents',
        body: 'Hi Michael, your filing deadline is approaching. Please upload the missing documents.',
        minutesAgo: 1440 * 2 },
      { subject: 'Welcome — Secure upload link inside',
        body: 'Hi Michael, here is your secure portal link to get started.',
        minutesAgo: 1440 * 8 },
    ],
    timeSessions: [
      { hours: 0.5,  hoursAgoStart: 6,  note: 'Reviewing flagged uploads — Girik' },
      { hours: 0.25, hoursAgoStart: 48, note: 'Phone follow-up — Girik' },
    ],
    activities: [
      clientLine('Michael Brown', 'Opened secure upload portal',                                                 1440 * 8),
      agentLine('Doc Classifier Agent', 'Created document checklist for Michael Brown (5 required)',             1440 * 8 - 5),
      clientLine('Michael Brown', 'Uploaded bankstatement_jan2024.pdf',                                          1440 * 3),
      agentLine('Doc Classifier Agent', 'Bank statement detected — not required for 2024 filing. Flagged.',      1440 * 3 - 1),
      clientLine('Michael Brown', 'Uploaded 1099-NEC_2024_mbrown.pdf',                                           1440 * 3 - 30),
      agentLine('Doc Classifier Agent', 'Verified 1099-NEC_2024_mbrown.pdf — Upwork Global, confidence 97%',     1440 * 3 - 31),
      clientLine('Michael Brown', 'Uploaded W2_2023_mbrown.pdf',                                                 1440 * 2),
      agentLine('Doc Classifier Agent', 'Wrong year detected on W2_2023_mbrown.pdf — needs 2024',                1440 * 2 - 2),
      agentLine('Follow-up Sender Agent', 'Drafted wrong-year correction email',                                  1440 * 2 - 3),
      staffLine('Girik Patel', 'Sent reminder email to mbrown@email.com',                                        1440 * 2),
      clientLine('Michael Brown', 'Uploaded receipt_unrelated.png',                                              1440),
      agentLine('Doc Classifier Agent', 'receipt_unrelated.png rejected — not a recognized form',                1439),
      staffLine('Girik Patel', 'Resolved unexpected-file flag (receipt)',                                         120),
      clientLine('Michael Brown', 'Uploaded 1098_mortgage_2024_mb.pdf',                                           90),
      agentLine('Doc Classifier Agent', 'Verified 1098_mortgage_2024_mb.pdf — Wells Fargo, confidence 96%',       89),
      agentLine('Missing Doc Tracker Agent', 'Michael Brown missing W-2/Schedule C/1099-INT — escalating',        45),
    ],
    inputFileNames: ['1099-NEC_2024_mbrown.pdf', '1098_mortgage_2024_mb.pdf'],
  },

  // ── Sarah Johnson — Complete, all verified ✅ ─────────────────────────────
  'Sarah Johnson': {
    requirements: [
      { name: 'W-2 (NYC Dept. of Education)', doc_type: 'w2'       },
      { name: '1098 Mortgage (Chase)',        doc_type: '1098'     },
      { name: 'Schedule C',                   doc_type: 'sched-c'  },
      { name: '1099-INT (Ally Bank)',         doc_type: '1099-int' },
    ],
    uploads: [
      { file_name: 'W2_2024_NYCDeptEducation.pdf', ai_status: 'verified', file_size: 256000, mime_type: 'application/pdf' },
      { file_name: '1098_mortgage_chase_2024.pdf', ai_status: 'verified', file_size: 195840, mime_type: 'application/pdf' },
      { file_name: 'Schedule_C_2024_complete.pdf', ai_status: 'verified', file_size: 310000, mime_type: 'application/pdf' },
      { file_name: '1099-INT_ally_2024.pdf',       ai_status: 'verified', file_size: 112640, mime_type: 'application/pdf' },
      { file_name: 'extra_donation_receipt.pdf',   ai_status: 'flagged',  file_size: 90000,  mime_type: 'application/pdf' },
    ],
    flags: [
      { flag_type: 'unexpected', severity: 'LOW',
        description: 'extra_donation_receipt.pdf — informational only, not part of required checklist.',
        upload_index: 4, detected_by: 'Doc Classifier Agent',
        resolved: true, resolvedMinutesAgo: 60 },
    ],
    emails: [
      { subject: 'All documents received — thank you!',
        missingDocs: [], preparer: 'Sean Mansoor',
        status: 'sent', sentMinutesAgo: 480 },
      { subject: 'Welcome to the 2024 Tax Season',
        missingDocs: ['W-2', '1098', 'Schedule C', '1099-INT'],
        preparer: 'Sean Mansoor', status: 'sent', sentMinutesAgo: 1440 * 6 },
    ],
    reminders: [
      { subject: 'Welcome — Secure upload link inside',
        body: 'Hi Sarah, here is your secure upload portal link.',
        minutesAgo: 1440 * 6 },
    ],
    timeSessions: [
      { hours: 2.2, hoursAgoStart: 10, note: 'Full review and input sheet sign-off — Sean' },
      { hours: 0.5, hoursAgoStart: 36, note: 'Final QA pass — Sean' },
    ],
    activities: [
      clientLine('Sarah Johnson', 'Uploaded W2_2024_NYCDeptEducation.pdf',                                       720),
      agentLine('Doc Classifier Agent', 'Verified W2_2024_NYCDeptEducation.pdf — NYC DOE, confidence 99%',       719),
      clientLine('Sarah Johnson', 'Uploaded 1098_mortgage_chase_2024.pdf',                                       680),
      agentLine('Doc Classifier Agent', 'Verified 1098_mortgage_chase_2024.pdf — Chase Home Lending, 97%',       679),
      clientLine('Sarah Johnson', 'Uploaded Schedule_C_2024_complete.pdf',                                       640),
      agentLine('Doc Classifier Agent', 'Verified Schedule_C_2024_complete.pdf — gross revenue detected, 95%',   639),
      clientLine('Sarah Johnson', 'Uploaded 1099-INT_ally_2024.pdf',                                             600),
      agentLine('Doc Classifier Agent', 'Verified 1099-INT_ally_2024.pdf — interest income, 98%',                599),
      agentLine('Missing Doc Tracker Agent', 'Sarah Johnson checklist complete — all 4 docs verified ✅',         598),
      clientLine('Sarah Johnson', 'Uploaded extra_donation_receipt.pdf',                                          540),
      agentLine('Doc Classifier Agent', 'extra_donation_receipt.pdf — informational only, flagged',               539),
      staffLine('Sean Mansoor', 'Reviewed all documents — input sheet verified, ready for filing',                480),
      staffLine('Sean Mansoor', 'Marked donation receipt flag as resolved',                                        60),
    ],
    inputFileNames: ['W2_2024_NYCDeptEducation.pdf', '1098_mortgage_chase_2024.pdf', 'Schedule_C_2024_complete.pdf', '1099-INT_ally_2024.pdf'],
  },

  // ── Robert Chen — Overdue, duplicate + missing ────────────────────────────
  'Robert Chen': {
    requirements: [
      { name: 'W-2',             doc_type: 'w2'       },
      { name: '1099-NEC',        doc_type: '1099-nec' },
      { name: '1098 Mortgage',   doc_type: '1098'     },
      { name: 'K-1 Partnership', doc_type: 'k1'       },
      { name: 'Schedule C',      doc_type: 'sched-c'  },
    ],
    uploads: [
      { file_name: 'K1_partnership_alpha_2024.pdf', ai_status: 'verified', file_size: 174080, mime_type: 'application/pdf' },
      { file_name: '1098_mortgage_2024.pdf',        ai_status: 'verified', file_size: 200704, mime_type: 'application/pdf' },
      { file_name: '1098_mortgage_2024.pdf',        ai_status: 'flagged',  file_size: 200704, mime_type: 'application/pdf' },
      { file_name: 'old_w2_2022.pdf',               ai_status: 'flagged',  file_size: 188000, mime_type: 'application/pdf' },
      { file_name: 'irrelevant_paystub.pdf',        ai_status: 'rejected', file_size: 65000,  mime_type: 'application/pdf' },
    ],
    flags: [
      { flag_type: 'duplicate', severity: 'MEDIUM',
        description: 'Duplicate 1098_mortgage_2024.pdf — identical file already exists.',
        upload_index: 2, detected_by: 'Duplicate Detector Agent' },
      { flag_type: 'wrong-year', severity: 'HIGH',
        description: 'old_w2_2022.pdf is for tax year 2022. 2024 W-2 still required.',
        upload_index: 3, detected_by: 'Doc Classifier Agent' },
      { flag_type: 'unexpected', severity: 'LOW',
        description: 'irrelevant_paystub.pdf — paystubs not required for filing.',
        upload_index: 4, detected_by: 'Doc Classifier Agent',
        resolved: true, resolvedMinutesAgo: 200 },
      { flag_type: 'missing', severity: 'MEDIUM',
        description: 'Still missing W-2 (2024), 1099-NEC, and Schedule C.',
        upload_index: null, detected_by: 'Missing Doc Tracker Agent' },
    ],
    emails: [
      { subject: 'Heads Up: Duplicate Document Uploaded',
        missingDocs: ['W-2 (2024)', '1099-NEC', 'Schedule C'],
        preparer: 'Girik Patel', status: 'pending' },
      { subject: 'Action Required: Wrong Tax Year — W-2',
        missingDocs: ['W-2 (2024)'], preparer: 'Girik Patel', status: 'pending' },
      { subject: 'Reminder — 2024 Tax Filing Documents',
        missingDocs: ['W-2', '1099-NEC', 'Schedule C'],
        preparer: 'Girik Patel', status: 'sent', sentMinutesAgo: 1440 * 3 },
    ],
    reminders: [
      { subject: 'Tax Filing Reminder',
        body: 'Hi Robert, your filing window is getting tight. Please upload the missing documents.',
        minutesAgo: 1440 * 3 },
      { subject: 'Welcome — Secure upload link inside',
        body: 'Hi Robert, here is your secure portal link.',
        minutesAgo: 1440 * 9 },
    ],
    timeSessions: [
      { hours: 1.0,  hoursAgoStart: 4,  note: 'Duplicate cleanup + outreach — Girik' },
      { hours: 0.3,  hoursAgoStart: 26, note: 'Reminder follow-up — Girik' },
    ],
    activities: [
      clientLine('Robert Chen', 'Opened secure upload portal',                                                  1440 * 9),
      agentLine('Doc Classifier Agent', 'Created document checklist for Robert Chen (5 required)',              1440 * 9 - 5),
      clientLine('Robert Chen', 'Uploaded K1_partnership_alpha_2024.pdf',                                       300),
      agentLine('Doc Classifier Agent', 'Verified K1_partnership_alpha_2024.pdf — partnership income, 95%',     299),
      clientLine('Robert Chen', 'Uploaded 1098_mortgage_2024.pdf',                                              260),
      agentLine('Doc Classifier Agent', 'Verified 1098_mortgage_2024.pdf — Wells Fargo, 97%',                   259),
      clientLine('Robert Chen', 'Uploaded 1098_mortgage_2024.pdf again (duplicate)',                            220),
      agentLine('Duplicate Detector Agent', 'Blocked duplicate 1098_mortgage_2024.pdf',                          219),
      agentLine('Follow-up Sender Agent', 'Drafted duplicate removal notice',                                    218),
      clientLine('Robert Chen', 'Uploaded old_w2_2022.pdf',                                                      210),
      agentLine('Doc Classifier Agent', 'Wrong year on old_w2_2022.pdf — 2022 detected',                        209),
      clientLine('Robert Chen', 'Uploaded irrelevant_paystub.pdf',                                              205),
      agentLine('Doc Classifier Agent', 'irrelevant_paystub.pdf — not a required form, rejected',               204),
      staffLine('Girik Patel', 'Resolved paystub flag',                                                          200),
      staffLine('Girik Patel', 'Sent reminder email to rchen@email.com',                                         180),
      agentLine('Missing Doc Tracker Agent', 'Robert Chen missing W-2/1099-NEC/Schedule C',                      120),
    ],
    inputFileNames: ['K1_partnership_alpha_2024.pdf', '1098_mortgage_2024.pdf'],
  },

  // ── Maria Rodriguez — Active, mostly verified ─────────────────────────────
  'Maria Rodriguez': {
    requirements: [
      { name: 'W-2 (Deloitte LLP)',  doc_type: 'w2'       },
      { name: '1099-DIV (Vanguard)', doc_type: '1099-div' },
      { name: '1099-NEC',            doc_type: '1099-nec' },
      { name: '1098 Mortgage',       doc_type: '1098'     },
    ],
    uploads: [
      { file_name: 'W2_2024_deloitte.pdf',        ai_status: 'verified', file_size: 237568, mime_type: 'application/pdf' },
      { file_name: '1099-DIV_vanguard_2024.pdf',  ai_status: 'verified', file_size: 118784, mime_type: 'application/pdf' },
      { file_name: '1099-NEC_rodriguez_2024.pdf', ai_status: 'verified', file_size: 131072, mime_type: 'application/pdf' },
      { file_name: '1098_mortgage_2024_mr.pdf',   ai_status: 'verified', file_size: 164000, mime_type: 'application/pdf' },
      { file_name: 'duplicate_1099div.pdf',       ai_status: 'flagged',  file_size: 118784, mime_type: 'application/pdf' },
    ],
    flags: [
      { flag_type: 'duplicate', severity: 'MEDIUM',
        description: 'Duplicate 1099-DIV upload — duplicate_1099div.pdf matches Vanguard file.',
        upload_index: 4, detected_by: 'Duplicate Detector Agent' },
      { flag_type: 'missing', severity: 'LOW',
        description: 'All required docs received — closing missing-doc tracker.',
        upload_index: null, detected_by: 'Missing Doc Tracker Agent',
        resolved: true, resolvedMinutesAgo: 90 },
    ],
    emails: [
      { subject: 'Duplicate 1099-DIV uploaded — please disregard',
        missingDocs: [], preparer: 'Sean Mansoor', status: 'pending' },
      { subject: 'All required documents received',
        missingDocs: [], preparer: 'Sean Mansoor',
        status: 'sent', sentMinutesAgo: 300 },
    ],
    reminders: [
      { subject: 'Welcome — Secure upload link inside',
        body: 'Hi Maria, here is your secure portal link.',
        minutesAgo: 1440 * 4 },
    ],
    timeSessions: [
      { hours: 0.8, hoursAgoStart: 5,  note: 'Initial review — Sean' },
      { hours: 0.4, hoursAgoStart: 26, note: 'Duplicate cleanup — Sean' },
    ],
    activities: [
      clientLine('Maria Rodriguez', 'Uploaded W2_2024_deloitte.pdf',                                            400),
      agentLine('Doc Classifier Agent', 'Verified W2_2024_deloitte.pdf — Deloitte LLP, 98%',                    399),
      clientLine('Maria Rodriguez', 'Uploaded 1099-DIV_vanguard_2024.pdf',                                      360),
      agentLine('Doc Classifier Agent', 'Verified 1099-DIV_vanguard_2024.pdf — Vanguard, 96%',                  359),
      clientLine('Maria Rodriguez', 'Uploaded 1099-NEC_rodriguez_2024.pdf',                                     320),
      agentLine('Doc Classifier Agent', 'Verified 1099-NEC_rodriguez_2024.pdf — Stripe Inc., 97%',              319),
      clientLine('Maria Rodriguez', 'Uploaded 1098_mortgage_2024_mr.pdf',                                       260),
      agentLine('Doc Classifier Agent', 'Verified 1098_mortgage_2024_mr.pdf — Chase, 96%',                      259),
      clientLine('Maria Rodriguez', 'Uploaded duplicate_1099div.pdf',                                           200),
      agentLine('Duplicate Detector Agent', 'Blocked duplicate 1099-DIV — matches earlier Vanguard upload',     199),
      agentLine('Follow-up Sender Agent', 'Drafted duplicate notice email',                                     198),
      agentLine('Missing Doc Tracker Agent', 'All required documents received — checklist complete',             90),
    ],
    inputFileNames: ['W2_2024_deloitte.pdf', '1099-DIV_vanguard_2024.pdf', '1099-NEC_rodriguez_2024.pdf', '1098_mortgage_2024_mr.pdf'],
  },

  // ── David Kim — Active, mixed progress, varied flags ──────────────────────
  'David Kim': {
    requirements: [
      { name: 'W-2',      doc_type: 'w2'       },
      { name: '1099-NEC', doc_type: '1099-nec' },
      { name: '1099-INT', doc_type: '1099-int' },
      { name: '1099-B',   doc_type: '1099-b'   },
      { name: 'K-1',      doc_type: 'k1'       },
      { name: '1098',     doc_type: '1098'     },
    ],
    uploads: [
      { file_name: 'W2_2024_DavidKim.pdf',     ai_status: 'verified', file_size: 240000, mime_type: 'application/pdf' },
      { file_name: '1099-NEC_kim_2024.pdf',    ai_status: 'verified', file_size: 130000, mime_type: 'application/pdf' },
      { file_name: '1099-NEC_kim_copy.pdf',    ai_status: 'flagged',  file_size: 130000, mime_type: 'application/pdf' },
      { file_name: '1099-B_brokerage_2024.pdf', ai_status: 'verified', file_size: 156000, mime_type: 'application/pdf' },
      { file_name: 'random_scan.jpg',          ai_status: 'rejected', file_size: 72000,  mime_type: 'image/jpeg' },
    ],
    flags: [
      { flag_type: 'duplicate', severity: 'MEDIUM',
        description: 'Duplicate 1099-NEC upload (1099-NEC_kim_copy.pdf).',
        upload_index: 2, detected_by: 'Duplicate Detector Agent' },
      { flag_type: 'unexpected', severity: 'LOW',
        description: 'random_scan.jpg — not a recognized tax form.',
        upload_index: 4, detected_by: 'Doc Classifier Agent',
        resolved: true, resolvedMinutesAgo: 100 },
      { flag_type: 'missing', severity: 'MEDIUM',
        description: 'Still missing: 1099-INT, K-1, 1098.',
        upload_index: null, detected_by: 'Missing Doc Tracker Agent' },
    ],
    emails: [
      { subject: 'Reminder: 3 documents still outstanding',
        missingDocs: ['1099-INT', 'K-1 Partnership', '1098 Mortgage'],
        preparer: 'Girik Patel', status: 'pending' },
      { subject: 'Welcome to the 2024 Tax Season',
        missingDocs: ['W-2', '1099-NEC', '1099-INT', '1099-B', 'K-1', '1098'],
        preparer: 'Girik Patel', status: 'sent', sentMinutesAgo: 1440 * 5 },
    ],
    reminders: [
      { subject: 'Reminder: Outstanding Documents',
        body: 'Hi David, we are still waiting on a few documents — please upload when possible.',
        minutesAgo: 1440 * 2 },
    ],
    timeSessions: [
      { hours: 1.1, hoursAgoStart: 8,  note: 'First-pass review — Girik' },
      { hours: 0.4, hoursAgoStart: 36, note: 'Duplicate cleanup — Girik' },
    ],
    activities: [
      clientLine('David Kim', 'Opened secure upload portal',                                                    1440 * 5),
      agentLine('Doc Classifier Agent', 'Created document checklist for David Kim (6 required)',                 1440 * 5 - 5),
      clientLine('David Kim', 'Uploaded W2_2024_DavidKim.pdf',                                                   500),
      agentLine('Doc Classifier Agent', 'Verified W2_2024_DavidKim.pdf — employer detected, 98%',                499),
      clientLine('David Kim', 'Uploaded 1099-NEC_kim_2024.pdf',                                                  420),
      agentLine('Doc Classifier Agent', 'Verified 1099-NEC_kim_2024.pdf — payer detected, 96%',                  419),
      clientLine('David Kim', 'Uploaded 1099-NEC_kim_copy.pdf',                                                  400),
      agentLine('Duplicate Detector Agent', 'Blocked duplicate 1099-NEC upload',                                 399),
      clientLine('David Kim', 'Uploaded 1099-B_brokerage_2024.pdf',                                              330),
      agentLine('Doc Classifier Agent', 'Verified 1099-B_brokerage_2024.pdf — broker detected, 95%',             329),
      clientLine('David Kim', 'Uploaded random_scan.jpg',                                                        260),
      agentLine('Doc Classifier Agent', 'random_scan.jpg rejected — not a tax form',                             259),
      staffLine('Girik Patel', 'Resolved unexpected-file flag (random scan)',                                    100),
      agentLine('Missing Doc Tracker Agent', 'David Kim missing 1099-INT, K-1, 1098 — reminder queued',           60),
    ],
    inputFileNames: ['W2_2024_DavidKim.pdf', '1099-NEC_kim_2024.pdf', '1099-B_brokerage_2024.pdf'],
  },
};

// ── Main seeder ──────────────────────────────────────────────────────────────

export async function seedAllDemoData(onProgress?: (msg: string) => void): Promise<void> {
  const log = (msg: string) => { onProgress?.(msg); };
  const check = (label: string, error: unknown) => {
    if (error) throw new Error(`${label}: ${(error as any).message ?? JSON.stringify(error)}`);
  };

  log('Fetching clients...');
  const { data: clients, error: clientErr } = await supabase
    .from('clients').select('*').order('name');
  check('fetch clients', clientErr);
  if (!clients || clients.length === 0) {
    throw new Error('No clients found in database. Make sure the seed.sql has been applied.');
  }

  for (const client of clients) {
    const scenario = SCENARIOS[client.name];
    if (!scenario) continue;

    log(`Seeding ${client.name}...`);
    const now = Date.now();

    // 1. Clear existing seeded data
    await Promise.all([
      supabase.from('document_uploads').delete().eq('client_id', client.id),
      supabase.from('ai_flags').delete().eq('client_id', client.id),
      supabase.from('email_drafts').delete().eq('client_id', client.id),
      supabase.from('input_sheet_entries').delete().eq('client_id', client.id),
      supabase.from('activity_log').delete().eq('client_id', client.id),
      supabase.from('time_entries').delete().eq('client_id', client.id),
      supabase.from('reminders').delete().eq('client_id', client.id),
    ]);

    // 2. Ensure document requirements
    const { data: existingReqs } = await supabase
      .from('document_requirements').select('id, doc_type').eq('client_id', client.id);
    let reqIds: string[] = existingReqs?.map((r: any) => r.id) ?? [];
    if (!existingReqs || existingReqs.length === 0) {
      const { data: newReqs, error: reqInsertErr } = await supabase
        .from('document_requirements')
        .insert(scenario.requirements.map(r => ({
          client_id: client.id, name: r.name, doc_type: r.doc_type,
          tax_year: TAX_YEAR, required: true,
        }))).select('id');
      check(`insert requirements (${client.name})`, reqInsertErr);
      reqIds = newReqs?.map((r: any) => r.id) ?? [];
    }

    // 3. Uploads
    const uploadInserts = scenario.uploads.map((u, i) => ({
      client_id: client.id,
      requirement_id: reqIds[i] ?? null,
      file_name: u.file_name,
      storage_path: `clients/${client.id}/${now + i}_${u.file_name}`,
      file_size: u.file_size,
      mime_type: u.mime_type,
      ai_status: u.ai_status,
      uploaded_by: null,
    }));
    const { data: insertedUploads, error: uploadErr } = await supabase
      .from('document_uploads').insert(uploadInserts).select('id');
    check(`insert uploads (${client.name})`, uploadErr);

    // 4. Flags (incl. resolved)
    if (scenario.flags.length > 0) {
      const flagInserts = scenario.flags.map(f => ({
        client_id: client.id,
        upload_id: f.upload_index !== null ? (insertedUploads?.[f.upload_index]?.id ?? null) : null,
        flag_type: f.flag_type,
        severity: f.severity,
        description: f.description,
        detected_by: f.detected_by ?? 'Doc Classifier Agent',
        resolved: f.resolved ?? false,
        resolved_at: f.resolved
          ? new Date(now - (f.resolvedMinutesAgo ?? 60) * 60000).toISOString()
          : null,
      }));
      const { error: flagErr } = await supabase.from('ai_flags').insert(flagInserts);
      check(`insert flags (${client.name})`, flagErr);
    }

    // 5. Email drafts (pending + sent)
    for (const e of scenario.emails) {
      const body = await generateEmailDraft(client.name, e.missingDocs, e.preparer);
      const { error: emailErr } = await supabase.from('email_drafts').insert({
        client_id: client.id,
        to_email: client.email,
        from_label: e.preparer,
        subject: e.subject,
        body,
        status: e.status,
        sent_at: e.status === 'sent'
          ? new Date(now - (e.sentMinutesAgo ?? 60) * 60000).toISOString()
          : null,
      });
      check(`insert email draft (${client.name})`, emailErr);
    }

    // 6. Activity log
    const activityInserts = scenario.activities.map(a => ({
      client_id: client.id,
      actor: a.actor,
      actor_type: a.actor_type,
      action: a.action,
      created_at: new Date(now - a.minutesAgo * 60000).toISOString(),
    }));
    const { error: actErr } = await supabase.from('activity_log').insert(activityInserts);
    check(`insert activity (${client.name})`, actErr);

    // 7. Input sheet entries
    const fields = generateInputSheetData(client.name, scenario.inputFileNames);
    if (fields.length > 0) {
      const inputInserts = fields.map(f => ({
        client_id: client.id,
        tax_year: TAX_YEAR,
        section: f.section,
        field_name: f.field_name,
        field_value: f.field_value,
        ai_populated: true,
        verified: client.name === 'Sarah Johnson' || client.name === 'Maria Rodriguez',
      }));
      const { error: inputErr } = await supabase.from('input_sheet_entries').insert(inputInserts);
      check(`insert input sheet (${client.name})`, inputErr);
    }

    // 8. Time entries (multiple sessions)
    const timeInserts = scenario.timeSessions.map(s => {
      const started = new Date(now - s.hoursAgoStart * 3600000);
      const ended   = new Date(started.getTime() + s.hours * 3600000);
      return {
        client_id: client.id,
        note: s.note,
        started_at: started.toISOString(),
        ended_at: ended.toISOString(),
      };
    });
    const { error: timeErr } = await supabase.from('time_entries').insert(timeInserts);
    check(`insert time entries (${client.name})`, timeErr);

    // 9. Reminders (historical)
    if (scenario.reminders.length > 0) {
      const reminderInserts = scenario.reminders.map(r => ({
        client_id: client.id,
        to_email: client.email,
        subject: r.subject,
        body: r.body,
        sent_at: new Date(now - r.minutesAgo * 60000).toISOString(),
      }));
      const { error: remErr } = await supabase.from('reminders').insert(reminderInserts);
      check(`insert reminders (${client.name})`, remErr);
    }

    // 10. Update client counters
    const verifiedCount = scenario.uploads.filter(u => u.ai_status === 'verified').length;
    const unresolvedFlags = scenario.flags.filter(f => !f.resolved).length;
    const { error: updateErr } = await supabase.from('clients').update({
      documents_submitted: verifiedCount,
      issues: unresolvedFlags,
      last_activity: new Date(
        now - scenario.activities[scenario.activities.length - 1].minutesAgo * 60000
      ).toISOString(),
    }).eq('id', client.id);
    check(`update client counts (${client.name})`, updateErr);
  }

  log('Done ✅');
}
