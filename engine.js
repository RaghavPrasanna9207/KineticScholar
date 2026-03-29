/* ============================================
   KINETIC SCHOLAR - GAMIFIED LEARNING PLATFORM
   Core Engine: Auth, GameState, Courses, Sound
   
   VIVA NOTE: This file contains the core modules
   that power the gamification system. The quiz
   logic preserves the original answer validation.
   ============================================ */

// ── COURSE MAPPING (NPTEL-Style) ──
// VIVA NOTE: Groups existing topics into structured courses
const COURSE_MAP = {
    "Quantitative Aptitude": {
        icon: "🧮", color: "#8B5CF6",
        description: "Master numbers, time & calculations",
        topics: ["Clocks", "Calendar"]
    },
    "Logical Reasoning": {
        icon: "🧩", color: "#06B6D4",
        description: "Sharpen your logical thinking",
        topics: ["Direction Sense", "Cubes"]
    },
    "Data Analysis": {
        icon: "📊", color: "#F59E0B",
        description: "Analyze data & draw conclusions",
        topics: ["Data sufficiency", "Data Sufficiency", "Caselet Problems"]
    }
};

// ── ACHIEVEMENTS DEFINITIONS ──
const ACHIEVEMENTS = [
    { id: "first_lesson", name: "First Steps", icon: "🎯", desc: "Complete your first lesson", check: s => s.lessonsCompleted >= 1 },
    { id: "perfect", name: "Perfectionist", icon: "💎", desc: "Score 100% in a lesson", check: s => s.perfectScores >= 1 },
    { id: "streak3", name: "On Fire", icon: "🔥", desc: "3-day streak", check: s => s.streak >= 3 },
    { id: "streak7", name: "Unstoppable", icon: "⚡", desc: "7-day streak", check: s => s.streak >= 7 },
    { id: "xp500", name: "Rising Star", icon: "⭐", desc: "Earn 500 XP", check: s => s.totalXP >= 500 },
    { id: "xp2000", name: "XP Master", icon: "🌟", desc: "Earn 2000 XP", check: s => s.totalXP >= 2000 },
    { id: "topics3", name: "Explorer", icon: "🗺️", desc: "Complete 3 topics", check: s => s.topicsCompleted >= 3 },
    { id: "topics_all", name: "Scholar", icon: "🎓", desc: "Complete all topics", check: s => s.allTopicsDone },
    { id: "daily5", name: "Challenger", icon: "⚔️", desc: "Complete 5 daily challenges", check: s => s.dailyChallenges >= 5 },
];

// ── LEVEL THRESHOLDS ──
// VIVA NOTE: XP required for each level, similar to Duolingo's progression
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

