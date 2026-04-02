# KineticScholar Backend

This backend powers auth, progress sync, leaderboard, daily challenge tracking, quiz attempt logging, and question import.

## Stack
- Node.js + Express
- SQLite (file database at `backend/data/app.db`)
- JWT access + refresh tokens

## 1) Install Node.js
Use Node.js 20 LTS or newer.

## 2) Install dependencies
```bash
cd backend
npm install
```

## 3) Configure env
```bash
cp .env.example .env
```
Then edit `.env` and set a strong `JWT_SECRET`.

## 4) Start backend
```bash
npm start
```
Server runs at `http://localhost:4000`.

On first start, it auto-creates tables and seeds questions from `../questions.json`.

## API overview
- `POST /api/auth/signup`
- `POST /api/auth/login`
- `POST /api/auth/refresh`
- `POST /api/auth/logout`
- `GET /api/auth/me`
- `GET /api/questions`
- `POST /api/questions/import`
- `PUT /api/users/me`
- `POST /api/users/quiz-attempts`
- `GET /api/leaderboard`
- `GET /api/daily/status`
- `POST /api/daily/complete`

## Frontend expectation
The frontend now expects the backend to be running on `http://localhost:4000`.
