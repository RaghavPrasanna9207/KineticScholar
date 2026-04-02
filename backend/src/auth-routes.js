const bcrypt = require('bcryptjs');
const express = require('express');
const jwt = require('jsonwebtoken');
const { getDB, normalizeUser } = require('./db');
const { authRequired } = require('./auth-middleware');
const { createAccessToken, createRefreshToken, todayKey } = require('./utils');

const router = express.Router();

async function persistRefreshToken(userId, refreshToken) {
    const db = await getDB();
    await db.run('UPDATE users SET refresh_token = ? WHERE id = ?', refreshToken, userId);
}

async function getUserById(userId) {
    const db = await getDB();
    return db.get('SELECT * FROM users WHERE id = ?', userId);
}

async function updateStreakIfNeeded(userId) {
    const db = await getDB();
    const row = await db.get('SELECT streak, last_active_date FROM users WHERE id = ?', userId);
    if (!row) return;

    const today = todayKey();
    const yesterdayDate = new Date();
    yesterdayDate.setDate(yesterdayDate.getDate() - 1);
    const yesterday = yesterdayDate.toISOString().slice(0, 10);

    if (row.last_active_date === today) return;

    let nextStreak = 1;
    if (row.last_active_date === yesterday) nextStreak = (row.streak || 0) + 1;

    await db.run(
        'UPDATE users SET streak = ?, last_active_date = ? WHERE id = ?',
        nextStreak,
        today,
        userId
    );
}

router.post('/signup', async (req, res) => {
    const { username, email, password } = req.body || {};
    if (!username || String(username).trim().length < 3) {
        return res.status(400).json({ error: 'Username must be 3+ characters' });
    }
    if (!email || !String(email).includes('@')) {
        return res.status(400).json({ error: 'Enter a valid email' });
    }
    if (!password || String(password).length < 4) {
        return res.status(400).json({ error: 'Password must be 4+ characters' });
    }

    const cleanUsername = String(username).trim();
    const cleanEmail = String(email).trim().toLowerCase();

    try {
        const db = await getDB();
        const existing = await db.get(
            'SELECT id FROM users WHERE username = ? OR email = ?',
            cleanUsername,
            cleanEmail
        );
        if (existing) {
            return res.status(409).json({ error: 'Username or email already exists' });
        }

        const passwordHash = await bcrypt.hash(String(password), 10);
        const nowIso = new Date().toISOString();
        const achievements = '[]';
        const completedTopics = '[]';
        const topicStats = '{}';

        const result = await db.run(
            `INSERT INTO users (
                username, email, password_hash, joined_date,
                total_xp, streak, last_active_date, hearts,
                lessons_completed, perfect_scores, topics_completed,
                daily_challenges, achievements, completed_topics,
                topic_stats, sound_enabled
            ) VALUES (?, ?, ?, ?, 0, 0, NULL, 5, 0, 0, 0, 0, ?, ?, ?, 1)`,
            cleanUsername,
            cleanEmail,
            passwordHash,
            nowIso,
            achievements,
            completedTopics,
            topicStats
        );

        const created = await db.get('SELECT * FROM users WHERE id = ?', result.lastID);
        await updateStreakIfNeeded(created.id);
        const fresh = await getUserById(created.id);

        const accessToken = createAccessToken(fresh);
        const refreshToken = createRefreshToken(fresh);
        await persistRefreshToken(fresh.id, refreshToken);

        return res.status(201).json({
            accessToken,
            refreshToken,
            user: normalizeUser(fresh),
        });
    } catch (err) {
        return res.status(500).json({ error: 'Signup failed', details: err.message });
    }
});

router.post('/login', async (req, res) => {
    const { username, password } = req.body || {};
    if (!username || !password) {
        return res.status(400).json({ error: 'Fill in all fields' });
    }

    try {
        const db = await getDB();
        const user = await db.get('SELECT * FROM users WHERE username = ?', String(username).trim());
        if (!user) return res.status(401).json({ error: 'Invalid username or password' });

        const ok = await bcrypt.compare(String(password), user.password_hash);
        if (!ok) return res.status(401).json({ error: 'Invalid username or password' });

        await updateStreakIfNeeded(user.id);
        const fresh = await getUserById(user.id);

        const accessToken = createAccessToken(fresh);
        const refreshToken = createRefreshToken(fresh);
        await persistRefreshToken(fresh.id, refreshToken);

        return res.json({
            accessToken,
            refreshToken,
            user: normalizeUser(fresh),
        });
    } catch (err) {
        return res.status(500).json({ error: 'Login failed', details: err.message });
    }
});

router.post('/refresh', async (req, res) => {
    const { refreshToken } = req.body || {};
    if (!refreshToken) return res.status(400).json({ error: 'Missing refresh token' });

    try {
        const payload = jwt.verify(refreshToken, process.env.JWT_SECRET);
        if (payload.type !== 'refresh') {
            return res.status(401).json({ error: 'Invalid refresh token type' });
        }

        const db = await getDB();
        const user = await db.get('SELECT * FROM users WHERE id = ?', payload.sub);
        if (!user || user.refresh_token !== refreshToken) {
            return res.status(401).json({ error: 'Refresh token not recognized' });
        }

        const newAccess = createAccessToken(user);
        const newRefresh = createRefreshToken(user);
        await persistRefreshToken(user.id, newRefresh);

        return res.json({
            accessToken: newAccess,
            refreshToken: newRefresh,
        });
    } catch (err) {
        return res.status(401).json({ error: 'Invalid or expired refresh token' });
    }
});

router.post('/logout', authRequired, async (req, res) => {
    try {
        const db = await getDB();
        await db.run('UPDATE users SET refresh_token = NULL WHERE id = ?', req.auth.sub);
        return res.json({ ok: true });
    } catch (err) {
        return res.status(500).json({ error: 'Logout failed', details: err.message });
    }
});

router.get('/me', authRequired, async (req, res) => {
    try {
        await updateStreakIfNeeded(req.auth.sub);
        const user = await getUserById(req.auth.sub);
        if (!user) return res.status(404).json({ error: 'User not found' });
        return res.json({ user: normalizeUser(user) });
    } catch (err) {
        return res.status(500).json({ error: 'Failed to fetch profile', details: err.message });
    }
});

module.exports = router;
