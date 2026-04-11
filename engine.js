/* Core app engine: auth, game state, courses, sound, and confetti. */
const COURSE_CATEGORIES = [
    { name: "Quantitative Aptitude", icon: "\u{1F9EE}", color: "#8B5CF6", description: "Arithmetic, algebra, and number-based problem solving" },
    { name: "Logical Reasoning", icon: "\u{1F9E9}", color: "#06B6D4", description: "Patterns, deductions, and structured thinking" },
    { name: "Data Interpretation", icon: "\u{1F4CA}", color: "#F59E0B", description: "Charts, tables, and inference from data" },
    { name: "Verbal Ability", icon: "\u{1F4DD}", color: "#22C55E", description: "Language, comprehension, and communication skills" },
    { name: "Analytical Skills", icon: "\u{1F9E0}", color: "#EC4899", description: "Mixed applied aptitude and problem-solving drills" }
];

const ACHIEVEMENTS = [
    { id: "first_lesson", name: "First Steps", icon: "\u{1F3AF}", desc: "Complete your first lesson", check: s => s.lessonsCompleted >= 1 },
    { id: "perfect", name: "Perfectionist", icon: "\u{1F48E}", desc: "Score 100% in a lesson", check: s => s.perfectScores >= 1 },
    { id: "streak3", name: "On Fire", icon: "\u{1F525}", desc: "3-day streak", check: s => s.streak >= 3 },
    { id: "streak7", name: "Unstoppable", icon: "\u26A1", desc: "7-day streak", check: s => s.streak >= 7 },
    { id: "xp500", name: "Rising Star", icon: "\u2B50", desc: "Earn 500 XP", check: s => s.totalXP >= 500 },
    { id: "xp2000", name: "XP Master", icon: "\u{1F31F}", desc: "Earn 2000 XP", check: s => s.totalXP >= 2000 },
    { id: "topics3", name: "Explorer", icon: "\u{1F5FA}\uFE0F", desc: "Complete 3 topics", check: s => s.topicsCompleted >= 3 },
    { id: "topics_all", name: "Scholar", icon: "\u{1F393}", desc: "Complete all topics", check: s => s.allTopicsDone },
    { id: "daily5", name: "Challenger", icon: "\u2694\uFE0F", desc: "Complete 5 daily challenges", check: s => s.dailyChallenges >= 5 },
];

function getLevelInfo(xp) {
    const thresholds = [0,100,250,500,800,1200,1700,2300,3000,3800,4700,5700,6800,8000,9500,11000,13000,15500,18500,22000,26000,30000];
    let level = 1;
    for (let i = 1; i < thresholds.length; i++) {
        if (xp >= thresholds[i]) level = i + 1; else break;
    }
    const currentThreshold = thresholds[level - 1] || 0;
    const nextThreshold = thresholds[level] || thresholds[thresholds.length - 1] + 5000;
    const progress = ((xp - currentThreshold) / (nextThreshold - currentThreshold)) * 100;
    return { level, currentThreshold, nextThreshold, progress: Math.min(100, Math.max(0, progress)) };
}

