---
title: Srinamo Farms — Enquiry Channels and Partner Operations
author: Srinamo Farms
date: 2 Sep 2026
papersize: a4
geometry: margin=18mm
fontsize: 11pt
---

# Enquiry + Partner Operations

**Print:** A4 · File → Print → Save as PDF  
**Use with:** `02_PARTNER_PROGRAM.md` (scripts + commission rates) · `04_START_CHECKLIST.md` (daily ticks)  
**Run it in the PMS:** Leads · Partners · Events · Bookings · Reports

This is the desk manual. Every enquiry and every partner lives here. WhatsApp is the reply channel, not the database.

**One rule:** if it is not a Lead (guest) or a Partner (referrer) in the app, it does not exist.

---

## 1. What “handle everything” means

Two objects. Do not mix them.

| Object | Who | PMS screen | Becomes |
|---|---|---|---|
| **Lead** | A guest or company who wants a stay / birthday / wedding / offsite | **Leads** | Booking or Event, then Guest |
| **Partner** | Someone who *sends* guests (planner, photographer, HR, travel) | **Partners** | Linked on the Lead. Commission or company discount when won |

A planner who also wants to book their own birthday is **both**: Partner record + Lead record, linked.

**Stages for a Lead**

`NEW → CONTACTED → QUOTED → HOLD → WON` or `LOST`

**Stages for a Partner** (track in partner notes until we add a field)

`LISTED → CALLED → FAM_VISITED → ACTIVE (has sent 1 enquiry) → PRODUCING (has a paid booking)`

---

## 2. Already in this repo (do not rebuild)

| Screen | You can do today |
|---|---|
| **Leads** | Create lead, source, occasion, partner, quote WhatsApp, log call, convert to booking or event, mark lost |
| **Partners** | Add planner / photographer / decorator / travel / corporate, rate %, mark commission paid |
| **Events** | Wedding / birthday deals, room hold, partner on the deal |
| **Bookings** | Partner on the folio; commission accrues on convert |
| **Reports** | Weekly lead win rate, due commissions |

**Not built yet (build in this order — Section 9)**

1. Public ingest webhook so website / Facebook / Instagram create a Lead without staff login  
2. Finer sources: `WEBSITE`, `FACEBOOK`, `INSTAGRAM`, `GOOGLE` (today they collapse to `ONLINE` / `WHATSAPP`)  
3. Partner status + last-called + FAM date  
4. n8n “enquiry ingest” workflow (store first, then WhatsApp ack)

Until those ship: reception types every enquiry into **Leads** by hand. Same fields. Same SLA.

---

## 3. Channel map — guest enquiries

Every inbound path must end as one Lead. Fill **source**, **occasion**, **notes** (dates / pax / raw message), and **partner** if a referrer named themselves.

### A. Own channels (you control)

| Channel | How it arrives | Source to store | First 15 minutes | Automation later |
|---|---|---|---|---|
| Phone / missed call | Reception or +91 82486 48464 | `PHONE` | Call back. New Lead. Occasion from the first sentence | None. Human. |
| WhatsApp chat | They message the Business number | `WHATSAPP` | Quick reply 1–4. New Lead | Cloud API inbound → ingest webhook + ack |
| Website form | srinamofarms.com Stay / Celebrate / Corporate | `ONLINE` (later `WEBSITE`) | Form must not die in email. Until webhook: form opens WhatsApp **or** you copy into Leads | n8n webhook → Lead + WhatsApp ack |
| Website `wa.me` button | Prefill: Stay / Birthday / Wedding / Corporate | `WHATSAPP` + note “website” | Same as WhatsApp | UTM in the link: `?text=Stay%20(website)` |
| Google Business Profile | Call, message, or WhatsApp button | `PHONE` or `WHATSAPP` + note “GBP” (later `GOOGLE`) | Same 15-min SLA. Pin must stay Kilachery | Tagged `wa.me` link |
| Facebook Page | Comment, Messenger, or click-to-WhatsApp | `ONLINE` + note “facebook” (later `FACEBOOK`) | Move chat to WhatsApp. New Lead | Meta → n8n → same ingest |
| Instagram | DM, comment, bio button | `ONLINE` + note “instagram” (later `INSTAGRAM`) | Same. Do not quote only in DMs — get a phone | Same Meta pipe |
| YouTube / Shorts | Rare; they jump to WhatsApp or site | `ONLINE` + note “youtube” | Same as website | Same |

