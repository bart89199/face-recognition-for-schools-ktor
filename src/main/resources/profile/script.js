// script.js (панель профиля + управление сессиями + отображение оставшегося времени)

(() => {
    // ==== DOM ====
    const form = document.getElementById('profileForm');
    const inputName = document.getElementById('name');
    const inputEmail = document.getElementById('email');
    const inputPassword = document.getElementById('password');
    const btnSave = document.getElementById('saveBtn');
    const btnReset = document.getElementById('resetBtn');

    const errBox = document.getElementById('err');
    const okBox = document.getElementById('ok');

    const sessionsBody = document.getElementById('sessionsBody');
    const sessionsCount = document.getElementById('sessionsCount');
    const btnReloadSessions = document.getElementById('reloadSessions');
    const btnDeleteAllSessions = document.getElementById('deleteAllSessions');

    const currentSessionExpireBanner = document.getElementById('currentSessionExpire');
    const currentSessionRemainingSpan = document.getElementById('currentSessionRemaining');

    // ==== STATE ====
    let originalProfile = null;
    let loadingProfile = false;
    let savingProfile = false;
    let currentSessionId = null;
    let currentSessionExpiresAtMs = null;
    let loadingSessions = false;
    let countdownInterval = null;

    // Keep raw sessions for countdown updates
    let sessionsCache = [];

    // ==== UTIL ====
    function showError(msg) {
        if (!msg) return;
        errBox.textContent = msg;
        errBox.classList.add('show');
        okBox.classList.remove('show');
    }
    function showSuccess(msg) {
        if (!msg) return;
        okBox.textContent = msg;
        okBox.classList.add('show');
        errBox.classList.remove('show');
    }
    function clearMessages() {
        errBox.classList.remove('show');
        okBox.classList.remove('show');
    }
    function isoToLocalString(ts) {
        let date;
        if (typeof ts === 'number') {
            if (ts < 3_000_000_000) date = new Date(ts * 1000);
            else date = new Date(ts);
        } else {
            date = new Date(ts);
        }
        if (isNaN(date.getTime())) return '-';
        return date.toLocaleString();
    }
    function booleanText(v) {
        return v ? 'Да' : 'Нет';
    }
    function sanitize(text) {
        if (text == null) return '';
        return String(text).replace(/[&<>"']/g, ch => ({
            '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
        }[ch]));
    }
    function disable(el, state) {
        if (!el) return;
        el.disabled = !!state;
    }

    function withButtonSpinner(btn, fn) {
        const originalHTML = btn.innerHTML;
        btn.innerHTML = '<span class="spinner"></span>';
        btn.disabled = true;
        return fn().finally(() => {
            btn.innerHTML = originalHTML;
            btn.disabled = false;
        });
    }

    function toMs(epochMaybeSeconds) {
        if (epochMaybeSeconds == null) return null;
        if (epochMaybeSeconds < 3_000_000_000) return epochMaybeSeconds * 1000;
        return epochMaybeSeconds;
    }

    function formatDuration(ms) {
        if (ms <= 0) return '0с';
        const sec = Math.floor(ms / 1000);
        const d = Math.floor(sec / 86400);
        const h = Math.floor((sec % 86400) / 3600);
        const m = Math.floor((sec % 3600) / 60);
        const s = sec % 60;
        if (d > 0) return `${d}д ${h}ч`;
        if (h > 0) return `${h}ч ${m}м`;
        if (m > 0) return `${m}м ${s}с`;
        return `${s}с`;
    }

    function classifyRemaining(ms) {
        if (ms <= 0) return 'time-expired';
        if (ms <= 120_000) return 'time-very-soon';
        if (ms <= 600_000) return 'time-soon';
        return '';
    }

    // ==== PROFILE ====
    async function loadProfile() {
        if (loadingProfile) return;
        loadingProfile = true;
        try {
            const resp = await fetch('/api/user/profile', { method: 'GET' });
            if (resp.status === 401) {
                location.href = '/login';
                return;
            }
            if (!resp.ok) {
                showError('Не удалось загрузить профиль');
                return;
            }
            const data = await resp.json();
            originalProfile = data;
            inputName.value = data.name || '';
            inputEmail.value = data.email || '';
            inputPassword.value = '';
        } catch (e) {
            console.error(e);
            showError('Ошибка сети при загрузке профиля');
        } finally {
            loadingProfile = false;
        }
    }

    async function saveProfile() {
        if (savingProfile) return;
        clearMessages();
        const name = inputName.value.trim();
        const password = inputPassword.value.trim();
        if (!name) {
            showError('Имя не может быть пустым');
            return;
        }
        const payload = { name };
        if (password.length > 0) payload.password = password;

        savingProfile = true;
        disable(btnSave, true);

        try {
            const resp = await fetch('/api/user/profile', {
                method: 'PUT',
                headers: { 'Content-Type':'application/json' },
                body: JSON.stringify(payload)
            });
            if (resp.status === 401) {
                location.reload();
                return;
            }
            if (!resp.ok) {
                const txt = await resp.text();
                showError('Не удалось сохранить профиль: ' + (txt || resp.status));
                return;
            }
            showSuccess('Профиль сохранён');
            inputPassword.value = '';
            originalProfile = { ...originalProfile, name };
        } catch (e) {
            console.error(e);
            showError('Ошибка сети при сохранении');
        } finally {
            savingProfile = false;
            disable(btnSave, false);
        }
    }

    function resetProfileForm() {
        clearMessages();
        if (!originalProfile) return;
        inputName.value = originalProfile.name || '';
        inputPassword.value = '';
    }

    // ==== SESSIONS ====
    async function loadCurrentSession() {
        try {
            const resp = await fetch('/api/user/sessions/current');
            if (resp.status === 401) {
                location.href = '/login';
                return;
            }
            if (!resp.ok) return;
            const data = await resp.json();
            if (data) {
                if (typeof data.id !== 'undefined') currentSessionId = data.id;
                currentSessionExpiresAtMs = toMs(data.expiresAt);
            }
            updateCurrentSessionBanner();
        } catch (e) {
            console.warn('Не удалось получить текущую сессию', e);
        }
    }

    async function loadSessions() {
        if (loadingSessions) return;
        loadingSessions = true;
        try {
            const resp = await fetch('/api/user/sessions');
            if (resp.status === 401) {
                location.href = '/login';
                return;
            }
            if (!resp.ok) {
                showError('Не удалось загрузить список сессий');
                return;
            }
            const list = await resp.json();
            sessionsCache = Array.isArray(list) ? list : [];
            renderSessions(sessionsCache);
        } catch (e) {
            console.error(e);
            showError('Ошибка сети при загрузке сессий');
        } finally {
            loadingSessions = false;
        }
    }

    function renderSessions(list) {
        sessionsBody.innerHTML = '';
        if (!Array.isArray(list) || list.length === 0) {
            sessionsBody.innerHTML = `<tr><td colspan="6" style="padding:14px; text-align:center; color:#64748b;">Сессий нет</td></tr>`;
            sessionsCount.textContent = 'Сессий: 0';
            return;
        }
        const frag = document.createDocumentFragment();

        list.forEach(s => {
            const tr = document.createElement('tr');
            const isCurrent = currentSessionId != null && s.id === currentSessionId;
            if (isCurrent) tr.classList.add('current-session');

            const loginTime = s?.requestData?.login_time;
            const ip = s?.requestData?.ip;
            const ua = s?.requestData?.user_agent;
            const expiresAtMs = toMs(s.expiresAt);

            tr.dataset.sessionId = s.id;
            tr.dataset.expiresAtMs = expiresAtMs ?? '';

            const tdTime = document.createElement('td');
            tdTime.textContent = isoToLocalString(loginTime);

            const tdUA = document.createElement('td');
            tdUA.innerHTML = (isCurrent ? '<span class="current-badge">ТЕКУЩАЯ</span>' : '') + `<span>${sanitize(ua || '')}</span>`;

            const tdIP = document.createElement('td');
            tdIP.textContent = ip || '-';

            const tdGoogle = document.createElement('td');
            tdGoogle.textContent = booleanText(s.googleLogin);

            const tdRemaining = document.createElement('td');
            tdRemaining.className = 'time-remaining';
            tdRemaining.textContent = '...';

            const tdActions = document.createElement('td');
            tdActions.style.whiteSpace = 'nowrap';

            const delBtn = document.createElement('button');
            delBtn.type = 'button';
            delBtn.className = 'outline danger';
            delBtn.style.fontSize = '.6rem';
            delBtn.style.padding = '5px 8px';
            delBtn.textContent = 'Удалить';
            delBtn.dataset.sessionId = s.id;

            delBtn.addEventListener('click', () => {
                deleteSingleSession(s.id, isCurrent);
            });

            tdActions.appendChild(delBtn);

            tr.appendChild(tdTime);
            tr.appendChild(tdUA);
            tr.appendChild(tdIP);
            tr.appendChild(tdGoogle);
            tr.appendChild(tdRemaining);
            tr.appendChild(tdActions);
            frag.appendChild(tr);
        });

        sessionsBody.appendChild(frag);
        sessionsCount.textContent = 'Сессий: ' + list.length;

        // После рендера обновить таймеры
        updateAllRemaining(); // моментально показать
        restartCountdown();
    }

    async function deleteSingleSession(id, isCurrent) {
        clearMessages();
        if (typeof id === 'undefined' || id === null) {
            showError('ID сессии отсутствует');
            return;
        }
        if (!confirm('Удалить выбранную сессию?')) return;
        try {
            const resp = await fetch('/api/user/sessions/' + encodeURIComponent(id), { method: 'DELETE' });
            if (resp.status === 401) {
                location.reload();
                return;
            }
            if (resp.status === 204) {
                if (isCurrent) {
                    location.reload();
                    return;
                }
                showSuccess('Сессия удалена');
                await reloadSessionsFlow();
            } else {
                const txt = await resp.text();
                showError('Не удалось удалить сессию: ' + (txt || resp.status));
            }
        } catch (e) {
            console.error(e);
            showError('Ошибка сети при удалении');
        }
    }

    async function deleteAllSessions() {
        clearMessages();
        if (!confirm('Удалить все активные сессии? (Текущая тоже будет завершена)')) return;
        try {
            const resp = await fetch('/api/user/sessions', { method: 'DELETE' });
            if (resp.status === 401) {
                location.reload();
                return;
            }
            if (resp.status === 204) {
                location.reload();
            } else {
                const txt = await resp.text();
                showError('Не удалось удалить все сессии: ' + (txt || resp.status));
            }
        } catch (e) {
            console.error(e);
            showError('Ошибка сети при удалении всех сессий');
        }
    }

    async function reloadSessionsFlow() {
        await loadCurrentSession();
        await loadSessions();
    }

    // ==== COUNTDOWN ====
    function updateAllRemaining() {
        const now = Date.now();
        const rows = sessionsBody.querySelectorAll('tr');
        rows.forEach(row => {
            const cell = row.querySelector('.time-remaining');
            if (!cell) return;
            const exp = parseInt(row.dataset.expiresAtMs || '', 10);
            if (!exp) {
                cell.textContent = '-';
                cell.className = 'time-remaining';
                return;
            }
            const diff = exp - now;
            const cls = classifyRemaining(diff);
            cell.className = 'time-remaining ' + cls;
            cell.textContent = diff <= 0 ? 'Истекла' : formatDuration(diff);
        });
        // Обновить баннер текущей сессии
        updateCurrentSessionBanner();
    }

    function restartCountdown() {
        if (countdownInterval) clearInterval(countdownInterval);
        countdownInterval = setInterval(updateAllRemaining, 1000);
    }

    function updateCurrentSessionBanner() {
        if (!currentSessionExpiresAtMs) {
            currentSessionExpireBanner?.classList.remove('show');
            return;
        }
        const diff = currentSessionExpiresAtMs - Date.now();
        if (diff <= 0) {
            currentSessionExpireBanner.classList.add('show');
            currentSessionRemainingSpan.textContent = 'истекла';
            currentSessionRemainingSpan.className = 'time-expired';
            return;
        }
        currentSessionExpireBanner.classList.add('show');
        currentSessionRemainingSpan.textContent = formatDuration(diff);
        const cls = classifyRemaining(diff);
        currentSessionRemainingSpan.className = 'time-remaining ' + cls;
    }

    // ==== EVENTS ====
    form?.addEventListener('submit', e => {
        e.preventDefault();
        saveProfile();
    });

    btnReset?.addEventListener('click', () => {
        resetProfileForm();
        clearMessages();
    });

    btnReloadSessions?.addEventListener('click', () => {
        withButtonSpinner(btnReloadSessions, async () => {
            clearMessages();
            await reloadSessionsFlow();
        });
    });

    btnDeleteAllSessions?.addEventListener('click', () => {
        withButtonSpinner(btnDeleteAllSessions, async () => {
            await deleteAllSessions();
        });
    });

    // ==== INIT ====
    (async function init() {
        await loadProfile();
        await reloadSessionsFlow();
    })();

    // Safety: clear interval on unload
    window.addEventListener('beforeunload', () => {
        if (countdownInterval) clearInterval(countdownInterval);
    });

})();