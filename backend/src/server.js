require('dotenv').config();
const express = require('express');
const { initDatabase } = require('./init-db');
const authRoutes = require('./auth-routes');
const questionRoutes = require('./question-routes');
const userRoutes = require('./user-routes');
const leaderboardRoutes = require('./leaderboard-routes');
const dailyRoutes = require('./daily-routes');

const app = express();
const PORT = Number(process.env.PORT || 4000);

app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
    if (req.method === 'OPTIONS') return res.sendStatus(204);
    return next();
});

app.use(express.json({ limit: '4mb' }));

app.get('/api/health', (_req, res) => {
    res.json({ ok: true, service: 'kinetic-scholar-backend' });
});

app.use('/api/auth', authRoutes);
app.use('/api/questions', questionRoutes);
app.use('/api/users', userRoutes);
app.use('/api/leaderboard', leaderboardRoutes);
app.use('/api/daily', dailyRoutes);

app.use((err, _req, res, _next) => {
    console.error(err);
    res.status(500).json({ error: 'Unexpected server error' });
});

(async () => {
    try {
        if (!process.env.JWT_SECRET || process.env.JWT_SECRET === 'replace_this_with_a_long_random_secret') {
            console.warn('WARNING: Please set a strong JWT_SECRET in backend/.env before production use.');
        }
        await initDatabase();
        app.listen(PORT, () => {
            console.log(`KineticScholar backend listening on http://localhost:${PORT}`);
        });
    } catch (err) {
        console.error('Failed to start backend:', err);
        process.exit(1);
    }
})();