**CTA rule for Wave 1:** every public button is WhatsApp with a prefilled occasion. Reception still creates the Lead until the ingest webhook is live.

### B. Bookable listings (usually a booking, not a lead)

| Channel | What arrives | Store as | Desk action |
|---|---|---|---|
| Airbnb | Confirmed reservation or pre-booking question | Booking source `OTA` (block source `OTA_AIRBNB`). Question = Lead `OTA` | Calendar must match the book. Instant-book off until trusted |
| MakeMyTrip / Goibibo | Room booking | Booking `OTA` (`OTA_MMT`) | Same. Price up for commission |
| Booking.com | Room booking | Booking `OTA` (`OTA_BOOKING`) | Same |
| Walk-in | At the gate | Lead or Booking `WALK_IN` | Veg rule said first. Then book |

Do not create a Lead for an OTA booking that is already in the calendar. Create a **Guest** + **Booking**. Use a Lead only if they asked and have not paid.

### C. Event / local directories (Wave 3)

| Channel | Typical product | Source | Notes |
|---|---|---|---|
| WedMeGood / WeddingWire / Weddingz | Wedding, engagement | `ONLINE` + note the site | Treat as Lead occasion `WEDDING`. Ask who the planner is — may also be a Partner |
| Justdial / Sulekha | Stay, banquet, birthday | `ONLINE` | Often phone. Source `PHONE` if they called the JD number |
| TripAdvisor | Review + rare message | `ONLINE` | Reply on TA; book on WhatsApp; Lead if they ask dates |

### D. Partner-sent (this is the B2B engine)

| Who sent it | Lead source | Partner type to attach | Occasion |
|---|---|---|---|
| Wedding / event planner | `PARTNER` | `PLANNER` | `WEDDING` or `BIRTHDAY` |
| Photographer / cine | `PARTNER` | `PHOTOGRAPHER` | Usually `WEDDING` / `OTHER` (pre-wedding) |
| Decorator / florist / makeup / DJ | `PARTNER` | `DECORATOR` | `WEDDING` / `BIRTHDAY` |
| Travel agent / hotel desk / yatra | `PARTNER` | `TRAVEL` | `STAY` |
| Company HR / Admin / L&D | `PARTNER` | `CORPORATE` | `CORPORATE` |
| Repeat guest referred a friend | `REFERRAL` | — (or Partner if you enrol them) | whatever they asked |
| School / college admin | `PARTNER` | `OTHER` until we add SCHOOL | `OTHER` |
| Freelance setter (Month 8+) | `PARTNER` | `OTHER` | as quoted |

**First-logged partner wins.** If two claim the same guest, the Partner already on the Lead before confirm is paid. See `02_PARTNER_PROGRAM.md`.

---

## 4. Desk SOP — every new enquiry (5 minutes)

Do this in the same order, every time, any channel.

1. **Phone number.** No phone = not a lead. Get it from WhatsApp profile, form, or “please WhatsApp this number”.
2. **Open Leads.** Search the phone. If an open card exists (not WON/LOST), add a note. Do not create a second card.
3. **If new:** New lead. Name, phone, **source**, **occasion**, dates/pax in notes, expected value if they said a budget.
4. **Partner?** If they said “my planner is…” or a partner WhatsApped you, attach that Partner. If the partner is not in the list, add them on **Partners** first (even a thin record: name + phone + type).
5. **Reply on WhatsApp** within 15 minutes (8am–10pm): greeting + 1 Stay / 2 Birthday / 3 Wedding / 4 Corporate if not already chosen.
6. Stage → **CONTACTED**. Next follow-up = tomorrow if you could not quote today.
7. Quote same day when you have dates + pax. Stage → **QUOTED**. Use the Quote button when WhatsApp API is on; until then send the rate-card pack by hand and press Log call.
8. Soft hold (48 hours) if they are serious. Stage → **HOLD**. For events, create an **Event** and Hold rooms if it blocks inventory.
9. Advance received → convert to **Booking** or confirm **Event**. Stage → **WON**. Guest is created from the lead.
10. They vanish or choose veg-elsewhere / price / distance → **LOST** with a reason. Required: `price` / `date` / `veg` / `distance` / `no_response` / `other`.

