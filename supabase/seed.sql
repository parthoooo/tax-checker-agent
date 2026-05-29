-- Seed 5 mock clients (auth_user_id left null — link after real users sign up)
insert into public.clients (id, name, email, phone, documents_submitted, documents_required, status, issues, assigned_staff, last_activity)
values
  ('a1000000-0000-0000-0000-000000000001', 'John Smith',      'john.smith@email.com',    '(555) 123-4567', 3, 4, 'active',   2, 'Shawn', now() - interval '2 hours'),
  ('a1000000-0000-0000-0000-000000000002', 'Michael Brown',   'mbrown@email.com',        '(555) 234-5678', 1, 4, 'overdue',  1, 'Girik', now() - interval '1 day'),
  ('a1000000-0000-0000-0000-000000000003', 'Sarah Johnson',   'sjohnson@email.com',      '(555) 345-6789', 2, 4, 'active',   1, 'Shawn', now() - interval '3 hours'),
  ('a1000000-0000-0000-0000-000000000004', 'Robert Chen',     'rchen@email.com',         '(555) 456-7890', 0, 4, 'overdue',  0, 'Girik', now() - interval '5 days'),
  ('a1000000-0000-0000-0000-000000000005', 'Maria Rodriguez', 'mrodriguez@email.com',    '(555) 567-8901', 4, 4, 'complete', 0, 'Shawn', now() - interval '30 minutes')
on conflict (id) do nothing;

-- Document requirements for John Smith
insert into public.document_requirements (client_id, name, doc_type, tax_year)
values
  ('a1000000-0000-0000-0000-000000000001', 'W-2',                   'w2',     '2024'),
  ('a1000000-0000-0000-0000-000000000001', '1099-NEC',              '1099',   '2024'),
  ('a1000000-0000-0000-0000-000000000001', '1098 Mortgage Interest','1098',   '2024'),
  ('a1000000-0000-0000-0000-000000000001', 'Schedule C',            'sched-c','2024');

-- Seed initial ai_flags
insert into public.ai_flags (client_id, flag_type, severity, description, detected_by)
values
  ('a1000000-0000-0000-0000-000000000002', 'wrong-year', 'HIGH',   'Uploaded 2023 W-2. Tax year required is 2024.',             'Doc Classifier Agent'),
  ('a1000000-0000-0000-0000-000000000001', 'duplicate',  'MEDIUM', '3 duplicate 1099-NEC files detected. Only 1 unique needed.', 'Duplicate Detector Agent'),
  ('a1000000-0000-0000-0000-000000000003', 'unexpected', 'MEDIUM', 'Uploaded bank_statement_dec2024.pdf — not a required doc.', 'Doc Classifier Agent'),
  ('a1000000-0000-0000-0000-000000000004', 'missing',    'LOW',    '0 of 4 required documents uploaded. No activity in 5 days.','Missing Doc Tracker Agent'),
  ('a1000000-0000-0000-0000-000000000002', 'missing',    'LOW',    'Still missing: 1098, Schedule C. Last activity 1 day ago.', 'Missing Doc Tracker Agent');

-- Seed activity log
insert into public.activity_log (client_id, actor, actor_type, action)
values
  ('a1000000-0000-0000-0000-000000000001', 'Doc Classifier Agent',      'ai',     'Flagged W2_2023_JohnSmith.pdf as wrong year'),
  ('a1000000-0000-0000-0000-000000000001', 'Duplicate Detector Agent',  'ai',     'Removed 3 duplicate 1099 files'),
  ('a1000000-0000-0000-0000-000000000004', 'Shawn',                     'staff',  'Sent reminder email for missing documents'),
  ('a1000000-0000-0000-0000-000000000005', 'Maria Rodriguez',           'client', 'Uploaded Schedule_C_2024.pdf'),
  ('a1000000-0000-0000-0000-000000000005', 'Doc Classifier Agent',      'ai',     'Verified Schedule_C_2024.pdf as 2024 Schedule C'),
  ('a1000000-0000-0000-0000-000000000005', 'Missing Doc Tracker Agent', 'ai',     'All 4 documents received — marked Complete'),
  ('a1000000-0000-0000-0000-000000000003', 'Sarah Johnson',             'client', 'Uploaded bank_statement_dec2024.pdf'),
  ('a1000000-0000-0000-0000-000000000003', 'Doc Classifier Agent',      'ai',     'Flagged bank_statement_dec2024.pdf as unexpected file'),
  ('a1000000-0000-0000-0000-000000000002', 'Girik',                     'staff',  'Added internal note on Michael Brown'),
  ('a1000000-0000-0000-0000-000000000004', 'Follow-up Sender Agent',    'ai',     'Sent automated missing doc reminder'),
  ('a1000000-0000-0000-0000-000000000002', 'Michael Brown',             'client', 'Uploaded W2_2023_MichaelBrown.pdf');
