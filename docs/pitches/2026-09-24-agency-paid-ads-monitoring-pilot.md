# Paid-ads monitoring console — pilot proposal

For: [[AGENCY NAME]] · From: [[YOUR NAME]] · Date: [[SEND DATE]]
Re: their "Digital Ads Specialist" posting, answered as a system + operator engagement.

All timings are `[[FILL]]` — they depend on their account structure and on two platform reviews I
cannot compress. Do not send this with invented numbers.

---

## 1. What I'm actually proposing

You're hiring someone to look at many accounts every day and stop the ones going wrong. I can fill
that seat. I'd rather also hand you the tool that makes the seat reliable, because the failure mode
of daily monitoring by hand isn't carelessness — it's that a person checking 40 accounts in a
spreadsheet at 9am only sees yesterday.

So: **a read-only monitoring console for your paid book, running on infrastructure I've already
built and tested, plus me operating it.** Not a new SaaS pitch, and not a promise to replace
Monday.com or Slack.

## 2. Where I'm thin, stated plainly

- I have **no professional history managing ad accounts**. My background is building the systems
  around that work. Your strategist's direction is what makes my execution safe; I'm not applying to
  plan media.
- **The current product has zero advertising data.** It is a multi-client *organic* reporting
  platform (Search Console, GA4, Semrush). Nothing in it has ever talked to Google Ads or Meta.
- Google Ads and Meta API access are **application and review processes, not code**. I've filed
  nothing yet, and I won't quote you a date that depends on someone else's queue.

## 3. What already exists and runs

Verified against this repo today, not planned:

| Capability | State | Why it matters to you |
| --- | --- | --- |
| Many clients, one operator, one login | Live | Your book is N accounts × platforms. The tenancy model is `client × source`, already built for exactly this shape. |
| Per-client access isolation | Live, **proven against a real Postgres** | Visibility is decided by row-level security in the database, not by a check in application code. 5 integration tests assert a client cannot see another client's row, staff sees only their assignment, admin sees all. This is what stops a report going to the wrong landscaping company. |
| Roles `admin / client / staff` | Live | Maps onto your structure: strategist, you, and the client themselves seeing different things from the same URL. |
| Daily per-client sweep | Live enqueue | A 2 AM cron creates one job per active client and returns how many queued, so a missed client is visible rather than silent. |
| CSV + PDF report generation | Live, tested | "Pull basic campaign performance reports when requested" is the most repetitive part of the role. Export is built with spreadsheet-safety and Unicode handling already solved. |
| Change/run logging | Table exists, wired to the sweep | Your posting asks for "document changes and communicate what happened." That's a record, not a message in Slack — see §5. |
| Test suite + CI | 135 unit tests green today; CI runs test/typecheck/lint/build on every push | The discipline claim in your posting has a receipt. |

What does **not** exist: spend data, campaign-level rows, alerting code, any pause/budget
capability, a Monday.com or Slack connector. Those are the build below, not the current product.

## 4. The critical path is approvals, not engineering

| Gate | Who controls it | Blocks |
| --- | --- | --- |
| Google Ads API access — developer token; the entry tier is restricted to test accounts and serving real client accounts needs an application and review | Google | any live Google read |
| Meta Marketing API — app review for `ads_management`/`ads_read`, plus business verification of the app's business | Meta | any live Meta read |
| Manager access granted per client account | You | any demo with real numbers in it |
| A host for the queue worker (the app currently runs on Vercel with a cron but no always-on consumer) | Me, [[FILL]] decision | anything that runs unattended |

