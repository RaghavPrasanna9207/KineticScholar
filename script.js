/* ============================================
   KINETIC SCHOLAR - Quiz, UI, Excel, Daily, Leaderboard
   VIVA NOTE: This file extends the app object from
   engine.js with quiz logic, UI rendering, Excel
   import/export, daily challenges, and leaderboard.
   ============================================ */

// ------------------------------------
// QUIZ ENGINE
// VIVA NOTE: Preserves original answer validation
// logic (answer_key normalization). Adds hearts,
// XP rewards, and difficulty tagging on top.
// ------------------------------------
app.quiz = {
    questions: [],
    currentIndex: 0,
    score: 0,
    answered: false,
    sessionXP: 0,
    wrongQuestions: [],
    currentTopic: null,
    isDaily: false,
    timerInterval: null,
    timerSeconds: 0,
    timerPerQuestion: false,
    questionStartTime: 0,

    start(topic, isDaily = false) {
        this.isDaily = isDaily;
        this.currentTopic = topic;
        // Filter and shuffle — ORIGINAL LOGIC PRESERVED
        if (isDaily) {
            this.questions = [...app.data].sort(() => 0.5 - Math.random()).slice(0, 10);
        } else {
            this.questions = app.data.filter(q => q.Topic === topic).sort(() => 0.5 - Math.random());
        }
        if (this.questions.length === 0) { app.ui.showToast('No questions found for this topic', 'error'); return; }
        // Limit to 15 questions max per session
        this.questions = this.questions.slice(0, 15);
        this.currentIndex = 0;
        this.score = 0;
        this.sessionXP = 0;
        this.answered = false;
        this.wrongQuestions = [];
        // Reset hearts for this session
        app.game.resetHearts();
        app.ui.switchView('quiz-view');
        this.renderHearts();
        this.renderQuestion();
        // Start timer
        this.timerSeconds = 0;
        clearInterval(this.timerInterval);
        if (isDaily) {
            document.getElementById('quiz-timer').classList.remove('hidden');
            this.timerInterval = setInterval(() => { this.timerSeconds++; this.updateTimer(); }, 1000);
        } else {
            document.getElementById('quiz-timer').classList.add('hidden');
            this.timerInterval = setInterval(() => { this.timerSeconds++; }, 1000);
        }
        this.questionStartTime = Date.now();
    },

    startReview(wrongList) {
        this.questions = wrongList;
        this.currentTopic = 'Review';
        this.isDaily = false;
        this.currentIndex = 0; this.score = 0; this.sessionXP = 0;
        this.answered = false; this.wrongQuestions = [];
        app.game.resetHearts();
        app.ui.switchView('quiz-view');
        this.renderHearts();
        this.renderQuestion();
        this.timerSeconds = 0;
        document.getElementById('quiz-timer').classList.add('hidden');
        clearInterval(this.timerInterval);
        this.timerInterval = setInterval(() => { this.timerSeconds++; }, 1000);
    },

    renderQuestion() {
        const q = this.questions[this.currentIndex];
        this.answered = false;
        this.questionStartTime = Date.now();
        // Progress
        const pct = ((this.currentIndex) / this.questions.length) * 100;
        document.getElementById('quiz-progress-fill').style.width = pct + '%';
        // Meta
        document.getElementById('quiz-topic-badge').textContent = q.Topic;
        document.getElementById('quiz-q-number').textContent = `${this.currentIndex + 1} / ${this.questions.length}`;
        // Difficulty (auto-tagged by solution length)
        const diff = this.getDifficulty(q);
        const diffEl = document.getElementById('quiz-difficulty');
        diffEl.textContent = diff.toUpperCase();
        diffEl.className = 'difficulty-badge ' + diff;
        // Question text
        document.getElementById('quiz-question-text').textContent = q.Question_Text;
        // Options — ORIGINAL LOGIC: render choice_1 through choice_4
        const optContainer = document.getElementById('quiz-options');
        optContainer.innerHTML = '';
        const labels = ['A', 'B', 'C', 'D'];
        for (let i = 1; i <= 4; i++) {
            const key = `choice_${i}`;
            const btn = document.createElement('button');
            btn.className = 'option-btn';
            btn.innerHTML = `<span class="option-label">${labels[i-1]}</span><span class="option-text">${q[key]}</span>`;
            btn.dataset.key = key;
            btn.addEventListener('click', () => this.handleAnswer(key, btn));
            optContainer.appendChild(btn);
        }
        // Hide solution
        document.getElementById('quiz-solution').classList.add('hidden');
        // Button text
        const nextBtn = document.getElementById('quiz-next-btn');
        nextBtn.textContent = this.currentIndex === this.questions.length - 1 ? 'Finish' : 'Continue';
        nextBtn.disabled = true;
        nextBtn.style.opacity = '0.5';
    },

    // VIVA NOTE: getDifficulty auto-tags questions based on solution complexity
    getDifficulty(q) {
        const solLen = (q.Solution || '').length;
        if (solLen < 50) return 'easy';
        if (solLen < 200) return 'medium';
        return 'hard';
    },

    handleAnswer(selectedKey, btnElement) {
        if (this.answered) return;
        this.answered = true;
        const q = this.questions[this.currentIndex];
        // ORIGINAL LOGIC PRESERVED: Normalize answer_key
        const answerVal = q.answer_key;
        const correctKey = String(answerVal).startsWith('choice_')
            ? answerVal : `choice_${answerVal}`;
        const isCorrect = selectedKey === correctKey;
        const allBtns = document.querySelectorAll('#quiz-options .option-btn');
        allBtns.forEach(b => b.disabled = true);
        if (isCorrect) {
            btnElement.classList.add('correct');
            this.score++;
            const xpGain = this.isDaily ? 20 : 10;
            this.sessionXP += xpGain;
            app.sound.play('correct');
            app.ui.showXPPopup(`+${xpGain} XP`);
        } else {
            btnElement.classList.add('wrong');
            const correctBtn = [...allBtns].find(b => b.dataset.key === correctKey);
            if (correctBtn) correctBtn.classList.add('correct');
            this.wrongQuestions.push(q);
            app.game.loseHeart();
            this.renderHearts();
            app.sound.play('wrong');
            // Check game over
            if (app.currentUser.hearts <= 0) {
                setTimeout(() => this.finishQuiz(), 1200);
            }
        }
        // Show solution
        const solBox = document.getElementById('quiz-solution');
        const solText = document.getElementById('quiz-solution-text');
        solText.textContent = q.Solution || 'No solution provided.';
        solBox.classList.remove('hidden');
        // Enable next button
        const nextBtn = document.getElementById('quiz-next-btn');
        nextBtn.disabled = false;
        nextBtn.style.opacity = '1';
    },

    next() {
        if (!this.answered) return;
        if (this.currentIndex >= this.questions.length - 1 || app.currentUser.hearts <= 0) {
            this.finishQuiz();
        } else {
            this.currentIndex++;
            this.renderQuestion();
        }
    },

    finishQuiz() {
        clearInterval(this.timerInterval);
        const total = Math.min(this.currentIndex + 1, this.questions.length);
        const pct = Math.round((this.score / total) * 100);
        // Completion bonus
        if (this.currentIndex >= this.questions.length - 1) {
            this.sessionXP += 50; // Topic completion bonus
        }
        // Perfect score bonus
        if (pct === 100 && total >= 3) {
            this.sessionXP += 30;
            app.currentUser.perfectScores = (app.currentUser.perfectScores || 0) + 1;
        }
        // Apply XP
        app.game.addXP(this.sessionXP);
        app.currentUser.lessonsCompleted = (app.currentUser.lessonsCompleted || 0) + 1;
        // Record topic stats — ORIGINAL per-topic tracking
        if (this.currentTopic && this.currentTopic !== 'Review') {
            app.game.recordTopicStats(this.currentTopic, this.score, total);
            // Mark topic as completed if score >= 70%
            if (pct >= 70 && !app.currentUser.completedTopics.includes(this.currentTopic)) {
                app.currentUser.completedTopics.push(this.currentTopic);
                app.currentUser.topicsCompleted = app.currentUser.completedTopics.length;
            }
        }
        if (this.isDaily) {
            app.currentUser.dailyChallenges = (app.currentUser.dailyChallenges || 0) + 1;
        }
        app.auth.saveProgress();
        app.api.request('/users/quiz-attempts', {
            method: 'POST',
            body: JSON.stringify({
                topic: this.currentTopic,
                score: this.score,
                total,
                percentage: pct,
                durationSeconds: this.timerSeconds,
                isDaily: this.isDaily,
            }),
        }).catch(() => {});
        // Check achievements
        const newAchievements = app.game.checkAchievements();
        // Render results
        this.renderResults(pct, total, newAchievements);
    },

    renderResults(pct, total, achievements) {
        app.ui.switchView('results-view');
        // Emoji & title
        let emoji = '??', title = 'Keep Trying!', sub = 'Practice makes perfect';
        if (pct >= 90) { emoji = '??'; title = 'Outstanding!'; sub = 'You nailed it!'; }
        else if (pct >= 70) { emoji = '??'; title = 'Great Job!'; sub = 'Solid performance!'; }
        else if (pct >= 50) { emoji = '??'; title = 'Not Bad!'; sub = 'Room to improve'; }
        document.getElementById('results-emoji').textContent = emoji;
        document.getElementById('results-title').textContent = title;
        document.getElementById('results-subtitle').textContent = sub;
        // Score ring animation
        const circumference = 2 * Math.PI * 52; // r=52
        const offset = circumference - (pct / 100) * circumference;
        const ring = document.getElementById('score-ring-fill');
        ring.style.strokeDasharray = circumference;
        setTimeout(() => { ring.style.strokeDashoffset = offset; }, 100);
        document.getElementById('results-score').textContent = pct + '%';
        // XP
        document.getElementById('results-xp').textContent = `+${this.sessionXP} XP`;
        // Stats
        document.getElementById('results-correct').textContent = this.score;
        document.getElementById('results-wrong').textContent = total - this.score;
        document.getElementById('results-time').textContent = this.formatTime(this.timerSeconds);
        // Achievements
        const achContainer = document.getElementById('results-achievements');
        achContainer.innerHTML = '';
        achievements.forEach(a => {
            achContainer.innerHTML += `<div class="achievement-unlock">
                <span class="badge-icon">${a.icon}</span>
                <div class="badge-info"><h4>${a.name}</h4><p>${a.desc}</p></div>
            </div>`;
        });
        // Confetti for high scores
        if (pct >= 80) app.confetti.fire();
        app.ui.updateNavStats();
    },

    reviewWrong() {
        if (this.wrongQuestions.length === 0) {
            app.ui.showToast('No wrong answers to review!', 'info');
            return;
        }
        this.startReview([...this.wrongQuestions]);
    },

    retry() {
        if (this.currentTopic && this.currentTopic !== 'Review') {
            this.start(this.currentTopic, this.isDaily);
        } else {
            app.ui.goToDashboard();
        }
    },

    confirmQuit() {
        app.ui.showModal('Quit Lesson?', 'Your progress in this lesson will be lost.',
            () => { clearInterval(this.timerInterval); app.ui.goToDashboard(); });
    },

    renderHearts() {
        const container = document.getElementById('quiz-hearts');
        container.innerHTML = '';
        for (let i = 0; i < 5; i++) {
            const span = document.createElement('span');
            span.className = 'heart-icon' + (i >= app.currentUser.hearts ? ' lost' : '');
            span.textContent = '<3';
            container.appendChild(span);
        }
    },

    updateTimer() {
        const el = document.getElementById('quiz-timer');
        el.textContent = this.formatTime(this.timerSeconds);
        if (this.timerSeconds > 300) el.classList.add('warning');
    },

    formatTime(s) {
        return `${Math.floor(s/60).toString().padStart(2,'0')}:${(s%60).toString().padStart(2,'0')}`;
    }
};

