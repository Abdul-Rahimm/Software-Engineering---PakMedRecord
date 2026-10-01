# Software-Engineering---PakMedRecord
This repo is made for our 6th semester SE project

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

**AI (Claude)**
- PakMed Assistant chat (⌘J): answers questions using the user's own data through tools, can book appointments, log vitals and save notes after confirmation; English, Urdu and Roman Urdu
- "Explain" any record in plain language for patients
- AI pre-consultation brief of a patient for doctors

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

The assistant uses the Claude API (`claude-opus-5-5` by default; override with `AI_MODEL`). Put an API key from
[console.anthropic.com](https://console.anthropic.com) in `server/.env` as `ANTHROPIC_API_KEY` and restart the server.
Without a key the rest of the app works normally and the assistant shows a "not configured" message.

AI requests are limited to 20 per minute per user and sign-in to 10 attempts per 10 minutes per IP
(`AI_RATE_LIMIT` / `SIGNIN_RATE_LIMIT` to change).
