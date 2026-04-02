const express = require('express');
const { getDB } = require('./db');
const { authRequired } = require('./auth-middleware');
const { todayKey } = require('./utils');

const router = express.Router();

router.get('/status', authRequired, async (req, res) => {
    try {
        const db = await getDB();
        const row = await db.get('SELECT last_daily_date FROM users WHERE id = ?', req.auth.sub);
        if (!row) return res.status(404).json({ error: 'User not found' });
        const today = todayKey();
        return res.json({ completedToday: row.last_daily_date === today });
    } catch (err) {
        return res.status(500).json({ error: 'Failed to fetch daily status', details: err.message });
    }
});

router.post('/complete', authRequired, async (req, res) => {
    try {
        const db = await getDB();
        const row = await db.get('SELECT daily_challenges, last_daily_date FROM users WHERE id = ?', req.auth.sub);
        if (!row) return res.status(404).json({ error: 'User not found' });
        const today = todayKey();

        if (row.last_daily_date === today) {
            return res.json({ completedToday: true, alreadyCompleted: true });
        }

        await db.run(
            'UPDATE users SET daily_challenges = ?, last_daily_date = ? WHERE id = ?',
            (row.daily_challenges || 0) + 1,
            today,
            req.auth.sub
        );

        return res.json({ completedToday: true, alreadyCompleted: false });
    } catch (err) {
        return res.status(500).json({ error: 'Failed to mark daily complete', details: err.message });
    }
});

module.exports = router;
