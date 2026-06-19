# Proof of Work: "DocuFlow AI" (Internal Tool Showcase)

## The Concept

A secure internal dashboard where employees can upload PDF invoices or purchase orders. The app uses AI to instantly read the PDF, extract key data (Vendor, Total, Date, Line Items) into structured JSON, and save it to a PostgreSQL database for easy exporting.

## Why This Wins High-Ticket Clients

- **Solves a Universal Problem:** "Data entry" is a massive money pit for businesses.
- **Proves Enterprise Architecture:** Shows you know how to handle file storage, secure databases, AI APIs, and complex state management.
- **UI/UX Flex:** Allows you to build a dense, cinematic "IDE-like" interface that looks like premium enterprise software, not a cheap template.

## 🛠 Tech Stack

- **Frontend:** Next.js (App Router), React, Tailwind CSS.
- **UI Components:** shadcn/ui (Perfect for high-density B2B dashboards - Data Tables, Cards, Modals).
- **Backend & Auth:** Supabase Cloud (Managed PostgreSQL + Auth).
- **AI Integration:** DeepSeek API. (Pro-tip: You can use the official `openai` NPM package and simply change the `baseURL` to `https://api.deepseek.com`. It gives you elite reasoning for data extraction at a fraction of the cost).

## 🏗️ Infrastructure Strategy (The "Never Sleep" Supabase Hack)

Since this is a portfolio piece that needs to stay alive 24/7 without costing a fortune, we are using the Supabase Cloud free tier.

Supabase pauses free projects after 7 days of *database inactivity*. To beat this, we simulate activity:

1. **The Dummy Table:** We create a simple `keep_alive` table in the database.
2. **The Ping:** We use a free service like `cron-job.org` or a free GitHub Actions workflow.
3. **The Action:** The cron job makes a REST API request to your Supabase instance every 3 days (e.g., inserting a row with the current timestamp into the `keep_alive` table). Because an actual write operation hits the Postgres database, Supabase registers it as an active project and never pauses it.

## 🗄️ Database Schema

You only need four tables to make this look incredibly professional and secure.

### 1. `organizations`

Simulates a multi-tenant B2B environment.

- `id` (uuid, primary key)
- `name` (text)
- `created_at` (timestamp)

### 2. `users`

- `id` (uuid)
- `org_id` (uuid, references organizations.id)
- `role` (text - e.g., 'admin', 'editor')

### 3. `documents`

Where the magic happens.

- `id` (uuid, primary key)
- `org_id` (uuid, references organizations.id)
- `file_name` (text)
- `file_url` (text - Storage link)
- `status` (text: 'pending', 'processing', 'completed', 'failed')
- `extracted_data` (jsonb - The DeepSeek output goes here)
- `created_at` (timestamp)

### 4. `keep_alive` (The Hack)

- `id` (uuid, primary key)
- `pinged_at` (timestamp, default now())

## 🖥️ The UI Layout (The "Studio" Aesthetic)

Design this in dark mode with subtle glassmorphism to look like a premium developer tool.

1. **Sidebar (Left):** Navigation (Dashboard, Upload, History, Settings).
2. **Main View (Dashboard):**
  - Top: KPI Cards (Total Docs Processed, Hours Saved, Accuracy Rate).
  - Center: A beautiful drag-and-drop zone for PDF uploads.
3. **The "Wow" View (Processing Page):**
  - Split screen.
  - Left side: A PDF viewer showing the uploaded document.
  - Right side: A skeleton loader that suddenly populates with structured data (Vendor Name, Amount, Line Items) returned from DeepSeek.

## 🚀 Weekend Execution Plan

### Friday Night (Setup & Infrastructure)

1. Initialize the Next.js project with Tailwind and shadcn/ui.
2. Set up the Supabase Cloud free project.
3. Create the database tables (`organizations`, `users`, `documents`, `keep_alive`) and set up Supabase Storage for the PDFs.
4. Set up the GitHub Action or `cron-job.org` script to hit the `keep_alive` table.

### Saturday (The Core Logic)

1. Build the File Upload component (Upload PDF to Supabase Storage -> create row in `documents` table).
2. **The DeepSeek Logic:** Write a Next.js API route that takes the PDF text/file, passes it to the DeepSeek API with the prompt: *"Extract the Vendor Name, Date, Total Amount, and Line Items from this document. Return strictly as JSON."*
3. Save the returned JSON into the `extracted_data` column.

### Sunday (The UI Polish & Recording)

1. Build the data tables to display the `documents` list nicely.
2. Add "Processing..." loading states using Framer Motion so the app feels alive.
3. Polish the typography and colors to fit your high-end brand.
4. **The Final Step:** Record a 3-minute Loom video walking through the app, showing how an invoice goes from a raw PDF to a clean, structured database entry.

