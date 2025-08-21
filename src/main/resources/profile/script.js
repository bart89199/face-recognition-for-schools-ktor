// script.js (панель профиля + управление сессиями с поддержкой id)

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

    // ==== STATE ====
    let originalProfile = null;
    let loadingProfile = false;
    let savingProfile = false;
    let currentSessionId = null;
    let loadingSessions = false;

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
        // ts может быть number (ms) или строка
        let date;
        if (typeof ts === 'number') {
            // Определим секунды или миллисекунды
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

    // ==== PROFILE ====
    async function loadProfile() {
        if (loadingProfile) return;
        loadingProfile = true;
        try {
            // Предполагаемый эндпоинт. Если у вас другой (например /api/user/me) — замените.
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
            // Предполагаемый PUT эндпоинт
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
            // Обновить оригинал
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
                // неавторизован => редирект
                location.href = '/login';
                return;
            }
            if (!resp.ok) {
                // тихо: не критично
                return;
            }
            const data = await resp.json();
            if (data && typeof data.id !== 'undefined') {
                currentSessionId = data.id;
            }
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
            renderSessions(list);
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
            sessionsBody.innerHTML = `<tr><td colspan="5" style="padding:14px; text-align:center; color:#64748b;">Сессий нет</td></tr>`;
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

            const tdTime = document.createElement('td');
            tdTime.textContent = isoToLocalString(loginTime);

            const tdUA = document.createElement('td');
            tdUA.innerHTML = (isCurrent ? '<span class="current-badge">ТЕКУЩАЯ</span>' : '') + `<span>${sanitize(ua || '')}</span>`;

            const tdIP = document.createElement('td');
            tdIP.textContent = ip || '-';

            const tdGoogle = document.createElement('td');
            tdGoogle.textContent = booleanText(s.googleLogin);

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
            tr.appendChild(tdActions);
            frag.appendChild(tr);
        });

        sessionsBody.appendChild(frag);
        sessionsCount.textContent = 'Сессий: ' + list.length;
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
                    // Текущая — страница перезагрузится и приведёт к редиректу
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
        await loadCurrentSession(); // может измениться после операций
        await loadSessions();
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

})();