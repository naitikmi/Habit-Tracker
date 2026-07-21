# Habit Tracker — Project Notes

Living documentation of the codebase, generated from a full source read-through plus a hands-on walkthrough of the running app as both an **admin** account (`naitikmishra`) and a fresh **regular user** account (`testuser1`). Update this file as the app evolves — it's meant to be the single place that explains how everything fits together and what's known to be broken.

Last verified: 2026-07-21 (bug fixes applied and re-verified live, see §8; local dev now connects to the real production database via `.env` + `dotenv`, see §9; ownership-based visibility + expiry filtering + admin's full ended-challenges inventory + Follow model with dropdown auto-follow + centralized expiry auto-switch shipped, see §7; converted to an installable PWA with offline app-shell support, see §10; fixed a real bug where group owners could never manage their own group, and renamed Groups → Habit Tribe, see §11; fixed sessions being wiped by transient server errors/Render cold starts, see §12; group challenge creation now reuses the same unlimited-habits wizard as personal/default challenges, see §13; added an explicit "Keep me signed in" checkbox on login/register controlling localStorage vs sessionStorage token persistence, see §14; login now shows a "waking up server" spinner during Render cold starts, plus a `/api/health` endpoint for an external keep-alive pinger, see §15).

---

## 1. Stack & Architecture

- **Type**: MERN (MongoDB, Express, React, Node), single deployable service.
- **Server**: Express (`server/index.js`), port `3000` by default (`process.env.PORT`).
- **Client**: React 18 + Vite 5 (`client/`), dev server on port `5173`, proxies `/api/*` to `http://localhost:3000` (see `client/vite.config.js`).
- **Database**: MongoDB via Mongoose. Connection string from `MONGODB_URI`, defaults to `mongodb://localhost:27017/habit-tracker` if unset. Locally this now points at the **real production database** via a gitignored `.env` file loaded by the `dotenv` package (see §9) — no local fixture data is used anymore.
- **Auth**: JWT (`jsonwebtoken`), 30-day expiry, stored client-side in `localStorage` under key `challengeToken`. Secret from `JWT_SECRET` env var (falls back to a hardcoded dev string — **must** be set in production).
- **Production serving**: Express serves the built client (`client/dist`) as static files and falls back to `index.html` for any non-`/api` route (SPA routing). Build command: `npm run build` → `cd client && npm install && npm run build`.
- **Deploy target**: Render (`render.yaml`), free web service plan, env vars `MONGODB_URI`, `ADMIN_PASSWORD`, `JWT_SECRET` must be set there.

### Local dev quirk (fixed)
Running both processes via `concurrently` under the Claude Code preview tool caused `PORT` to be injected as `5173` for **both** the Vite process and the Express process (since the tool sets `PORT` to match the configured dev-server port). Express would then bind to 5173 instead of 3000, breaking Vite's `/api` proxy (nothing listening on 3000). Fixed by pinning the server's dev script in [package.json](package.json:9):
```json
"dev:server": "node -e \"process.env.PORT=3000;require('./server/index.js')\""
```
Production is unaffected — `render.yaml` calls `node server/index.js` directly, and Render sets `PORT` itself with nothing else competing for it.

---

## 2. Data Models (`server/models/`)

| Model | Fields | Notes |
|---|---|---|
| **User** | `username` (unique), `email` (unique, lowercased), `password` (bcrypt-hashed, 10 rounds), `role` (`user`\|`admin`, default `user`), `profilePicture` (string — often a base64 data URL, see §6) | `comparePassword()` method; `toJSON()` strips password |
| **Challenge** | `id` (UUID string, app-level id — **not** `_id`), `type` (`default`\|`user`\|`group`), `owner` (User ref, null for defaults), `name`, `days`, `startDate` (string `YYYY-MM-DD`), `habits[]` (`{id, name, maxPoints, color}`), `nextHabitId` | One collection holds all three challenge kinds, distinguished by `type` |
| **ActiveChallenge** | `user` (unique), `challengeId`, `source` (`default`\|`user`\|`group`) | One row per user — tracks which single challenge you're *tracking today* (drives the Today-page checklist + `/progress`) |
| **Follow** | `user` (unique), `challengeId`, `source` (`default`\|`user`\|`group`) | Added 2026-07-12 (§7f) — tracks which single challenge you *follow* (drives Discover's badge + who appears on that challenge's leaderboard). The Today-page dropdown auto-follows whatever it makes active (see §7f), so in practice this usually mirrors `ActiveChallenge` — but Discover's Follow button can independently point it at a different challenge without touching what's active |
| **Progress** | `user`, `challengeId`, `entries` (Mixed: `{habitId: {dateStr: 0\|1}}`) | Unique index on `(user, challengeId)` — **progress is stored per (user, challenge) pair**, so switching active challenges switches which progress blob loads |
| **Group** | `name`, `createdBy` (User ref), `members[]` (User refs), `challengeId` (nullable, points at a `type:'group'` Challenge) | |
| **GroupMessage** | `group`, `sender`, `text` | Simple flat chat log per group, no pagination |

**Important scoping rule**: `GET /api/progress` only ever returns progress for the user's *currently active* challenge (looked up via `ActiveChallenge`). There is no endpoint to fetch progress for an arbitrary challenge the user isn't currently on. This matters for any feature that wants to know completion status of *every* challenge in a list (see §8, open item).

---

## 3. API Routes (`server/routes/`)

All routes are prefixed `/api`. 🔒 = requires `Authorization: Bearer <jwt>` (`authMiddleware`). 👑 = also requires `role: admin` (`adminMiddleware`).

### `auth.js`
| Method & path | Auth | Purpose |
|---|---|---|
| POST `/auth/register` | — | username≥3, valid email, password must pass `validatePassword` (8+ chars, upper, lower, number, special) |
| POST `/auth/login` | — | returns `{token, user}` |
| GET `/auth/me` | 🔒 | current user |
| PUT `/auth/profile` | 🔒 | update username/email/profilePicture |
| PUT `/auth/password` | 🔒 | change password, requires current password |
| GET `/auth/search?q=` | 🔒 | exact-match username lookup (used by group "add member") |

### `challenges.js`
| Method & path | Auth | Purpose |
|---|---|---|
| GET `/challenges/default` | — | all `type:'default'` challenges (public) |
| POST `/challenges/default` | 🔒👑 | **replaces** the entire default-challenges set |
| GET `/challenges/user` | 🔒 | caller's own `type:'user'` challenges |
| POST `/challenges/user` | 🔒 | **replaces** the entire set of the caller's own challenges |
| GET `/challenges/active` | 🔒 | caller's `ActiveChallenge` pointer (what's tracked on the Today page) |
| POST `/challenges/active` | 🔒 | set active challenge (upsert). Client also calls `POST /challenges/follow` right after — see §7f |
| GET `/challenges/follow` | 🔒 | added 2026-07-12 — caller's `Follow` pointer (what shows as "Following" in Discover and who counts as a follower on that challenge's leaderboard) |
| POST `/challenges/follow` | 🔒 | added 2026-07-12 — set followed challenge (upsert). Called automatically by the Today-page dropdown on every selection, and independently by Discover's Follow button |
| GET `/challenges/community` | 🔒 | defaults + user challenges for the Discover panel, **excluding ended ones** (added 2026-07-12) — **admins see every user's**, regular users see **only their own** (fixed 2026-07-12, see §7) |
| GET `/challenges/all` | 🔒 | defaults + user challenges + challenges of groups the caller belongs to — **admins see every user's personal challenges**, regular users see **only their own** (fixed 2026-07-12, see §7); this is what populates the Today-page dropdown |
| GET `/challenges/history` | 🔒 | added 2026-07-12 — ended challenges with performance stats. Regular users get only their own tracked ones; **admins get every challenge that has ended, system-wide**, including ones nobody ever tracked (`tracked: false`) — see §7c/§7d |