Two notes on this table. The exact token tiers and review durations change; I've deliberately not
quoted figures I can't stand behind — `[[CONFIRM ON EACH PLATFORM'S DOCS]]` and I'll record the real
answers with dates. And the honest sequencing consequence: **file the two applications on day one,
before any code**, because everything downstream idles behind them.

### The interim that needs no approval

Both platforms let you download a campaign report as CSV today. Phase 0 ingests those exports, so you
get a real monitoring board on 2–3 accounts without waiting for Google or Meta to answer anyone.
The limitation is stated up front: manual export means the board is only as fresh as the last
upload, so intraday spend-spike detection is impossible until the live read lands. That is precisely
the gap Phase 1 exists to close.

## 5. The operating process (what the seat actually looks like)

I'd write the daily checklist before writing any code, and the thresholds would be *your* strategist's
bands, loaded as editable rows — never constants I invented. Draft shape, to be finalized with you:

| Trigger | Check | Action | Log field |
| --- | --- | --- | --- |
| Account opened, first thing | Spend today vs. trailing 7-day mean, per campaign | Pause immediately if above the band; notify strategist | observed, baseline, band, action taken |
| Any campaign | Spend up, conversions flat at zero for [[FILL]] hours | Flag as suspected tracking failure; do not "fix" tracking | symptom, account, whom it was escalated to |
| Any campaign | CPL above the band set for that account | Report; adjust only inside the band you authorize me to | old/new value, authorization source |
| Start of day | A client's data did not arrive | Escalate, never show stale numbers silently | which client, which source, since when |
| On any action | — | Write down what happened, which account, what I saw, what I did | one audit row per change, actor + timestamp |

The audit row is the design point. "Document changes and communicate what action you took" is the
part of this role that gets scrutinized after a bad month, so it belongs in the database with an
actor and a before/after state — not in someone's memory or a Slack thread that scrolls away.

## 6. Phases

| Phase | You get | Needs | Cost / time |
| --- | --- | --- | --- |
| **0 — Board on exports** | `/monitor` for 2–3 real accounts from downloaded CSVs: spend vs. trailing average per campaign, zero-conversion accounts, "as of HH:MM" freshness stamp, alert bands as editable rows | your exports + strategist's bands | [[FILL]] |
| **1 — Live read, one platform** | The same board on Google Ads with no human in the loop, read-only | developer token approved, manager access to the pilot accounts | [[FILL]] |
| **2 — Unattended sweep + alerts** | Hourly pacing check, alerts pushed to a Slack channel, per-account history | worker hosting decision | [[FILL]] |
| **3 — Audited writes** | Pause / budget change from inside the tool, each one refused outside your band and each one logged before it is attempted | Meta/Google write scopes, a real user-provisioning step, and your written authorization policy | [[FILL]] |
| **4 — Second platform** | Meta on the same contract; Bing / Pinterest / TikTok / LinkedIn additive after that | app review | [[FILL]] |

Phase 3 is deliberately last, and deliberately band-limited in the database rather than in the UI. A
tool that lets an operator raise a client's spend is a tool that eventually does it by accident; the
guard belongs where it can't be bypassed by someone hitting the endpoint directly.

## 7. What I'd need from you to start

1. Read-only / manager access to **2–3 accounts** you'd consider low-risk to practice on.
2. Your strategist's existing optimization bands and the escalation rule for a spend spike — I load
   them as data and follow them literally.
3. Confirmation of which Google account owns the client accounts (one manager login reaches many
   accounts; it changes how credentials are stored, and I'd rather ask than guess).
4. Whether you want Monday.com mirrored or the console is the tracking log.

## 8. The cheap way to say yes

**A paid two-week pilot on 2–3 accounts: Phase 0, on real exports, with the daily checklist and audit
log running from day one.** At the end you have a monitoring board with your numbers on it, a written
process I've been following daily, and a decision about Phase 1 made from evidence instead of a
proposal. If the monitoring isn't up to standard after two weeks, you've spent a fortnight, not a
contract.

Demo: `https://jk-intelligence.vercel.app/` — sign in with `[[DEMO CREDENTIALS — SENT SEPARATELY]]`.
It shows the multi-client model, per-client isolation, the reporting and the exports. **It shows
organic sample data, not advertising data**, and it says so on the page.

---

*Prepared by [[YOUR NAME]] · [[CONTACT]] · [[LINKEDIN]]*
