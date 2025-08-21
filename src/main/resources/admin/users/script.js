(function() {
    const apiRoot = '/auth/manage';
    const errBox = document.getElementById('err');
    const okBox = document.getElementById('ok');
    const tableBody = document.querySelector('#usersTable tbody');
    const countInfo = document.getElementById('countInfo');

    // Удалён manage_users, возвращено название "Управление доступом"
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
            if (el) el.checked = !!perms[k];
        });
    }

    function clearMessages() {
        errBox.classList.remove('show');
        okBox.classList.remove('show');
        errBox.textContent='';
        okBox.textContent='';
    }
    function showError(m) { clearMessages(); errBox.textContent = m; errBox.classList.add('show'); }
    function showOk(m) { clearMessages(); okBox.textContent = m; okBox.classList.add('show'); }

    async function fetchJSON(url, opts={}) {
        const res = await fetch(url, {
            credentials:'include',
            headers:{ 'Content-Type':'application/json', ...(opts.headers||{}) },
            ...opts
        });
        if (res.status === 204) return null;
        if (!res.ok) {
            // Выводим текст ошибки сервера
            const txt = await res.text().catch(()=> '');
            throw new Error(txt || ('HTTP '+res.status));
        }
        try { return await res.json(); } catch { return null; }
    }

    async function loadAll() {
        try {
            const data = await fetchJSON(apiRoot);
            renderTable(data||[]);
            showCount(data?.length||0);
        } catch (e) {
            showError('Не удалось загрузить пользователей: '+e.message);
        }
    }

    function showCount(n) { countInfo.textContent = 'Всего: '+n; }

    async function searchByName() {
        const name = document.getElementById('filterName').value.trim();
        if (!name) { showError('Введите имя для поиска'); return; }
        try {
            const users = await fetchJSON(apiRoot+'/findByName/'+encodeURIComponent(name));
            renderTable(users||[]);
            showCount(users?.length||0);
            if (!users || !users.length) showError('Ничего не найдено по имени');
            else clearMessages();
        } catch (e) {
            renderTable([]);
            showCount(0);
            showError(e.message);
        }
    }

    async function searchByEmail() {
        const email = document.getElementById('filterEmail').value.trim();
        if (!email) { showError('Введите email для поиска'); return; }
        // Точное
        try {
            const user = await fetchJSON(apiRoot+'/byEmail/'+encodeURIComponent(email));
            renderTable([user]);
            showCount(1);
            clearMessages();
            return;
        } catch (eExact) {
            // Если 400/500 — показать её и не идти дальше
            if (!/404/.test(eExact.message)) {
                showError(eExact.message);
                return;
            }
        }
        // LIKE
        try {
            const users = await fetchJSON(apiRoot+'/findByEmail/'+encodeURIComponent(email));
            renderTable(users||[]);
            showCount(users?.length||0);
            if (!users || !users.length) showError('Ничего не найдено по email');
            else clearMessages();
        } catch (e) {
            renderTable([]);
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

    function renderTable(users) {
        tableBody.innerHTML = '';
        users.forEach(u => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
        <td class="nowrap">${u.id}</td>
        <td class="truncate" title="${escapeHtml(u.name)}">${escapeHtml(u.name)}</td>
        <td class="truncate" title="${escapeHtml(u.email)}">${escapeHtml(u.email)}</td>
        <td>${renderPermBadges(u.permissions)}</td>
        <td class="row-actions">
          <button type="button" class="outline" data-edit="${u.id}">Ред.</button>
          <button type="button" class="danger outline" data-del="${u.id}">Удалить</button>
        </td>
      `;
            tableBody.appendChild(tr);
        });
    }

    tableBody.addEventListener('click', async e => {
        const btn = e.target.closest('button');
        if (!btn) return;
        if (btn.dataset.edit) {
            try {
                const user = await fetchJSON(apiRoot+'/'+btn.dataset.edit);
                fillFormForEdit(user);
            } catch (err) {
                showError(err.message);
            }
        } else if (btn.dataset.del) {
            if (!confirm('Удалить пользователя '+btn.dataset.del+'?')) return;
            try {
                const res = await fetch(apiRoot+'/'+btn.dataset.del, { method:'DELETE', credentials:'include' });
                if (!res.ok) {
                    const txt = await res.text().catch(()=> '');
                    showError(txt || ('Ошибка удаления '+res.status));
                    return;
                }
                showOk('Удалено');
                await loadAll();
                if (document.getElementById('editId').value === btn.dataset.del) resetForm();
            } catch (err) {
                showError(err.message);
            }
        }
    });

    function fillFormForEdit(user) {
        document.getElementById('editId').value = user.id;
        document.getElementById('name').value = user.name;
        document.getElementById('email').value = user.email;
        document.getElementById('password').value = '';
        fillPerms(user.permissions || {});
        document.getElementById('saveBtn').textContent = 'Обновить';
        clearMessages();
    }

    function resetForm() {
        document.getElementById('editId').value = '';
        document.getElementById('name').value = '';
        document.getElementById('email').value = '';
        document.getElementById('password').value = '';
        fillPerms({});
        document.getElementById('saveBtn').textContent = 'Создать';
    }

    document.getElementById('resetBtn').addEventListener('click', () => { resetForm(); clearMessages(); });
    document.getElementById('searchNameBtn').addEventListener('click', searchByName);
    document.getElementById('searchEmailBtn').addEventListener('click', searchByEmail);
    document.getElementById('showAllBtn').addEventListener('click', () => {
        document.getElementById('filterName').value='';
        document.getElementById('filterEmail').value='';
        clearMessages();
        loadAll();
    });

    document.getElementById('userForm').addEventListener('submit', async e => {
        e.preventDefault();
        clearMessages();
        const id = document.getElementById('editId').value;
        const name = document.getElementById('name').value.trim();
        const email = document.getElementById('email').value.trim();
        const password = document.getElementById('password').value;
        if (!name || !email) {
            showError('Имя и email обязательны');
            return;
        }
        if (!id && !password) {
            showError('Пароль обязателен при создании пользователя');
            return;
        }
        const perms = getPermsFromForm();
        const btn = document.getElementById('saveBtn');
        const originalText = btn.textContent;
        btn.disabled = true;
        btn.innerHTML = '<div class="spinner"></div>';
        try {
            if (id) {
                const payload = { name, email, permissions: perms };
                if (password) payload.password = password;
                const res = await fetch(apiRoot+'/'+id, {
                    method:'PUT', credentials:'include',
                    headers:{'Content-Type':'application/json'},
                    body: JSON.stringify(payload)
                });
                if (res.status === 204) {
                    showOk('Обновлено');
                    await loadAll();
                } else {
                    const txt = await res.text().catch(()=> '');
                    showError(txt || ('Ошибка обновления ('+res.status+')'));
                }
            } else {
                const payload = { name, email, password, permissions: perms };
                const res = await fetch(apiRoot, {
                    method:'POST', credentials:'include',
                    headers:{'Content-Type':'application/json'},
                    body: JSON.stringify(payload)
                });
                if (res.ok) {
                    const newId = await res.text().catch(()=> '');
                    showOk('Создан пользователь ID '+newId);
                    resetForm();
                    await loadAll();
                } else {
                    const txt = await res.text().catch(()=> '');
                    showError(txt || ('Не удалось создать ('+res.status+')'));
                }
            }
        } catch (err) {
            showError(err.message);
        } finally {
            btn.disabled = false;
            btn.textContent = originalText;
        }
    });

    // Инициализация
    loadAll();
})();