Note the **replace-not-merge** semantics on `POST /challenges/default` and `POST /challenges/user`: the client always sends the full array back, and the server deletes-then-reinserts. Any client that doesn't hold the complete up-to-date array before saving will silently drop challenges.

### `progress.js`
| Method & path | Auth | Purpose |
|---|---|---|
| GET `/progress` | 🔒 | entries for the *active* challenge only |
| POST `/progress` | 🔒 | overwrite entries for the active challenge |

### `leaderboard.js`
| Method & path | Auth | Purpose |
|---|---|---|
| GET `/leaderboard/:challengeId?source=` | 🔒 (added 2026-07-12, see §8 item 7) | Entries = users who **explicitly follow this challenge** via `Follow` (changed 2026-07-12, see §7f). Computes `percentage = earned / (daysTracked × maxPointsSum)` per follower, sorted descending |

### `groups.js`
| Method & path | Auth | Purpose |
|---|---|---|
| POST `/groups` | 🔒 | create group, caller becomes member + creator |
| GET `/groups` | 🔒 | groups the caller belongs to |
| GET `/groups/:id` | 🔒 | detail (member or admin only) |
| POST `/groups/:id/members` | 🔒 (creator/admin) | add members by id |
| DELETE `/groups/:id/members/:userId` | 🔒 (creator/admin) | remove member |
| POST `/groups/:id/challenge` | 🔒 (creator/admin) | create/replace the group's single challenge |
| GET `/groups/:id/challenge` | 🔒 (member/admin) | fetch group challenge (full Challenge doc) |
| POST `/groups/:id/messages` | 🔒 (member) | send chat message |
| GET `/groups/:id/messages` | 🔒 (member) | full message history, no pagination |
| DELETE `/groups/:id` | 🔒 (creator/admin) | deletes group + its challenge + all messages |
| GET `/groups/discover/all` | 🔒 | groups the caller is **not** in |
| POST `/groups/:id/join` | 🔒 | self-join, anyone |
| POST `/groups/:id/leave` | 🔒 | self-leave |

---

## 4. Auth & Roles

- Single hardcoded admin bootstrap: on every server start, `start()` in `server/index.js` looks for username `naitikmishra`. If found, forces `role: 'admin'`; if not found, creates it with a **freshly random password printed to the console** (or `ADMIN_PASSWORD` env var if set).
- ✅ **Fixed** (see §8 item 1): the password-print-on-restart gotcha we hit while first logging in is resolved — restarting with an existing admin account now logs "password unchanged" instead of printing a fake new one, and `ADMIN_PASSWORD` (if set) is now applied to an existing account too, not just on first creation.
- No other role-granting path exists — every other registered user is `role: 'user'` permanently (no promote/demote endpoint).
- Admin privileges observed: manage default challenges (create/edit/delete, visible to everyone), manage *any* group (add/remove members, edit/delete challenge, delete group) even without being a member, see *all* groups in `/challenges/all` (not just joined ones).
- Regular users: can create their own personal challenges and groups, join/leave groups freely (open self-join — no invite/approval step), manage only groups they created.

---

## 5. Frontend Structure (`client/src/`)

```
App.jsx                     — provider nesting + tab switch (today/dashboard/charts/groups/settings)
contexts/
  AuthContext.jsx            — user, login/register/logout, checkAuth on mount
  DataContext.jsx            — defaultsData, userChallengesData, allChallengesData, progressData; loadAll/refreshData
  ThemeContext.jsx           — 7 color themes (themes.js), applied as CSS custom properties, persisted to localStorage
components/
  Auth/AuthOverlay.jsx        — login/register form, full-screen when logged out
  Layout/Header.jsx           — title + theme picker button
  Layout/BottomNav.jsx        — 5-tab bottom nav
  Layout/Toast.jsx            — global toast context, 2s auto-hide
  Today/TodayPage.jsx         — main screen: challenge selector, date nav, score ring, checklist
  Today/ChallengeSelector.jsx — the <select> dropdown driving "active challenge"; filters out expired challenges and auto-switches away from one that just expired (see §7b)
  Today/DateNav.jsx           — prev/next day arrows, "Day N" badge
  Today/ScoreCard.jsx         — SVG progress ring for the current day
  Today/CheckList.jsx         — habit checkboxes for the current day
  Today/DiscoverPanel.jsx     — browse/follow default+user challenges
  Today/LeaderboardPanel.jsx  — per-challenge leaderboard modal
  Dashboard/DashboardPage.jsx — "Stats" tab: overall/challenge progress, best/worst habit, per-habit breakdown
  Charts/ChartsPage.jsx       — Chart.js bar chart (daily/weekly/monthly) + month calendar heatmap
  Groups/GroupsPage.jsx       — group list, create/join/discover, group detail (chat + challenge + members)
  Settings/SettingsPage.jsx   — default-challenge admin panel, personal-challenge management, theme picker, sign out
  Settings/ChallengeWizard.jsx— create/edit form for default or personal challenges
  Settings/ProfilePage.jsx    — username/email/avatar edit, password change
utils/
  api.js                      — all fetch wrappers, 5s timeout via AbortController, JWT attached from localStorage
  helpers.js                  — date math, challenge merging (getChallenges/getActiveChallenge/getActiveHabits), password validation, getChallengeEnd
```

### Data flow for "active challenge"
`DataContext` loads four things in parallel on auth: `defaultsData`, `userChallengesData`, `allChallengesData` (from `/challenges/all`), and `progressData` (for whatever is currently active). `getActiveChallenge()` (helpers.js) picks the active one by checking `allChallengesData.activeChallengeId/activeSource` first, then falls back through defaults → user → **first item in the merged list** if nothing is explicitly set. This fallback is why a brand-new user immediately sees a default challenge as "active" without ever picking one.

Switching challenges (`ChallengeSelector.handleChange`) does an optimistic local update to all three data buckets, then persists via `POST /challenges/active`, then the caller (`TodayPage.handleChallengeChange`) resets `currentDate` to today and reloads `progressData` from the server (since progress is scoped to the active challenge only).

---

## 6. Feature Walkthrough (as verified live)

