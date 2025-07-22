#!/usr/bin/env node
/**
 * Daily Slack countdown poster.
 *
 * Event: "What have you done today to double your money?"
 * Start Date: 2025-07-20 (local Asia/Jerusalem)
 * Target Date: 2025-10-18 (90 days from start)
 *
 * Styling goals:
 *  - Progress bar (emoji)
 *  - % complete (1 decimal)
 *  - Dynamic + mildly funny motivational nudge
 *  - Milestone extra spice on selected days
 *
 * Environment:
 *   SLACK_WEBHOOK_URL (secret)
 *   TZ (optional override, default Asia/Jerusalem)
 *
 * Run idempotently once per day ~09:00 local.
 */

import { WebClient } from "@slack/web-api";
import { createHash } from "crypto";
import fs from "fs";

// --- Config constants (hard-coded for simplicity) ---
const EVENT_NAME = "What have you done today to double your money?";
const START_DATE = "2025-07-20"; // inclusive
const TARGET_DATE = "2025-10-18"; // inclusive target day (day 0 message)
const TZ = process.env.TZ || "Asia/Jerusalem";
const WEBHOOK = process.env.SLACK_WEBHOOK_URL;
const client = new WebClient(process.env.SLACK_BOT_TOKEN);

// Milestones (days left) that trigger an amplified / alternate message
const MILESTONES = new Set([90, 75, 60, 45, 30, 21, 14, 10, 7, 5, 3, 2, 1, 0]);

// Bar settings
const BAR_LENGTH = 30;
const BAR_FILLED = "🟩";
const BAR_EMPTY = "⬜";

// After project ends (daysLeft < 0) => stop posting (no “days since” chatter)
const STOP_AFTER = true;

// --- Helpers ---
function localStartOfDay(dateStr, tz) {
  // Force midnight of tz
  return new Date(new Date(`${dateStr}T00:00:00`).toLocaleString("en-US", { timeZone: tz }));
}

function todayLocal(tz) {
  return new Date(new Date().toLocaleString("en-US", { timeZone: tz }));
}

function daysDiff(a, b) {
  // (b - a) measured in whole days (floor)
  const ms = b - a;
  return Math.floor(ms / 86_400_000);
}

// Ceil remaining days so partial remainder counts as a “day left”
function daysLeft(nowLocal, targetLocal) {
  return Math.ceil((targetLocal - nowLocal) / 86_400_000);
}

function buildProgress(elapsedDays, totalDays) {
  const ratio = Math.min(1, Math.max(0, elapsedDays / totalDays));
  const filled = Math.round(ratio * BAR_LENGTH);
  const bar = BAR_FILLED.repeat(filled) + BAR_EMPTY.repeat(BAR_LENGTH - filled);
  const pct = (ratio * 100).toFixed(1);
  return { bar, pct };
}

function pickNudge(daysLeft, pct, isMilestone) {
  const lines = [];

  if (daysLeft > 1) {
    lines.push(`⏳ *${daysLeft} days left* (${pct}% done).`);
  } else if (daysLeft === 1) {
    lines.push(`🔥 *1 day left!* (${pct}% done). Last call.`);
  } else if (daysLeft === 0) {
    lines.push(`🚀 *Today is the final day!* (${pct}% complete). Make it count.`);
  }

  const generic = [
    "What *specifically* did you do today to move the doubling needle?",
    "Tiny compounding moves > heroic last-minute swings.",
    "If you can’t write one actionable line you did—fix that *now*.",
    "Momentum beats perfection. Ship a micro-improvement.",
    "Eliminate one drag, amplify one driver."
  ];

  // Deterministic pick so reruns (manual trigger) don’t change the message
  const seedSource = `${daysLeft}-${pct}`;
  const idx = parseInt(createHash("md5").update(seedSource).digest("hex").slice(0, 8), 16) % generic.length;
  const baseNudge = generic[idx];

  if (daysLeft > 0) {
    lines.push(`💡 *Prompt:* ${baseNudge}`);
  }

  if (isMilestone && daysLeft > 0) {
    const milestoneFlavor = [
      "Milestone check-in: write *one concrete win* in a thread.",
      "Drop a ✅ in thread once you’ve executed *one task* toward doubling.",
      "Share your fastest experiment idea—speed > certainty.",
      "Name a blocker *and* the next action to crush it.",
      "Brag moment: what metric nudged upward recently?"
    ];
    const midx = parseInt(createHash("sha1").update(seedSource).digest("hex").slice(0, 8), 16) % milestoneFlavor.length;
    lines.push(`🎯 *Milestone Prompt:* ${milestoneFlavor[midx]}`);
  }

  if (daysLeft === 0) {
    lines.push("🏁 *Project is over after today.* Post a retro: What worked? What was noise? What will you keep doing?")
  }

  return lines.join("\n");
}

// Optional: store a hash so we don’t double-post if re-run same day (simple local file cache).
// On GitHub Actions ephemeral runner this is only per run; still useful if script gets invoked twice in same job.
function alreadyPostedGuard(hash) {
  const fname = ".last_post_hash";
  try {
    if (fs.existsSync(fname)) {
      const prev = fs.readFileSync(fname, "utf8").trim();
      if (prev === hash) return true;
    }
    fs.writeFileSync(fname, hash);
  } catch { /* ignore */ }
  return false;
}

async function postToSlack(text) {
  await client.chat.postMessage({
    channel: "#proj-double",
    text,
    mrkdwn: true,
    username: "Money Doubler",
    icon_emoji: ":proj_double:"
  });
}

function main() {
  if (!WEBHOOK) {
    console.error("Missing SLACK_WEBHOOK_URL");
    process.exit(1);
  }

  const now = todayLocal(TZ);
  const start = localStartOfDay(START_DATE, TZ);
  const target = localStartOfDay(TARGET_DATE, TZ);

  const totalDays = daysDiff(start, target); // e.g. 90
  const elapsedDays = Math.min(totalDays, Math.max(0, daysDiff(start, now)));
  const remaining = daysLeft(now, target);
  const isMilestone = MILESTONES.has(remaining);

  if (remaining < 0) {
    if (STOP_AFTER) {
      console.log("Target date passed. Stopping (no further posts).");
      return;
    } else {
      // (Not used in this challenge)
      console.log("Target passed; would post 'since' message.");
      return;
    }
  }

  const { bar, pct } = buildProgress(elapsedDays, totalDays);
  const nudge = pickNudge(remaining, pct, isMilestone);

  const header = `*${EVENT_NAME}*`;
  const progressLine = `${bar} ${pct}%`;
  const core = `${header}\n${progressLine}\n${nudge}`;

  const hash = createHash("md5").update(core).digest("hex");
  if (alreadyPostedGuard(hash)) {
    console.log("Already posted identical message this run; skipping.");
    return;
  }

  postToSlack(core)
    .then(() => console.log("Posted:\n" + core))
    .catch(err => {
      console.error(err);
      process.exit(1);
    });
}

main();