// ── MAIN APP OBJECT ──
const app = {
    data: [],             // All questions from JSON + imported
    importedData: [],     // Questions from Excel upload
    currentUser: null,    // Logged-in user object

    // ════════════════════════════════════
    // AUTH MODULE
    // VIVA NOTE: localStorage-based auth
    // ════════════════════════════════════
    auth: {
        init() {
            // Check for existing session
            const saved = localStorage.getItem('sf_current_user');
            if (saved) {
                app.currentUser = JSON.parse(saved);
                const users = app.auth.getUsers();
                const found = users.find(u => u.username === app.currentUser.username);
                if (found) { app.currentUser = found; app.auth.onLogin(); return; }
            }
            document.getElementById('auth-screen').classList.remove('hidden');
            app.ui.createParticles();
        },
        getUsers() { return JSON.parse(localStorage.getItem('sf_users') || '[]'); },
        saveUsers(users) { localStorage.setItem('sf_users', JSON.stringify(users)); },
        signup() {
            const username = document.getElementById('signup-username').value.trim();
            const email = document.getElementById('signup-email').value.trim();
            const password = document.getElementById('signup-password').value;
            const errEl = document.getElementById('signup-error');
            if (!username || username.length < 3) { errEl.textContent = 'Username must be 3+ characters'; return; }
            if (!email.includes('@')) { errEl.textContent = 'Enter a valid email'; return; }
            if (password.length < 4) { errEl.textContent = 'Password must be 4+ characters'; return; }
            const users = app.auth.getUsers();
            if (users.find(u => u.username === username)) { errEl.textContent = 'Username taken'; return; }
            const newUser = {
                username, email, password: btoa(password), // Basic obfuscation
                joinedDate: new Date().toISOString(),
                totalXP: 0, streak: 0, lastActiveDate: null, hearts: 5,
                lessonsCompleted: 0, perfectScores: 0, topicsCompleted: 0,
                dailyChallenges: 0, achievements: [], completedTopics: [],
                topicStats: {}, // { topicName: { attempts, correct, wrong, bestScore } }
                soundEnabled: true
            };
            users.push(newUser);
            app.auth.saveUsers(users);
            app.currentUser = newUser;
            localStorage.setItem('sf_current_user', JSON.stringify(newUser));
            app.auth.onLogin();
        },
        login() {
            const username = document.getElementById('login-username').value.trim();
            const password = document.getElementById('login-password').value;
            const errEl = document.getElementById('login-error');
            if (!username || !password) { errEl.textContent = 'Fill in all fields'; return; }
            const users = app.auth.getUsers();
            const user = users.find(u => u.username === username && u.password === btoa(password));
            if (!user) { errEl.textContent = 'Invalid username or password'; return; }
            app.currentUser = user;
            localStorage.setItem('sf_current_user', JSON.stringify(user));
            app.auth.onLogin();
        },
        onLogin() {
            document.getElementById('auth-screen').classList.add('hidden');
            document.getElementById('app-container').classList.remove('hidden');
            app.game.updateStreak();
            app.ui.goToDashboard();
            app.ui.updateNavStats();
        },
        logout() {
            app.currentUser = null;
            localStorage.removeItem('sf_current_user');
            document.getElementById('app-container').classList.add('hidden');
            document.getElementById('auth-screen').classList.remove('hidden');
            // Clear form fields
            document.querySelectorAll('#auth-screen input').forEach(i => i.value = '');
            document.querySelectorAll('.auth-error').forEach(e => e.textContent = '');
            app.ui.showLogin();
        },
        saveProgress() {
            if (!app.currentUser) return;
            const users = app.auth.getUsers();
            const idx = users.findIndex(u => u.username === app.currentUser.username);
            if (idx !== -1) users[idx] = app.currentUser;
            app.auth.saveUsers(users);
            localStorage.setItem('sf_current_user', JSON.stringify(app.currentUser));
        }
    },

    // ════════════════════════════════════
    // GAME STATE MODULE
    // VIVA NOTE: Manages XP, levels, streaks, hearts
    // ════════════════════════════════════
    game: {
        addXP(amount) {
            const oldLevel = getLevelInfo(app.currentUser.totalXP).level;
            app.currentUser.totalXP += amount;
            const newLevel = getLevelInfo(app.currentUser.totalXP).level;
            app.auth.saveProgress();
            app.ui.updateNavStats();
            if (newLevel > oldLevel) {
                app.ui.showToast(`🎉 Level Up! You're now Level ${newLevel}!`, 'xp');
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
            const today = new Date().toDateString();
            const last = app.currentUser.lastActiveDate;
            if (last === today) return; // Already counted today
            const yesterday = new Date(Date.now() - 86400000).toDateString();
            if (last === yesterday) {
                app.currentUser.streak++;
            } else if (last !== today) {
                app.currentUser.streak = 1; // Reset or first day
            }
            app.currentUser.lastActiveDate = today;
            app.auth.saveProgress();
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
            // Check if all topics done
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

    // ════════════════════════════════════
    // COURSE MODULE (NPTEL-Style)
    // VIVA NOTE: Groups topics into courses
    // ════════════════════════════════════
    courses: {
        getAll() {
            const allTopics = [...new Set(app.data.map(q => q.Topic))];
            const courses = [];
            const assigned = new Set();
            // Map known courses
            Object.entries(COURSE_MAP).forEach(([name, info]) => {
                const matchedTopics = info.topics.filter(t => allTopics.includes(t));
                const uniqueTopics = [...new Set(matchedTopics)];
                if (uniqueTopics.length > 0) {
                    courses.push({ name, ...info, topics: uniqueTopics });
                    uniqueTopics.forEach(t => assigned.add(t));
                }
            });
            // Collect unassigned topics
            const other = allTopics.filter(t => !assigned.has(t));
            if (other.length > 0) {
                courses.push({ name: "Other Topics", icon: "📝", color: "#A855F7", description: "Additional practice", topics: other });
            }
            return courses;
        },
        getProgress(courseName) {
            const course = app.courses.getAll().find(c => c.name === courseName);
            if (!course) return 0;
            const completed = course.topics.filter(t => app.currentUser.completedTopics.includes(t)).length;
            return Math.round((completed / course.topics.length) * 100);
        },
        getTopicState(topic) {
            // VIVA NOTE: Determines if a topic is locked/available/completed
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

    // ════════════════════════════════════
    // SOUND MODULE
    // VIVA NOTE: Web Audio API for feedback sounds
    // ════════════════════════════════════
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
            app.ui.showToast(app.currentUser.soundEnabled ? '🔊 Sound On' : '🔇 Sound Off', 'info');
        }
    },

    // ════════════════════════════════════
    // CONFETTI MODULE
    // ════════════════════════════════════
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

// Attach event listeners after DOM loads
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('login-btn').addEventListener('click', () => app.auth.login());
    document.getElementById('signup-btn').addEventListener('click', () => app.auth.signup());
    // Enter key support
    document.getElementById('login-password').addEventListener('keydown', e => { if (e.key === 'Enter') app.auth.login(); });
    document.getElementById('signup-password').addEventListener('keydown', e => { if (e.key === 'Enter') app.auth.signup(); });
    // Drag and drop
    const zone = document.getElementById('upload-zone');
    if (zone) {
        zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('dragover'); });
        zone.addEventListener('dragleave', () => zone.classList.remove('dragover'));
        zone.addEventListener('drop', e => { e.preventDefault(); zone.classList.remove('dragover');
            const file = e.dataTransfer.files[0]; if (file) app.excel.processFile(file);
        });
    }
});