// ------------------------------------
// DAILY CHALLENGE MODULE
// ------------------------------------
app.daily = {
    async start() {
        try {
            const status = await app.api.request('/daily/status');
            if (status.completedToday) {
                app.ui.showToast('Daily challenge already completed! Come back tomorrow.', 'info');
                return;
            }
            app.quiz.start(null, true);
            await app.api.request('/daily/complete', { method: 'POST' });
            app.currentUser.lastDailyDate = new Date().toISOString().slice(0, 10);
            app.auth.saveProgress();
        } catch (err) {
            app.ui.showToast(err.message || 'Could not start daily challenge', 'error');
        }
    }
};

// ------------------------------------
// LEADERBOARD MODULE
// ------------------------------------
app.leaderboard = {
    async render() {
        const container = document.getElementById('leaderboard-list');
        let sorted = [];
        try {
            const payload = await app.api.request('/leaderboard');
            sorted = payload.users || [];
        } catch (_err) {
            container.innerHTML = '<p class="text-muted" style="text-align:center;padding:40px;">Could not load leaderboard.</p>';
            return;
        }
        container.innerHTML = '';
        if (sorted.length === 0) { container.innerHTML = '<p class="text-muted" style="text-align:center;padding:40px;">No learners yet!</p>'; return; }
        sorted.forEach((u, i) => {
            const isCurrent = u.username === app.currentUser?.username;
            const lvl = getLevelInfo(u.totalXP || 0);
            container.innerHTML += `<div class="lb-entry${isCurrent ? ' current-user' : ''}">
                <span class="lb-rank">${i + 1}</span>
                <span class="lb-avatar">${(u.username || '?')[0].toUpperCase()}</span>
                <div class="lb-info">
                    <div class="lb-name">${u.username}${isCurrent ? ' (You)' : ''}</div>
                    <div class="lb-level">Level ${lvl.level} · Streak ${u.streak || 0}</div>
                </div>
                <span class="lb-xp">XP ${u.totalXP || 0}</span>
            </div>`;
        });
    }
};

