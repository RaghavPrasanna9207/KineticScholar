const express = require('express');
const { getDB, normalizeUser } = require('./db');
const { authRequired } = require('./auth-middleware');

const router = express.Router();

function toJSON(value, fallback) {
    try {
        return JSON.stringify(value ?? fallback);
    } catch (_) {
        return JSON.stringify(fallback);
    }
}

router.put('/me', authRequired, async (req, res) => {
    const user = req.body?.user;
    if (!user || typeof user !== 'object') {
        return res.status(400).json({ error: 'user object is required' });
    }

    try {
        const db = await getDB();
        await db.run(
            `UPDATE users SET
                total_xp = ?,
                streak = ?,
                last_active_date = ?,
                hearts = ?,
                lessons_completed = ?,
                perfect_scores = ?,
                topics_completed = ?,
                daily_challenges = ?,
                achievements = ?,
                completed_topics = ?,
                topic_stats = ?,
                sound_enabled = ?,
                last_daily_date = ?
             WHERE id = ?`,
            Number(user.totalXP || 0),
            Number(user.streak || 0),
            user.lastActiveDate || null,
            Number(user.hearts ?? 5),
            Number(user.lessonsCompleted || 0),
            Number(user.perfectScores || 0),
            Number((user.completedTopics || []).length),
            Number(user.dailyChallenges || 0),
            toJSON(user.achievements, []),
            toJSON(user.completedTopics, []),
            toJSON(user.topicStats, {}),
            user.soundEnabled ? 1 : 0,
            user.lastDailyDate || null,
            req.auth.sub
        );

        const fresh = await db.get('SELECT * FROM users WHERE id = ?', req.auth.sub);
        return res.json({ user: normalizeUser(fresh) });
    } catch (err) {
        return res.status(500).json({ error: 'Failed to save progress', details: err.message });
    }
});

router.post('/quiz-attempts', authRequired, async (req, res) => {
    const payload = req.body || {};
    try {
        const db = await getDB();
        await db.run(
            `INSERT INTO quiz_attempts (
                user_id, topic, score, total, percentage, duration_seconds, is_daily
            ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
            req.auth.sub,
            payload.topic || null,
            Number(payload.score || 0),
            Number(payload.total || 0),
            Number(payload.percentage || 0),
            Number(payload.durationSeconds || 0),
            payload.isDaily ? 1 : 0
        );
        return res.status(201).json({ ok: true });
    } catch (err) {
        return res.status(500).json({ error: 'Failed to save quiz attempt', details: err.message });
    }
});

module.exports = router;
