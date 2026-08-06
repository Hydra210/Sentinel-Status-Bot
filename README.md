# Website Status Bot

Pings your site every couple minutes. Sets the bot's Discord presence and nickname
to reflect whether it's reachable:

- **Up** → status: Online, nickname: `Website Up`
- **Down** → status: Do Not Disturb, nickname: `Website Down`

Defaults to checking `https://exedevelopement.com/` (yes, typo and all — that's the
real domain, it's in the `.env.example` already).

## 1. Make the bot (separate app from your stats bot)

Same process as before, new application:

1. https://discord.com/developers/applications → New Application
2. Bot tab → grab the token → this is `BOT_TOKEN`
3. No privileged intents needed for this one — it only checks a website and updates its own status.
4. OAuth2 → URL Generator → scope `bot` → permission `Change Nickname` (that's literally the only one it needs) → invite it to your server.

**Important:** the bot needs the "Change Nickname" permission, and if your server uses
role hierarchy restrictions, make sure nothing is blocking it from changing its own nickname.

## 2. Run it locally first

```bash
npm install
cp .env.example .env
# fill in BOT_TOKEN and GUILD_ID
npm start
```

Watch the console — it checks immediately on boot, then every `CHECK_INTERVAL_MINUTES`.
You should see something like:

```
[BOT] logged in as WebsiteStatus#1234
[BOT] watching https://exedevelopement.com/ every 2 min
[check] UP (HTTP 200) — presence set to online
```

## 3. Deploy to Render

Same deal as the stats bot:

1. Push to GitHub
2. Render → New → **Background Worker** (not Web Service — this bot has no HTTP
   endpoints of its own, it's just a standing process that checks your site on a timer)
3. Build Command: `npm install`
4. Start Command: `npm start`
5. Env vars: `BOT_TOKEN`, `GUILD_ID`, and optionally `WEBSITE_URL` / `CHECK_INTERVAL_MINUTES` if you want to override the defaults

### Do I need keep-alive cron for this one?

No — unlike the stats bot, a **Background Worker** on Render doesn't sleep from
inactivity the way a free Web Service does (that sleep behavior is specific to
services that need to answer HTTP requests with no incoming traffic). Worker
services keep running as long as they don't crash. If you're on the free tier,
double check Render's current worker limits since free-tier support for
Background Workers has shifted around — the dashboard will tell you if it's
sleeping.

## Config options (`.env`)

| Variable | Default | What it does |
|---|---|---|
| `WEBSITE_URL` | `https://exedevelopement.com/` | the URL it checks |
| `CHECK_INTERVAL_MINUTES` | `2` | how often it checks |
| `REQUEST_TIMEOUT_MS` | `10000` | how long to wait before counting it as down |

## Notes

- It only updates Discord (presence/nickname change) when the status actually
  *flips* — it won't spam-call the API every single check if nothing changed.
- A response with any status code under 500 counts as "up" (so a 404 still
  reads as up — the server answered). If you want only a clean 200 to count,
  change `res.status < 500` to `res.ok` in `index.js`.
- Timeouts, DNS failures, and connection refused all count as "down."
