(function() {
    // Updated API roots per new paths
    const userApiRoot = '/api/manage/user';
    const sessionApiRoot = '/api/manage/session';
    const currentUserApi = '/api/user/profile';

    // Global DOM
    const errBox = document.getElementById('err');
    const okBox = document.getElementById('ok');

    // Tabs
    const tabButtons = Array.from(document.querySelectorAll('.tab-btn'));
    const tabPanels = Array.from(document.querySelectorAll('.tab-panel'));
    function activateTab(id) {
        tabButtons.forEach(b => b.classList.toggle('active', b.dataset.tab === id));
        tabPanels.forEach(p => p.classList.toggle('active', p.id === id));
    }
    tabButtons.forEach(btn => btn.addEventListener('click', () => {
        activateTab(btn.dataset.tab);
        clearMessages();
    }));

    // Users tab elements
    const usersTableBody = document.querySelector('#usersTable tbody');
    const countInfo = document.getElementById('countInfo');
    const selectedUserTag = document.getElementById('selectedUserTag');
    const selectedUserName = document.getElementById('selectedUserName');
    const selectedUserIdSpan = document.getElementById('selectedUserId');

    const filterNameInput = document.getElementById('filterName');
    const filterEmailInput = document.getElementById('filterEmail');
    const searchNameBtn = document.getElementById('searchNameBtn');
    const searchEmailBtn = document.getElementById('searchEmailBtn');
    const showAllBtn = document.getElementById('showAllBtn');
    const goCreateBtn = document.getElementById('goCreateBtn');

    // Edit tab elements
    const editIdInput = document.getElementById('editId');
    const showIdInput = document.getElementById('showId');
    const nameInput = document.getElementById('name');
    const emailInput = document.getElementById('email');
    const passwordInput = document.getElementById('password');
    const rootCheckbox = document.getElementById('rootFlag');
    const permGrid = document.getElementById('permGrid');
    const userForm = document.getElementById('userForm');
    const saveBtn = document.getElementById('saveBtn');
    const resetBtn = document.getElementById('resetBtn');
    const backToUsersBtn = document.getElementById('backToUsersBtn');
    const formTitle = document.getElementById('formTitle');

    // User sessions tab elements
    const userSessionsTable = document.getElementById('userSessionsTable');
    const userSessionsTableBody = userSessionsTable.querySelector('tbody');
    const userSessionsInfo = document.getElementById('userSessionsInfo');
    const userSessionsEmpty = document.getElementById('userSessionsEmpty');
    const userSessionsFilter = document.getElementById('userSessionsFilter');
    const refreshUserSessionsBtn = document.getElementById('refreshUserSessionsBtn');
    const deleteUserSessionsBtn = document.getElementById('deleteUserSessionsBtn');

    // All sessions tab elements
    const allSessionsTableBody = document.querySelector('#allSessionsTable tbody');
    const allSessionsFilter = document.getElementById('allSessionsFilter');
    const refreshAllSessionsBtn = document.getElementById('refreshAllSessionsBtn');
    const deleteAllSessionsBtn = document.getElementById('deleteAllSessionsBtn');
    const allSessionsCount = document.getElementById('allSessionsCount');

    // State
    let isCurrentRoot = false;
    let currentSelectedUserId = null;
    let currentSelectedUserName = null;

    // Permissions descriptors (RU labels)
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
        admin: 'Администратор'
    };
    const permKeys = Object.keys(permDescriptions);

    function buildPermissionsGrid() {
        permGrid.innerHTML = '';
        permKeys.forEach(k => {
            const label = document.createElement('label');
            label.className = 'perm-item';
            const cb = document.createElement('input');
            cb.type = 'checkbox';
            cb.id = 'perm_'+k;
            cb.dataset.key = k;
            const span = document.createElement('span');
            span.textContent = permDescriptions[k];
            cb.addEventListener('change', () => {
                label.classList.toggle('checked', cb.checked);
            });
            label.appendChild(cb);
            label.appendChild(span);
            permGrid.appendChild(label);
        });
    }
    buildPermissionsGrid();

    function syncCheckedClasses() {
        permKeys.forEach(k => {
            const cb = document.getElementById('perm_'+k);
            if (cb) cb.parentElement.classList.toggle('checked', cb.checked);
        });
    }

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
        syncCheckedClasses();
    }

    // Messages
    function clearMessages() {
        errBox.classList.remove('show');
        okBox.classList.remove('show');
        errBox.textContent='';
        okBox.textContent='';
    }
    function showError(m) {
        clearMessages();
        errBox.textContent = m;
        errBox.classList.add('show');
    }
    function showOk(m) {
        clearMessages();
        okBox.textContent = m;
        okBox.classList.add('show');
    }

    // Fetch JSON helper
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
            rootCheckbox.title = 'Изменение root-статуса доступно';
        }
    }

    // USERS
    async function loadAllUsers() {
        try {
            const data = await fetchJSON(userApiRoot);
            renderUsersTable(data||[]);
            showCount(data?.length||0);
        } catch (e) {
            showError('Не удалось загрузить пользователей: '+e.message);
        }
    }
    function showCount(n) { countInfo.textContent = 'Всего пользователей: '+n; }

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
        // exact
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
        // like
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
        return permKeys
            .filter(k => perms[k])
            .map(k => `<span class="badge" title="${escapeHtml(permDescriptions[k])}">${escapeHtml(permDescriptions[k])}</span>`)
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
                activateTab('tab-edit');
            } catch (err) {
                showError(err.message);
            }
        } else if (sessId) {
            selectUser(parseInt(sessId,10));
            activateTab('tab-user-sessions');
            await loadUserSessions();
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
                if (currentSelectedUserId == delId) clearUserSelection();
                await loadAllUsers();
                if (editIdInput.value === delId) resetForm();
            } catch (err) {
                showError(err.message);
            }
        }
    });

    function fillFormForEdit(user) {
        formTitle.textContent = `Редактировать пользователя ${user.email} (id = ${user.id})`;
        editIdInput.value = user.id;
        showIdInput.value = user.id;
        nameInput.value = user.name;
        emailInput.value = user.email;
        passwordInput.value = '';
        rootCheckbox.checked = !!user.root;
        fillPerms(user.permissions || {});
        saveBtn.textContent = 'Обновить';
        updateRootCheckboxState();
        clearMessages();
    }

    function resetForm() {
        formTitle.textContent = 'Создать пользователя';
        editIdInput.value = '';
        showIdInput.value = '';
        nameInput.value = '';
        emailInput.value = '';
        passwordInput.value = '';
        rootCheckbox.checked = false;
        fillPerms({});
        saveBtn.textContent = 'Создать';
        updateRootCheckboxState();
    }

    function selectUser(id, name) {
        currentSelectedUserId = id;
        currentSelectedUserName = name || currentSelectedUserName;
        selectedUserTag.hidden = false;
        selectedUserName.textContent = currentSelectedUserName || '';
        selectedUserIdSpan.textContent = currentSelectedUserId;
        refreshUserSessionsBtn.disabled = false;
        deleteUserSessionsBtn.disabled = false;
    }

    function clearUserSelection() {
        currentSelectedUserId = null;
        currentSelectedUserName = null;
        selectedUserTag.hidden = true;
        selectedUserName.textContent = '';
        selectedUserIdSpan.textContent = '';
        refreshUserSessionsBtn.disabled = true;
        deleteUserSessionsBtn.disabled = true;
        userSessionsInfo.textContent = 'Выберите пользователя во вкладке "Пользователи".';
        userSessionsTable.style.display = 'none';
        userSessionsEmpty.style.display = 'none';
        userSessionsTableBody.innerHTML = '';
    }

    resetBtn.addEventListener('click', () => { resetForm(); clearMessages(); });
    backToUsersBtn.addEventListener('click', () => { activateTab('tab-users'); });
    goCreateBtn.addEventListener('click', () => { resetForm(); activateTab('tab-edit'); });

    searchNameBtn.addEventListener('click', searchByName);
    searchEmailBtn.addEventListener('click', searchByEmail);
    showAllBtn.addEventListener('click', () => {
        filterNameInput.value='';
        filterEmailInput.value='';
        clearMessages();
        loadAllUsers();
    });

    // USER SESSIONS
    userSessionsFilter.addEventListener('change', () => {
        if (currentSelectedUserId) loadUserSessions();
    });
    refreshUserSessionsBtn.addEventListener('click', () => {
        if (currentSelectedUserId) loadUserSessions();
    });

    async function loadUserSessions() {
        if (!currentSelectedUserId) {
            userSessionsInfo.textContent = 'Пользователь не выбран.';
            return;
        }
        userSessionsInfo.textContent = 'Загрузка...';
        const filterVal = userSessionsFilter.value;
        let url = `${userApiRoot}/${currentSelectedUserId}/sessions`;
        if (filterVal === 'active') url += '?active=true';
        else if (filterVal === 'inactive') url += '?active=false';

        try {
            const data = await fetchJSON(url);
            renderUserSessions(data || []);
        } catch (e) {
            showError(e.message);
            userSessionsInfo.textContent = 'Ошибка';
        }
    }

    function renderUserSessions(sessions) {
        userSessionsTableBody.innerHTML = '';
        if (!sessions.length) {
            userSessionsTable.style.display = 'none';
            userSessionsEmpty.style.display = 'block';
            userSessionsInfo.textContent = 'Сессий нет';
            return;
        }
        userSessionsTable.style.display = '';
        userSessionsEmpty.style.display = 'none';
        userSessionsInfo.textContent = `Сессий: ${sessions.length}`;

        sessions.forEach(s => {
            const tr = document.createElement('tr');
            const activeBadge = s.active
                ? '<span class="badge badge-active">Да</span>'
                : '<span class="badge badge-inactive">Нет</span>';
            const loginTs = s.requestData?.login_time;
            const expiresTs = s.expiresAt;
            tr.innerHTML = `
                <td>${s.id}</td>
                <td>${activeBadge}</td>
                <td class="truncate" title="${formatDateTime(loginTs)}">${formatShortDateTime(loginTs)}</td>
                <td class="truncate" title="${escapeHtml(s.requestData?.ip || '')}">${escapeHtml(s.requestData?.ip || '')}</td>
                <td class="truncate-wide" title="${escapeHtml(s.requestData?.user_agent||'')}">${escapeHtml((s.requestData?.user_agent||'').substring(0,140))}</td>
                <td class="truncate" title="Истекает: ${formatDateTime(expiresTs)}">${formatRemaining(expiresTs)}</td>
                <td>${s.googleLogin ? '<span class="badge badge-google" title="Google OAuth">G</span>' : ''}</td>
                <td class="row-actions">
                    ${s.active ? `<button type="button" class="danger outline small-btn" data-del-session="${s.id}">Удалить</button>` : ''}
                </td>
            `;
            userSessionsTableBody.appendChild(tr);
        });
    }

    userSessionsTableBody.addEventListener('click', async e => {
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

    deleteUserSessionsBtn.addEventListener('click', async () => {
        if (!currentSelectedUserId) return;
        if (!confirm('Удалить ВСЕ активные сессии пользователя '+currentSelectedUserId+'?')) return;
        try {
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
            showOk('Все сессии пользователя деактивированы');
            await loadUserSessions();
        } catch (e) {
            showError(e.message);
        }
    });

    // ALL SESSIONS
    allSessionsFilter.addEventListener('change', loadAllSessions);
    refreshAllSessionsBtn.addEventListener('click', loadAllSessions);

    async function loadAllSessions() {
        const filterVal = allSessionsFilter.value;
        let url = `${sessionApiRoot}`;
        if (filterVal === 'active') url += '?active=true';
        else if (filterVal === 'inactive') url += '?active=false';
        try {
            const data = await fetchJSON(url);
            renderAllSessions(data || []);
        } catch (e) {
            showError('Не удалось загрузить сессии: '+e.message);
        }
    }

    function renderAllSessions(list) {
        allSessionsTableBody.innerHTML = '';
        list.forEach(s => {
            const activeBadge = s.active
                ? '<span class="badge badge-active">Да</span>'
                : '<span class="badge badge-inactive">Нет</span>';
            const loginTs = s.requestData?.login_time;
            const expiresTs = s.expiresAt;
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${s.id}</td>
                <td>${activeBadge}</td>
                <td>${s.requestData && typeof s.requestData.user_id !== 'undefined' ? s.requestData.user_id : '?'}</td>
                <td class="truncate" title="${formatDateTime(loginTs)}">${formatShortDateTime(loginTs)}</td>
                <td class="truncate" title="${escapeHtml(s.requestData?.ip || '')}">${escapeHtml(s.requestData?.ip || '')}</td>
                <td class="truncate-wide" title="${escapeHtml(s.requestData?.user_agent||'')}">${escapeHtml((s.requestData?.user_agent||'').substring(0,140))}</td>
                <td class="truncate" title="Истекает: ${formatDateTime(expiresTs)}">${formatRemaining(expiresTs)}</td>
                <td>${s.googleLogin ? '<span class="badge badge-google" title="Google OAuth">G</span>' : ''}</td>
                <td class="row-actions">
                    ${s.active ? `<button type="button" class="danger outline small-btn" data-del-global-session="${s.id}">Удалить</button>` : ''}
                </td>
            `;
            allSessionsTableBody.appendChild(tr);
        });
        allSessionsCount.textContent = 'Всего сессий: ' + list.length;
    }

    allSessionsTableBody.addEventListener('click', async e => {
        const btn = e.target.closest('button[data-del-global-session]');
        if (!btn) return;
        const sid = btn.dataset.delGlobalSession;
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
            await loadAllSessions();
            if (currentSelectedUserId) {
                loadUserSessions();
            }
        } catch (err) {
            showError(err.message);
        }
    });

    deleteAllSessionsBtn.addEventListener('click', async () => {
        if (!confirm('Удалить АБСОЛЮТНО все активные сессии? Вы будете разлогинены.')) return;
        try {
            const res = await fetch(sessionApiRoot, {
                method: 'DELETE',
                credentials:'include'
            });
            if (!res.ok) {
                const txt = await res.text().catch(()=> '');
                if (res.status === 403) showError('Недостаточно прав');
                else showError(txt || ('Ошибка глобального удаления ('+res.status+')'));
                return;
            }
            showOk('Все сессии деактивированы. Перезагрузка...');
            setTimeout(() => window.location.reload(), 800);
        } catch (e) {
            showError(e.message);
        }
    });

    // Time formatting
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
    function formatRemaining(ts) {
        if (!ts) return '';
        const diff = ts - Date.now();
        const past = diff < 0;
        const abs = Math.abs(diff);

        const MIN = 60 * 1000;
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

    // SAVE / CREATE USER
    userForm.addEventListener('submit', async e => {
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
                if (res.ok) {
                    showOk('Обновлено');
                    formTitle.textContent = `Редактировать пользователя ${email} (id = ${id})`;
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
                    activateTab('tab-users');
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
        clearUserSelection();
        resetForm();
        loadAllSessions();
    })();

})();