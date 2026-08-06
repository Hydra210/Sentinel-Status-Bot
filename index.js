// ============================================================
//  Website Status Bot
//  Pings your site on a timer. Sets Discord presence + nickname
//  to reflect whether it's up or down.
//  Built for: Nexesmere / EXE Development
// ============================================================

require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');

const {
  BOT_TOKEN,
  GUILD_ID,
  WEBSITE_URL = 'https://exedevelopement.com/',
  CHECK_INTERVAL_MINUTES = '2',
  REQUEST_TIMEOUT_MS = '10000',
} = process.env;

if (!BOT_TOKEN || !GUILD_ID) {
  console.error('[FATAL] Missing BOT_TOKEN or GUILD_ID in your .env file. Fix that first.');
  process.exit(1);
}

const client = new Client({
  intents: [GatewayIntentBits.Guilds], // this bot doesn't need members/presence intents, it's just setting its own status
});

let lastKnownState = null; // null = unknown yet, true = up, false = down

async function checkWebsite() {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), Number(REQUEST_TIMEOUT_MS));

  try {
    const res = await fetch(WEBSITE_URL, {
      method: 'GET',
      signal: controller.signal,
      redirect: 'follow',
    });
    clearTimeout(timeout);

    // treat any response (even 4xx/5xx) as "the server answered" if you want stricter checks,
    // change this to `res.ok` so only 2xx counts as "up"
    const isUp = res.status < 500;

    await updateStatus(isUp, res.status);
  } catch (err) {
    clearTimeout(timeout);
    // network error, DNS fail, timeout, connection refused, etc — site is unreachable
    await updateStatus(false, null, err.message);
  }
}

async function updateStatus(isUp, httpStatus, errorMsg) {
  // don't spam the Discord API with identical updates every single check
  if (lastKnownState === isUp) {
    console.log(`[check] no change — still ${isUp ? 'UP' : 'DOWN'}${httpStatus ? ` (HTTP ${httpStatus})` : ''}`);
    return;
  }
  lastKnownState = isUp;

  const guild = client.guilds.cache.get(GUILD_ID);
  if (!guild) {
    console.error(`[updateStatus] bot isn't in guild ${GUILD_ID}`);
    return;
  }

  try {
    if (isUp) {
      await client.user.setPresence({ status: 'online' });
      await guild.members.me.setNickname('Sentinel: Online');
      console.log(`[check] UP (HTTP ${httpStatus}) — presence set to online`);
    } else {
      await client.user.setPresence({ status: 'dnd' });
      await guild.members.me.setNickname('Sentinel: Offline');
      console.log(`[check] DOWN${errorMsg ? ` (${errorMsg})` : ` (HTTP ${httpStatus})`} — presence set to dnd`);
    }
  } catch (err) {
    // most common cause: bot's role isn't high enough to change its own nickname
    console.error('[updateStatus] failed to update presence/nickname:', err.message);
  }
}

client.once('ready', async () => {
  console.log(`[BOT] logged in as ${client.user.tag}`);
  console.log(`[BOT] watching ${WEBSITE_URL} every ${CHECK_INTERVAL_MINUTES} min`);
  await checkWebsite(); // run one immediately on boot instead of waiting for the first interval
  setInterval(checkWebsite, Number(CHECK_INTERVAL_MINUTES) * 60_000);
});

client.login(BOT_TOKEN);
