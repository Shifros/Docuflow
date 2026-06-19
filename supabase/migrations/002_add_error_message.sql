-- Add error_message for gatekeeper rejections and processing failures
alter table public.documents
  add column if not exists error_message text;
