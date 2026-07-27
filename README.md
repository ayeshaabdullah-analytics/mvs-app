# MVS — Milestone · Vision · Steps

> A full-stack AI-powered personal study & goal tracker built with React, Firebase, and Groq (Llama 3.3).

**Live demo:** `<!-- PASTE YOUR VERCEL URL HERE -->`  
**GitHub:** `<!-- PASTE YOUR GITHUB REPO URL HERE -->`

---

## Screenshots

| Home Dashboard | Weekly Planner + AI |
|---|---|
| ![Home](screenshots/home.png) | ![Weekly](screenshots/weekly.png) |

| Focus Timer | Statistics |
|---|---|
| ![Focus](screenshots/focus.png) | ![Stats](screenshots/stats.png) |

| Journal | Achievements |
|---|---|
| ![Journal](screenshots/journal.png) | ![Achievements](screenshots/achievements.png) |

---

## What it does

MVS helps students plan, track, and reflect on their study goals across three time horizons — hence the name: **Milestone** (long-term), **Vision** (weekly), **Steps** (daily tasks).

The app covers the full study lifecycle:

1. Set long-term horizon goals (yearly / quarterly / monthly)
2. Break them into weekly goals linked to those horizons
3. Use AI to auto-generate a daily task plan for the week
4. Focus with a Pomodoro-style timer that logs every session
5. Track habits, review your stats, and reflect in a daily journal
6. Earn achievement badges as you hit milestones

---

## Features

### 📋 Pages & functionality

| Page | What it does |
|---|---|
| **Today** | Dashboard — daily greeting, 4 live stat cards, today's tasks per goal, AI coach insight, session history pills |
| **Goals** | 3-column Kanban board (Year / Quarter / Month) with progress bars and inline add forms |
| **Weekly** | Week planner with day-density chart, AI task breakdown (Groq/Llama), manual task CRUD |
| **Focus** | Pomodoro timer — 4 modes (25 min / 5 min / 15 min / custom), cycle tracker, task selector, session log |
| **Journal** | Daily reflections — mood tracker (5 levels), AI writing prompts, tag system, 14-day calendar strip |
| **Stats** | Analytics — 30-day trend line, activity heatmap, time-by-day bar chart, per-goal breakdown, session log |
| **Habits** | Habit tracker — emoji + color labels, 7-day completion grid, streak counter, check-in per day |
| **Achievements** | 25 dynamically-unlocked badges across 6 categories, XP system, locked/unlocked card wall |
| **Profile** | Theme switcher (4 themes), achievement badges, all-time stats, settings |

### 🤖 AI features

**Goal → Task Breakdown** (Weekly page)  
The user picks a weekly goal + which days they're available. The app sends this to Groq (Llama 3.3-70b) with a structured system prompt that returns a JSON array of `{day, task}` pairs. The user can edit/delete items before saving.

**AI Coach Insight** (Today page)  
After any goal block, clicking "AI Coach insight" sends the goal title + task completion stats to the model, which responds with a 2–3 sentence warm, specific motivational message.

**System prompts used:**

```
Goal breakdown:
"You are a flexible study planning assistant. A student will give you a weekly
goal and the days they have available. Break the goal into smaller tasks
distributed across those days. Do NOT assign any clock times — only assign
which day of the week each task belongs to, or leave a task unassigned to a
specific day if it's better done whenever the student has time.
Output ONLY valid JSON: [{"day": "Monday" or null, "task": "short description"}].
Keep each task under 10 words. Distribute realistically — not every day needs a task."

Coach insight:
"You are an encouraging study coach. A student's weekly goal is: [title].
They have X of Y tasks completed. Write a short 2-3 sentence motivational insight.
Never mention clock times, never guilt-trip about gaps. Be warm and specific to their progress."
```

### 🎨 Themes

4 vivid dark themes — all with lifted, colorful backgrounds (not near-black):

| Theme | Primary | Background |
|---|---|---|
| ⚡ Neon | Fuchsia `#c026d3` | Deep purple `#120b2e` |
| 🌅 Sunrise | Hot coral `#ff6b35` | Rich amber `#1f0a00` |
| ❄️ Arctic | Electric cyan `#00d4ff` | Deep blue `#001a2e` |
| 🌿 Forest | Neon green `#39ff14` | Dark emerald `#001a0a` |

