(function() {
    const apiRoot = '/auth/manage';
    const errBox = document.getElementById('err');
    const okBox = document.getElementById('ok');
    const tableBody = document.querySelector('#usersTable tbody');
    const countInfo = document.getElementById('countInfo');

    // ДОБАВЛЕНО manage_users
    const permDescriptions = {
        manage_users: 'Управление пользователями (доступ к этой панели)',
        stream: 'Просмотр видео',
        door_control: 'Управление дверью',
        status: 'Статус системы',
        logs: 'Просмотр логов',
        records: 'Записи',
        manual: 'Ручные операции',
        settings: 'Настройки',
        backup: 'Резервное копирование',
        access_control: 'Управление доступом'
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
            const text = document.createElement('span');
            text.textContent = permDescriptions[k];
            label.appendChild(cb);
            label.appendChild(text);
            grid.appendChild(label);
        });
    }
    buildPermissionsGrid();

    function getPermsFromForm() {
        const perms = {};
        permKeys.forEach(k => {
            perms[k] = document.getElementById('perm_'+k).checked;
        });
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
    function showError(m) { clearMessages(); errBox.textContent=m; errBox.classList.add('show'); }
    function showOk(m) { clearMessages(); okBox.textContent=m; okBox.classList.add('show'); }

    async function fetchJSON(url, opts={}) {
        const res = await fetch(url, {
            credentials:'include',
            headers:{ 'Content-Type':'application/json', ...(opts.headers||{}) },
            ...opts
        });
        if (res.status === 204) return null;
        if (!res.ok) {
            const t = await res.text().catch(()=> '');
            throw new Error('HTTP '+res.status+(t?': '+t:''));
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

    async function search() {
        const name = document.getElementById('filterName').value.trim();
        const email = document.getElementById('filterEmail').value.trim();

        if (email) {
            // сначала точный
            try {
                const user = await fetchJSON(apiRoot+'/byEmail/'+encodeURIComponent(email));
                renderTable([user]);
                showCount(1);
                return;
            } catch {}
            // потом LIKE (если реализован эндпоинт /findByEmail)
            try {
                const users = await fetchJSON(apiRoot+'/findByEmail/'+encodeURIComponent(email));
                renderTable(users||[]);
                showCount(users?.length||0);
                return;
            } catch {
                renderTable([]);
                showCount(0);
                return;
            }
        }

        if (name) {
            try {
                const users = await fetchJSON(apiRoot+'/findByName/'+encodeURIComponent(name));
                renderTable(users||[]);
                showCount(users?.length||0);
            } catch {
                renderTable([]);
                showCount(0);
            }
            return;
        }

        await loadAll();
    }

    function escapeHtml(s) {
        return s.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    }

    function renderPermBadges(perms) {
        if (!perms) return '';
        return permKeys.filter(k => perms[k])
            .map(k => `<span class="badge" title="${permDescriptions[k]}">${k.replace(/_/g,'-')}</span>`).join(' ');
    }

    function renderTable(users) {
        tableBody.innerHTML='';
        users.forEach(u => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
        <td class="nowrap">${u.id}</td>
        <td class="truncate" title="${escapeHtml(u.name)}">${escapeHtml(u.name)}</td>
        <td class="truncate" title="${escapeHtml(u.email)}">${escapeHtml(u.email)}</td>
        <td><span class="password-placeholder">•••${escapeHtml(u.password.slice(-8))}</span></td>
        <td>${renderPermBadges(u.permissions)}</td>
        <td class="row-actions">
          <button type="button" class="outline" data-edit="${u.id}">Ред.</button>
          <button type="button" class="danger outline" data-del="${u.id}">X</button>
        </td>
      `;
            tableBody.appendChild(tr);
        });
    }

    tableBody.addEventListener('click', async (e) => {
        const btn = e.target.closest('button');
        if (!btn) return;
        if (btn.dataset.edit) {
            const id = btn.dataset.edit;
            try {
                const user = await fetchJSON(apiRoot+'/'+id);
                fillFormForEdit(user);
            } catch (err) {
                showError('Не удалось получить пользователя: '+err.message);
            }
        } else if (btn.dataset.del) {
            const id = btn.dataset.del;
            if (!confirm('Удалить пользователя '+id+'?')) return;
            try {
                await fetch(apiRoot+'/'+id, { method:'DELETE', credentials:'include' });
                showOk('Удалено');
                await loadAll();
                if (document.getElementById('editId').value === id) resetForm();
            } catch (err) {
                showError('Ошибка удаления: '+err.message);
            }
        }
    });

    function fillFormForEdit(user) {
        document.getElementById('editId').value = user.id;
        document.getElementById('name').value = user.name;
        document.getElementById('email').value = user.email;
        document.getElementById('password').value = '';
        fillPerms(user.permissions || {});
        document.getElementById('saveBtn').textContent='Обновить';
    }

    function resetForm() {
        document.getElementById('editId').value='';
        document.getElementById('name').value='';
        document.getElementById('email').value='';
        document.getElementById('password').value='';
        fillPerms({});
        document.getElementById('saveBtn').textContent='Создать';
    }

    document.getElementById('resetBtn').addEventListener('click', () => {
        resetForm();
        clearMessages();
    });

    document.getElementById('searchBtn').addEventListener('click', search);
    document.getElementById('refreshBtn').addEventListener('click', () => {
        document.getElementById('filterName').value='';
        document.getElementById('filterEmail').value='';
        loadAll();
    });

    document.getElementById('userForm').addEventListener('submit', async (e) => {
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
        const perms = getPermsFromForm();
        const btn = document.getElementById('saveBtn');
        const oldTxt = btn.textContent;
        btn.disabled = true;
        btn.innerHTML = '<div class="spinner"></div>';
        try {
            if (id) {
                const payload = { name, email, permissions: perms };
                if (password) payload.password = password;
                const res = await fetch(apiRoot+'/'+id, {
                    method:'PUT',
                    credentials:'include',
                    headers:{'Content-Type':'application/json'},
                    body: JSON.stringify(payload)
                });
                if (res.status === 204) {
                    showOk('Обновлено');
                    await loadAll();
                } else if (res.status === 404) {
                    showError('Не найден / email занят');
                } else {
                    showError('Ошибка обновления ('+res.status+')');
                }
            } else {
                const payload = {
                    name, email,
                    password: password || generateTempPassword(),
                    permissions: perms
                };
                const res = await fetch(apiRoot, {
                    method:'POST',
                    credentials:'include',
                    headers:{'Content-Type':'application/json'},
                    body: JSON.stringify(payload)
                });
                if (res.ok) {
                    const newId = await res.text();
                    showOk('Создан пользователь ID '+newId);
                    resetForm();
                    await loadAll();
                } else {
                    showError('Не удалось создать (возможно email уже существует)');
                }
            }
        } catch (err) {
            showError('Ошибка отправки: '+err.message);
        } finally {
            btn.disabled = false;
            btn.textContent = oldTxt;
        }
    });

    function generateTempPassword() {
        return Math.random().toString(36).slice(-10)+'!';
    }

    loadAll();
})();