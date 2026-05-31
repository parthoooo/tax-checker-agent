/**
 * Presentation demo seeder.
 * Populates the DB with a full, realistic dataset so every screen has live
 * content without needing to upload real files.
 *
 * Safe to run multiple times — clears existing AI-generated data first.
 */

import { supabase } from './supabase';
import { generateInputSheetData, generateEmailDraft } from './aiSimulation';

const TAX_YEAR = '2024';

// ── Per-client scenario definitions ──────────────────────────────────────────

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
  upload_index: number | null; // index into uploads array, or null
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
  email: EmailDef | null;
  inputFileNames: string[];  // filenames to feed into generateInputSheetData
  timeHours: number;
}

const SCENARIOS: Record<string, Scenario> = {

  // ── John Smith — Active, partially done, one wrong-year flag ─────────────
  'John Smith': {
    requirements: [
      { name: 'W-2 (Goldman Sachs)',    doc_type: 'w2'       },
      { name: '1099-INT (Fidelity)',    doc_type: '1099-int' },
      { name: '1099-NEC',               doc_type: '1099-nec' },
      { name: '1098 Mortgage',          doc_type: '1098'     },
      { name: 'K-1 Partnership',        doc_type: 'k1'       },
    ],
    uploads: [
      { file_name: 'W2_2024_GoldmanSachs.pdf',  ai_status: 'verified', file_size: 248320,  mime_type: 'application/pdf' },
      { file_name: 'W2_2023_old.pdf',            ai_status: 'flagged',  file_size: 212000,  mime_type: 'application/pdf' },
      { file_name: '1099-INT_fidelity_2024.pdf', ai_status: 'verified', file_size: 134144,  mime_type: 'application/pdf' },
      { file_name: '1099-NEC_2024_client.pdf',   ai_status: 'verified', file_size: 125000,  mime_type: 'application/pdf' },
    ],
    flags: [
      {
        flag_type: 'wrong-year',
        severity: 'HIGH',
        description: 'Uploaded W2_2023_old.pdf — tax year 2023 detected, 2024 required. Client must re-upload the correct year.',
        upload_index: 1,
      },
    ],
    email: {
      subject: 'Action Required: Wrong Tax Year — W2_2023_old.pdf',
      missingDocs: [],
      preparer: 'Sean Mansoor',
      status: 'pending',
    },
    activities: [
      { actor: 'John Smith',          actor_type: 'client', action: 'Uploaded W2_2024_GoldmanSachs.pdf via magic link portal',                minutesAgo: 95  },
      { actor: 'Doc Classifier Agent', actor_type: 'ai',    action: 'Verified W2_2024_GoldmanSachs.pdf — employer: Goldman Sachs, confidence 98%', minutesAgo: 94  },
      { actor: 'John Smith',          actor_type: 'client', action: 'Uploaded W2_2023_old.pdf via magic link portal',                          minutesAgo: 88  },
      { actor: 'Doc Classifier Agent', actor_type: 'ai',    action: 'Wrong year detected in W2_2023_old.pdf — 2023 document, 2024 required. Flag created.', minutesAgo: 87  },
      { actor: 'Follow-up Sender Agent', actor_type: 'ai',  action: 'Drafted correction email for wrong-year document — pending approval',     minutesAgo: 86  },
      { actor: 'John Smith',          actor_type: 'client', action: 'Uploaded 1099-INT_fidelity_2024.pdf via magic link portal',               minutesAgo: 60  },
      { actor: 'Doc Classifier Agent', actor_type: 'ai',    action: 'Verified 1099-INT_fidelity_2024.pdf — interest income detected, confidence 96%', minutesAgo: 59  },
      { actor: 'Missing Doc Tracker Agent', actor_type: 'ai', action: 'Updated checklist for John Smith — 1 of 5 docs still missing',          minutesAgo: 58  },
    ],
    inputFileNames: ['W2_2024_GoldmanSachs.pdf', '1099-INT_fidelity_2024.pdf', '1099-NEC_2024_client.pdf'],
    timeHours: 1.5,
  },

  // ── Michael Brown — Overdue, few docs, missing doc flag, email pending ────
  'Michael Brown': {
    requirements: [
      { name: 'W-2',               doc_type: 'w2'       },
      { name: '1099-NEC (Upwork)', doc_type: '1099-nec' },
      { name: '1098 Mortgage',     doc_type: '1098'     },
      { name: 'Schedule C',        doc_type: 'sched-c'  },
      { name: '1099-INT',          doc_type: '1099-int' },
    ],
    uploads: [
      { file_name: 'bankstatement_jan2024.pdf',   ai_status: 'flagged',  file_size: 98304,  mime_type: 'application/pdf' },
      { file_name: '1099-NEC_2024_mbrown.pdf',    ai_status: 'verified', file_size: 128000, mime_type: 'application/pdf' },
    ],
    flags: [
      {
        flag_type: 'unexpected',
        severity: 'MEDIUM',
        description: 'Bank statement detected in bankstatement_jan2024.pdf — this document is not required for 2024 tax filing.',
        upload_index: 0,
      },
    ],
    email: {
      subject: 'Action Required: Missing Tax Documents',
      missingDocs: ['W-2', '1098 Mortgage Interest Statement', 'Schedule C (Business Profit/Loss)', '1099-INT'],
      preparer: 'Girik Manchanda',
      status: 'pending',
    },
    activities: [
      { actor: 'Michael Brown',       actor_type: 'client', action: 'Uploaded bankstatement_jan2024.pdf via client portal',                   minutesAgo: 180 },
      { actor: 'Doc Classifier Agent', actor_type: 'ai',    action: 'Bank statement detected in bankstatement_jan2024.pdf — not required for 2024 filing. Flagged.', minutesAgo: 179 },
      { actor: 'Michael Brown',       actor_type: 'client', action: 'Uploaded 1099-NEC_2024_mbrown.pdf via client portal',                    minutesAgo: 150 },
      { actor: 'Doc Classifier Agent', actor_type: 'ai',    action: 'Verified 1099-NEC_2024_mbrown.pdf — payer: Upwork Global, confidence 97%', minutesAgo: 149 },
      { actor: 'Missing Doc Tracker Agent', actor_type: 'ai', action: 'Michael Brown is missing 4 documents — W-2, 1098, Schedule C, 1099-INT — reminder queued', minutesAgo: 148 },
      { actor: 'Follow-up Sender Agent', actor_type: 'ai',  action: 'Drafted missing doc reminder email for Michael Brown — pending approval', minutesAgo: 147 },
    ],
    inputFileNames: ['1099-NEC_2024_mbrown.pdf'],
    timeHours: 0.5,
  },

  // ── Sarah Johnson — Complete, all docs verified ✅ ─────────────────────────
  'Sarah Johnson': {
    requirements: [
      { name: 'W-2 (NYC Dept. of Education)', doc_type: 'w2'       },
      { name: '1098 Mortgage (Chase)',         doc_type: '1098'     },
      { name: 'Schedule C',                   doc_type: 'sched-c'  },
      { name: '1099-INT (Ally Bank)',          doc_type: '1099-int' },
    ],
    uploads: [
      { file_name: 'W2_2024_NYCDeptEducation.pdf',  ai_status: 'verified', file_size: 256000, mime_type: 'application/pdf' },
      { file_name: '1098_mortgage_chase_2024.pdf',   ai_status: 'verified', file_size: 195840, mime_type: 'application/pdf' },
      { file_name: 'Schedule_C_2024_complete.pdf',   ai_status: 'verified', file_size: 310000, mime_type: 'application/pdf' },
      { file_name: '1099-INT_ally_2024.pdf',         ai_status: 'verified', file_size: 112640, mime_type: 'application/pdf' },
    ],
    flags: [],
    email: null,
    activities: [
      { actor: 'Sarah Johnson',       actor_type: 'client', action: 'Uploaded W2_2024_NYCDeptEducation.pdf via magic link portal',             minutesAgo: 720 },
      { actor: 'Doc Classifier Agent', actor_type: 'ai',    action: 'Verified W2_2024_NYCDeptEducation.pdf — employer: NYC Dept. of Education, confidence 99%', minutesAgo: 719 },
      { actor: 'Sarah Johnson',       actor_type: 'client', action: 'Uploaded 1098_mortgage_chase_2024.pdf via magic link portal',             minutesAgo: 680 },
      { actor: 'Doc Classifier Agent', actor_type: 'ai',    action: 'Verified 1098_mortgage_chase_2024.pdf — lender: Chase Home Lending, confidence 97%', minutesAgo: 679 },
      { actor: 'Sarah Johnson',       actor_type: 'client', action: 'Uploaded Schedule_C_2024_complete.pdf via magic link portal',             minutesAgo: 640 },
      { actor: 'Doc Classifier Agent', actor_type: 'ai',    action: 'Verified Schedule_C_2024_complete.pdf — gross revenue and expense fields detected, confidence 95%', minutesAgo: 639 },
      { actor: 'Sarah Johnson',       actor_type: 'client', action: 'Uploaded 1099-INT_ally_2024.pdf via magic link portal',                   minutesAgo: 600 },
      { actor: 'Doc Classifier Agent', actor_type: 'ai',    action: 'Verified 1099-INT_ally_2024.pdf — interest income detected, confidence 98%', minutesAgo: 599 },
      { actor: 'Missing Doc Tracker Agent', actor_type: 'ai', action: 'Sarah Johnson checklist complete — all 4 required documents received and verified ✅', minutesAgo: 598 },
      { actor: 'Sean Mansoor',        actor_type: 'staff',  action: 'Reviewed all documents — input sheet verified, ready for filing',         minutesAgo: 480 },
    ],
    inputFileNames: ['W2_2024_NYCDeptEducation.pdf', '1098_mortgage_chase_2024.pdf', 'Schedule_C_2024_complete.pdf', '1099-INT_ally_2024.pdf'],
    timeHours: 2.2,
  },

  // ── Robert Chen — Overdue, duplicate flag, missing several docs ───────────
  'Robert Chen': {
    requirements: [
      { name: 'W-2',            doc_type: 'w2'       },
      { name: '1099-NEC',       doc_type: '1099-nec' },
      { name: '1098 Mortgage',  doc_type: '1098'     },
      { name: 'K-1 Partnership', doc_type: 'k1'      },
      { name: 'Schedule C',     doc_type: 'sched-c'  },
    ],
    uploads: [
      { file_name: 'K1_partnership_alpha_2024.pdf', ai_status: 'verified', file_size: 174080, mime_type: 'application/pdf' },
      { file_name: '1098_mortgage_2024.pdf',         ai_status: 'verified', file_size: 200704, mime_type: 'application/pdf' },
      { file_name: '1098_mortgage_2024.pdf',         ai_status: 'flagged',  file_size: 200704, mime_type: 'application/pdf' },
    ],
    flags: [
      {
        flag_type: 'duplicate',
        severity: 'MEDIUM',
        description: 'Duplicate upload detected: 1098_mortgage_2024.pdf. Identical file already exists from prior upload.',
        upload_index: 2,
      },
    ],
    email: {
      subject: 'Heads Up: Duplicate Document Uploaded',
      missingDocs: ['W-2', '1099-NEC', 'Schedule C'],
      preparer: 'Girik Manchanda',
      status: 'pending',
    },
    activities: [
      { actor: 'Robert Chen',         actor_type: 'client', action: 'Uploaded K1_partnership_alpha_2024.pdf via magic link portal',            minutesAgo: 300 },
      { actor: 'Doc Classifier Agent', actor_type: 'ai',    action: 'Verified K1_partnership_alpha_2024.pdf — partnership income fields detected, confidence 95%', minutesAgo: 299 },
      { actor: 'Robert Chen',         actor_type: 'client', action: 'Uploaded 1098_mortgage_2024.pdf via magic link portal',                   minutesAgo: 260 },
      { actor: 'Doc Classifier Agent', actor_type: 'ai',    action: 'Verified 1098_mortgage_2024.pdf — lender: Wells Fargo Bank, confidence 97%', minutesAgo: 259 },
      { actor: 'Robert Chen',         actor_type: 'client', action: 'Uploaded 1098_mortgage_2024.pdf again (duplicate)',                       minutesAgo: 220 },
      { actor: 'Duplicate Detector Agent', actor_type: 'ai', action: 'Blocked duplicate 1098_mortgage_2024.pdf — matches upload from earlier today', minutesAgo: 219 },
      { actor: 'Follow-up Sender Agent', actor_type: 'ai',  action: 'Drafted duplicate removal notice for Robert Chen — pending approval',      minutesAgo: 218 },
      { actor: 'Missing Doc Tracker Agent', actor_type: 'ai', action: 'Robert Chen is missing 3 documents — W-2, 1099-NEC, Schedule C',        minutesAgo: 200 },
      { actor: 'Girik Manchanda',     actor_type: 'staff',  action: 'Sent reminder email to robert.chen@email.com',                            minutesAgo: 180 },
    ],
    inputFileNames: ['K1_partnership_alpha_2024.pdf', '1098_mortgage_2024.pdf'],
    timeHours: 1.0,
  },

  // ── Maria Rodriguez — Active, all verified, no issues ────────────────────
  'Maria Rodriguez': {
    requirements: [
      { name: 'W-2 (Deloitte LLP)',    doc_type: 'w2'       },
      { name: '1099-DIV (Vanguard)',   doc_type: '1099-div' },
      { name: '1099-NEC',             doc_type: '1099-nec' },
      { name: '1098 Mortgage',        doc_type: '1098'     },
    ],
    uploads: [
      { file_name: 'W2_2024_deloitte.pdf',          ai_status: 'verified', file_size: 237568, mime_type: 'application/pdf' },
      { file_name: '1099-DIV_vanguard_2024.pdf',    ai_status: 'verified', file_size: 118784, mime_type: 'application/pdf' },
      { file_name: '1099-NEC_rodriguez_2024.pdf',   ai_status: 'verified', file_size: 131072, mime_type: 'application/pdf' },
    ],
    flags: [],
    email: null,
    activities: [
      { actor: 'Maria Rodriguez',      actor_type: 'client', action: 'Uploaded W2_2024_deloitte.pdf via magic link portal',                    minutesAgo: 400 },
      { actor: 'Doc Classifier Agent', actor_type: 'ai',    action: 'Verified W2_2024_deloitte.pdf — employer: Deloitte LLP, confidence 98%',  minutesAgo: 399 },
      { actor: 'Maria Rodriguez',      actor_type: 'client', action: 'Uploaded 1099-DIV_vanguard_2024.pdf via magic link portal',              minutesAgo: 360 },
      { actor: 'Doc Classifier Agent', actor_type: 'ai',    action: 'Verified 1099-DIV_vanguard_2024.pdf — ordinary dividends detected, confidence 96%', minutesAgo: 359 },
      { actor: 'Maria Rodriguez',      actor_type: 'client', action: 'Uploaded 1099-NEC_rodriguez_2024.pdf via magic link portal',             minutesAgo: 320 },
      { actor: 'Doc Classifier Agent', actor_type: 'ai',    action: 'Verified 1099-NEC_rodriguez_2024.pdf — payer: Stripe Inc., confidence 97%', minutesAgo: 319 },
      { actor: 'Missing Doc Tracker Agent', actor_type: 'ai', action: 'Maria Rodriguez is missing 1098 Mortgage — follow-up scheduled',       minutesAgo: 310 },
    ],
    inputFileNames: ['W2_2024_deloitte.pdf', '1099-DIV_vanguard_2024.pdf', '1099-NEC_rodriguez_2024.pdf'],
    timeHours: 0.8,
  },
};