- **Today tab**: shows the active challenge's habits for the selected date. Only *today* can be checked/unchecked (`TodayPage.handleToggle` blocks other dates with a toast; `CheckList` is also rendered `readonly` for non-today dates). Confirmed live: toggling a habit updates the score ring (0%→25%), persists via `POST /progress`, and immediately reflects in Stats/Charts.
- **Stats tab (Dashboard)**: pure client-side computation from `progressData` + `activeChallenge`, walks every day from `startDate` to today. No server aggregation involved.
- **Charts tab**: Chart.js bar chart with daily/weekly/monthly grouping, plus a calendar heatmap (color interpolates green based on day completion %). Falls back to the first available challenge if none is "active" yet.
- **Groups tab**: Confirmed live — create group (creator auto-joins), self-join via Discover Groups, group detail shows chat + optional single group challenge + member list. Permissions verified correctly gated: a plain member sees no Add/Edit/Delete controls, only Leave; creator/admin see all of them.
- **Settings tab**: Admin sees an extra "Default Challenges" section (visible to all users, editable only by admin) above the "My Challenges" section every user gets. `ChallengeWizard` is a shared create/edit form parameterized by `source` (`'default'` or `'user'`).
- **Leaderboard**: per-challenge, aggregates every user who is either following the challenge or has any progress row for it; percentage = earned points / (days tracked × total possible per day). Verified live with one admin entry.
- **Themes**: 7 presets (sunset/midnight/forest/ocean/rose/lavender/amber), applied instantly via CSS custom properties, no server round-trip.

---

## 7. Visibility Restrictions, Expiry Filtering & Completed-Challenge History (shipped 2026-07-12)

Three related changes landed together, all verified live against the real database using a throwaway `zzqaverify99` test account (registered, exercised, then fully deleted — see §9).

### 7a. Ownership-based visibility (bug fix)
`GET /challenges/all` and `GET /challenges/community` both used to query `Challenge.find({ type: 'user' })` with **no owner filter**, meaning every regular user could see and select *every other user's* personal challenges — in both the Today-page dropdown and the Discover panel. Fixed in [challenges.js](server/routes/challenges.js): both routes now use `{ type: 'user', owner: userId }` for non-admins, and keep the unrestricted query for admins. Confirmed live: as `zzqaverify99`, the dropdown and Discover panel showed only default challenges (no `bits`/`archi jain`/`anshul` entries); as admin, everyone's personal challenges still show as before.

Group-challenge visibility is untouched — that's still governed by group membership, not this ownership rule.

### 7b. Expiry filtering on the Today-page dropdown
[ChallengeSelector.jsx](client/src/components/Today/ChallengeSelector.jsx) now filters out any challenge whose last day has passed, using `getChallengeEnd(c)` from [helpers.js](client/src/utils/helpers.js:27) compared against **today normalized to local midnight** (`today <= end`, so a challenge stays selectable through its entire final day and disappears starting the day after). Confirmed live against a real expired default challenge ("7 Day Habit Challenge", ended `2026-07-09`, today `2026-07-12`) — correctly absent from the dropdown while still listed (and editable) in Settings, which was deliberately left unfiltered since users still need to manage/delete old challenges there.

**Auto-switch on expiry**: if the challenge that's currently active (server-side `ActiveChallenge` pointer) has expired, a `useEffect` in `ChallengeSelector` detects the mismatch against the filtered list and automatically switches to the first available valid challenge, persisting via the normal `saveActiveChallenge` call. Confirmed live: force-set a test user's active challenge to an already-expired one directly via the API, reloaded, and watched it auto-correct to the only valid default — verified against the real `ActiveChallenge` record server-side, not just the UI.

**Known gap this surfaced**: Settings' "Delete" button for a personal challenge only operates on whatever is currently the globally *active* challenge (`SettingsPage.handleDeleteUser` checks `activeChallenge._source === 'user'`) — this was already slightly awkward pre-existing behavior, but now that an expired challenge can never be made active again via the dropdown, **there is no UI path left to delete an expired personal challenge**. Not fixed yet — flagging for a follow-up (likely fix: make each challenge card in Settings carry its own delete action instead of relying on global active state).

### 7c. Completed-challenge history ("personal space")
New `GET /api/challenges/history` (🔒) in [challenges.js](server/routes/challenges.js): for the caller, finds every `Progress` row they have, keeps only the ones whose challenge has ended, and computes `{name, source, days, startDate, endDate, habitsCount, daysTracked, totalEarned, totalPossible, percentage}` per challenge. `totalPossible` deliberately uses the **full challenge duration** (`days × habitPointsSum`), not just days-tracked like `leaderboard.js` does — this endpoint is answering "how much of the whole challenge did you complete," which needs the full-duration denominator to be meaningful; `daysTracked` doesn't change what days you *could* have played.

Rendered in [ProfilePage.jsx](client/src/components/Settings/ProfilePage.jsx) as a new "Completed Challenges" section — count + average performance, then a card per challenge with date range, points, days tracked, and a color-coded percentage badge (green ≥66%, amber ≥33%, red below). This is "personal space" in the sense the user meant it — the same page as their username/email/password, not a new tab.

**Bug caught during verification**: the initial implementation formatted `endDate` with `end.toISOString().slice(0,10)`, which converts to UTC — since this server runs in `Asia/Calcutta` (UTC+5:30), a local end-of-day date rolled back by one day in the response (`2026-07-07` start+3days showed as `2026-07-06`). Fixed by adding a local-date `dateStr()` helper (same pattern the client already uses) instead of relying on UTC conversion. The underlying `today <= end` comparison logic was never affected — it compares `Date` objects directly, not strings — only the *display* string was wrong.

**Verification method**: created a real personal challenge via the UI with a past start date, then used the test account's own JWT (via `fetch` in the browser console) to call `POST /challenges/active` and `POST /progress` directly — bypassing only the just-added client-side dropdown filter, which correctly refuses to let you select an already-expired challenge through the UI. This exercises the exact same server endpoints a real client would have called *before* the challenge expired. Confirmed the `/history` response, then confirmed it rendered correctly in the actual Profile page after a hard reload. All test data (Challenge, Progress, ActiveChallenge, the throwaway User itself) was deleted afterward — see §9.

### 7d. Admin sees every ended challenge, system-wide — tracked or not (final form, iterated twice on 2026-07-12)
Follow-up ask #1: admin's "Completed Challenges" view in Profile should show **every user's** completed challenges, not just the admin's own — the "super admin" already sees every user's *active* challenges (§7a), so their completion history should be symmetric. First implementation: `Progress.find(isAdmin ? {} : { user: userId })`, i.e. still driven by *who has progress*, just unscoped from `user: userId` for admins.

This surfaced a real gap immediately: asked "where is the Kamini2003 user challenge" after her "My 7-Day Challenge" (ended `2026-07-10`) disappeared from the dropdown (correctly, per §7b) but *also* never showed up in the admin history view — because she never logged any progress on it, so no `Progress` doc ever existed for it to be found by. Follow-up ask #2: show admin **every** ended challenge regardless of whether anyone tracked it, not only the ones with a completion record.

