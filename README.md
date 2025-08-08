# Transfer Pulse

Modern football transfer news from BBC, Sky, Guardian, ESPN, plus Fabrizio Romano tweets.

## Run locally

1. Install Node.js from https://nodejs.org
2. In this folder, run:
   ```bash
   npm install
   npm run dev
   ```
3. Copy `.env.example` to `.env.local`, set `TWITTER_BEARER_TOKEN` to your X API bearer token, and restart `npm run dev`.

## Deploy

1. Push this folder to a GitHub repo.
2. Import the repo on Vercel.
3. Add `TWITTER_BEARER_TOKEN` in Vercel Project Settings, Environment Variables.
4. Deploy.
