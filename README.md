# StudySync

StudySync is a student workspace for course files, rich-text notes, cited reviewers, and practice quizzes. Each student’s work persists in Supabase. Gemini receives the text selected for a generation request. The browser receives quiz answer keys only in submitted attempt results.

## Run locally

Use Node.js 24 and npm. From the directory containing `package.json`, run `npm ci`. Copy `.env.example` to `.env.local` for a new installation. The existing StudySync installation already has its Supabase settings.

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Base project URL, such as `https://PROJECT.supabase.co`. Omit the REST path. |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase publishable key for the same project. |
| `GEMINI_API_KEY` | Server-side Google AI Studio API key. Required for new AI generations. |
| `GEMINI_MODEL` | Model available to the key with structured JSON output. Defaults to `gemini-3.8-flash`. |
| `MAX_UPLOAD_MB` | Per-file limit, up to the private bucket’s 20 MiB maximum. Defaults to 20. |
| `SITE_URL` | Optional canonical origin for deployments behind a reverse proxy. |

Place secrets in the deployment environment or in the Git-ignored local file. Start the app with `npm run dev`, then open [StudySync locally](http://localhost:3000). To run production locally, use `npm run build` followed by `npm start`. The production environment needs Node.js subprocess support for PDF extraction. Allow Google Fonts at build time for Geist.

## Supabase

The migrations under `supabase/migrations` create profiles, subjects, materials and chunks, notes, reviewers and their sources, quizzes, questions, sources, attempts, and answers. They also create the private `study-materials` bucket, per-owner access policies, private answer keys, and database functions for generation limits and atomic grading. A new Auth user automatically receives a profile. Existing users are backfilled when the migration runs.

For a **new project**, authenticate the Supabase CLI, run `supabase link --project-ref YOUR_PROJECT_REF`, inspect `supabase migration list --linked`, then apply the pending migration with `supabase db push --linked`. The current StudySync hosted project already has both migrations. Keep the private schema outside the exposed Data API schemas.

Enable email/password Auth and email confirmations. Use `supabase/templates/confirmation.html` as the **Confirm signup** email template with the subject “Your StudySync verification code”. The template uses Supabase’s `{{ .Token }}`. Students enter the code at `/verify-email`. Configure a production SMTP sender for delivery to students.

Set the Supabase Auth Site URL to the production origin and allow its `/auth/callback` and `/auth/callback?flow=recovery` URLs. Keep the equivalent localhost callbacks in the redirect allowlist for development. Open password reset links in the browser that requested them so the PKCE verifier is available.

## Student workflow

1. Register with your email and password, then enter the emailed code to open your workspace. You can add a display name later in Settings.
2. Create a subject and upload PDFs, DOCX files, or PPTX slides. Open a material to preview it or download the private original.
3. Create a note in the subject. The editor saves after a short pause and reports conflicts if another tab changed the same note.
4. Choose **Generate reviewer**, select sources and a format, then save the draft. Saved reviewers can be reopened, copied, renamed, regenerated as a new draft, or deleted.
5. Choose **Create quiz**, select processed sources, question types, difficulty, and a count of 5, 10, or 20. Submit all answers for server-side scoring. Previous attempts retain answers, explanations, and scores.
6. Use Settings to edit the display name or start password recovery. Sign out from the sidebar.

## Processing and access

- Materials use a private user/subject/file path. A signed preview or download URL expires after ten minutes. Subject deletion cleans up Storage objects before removing the relational records. Retry a paused deletion to finish cleanup.
- File uploads check extension, MIME when supplied, bytes, and Office package contents. PDF text extraction runs in a time- and memory-limited process. PDFs retain page references. PowerPoint and Word show extracted text with slide or paragraph references. Scanned PDFs keep their original files and explain the absence of OCR.
- Generation uses the official Google Gen AI SDK, server-only credentials, bounded source selection, a timeout, structured JSON, Zod validation, and one retry for malformed output. When all source text cannot fit, the result records its coverage. The database limits each user to ten requests per ten minutes and deduplicates request IDs.
- Public quiz questions contain prompts and options. Correct indexes and explanations are held in a private table. Grading validates the submitted options and writes the attempt and answer review in one transaction.
- The Supabase security advisor lists two informational findings for RLS tables with no policies. This is intentional for `private.quiz_keys` and `private.generation_requests`. Browser roles have no table grants, and the database functions enforce ownership. [Supabase advisor reference](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy)
- The workspace shell supports keyboard navigation, mobile navigation, global search, subject tabs, and light/dark themes.

## Tests

Run `npm test` for subject and file validation, actual PDF/DOCX/PPTX extraction, safe note serialization, source coverage, Gemini output validation, and retry behavior. Gemini is mocked during tests. Run `npm run lint`, `npm run typecheck`, and `npm run build` for static and production checks.

Run `tests/ownership.sql` against a development Supabase database in a SQL session that supports transactions. Its synthetic rows roll back. It checks ownership isolation, composite foreign keys, private keys, scoring, submission idempotency, and generation deduplication.

For browser tests, first run `npx playwright install chromium` (or set `PLAYWRIGHT_CHROMIUM_EXECUTABLE` to an installed Chromium browser), then `npm run build` and `npm run test:e2e`. The test server uses a local Gemini fixture. Set `STUDYSYNC_TEST_EMAIL` and `STUDYSYNC_TEST_PASSWORD` to a dedicated confirmed account on your test project for the authenticated workflow. The test creates and removes a course and its files. Without a test account, only public-flow tests run. The runner picks a free local port. Set `STUDYSYNC_TEST_PORT` to use a specific one.

## Implementation map

| Phase | Main files | Verification |
| --- | --- | --- |
| Foundation and Auth | `lib/supabase/`, `proxy.ts`, `components/auth-form.tsx`, `app/auth/callback/route.ts` | Signed-out access control, registration and recovery form responses, live password sign-in and logout. |
| Subjects and dashboard | `supabase/migrations/`, `lib/library.ts`, `components/collections.tsx`, `components/workspace.tsx` | Course creation, real counts, ownership isolation, and deletion with its associated data. |
| Materials | `lib/materials.ts`, `lib/documents.ts`, `scripts/extract-pdf.cjs`, `components/pdf-viewer.tsx` | Private uploads of all three supported formats, referenced extraction, PDF rendering, and cleanup. |
| Notes | `lib/notes.ts`, `components/note-editor.tsx`, `app/api/workspace/[action]/route.ts` | Formatting validation, autosave, revision conflict handling, and persistence after reload. |
| Reviewers | `lib/gemini.ts`, `lib/generation.ts`, `lib/generate-tool.ts` | Grounded output schemas, citation mapping, malformed-output retry, draft preview, and saving. |
| Quizzes | `components/quiz.tsx`, `lib/generation.ts`, grading functions in `supabase/migrations/` | Mixed question types, private answer keys, scoring, per-question explanations, and returning to a previous result. |
| Final checks | `tests/`, `playwright.config.ts`, `app/globals.css` | Unit tests, SQL ownership checks, production browser flows, lint, TypeScript, production build, and desktop/mobile layout checks. |

The browser suite uses a local Gemini fixture through the official SDK. Live generated output requires a configured Gemini key. The email form tests intercept mail requests. Verify real delivery separately with your SMTP provider.

## Troubleshooting

| Symptom | What to check |
| --- | --- |
| Sign-in opens an empty or unavailable workspace | Confirm the migration was applied to the same project as the URL and key, then retry. |
| Confirmation or recovery opens the wrong site | Check the Site URL, redirect allowlist, email template, and original browser. Request a fresh link if expired. |
| A document has no preview text | Open its processing message. Scans need OCR outside this MVP. Locked or damaged originals can still be downloaded. |
| Generation reports missing credentials or model access | Set the server-side key and an accessible Gemini model, then restart the server. Other workspace features work independently. |
| Uploads hit a platform limit | The host must accept multipart requests up to 21 MiB, run a Node.js PDF subprocess, and allow sufficient request duration. Lower the configured file limit on more restrictive hosts. |