Final implementation in `GET /challenges/history` ([challenges.js](server/routes/challenges.js)): the admin branch now starts from `Challenge.find({})` (every default/user/group challenge), filters to ones whose end date has passed, and *then* looks up `Progress.find({ challengeId })` per challenge:
- Zero progress docs → one result row, `tracked: false`, `username: null`, 0/0 stats.
- One or more progress docs → one result row **per user** who has any, `tracked: true`, with that user's stats (a default/group challenge with several followers who all tracked it now legitimately produces multiple rows for the same `challengeId`, one per follower — hence the list key is `challengeId + username`).

Regular users' branch is untouched: still their own `Progress` rows only, always `tracked: true` (a user only ever sees challenges they engaged with — there's nothing to show them for one they didn't).

`ProfilePage.jsx`: admin heading is "Ended Challenges (All Users)" (not "Completed" — it's now an inventory of *endings*, not just successes). The summary line separates the two: `"{total} ended challenges across all users · avg {pct}% on the {N} completed · {M} never attempted"`. Untracked cards show "· not attempted by anyone" in place of "· by {username}", omit the pts/days-tracked line (nothing to report), and get a neutral gray `—` badge instead of a colored percentage — deliberately not showing "0%" in red, since "nobody tried" and "tried and scored zero" are different things worth distinguishing at a glance.

**Verified against real, non-test data both times**: first pass confirmed via `anshul`'s completed "7 Day Habit Challenge" (`70/350 pts`, 20%, red badge). Second pass confirmed `Kamini2003`'s "My 7-Day Challenge" (`2026-07-04 → 2026-07-10`) now appears with `tracked: false` and the gray `—` badge, sitting alongside anshul's tracked entry in the same list — screenshot-verified in the running app, not just the API response.

### 7e. Creator attribution (extended further, same day)
Follow-up ask #3: also show who *created* each ended challenge, not just who (if anyone) completed it — distinct pieces of info, since for defaults and group challenges the creator and the tracker are usually different people.

Added a `getCreatorName(challenge)` helper next to the existing `getUsername` cache in the same `/history` route: `type === 'default'` → `'Admin'` (only admins can create default challenges, per `adminMiddleware` on `POST /challenges/default`); otherwise resolves `challenge.owner` to a username (covers both `'user'` and `'group'` — group challenges are owned by whichever creator/admin set them up, see `groups.js`). Included as `creatorName` on every result row, both admin and regular-user branches.

`ProfilePage.jsx` cards now read `{startDate} → {endDate} · created by {creatorName}` before the pts/days-tracked segment. Verified live: Kamini2003's untracked challenge shows "created by Kamini2003" (she made it for herself, never ran it), and the default "7 Day Habit Challenge" shows "created by Admin" while still crediting "by anshul" for who actually completed it — the two labels correctly stay independent.

### 7f. Discover shows only active challenges; Follow model with dropdown auto-follow (2026-07-12, iterated three times)
This went through three shapes before landing. Worth recording the history since the final design is a synthesis, not the first draft.

**Attempt 1** — full decoupling. Introduced a `Follow` model separate from `ActiveChallenge`, changed so *only* Discover's explicit Follow button could set it; switching the Today-page dropdown never touched it. Verified live, then explicitly reverted ("remove the last latest changes") — turned out to be more decoupling than wanted.

**Attempt 2** — full revert. Deleted `Follow.js`, reverted `/community` and `leaderboard.js` back to pure `ActiveChallenge`-based following, undoing the Discover expiry filter too. Then corrected: the user only wanted the Discover expiry filter and the `Follow`-based leaderboard-restriction kept — they explicitly wanted the *auto-follow-via-dropdown* behavior preserved, not removed.

**Final shape** — both things true at once:
- **Discover filtering**: `GET /challenges/community` filters `defaults`/`userChallenges` through `today <= getChallengeEndDate(c)` before responding. Ended challenges belong in "Ended Challenges" (§7d), not Discover.
- **`Follow` model exists** (§2), separate collection from `ActiveChallenge`, so leaderboards (`leaderboard.js`) can be computed from explicit followers only, and Discover's badge (`/community`'s `following` flag) reads from `Follow`, not `ActiveChallenge`.
- **But the Today-page dropdown auto-follows.** `ChallengeSelector.jsx`'s `selectChallenge()` now calls `saveActiveChallenge(id, source)` **and then** `saveFollowedChallenge(id, source)` on every dropdown change — so picking a challenge to track today also makes it your followed challenge, exactly like the old single-field behavior. Discover's own Follow button still calls `saveFollowedChallenge` independently, so you *can* follow a different challenge than the one you're actively tracking, but by default they move together unless you deliberately override it in Discover.

Net effect: the two are structurally separate (`Follow` vs `ActiveChallenge`, two collections, two endpoints), but behaviorally coupled by default via the auto-follow call — closing the gap between "clean architecture" and "the app should feel exactly like it did before, just with better leaderboard semantics underneath."

Discover's "You're following: {name}" card (with a direct "View Leaderboard" button) is still in `DiscoverPanel.jsx`, sourced from whichever challenge has `following: true` in the `/community` response.

**Since re-verified live** (2026-07-13, see §7g) — the restoration itself is confirmed working correctly.

### 7g. Expired-challenge auto-switch centralized in DataContext, not just the Today page (2026-07-13)
Follow-up ask: make sure an ended/completed challenge is genuinely invisible everywhere except "Ended Challenges" — not just absent from the Today-page dropdown.

**Real gap found**: the "switch away from an expired active challenge" logic lived only inside `ChallengeSelector.jsx` (a component that only mounts on the Today page). `DataContext`'s `activeChallenge` — consumed by Stats, Charts, the Leaderboard trigger, and Today itself — never filtered by expiry on its own. So if a user's server-side `ActiveChallenge` pointer referenced an ended challenge and they opened Stats or Charts *without visiting Today first*, `ChallengeSelector` would never mount, its auto-switch effect would never run, and the expired challenge's data would display as if still active.

Fixed by moving the auto-switch out of `ChallengeSelector.jsx` and into `DataContext.jsx` itself, right after the `activeChallenge` derivation: a `useEffect` checks `getChallengeEnd(activeChallenge)` against today (once `loaded`); if it's ended, it finds the first non-expired challenge in the merged list and calls `saveActiveChallenge` **and** `saveFollowedChallenge` (matching the dropdown's own auto-follow-on-select behavior, §7f) before calling `refreshData()`. `ChallengeSelector.jsx` no longer has its own copy of this logic — it just renders whatever `DataContext` has already settled on.

This matters beyond cosmetics: `GET /api/progress` reads the server-side `ActiveChallenge` pointer directly, not whatever the client happens to be displaying. A client-only filter (skip rendering the expired one, but leave the server pointer stale) would have shown the *newly selected* challenge's name and habit list correctly, while its checkboxes silently reflected the *old expired* challenge's progress entries underneath — a real correctness bug, not just a display nit. Centralizing the fix in `DataContext` and having it call `refreshData()` avoids that: progress is reloaded fresh against the corrected challenge every time.

