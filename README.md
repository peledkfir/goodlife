# 90-Day Countdown Slack Bot

Posts a daily 09:00 Asia/Jerusalem progress reminder for:

**"What have you done today to double your money?"**

- **Start:** 2025-07-20
- **Target:** 2025-10-18 (inclusive)
- **Duration:** 90 days
- **Posting Time:** 09:00 local (cron 06:00 UTC)
- **Milestones:** 90,75,60,45,30,21,14,10,7,5,3,2,1,0 days left
- **Stops** after final day (no “days since” spam).

## Setup

1. Create Slack App → Enable **Incoming Webhooks** → Add Webhook to `#proj-double`.
2. Copy the webhook URL.
3. In repo: Settings → Secrets and variables → Actions → **New repository secret**:
   - Name: `SLACK_WEBHOOK_URL`
   - Value: (the webhook URL)
4. Commit these files. The workflow auto-posts daily. Use “Run workflow” button for an immediate test.

## Customize

Edit `send-countdown.js`:
- Adjust milestones: `MILESTONES`
- Change emojis / bar length
- Add additional prompts

## Manual Run

`Actions → Daily Countdown → Run workflow` to post instantly (idempotent guard prevents duplicate same-day identical content).

---

_No financial advice. This is a behavioral nudge machine._