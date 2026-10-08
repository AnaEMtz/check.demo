# Site chat assistant

An AI chat widget for your website that answers from your own database.

- `widget/` – the chat bubble (static files, hosted free on **GitHub Pages**)
- `api/chat.js` – the backend that talks to Claude (deployed on **Vercel**, free tier)
- `lib/db.js` – the one file you edit to connect **your database**

Your Anthropic API key lives only on the backend, never in the browser.

## Setup

### 1. Push to GitHub
Create a repo and push this folder to the `main` branch.

### 2. Deploy the API (Vercel)
1. Import the repo at vercel.com/new.
2. Add environment variables (see `.env.example`):
   - `ANTHROPIC_API_KEY`
   - `ALLOWED_ORIGINS` – your website and GitHub Pages URL, comma-separated
3. Deploy. Your API is at `https://YOUR-APP.vercel.app/api/chat`.

### 3. Host the widget (GitHub Pages)
Repo → Settings → Pages → Source: **GitHub Actions**. Pushing to `main` publishes `widget/`
to `https://YOURNAME.github.io/REPO/`.

### 4. Add it to your site
```html
<script src="https://YOURNAME.github.io/REPO/chat-widget.js"
        data-api="https://YOUR-APP.vercel.app/api/chat"
        data-title="Ask us anything"
        data-color="#1f5f4a"
        data-greeting="Hi! What can I help you find?" defer></script>
```

### 5. Connect your database
Edit `searchRecords()` in `lib/db.js`. It receives the visitor's keywords and returns up to
5 short records. Examples for Supabase and Postgres are included. Use a **read-only**
database user, and only expose data you're happy for visitors to see.

## Test locally
```bash
npm i -g vercel
cp .env.example .env     # add your key, set ALLOWED_ORIGINS=*
vercel dev               # API on http://localhost:3000/api/chat
npx serve widget         # open the demo page
```

## Before going live
- Set `ALLOWED_ORIGINS` to your real domains (not `*`).
- Add rate limiting (Vercel Firewall, or Upstash Ratelimit) so nobody can run up your API bill.
- Set a spend limit on your Anthropic account.