**Scope decision — what still legitimately shows an ended challenge**: Settings' "Default Challenges" / "My Challenges" management lists, and a group's challenge card in `GroupsPage.jsx`, still display ended challenges regardless of expiry, and this is intentional, not a gap. Those are CRUD/management surfaces (edit, delete) — hiding an ended challenge there would make it permanently un-deletable, which is worse than leaving it visible for management purposes. "Nowhere to be seen except Ended Challenges" is being read as applying to *tracking/selection* surfaces (dropdown, Stats, Charts, Discover, Leaderboard), not admin/owner management views.

**Verified live**: forced the server-side `ActiveChallenge` to an already-ended default challenge via direct API call, then did a hard reload. Before I could even inspect the intermediate state, the dropdown had already re-settled on a valid challenge — confirmed via direct `fetch()` (not just DOM) that both `ActiveChallenge` and `Follow` server-side had been corrected. Then checked Stats directly (not just Today) and confirmed the habit breakdown matched the corrected challenge exactly, with no stale/mismatched progress. Confirmed the forced-expired challenge still appeared correctly in `/challenges/history` (Ended Challenges) throughout.

---

## 8. Known Bugs / Inconsistencies Found During Testing

All items below except #6 were fixed and re-verified live in-browser on 2026-07-12 (see §8a for how each was verified).

1. ✅ **FIXED — Admin password bootstrap misled on restart.** `naitikmishra`'s password used to only be set on first creation; every later restart printed a *new* random password that was never actually applied if the account already existed. Fixed in `server/index.js` and `server/seed.js`: the "new random password" branch now only runs when actually creating the account; if the account exists and `ADMIN_PASSWORD` is set, that value is now applied to it (previously ignored for existing accounts); if it exists and no `ADMIN_PASSWORD` is set, the log now honestly says "password unchanged" instead of printing a fake one.
2. ✅ **FIXED — `createdBy` not populated on group create/join/leave.** [groups.js](server/routes/groups.js) — `POST /groups`, `POST /groups/:id/members`, `DELETE /groups/:id/members/:userId`, `POST /groups/:id/join`, `POST /groups/:id/leave` now all `.populate('createdBy', 'username')` in addition to `members`, matching what `GET /groups` already did. "Created by Unknown" no longer appears after create/join.
3. ✅ **FIXED — Group challenge response shape mismatch, plus a deeper bug found while fixing it.** `POST /groups/:id/challenge` used to return `{challengeId, name, habitsCount}` (no `days`), while `GET /groups/:id/challenge` returned the full Challenge doc (`habits[]`, `days`, no `habitsCount`) — one field was always blank in the UI depending on which endpoint last populated state. Fixed by having the POST response spread the full `challengeData` object (same shape as the DB doc) plus a `habitsCount` convenience field, and by making the client read `groupChallenge.habitsCount ?? groupChallenge.habits?.length ?? 0` so it tolerates either shape.
   - **Deeper bug found during the fix**: on *edit*, the route always minted a brand-new random `challengeId` and wrote it onto the existing Challenge doc via `updateOne({id: group.challengeId}, challengeData)` — but `group.challengeId` (the pointer) was never updated to match. After any edit, the group's stored pointer became stale and `GET /groups/:id/challenge` would silently stop finding the challenge. Fixed by reusing `group.challengeId` as the id on edit (`const challengeId = group.challengeId || crypto.randomUUID()`), only minting a new one on first creation.
   - **Second-order bug this caused, also fixed**: because the POST response didn't include a `habits` array, editing a challenge a *second* time in the same session (without a reload in between) would show blank habit-name fields in the edit form (`defaultValue={groupChallenge?.habits?.[i-1]?.name || ''}`) and silently wipe the habit names on save if submitted. Fixed as a side effect of the full-shape POST response above — confirmed live: edited a challenge, immediately reopened the edit form with no reload, habit names were correctly pre-filled.
4. ✅ **FIXED — Joining/leaving a group (or creating a group challenge, or deleting a group) didn't refresh the Today-page dropdown in-session.** `GroupsPage`'s `handleJoin`, `handleLeave`, `handleCreateChallenge`, and `handleDeleteGroup` now all call `DataContext.refreshData()` after a successful server response, so the affected challenge appears/disappears from `ChallengeSelector` immediately instead of requiring a full page reload.
5. ✅ **FIXED — Active-tab state didn't reset on login/logout.** Added a `useEffect` in `App.jsx` that resets `activeTab` to `'today'` whenever `isAuthenticated` becomes `false`, so the next login always starts on the Today tab regardless of which tab was open before signing out.
6. **NOT FIXED — Profile pictures are stored as base64 data URLs directly on the User doc**, with no size limit beyond the global `express.json({ limit: '5mb' })` — a big-enough image upload will bloat the Mongo document and the `/auth/me` payload on every page load. No compression/resizing anywhere in `ProfilePage.jsx`. Left as-is: fixing this properly means adding image resizing/compression or moving to object storage, which is a larger feature than a bug fix — flagging for a future decision rather than doing it opportunistically.
7. ✅ **FIXED — `GET /leaderboard/:challengeId` had no `authMiddleware`** despite every other data route requiring a JWT — anyone who guessed/enumerated a challenge id could see usernames, avatars, and point totals for its followers without logging in. Added `authMiddleware` to the route in `server/routes/leaderboard.js`; also had to fix the client (`LeaderboardPanel.jsx`) which was calling it with no `Authorization` header at all — now sends `authHeaders()`. Verified live: unauthenticated `fetch('/api/leaderboard/...')` now returns `401`; logged-in leaderboard view still works.

### 8a. Verification method
Every fix above was verified by restarting the local dev server and re-driving the actual UI (not just reading the diff): re-created a group and confirmed "Created by X" appeared instantly, created and then edited a group challenge twice in the same session to confirm habit names survived, joined a group and confirmed its challenge appeared in the dropdown without a reload, registered/logged out/logged back in to confirm the tab reset, and hit the leaderboard endpoint both authenticated and raw via `fetch()` to confirm the 401. Test group/challenge created purely for this verification ("Bug Fix Test Group") was deleted afterward; "Fitness Squad" from the original walkthrough was left in place.

---

## 9. Environment / Running Locally

