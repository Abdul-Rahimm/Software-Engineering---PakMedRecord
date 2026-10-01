# Software-Engineering---PakMedRecord
This repo is made for our 6th semester SE project

## Running locally

You need Node.js 18+ and a MongoDB database (local, Docker, or Atlas).

```sh
# MongoDB in Docker (skip if you already have one)
docker run -d --name pakmed-mongo -p 27017:27017 mongo:7

# Backend (http://localhost:3009)
cd server
cp .env.example .env   # then set JWT_SECRET (and MONGODB_URI if not local)
npm install
npm run dev

# Frontend (http://localhost:5173), in another terminal
cd client
npm install
npm run dev
```

The frontend talks to `http://localhost:3009` by default; set `VITE_API_URL` in `client/.env` to change it.
