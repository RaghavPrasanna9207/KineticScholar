const express = require('express');
const { getDB } = require('./db');

const router = express.Router();

router.get('/', async (_req, res) => {
    try {
        const db = await getDB();
        const rows = await db.all(
            'SELECT username, total_xp AS totalXP, streak FROM users ORDER BY total_xp DESC, username ASC LIMIT 100'
        );
        return res.json({ users: rows });
    } catch (err) {
        return res.status(500).json({ error: 'Failed to load leaderboard', details: err.message });
    }
});

module.exports = router;