const app = {
    data: [],             // All questions from JSON + imported
    importedData: [],     // Questions from Excel upload
    currentUser: null,    // Logged-in user object
    leaderboardUsers: [],

    api: {
        baseUrl: 'http://localhost:4000/api',
        accessTokenKey: 'ks_access_token',
        refreshTokenKey: 'ks_refresh_token',

        get accessToken() { return localStorage.getItem(this.accessTokenKey); },
        get refreshToken() { return localStorage.getItem(this.refreshTokenKey); },

        setTokens(accessToken, refreshToken) {
            if (accessToken) localStorage.setItem(this.accessTokenKey, accessToken);
            if (refreshToken) localStorage.setItem(this.refreshTokenKey, refreshToken);
        },

        clearTokens() {
            localStorage.removeItem(this.accessTokenKey);
            localStorage.removeItem(this.refreshTokenKey);
        },

        async request(path, options = {}, retry = true) {
            const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
            if (this.accessToken) headers.Authorization = `Bearer ${this.accessToken}`;

            const response = await fetch(`${this.baseUrl}${path}`, { ...options, headers });

            if (response.status === 401 && retry && this.refreshToken) {
                const refreshed = await this.refresh();
                if (refreshed) return this.request(path, options, false);
            }

            if (!response.ok) {
                let errBody = {};
                try { errBody = await response.json(); } catch (_) { errBody = {}; }
                throw new Error(errBody.error || `Request failed (${response.status})`);
            }

            const text = await response.text();
            return text ? JSON.parse(text) : {};
        },

        async refresh() {
            if (!this.refreshToken) return false;
            try {
                const response = await fetch(`${this.baseUrl}/auth/refresh`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ refreshToken: this.refreshToken }),
                });
                if (!response.ok) return false;
                const payload = await response.json();
                this.setTokens(payload.accessToken, payload.refreshToken);
                return true;
            } catch (_) {
                return false;
            }
        },
    },

    auth: {
        normalizeUserShape(user) {
            if (!user) return null;
            return {
                ...user,
                achievements: Array.isArray(user.achievements) ? user.achievements : [],
                completedTopics: Array.isArray(user.completedTopics) ? user.completedTopics : [],
                topicStats: user.topicStats || {},
            };
        },

        async init() {
            if (app.api.accessToken) {
                try {
                    const payload = await app.api.request('/auth/me');
                    app.currentUser = app.auth.normalizeUserShape(payload.user);
                    app.auth.onLogin();
                    return;
                } catch (_) {
                    app.api.clearTokens();
                }
            }
            document.getElementById('auth-screen').classList.remove('hidden');
            app.ui.createParticles();
        },

        async signup() {
            const username = document.getElementById('signup-username').value.trim();
            const email = document.getElementById('signup-email').value.trim();
            const password = document.getElementById('signup-password').value;
            const errEl = document.getElementById('signup-error');
            if (!username || username.length < 3) { errEl.textContent = 'Username must be 3+ characters'; return; }
            if (!email.includes('@')) { errEl.textContent = 'Enter a valid email'; return; }
            if (password.length < 4) { errEl.textContent = 'Password must be 4+ characters'; return; }

            try {
                const payload = await app.api.request('/auth/signup', {
                    method: 'POST',
                    body: JSON.stringify({ username, email, password }),
                });
                app.api.setTokens(payload.accessToken, payload.refreshToken);
                app.currentUser = app.auth.normalizeUserShape(payload.user);
                errEl.textContent = '';
                app.auth.onLogin();
            } catch (err) {
                errEl.textContent = err.message || 'Signup failed';
            }
        },

        async login() {
            const username = document.getElementById('login-username').value.trim();
            const password = document.getElementById('login-password').value;
            const errEl = document.getElementById('login-error');
            if (!username || !password) { errEl.textContent = 'Fill in all fields'; return; }

            try {
                const payload = await app.api.request('/auth/login', {
                    method: 'POST',
                    body: JSON.stringify({ username, password }),
                });
                app.api.setTokens(payload.accessToken, payload.refreshToken);
                app.currentUser = app.auth.normalizeUserShape(payload.user);
                errEl.textContent = '';
                app.auth.onLogin();
            } catch (err) {
                errEl.textContent = err.message || 'Login failed';
            }
        },

        onLogin() {
            document.getElementById('auth-screen').classList.add('hidden');
            document.getElementById('app-container').classList.remove('hidden');
            app.ui.goToDashboard();
            app.ui.updateNavStats();
        },

        async logout() {
            try { await app.api.request('/auth/logout', { method: 'POST' }); } catch (_) { /* noop */ }
            app.api.clearTokens();
            app.currentUser = null;
            document.getElementById('app-container').classList.add('hidden');
            document.getElementById('auth-screen').classList.remove('hidden');
            document.querySelectorAll('#auth-screen input').forEach(i => i.value = '');
            document.querySelectorAll('.auth-error').forEach(e => e.textContent = '');
            app.ui.showLogin();
        },

        async saveProgress() {
            if (!app.currentUser) return;
            try {
                const payload = await app.api.request('/users/me', {
                    method: 'PUT',
                    body: JSON.stringify({ user: app.currentUser }),
                });
                app.currentUser = app.auth.normalizeUserShape(payload.user);
            } catch (_) {
                // Keep UI responsive if backend call fails; user can retry by continuing usage.
            }
        }
    },

    game: {
        addXP(amount) {
            const oldLevel = getLevelInfo(app.currentUser.totalXP).level;
            app.currentUser.totalXP += amount;
            const newLevel = getLevelInfo(app.currentUser.totalXP).level;
            app.auth.saveProgress();
            app.ui.updateNavStats();
            if (newLevel > oldLevel) {
                app.ui.showToast(`\u{1F389} Level Up! You're now Level ${newLevel}!`, 'xp');
                app.sound.play('levelup');
            }
        },
        loseHeart() {
            if (app.currentUser.hearts > 0) app.currentUser.hearts--;
            app.auth.saveProgress();
            app.ui.updateNavStats();
            return app.currentUser.hearts;
        },
        resetHearts() { app.currentUser.hearts = 5; app.auth.saveProgress(); },
        updateStreak() {
            // Streak updates are handled by the backend on auth/me and login.
        },
        recordTopicStats(topic, correct, total) {
            if (!app.currentUser.topicStats[topic]) {
                app.currentUser.topicStats[topic] = { attempts: 0, correct: 0, wrong: 0, bestScore: 0 };
            }
            const s = app.currentUser.topicStats[topic];
            s.attempts++;
            s.correct += correct;
            s.wrong += (total - correct);
            const pct = Math.round((correct / total) * 100);
            if (pct > s.bestScore) s.bestScore = pct;
            app.auth.saveProgress();
        },
        checkAchievements() {
            const unlocked = [];
            const state = {
                lessonsCompleted: app.currentUser.lessonsCompleted,
                perfectScores: app.currentUser.perfectScores,
                streak: app.currentUser.streak,
                totalXP: app.currentUser.totalXP,
                topicsCompleted: app.currentUser.completedTopics.length,
                allTopicsDone: false,
                dailyChallenges: app.currentUser.dailyChallenges
            };
            const allTopics = [...new Set(app.data.map(q => q.Topic))];
            state.allTopicsDone = allTopics.length > 0 && allTopics.every(t => app.currentUser.completedTopics.includes(t));

            ACHIEVEMENTS.forEach(a => {
                if (!app.currentUser.achievements.includes(a.id) && a.check(state)) {
                    app.currentUser.achievements.push(a.id);
                    unlocked.push(a);
                }
            });
            if (unlocked.length) app.auth.saveProgress();
            return unlocked;
        }
    },

    courses: {
        getAll() {
            const allTopics = [...new Set(app.data.map(q => q.Topic))].sort((a, b) => a.localeCompare(b));
            if (allTopics.length === 0) return [];

            // Distribute topics round-robin so category sizes stay nearly equal.
            const topicBuckets = COURSE_CATEGORIES.map(() => []);
            allTopics.forEach((topic, idx) => {
                topicBuckets[idx % COURSE_CATEGORIES.length].push(topic);
            });

            return COURSE_CATEGORIES
                .map((category, idx) => ({ ...category, topics: topicBuckets[idx] }))
                .filter(category => category.topics.length > 0);
        },
        getProgress(courseName) {
            const course = app.courses.getAll().find(c => c.name === courseName);
            if (!course) return 0;
            const completed = course.topics.filter(t => app.currentUser.completedTopics.includes(t)).length;
            return Math.round((completed / course.topics.length) * 100);
        },
        getTopicState(topic) {
            if (app.currentUser.completedTopics.includes(topic)) return 'completed';
            // First topic in each course is always available
            const courses = app.courses.getAll();
            for (const course of courses) {
                const idx = course.topics.indexOf(topic);
                if (idx === 0) return 'available';
                if (idx > 0) {
                    const prev = course.topics[idx - 1];
                    if (app.currentUser.completedTopics.includes(prev)) return 'available';
                    return 'locked';
                }
            }
            return 'available'; // Fallback
        }
    },

    sound: {
        ctx: null,
        getCtx() { if (!this.ctx) this.ctx = new (window.AudioContext || window.webkitAudioContext)(); return this.ctx; },
        play(type) {
            if (!app.currentUser?.soundEnabled) return;
            try {
                const ctx = this.getCtx();
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.connect(gain);
                gain.connect(ctx.destination);
                gain.gain.setValueAtTime(0.15, ctx.currentTime);
                if (type === 'correct') {
                    osc.frequency.setValueAtTime(523, ctx.currentTime);
                    osc.frequency.setValueAtTime(659, ctx.currentTime + 0.1);
                    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
                    osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.3);
                } else if (type === 'wrong') {
                    osc.frequency.setValueAtTime(200, ctx.currentTime);
                    osc.type = 'sawtooth';
                    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
                    osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.3);
                } else if (type === 'levelup') {
                    osc.frequency.setValueAtTime(440, ctx.currentTime);
                    osc.frequency.setValueAtTime(554, ctx.currentTime + 0.15);
                    osc.frequency.setValueAtTime(659, ctx.currentTime + 0.3);
                    osc.frequency.setValueAtTime(880, ctx.currentTime + 0.45);
                    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.7);
                    osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.7);
                } else if (type === 'click') {
                    osc.frequency.setValueAtTime(800, ctx.currentTime);
                    gain.gain.setValueAtTime(0.08, ctx.currentTime);
                    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.08);
                    osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.08);
                }
            } catch(e) { /* Audio not supported */ }
        },
        toggle() {
            app.currentUser.soundEnabled = !app.currentUser.soundEnabled;
            app.auth.saveProgress();
            app.ui.showToast(app.currentUser.soundEnabled ? '\u{1F50A} Sound On' : '\u{1F507} Sound Off', 'info');
        }
    },

    confetti: {
        fire() {
            const canvas = document.getElementById('confetti-canvas');
            const ctx = canvas.getContext('2d');
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
            const particles = [];
            const colors = ['#8B5CF6', '#06B6D4', '#F59E0B', '#FF4B4B', '#FBBF24', '#A855F7'];
            for (let i = 0; i < 80; i++) {
                particles.push({
                    x: canvas.width / 2, y: canvas.height / 2,
                    vx: (Math.random() - 0.5) * 15, vy: (Math.random() - 1) * 15,
                    size: Math.random() * 8 + 3, color: colors[Math.floor(Math.random() * colors.length)],
                    rotation: Math.random() * 360, rotSpeed: (Math.random() - 0.5) * 10,
                    life: 1
                });
            }
            function animate() {
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                let alive = false;
                particles.forEach(p => {
                    if (p.life <= 0) return;
                    alive = true;
                    p.x += p.vx; p.y += p.vy; p.vy += 0.3;
                    p.rotation += p.rotSpeed; p.life -= 0.012;
                    ctx.save();
                    ctx.translate(p.x, p.y);
                    ctx.rotate((p.rotation * Math.PI) / 180);
                    ctx.fillStyle = p.color;
                    ctx.globalAlpha = p.life;
                    ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
                    ctx.restore();
                });
                if (alive) requestAnimationFrame(animate);
                else ctx.clearRect(0, 0, canvas.width, canvas.height);
            }
            animate();
        }
    }
};

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('login-btn').addEventListener('click', () => app.auth.login());
    document.getElementById('signup-btn').addEventListener('click', () => app.auth.signup());
    document.getElementById('login-password').addEventListener('keydown', e => { if (e.key === 'Enter') app.auth.login(); });
    document.getElementById('signup-password').addEventListener('keydown', e => { if (e.key === 'Enter') app.auth.signup(); });
    const zone = document.getElementById('upload-zone');
    if (zone) {
        zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('dragover'); });
        zone.addEventListener('dragleave', () => zone.classList.remove('dragover'));
        zone.addEventListener('drop', e => { e.preventDefault(); zone.classList.remove('dragover');
            const file = e.dataTransfer.files[0]; if (file) app.excel.processFile(file);
        });
    }
});
