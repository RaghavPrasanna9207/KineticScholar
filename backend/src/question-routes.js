const express = require('express');
const { getDB } = require('./db');
const { authRequired } = require('./auth-middleware');

const router = express.Router();

function normalizeAnswerKey(v) {
    if (String(v).startsWith('choice_')) return String(v);
    const n = Number(v);
    if ([1, 2, 3, 4].includes(n)) return `choice_${n}`;
    return 'choice_1';
}

function normalizeQuestionRow(row) {
    return {
        id: row.id,
        Question_Text: row.question_text,
        choice_1: row.choice_1,
        choice_2: row.choice_2,
        choice_3: row.choice_3,
        choice_4: row.choice_4,
        answer_key: row.answer_key,
        Solution: row.solution,
        Topic: row.topic,
    };
}

router.get('/', async (req, res) => {
    const topic = req.query.topic ? String(req.query.topic) : null;
    const daily = req.query.daily === '1';
    const limit = Math.max(1, Math.min(Number(req.query.limit) || (daily ? 10 : 5000), 5000));

    try {
        const db = await getDB();
        let rows;

        if (topic) {
            rows = await db.all(
                `SELECT * FROM questions WHERE topic = ? ORDER BY ${daily ? 'RANDOM()' : 'id ASC'} LIMIT ?`,
                topic,
                limit
            );
        } else {
            rows = await db.all(
                `SELECT * FROM questions ORDER BY ${daily ? 'RANDOM()' : 'id ASC'} LIMIT ?`,
                limit
            );
        }

        return res.json({ questions: rows.map(normalizeQuestionRow) });
    } catch (err) {
        return res.status(500).json({ error: 'Failed to load questions', details: err.message });
    }
});

router.post('/import', authRequired, async (req, res) => {
    const questions = req.body?.questions;
    if (!Array.isArray(questions) || questions.length === 0) {
        return res.status(400).json({ error: 'questions array is required' });
    }

    try {
        const db = await getDB();
        await db.run('BEGIN TRANSACTION');

        for (const q of questions) {
            await db.run(
                `INSERT INTO questions (
                    question_text, choice_1, choice_2, choice_3, choice_4,
                    answer_key, solution, topic, source, created_by
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'imported', ?)` ,
                String(q.Question_Text || ''),
                String(q.choice_1 || ''),
                String(q.choice_2 || ''),
                String(q.choice_3 || ''),
                String(q.choice_4 || ''),
                normalizeAnswerKey(q.answer_key),
                String(q.Solution || '-'),
                String(q.Topic || 'General'),
                req.auth.sub
            );
        }

        await db.run('COMMIT');
        return res.status(201).json({ inserted: questions.length });
    } catch (err) {
        const db = await getDB();
        await db.run('ROLLBACK');
        return res.status(500).json({ error: 'Failed to import questions', details: err.message });
    }
});

module.exports = router;