- `.claude/launch.json` configures `npm run dev` (root) as the dev-server preset, which runs `concurrently` for both `dev:server` (Express, forced to port 3000, see §1) and `dev:client` (Vite, port 5173).
- **`.env` now exists in the repo root** (gitignored, correctly not tracked) with `MONGODB_URI`, `ADMIN_PASSWORD`, `JWT_SECRET` set to real values. The app did **not** originally load `.env` files — added the `dotenv` package (`server/index.js`/`server/seed.js` now start with `require('dotenv').config()`, placed before every other `require` since `JWT_SECRET` is read at module-load time in `middleware/auth.js` and `routes/auth.js`, not lazily). Production (Render) is unaffected — it sets these as real environment variables directly, no `.env` file involved there.
- **The local dev server now connects to the real production MongoDB database**, not the throwaway local `mongod` instance used earlier in this doc's history. Confirmed live: on connecting, the server ran its one-time legacy "DataStore" migration (meaning this database predates the current Challenge-collection schema and had never been migrated before), and logging in as admin surfaced real user challenges (`bits`, `Kamini2003`, `archi jain`, `anshul`, etc.) — this is genuinely live data, not a fixture.
- ⚠️ **Implication for future testing in this repo**: the throwaway `testuser1` account, "Fitness Squad" group, and "Squad Challenge" created earlier in this session live in the *old local* MongoDB instance and do **not** exist in the real database now connected. Do not casually create test groups/challenges/accounts against this database the way we did against the local one earlier — it has real users now. If more bug-fix verification is needed, prefer creating a throwaway account and cleaning it up immediately, the same discipline used in §8a.
- The admin password is whatever is set in the local `.env`'s `ADMIN_PASSWORD` — not printed here since `.env` is a secret file the user controls directly.
- **Creating any account or data in the real database now requires explicit user permission** — the harness's auto-mode classifier blocked an unattended attempt to register a test account, correctly enforcing the caution above. The user approved a one-off throwaway account (`zzqaverify99`) for §7's verification; it and everything it touched (its Challenge, Progress, and ActiveChallenge rows, and the User doc itself) were deleted immediately after via a one-off script (`server/_cleanup_qa_test.js`, not committed — created and removed in the same session). Don't assume this permission carries forward to future sessions; ask again.

---

## 10. Progressive Web App conversion (2026-07-15)

The client is now an installable PWA — added `vite-plugin-pwa` (Workbox under the hood) rather than hand-rolling a manifest + service worker.

