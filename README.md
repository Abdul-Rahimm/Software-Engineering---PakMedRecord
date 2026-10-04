# Software-Engineering---PakMedRecord
This repo is made for our 6th semester SE project

**Live demo: https://pakmedrecord.vercel.app**

Demo accounts (password `demo1234`): patient CNIC `42101-9999999-1`, doctor CNIC `42101-1234567-1`.
Hospital front desk (`/desk/signin`): `frontdesk@pakmedrecord.demo` / `desk-demo-1234`. Hospitals register themselves at `/hospitals/register`.

PakMedRecord gives every patient in Pakistan one verified medical record that follows them across hospitals.

## Features

**Patients**
- Health profile: blood group, allergies, chronic conditions, medications, vaccinations, family history, emergency contact
- Downloadable wallet-size emergency card (PDF)
- Verified records timeline with categories, search, per-record PDF and full-history export
- Submit past reports for doctor verification and track their status (approved / rejected with reason)
- Vitals tracker (blood pressure, glucose, heart rate, weight, temperature, SpO₂) with charts and out-of-range highlights
- Book appointments (taken slots hidden, visit reason), view and cancel them
- Care team: find doctors by specialty and control who can see your records
- Private notes, in-app notifications

**Doctors**
- Patient files with records, health profile and vitals; allergy alerts
- Review queue: approve or reject submissions with a reason
- Appointments by day, complete or cancel with a reason; clinic insights charts
- Professional profile (specialty, experience, bio) shown in the directory

**AI (Mistral by default, Claude optional)**
- PakMed Assistant chat (⌘J): answers questions using the user's own data through tools, can book appointments, log vitals and save notes after confirmation; English, Urdu and Roman Urdu
- "Explain" any record in plain language for patients
- AI pre-consultation brief of a patient for doctors
- Lab values read from uploaded reports and charted as trends; AI follow-up suggestions ("repeat HbA1c is due")
- Prescription safety check: allergy, duplicate and drug-interaction warnings

**Trust and safety**
- Doctors upload their PMDC certificate; an admin verifies them before they can see records or appear in the directory
- Admin portal (`/admin`): doctor verification queue, account suspension, user reports, lab/pharmacy API keys, server error log
- Email verification, password reset by email, optional two-step sign-in (authenticator app + recovery codes)
- "Who viewed my record" access log, Terms and Privacy Policy accepted at sign-up, full data export and account deletion

**Everyday care**
- Doctor clinic hours (several blocks a day, slot length, days off); booking only offers open slots
- Video visits (peer-to-peer WebRTC, with a Jitsi backup link) with consultation notes saved to the record
- Consultation fees: pay online with Safepay (cards, JazzCash, Easypaisa, bank) straight into the clinic's or doctor's own merchant account, or at the clinic; PDF receipts, refund tracking, and a simulated test checkout for demos
- Platform revenue: a 5% commission is recorded on every online fee; admins see all payments, commission per clinic, and send and track monthly invoices (Admin → Payments)
- E-prescriptions with a QR code pharmacies can verify at `/rx/<code>`; the patient's medicine list updates automatically
- Medicine tracker: daily dose checklist, adherence history (visible to doctors), refill reminders
- Family profiles: manage children's and parents' records under one login, switch profiles, hand over a login later
- Pakistan EPI childhood vaccination schedule with due/overdue tracking
- Time-limited share links (1 hour to 7 days, revocable) and an emergency QR card for paramedics
- Reminders by in-app notification, email, WhatsApp or SMS (daily job via Vercel Cron)
- Urdu interface with right-to-left layout; installable as an app (PWA) with offline access to recent records

