const fs = require('fs/promises');
const path = require('path');
const { getDB } = require('./db');

function normalizeAnswerKey(v) {
    if (String(v).startsWith('choice_')) return String(v);
    const n = Number(v);
    if ([1, 2, 3, 4].includes(n)) return `choice_${n}`;
    return 'choice_1';
}

async function seedBaseQuestions(db) {
    const count = await db.get("SELECT COUNT(*) AS count FROM questions WHERE source = 'base'");
    if (count?.count > 0) return;

    const questionPath = path.join(__dirname, '..', '..', 'questions.json');
    const raw = await fs.readFile(questionPath, 'utf8');
    const questions = JSON.parse(raw);

    await db.run('BEGIN TRANSACTION');
    try {
        for (const q of questions) {
            await db.run(
                `INSERT INTO questions (
                    question_text, choice_1, choice_2, choice_3, choice_4,
                    answer_key, solution, topic, source
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'base')`,
                String(q.Question_Text || ''),
                String(q.choice_1 || ''),
                String(q.choice_2 || ''),
                String(q.choice_3 || ''),
                String(q.choice_4 || ''),
                normalizeAnswerKey(q.answer_key),
                String(q.Solution || '-'),
                String(q.Topic || 'General')
            );
        }
        await db.run('COMMIT');
    } catch (err) {
        await db.run('ROLLBACK');
        throw err;
    }
}

async function initDatabase() {
    const db = await getDB();

    await db.exec(`
        PRAGMA foreign_keys = ON;

        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT NOT NULL UNIQUE,
            email TEXT NOT NULL UNIQUE,
            password_hash TEXT NOT NULL,
            joined_date TEXT NOT NULL,
            total_xp INTEGER NOT NULL DEFAULT 0,
            streak INTEGER NOT NULL DEFAULT 0,
            last_active_date TEXT,
            hearts INTEGER NOT NULL DEFAULT 5,
            lessons_completed INTEGER NOT NULL DEFAULT 0,
            perfect_scores INTEGER NOT NULL DEFAULT 0,
            topics_completed INTEGER NOT NULL DEFAULT 0,
            daily_challenges INTEGER NOT NULL DEFAULT 0,
            achievements TEXT NOT NULL DEFAULT '[]',
            completed_topics TEXT NOT NULL DEFAULT '[]',
            topic_stats TEXT NOT NULL DEFAULT '{}',
            sound_enabled INTEGER NOT NULL DEFAULT 1,
            refresh_token TEXT,
            last_daily_date TEXT
        );

        CREATE TABLE IF NOT EXISTS questions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            question_text TEXT NOT NULL,
            choice_1 TEXT NOT NULL,
            choice_2 TEXT NOT NULL,
            choice_3 TEXT NOT NULL,
            choice_4 TEXT NOT NULL,
            answer_key TEXT NOT NULL,
            solution TEXT,
            topic TEXT NOT NULL,
            source TEXT NOT NULL DEFAULT 'base',
            created_by INTEGER,
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
        );

        CREATE TABLE IF NOT EXISTS quiz_attempts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            topic TEXT,
            score INTEGER NOT NULL,
            total INTEGER NOT NULL,
            percentage INTEGER NOT NULL,
            duration_seconds INTEGER NOT NULL,
            is_daily INTEGER NOT NULL DEFAULT 0,
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        );

        CREATE INDEX IF NOT EXISTS idx_users_total_xp ON users(total_xp DESC);
        CREATE INDEX IF NOT EXISTS idx_questions_topic ON questions(topic);
        CREATE INDEX IF NOT EXISTS idx_attempts_user ON quiz_attempts(user_id);
    `);

    await seedBaseQuestions(db);
}

module.exports = {
    initDatabase,
};