**Lost reasons feed the Sunday scoreboard.** If “too costly” > 40% of last 20 misses, change inclusions or weekday price — do not only discount weekends.

---

## 5. Partner types — how we manage each

Commission numbers stay in `02_PARTNER_PROGRAM.md`. This section is **how you work them**.

### 5.1 Event / wedding planner — `PLANNER`

**Job:** they already have dates and budgets. Fastest path to lawn + room block.

- Offer: 10% venue + rooms (or 8% all-in if they take F&B). Paid 7 days after guest clears.
- What they need from you: capacity, rain plan, power, alcohol rule, rooms on the wedding night, veg-only said first.
- Cadence: 15 conversations Tue. FAM every second Saturday.
- When they send a couple: Lead `PARTNER` + this Partner. You quote the couple, not the planner’s WhatsApp group only.
- Win: Event + room hold. Commission on convert.

### 5.2 Photographer / cinematographer — `PHOTOGRAPHER`

**Job:** they influence the venue after the couple shortlists. Fast “yes” if you give content.

- Offer: ₹3,000 flat **or** 8% **or** free sunrise pre-wedding slot (pick one at onboarding).
- What they need: 6–10am access, Gaushala + lawn + one change room, tag rights.
- Cadence: call west / SW Chennai + Kanchi. Invite FAM. One complimentary sunrise slot per active partner per month.
- When they send a couple: same as planner. If they only used the slot and did not refer, no cash — that was the trade.
- Do not pay both planner and photographer unless both were logged before confirm (policy: one partner). Prefer the planner if both claim; thank the photographer with the next sunrise slot.

### 5.3 Decorator / makeup / DJ / florist — `DECORATOR`

**Job:** they are in the house on the day. Reciprocal list.

- Offer: 8% or preferred-vendor listing (you send them work; they send you dates).
- Onboard: veg-only, hard end time on 4-hour lawn, no fight with in-house kitchen.
- Lead attach when they bring a birthday / engagement.

### 5.4 Travel agent / hotel desk / yatra — `TRAVEL`

**Job:** room nights, Kanchi Halt, factory-visitor blocks.

- Offer: 12% on rooms (10% if they want OTA-like free cancel).
- Product: rooms, Kanchi Halt, weekday visitor stay. Not wedding buyout unless they are also a planner.
- Booking source `PARTNER`. Commission on rooms only.

### 5.5 Corporate HR / Admin / L&D — `CORPORATE`

**Job:** Tuesday–Thursday occupancy. This is the weekday engine.

- **No cash to the employee.** 12% off on the **company invoice** + free cricket or Gaushala slot.
- Partner record = the **organisation** (Hyundai Admin, Foxconn L&D), not the personal name only. Put the contact person in name, company in firm.
- Lead occasion `CORPORATE`. Product: Sriperumbudur Offsite.
- You still create a Lead when they ask for dates. Won = weekday booking / room block.
- Commission row: **do not accrue a personal payout.** Rate on this partner = `0`. The “pay” is the 12% discount (handle on the folio / quote).
- Cadence: Monday + Thursday calls. Two site visits. Factory-gate pickup if needed.

### 5.6 Other that still belongs on Partners

| Who | Type | Offer | Product |
|---|---|---|---|
| School / college admin | `OTHER` | Invoice to institution, weekday picnic rate | Farm + sports + veg lunch |
| Temple / yatra operator | `TRAVEL` or `OTHER` | 12% rooms | Kanchi Halt |
| Freelance appointment setter (Phase 5) | `OTHER` | 5–8% of closed deal they set | Corporate / event they booked the visit for |
| Repeat guest who keeps sending families | `OTHER` or guest referral | 10% weekday / 5% weekend for the *new* guest | Stay |

---

## 6. Partner lifecycle — from a name to a paid booking

Do not “network”. Use this ladder. Sheet is allowed for the raw call list; **the moment they pick up or visit, they go into Partners**.

