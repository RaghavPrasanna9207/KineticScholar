const jwt = require('jsonwebtoken');

function createAccessToken(user) {
    return jwt.sign(
        { sub: user.id, username: user.username, type: 'access' },
        process.env.JWT_SECRET,
        { expiresIn: process.env.ACCESS_TOKEN_TTL || '15m' }
    );
}

function createRefreshToken(user) {
    return jwt.sign(
        { sub: user.id, username: user.username, type: 'refresh' },
        process.env.JWT_SECRET,
        { expiresIn: process.env.REFRESH_TOKEN_TTL || '7d' }
    );
}

function todayKey() {
    return new Date().toISOString().slice(0, 10);
}

module.exports = {
    createAccessToken,
    createRefreshToken,
    todayKey,
};
