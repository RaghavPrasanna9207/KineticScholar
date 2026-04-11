# KineticScholar

KineticScholar is a gamified soft skills-learning app with:

- Auth (signup/login)
- Courses and topic-based quizzes
- XP, streaks, hearts, achievements
- Daily challenges
- Leaderboard
- Question import (Excel/CSV)

## Project Structure

- Frontend (static): project root
  - `index.html`, `styles.css`, `engine.js`, `script.js`
- Backend API: `backend/`
  - Express + SQLite (`backend/data/app.db`)
- Seed question file: `questions.json`

## Prerequisites

- Node.js 20+ (recommended LTS)
- Python 3.x (for local static file serving)

## Run Locally

Use two terminals.

### 1) Start backend

```bash
cd backend
npm install
npm start
```

Backend runs on: `http://localhost:4000`

Health check:

- In Command Prompt (`cmd`):

```bat
curl http://localhost:4000/api/health
```

- In PowerShell:

```powershell
Invoke-RestMethod http://localhost:4000/api/health
```

### 2) Start frontend

From project root:

```bash
python -m http.server 8080
```

Open:

`http://localhost:8080/index.html`

Notes:

- Frontend calls backend at `http://localhost:4000/api` (configured in `engine.js`).
- Do not open via `file://`; serve over HTTP.
- If a port is blocked (example 5500), use another port like `8080`.

## Adding Your Own Questions

### Option A: Website import (recommended)

1. Open app and log in.
2. Go to **Import** tab.
3. Upload `.xlsx`, `.xls`, or `.csv`.
4. Required columns (exact names):
   - `Question_Text`
   - `choice_1`
   - `choice_2`
   - `choice_3`
   - `choice_4`
   - `answer_key`
   - `Topic`
5. Optional column:
   - `Solution`
6. Click **Import All**.

`answer_key` can be `1/2/3/4` or `choice_1/choice_2/choice_3/choice_4`.

### Option B: Edit seed file directly

Edit root `questions.json`.

## Where To Check Added Questions In Website

There is currently no separate "all questions" page. You can verify via:

1. **Import tab preview** (before import) shows parsed rows.
2. **Courses tab** reflects updated topic/question counts.
3. Start a quiz in the relevant topic to see imported questions appear in sessions.

## Data Storage

- Questions loaded by backend are persisted in SQLite:
  - `backend/data/app.db`
- `questions.json` is used as initial seed source and local dataset file.

## Troubleshooting

- `Invoke-RestMethod is not recognized`
  - You are in `cmd`, not PowerShell. Use `curl` in `cmd` or open PowerShell.

- `PermissionError [WinError 10013]` when running `python -m http.server 5500`
  - Port is blocked/in use. Run on a different port (for example `8080`).

- Emojis look broken
  - Hard refresh browser (`Ctrl+F5`) after updates.
  - Ensure latest `engine.js`, `script.js`, and `styles.css` are loaded.
