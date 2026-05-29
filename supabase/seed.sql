-- ── 6 realistic clients ───────────────────────────────────────────────
insert into public.clients (id, name, email, phone, documents_submitted, documents_required, status, issues, assigned_staff, assigned_preparer, reminder_cadence_days, last_activity)
values
  ('a1000000-0000-0000-0000-000000000001', 'John Smith',      'john.smith@email.com',  '(555) 123-4567', 3, 5, 'active',   2, 'Shawn', 'shawn@brodermansoor.com', 3, now() - interval '2 hours'),
  ('a1000000-0000-0000-0000-000000000002', 'Michael Brown',   'mbrown@email.com',      '(555) 234-5678', 1, 5, 'overdue',  2, 'Girik', 'girik@brodermansoor.com', 3, now() - interval '1 day'),
  ('a1000000-0000-0000-0000-000000000003', 'Sarah Johnson',   'sjohnson@email.com',    '(555) 345-6789', 2, 4, 'active',   1, 'Shawn', 'shawn@brodermansoor.com', 3, now() - interval '3 hours'),
  ('a1000000-0000-0000-0000-000000000004', 'Robert Chen',     'rchen@email.com',       '(555) 456-7890', 0, 4, 'overdue',  1, 'Girik', 'girik@brodermansoor.com', 7, now() - interval '5 days'),
  ('a1000000-0000-0000-0000-000000000005', 'Maria Rodriguez', 'mrodriguez@email.com',  '(555) 567-8901', 5, 5, 'complete', 0, 'Shawn', 'shawn@brodermansoor.com', 3, now() - interval '30 minutes'),
  ('a1000000-0000-0000-0000-000000000006', 'David Kim',       'dkim@email.com',        '(555) 678-9012', 2, 6, 'active',   0, 'Girik', 'girik@brodermansoor.com', 3, now() - interval '6 hours')
on conflict (id) do nothing;

-- ── Document requirements ─────────────────────────────────────────────

-- John Smith (5 docs)
insert into public.document_requirements (id, client_id, name, doc_type, tax_year) values
  ('b1000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001', 'W-2',                    'w2',       '2024'),
  ('b1000000-0000-0000-0000-000000000002', 'a1000000-0000-0000-0000-000000000001', '1099-NEC',               '1099-nec', '2024'),
  ('b1000000-0000-0000-0000-000000000003', 'a1000000-0000-0000-0000-000000000001', '1098 Mortgage Interest', '1098',     '2024'),
  ('b1000000-0000-0000-0000-000000000004', 'a1000000-0000-0000-0000-000000000001', 'Schedule C',             'sched-c',  '2024'),
  ('b1000000-0000-0000-0000-000000000005', 'a1000000-0000-0000-0000-000000000001', '1099-INT',               '1099-int', '2024')
on conflict (id) do nothing;

-- Michael Brown (5 docs)
insert into public.document_requirements (id, client_id, name, doc_type, tax_year) values
  ('b2000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000002', 'W-2',         'w2',       '2024'),
  ('b2000000-0000-0000-0000-000000000002', 'a1000000-0000-0000-0000-000000000002', '1099-DIV',    '1099-div', '2024'),
  ('b2000000-0000-0000-0000-000000000002', 'a1000000-0000-0000-0000-000000000002', '1099-INT',    '1099-int', '2024'),
  ('b2000000-0000-0000-0000-000000000003', 'a1000000-0000-0000-0000-000000000002', '1098',        '1098',     '2024'),
  ('b2000000-0000-0000-0000-000000000004', 'a1000000-0000-0000-0000-000000000002', 'Schedule C',  'sched-c',  '2024')
on conflict (id) do nothing;

-- Sarah Johnson (4 docs)
insert into public.document_requirements (id, client_id, name, doc_type, tax_year) values
  ('b3000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000003', 'W-2',      'w2',       '2024'),
  ('b3000000-0000-0000-0000-000000000002', 'a1000000-0000-0000-0000-000000000003', '1099-NEC', '1099-nec', '2024'),
  ('b3000000-0000-0000-0000-000000000003', 'a1000000-0000-0000-0000-000000000003', '1098',     '1098',     '2024'),
  ('b3000000-0000-0000-0000-000000000004', 'a1000000-0000-0000-0000-000000000003', 'K-1',      'k1',       '2024')
on conflict (id) do nothing;

-- Robert Chen (4 docs)
insert into public.document_requirements (id, client_id, name, doc_type, tax_year) values
  ('b4000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000004', 'W-2',      'w2',       '2024'),
  ('b4000000-0000-0000-0000-000000000002', 'a1000000-0000-0000-0000-000000000004', '1099-B',   '1099-b',   '2024'),
  ('b4000000-0000-0000-0000-000000000003', 'a1000000-0000-0000-0000-000000000004', '1099-DIV', '1099-div', '2024'),
  ('b4000000-0000-0000-0000-000000000004', 'a1000000-0000-0000-0000-000000000004', '1098',     '1098',     '2024')
