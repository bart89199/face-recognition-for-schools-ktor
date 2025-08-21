(function() {
    const errBox = document.getElementById('err');
    const okBox = document.getElementById('ok');
    const form = document.getElementById('profileForm');
    const nameInput = document.getElementById('name');
    const emailInput = document.getElementById('email');
    const passInput = document.getElementById('password');
    const saveBtn = document.getElementById('saveBtn');
    const resetBtn = document.getElementById('resetBtn');

    const sessionsBody = document.getElementById('sessionsBody');
    const sessionsCount = document.getElementById('sessionsCount');
    const reloadSessionsBtn = document.getElementById('reloadSessions');
    const deleteAllSessionsBtn = document.getElementById('deleteAllSessions');

    let currentSessionId = null;
    let originalUser = null;

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
            headers: { 'Content-Type':'application/json', ...(opts.headers||{}) },
            ...opts
        });
        if (res.status === 204) return null;
        if (!res.ok) {
            const txt = await res.text().catch(()=> '');
            throw new Error(txt || ('HTTP '+res.status));
        }
        try { return await res.json(); } catch { return null; }
    }

    async function loadUser() {
        try {
            const user = await fetchJSON('/api/user');
            originalUser = user;
            nameInput.value = user.name || '';
            emailInput.value = user.email || '';
            passInput.value = '';
        } catch (e) {
            showError('Не удалось получить профиль: '+e.message);
        }
    }

    function resetForm() {
        if (!originalUser) return;
        nameInput.value = originalUser.name || '';
        passInput.value = '';
        clearMessages();
    }

    function setLoading(btn, loading) {
        if (!btn) return;
        if (loading) {
            btn.disabled = true;
            btn.dataset.original = btn.textContent;
            btn.innerHTML = '<div class="spinner"></div>';
        } else {
            btn.disabled = false;
            if (btn.dataset.original) {
                btn.textContent = btn.dataset.original;
                delete btn.dataset.original;
            }
        }
    }

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        clearMessages();
        const name = nameInput.value.trim();
        const password = passInput.value;
        if (!name) {
            showError('Имя обязательно.');
            return;
        }
        const payload = { name };
        if (password) payload.password = password;

        setLoading(saveBtn, true);
        try {
            const res = await fetch('/api/user', {
                method:'PUT',
                credentials:'include',
                headers:{'Content-Type':'application/json'},
                body: JSON.stringify(payload)
            });
            if (res.status === 204) {
                showOk('Профиль обновлён');
                originalUser.name = name;
                passInput.value = '';
            } else {
                const txt = await res.text().catch(()=> '');
                showError(txt || ('Ошибка обновления ('+res.status+')'));
            }
        } catch (err) {
            showError(err.message);
        } finally {
            setLoading(saveBtn, false);
        }
    });

    resetBtn.addEventListener('click', resetForm);

    // ---- Sessions ----
    async function loadCurrentSession() {
        try {
            const s = await fetchJSON('/api/user/sessions/current');
            currentSessionId = s?.id ?? null;
        } catch {
            currentSessionId = null;
        }
    }

    function formatTime(ms) {
        try {
            return new Date(ms).toLocaleString();
        } catch { return ms; }
    }

    function escapeHtml(str) {
        return (str||'').toString().replace(/[&<>"']/g, c => ({
            '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
        }[c]));
    }

    function shortenUA(ua) {
        if (!ua) return '';
        if (ua.length > 55) return ua.slice(0,52)+'...';
        return ua;
    }

    function renderSessions(list) {
        sessionsBody.innerHTML = '';
        list.forEach(s => {
            const tr = document.createElement('tr');
            const isCurrent = s.id === currentSessionId;
            if (isCurrent) tr.classList.add('current-session');

            const ipCell = document.createElement('td');
            if (isCurrent) {
                const badge = document.createElement('span');
                badge.className = 'current-badge';
                badge.textContent = 'ТЕКУЩАЯ';
                ipCell.appendChild(badge);
            }
            ipCell.appendChild(document.createTextNode(escapeHtml(s.requestData.ip||'')));

            const uaCell = document.createElement('td');
            uaCell.textContent = shortenUA(s.requestData.user_agent || s.requestData.userAgent);

            const timeCell = document.createElement('td');
            const loginTime = s.requestData.login_time ?? s.requestData.loginTime;
            timeCell.textContent = formatTime(loginTime);

            const googleCell = document.createElement('td');
            googleCell.textContent = s.googleLogin ? 'Yes' : 'No';

            const actionsCell = document.createElement('td');
            if (typeof s.id === 'number') {
                const delBtn = document.createElement('button');
                delBtn.type = 'button';
                delBtn.className = 'danger outline';
                delBtn.dataset.del = s.id;
                delBtn.textContent = 'X';
                delBtn.title = 'Удалить сессию';
                actionsCell.appendChild(delBtn);
            }

            tr.appendChild(ipCell);
            tr.appendChild(uaCell);
            tr.appendChild(timeCell);
            tr.appendChild(googleCell);
            tr.appendChild(actionsCell);

            sessionsBody.appendChild(tr);
        });
        sessionsCount.textContent = 'Всего сессий: ' + list.length;
    }

    async function loadSessions() {
        try {
            await loadCurrentSession();
            const list = await fetchJSON('/api/user/sessions');
            renderSessions(list||[]);
        } catch (e) {
            showError('Не удалось получить список сессий: '+e.message);
        }
    }

    sessionsBody.addEventListener('click', async (e) => {
        const btn = e.target.closest('button[data-del]');
        if (!btn) return;
        const id = btn.dataset.del;
        if (!confirm('Удалить сессию?'+(parseInt(id) === currentSessionId ? ' (Это текущая — вы выйдете)' : ''))) return;
        btn.disabled = true;
        try {
            const res = await fetch('/api/user/sessions/'+id, {
                method:'DELETE',
                credentials:'include'
            });
            if (res.status === 204) {
                if (parseInt(id) === currentSessionId) {
                    location.reload();
                    return;
                }
                showOk('Сессия удалена');
                loadSessions();
            } else {
                const txt = await res.text().catch(()=> '');
                showError(txt || ('Ошибка удаления ('+res.status+')'));
            }
        } catch (err) {
            showError(err.message);
        } finally {
            btn.disabled = false;
        }
    });

    deleteAllSessionsBtn.addEventListener('click', async () => {
        if (!confirm('Удалить ВСЕ сессии? Вы будете разлогинены.')) return;
        deleteAllSessionsBtn.disabled = true;
        try {
            const res = await fetch('/api/user/sessions', {
                method:'DELETE',
                credentials:'include'
            });
            if (res.status === 204) {
                location.reload();
            } else {
                const txt = await res.text().catch(()=> '');
                showError(txt || ('Ошибка ('+res.status+')'));
            }
        } catch (err) {
            showError(err.message);
        } finally {
            deleteAllSessionsBtn.disabled = false;
        }
    });

    reloadSessionsBtn.addEventListener('click', loadSessions);

    // init
    loadUser();
    loadSessions();

})();