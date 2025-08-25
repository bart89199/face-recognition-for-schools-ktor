// Улучшенная версия: фильтр по активности, корректные эндпоинты, обработка redirect / не-JSON ответов.
// Исправлено: не добавляем пустой класс (classList.add('')).

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
    const sessionsFilter = document.getElementById('sessionsFilter');

    const currentSessionExpireBanner = document.getElementById('currentSessionExpire');
    const currentSessionRemainingSpan = document.getElementById('currentSessionRemaining');

    // ==== STATE ====
    let originalProfile = null;
    let savingProfile = false;

    let currentSessionId = null;
    let currentSessionExpiresAtMs = null;

    let countdownInterval = null;
    let currentFilter = 'active';

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

    function sanitize(text) {
        if (text == null) return '';
        return String(text).replace(/[&<>"']/g, ch => ({
            '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
        }[ch]));
    }
    function isoToLocalString(ts) {
        if (ts == null) return '-';
        const n = Number(ts);
        const date = (n < 3_000_000_000) ? new Date(n * 1000) : new Date(n);
        return isNaN(date.getTime()) ? '-' : date.toLocaleString();
    }
    function booleanText(v) { return v ? 'Да' : 'Нет'; }
    function disable(el, state) { if (el) el.disabled = !!state; }

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
        return ''; // пусто => не добавляем класс
    }

    function mapSessionEndpointByFilter(filter) {
        switch (filter) {
            case 'inactive': return '/api/user/sessions/not-active';
            case 'all': return '/api/user/sessions/all';
            case 'active':
            default: return '/api/user/sessions';
        }
    }

    function isJsonResponse(resp) {
        const ct = (resp.headers.get('content-type') || '').toLowerCase();
        return ct.includes('application/json');
    }

    function handlePossiblyRedirected(resp) {
        if (resp.redirected && resp.url.includes('/login')) {
            window.location = resp.url;
            return true;
        }
        if (!isJsonResponse(resp)) {
            const url = resp.url || '';
            if (url.includes('/login')) {
                window.location = url;
                return true;
            }
            window.location.reload();
            return true;
        }
        return false;
    }

    // ==== PROFILE ====
    async function loadProfile() {
        try {
            const resp = await fetch('/api/user/profile');
            if (resp.status === 401) { window.location='/login'; return; }
            if (handlePossiblyRedirected(resp)) return;
            if (!resp.ok) { showError('Не удалось загрузить профиль'); return; }
            const data = await resp.json();
            originalProfile = data;
            inputName.value = data.name || '';
            inputEmail.value = data.email || '';
            inputPassword.value = '';
        } catch {
            showError('Ошибка сети при загрузке профиля');
        }
    }

    async function saveProfile() {
        if (savingProfile) return;
        clearMessages();
        const name = inputName.value.trim();
        const password = inputPassword.value.trim();
        if (!name) { showError('Имя не может быть пустым'); return; }

        const payload = { name };
        if (password) payload.password = password;

        savingProfile = true;
        disable(btnSave, true);
        try {
            const resp = await fetch('/api/user/profile', {
                method: 'PUT',
                headers: { 'Content-Type':'application/json' },
                body: JSON.stringify(payload)
            });
            if (resp.status === 401) { window.location.reload(); return; }
            if (handlePossiblyRedirected(resp)) return;
            if (!resp.ok) {
                const txt = await resp.text();
                showError('Не удалось сохранить профиль: ' + (txt || resp.status));
                return;
            }
            showSuccess('Профиль сохранён');
            inputPassword.value = '';
            if (originalProfile) originalProfile.name = name;
        } catch {
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

    // ==== CURRENT SESSION ====
    async function loadCurrentSession() {
        try {
            const resp = await fetch('/api/user/sessions/current');
            if (resp.status === 401) { window.location='/login'; return; }
            if (handlePossiblyRedirected(resp)) return;
            if (!resp.ok) return;
            const data = await resp.json();
            if (data) {
                currentSessionId = data.id;
                currentSessionExpiresAtMs = data.active ? toMs(data.expiresAt) : null;
            }
            updateCurrentSessionBanner();
        } catch {
            // игнор
        }
    }

    // ==== SESSIONS ====
    async function loadSessions() {
        const url = mapSessionEndpointByFilter(currentFilter);
        try {
            const resp = await fetch(url);
            if (resp.status === 401) { window.location='/login'; return; }
            if (handlePossiblyRedirected(resp)) return;
            if (!resp.ok) {
                showError('Не удалось загрузить список сессий');
                renderSessions([]);
                return;
            }
            const list = await resp.json();
            renderSessions(Array.isArray(list) ? list : []);
        } catch {
            showError('Ошибка сети при загрузке сессий');
            renderSessions([]);
        }
    }

    function renderSessions(list) {
        sessionsBody.innerHTML = '';
        if (!list.length) {
            sessionsBody.innerHTML =
                `<tr><td colspan="7" style="padding:14px; text-align:center; color:#64748b;">Сессий нет</td></tr>`;
            sessionsCount.textContent = 'Сессий: 0';
            restartCountdown();
            updateCurrentSessionBanner();
            return;
        }
        const now = Date.now();
        const frag = document.createDocumentFragment();
        list.forEach(s => {
            const tr = document.createElement('tr');
            const isCurrent = currentSessionId != null && s.id === currentSessionId;
            if (isCurrent) tr.classList.add('current-session');

            const loginTime = s?.requestData?.login_time;
            const ip = s?.requestData?.ip;
            const ua = s?.requestData?.user_agent;
            const expiresAtMs = toMs(s.expiresAt);
            const isActive = !!s.active;

            tr.dataset.sessionId = s.id;
            tr.dataset.expiresAtMs = expiresAtMs ?? '';
            tr.dataset.active = String(isActive);

            const tdLogin = document.createElement('td');
            tdLogin.textContent = isoToLocalString(loginTime);

            const tdUA = document.createElement('td');
            tdUA.innerHTML = (isCurrent ? '<span class="current-badge">ТЕКУЩАЯ</span>' : '') +
                `<span>${sanitize(ua || '')}</span>`;

            const tdIP = document.createElement('td');
            tdIP.textContent = ip || '-';

            const tdActive = document.createElement('td');
            tdActive.innerHTML = isActive
                ? '<span class="badge badge-active">Да</span>'
                : '<span class="badge badge-inactive">Нет</span>';

            const tdGoogle = document.createElement('td');
            tdGoogle.textContent = booleanText(s.googleLogin);

            const tdRem = document.createElement('td');
            tdRem.className = 'time-remaining';
            if (isActive && expiresAtMs) {
                const diff = expiresAtMs - now;
                tdRem.textContent = diff <= 0 ? 'Истекла' : formatDuration(diff);
                const cls = classifyRemaining(diff);
                if (cls) tdRem.classList.add(cls); // FIX: добавляем класс только если не пустой
            } else {
                tdRem.textContent = '—';
            }

            const tdAct = document.createElement('td');
            tdAct.style.whiteSpace = 'nowrap';
            const delBtn = document.createElement('button');
            delBtn.type = 'button';
            delBtn.className = 'outline danger';
            delBtn.style.fontSize = '.6rem';
            delBtn.style.padding = '5px 8px';
            delBtn.textContent = 'Удалить';
            delBtn.addEventListener('click', () => deleteSingleSession(s.id, isCurrent));
            tdAct.appendChild(delBtn);

            tr.appendChild(tdLogin);
            tr.appendChild(tdUA);
            tr.appendChild(tdIP);
            tr.appendChild(tdActive);
            tr.appendChild(tdGoogle);
            tr.appendChild(tdRem);
            tr.appendChild(tdAct);

            frag.appendChild(tr);
        });
        sessionsBody.appendChild(frag);
        sessionsCount.textContent = 'Сессий: ' + list.length;

        updateCurrentSessionBanner();
        restartCountdown();
    }

    async function deleteSingleSession(id, isCurrent) {
        clearMessages();
        if (id == null) { showError('ID отсутствует'); return; }
        if (!confirm('Удалить (деактивировать) эту сессию?')) return;
        try {
            const resp = await fetch(`/api/user/sessions?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
            if (resp.status === 401) { window.location.reload(); return; }
            if (handlePossiblyRedirected(resp)) return;
            if (!resp.ok) {
                const txt = await resp.text().catch(()=> '');
                showError('Не удалось удалить: ' + (txt || resp.status));
                return;
            }
            if (isCurrent) {
                window.location.reload();
                return;
            }
            showSuccess('Сессия деактивирована');
            await reloadSessionsFlow();
        } catch {
            showError('Ошибка сети при удалении');
        }
    }

    async function deleteAllSessions() {
        clearMessages();
        if (!confirm('Удалить ВСЕ активные сессии? (Текущая тоже будет завершена)')) return;
        try {
            const resp = await fetch('/api/user/sessions', { method: 'DELETE' });
            if (resp.status === 401) { window.location.reload(); return; }
            if (handlePossiblyRedirected(resp)) return;
            if (!resp.ok) {
                const txt = await resp.text().catch(()=> '');
                showError('Не удалось удалить все: ' + (txt || resp.status));
                return;
            }
            window.location.reload();
        } catch {
            showError('Ошибка сети при удалении всех');
        }
    }

    async function reloadSessionsFlow() {
        await loadCurrentSession();
        await loadSessions();
    }

    // ==== COUNTDOWN ====
    function updateAllRemaining() {
        const now = Date.now();
        sessionsBody.querySelectorAll('tr').forEach(row => {
            const cell = row.querySelector('.time-remaining');
            if (!cell) return;
            const active = row.dataset.active === 'true';
            const exp = parseInt(row.dataset.expiresAtMs || '', 10);
            if (!active || !exp) {
                cell.textContent = '—';
                cell.className = 'time-remaining';
                return;
            }
            const diff = exp - now;
            const cls = classifyRemaining(diff);
            cell.className = 'time-remaining' + (cls ? (' ' + cls) : ''); // тоже безопасно
            cell.textContent = diff <= 0 ? 'Истекла' : formatDuration(diff);
        });
        updateCurrentSessionBanner();
    }

    function restartCountdown() {
        if (countdownInterval) clearInterval(countdownInterval);
        countdownInterval = setInterval(updateAllRemaining, 1000);
    }

    function updateCurrentSessionBanner() {
        if (!currentSessionExpiresAtMs) {
            currentSessionExpireBanner.classList.remove('show');
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
        const cls = classifyRemaining(diff);
        currentSessionRemainingSpan.textContent = formatDuration(diff);
        currentSessionRemainingSpan.className = 'time-remaining' + (cls ? (' ' + cls) : '');
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
    sessionsFilter?.addEventListener('change', async () => {
        currentFilter = sessionsFilter.value;
        clearMessages();
        await loadSessions();
    });

    // ==== INIT ====
    (async function init() {
        await loadProfile();
        await reloadSessionsFlow();
    })();

    window.addEventListener('beforeunload', () => {
        if (countdownInterval) clearInterval(countdownInterval);
    });
})();