on conflict (id) do nothing;

-- Maria Rodriguez (5 docs — complete)
insert into public.document_requirements (id, client_id, name, doc_type, tax_year) values
  ('b5000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000005', 'W-2',        'w2',       '2024'),
  ('b5000000-0000-0000-0000-000000000002', 'a1000000-0000-0000-0000-000000000005', '1099-NEC',   '1099-nec', '2024'),
  ('b5000000-0000-0000-0000-000000000003', 'a1000000-0000-0000-0000-000000000005', '1098',       '1098',     '2024'),
  ('b5000000-0000-0000-0000-000000000004', 'a1000000-0000-0000-0000-000000000005', 'Schedule C', 'sched-c',  '2024'),
  ('b5000000-0000-0000-0000-000000000005', 'a1000000-0000-0000-0000-000000000005', '1099-INT',   '1099-int', '2024')
on conflict (id) do nothing;

-- David Kim (6 docs)
insert into public.document_requirements (id, client_id, name, doc_type, tax_year) values
  ('b6000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000006', 'W-2',      'w2',       '2024'),
  ('b6000000-0000-0000-0000-000000000002', 'a1000000-0000-0000-0000-000000000006', '1099-NEC', '1099-nec', '2024'),
  ('b6000000-0000-0000-0000-000000000003', 'a1000000-0000-0000-0000-000000000006', '1099-INT', '1099-int', '2024'),
  ('b6000000-0000-0000-0000-000000000004', 'a1000000-0000-0000-0000-000000000006', '1099-B',   '1099-b',   '2024'),
  ('b6000000-0000-0000-0000-000000000005', 'a1000000-0000-0000-0000-000000000006', 'K-1',      'k1',       '2024'),
  ('b6000000-0000-0000-0000-000000000006', 'a1000000-0000-0000-0000-000000000006', '1098',     '1098',     '2024')
on conflict (id) do nothing;

-- ── AI Flags ──────────────────────────────────────────────────────────
insert into public.ai_flags (client_id, flag_type, severity, description, detected_by) values
  ('a1000000-0000-0000-0000-000000000001', 'wrong-year', 'HIGH',   'Uploaded W2_2023_JohnSmith.pdf — tax year 2023 detected, 2024 required.',           'Doc Classifier Agent'),
  ('a1000000-0000-0000-0000-000000000001', 'duplicate',  'MEDIUM', '2 duplicate 1099-NEC files uploaded. Only the latest version is needed.',            'Duplicate Detector Agent'),
  ('a1000000-0000-0000-0000-000000000002', 'wrong-year', 'HIGH',   'Uploaded W2_2023_MichaelBrown.pdf — tax year 2023 detected, 2024 required.',         'Doc Classifier Agent'),
  ('a1000000-0000-0000-0000-000000000002', 'missing',    'MEDIUM', 'Still missing: 1099-DIV, Schedule C. Client has been inactive for 1 day.',           'Missing Doc Tracker Agent'),
  ('a1000000-0000-0000-0000-000000000003', 'unexpected', 'LOW',    'Uploaded bank_statement_dec2024.pdf — this is not a required tax document.',          'Doc Classifier Agent'),
  ('a1000000-0000-0000-0000-000000000004', 'missing',    'HIGH',   'No documents uploaded. Client has been inactive for 5 days. Deadline approaching.',  'Missing Doc Tracker Agent'),
  ('a1000000-0000-0000-0000-000000000006', 'duplicate',  'MEDIUM', 'Uploaded 1099-NEC twice with different filenames. Identical content detected.',      'Duplicate Detector Agent')
on conflict do nothing;