### 10a. What changed
- **`client/vite.config.js`**: added the `VitePWA` plugin. `registerType: 'prompt'` (update requires user confirmation, not silent auto-activation — see §10c). `manifest` block defines name/short_name ("Habit Tracker"), `display: 'standalone'`, `orientation: 'portrait'`, `theme_color`/`background_color` matching the Sunset theme's accent (`#ff8c42`) and dark bg (`#0d0b0a`), and three icons (192, 512, maskable-512). Also added a `preview.proxy` entry mirroring `server.proxy` so `vite preview` can reach the API too (previously only the dev server had this).
- **Icons**: the old favicon was raw emoji text (`<text>🏆</text>` in an SVG) — fine as a browser-tab favicon, unusable as a home-screen icon (no background, tiny glyph, and emoji-in-SVG risks rendering as a blank box depending on the rasterizer's font availability). Designed a proper icon instead: a white checkmark-in-circle on the theme's orange gradient (`client/icon-source.svg`, kept in the client root — not `public/` — since it's a design source, not a served asset). Rasterized to `client/public/icon-192.png`, `icon-512.png`, `apple-touch-icon.png` (180×180), and `icon-maskable-512.png` (same art at ~70% scale on a solid-color canvas, since Android crops maskable icons to arbitrary shapes and needs safe-area padding) using `sharp`, installed with `--no-save` and uninstalled again immediately after — it's a one-time rasterization tool, not a runtime or build dependency, so it doesn't belong in `package.json`.
- **`client/index.html`**: added `theme-color`, `apple-touch-icon`, `apple-mobile-web-app-capable`, `apple-mobile-web-app-status-bar-style`, `apple-mobile-web-app-title`, and `mobile-web-app-capable` meta tags (iOS Safari ignores the manifest for most of this and needs its own tags). Added `viewport-fit=cover` to the existing viewport meta for notch/safe-area support. `vite-plugin-pwa` auto-injects the `<link rel="manifest">` and service-worker registration at build time — confirmed in the built output, not assumed.
- **`client/src/components/Layout/UpdatePrompt.jsx`** (new) + **`.update-prompt` styles in `App.css`**: uses vite-plugin-pwa's `useRegisterSW()` hook (`virtual:pwa-register/react`) to show a small top banner ("A new version is available" + Reload button) when a new service worker is waiting, instead of silently swapping the app under the user's feet. Mounted once in `App.jsx`, above `AppContent`, so it's visible even on the login screen.

### 10b. Caching strategy — API is deliberately never cached
`workbox.globPatterns: ['**/*.{js,css,html,svg,png,ico}']` precaches only the built app shell (JS/CSS/HTML/icons/manifest) — **no runtime caching rules were added for `/api/*`**, so those requests fall through to Workbox's default (network-only, untouched by the service worker). This is a deliberate choice, not an oversight: habit progress, active-challenge state, and leaderboards must always reflect the live server — silently serving a stale cached API response would reintroduce exactly the kind of stale-data bug fixed in §7g. The tradeoff: the app **shell** (login screen, static assets) loads offline, but no page will show real data without a live connection. This is app-shell-only offline support, not full offline data sync — a reasonable scope for a shared multi-user tracker where "my progress" and "the leaderboard" are meaningless without the server anyway.

### 10c. Verified live (not just built)
Built with `npm run build` inside `client/`, then verified against the **real production-serving path** — ran `node server/index.js` from the repo root (exactly what `render.yaml`'s `startCommand` does) rather than `vite preview`, since that's what actually serves `client/dist` in production (see §1).
- Confirmed `manifest.webmanifest` is served, parses correctly, and lists all three icons with correct sizes/purpose.
- Confirmed the service worker registered and reached `active` state (`navigator.serviceWorker.getRegistrations()`).
- Confirmed all icon files and `sw.js` are served with correct MIME types.
- Confirmed the app shell is genuinely precached: inspected Cache Storage directly and found `index.html`, both bundle chunks, the manifest, and every icon.
- **The real offline test**: stopped the actual Node server process entirely (not a simulated "offline" toggle), then reloaded the page — the full login screen rendered from the service worker's cache despite `fetch('/api/...')` failing with a genuine connection error immediately after. This is real evidence the shell survives a dead backend, not a browser HTTP-cache fluke.
- Restarted the server and confirmed the full login flow still works end-to-end with the service worker active (no interference with normal API traffic) — 200 OK on `POST /api/auth/login`, dashboard loads correctly afterward.
- Confirmed no console errors at a 375×812 mobile viewport size.

### 10d. Known gaps / not done
- No custom "Add to Home Screen" install-prompt UI (capturing `beforeinstallprompt` and showing an in-app "Install" button) — browsers show their own native install affordance (e.g. Chrome's address-bar icon) based on the manifest + service worker being valid, which is sufficient for installability but not as discoverable as an explicit in-app prompt. Worth adding if install rates matter.
- No background sync / push notifications — out of scope for "make it a PWA," which was read as "installable + works offline for the shell," not "add native-app-only capabilities."
- Have not tested on an actual iOS or Android device — verified via desktop Chromium's mobile viewport emulation and direct API/cache inspection, which covers the mechanics (manifest validity, SW lifecycle, cache contents) but not real-device install/home-screen behavior.

---

## 11. Group ownership bug fix + rename to "Habit Tribe" (2026-07-15)

### 11a. Real bug found: group owners could never manage their own group
Reported as "I am not able to create challenge [in my group]." Root cause: **none of the auth endpoints ever returned the user's `_id`** — `POST /auth/register`, `POST /auth/login`, `GET /auth/me`, and `PUT /auth/profile` all built their `user` response object from scratch (`{ username, email, role, profilePicture }`), omitting `_id` entirely, in all four places.

`GroupsPage.jsx`'s `isCreator` check is `String(selectedGroup.createdBy?._id || selectedGroup.createdBy) === String(user._id)`. With `user._id` always `undefined`, this was **always false** for every user, in every session, since the app was built — the only reason group management ever worked at all was `isAdmin` (`user?.role === 'admin'`) short-circuiting the same `isCreator || isAdmin` checks. Any regular user who created a group could see it, chat in it, and had the "Leave" button — but never "Delete group," "+ Add" (member), remove-member, or "+ Create Group Challenge", regardless of being its actual creator. This affected real production users: confirmed live that the group "Challenge creation discussion" is owned by `anshul` (not an admin), who would have hit exactly this wall.

Fixed by adding `_id: user._id` to the response object in all four `server/routes/auth.js` endpoints. Verified live: logged in fresh, confirmed `_id` now present in the raw login response (previously absent), confirmed no regressions in the rest of the auth/groups flow.

**Not verified as `anshul` directly** — no credentials for that real account, and resetting a real user's password to test would be more invasive than the bug itself. Confidence comes from the root-cause fix being unambiguous (the exact field the frontend reads was never sent, now it is) plus a clean, passing re-test of the surrounding flow as admin.

### 11b. Related gap closed: group challenge details had no membership check
While auditing the same code path, found `GET /groups/:id/challenge` — unlike `GET /groups/:id`, which correctly checks `isMember || isAdmin` — had **no visibility restriction at all**, just `authMiddleware`. Any authenticated user who knew or guessed a group's Mongo `_id` could fetch its challenge's name, habits, and duration without being a member. Fixed by adding the same membership check `GET /groups/:id` already uses. This closes the loop on "only members of that group should see that challenge" — the Today-page dropdown (`/challenges/all`) and Discover (`/challenges/community`, which never includes `type:'group'` at all) were already correctly scoped; this endpoint was the one gap.

Clarified with the user that "the owner can create/edit the challenge only after the discussions" was descriptive of the expected workflow, not a literal feature to build (no chat-activity gate implemented) — it was really just restating the ownership + visibility model above, which the two fixes here now make actually work.

### 11c. Rename: Groups → Habit Tribe
User-facing copy only — internal identifiers (`GroupsPage`, `.groups-page`, `loadGroups()`, the `'groups'` tab key, the `Group`/`GroupMessage` Mongoose models, etc.) are untouched, since renaming those is pure internal churn with no user-visible benefit and only adds risk.

Changed in `GroupsPage.jsx`: page heading ("Habit Tribe"), "+ New Tribe" / "+ Create Tribe Challenge" buttons, "Tribe name" placeholder, empty-state copy ("No tribes yet" / "Create a tribe or join one below"), "Discover Tribes" section title, all toast messages (created/deleted/joined/left), the delete confirmation dialog, and the Leave/Delete button tooltips.

**Bottom-nav label is "Tribe", not "Habit Tribe"** — deliberately shorter than the page heading. Tried the full "Habit Tribe" first as literally requested; at both desktop and mobile (375px) width it wrapped to two lines inside the nav pill, and at mobile width specifically this pushed the "Settings" tab almost entirely off the right edge of the screen — confirmed via screenshot, not just the accessibility tree (which still reported it as present despite being visually unusable). Shortened to "Tribe" in the nav only, matching the single-word style of the other four tabs (Today/Stats/Charts/Settings); the full "Habit Tribe" branding is still used everywhere there's actually room for it (the page's own `<h2>` heading). Re-verified at 375px after the change — all five tabs fit on one line again.

---

## 12. Session persistence fix — stop wiping valid sessions on transient errors (2026-07-17)

Reported as two symptoms that turned out to share one root cause: "I have to log in again and again" (wanted a 'remember me for the whole day' option) and "server error during login at the start, maybe because Render is waking up."

### 12a. Root cause: `checkAuth()` cleared the token on *any* failed request, not just an invalid one
Old `client/src/utils/api.js`: `checkAuth()` called `GET /api/auth/me` with a **5-second timeout**, and treated *any* non-success result — network error, timeout, 500, or a genuine 401 — identically: `setToken(null)`. The JWT already carries a 30-day expiry (`server/routes/auth.js`), so the "log in again and again" complaint wasn't actually about session length; it was this code discarding a perfectly valid, long-lived token just because a single request to `/api/auth/me` didn't succeed in 5 seconds. Render's free tier spins the server down after ~15 minutes idle and can take 30-60s to wake back up on the next request — opening the PWA after any idle period reliably hit exactly this path, wiping the session and forcing a fresh login every time. The same undersized timeout applied to the login request itself, so a login attempt against a cold server surfaced a generic "Server error" instead of surviving the wake-up.

**No "remember me" checkbox was added.** One would only make sense if there were a shorter default session to opt out of; there isn't (already 30 days) — the actual bug was the token being discarded before its own expiry, which is what got fixed instead.

### 12b. Fix: split instant local restore from background server verification
`checkAuth()` is gone, replaced by two functions with a clear contract:
- **`getCachedUser()`** — decodes the JWT payload client-side (base64, no server round trip) and, if `exp` hasn't passed, immediately returns `{username, role}` for the UI to use. Clears the token only if it's missing, malformed, or expired **per its own claim** — never based on network state.
- **`refreshProfile()`** — the real `GET /api/auth/me` call, now given a 45s timeout (`COLD_START_TIMEOUT_MS`, matched to Render's realistic cold-start window). Returns the full profile (real email/avatar) on success; returns `null` **only on an explicit 401** (server actively rejected the token — genuinely logged out); returns `undefined` for anything else (timeout, 500, network failure) — signaling "couldn't check right now," which callers must *not* treat as a logout.

`AuthContext.jsx`'s mount effect now calls `getCachedUser()` first (sets `user` and clears `loading` immediately, no network wait), then calls `refreshProfile()` in the background and only acts on its result if it's `null` (sign out) or a real user object (enrich); an `undefined` result is a no-op, leaving the existing session untouched. `login`/`register` also moved to the 45s cold-start timeout, and their fallback error message (only shown when the request never got a response at all — a real server-side `{ok:false, error}` still passes that message straight through) now reads *"Couldn't reach the server — it may be waking up (can take up to a minute on first use). Please try again shortly."* instead of a bare "Server error".

### 12c. Verified live, both directions
Logged in normally, then killed just the Express backend process (port 3000) while leaving Vite running, confirmed `/api/auth/me` genuinely failed (proxy 500), reloaded the page, and the user **stayed logged in** — the app shell rendered normally (data-dependent bits correctly showed empty/unavailable, only auth state was being tested) and `localStorage`'s token was confirmed still present via direct inspection, not just visual impression. Separately confirmed the fix doesn't paper over real invalidity: crafted a token with a valid-looking, unexpired payload but a garbage signature, reloaded — `getCachedUser()` optimistically showed the app for a moment, then `refreshProfile()`'s 401 from the real server correctly signed the user back out and cleared the token, confirmed via the same direct `localStorage` check.

---

## 13. Group challenge creation reuses the personal-challenge wizard (2026-07-17)

Reported as: "make the same flow as we create challenge in profile, do not restrict the count to four only." `GroupsPage.jsx` had its own hand-rolled challenge form, entirely separate from `ChallengeWizard.jsx` (used by both Default and My Challenges in Settings) — a native `<form>` with a **hardcoded `[1,2,3,4].map(...)`** of exactly four habit-name inputs, no add/remove affordance, so a group challenge could never have more than 4 habits (extra ones simply had nowhere to go) and blank ones among the four were silently dropped rather than validated.

Rather than rebuild the same add/remove-habit UX a second time, `ChallengeWizard.jsx` now accepts `source="group"` directly:
- New props: `groupId` (which group to save against) and `onSaved` (callback with the saved challenge, since group challenges don't live in `defaultsData`/`userChallengesData` the way default/user ones do).
- `handleSave` branches early for `source === 'group'`: calls `saveGroupChallenge(groupId, {name, days, startDate, habits})` (the existing `POST /groups/:id/challenge` endpoint, unchanged) instead of the array-replace logic (`saveUserChallenges`/`saveDefaultsToServer`) the other two sources use — group challenges were never part of that array/`activeChallengeId` model to begin with.
- Habit list management (`addHabit`/`removeHabit`, the dynamic `habits` state array) is exactly the shared code default/user challenges already used — no new logic, no new cap.

`GroupsPage.jsx`: removed the entire `handleCreateChallenge` handler and the fixed-4 `<form>`, replaced with `<ChallengeWizard source="group" groupId={selectedGroup._id} editChallenge={groupChallenge} onCancel={...} onSaved={...} />` at the same spot in the layout (`.wizard`'s CSS is a plain in-flow card, not an overlay, so it drops in without layout changes). Also removed an already-dead `COLORS` import found unused in the same file while in there.

---

## 14. Explicit "Keep me signed in" checkbox on login/register (2026-07-17)

Reported as: "a button be there if i do not want to login again and again a day." The JWT itself already carries a 30-day expiry (`server/routes/auth.js`), and §12 already fixed the bug where a *valid* token got wiped by transient network errors — but there was never an actual visible control letting the user choose persistent-vs-session login, and no way to opt out of staying signed in on a shared device.

Added a real "Remember me" style toggle rather than just cosmetic UI:
- **`client/src/utils/api.js`**: `getToken()` now reads from `localStorage` *or* `sessionStorage` (whichever has it). `setToken(token, remember=true)` clears both first, then writes to `localStorage` when `remember` is true (persists across browser restarts, same as the existing default behavior) or `sessionStorage` when false (cleared the moment the browser/tab is closed). `login()`/`register()` both take a new `remember=true` param and pass it through to `setToken`.
- **`AuthContext.jsx`**: `loginUser`/`registerUser` accept and forward the same `remember` param.
- **`AuthOverlay.jsx`**: new `remember` state (default `true`, checked), a checkbox labeled "Keep me signed in on this device" between the password field and the submit button, passed through to `loginUser`/`registerUser` on submit. Applies to both sign-in and registration.
- **`App.css`**: `.auth-remember` styles for the new checkbox row (`accent-color: var(--accent)` so the check mark matches the theme).

### 14a. Verified live, both directions
With the checkbox **unchecked**, logged in as `naitikmishra` — confirmed via direct storage inspection that the token landed in `sessionStorage` only (`localStorage` stayed `null`). Cleared `sessionStorage` and reloaded (simulating closing the browser) — correctly bounced back to the login screen. With the checkbox **checked** (the default on a fresh page load), logged in again — confirmed the token went to `localStorage` only (`sessionStorage` stayed empty), matching the pre-existing persistent behavior.

**Verified live**: opened the real group "Challenge creation discussion" (owned by `anshul`, edited as admin), which had an existing 2-habit challenge. Edited it through the new wizard, clicked "+ Add Habit" three times to reach 5, filled in the 3 new names, saved — toast confirmed "Challenge updated!", the card showed "5 habits · 5 days", and reopening Edit showed all 5 names correctly pre-filled (`Reading, Writing, Habit Three, Habit Four, Habit Five`). Cross-checked directly against `GET /api/groups/:id/challenge` to confirm the 5 habits are genuinely persisted server-side, not just reflected in stale client state.

---

## 15. Cold-start loading indicator + keep-alive health endpoint (2026-07-21)

Reported as: "as of u logged in but still as the render server takes time to start so use some refreshing icon... or try to stop this by always running the project on render do not stop the db." Two separate asks: a UI cue during the wait, and reducing/eliminating the wait itself. (Note: the MongoDB database is a separate hosted service, not part of the Render web dyno — it isn't what "stops"; only the Express server sleeps on Render's free tier after ~15 min idle.)

### 15a. Loading indicator
`AuthOverlay.jsx`: the submit button already showed static "Please wait..." text with no visual motion, easy to mistake for a frozen page during a real cold start (which can take up to a minute). Now:
- A CSS spinner (`.auth-spinner`, plain rotating-border div, no external asset) renders inline with the button label whenever `loading` is true.
- A `wakingTimer` (via `useRef`) fires after `WAKING_HINT_DELAY_MS` (4s) of the request still being in flight, at which point the button label switches from "Please wait..." to "Waking up server..." and a small hint line appears below it: *"Free hosting spins down when idle — this can take up to a minute on the first try."* Cleared/reset on every submit and on completion, applies to both login and register.
- **Verified live**: patched `window.fetch` to add a 7s artificial delay to the `/api/auth/login` call (simulating a Render cold start) — confirmed the spinner + "Waking up server..." message + hint text appeared, and the login completed normally and landed on the Today page once the delayed response resolved.

### 15b. Keep-alive endpoint
Since Render's free tier hard-limits web services to spin down after ~15 min idle (this is a plan feature, not fixable in application code — only Render's paid Starter tier removes it), added `GET /api/health` in `server/index.js` — a trivial unauthenticated `{ ok: true }` route with no DB access, meant to be hit every ~10 min by a free external uptime pinger (e.g. UptimeRobot, cron-job.org) to keep the Render service from ever going idle long enough to sleep. This is a mitigation, not a guarantee — Render's own docs don't promise pinging prevents spin-down indefinitely; the only fully guaranteed fix is upgrading the Render instance type to a paid plan that doesn't spin down at all.
**Verified live**: `fetch('/api/health')` returns `{"ok": true}` after a full server restart (the route is registered before the auth routes, ahead of any auth middleware).
