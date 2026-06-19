-- Phase 3: multimodal ingestion support

alter table public.time_entries
  add column if not exists source_file_url text;

-- Allow image uploads alongside PDFs in the documents bucket
update storage.buckets
set allowed_mime_types = array[
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp'
]::text[]
where id = 'documents';