-- ── Email drafts (pending approval) ──────────────────────────────────
insert into public.email_drafts (client_id, to_email, from_label, subject, body, status) values
  (
    'a1000000-0000-0000-0000-000000000001',
    'john.smith@email.com',
    'shawn@brodermansoor.com',
    'Action Required: Wrong Tax Year — W-2 Document',
    E'Hi John,\n\nThank you for submitting your documents. Our system detected an issue with your W-2:\n\n• File uploaded: W2_2023_JohnSmith.pdf\n• Issue: This document is for tax year 2023. We need your 2024 W-2.\n\nPlease log back in using your secure link and re-upload your 2024 W-2 at your earliest convenience.\n\nIf you have any questions, please reply to this email.\n\nThank you,\nSean Walsh\nBroder-Mansoor & Associates',
    'pending'
  ),
  (
    'a1000000-0000-0000-0000-000000000002',
    'mbrown@email.com',
    'girik@brodermansoor.com',
    'Reminder: Missing Documents — Tax Return 2024',
    E'Hi Michael,\n\nWe hope this message finds you well. We are still waiting on the following documents to complete your 2024 tax return:\n\n• 1099-DIV (Dividend Income)\n• Schedule C (Business Profit/Loss)\n• 2024 W-2 (please re-upload — your 2023 W-2 was received)\n\nYour filing deadline is approaching. Please upload these as soon as possible using your secure portal link.\n\nThank you,\nGirik Sharma\nBroder-Mansoor & Associates',
    'pending'
  ),
  (
    'a1000000-0000-0000-0000-000000000004',
    'rchen@email.com',
    'girik@brodermansoor.com',
    'Urgent: No Documents Received — Action Required',
    E'Hi Robert,\n\nWe have not yet received any documents for your 2024 tax return. Your account shows no uploads in the past 5 days.\n\nTo get started, please click your secure upload link and submit the following:\n\n• W-2 (Employer)\n• 1099-B (Brokerage)\n• 1099-DIV (Dividends)\n• 1098 (Mortgage Interest)\n\nIf you have questions or would prefer to schedule a call, please reply to this email.\n\nThank you,\nGirik Sharma\nBroder-Mansoor & Associates',
    'pending'
  ),
  (
    'a1000000-0000-0000-0000-000000000003',
    'sjohnson@email.com',
    'shawn@brodermansoor.com',
    'Heads Up: Unexpected Document Uploaded',
    E'Hi Sarah,\n\nThank you for uploading your documents. We noticed you uploaded a bank statement (bank_statement_dec2024.pdf), which is not one of the required documents for your tax return.\n\nWe still need:\n• K-1 (Partnership Income)\n\nYou can disregard this email if you intended to share the bank statement for other purposes — otherwise, please use your secure link to upload the K-1.\n\nThank you,\nSean Walsh\nBroder-Mansoor & Associates',
    'pending'
  )
on conflict do nothing;

-- ── Magic link tokens ─────────────────────────────────────────────────
insert into public.magic_link_tokens (client_id, token) values
  ('a1000000-0000-0000-0000-000000000001', 'demo-token-john-smith'),
  ('a1000000-0000-0000-0000-000000000002', 'demo-token-michael-brown'),
  ('a1000000-0000-0000-0000-000000000003', 'demo-token-sarah-johnson'),
  ('a1000000-0000-0000-0000-000000000004', 'demo-token-robert-chen'),
  ('a1000000-0000-0000-0000-000000000005', 'demo-token-maria-rodriguez'),
  ('a1000000-0000-0000-0000-000000000006', 'demo-token-david-kim')
on conflict do nothing;

-- ── Input sheet entries (pre-populated for John Smith & Maria Rodriguez) ──
insert into public.input_sheet_entries (client_id, tax_year, section, field_name, field_value, ai_populated, verified) values
  -- John Smith W-2
  ('a1000000-0000-0000-0000-000000000001', '2024', 'W-2', 'Employer Name',          'Acme Corp LLC',      true,  false),
  ('a1000000-0000-0000-0000-000000000001', '2024', 'W-2', 'Employer EIN',           '12-3456789',         true,  false),
  ('a1000000-0000-0000-0000-000000000001', '2024', 'W-2', 'Wages (Box 1)',           '87,450.00',          true,  false),
  ('a1000000-0000-0000-0000-000000000001', '2024', 'W-2', 'Federal Tax Withheld',   '14,230.00',          true,  false),
  ('a1000000-0000-0000-0000-000000000001', '2024', 'W-2', 'State Wages',            '87,450.00',          true,  false),
  ('a1000000-0000-0000-0000-000000000001', '2024', 'W-2', 'State Tax Withheld',     '4,890.00',           true,  false),
  -- John Smith 1099-NEC
  ('a1000000-0000-0000-0000-000000000001', '2024', '1099-NEC', 'Payer Name',         'Riverside Consult.', true,  false),
  ('a1000000-0000-0000-0000-000000000001', '2024', '1099-NEC', 'Nonemployee Comp.',  '12,500.00',          true,  false),
  -- John Smith 1098
  ('a1000000-0000-0000-0000-000000000001', '2024', '1098', 'Lender Name',            'Chase Home Lending', true,  true),
  ('a1000000-0000-0000-0000-000000000001', '2024', '1098', 'Mortgage Interest',      '18,340.00',          true,  true),
  ('a1000000-0000-0000-0000-000000000001', '2024', '1098', 'Outstanding Principal',  '342,100.00',         true,  false),
  -- John Smith 1099-INT (empty — doc not yet uploaded)
  ('a1000000-0000-0000-0000-000000000001', '2024', '1099-INT', 'Payer Name',         null,                 false, false),
  ('a1000000-0000-0000-0000-000000000001', '2024', '1099-INT', 'Interest Income',    null,                 false, false),

  -- Maria Rodriguez W-2 (all verified — complete client)
  ('a1000000-0000-0000-0000-000000000005', '2024', 'W-2', 'Employer Name',          'Metro Health Systems', true, true),
  ('a1000000-0000-0000-0000-000000000005', '2024', 'W-2', 'Employer EIN',           '98-7654321',           true, true),
  ('a1000000-0000-0000-0000-000000000005', '2024', 'W-2', 'Wages (Box 1)',           '62,100.00',            true, true),
  ('a1000000-0000-0000-0000-000000000005', '2024', 'W-2', 'Federal Tax Withheld',   '9,820.00',             true, true),
  ('a1000000-0000-0000-0000-000000000005', '2024', 'W-2', 'State Wages',            '62,100.00',            true, true),
  ('a1000000-0000-0000-0000-000000000005', '2024', 'W-2', 'State Tax Withheld',     '3,105.00',             true, true),
  ('a1000000-0000-0000-0000-000000000005', '2024', '1099-NEC', 'Payer Name',         'TechFreelance Inc',    true, true),
  ('a1000000-0000-0000-0000-000000000005', '2024', '1099-NEC', 'Nonemployee Comp.',  '8,250.00',             true, true)
