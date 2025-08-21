(function() {
    const userApiRoot = '/auth/manage/user';
    const sessionApiRoot = '/auth/manage/session';
    const currentUserApi = '/api/user';

    // DOM
    const errBox = document.getElementById('err');
    const okBox = document.getElementById('ok');
    const usersTableBody = document.querySelector('#usersTable tbody');
    const sessionsTableBody = document.querySelector('#sessionsTable tbody');
    const countInfo = document.getElementById('countInfo');
    const rootCheckbox = document.getElementById('rootFlag');
    const sessionsPanel = document.getElementById('sessionsPanel');
    const sessionsInfo = document.getElementById('sessionsInfo');
    const sessionsTable = document.getElementById('sessionsTable');
    const sessionsEmpty = document.getElementById('sessionsEmpty');
    const refreshSessionsBtn = document.getElementById('refreshSessionsBtn');
    const deleteUserSessionsBtn = document.getElementById('deleteUserSessionsBtn');
    const deleteAllSessionsBtn = document.getElementById('deleteAllSessionsBtn');
    const selectedUserTag = document.getElementById('selectedUserTag');
    const selectedUserName = document.getElementById('selectedUserName');

    // Form
    const saveBtn = document.getElementById('saveBtn');
    const resetBtn = document.getElementById('resetBtn');
    const editIdInput = document.getElementById('editId');
    const nameInput = document.getElementById('name');
    const emailInput = document.getElementById('email');
    const passwordInput = document.getElementById('password');

    // Search
    const filterNameInput = document.getElementById('filterName');
    const filterEmailInput = document.getElementById('filterEmail');
    const searchNameBtn = document.getElementById('searchNameBtn');
    const searchEmailBtn = document.getElementById('searchEmailBtn');
    const showAllBtn = document.getElementById('showAllBtn');

    let isCurrentRoot = false;
    let currentSelectedUserId = null;

    // Permissions
    const permDescriptions = {
        stream: 'Просмотр видео',
        door_control: 'Управление дверью',
        status: 'Статус системы',
        logs: 'Просмотр логов',
        records: 'Записи',
        manual: 'Ручные операции',
        settings: 'Настройки',
        backup: 'Резервное копирование',
        access_control: 'Управление доступом',
        admin: 'Админ (full)'
    };
    const permKeys = Object.keys(permDescriptions);

    function buildPermissionsGrid() {
        const grid = document.getElementById('permGrid');
        grid.innerHTML = '';
        permKeys.forEach(k => {
            const label = document.createElement('label');
            label.className = 'perm-item';
            const cb = document.createElement('input');
            cb.type = 'checkbox';
            cb.id = 'perm_'+k;
            cb.dataset.key = k;
            const span = document.createElement('span');
            span.textContent = permDescriptions[k];
            label.appendChild(cb);
            label.appendChild(span);
            grid.appendChild(label);
        });
    }
    buildPermissionsGrid();

    function getPermsFromForm() {
        const perms = {};
        permKeys.forEach(k => perms[k] = document.getElementById('perm_'+k).checked);
        return perms;
    }

    function fillPerms(perms) {
        permKeys.forEach(k => {
            const el = document.getElementById('perm_'+k);
            if (el) el.checked = !!(perms && perms[k]);
        });
    }

    // Messages
    function clearMessages() {
        errBox.classList.remove('show');
        okBox.classList.remove('show');
        errBox.textContent='';
        okBox.textContent='';
    }
    function showError(m) { clearMessages(); errBox.textContent = m; errBox.classList.add('show'); }
    function showOk(m) { clearMessages(); okBox.textContent = m; okBox.classList.add('show'); }

    // Fetch helper
    async function fetchJSON(url, opts={}) {
        const res = await fetch(url, {
            credentials:'include',
            headers:{ 'Content-Type':'application/json', ...(opts.headers||{}) },
            ...opts
        });
        if (res.status === 204) return null;
        if (!res.ok) {
            const txt = await res.text().catch(()=> '');
            if (res.status === 403) throw new Error(txt || 'Недостаточно прав');
            if (res.status === 404) throw new Error('HTTP 404');
            throw new Error(txt || ('HTTP '+res.status));
        }
        try { return await res.json(); } catch { return null; }
    }

    async function loadCurrentUser() {
        try {
            const me = await fetchJSON(currentUserApi);
            if (me) {
                isCurrentRoot = !!me.root;
                updateRootCheckboxState();
            }
        } catch (_) {}
    }

    function updateRootCheckboxState() {
        if (!isCurrentRoot) {
            rootCheckbox.disabled = true;
            rootCheckbox.title = 'Только root может изменять этот флаг';
        } else {
            rootCheckbox.disabled = false;
            rootCheckbox.title = '';
        }
    }

    // Users
    async function loadAllUsers() {
        try {
            const data = await fetchJSON(userApiRoot);
            renderUsersTable(data||[]);
            showCount(data?.length||0);
        } catch (e) {
            showError('Не удалось загрузить пользователей: '+e.message);
        }
    }

    function showCount(n) { countInfo.textContent = 'Всего: '+n; }

    async function searchByName() {
        const name = filterNameInput.value.trim();
        if (!name) { showError('Введите имя для поиска'); return; }
        try {
            const users = await fetchJSON(userApiRoot+'/findByName/'+encodeURIComponent(name));
            renderUsersTable(users||[]);
            showCount(users?.length||0);
            if (!users || !users.length) showError('Ничего не найдено по имени'); else clearMessages();
        } catch (e) {
            renderUsersTable([]);
            showCount(0);
            showError(e.message);
        }
    }

    async function searchByEmail() {
        const email = filterEmailInput.value.trim();
        if (!email) { showError('Введите email для поиска'); return; }
        try {
            const user = await fetchJSON(userApiRoot+'/byEmail/'+encodeURIComponent(email));
            renderUsersTable([user]);
            showCount(1);
            clearMessages();
            return;
        } catch (eExact) {
            if (!/404/.test(eExact.message)) {
                showError(eExact.message);
                return;
            }
        }
        try {
            const users = await fetchJSON(userApiRoot+'/findByEmail/'+encodeURIComponent(email));
            renderUsersTable(users||[]);
            showCount(users?.length||0);
            if (!users || !users.length) showError('Ничего не найдено по email'); else clearMessages();
        } catch (e) {
            renderUsersTable([]);
            showCount(0);
            showError(e.message);
        }
    }

    function escapeHtml(s) {
        return (s||'').toString().replace(/[&<>"']/g, c => ({
            '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
        }[c]));
    }

    function renderPermBadges(perms) {
        if (!perms) return '';
        return permKeys.filter(k => perms[k])
            .map(k => `<span class="badge" title="${permDescriptions[k]}">${k.replace(/_/g,'-')}</span>`)
            .join(' ');
    }

    function renderUsersTable(users) {
        usersTableBody.innerHTML = '';
        users.forEach(u => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td class="nowrap">${u.id}</td>
                <td class="truncate" title="${escapeHtml(u.name)}">${escapeHtml(u.name)}</td>
                <td class="truncate" title="${escapeHtml(u.email)}">${escapeHtml(u.email)}</td>
                <td>${u.root ? '<span class="badge badge-root" title="root">root</span>' : ''}</td>
                <td>${renderPermBadges(u.permissions)}</td>
                <td class="row-actions">
                    <button type="button" class="outline" data-edit="${u.id}">Ред.</button>
                    <button type="button" class="outline" data-sessions="${u.id}">Сессии</button>
                    <button type="button" class="danger outline" data-del="${u.id}">Удалить</button>
                </td>
            `;
            usersTableBody.appendChild(tr);
        });
    }

    usersTableBody.addEventListener('click', async e => {
        const btn = e.target.closest('button');
        if (!btn) return;
        const editId = btn.dataset.edit;
        const delId = btn.dataset.del;
        const sessId = btn.dataset.sessions;

        if (editId) {
            try {
                const user = await fetchJSON(`${userApiRoot}/${editId}`);
                fillFormForEdit(user);
                selectUser(user.id, user.name);
            } catch (err) {
                showError(err.message);
            }
        } else if (sessId) {
            selectUser(parseInt(sessId,10));
            await loadUserSessions(sessId);
        } else if (delId) {
            if (!confirm('Удалить пользователя '+delId+'?')) return;
            try {
                const res = await fetch(`${userApiRoot}/${delId}`, { method:'DELETE', credentials:'include' });
                if (!res.ok) {
                    const txt = await res.text().catch(()=> '');
                    if (res.status === 403) {
                        showError('Недостаточно прав');
                    } else {
                        showError(txt || ('Ошибка удаления '+res.status));
                    }
                    return;
                }
                showOk('Удалено');
                if (currentSelectedUserId == delId) clearSessionsPanel();
                await loadAllUsers();
                if (editIdInput.value === delId) resetForm();
            } catch (err) {
                showError(err.message);
            }
        }
    });

    function fillFormForEdit(user) {
        editIdInput.value = user.id;
        nameInput.value = user.name;
        emailInput.value = user.email;
        passwordInput.value = '';
        rootCheckbox.checked = !!user.root;
        fillPerms(user.permissions || {});
        saveBtn.textContent = 'Обновить';
        clearMessages();
    }

    function resetForm() {
        editIdInput.value = '';
        nameInput.value = '';
        emailInput.value = '';
        passwordInput.value = '';
        rootCheckbox.checked = false;
        fillPerms({});
        saveBtn.textContent = 'Создать';
        updateRootCheckboxState();
    }

    resetBtn.addEventListener('click', () => { resetForm(); clearMessages(); });

    searchNameBtn.addEventListener('click', searchByName);
    searchEmailBtn.addEventListener('click', searchByEmail);
    showAllBtn.addEventListener('click', () => {
        filterNameInput.value='';
        filterEmailInput.value='';
        clearMessages();
        loadAllUsers();
    });

    // --------- Sessions ---------
    function markSessionsPanelLoading(loading) {
        sessionsPanel.classList.toggle('sessions-panel-loading', loading);
    }

    function clearSessionsPanel() {
        currentSelectedUserId = null;
        sessionsTableBody.innerHTML = '';
        sessionsTable.style.display = 'none';
        sessionsEmpty.style.display = 'none';
        sessionsInfo.textContent = 'Выберите пользователя';
        refreshSessionsBtn.disabled = true;
        deleteUserSessionsBtn.disabled = true;
        selectedUserTag.hidden = true;
        selectedUserName.textContent = '';
    }

    function selectUser(id, name) {
        currentSelectedUserId = parseInt(id,10);
        if (name) {
            selectedUserTag.hidden = false;
            selectedUserName.textContent = name;
        }
        sessionsInfo.textContent = 'Загрузка сессий...';
        refreshSessionsBtn.disabled = false;
        deleteUserSessionsBtn.disabled = false;
    }

    async function loadUserSessions(userId = currentSelectedUserId) {
        if (!userId) {
            clearSessionsPanel();
            return;
        }
        markSessionsPanelLoading(true);
        try {
            const data = await fetchJSON(`${userApiRoot}/${userId}/sessions`);
            renderSessions(data || []);
        } catch (e) {
            sessionsTableBody.innerHTML = '';
            sessionsTable.style.display = 'none';
            sessionsEmpty.style.display = 'none';
            showError(e.message);
            sessionsInfo.textContent = 'Ошибка загрузки';
        } finally {
            markSessionsPanelLoading(false);
        }
    }

    function renderSessions(sessions) {
        sessionsTableBody.innerHTML = '';
        if (!sessions.length) {
            sessionsTable.style.display = 'none';
            sessionsEmpty.style.display = 'block';
            sessionsInfo.textContent = 'Нет активных сессий';
            return;
        }
        sessionsTable.style.display = '';
        sessionsEmpty.style.display = 'none';
        sessionsInfo.textContent = `Активных сессий: ${sessions.length}`;

        sessions.forEach(s => {
            // backend теперь стабилен: s.requestData.login_time, s.requestData.ip, s.requestData.user_agent
            const loginTs = s.requestData?.login_time;
            const expiresTs = s.expiresAt;
            const relative = formatRemaining(expiresTs);
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td class="nowrap">${s.id}</td>
                <td class="truncate" title="${formatDateTime(loginTs)}">${formatShortDateTime(loginTs)}</td>
                <td class="truncate" title="${escapeHtml(s.requestData?.ip || '')}">${escapeHtml(s.requestData?.ip || '')}</td>
                <td class="truncate-wide" title="${escapeHtml(s.requestData?.user_agent||'')}">${escapeHtml((s.requestData?.user_agent||'').substring(0,140))}</td>
                <td class="truncate" title="Истекает: ${formatDateTime(expiresTs)}">${relative}</td>
                <td>${s.googleLogin ? '<span class="badge badge-google" title="Google OAuth">G</span>' : ''}</td>
                <td class="row-actions">
                    <button type="button" class="danger outline small-btn" data-del-session="${s.id}">Удалить</button>
                </td>
            `;
            sessionsTableBody.appendChild(tr);
        });
    }

    sessionsTableBody.addEventListener('click', async e => {
        const btn = e.target.closest('button[data-del-session]');
        if (!btn) return;
        const sid = btn.dataset.delSession;
        if (!confirm('Удалить сессию '+sid+'?')) return;
        try {
            const res = await fetch(`${sessionApiRoot}/${sid}`, { method:'DELETE', credentials:'include' });
            if (!res.ok) {
                const txt = await res.text().catch(()=> '');
                if (res.status === 403) showError('Недостаточно прав');
                else showError(txt || ('Ошибка удаления сессии '+res.status));
                return;
            }
            showOk('Сессия удалена');
            await loadUserSessions();
        } catch (err) {
            showError(err.message);
        }
    });

    refreshSessionsBtn.addEventListener('click', () => loadUserSessions());

    deleteUserSessionsBtn.addEventListener('click', async () => {
        if (!currentSelectedUserId) return;
        if (!confirm('Удалить ВСЕ сессии пользователя '+currentSelectedUserId+'?')) return;
        try {
            markSessionsPanelLoading(true);
            const res = await fetch(`${userApiRoot}/${currentSelectedUserId}/sessions`, {
                method:'DELETE',
                credentials:'include'
            });
            if (!res.ok) {
                const txt = await res.text().catch(()=> '');
                if (res.status === 403) showError('Недостаточно прав');
                else showError(txt || ('Ошибка удаления сессий пользователя ('+res.status+')'));
                return;
            }
            showOk('Все сессии пользователя удалены');
            await loadUserSessions();
        } catch (e) {
            showError(e.message);
        } finally {
            markSessionsPanelLoading(false);
        }
    });

    deleteAllSessionsBtn.addEventListener('click', async () => {
        if (!confirm('Удалить АБСОЛЮТНО все сессии (всех пользователей)?')) return;
        try {
            markSessionsPanelLoading(true);
            const sessions = await fetchJSON(sessionApiRoot) || [];
            for (const s of sessions) {
                try {
                    await fetch(`${sessionApiRoot}/${s.id}`, { method:'DELETE', credentials:'include' });
                } catch {}
            }
            showOk('Все сессии удалены');
            if (currentSelectedUserId) await loadUserSessions();
        } catch (e) {
            showError(e.message);
        } finally {
            markSessionsPanelLoading(false);
        }
    });

    // Date / time formatting
    function formatDateTime(ts) {
        if (!ts) return '';
        const d = new Date(ts);
        return d.toLocaleString('ru-RU', {
            day:'2-digit', month:'2-digit', year:'numeric',
            hour:'2-digit', minute:'2-digit', second:'2-digit'
        });
    }
    function formatShortDateTime(ts) {
        if (!ts) return '';
        const d = new Date(ts);
        return d.toLocaleString('ru-RU', {
            day:'2-digit', month:'2-digit',
            hour:'2-digit', minute:'2-digit'
        });
    }

    // Новое отображение "осталось"
    function formatRemaining(ts) {
        if (!ts) return '';
        const diff = ts - Date.now();
        const past = diff < 0;
        const abs = Math.abs(diff);

        const SEC = 1000;
        const MIN = 60 * SEC;
        const H = 60 * MIN;
        const D = 24 * H;

        let text;
        if (abs < MIN) {
            text = '<1 мин';
        } else if (abs < H) {
            const m = Math.round(abs / MIN);
            text = m + ' м';
        } else if (abs < D) {
            const h = Math.floor(abs / H);
            const m = Math.round((abs % H) / MIN);
            text = h + ' ч' + (m ? ' ' + m + ' м' : '');
        } else {
            const d = Math.floor(abs / D);
            const h = Math.round((abs % D) / H);
            text = d + ' д' + (h ? ' ' + h + ' ч' : '');
        }

        return past ? ('просрочена ' + text) : ('осталось ' + text);
    }

    // Save user
    document.getElementById('userForm').addEventListener('submit', async e => {
        e.preventDefault();
        clearMessages();
        const id = editIdInput.value;
        const name = nameInput.value.trim();
        const email = emailInput.value.trim();
        const password = passwordInput.value;
        const rootFlag = rootCheckbox.checked;

        if (!name || !email) {
            showError('Имя и email обязательны');
            return;
        }
        if (!id && !password) {
            showError('Пароль обязателен при создании пользователя');
            return;
        }
        const perms = getPermsFromForm();
        const originalText = saveBtn.textContent;
        saveBtn.disabled = true;
        saveBtn.innerHTML = '<div class="spinner"></div>';

        try {
            if (id) {
                const payload = { name, email, permissions: perms, root: rootFlag };
                if (password) payload.password = password;
                const res = await fetch(`${userApiRoot}/${id}`, {
                    method:'PUT', credentials:'include',
                    headers:{'Content-Type':'application/json'},
                    body: JSON.stringify(payload)
                });
                if (res.status === 204) {
                    showOk('Обновлено');
                    await loadAllUsers();
                    if (currentSelectedUserId == id) await loadUserSessions();
                } else {
                    const txt = await res.text().catch(()=> '');
                    if (res.status === 403) showError('Недостаточно прав');
                    else showError(txt || ('Ошибка обновления ('+res.status+')'));
                }
            } else {
                const payload = { name, email, password, permissions: perms, root: rootFlag };
                const res = await fetch(userApiRoot, {
                    method:'POST', credentials:'include',
                    headers:{'Content-Type':'application/json'},
                    body: JSON.stringify(payload)
                });
                if (res.ok) {
                    const newId = await res.text().catch(()=> '');
                    showOk('Создан пользователь ID '+newId);
                    resetForm();
                    await loadAllUsers();
                } else {
                    const txt = await res.text().catch(()=> '');
                    if (res.status === 403) showError('Недостаточно прав');
                    else showError(txt || ('Не удалось создать ('+res.status+')'));
                }
            }
        } catch (err) {
            showError(err.message);
        } finally {
            saveBtn.disabled = false;
            saveBtn.textContent = originalText;
        }
    });

    // Init
    (async function init() {
        await loadCurrentUser();
        await loadAllUsers();
        clearSessionsPanel();
    })();
})();