// ------------------------------------
// EXCEL MODULE (SheetJS)
// VIVA NOTE: Import questions from Excel/CSV
// and export analytics to Excel.
// ------------------------------------
app.excel = {
    pendingData: null,

    handleFile(event) {
        const file = event.target.files[0];
        if (file) this.processFile(file);
    },

    processFile(file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, { type: 'array' });
                const sheet = workbook.Sheets[workbook.SheetNames[0]];
                const json = XLSX.utils.sheet_to_json(sheet);
                // Validate required columns
                const required = ['Question_Text', 'choice_1', 'choice_2', 'choice_3', 'choice_4', 'answer_key', 'Topic'];
                const cols = Object.keys(json[0] || {});
                const missing = required.filter(r => !cols.includes(r));
                if (missing.length) {
                    app.ui.showToast(`Missing columns: ${missing.join(', ')}`, 'error');
                    return;
                }
                this.pendingData = json.map(row => ({
                    Question_Text: String(row.Question_Text || ''),
                    choice_1: String(row.choice_1 || ''), choice_2: String(row.choice_2 || ''),
                    choice_3: String(row.choice_3 || ''), choice_4: String(row.choice_4 || ''),
                    answer_key: Number(row.answer_key) || 1,
                    Solution: String(row.Solution || '-'),
                    Topic: String(row.Topic || 'General')
                }));
                // Show preview
                document.getElementById('upload-info').classList.remove('hidden');
                document.getElementById('upload-file-name').textContent = file.name;
                document.getElementById('upload-file-meta').textContent = `${this.pendingData.length} questions found`;
                this.renderPreview();
                document.getElementById('upload-actions').classList.remove('hidden');
                document.getElementById('upload-actions').style.display = 'flex';
                app.ui.showToast(`?? ${this.pendingData.length} questions loaded from ${file.name}`, 'success');
            } catch (err) {
                app.ui.showToast('Error reading file: ' + err.message, 'error');
            }
        };
        reader.readAsArrayBuffer(file);
    },

    renderPreview() {
        const tbody = document.getElementById('preview-tbody');
        tbody.innerHTML = '';
        const preview = document.getElementById('upload-preview');
        preview.classList.remove('hidden');
        (this.pendingData || []).slice(0, 5).forEach(q => {
            tbody.innerHTML += `<tr>
                <td>${q.Topic}</td>
                <td>${q.Question_Text.substring(0, 60)}...</td>
                <td>${q.choice_1}, ${q.choice_2}...</td>
                <td>${q.answer_key}</td>
            </tr>`;
        });
    },

    async importQuestions() {
        if (!this.pendingData || this.pendingData.length === 0) return;
        try {
            const payload = await app.api.request('/questions/import', {
                method: 'POST',
                body: JSON.stringify({ questions: this.pendingData }),
            });
            app.importedData = [...app.importedData, ...this.pendingData];
            app.data = [...app.data, ...this.pendingData];
            app.ui.showToast(`Imported ${payload.inserted || this.pendingData.length} questions!`, 'success');
            this.cancelImport();
        } catch (err) {
            app.ui.showToast(err.message || 'Failed to import questions', 'error');
        }
    },

    cancelImport() {
        this.pendingData = null;
        document.getElementById('upload-info').classList.add('hidden');
        document.getElementById('upload-preview').classList.add('hidden');
        document.getElementById('upload-actions').classList.add('hidden');
        document.getElementById('file-input').value = '';
    },

    // VIVA NOTE: Export analytics report to Excel using SheetJS
    exportReport() {
        if (!app.currentUser) return;
        const stats = app.currentUser.topicStats || {};
        const rows = Object.entries(stats).map(([topic, s]) => ({
            Topic: topic,
            Attempts: s.attempts,
            'Correct Answers': s.correct,
            'Wrong Answers': s.wrong,
            'Accuracy %': s.attempts > 0 ? Math.round((s.correct / (s.correct + s.wrong)) * 100) : 0,
            'Best Score %': s.bestScore
        }));
        if (rows.length === 0) { app.ui.showToast('No performance data to export yet!', 'info'); return; }
        // Summary row
        const totalCorrect = rows.reduce((a, r) => a + r['Correct Answers'], 0);
        const totalWrong = rows.reduce((a, r) => a + r['Wrong Answers'], 0);
        rows.push({
            Topic: 'TOTAL', Attempts: rows.reduce((a, r) => a + r.Attempts, 0),
            'Correct Answers': totalCorrect, 'Wrong Answers': totalWrong,
            'Accuracy %': Math.round((totalCorrect / (totalCorrect + totalWrong)) * 100),
            'Best Score %': '-'
        });
        const ws = XLSX.utils.json_to_sheet(rows);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Performance');
        // User info sheet
        const infoRows = [
            { Field: 'Username', Value: app.currentUser.username },
            { Field: 'Total XP', Value: app.currentUser.totalXP },
            { Field: 'Level', Value: getLevelInfo(app.currentUser.totalXP).level },
            { Field: 'Streak', Value: app.currentUser.streak },
            { Field: 'Lessons Completed', Value: app.currentUser.lessonsCompleted },
            { Field: 'Topics Completed', Value: app.currentUser.completedTopics.length },
            { Field: 'Export Date', Value: new Date().toLocaleString() }
        ];
        const ws2 = XLSX.utils.json_to_sheet(infoRows);
        XLSX.utils.book_append_sheet(wb, ws2, 'User Info');
        XLSX.writeFile(wb, `KineticScholar_Report_${app.currentUser.username}.xlsx`);
        app.ui.showToast('?? Report exported!', 'success');
    }
};