**Hospitals (multi-tenant) and partners**
- Hospitals, clinics and labs register themselves (`/hospitals/register`), upload their healthcare-commission registration, and appear to patients once a PakMedRecord admin verifies them (Admin → Hospitals)
- Each organization has branches across Pakistan, departments, staff accounts with roles (administrator, branch manager, receptionist, billing) limited to chosen branches, its own Safepay account and analytics per branch and doctor
- Doctors work at many hospitals (many-to-many memberships), with a separate fee and weekly hours per branch, plus optional private practice; a doctor can also set up and run their own clinic
- Patients browse city → hospital → branch → doctor (`/hospitals`) and book at a specific branch; a doctor can never be double-booked across hospitals
- Tenant isolation: every hospital route resolves the caller's organization and role from their own account and filters by it; other organizations' data returns 404. Patients' medical records are not hospital data: they stay with the patient and the doctors they choose
- Front desk (`/desk`): book walk-ins, check patients in, mark no-shows and record payments, without access to records. Only verified hospitals can look patients up (masked name, logged in the patient's "who viewed my record", rate-limited) or invite doctors; a first booking for a new patient needs a 6-digit code the patient receives and reads out
- No double-booking across hospitals: visits keep their real length, a doctor can set travel time between hospitals, and weekly hours can't overlap another hospital or their private practice
- When a doctor leaves, a branch closes or a hospital is suspended, patients with upcoming visits are told on every channel; "Move" re-books with the same doctor at another hospital/time in one step (a paid fee moves with it when the same hospital is paid, otherwise it's refunded)
- Prescriptions record and print the hospital branch where they were issued

**Identity**
- CNIC checks on every sign-up (NADRA layout: region digit, odd/even gender digit) to catch typos; one CNIC can hold both a doctor and a patient account
- Identity check (`/verify-identity`): CNIC photo (number read by OCR) plus a live camera check with random head-turn and blink challenges, anti-spoof and liveness models, and face matching against the CNIC photo. It runs on the device (face models are served from this site); photos go to an admin for review (Admin → Identity)
- "Claim my CNIC" (`/claim-cnic`): someone whose CNIC was used by another account proves it's theirs; an admin hands the account over (new email, everyone signed out, reset link) or freezes it
- Practice and clinic analytics: no-show and cancellation rates, returning patients, fees collected, busiest hours and days
- Public doctor directory (`/find-doctors`) with fees, timings and verified badges, searchable by city and specialty
- Partner API for labs (push results into a patient's record) and pharmacies (verify and dispense prescriptions); docs at `/developers`

**Operations**
- `/health` endpoint, helmet security headers, CORS allowlist, central error log
- Nightly database backup GitHub Action (`.github/workflows/backup.yml`, needs a `MONGODB_URI` repository secret); `npm run backup` / `npm run restore` locally

## Running locally

You need Node.js 18+ and a MongoDB database (local, Docker, or Atlas).

```sh
# MongoDB in Docker (skip if you already have one)
docker run -d --name pakmed-mongo -p 27017:27017 -v pakmed-data:/data/db mongo:7

# Backend (http://localhost:3009)
cd server
cp .env.example .env   # set JWT_SECRET; optionally ANTHROPIC_API_KEY for the AI features
npm install
npm run dev

# Frontend (http://localhost:5173), in another terminal
cd client
npm install
npm run dev
```

The frontend talks to `http://localhost:3009` by default; set `VITE_API_URL` in `client/.env` to change it.

### AI features

The AI runs on **Mistral** by default, which has a free "Experiment" plan:

1. Create a key at [console.mistral.ai](https://console.mistral.ai) (API keys).
2. In `server/.env` set `AI_PROVIDER=mistral` and `MISTRAL_API_KEY=<your key>`, then restart the server.

The default model is `mistral-small-latest`; set `AI_MODEL=mistral-large-latest` for higher quality.
The free plan is rate-limited, so the assistant may occasionally ask you to wait a few seconds.

To use **Claude** instead (paid), set `AI_PROVIDER=anthropic` and `ANTHROPIC_API_KEY` (default model `claude-opus-5-5`).
Saved conversations belong to the provider that created them; after switching, an old conversation continues as a new one.

Without a key the rest of the app works normally and the assistant shows a "not configured" message.

AI requests are limited to 20 per minute per user and sign-in to 10 attempts per 10 minutes per IP
(`AI_RATE_LIMIT` / `SIGNIN_RATE_LIMIT` to change).

## Deployment

Live at **https://pakmedrecord.vercel.app** (API: https://pakmedrecord-api.vercel.app).

| Part | Host | Notes |
|---|---|---|
| Frontend (`client/`) | Vercel project `pakmedrecord` | `VITE_API_URL` points at the API |
| Backend (`server/`) | Vercel project `pakmedrecord-api` | Express runs as a Vercel Function in Mumbai (`bom1`) |
| Database | MongoDB Atlas project `PakMedRecord` | Free M0 cluster in Mumbai |

Secrets (`MONGODB_URI`, `JWT_SECRET`, `MISTRAL_API_KEY`) live in the Vercel project settings, never in the repo.

To redeploy after changes (with the Vercel CLI logged in):

```sh
cd server && npx vercel deploy --prod   # backend
cd client && npx vercel deploy --prod   # frontend
```

Vercel only accepts deploys whose latest commit author belongs to the Vercel account,
so commit with the account's email (`git config user.email`).
