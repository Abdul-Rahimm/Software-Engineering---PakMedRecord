# Software-Engineering---PakMedRecord
This repo is made for our 6th semester SE project

**Live demo: https://pakmedrecord.vercel.app**

Demo accounts (password `demo1234`): patient CNIC `42101-9999999-1`, doctor CNIC `42101-1234567-1`.

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