on conflict do nothing;

-- ── Activity log ──────────────────────────────────────────────────────
insert into public.activity_log (client_id, actor, actor_type, action) values
  ('a1000000-0000-0000-0000-000000000001', 'Doc Classifier Agent',      'ai',     'Flagged W2_2023_JohnSmith.pdf — wrong tax year (2023 vs 2024 required)'),
  ('a1000000-0000-0000-0000-000000000001', 'Duplicate Detector Agent',  'ai',     'Detected 2 duplicate 1099-NEC uploads — older copy removed'),
  ('a1000000-0000-0000-0000-000000000001', 'AI System',                 'ai',     'Email draft created: Wrong Year notification for John Smith'),
  ('a1000000-0000-0000-0000-000000000001', 'John Smith',                'client', 'Uploaded W2_2023_JohnSmith.pdf'),
  ('a1000000-0000-0000-0000-000000000001', 'John Smith',                'client', 'Uploaded 1099_JohnSmith.pdf'),
  ('a1000000-0000-0000-0000-000000000001', 'Doc Classifier Agent',      'ai',     'Verified 1098_mortgage_2024.pdf as 2024 1098 Mortgage Interest'),
  ('a1000000-0000-0000-0000-000000000002', 'Michael Brown',             'client', 'Uploaded W2_2023_MichaelBrown.pdf'),
  ('a1000000-0000-0000-0000-000000000002', 'Doc Classifier Agent',      'ai',     'Flagged W2_2023_MichaelBrown.pdf — wrong tax year (2023 vs 2024 required)'),
  ('a1000000-0000-0000-0000-000000000002', 'Missing Doc Tracker Agent', 'ai',     'Alert: 1099-DIV and Schedule C still missing after 1 day'),
  ('a1000000-0000-0000-0000-000000000003', 'Sarah Johnson',             'client', 'Uploaded bank_statement_dec2024.pdf'),
  ('a1000000-0000-0000-0000-000000000003', 'Doc Classifier Agent',      'ai',     'Flagged bank_statement_dec2024.pdf — unexpected file type'),
  ('a1000000-0000-0000-0000-000000000003', 'Sarah Johnson',             'client', 'Uploaded W2_2024_SarahJohnson.pdf'),
  ('a1000000-0000-0000-0000-000000000003', 'Doc Classifier Agent',      'ai',     'Verified W2_2024_SarahJohnson.pdf as 2024 W-2'),
  ('a1000000-0000-0000-0000-000000000004', 'Follow-up Sender Agent',    'ai',     'Sent automated reminder — no documents received in 5 days'),
  ('a1000000-0000-0000-0000-000000000005', 'Maria Rodriguez',           'client', 'Uploaded ScheduleC_2024_Rodriguez.pdf'),
  ('a1000000-0000-0000-0000-000000000005', 'Doc Classifier Agent',      'ai',     'Verified all 5 documents — marked client Complete'),
  ('a1000000-0000-0000-0000-000000000005', 'Missing Doc Tracker Agent', 'ai',     'All required documents received. Tax return ready for preparation.'),
  ('a1000000-0000-0000-0000-000000000006', 'David Kim',                 'client', 'Uploaded W2_2024_DavidKim.pdf'),
  ('a1000000-0000-0000-0000-000000000006', 'Doc Classifier Agent',      'ai',     'Verified W2_2024_DavidKim.pdf as 2024 W-2'),
  ('a1000000-0000-0000-0000-000000000006', 'Duplicate Detector Agent',  'ai',     'Detected duplicate 1099-NEC upload — identical content, different filename')
on conflict do nothing;