---

## Tech stack

| Layer | Tech |
|---|---|
| Frontend | React 19, React Router 7, Recharts |
| Build tool | Vite 8 |
| Auth | Firebase Authentication (email/password + Google OAuth) |
| Database | Firestore (real-time listeners) |
| AI | Groq API — `llama-3.3-70b-versatile` model |
| Deployment | Vercel |
| Linting | oxlint |

---

## Firestore data model

```
users/{uid}/                     ← via Auth
userSettings/{uid}               ← theme preference
horizonGoals/{id}                ← year/quarter/month goals
weeklyGoals/{id}                 ← weekly goals linked to horizons
dailyTasks/{id}                  ← tasks linked to weekly goals
sessions/{id}                    ← timer sessions (start, end, duration)
journalEntries/{id}              ← daily journal entries with mood + tags
habits/{id}                      ← habit definitions
habitCheckins/{id}               ← per-day habit completions
```

---

## Running locally

### Prerequisites
- Node.js 18+
- A Firebase project with **Authentication** (Email/Password + Google) and **Firestore** enabled
- A Groq API key (free at [console.groq.com](https://console.groq.com))

### Setup

```bash
# 1. Clone the repo
git clone https://github.com/YOUR_USERNAME/YOUR_REPO.git
cd YOUR_REPO

# 2. Install dependencies
npm install

# 3. Create your environment file
cp .env.example .env
```

Fill in `.env` with your real values:

```env
VITE_FIREBASE_API_KEY=your_firebase_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
VITE_GROQ_API_KEY=your_groq_key
```

```bash
# 4. Start the dev server
npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

### Build for production

```bash
npm run build
npm run preview
```

---

## Deploying to Vercel

1. Push to GitHub (public repo)
2. Go to [vercel.com](https://vercel.com) → Add New Project → import the repo
3. In **Settings → Environment Variables**, add all 7 variables from `.env.example` with real values
4. Deploy — Vercel auto-detects Vite and sets the correct build command (`npm run build`) and output dir (`dist`)

> ⚠️ Never paste API keys into source code. Always use environment variables.

---

## Project structure

```
src/
├── components/
│   ├── Navbar.jsx          # Left sidebar navigation
│   ├── Timer.jsx           # Study timer modal
│   └── ProtectedRoute.jsx
├── context/
│   ├── AuthContext.jsx     # Firebase auth state
│   └── ThemeContext.jsx    # 4-theme system
├── hooks/
│   └── useFirestore.js     # useCollection, useAdd, useUpdate, useDelete
├── pages/
│   ├── Home.jsx            # Today dashboard
│   ├── Goals.jsx           # Horizon goals (3-column)
│   ├── Weekly.jsx          # Weekly planner + AI breakdown
│   ├── Focus.jsx           # Pomodoro timer
│   ├── Journal.jsx         # Daily journal + mood
│   ├── Stats.jsx           # Analytics & charts
│   ├── Habits.jsx          # Habit tracker
│   ├── Achievements.jsx    # Badge wall
│   └── Profile.jsx         # Settings & theme picker
├── services/
│   ├── groq.js             # Groq / Llama 3.3 integration
│   └── gemini.js           # Gemini integration (alternate)
├── styles/                 # Per-page CSS modules
└── utils/
    └── dates.js            # Date helpers (streaks, week math, formatting)
```

---

## Environment variables reference

| Variable | Where to get it |
|---|---|
| `VITE_FIREBASE_API_KEY` | Firebase Console → Project Settings → Your apps |
| `VITE_FIREBASE_AUTH_DOMAIN` | Same as above |
| `VITE_FIREBASE_PROJECT_ID` | Same as above |
| `VITE_FIREBASE_STORAGE_BUCKET` | Same as above |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | Same as above |
| `VITE_FIREBASE_APP_ID` | Same as above |
| `VITE_GROQ_API_KEY` | [console.groq.com](https://console.groq.com) → API Keys |
