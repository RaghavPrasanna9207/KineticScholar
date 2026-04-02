const path = require('path');
const { open } = require('sqlite');
const sqlite3 = require('sqlite3');

let dbPromise;

function parseJSON(value, fallback) {
    if (!value) return fallback;
    try {
        return JSON.parse(value);
    } catch (_) {
        return fallback;
    }
}

function normalizeUser(row) {
    if (!row) return null;
    return {
        id: row.id,
        username: row.username,
        email: row.email,
        joinedDate: row.joined_date,
        totalXP: row.total_xp,
        streak: row.streak,
        lastActiveDate: row.last_active_date,
        hearts: row.hearts,
        lessonsCompleted: row.lessons_completed,
        perfectScores: row.perfect_scores,
        topicsCompleted: row.topics_completed,
        dailyChallenges: row.daily_challenges,
        achievements: parseJSON(row.achievements, []),
        completedTopics: parseJSON(row.completed_topics, []),
        topicStats: parseJSON(row.topic_stats, {}),
        soundEnabled: !!row.sound_enabled,
        lastDailyDate: row.last_daily_date || null,
    };
}

async function getDB() {
    if (!dbPromise) {
        dbPromise = open({
            filename: path.join(__dirname, '..', 'data', 'app.db'),
            driver: sqlite3.Database,
        });
    }
    return dbPromise;
}

module.exports = {
    getDB,
    normalizeUser,
};
