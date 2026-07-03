# Habit Tracker

A full-stack MERN habit tracking app where users can create, discover, and follow challenges, track daily habits, and compete on leaderboards.

## Purpose

Helps you build and maintain daily habits through structured challenges. Create your own challenge or join community challenges, check off habits each day, track your streaks, and see how you rank against other participants on the leaderboard.

## Features

- **Challenges** — Admin-created default challenges and user-created custom challenges
- **Daily Tracking** — Check off habits each day with a visual checklist
- **Progress Dashboard** — View streaks, completion rates, and habit-level stats
- **Charts & Calendar** — Bar chart of daily scores and color-coded calendar heatmap
- **Leaderboards** — Every challenge has a leaderboard showing all followers ranked by percentage
- **Discover** — Browse all challenges (official + community-created) and follow any
- **User Profiles** — Custom username, email, and avatar (upload or URL)
- **Themes** — 7 color themes (Sunset, Midnight, Forest, Ocean, Rose, Lavender, Amber)
- **Authentication** — Secure signup/login with password validation

## How to Use

### Getting Started
1. **Sign up** with a username, email, and password
2. **Browse challenges** — tap 🔍 on the Today tab to see all available challenges
3. **Follow a challenge** — tap **Follow** to start tracking it
4. **Track daily** — check off habits each day, watch your score grow

### Creating Challenges
- Any user can create a personal challenge from **Settings > + Create My Challenge**
- Admins can create default challenges visible to everyone

### Leaderboard
- Tap 🏆 on any challenge to see the leaderboard
- You appear automatically once you follow a challenge
- Ranked by completion percentage

### Profile & Settings
- Tap your name card in **Settings** to edit username, email, or avatar
- Change password from the same screen
- Pick a theme from the **Theme** section

## Tech Stack

- **MongoDB** / Mongoose — data storage
- **Express** — REST API
- **React** (Vite) — frontend
- **Node.js** — server

## Deployment

```bash
npm install && npm run build
node server/index.js
```

Requires `MONGODB_URI` environment variable. Admin account `naitikmishra` is seeded automatically.