| Step | You do | Where | Exit |
|---|---|---|---|
| 1. List | Name, firm, phone, type, area | Google Sheet *or* Partners (thin) | 80 names in 90 days |
| 2. First call | Script in `02_PARTNER_PROGRAM.md` | Log in partner notes: date + result | FAM invite or PDF sent |
| 3. Same-day pack | 6 photos, one-pager, pin, rate card, Saturday time | WhatsApp | They have something to forward |
| 4. FAM Saturday | 8–12 people, 10:30–14:00 | Collect cards. Update Partner: “FAM dd/mm” | 25 visited in 90 days |
| 5. Same-evening WhatsApp | Rate card + photo pack | WhatsApp | They can sell you tomorrow |
| 6. First enquiry they send | **New Lead** + attach Partner | Leads | Partner is now ACTIVE |
| 7. You quote the guest | Normal desk SOP | Leads | QUOTED / HOLD |
| 8. Guest pays | Convert Lead → Booking or Event | Commission **DUE** (except corporate) | Partner is PRODUCING |
| 9. Guest final payment clears | Wait 7 working days | Partners → Commissions → Mark paid | Reputation of the program |
| 10. Keep warm | 30-day reminder, not weekly begging | Partner notes / next FAM | 8 have sent a first enquiry |

**Corporate skip:** no FAM required if two HR people do a Tuesday lunch instead. Still a Partner record.

**Photographer skip:** complimentary sunrise can happen *before* they send a guest. Still log the Partner so you know who owes you tags.

---

## 7. How a partner enquiry is handled (end to end)

Example: a Porur planner WhatsApps “Sat 18 Oct, 120 pax, engagement, rooftop”.

1. Confirm the **Partner** exists (type `PLANNER`). Create if missing.
2. New **Lead**: name of the couple (or “via [planner]” if you only have the planner’s number — then get the couple’s phone the same day). Phone = couple if possible, else planner. Source `PARTNER`. Occasion `BIRTHDAY` or `WEDDING`. Attach partner. Notes = date, pax, rooftop, 4-hour hard stop.
3. WhatsApp the planner: “Received. I will send a rooftop + veg menu quote today. Couple’s number please so check-in is clean.”
4. Quote (two veg menus if wedding; 4-hour lawn/rooftop if engagement). Stage QUOTED.
5. If they want the date: 40% to hold. Create **Event**, Hold rooms if exclusive or wedding-night stay. Stage HOLD.
6. Balance per payment policy. Convert / confirm. Commission DUE on venue+rooms.
7. After function: thank-you + review ask goes to the **guest**, not the planner. Commission paid in 7 days with a one-line statement.

If the same planner sends three dates, that is **three Leads** on one Partner — not one mega-note.

---

## 8. What you store (minimum fields)

### Lead (every enquiry)

- name, phone (unique key for open cards)
- source (channel)
- occasion (Stay / Birthday / Wedding / Corporate / Other)
- stage, next follow-up, expected value
- partner (if any)
- notes: dates, pax, venue hint, raw first message, lost reason later

### Partner (every referrer / HR)

- name, phone, firm, type
- commission rate (0 for corporate)
- notes: area, last call, FAM date, “active / producing”, alcohol questions they asked
- isActive (pause without deleting)

### When they convert

- Guest (phone match)
- Booking and/or Event
- Commission DUE (non-corporate)
- Inventory hold if the date blocks rooms

**Sheet vs PMS**

| Still in Google Sheet | Must be in PMS |
|---|---|
| Cold names you have not called | Anyone who answered, visited, or sent a guest |
| Personal scribble before the call | Every guest enquiry |
| Weekly call *targets* | Every confirmed booking / event |

After Week 2, stop dual-writing closed deals. Sheet is the dialler list. PMS is the source of truth.

---

## 9. Build plan (product) — when to add software

Do not block sales on this. Type by hand first.