// ── Main seeder ───────────────────────────────────────────────────────────────

export async function seedAllDemoData(onProgress?: (msg: string) => void): Promise<void> {
  const log = (msg: string) => { onProgress?.(msg); };

  log('Fetching clients...');
  const { data: clients, error: clientErr } = await supabase
    .from('clients')
    .select('*')
    .order('name');
  if (clientErr) throw clientErr;
  if (!clients || clients.length === 0) throw new Error('No clients found in database');

  for (const client of clients) {
    const scenario = SCENARIOS[client.name];
    if (!scenario) continue;

    log(`Seeding ${client.name}...`);

    // ── 1. Clear existing AI-generated data for this client ──────────────────
    await supabase.from('document_uploads').delete().eq('client_id', client.id);
    await supabase.from('ai_flags').delete().eq('client_id', client.id).eq('resolved', false);
    await supabase.from('email_drafts').delete().eq('client_id', client.id).eq('status', 'pending');
    await supabase.from('input_sheet_entries').delete().eq('client_id', client.id).eq('ai_populated', true).eq('verified', false);
    await supabase.from('activity_log').delete().eq('client_id', client.id);
    await supabase.from('time_entries').delete().eq('client_id', client.id);

    // ── 2. Seed / ensure document requirements ───────────────────────────────
    const { data: existingReqs } = await supabase
      .from('document_requirements')
      .select('id, doc_type')
      .eq('client_id', client.id);

    let reqIds: string[] = existingReqs?.map(r => r.id) ?? [];

    if (!existingReqs || existingReqs.length === 0) {
      const { data: newReqs } = await supabase
        .from('document_requirements')
        .insert(scenario.requirements.map(r => ({
          client_id: client.id,
          name:      r.name,
          doc_type:  r.doc_type,
          tax_year:  TAX_YEAR,
          required:  true,
        })))
        .select('id');
      reqIds = newReqs?.map(r => r.id) ?? [];
    }

    // ── 3. Seed document uploads ─────────────────────────────────────────────
    const now = Date.now();
    const uploadInserts = scenario.uploads.map((u, i) => ({
      client_id:      client.id,
      requirement_id: reqIds[i] ?? null,
      file_name:      u.file_name,
      storage_path:   `clients/${client.id}/${now + i}_${u.file_name}`,
      file_size:      u.file_size,
      mime_type:      u.mime_type,
      ai_status:      u.ai_status,
      uploaded_by:    null,
    }));

    const { data: insertedUploads } = await supabase
      .from('document_uploads')
      .insert(uploadInserts)
      .select('id');

    // ── 4. Seed AI flags ─────────────────────────────────────────────────────
    if (scenario.flags.length > 0) {
      const flagInserts = scenario.flags.map(f => ({
        client_id:   client.id,
        upload_id:   f.upload_index !== null ? (insertedUploads?.[f.upload_index]?.id ?? null) : null,
        flag_type:   f.flag_type,
        severity:    f.severity,
        description: f.description,
        detected_by: 'Doc Classifier Agent',
        resolved:    false,
        resolved_at: null,
      }));
      await supabase.from('ai_flags').insert(flagInserts);
    }

    // ── 5. Seed email drafts ─────────────────────────────────────────────────
    if (scenario.email) {
      const body = await generateEmailDraft(
        client.name,
        scenario.email.missingDocs,
        scenario.email.preparer,
      );
      await supabase.from('email_drafts').insert({
        client_id:  client.id,
        to_email:   client.email,
        from_label: scenario.email.preparer,
        subject:    scenario.email.subject,
        body,
        status:     scenario.email.status,
        approved_by: scenario.email.status === 'sent' ? scenario.email.preparer : null,
        approved_at: scenario.email.status === 'sent' ? new Date(now - 3600000).toISOString() : null,
      });
    }

    // ── 6. Seed activity log ─────────────────────────────────────────────────
    const activityInserts = scenario.activities.map(a => ({
      client_id:  client.id,
      actor:      a.actor,
      actor_type: a.actor_type,
      action:     a.action,
      created_at: new Date(now - a.minutesAgo * 60000).toISOString(),
    }));
    await supabase.from('activity_log').insert(activityInserts);

    // ── 7. Seed input sheet entries ──────────────────────────────────────────
    const fields = generateInputSheetData(client.name, scenario.inputFileNames);
    if (fields.length > 0) {
      const inputInserts = fields.map(f => ({
        client_id:    client.id,
        tax_year:     TAX_YEAR,
        section:      f.section,
        field_name:   f.field_name,
        field_value:  f.field_value,
        ai_populated: true,
        verified:     client.name === 'Sarah Johnson', // Sarah is complete — all verified
      }));
      await supabase.from('input_sheet_entries').insert(inputInserts);
    }

    // ── 8. Seed time entries ─────────────────────────────────────────────────
    const hoursMs = scenario.timeHours * 3600000;
    const startedAt = new Date(now - hoursMs - 7200000); // started 2h+ ago
    const endedAt   = new Date(now - 7200000);           // ended 2h ago
    await supabase.from('time_entries').insert({
      client_id:        client.id,
      user_email:       client.assigned_preparer ?? 'sean@brodermansoor.com',
      started_at:       startedAt.toISOString(),
      ended_at:         endedAt.toISOString(),
      duration_seconds: Math.round(scenario.timeHours * 3600),
    });

    // ── 9. Update client doc counts to match seeded data ────────────────────
    const verifiedCount  = scenario.uploads.filter(u => u.ai_status === 'verified').length;
    const hasIssues      = scenario.flags.length;
    await supabase.from('clients').update({
      documents_submitted: scenario.uploads.length,
      issues:              hasIssues,
      last_activity:       new Date(now - scenario.activities[scenario.activities.length - 1].minutesAgo * 60000).toISOString(),
    }).eq('id', client.id);
  }

  log('Done ✅');
}