// ------------------------------------
// UI CONTROLLER
// ------------------------------------
app.ui = {
    currentView: 'dashboard',

    switchView(viewId) {
        document.querySelectorAll('.view-section').forEach(v => v.classList.add('hidden'));
        const target = document.getElementById(viewId);
        if (target) { target.classList.remove('hidden'); target.style.animation = 'none'; target.offsetHeight; target.style.animation = ''; }
    },

    switchTab(tab) {
        document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll(`.nav-tab[data-tab="${tab}"]`).forEach(b => b.classList.add('active'));
        this.currentView = tab;
        // Close mobile sidebar on navigation
        document.getElementById('sidebar')?.classList.remove('open');
        if (tab === 'dashboard') this.goToDashboard();
        else if (tab === 'courses') this.renderCoursesPage();
        else if (tab === 'leaderboard') { this.switchView('leaderboard-view'); app.leaderboard.render(); }
        else if (tab === 'upload') this.switchView('upload-view');
        else if (tab === 'profile') this.renderProfile();
    },

    toggleSidebar() {
        document.getElementById('sidebar')?.classList.toggle('open');
    },

    toggleTheme() {
        const html = document.documentElement;
        const isDark = html.getAttribute('data-theme') === 'dark';
        html.setAttribute('data-theme', isDark ? 'light' : 'dark');
        const icon = document.getElementById('theme-icon');
        if (icon) icon.textContent = isDark ? 'dark_mode' : 'light_mode';
        localStorage.setItem('sf_theme', isDark ? 'light' : 'dark');
    },

    initTheme() {
        const saved = localStorage.getItem('sf_theme');
        if (saved === 'dark') {
            document.documentElement.setAttribute('data-theme', 'dark');
            const icon = document.getElementById('theme-icon');
            if (icon) icon.textContent = 'light_mode';
        }
    },

    goToDashboard() {
        this.switchView('dashboard-view');
        this.renderDashboard();
        document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
        const btn = document.querySelector('.nav-tab[data-tab="dashboard"]');
        if (btn) btn.classList.add('active');
    },

    renderDashboard() {
        const u = app.currentUser;
        if (!u) return;
        // Welcome banner
        document.getElementById('welcome-msg').textContent = `Keep it up, ${u.username}!`;
        const lvl = getLevelInfo(u.totalXP);
        const xpToNext = lvl.nextThreshold - u.totalXP;
        document.getElementById('hero-sub').textContent = `You're only ${xpToNext} XP away from reaching Level ${lvl.level + 1}.`;
        document.getElementById('level-badge').textContent = `Level ${lvl.level}`;
        document.getElementById('level-xp-text').textContent = `${u.totalXP} / ${lvl.nextThreshold} XP`;
        document.getElementById('level-progress-fill').style.width = lvl.progress + '%';
        // Stats
        document.getElementById('stat-total-xp').textContent = u.totalXP;
        document.getElementById('stat-streak').textContent = u.streak;
        document.getElementById('stat-completed').textContent = (u.completedTopics || []).length;
        // Streak display
        const streakEl = document.getElementById('streak-display');
        if (streakEl) streakEl.textContent = `${u.streak} days ??`;
        // Daily challenge status
        const today = new Date().toISOString().slice(0, 10);
        document.getElementById('daily-status').textContent = u.lastDailyDate === today
            ? 'Completed today!' : 'Mixed topics - test your knowledge!';
        // Courses
        this.renderCourses();
        // Dashboard achievements
        this.renderDashboardAchievements();
    },

    renderDashboardAchievements() {
        const container = document.getElementById('dashboard-achievements');
        if (!container) return;
        container.innerHTML = '';
        ACHIEVEMENTS.forEach(a => {
            const unlocked = (app.currentUser.achievements || []).includes(a.id);
            container.innerHTML += `<div class="ach-mini ${unlocked ? '' : 'locked'}">
                <span class="ach-icon">${a.icon}</span>
                <span class="ach-name">${a.name}</span>
            </div>`;
        });
    },

    renderCoursesPage() {
        this.switchView('courses-view');
        const grid = document.getElementById('all-courses-grid');
        if (!grid) return;
        grid.innerHTML = '';
        const courses = app.courses.getAll();
        courses.forEach(c => {
            const progress = app.courses.getProgress(c.name);
            const completed = c.topics.filter(t => (app.currentUser.completedTopics || []).includes(t)).length;
            grid.innerHTML += `<div class="course-selection-card" onclick="app.ui.openCourse('${c.name.replace(/'/g, "\\'")}')"
                style="--card-accent:${c.color}">
                <span class="cs-icon">${c.icon}</span>
                <h3>${c.name}</h3>
                <p>${c.description}</p>
                <div class="cs-progress">
                    <div class="progress-track"><div class="progress-fill" style="width:${progress}%"></div></div>
                    <div style="display:flex;justify-content:space-between;margin-top:6px;font-size:0.8rem;color:var(--on-surface-variant)">
                        <span>${completed}/${c.topics.length} topics</span><span>${progress}%</span>
                    </div>
                </div>
            </div>`;
        });
    },

    renderCourses() {
        const grid = document.getElementById('course-grid');
        grid.innerHTML = '';
        const courses = app.courses.getAll();
        courses.forEach(c => {
            const progress = app.courses.getProgress(c.name);
            const completed = c.topics.filter(t => (app.currentUser.completedTopics || []).includes(t)).length;
            grid.innerHTML += `<div class="course-card" onclick="app.ui.openCourse('${c.name}')">
                <div class="course-icon">${c.icon}</div>
                <div class="course-info">
                    <h4>${c.name}</h4>
                    <p>${c.description}</p>
                    <div class="course-progress"><div class="progress-track"><div class="progress-fill" style="width:${progress}%"></div></div></div>
                </div>
                <div class="course-meta">
                    <div class="completion">${progress}%</div>
                    <div class="topic-count">${completed}/${c.topics.length} topics</div>
                </div>
            </div>`;
        });
    },

    openCourse(courseName) {
        const courses = app.courses.getAll();
        const course = courses.find(c => c.name === courseName);
        if (!course) return;
        document.getElementById('course-title').textContent = course.icon + ' ' + course.name;
        document.getElementById('course-desc').textContent = course.description;
        // Render skill tree
        const tree = document.getElementById('skill-tree');
        tree.innerHTML = '';
        course.topics.forEach((topic, i) => {
            const state = app.courses.getTopicState(topic);
            const qCount = app.data.filter(q => q.Topic === topic).length;
            const stats = app.currentUser.topicStats?.[topic];
            // Connector (except first)
            if (i > 0) {
                const conn = document.createElement('div');
                conn.className = 'node-connector' + (state === 'completed' ? ' completed' : (state === 'available' && i > 0 && app.courses.getTopicState(course.topics[i-1]) === 'completed' ? ' completed' : ''));
                tree.appendChild(conn);
            }
            const node = document.createElement('div');
            node.className = `skill-node ${state}`;
            let icon = state === 'locked' ? '??' : (state === 'completed' ? '?' : '??');
            let crown = state === 'completed' ? '<span class="node-crown">??</span>' : '';
            let subLabel = state === 'completed' ? `Best: ${stats?.bestScore || 0}%` : `${qCount} questions`;
            node.innerHTML = `<div class="node-circle">${crown}${icon}</div>
                <div class="node-label">${topic}</div>
                <div class="node-sublabel">${subLabel}</div>`;
            if (state !== 'locked') {
                node.onclick = () => app.quiz.start(topic);
            }
            tree.appendChild(node);
        });
        this.switchView('course-view');
    },

    renderProfile() {
        this.switchView('profile-view');
        const u = app.currentUser;
        if (!u) return;
        document.getElementById('profile-avatar').textContent = u.username[0].toUpperCase();
        document.getElementById('profile-name').textContent = u.username;
        document.getElementById('profile-joined').textContent = 'Joined ' + new Date(u.joinedDate).toLocaleDateString();
        document.getElementById('profile-xp').textContent = u.totalXP;
        document.getElementById('profile-streak').textContent = u.streak;
        document.getElementById('profile-lessons').textContent = u.lessonsCompleted || 0;
        // Accuracy
        const stats = u.topicStats || {};
        let totalC = 0, totalW = 0;
        Object.values(stats).forEach(s => { totalC += s.correct; totalW += s.wrong; });
        const acc = (totalC + totalW) > 0 ? Math.round((totalC / (totalC + totalW)) * 100) : 0;
        document.getElementById('profile-accuracy').textContent = acc + '%';
        // Achievements
        const achGrid = document.getElementById('achievements-grid');
        achGrid.innerHTML = '';
        ACHIEVEMENTS.forEach(a => {
            const unlocked = (u.achievements || []).includes(a.id);
            achGrid.innerHTML += `<div class="achievement-card ${unlocked ? 'unlocked' : 'locked'}">
                <div class="ach-icon">${a.icon}</div>
                <div class="ach-name">${a.name}</div>
            </div>`;
        });
        // Topic performance
        const perfList = document.getElementById('topic-perf-list');
        perfList.innerHTML = '';
        if (Object.keys(stats).length === 0) {
            perfList.innerHTML = '<p class="text-muted" style="text-align:center;padding:20px;">Complete lessons to see analytics!</p>';
        } else {
            Object.entries(stats).forEach(([topic, s]) => {
                const accuracy = (s.correct + s.wrong) > 0 ? Math.round((s.correct / (s.correct + s.wrong)) * 100) : 0;
                perfList.innerHTML += `<div class="topic-perf-item">
                    <div class="perf-header">
                        <span class="perf-name">${topic}</span>
                        <span class="perf-accuracy">${accuracy}%</span>
                    </div>
                    <div class="progress-track"><div class="progress-fill" style="width:${accuracy}%;background:${accuracy>=70?'linear-gradient(90deg,var(--accent-primary),var(--accent-secondary))':'linear-gradient(90deg,var(--wrong-color),var(--accent-tertiary))'}"></div></div>
                </div>`;
            });
        }
    },

    updateNavStats() {
        const u = app.currentUser;
        if (!u) return;
        document.getElementById('nav-xp').textContent = u.totalXP;
        document.getElementById('nav-hearts').textContent = u.hearts;
        document.getElementById('nav-streak').textContent = u.streak;
        document.getElementById('nav-profile-btn').textContent = u.username[0].toUpperCase();
        // Sidebar profile sync
        const sAvatar = document.getElementById('sidebar-avatar');
        const sUser = document.getElementById('sidebar-username');
        const sLevel = document.getElementById('sidebar-level');
        if (sAvatar) sAvatar.textContent = u.username[0].toUpperCase();
        if (sUser) sUser.textContent = u.username;
        const lvl = getLevelInfo(u.totalXP);
        if (sLevel) sLevel.textContent = `Level ${lvl.level} Kineticist`;
    },

    showToast(msg, type = 'info') {
        const container = document.getElementById('toast-container');
        const icons = { success: '?', error: '?', info: '??', xp: '?' };
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.innerHTML = `<span class="toast-icon">${icons[type] || '??'}</span><span class="toast-msg">${msg}</span>`;
        container.appendChild(toast);
        setTimeout(() => { toast.classList.add('toast-exit'); setTimeout(() => toast.remove(), 300); }, 3000);
    },

    showXPPopup(text) {
        const popup = document.createElement('div');
        popup.className = 'xp-popup';
        popup.textContent = text;
        document.body.appendChild(popup);
        setTimeout(() => popup.remove(), 1500);
    },

    showModal(title, message, onConfirm) {
        const container = document.getElementById('modal-container');
        container.innerHTML = `<div class="modal-overlay" onclick="this.remove()">
            <div class="modal-content" onclick="event.stopPropagation()">
                <h3>${title}</h3><p>${message}</p>
                <div class="modal-actions">
                    <button class="btn btn-secondary" onclick="document.querySelector('.modal-overlay').remove()">Cancel</button>
                    <button class="btn btn-danger" id="modal-confirm-btn">Quit</button>
                </div>
            </div>
        </div>`;
        document.getElementById('modal-confirm-btn').addEventListener('click', () => {
            document.querySelector('.modal-overlay').remove();
            onConfirm();
        });
    },

    showLogin() {
        document.getElementById('login-card').classList.remove('hidden');
        document.getElementById('signup-card').classList.add('hidden');
    },

    showSignup() {
        document.getElementById('login-card').classList.add('hidden');
        document.getElementById('signup-card').classList.remove('hidden');
    },

    createParticles() {
        const container = document.getElementById('auth-particles');
        if (!container) return;
        container.innerHTML = '';
        const colors = ['#8B5CF6', '#06B6D4', '#F59E0B'];
        for (let i = 0; i < 20; i++) {
            const p = document.createElement('div');
            p.className = 'particle';
            const size = Math.random() * 8 + 4;
            p.style.cssText = `width:${size}px;height:${size}px;left:${Math.random()*100}%;background:${colors[i%3]};animation-duration:${Math.random()*15+10}s;animation-delay:${Math.random()*10}s;`;
            container.appendChild(p);
        }
    }
};

// ------------------------------------
// APP INITIALIZATION
// VIVA NOTE: Loads questions, then checks auth
// ------------------------------------
document.addEventListener('DOMContentLoaded', async () => {
    // Inject SVG gradient for score ring
    const svgNS = 'http://www.w3.org/2000/svg';
    const defs = document.createElementNS(svgNS, 'svg');
    defs.setAttribute('width', '0'); defs.setAttribute('height', '0'); defs.style.position = 'absolute';
    defs.innerHTML = `<defs><linearGradient id="scoreGradient" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stop-color="#6a1cf6"/><stop offset="100%" stop-color="#5b3fd5"/>
    </linearGradient></defs>`;
    document.body.prepend(defs);

    // Init theme
    app.ui.initTheme();

    try {
        const payload = await app.api.request('/questions');
        app.data = payload.questions || [];
        console.log('Questions loaded from backend:', app.data.length);
    } catch (err) {
        console.error('Error loading questions:', err);
    }
    // Initialize auth (checks for existing session)
    await app.auth.init();
});