| Order | Build | Unlocks |
|---|---|---|
| 1 | `POST /api/webhooks/enquiry` (secret header). Dedupe by phone + open stage | Website / n8n can create Leads |
| 2 | Sources: `WEBSITE`, `FACEBOOK`, `INSTAGRAM`, `GOOGLE` | Honest Sunday mix |
| 3 | n8n **enquiry-ingest**: any channel → PMS → WhatsApp ack (`lead_quote`) | Desk stops copy-paste |
| 4 | Website form posts to that n8n webhook | Direct site path |
| 5 | Tagged `wa.me` links on GBP / FB / IG | Source without Meta API |
| 6 | Meta lead form / DM → same n8n workflow | Ads and DMs on the same board |
| 7 | Partner: status, lastContactAt, famVisitedAt, city | Stop using notes as CRM |
| 8 | Partner detail: their leads, due commission, last booking | You manage 80 names without a sheet |
| 9 | Inbound WhatsApp (Cloud API) → ingest if new phone | Night/weekend capture |
| 10 | Optional: school / yatra partner types | Cleaner reports |

**n8n rule:** store in PMS first, then send WhatsApp. If Meta is down, the Lead still shows.

Existing workflows stay: `booking-confirmation`, `checkin-reminder`, `checkout-thankyou`, `review-ask`, `lead-quote` (the Quote button). Ingest is a **new** workflow, not a rewrite of those.

---

## 10. Weekly operating rhythm (channels + partners)

Keep the clock in `04_START_CHECKLIST.md`. This is only the *split*.

| Day | Guest channels | Partners |
|---|---|---|
| Mon | Pipeline. Today’s arrivals. Unread WhatsApp | Corporate / HR calls (they pick up) |
| Tue | Quote anything sitting in NEW / CONTACTED | 15 planner + photographer conversations |
| Wed | Website / GBP / Facebook one fix. Quotes | FAM planning. One service fix on site |
| Thu | Follow up QUOTED / HOLD | HR follow-up or factory-area visit |
| Fri | Guest walk. Weekend upsell | WhatsApp catalog + partner pack check |
| Sat | Host or FAM | FAM or viewing. Cards into Partners same day |
| Sun | Review ask every checkout. Scoreboard | Count: partners called / visited / first enquiry |

**Sunday numbers (add to the owner scoreboard)**

- Enquiries by source (WhatsApp, website, GBP, FB, IG, phone, OTA, partner)
- Partner conversations (target 40 quality / week)
- Partners who have visited (running total → 25)
- Partner-sent leads vs won
- Commissions DUE vs paid this week
- Lost reasons (top 2)

---

## 11. Start this week (no new code)

### Guest channels

- [ ] WhatsApp Business: 4 quick replies. Every chat → Lead the same hour.
- [ ] Website: WhatsApp button + form that opens chat or a sheet you empty into Leads daily.
- [ ] GBP: WhatsApp / call button. Pin Kilachery.
- [ ] Facebook + Instagram: action button = WhatsApp. Bio link same.
- [ ] Reception trained: phone → Leads, never “I’ll remember”.

### Partners

- [ ] Owners sign the one-page policy in `02_PARTNER_PROGRAM.md`.
- [ ] Partners page: add anyone you already know (even 5 names).
- [ ] Sheet columns: name, firm, phone, type, area, date called, result, FAM, first enquiry date.
- [ ] 30 planners + 30 photographers + 20 corporates listed (names + phones).
- [ ] First 15 calls. Saturday FAM invite.
- [ ] Corporate partners: rate `0`, firm = company name.

### When a partner sends the first guest

- [ ] Lead + Partner attached **before** you quote.
- [ ] One partner only.
- [ ] After they pay: commission DUE → pay in 7 days (even if small).

---

## 12. What “done” looks like (90 days)

- Stranger can enquire from site / Google / WhatsApp and you answer in 15 minutes.
- That enquiry is on the Leads board with the right source.
- 80 partners in Partners (or sheet migrated). 25 have walked the lawn.
- 8 have sent at least one Lead. You can open that Partner and see the thread of leads.
- Corporate weekday hold exists (even 10 rooms).
- First commission paid on time.
- Checkout review-ask running (test in Week 4, production by Week 9).
- You are not hunting chats to know who enquired yesterday.

Scripts, rates, and FAM run-of-show stay in `02_PARTNER_PROGRAM.md`. Weekly ticks stay in `01_90_DAY_SPRINT.md`. This file is the map of **which channel becomes which record**, and **how each partner type is run**.
