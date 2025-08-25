(function() {
    const userApiRoot = '/api/manage/user';
    const sessionApiRoot = '/api/manage/session';
    const sessionByUserRoot = '/api/manage/session/byUserId';
    const currentUserApi = '/api/user/profile';

    // DOM COMMON
    const errBox = document.getElementById('err');
    const okBox  = document.getElementById('ok');

    function clearMessages() {
        errBox.classList.remove('show'); okBox.classList.remove('show');
        errBox.textContent=''; okBox.textContent='';
    }
    function showError(m){ clearMessages(); errBox.textContent=m; errBox.classList.add('show'); }
    function showOk(m){ clearMessages(); okBox.textContent=m; okBox.classList.add('show'); }

    // Tabs
    const tabButtons=[...document.querySelectorAll('.tab-btn')];
    const tabPanels=[...document.querySelectorAll('.tab-panel')];
    function activateTab(id){
        tabButtons.forEach(b=>b.classList.toggle('active', b.dataset.tab===id));
        tabPanels.forEach(p=>p.classList.toggle('active', p.id===id));
        clearMessages();
    }
    tabButtons.forEach(btn=>btn.addEventListener('click',()=>activateTab(btn.dataset.tab)));

    // USER LIST / SEARCH
    const usersTableBody = document.querySelector('#usersTable tbody');
    const countInfo = document.getElementById('countInfo');

    const inputNameLike   = document.getElementById('filterNameLike');
    const inputNameExact  = document.getElementById('filterNameExact');
    const inputEmailLike  = document.getElementById('filterEmailLike');
    const inputEmailExact = document.getElementById('filterEmailExact');
    const inputIds        = document.getElementById('filterIds');

    const btnNameLike  = document.getElementById('btnNameLike');
    const btnNameExact = document.getElementById('btnNameExact');
    const btnEmailLike = document.getElementById('btnEmailLike');
    const btnEmailExact= document.getElementById('btnEmailExact');
    const btnIds       = document.getElementById('btnIds');

    const showAllBtn   = document.getElementById('showAllBtn');
    const goCreateBtn  = document.getElementById('goCreateBtn');

    // Bulk selection
    const masterUserCheckbox = document.getElementById('masterUserCheckbox');
    const btnSelectAll = document.getElementById('btnSelectAll');
    theBtnClearSelection = document.getElementById('btnClearSelection');
    const btnClearSelection = theBtnClearSelection;
    const btnDeleteSelected = document.getElementById('btnDeleteSelected');
    const btnDeleteSessionsSelected = document.getElementById('btnDeleteSessionsSelected');

    // Edit form
    const editIdInput = document.getElementById('editId');
    const showIdInput = document.getElementById('showId');
    const nameInput   = document.getElementById('name');
    const emailInput  = document.getElementById('email');
    const passwordInput = document.getElementById('password');
    const rootCheckbox = document.getElementById('rootFlag');
    const permGrid = document.getElementById('permGrid');
    const userForm = document.getElementById('userForm');
    const saveBtn  = document.getElementById('saveBtn');
    const resetBtn = document.getElementById('resetBtn');
    const backToUsersBtn = document.getElementById('backToUsersBtn');
    const formTitle = document.getElementById('formTitle');

    // Selected single user tag (for admin per-user sessions)
    const selectedUserTag = document.getElementById('selectedUserTag');
    const selectedUserNameSpan = document.getElementById('selectedUserName');
    const selectedUserIdSpan   = document.getElementById('selectedUserId');

    // User sessions tab (admin - sessions of selected user)
    const userSessionsFilter = document.getElementById('userSessionsFilter');
    const refreshUserSessionsBtn = document.getElementById('refreshUserSessionsBtn');
    const deleteUserSessionsBtn  = document.getElementById('deleteUserSessionsBtn');
    const userSessionsTable = document.getElementById('userSessionsTable');
    const userSessionsTableBody = userSessionsTable.querySelector('tbody');
    const userSessionsInfo = document.getElementById('userSessionsInfo');
    const userSessionsEmpty= document.getElementById('userSessionsEmpty');

    // All sessions tab
    const allSessionsFilter = document.getElementById('allSessionsFilter');
    const refreshAllSessionsBtn = document.getElementById('refreshAllSessionsBtn');
    const deleteAllSessionsBtn  = document.getElementById('deleteAllSessionsBtn');
    const allSessionsTableBody  = document.querySelector('#allSessionsTable tbody');
    const allSessionsCount = document.getElementById('allSessionsCount');

    // Session ID search
    const inputSessionIds = document.getElementById('filterSessionIds');
    const btnSessionIdsSearch = document.getElementById('btnSessionIdsSearch');

    // State
    let isCurrentRoot = false;
    let currentSelectedUserId = null;
    let currentSelectedUserName = null;
    let currentUserList = [];

    // Permissions mapping
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
        permKeys.forEach(k=>{
            const label = document.createElement('label');
            label.className='perm-item';
            const cb = document.createElement('input');
            cb.type='checkbox';
            cb.id='perm_'+k;
            cb.addEventListener('change',()=>label.classList.toggle('checked', cb.checked));
            const span=document.createElement('span');
            span.textContent=permDescriptions[k];
            label.appendChild(cb); label.appendChild(span);
            permGrid.appendChild(label);
        });
    }
    buildPermissionsGrid();
    function syncCheckedClasses(){
        permKeys.forEach(k=>{
            const cb=document.getElementById('perm_'+k);
            if(cb) cb.parentElement.classList.toggle('checked', cb.checked);
        });
    }
    function getPermsFromForm(){
        const p={}; permKeys.forEach(k=>p[k]=document.getElementById('perm_'+k).checked); return p;
    }
    function fillPerms(perms){
        permKeys.forEach(k=>{
            const cb=document.getElementById('perm_'+k);
            if(cb) cb.checked=!!(perms && perms[k]);
        });
        syncCheckedClasses();
    }

    async function fetchJSON(url, opts={}) {
        const res = await fetch(url, {
            credentials:'include',
            headers:{ 'Content-Type':'application/json', ...(opts.headers||{}) },
            ...opts
        });
        if (res.status === 204) return null;
        if (!res.ok){
            const txt=await res.text().catch(()=> '');
            if (res.status===403) throw new Error(txt || 'Недостаточно прав');
            if (res.status===404) throw new Error('HTTP 404');
            throw new Error(txt || ('HTTP '+res.status));
        }
        try { return await res.json(); } catch { return null; }
    }

    async function loadCurrentUser(){
        try{
            const me = await fetchJSON(currentUserApi);
            if (me) {
                isCurrentRoot = !!me.root;
                updateRootCheckboxState();
            }
        }catch(_){}
    }
    function updateRootCheckboxState(){
        if (!isCurrentRoot){
            rootCheckbox.disabled = true;
            rootCheckbox.title = 'Только root может изменять этот флаг';
        } else {
            rootCheckbox.disabled = false;
            rootCheckbox.title = 'Изменение root-статуса доступно';
        }
    }

    // Utility
    function escapeHtml(s){
        return (s||'').toString().replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    }
    function parseList(raw) {
        return raw.split(',').map(v=>v.trim()).filter(v=>v.length>0);
    }
    function parseIdList(raw){
        return parseList(raw).map(x=>Number(x)).filter(x=>Number.isInteger(x));
    }

    // Render permissions badges
    function renderPermBadges(perms){
        if(!perms) return '';
        return permKeys.filter(k=>perms[k]).map(k=>`<span class="badge" title="${escapeHtml(permDescriptions[k])}">${escapeHtml(permDescriptions[k])}</span>`).join(' ');
    }

    function showCount(n){ countInfo.textContent='Всего пользователей: '+n; }

    // Load all users
    async function loadAllUsers(){
        try {
            const data = await fetchJSON(userApiRoot); // GET /api/manage/user (list)
            currentUserList = data || [];
            renderUsersTable(currentUserList);
            showCount(currentUserList.length);
        } catch(e){
            showError('Не удалось загрузить пользователей: '+e.message);
        }
    }

    // Searches (updated to real backend format)
    async function searchNameLike(){
        const v = inputNameLike.value.trim();
        if(!v){ showError('Введите часть имени'); return; }
        try {
            const users = await fetchJSON(`${userApiRoot}/findByName?name=${encodeURIComponent(v)}`);
            currentUserList = users || [];
            renderUsersTable(currentUserList);
            showCount(currentUserList.length);
            if(!currentUserList.length) showError('Ничего не найдено');
        }catch(e){ showError(e.message); renderUsersTable([]); showCount(0); }
    }
    async function searchNameExact(){
        const raw = inputNameExact.value.trim();
        if(!raw){ showError('Введите имя/имена'); return; }
        const names = parseList(raw);
        if(!names.length){ showError('Некорректный ввод'); return; }
        try {
            const users = await fetchJSON(`${userApiRoot}/byName?name=${encodeURIComponent(names.join(','))}`);
            currentUserList = users || [];
            renderUsersTable(currentUserList);
            showCount(currentUserList.length);
            if(!currentUserList.length) showError('Ничего не найдено');
        }catch(e){ showError(e.message); renderUsersTable([]); showCount(0); }
    }
    async function searchEmailLike(){
        const v = inputEmailLike.value.trim();
        if(!v){ showError('Введите часть email'); return; }
        try {
            const users = await fetchJSON(`${userApiRoot}/findByEmail?email=${encodeURIComponent(v)}`);
            currentUserList = users || [];
            renderUsersTable(currentUserList);
            showCount(currentUserList.length);
            if(!currentUserList.length) showError('Ничего не найдено');
        }catch(e){ showError(e.message); renderUsersTable([]); showCount(0); }
    }
    async function searchEmailExact(){
        const raw = inputEmailExact.value.trim();
        if(!raw){ showError('Введите email(ы)'); return; }
        const emails = parseList(raw);
        if(!emails.length){ showError('Некорректный ввод'); return; }
        try {
            const users = await fetchJSON(`${userApiRoot}/byEmail?email=${encodeURIComponent(emails.join(','))}`);
            currentUserList = users || [];
            renderUsersTable(currentUserList);
            showCount(currentUserList.length);
            if(!currentUserList.length) showError('Ничего не найдено');
        }catch(e){ showError(e.message); renderUsersTable([]); showCount(0); }
    }
    async function searchIds(){
        const raw = inputIds.value.trim();
        if(!raw){ showError('Введите ID'); return; }
        const ids = parseIdList(raw);
        if(!ids.length){ showError('Некорректные ID'); return; }
        try {
            const users = await fetchJSON(`${userApiRoot}?id=${encodeURIComponent(ids.join(','))}`);
            currentUserList = users || [];
            renderUsersTable(currentUserList);
            showCount(currentUserList.length);
            if(!currentUserList.length) showError('Ничего не найдено');
        }catch(e){ showError(e.message); renderUsersTable([]); showCount(0); }
    }

    // Users table & selection
    const selectedUserIdsSet = new Set();

    function renderUsersTable(users){
        usersTableBody.innerHTML='';
        users.forEach(u=>{
            const tr=document.createElement('tr');
            const checked = selectedUserIdsSet.has(u.id);
            tr.innerHTML = `
                <td class="checkbox-cell">
                    <input type="checkbox" data-row-select="${u.id}" ${checked?'checked':''} title="Выделить пользователя">
                </td>
                <td>${u.id}</td>
                <td class="truncate" title="${escapeHtml(u.name)}">${escapeHtml(u.name)}</td>
                <td class="truncate" title="${escapeHtml(u.email)}">${escapeHtml(u.email)}</td>
                <td>${u.root?'<span class="badge badge-root" title="root">root</span>':''}</td>
                <td>${renderPermBadges(u.permissions)}</td>
                <td class="row-actions">
                    <button type="button" class="outline" data-edit="${u.id}">Ред.</button>
                    <button type="button" class="outline" data-sessions="${u.id}">Сессии</button>
                    <button type="button" class="danger outline" data-del="${u.id}">Удалить</button>
                </td>
            `;
            usersTableBody.appendChild(tr);
        });
        updateMasterCheckbox();
    }

    function updateMasterCheckbox(){
        if(!currentUserList.length){
            masterUserCheckbox.checked=false;
            masterUserCheckbox.indeterminate=false;
            return;
        }
        const total = currentUserList.length;
        const selected = currentUserList.filter(u=>selectedUserIdsSet.has(u.id)).length;
        masterUserCheckbox.checked = selected===total;
        masterUserCheckbox.indeterminate = selected>0 && selected<total;
    }

    usersTableBody.addEventListener('click', async e=>{
        const chk = e.target.closest('input[data-row-select]');
        if(chk){
            const id = Number(chk.dataset.rowSelect);
            if(chk.checked) selectedUserIdsSet.add(id); else selectedUserIdsSet.delete(id);
            updateMasterCheckbox();
            return;
        }
        const btn = e.target.closest('button');
        if(!btn) return;
        const { edit, del, sessions } = btn.dataset;
        if (edit){
            try {
                const user = await fetchJSON(`${userApiRoot}/${edit}`); // single user
                if(!user){ showError('Пользователь не найден'); return; }
                fillFormForEdit(user);
                selectUser(user.id, user.name);
                activateTab('tab-edit');
            }catch(err){ showError(err.message); }
        } else if (sessions){
            selectUser(Number(sessions));
            activateTab('tab-user-sessions');
            await loadUserSessions();
        } else if (del){
            if(!confirm('Удалить пользователя '+del+'?')) return;
            await deleteUsers([Number(del)]);
        }
    });

    masterUserCheckbox.addEventListener('change', ()=>{
        if(masterUserCheckbox.checked){
            currentUserList.forEach(u=>selectedUserIdsSet.add(u.id));
        } else {
            selectedUserIdsSet.clear();
        }
        renderUsersTable(currentUserList);
    });

    btnSelectAll.addEventListener('click', ()=>{
        currentUserList.forEach(u=>selectedUserIdsSet.add(u.id));
        renderUsersTable(currentUserList);
    });
    btnClearSelection.addEventListener('click', ()=>{
        selectedUserIdsSet.clear();
        renderUsersTable(currentUserList);
    });

    btnDeleteSelected.addEventListener('click', async ()=>{
        if(!selectedUserIdsSet.size){ showError('Нет выбранных пользователей'); return; }
        if(!confirm('Удалить выбранных пользователей ('+selectedUserIdsSet.size+') ?')) return;
        await deleteUsers([...selectedUserIdsSet]);
    });

    btnDeleteSessionsSelected.addEventListener('click', async ()=>{
        if(!selectedUserIdsSet.size){ showError('Нет выбранных пользователей'); return; }
        if(!confirm('Удалить (деактивировать) активные сессии выбранных пользователей?')) return;
        // backend supports multiple user IDs: DELETE /api/manage/session/byUserId?id=1,2
        try {
            const res = await fetch(`${sessionByUserRoot}?id=${encodeURIComponent([...selectedUserIdsSet].join(','))}`, {
                method:'DELETE',
                credentials:'include'
            });
            if(!res.ok){
                const txt=await res.text().catch(()=> '');
                if(res.status===403) showError('Недостаточно прав'); else showError(txt || 'Ошибка удаления сессий');
                return;
            }
            showOk('Сессии выбранных пользователей деактивированы');
            if(currentSelectedUserId && selectedUserIdsSet.has(currentSelectedUserId)) loadUserSessions();
            loadAllSessions();
        } catch(e){
            showError(e.message);
        }
    });

    async function deleteUsers(ids){
        if(!ids.length) return;
        // Backend bulk DELETE route currently incomplete; perform per-user deletes to guarantee behavior
        let ok=0, fail=0;
        for(const id of ids){
            try{
                const res = await fetch(`${userApiRoot}/${id}`, { method:'DELETE', credentials:'include' });
                if(res.ok){
                    ok++;
                    if(currentSelectedUserId===id) clearUserSelection();
                    selectedUserIdsSet.delete(id);
                } else {
                    fail++;
                }
            }catch(_){ fail++; }
        }
        if(ok) showOk('Удалено пользователей: '+ok+(fail?`, ошибок: ${fail}`:''));
        else showError('Не удалось удалить (ошибок: '+fail+')');
        await loadAllUsers();
        if(editIdInput.value && ids.includes(Number(editIdInput.value))) resetForm();
    }

    function fillFormForEdit(user){
        formTitle.textContent = `Редактировать пользователя ${user.email} (id = ${user.id})`;
        editIdInput.value = user.id;
        showIdInput.value = user.id;
        nameInput.value = user.name;
        emailInput.value = user.email;
        passwordInput.value = '';
        rootCheckbox.checked = !!user.root;
        fillPerms(user.permissions||{});
        saveBtn.textContent='Обновить';
        updateRootCheckboxState();
        clearMessages();
    }
    function resetForm(){
        formTitle.textContent='Создать пользователя';
        editIdInput.value=''; showIdInput.value='';
        nameInput.value=''; emailInput.value='';
        passwordInput.value='';
        rootCheckbox.checked=false;
        fillPerms({});
        saveBtn.textContent='Создать';
        updateRootCheckboxState();
    }

    function selectUser(id, name){
        currentSelectedUserId=id;
        currentSelectedUserName=name || currentSelectedUserName;
        selectedUserTag.hidden=false;
        selectedUserNameSpan.textContent=currentSelectedUserName || '';
        selectedUserIdSpan.textContent=currentSelectedUserId;
        refreshUserSessionsBtn.disabled=false;
        deleteUserSessionsBtn.disabled=false;
    }
    function clearUserSelection(){
        currentSelectedUserId=null;
        currentSelectedUserName=null;
        selectedUserTag.hidden=true;
        selectedUserNameSpan.textContent='';
        selectedUserIdSpan.textContent='';
        refreshUserSessionsBtn.disabled=true;
        deleteUserSessionsBtn.disabled=true;
        userSessionsInfo.textContent='Выберите пользователя во вкладке "Пользователи".';
        userSessionsTable.style.display='none';
        userSessionsEmpty.style.display='none';
        userSessionsTableBody.innerHTML='';
    }

    // Buttons basic
    showAllBtn.addEventListener('click', ()=>{ clearMessages(); inputNameLike.value=''; inputNameExact.value=''; inputEmailLike.value=''; inputEmailExact.value=''; inputIds.value=''; loadAllUsers(); });
    goCreateBtn.addEventListener('click', ()=>{ resetForm(); activateTab('tab-edit'); });
    resetBtn.addEventListener('click', ()=>{ resetForm(); clearMessages(); });
    backToUsersBtn.addEventListener('click', ()=> activateTab('tab-users'));

    btnNameLike.addEventListener('click',searchNameLike);
    btnNameExact.addEventListener('click',searchNameExact);
    btnEmailLike.addEventListener('click',searchEmailLike);
    btnEmailExact.addEventListener('click',searchEmailExact);
    btnIds.addEventListener('click',searchIds);

    [inputNameLike,inputNameExact,inputEmailLike,inputEmailExact,inputIds].forEach(inp=>{
        inp.addEventListener('keydown',e=>{
            if(e.key==='Enter'){
                e.preventDefault();
                switch(inp){
                    case inputNameLike: searchNameLike(); break;
                    case inputNameExact: searchNameExact(); break;
                    case inputEmailLike: searchEmailLike(); break;
                    case inputEmailExact: searchEmailExact(); break;
                    case inputIds: searchIds(); break;
                }
            }
        });
    });

    // USER FORM SUBMIT
    userForm.addEventListener('submit', async e=>{
        e.preventDefault();
        clearMessages();
        const id = editIdInput.value;
        const name = nameInput.value.trim();
        const email = emailInput.value.trim();
        const password = passwordInput.value;
        const rootFlag = rootCheckbox.checked;
        if(!name || !email){ showError('Имя и email обязательны'); return; }
        if(!id && !password){ showError('Пароль обязателен при создании пользователя'); return; }

        const perms = getPermsFromForm();
        const originalText = saveBtn.textContent;
        saveBtn.disabled=true;
        saveBtn.innerHTML='<div class="spinner"></div>';

        try{
            if(id){
                const payload = { name, email, permissions:perms, root: rootFlag };
                if(password) payload.password = password;
                const res = await fetch(`${userApiRoot}/${id}`, {
                    method:'PUT', credentials:'include',
                    headers:{'Content-Type':'application/json'},
                    body: JSON.stringify(payload)
                });
                if(res.ok){
                    showOk('Обновлено');
                    formTitle.textContent = `Редактировать пользователя ${email} (id = ${id})`;
                    await loadAllUsers();
                    if(currentSelectedUserId==Number(id)) await loadUserSessions();
                } else {
                    const txt = await res.text().catch(()=> '');
                    if(res.status===403) showError('Недостаточно прав');
                    else showError(txt || 'Ошибка обновления');
                }
            } else {
                const payload = { name, email, password, permissions:perms, root: rootFlag };
                const res = await fetch(userApiRoot, {
                    method:'POST', credentials:'include',
                    headers:{'Content-Type':'application/json'},
                    body: JSON.stringify(payload)
                });
                if(res.ok){
                    const newId = await res.text().catch(()=> '');
                    showOk('Создан пользователь ID '+newId);
                    resetForm();
                    await loadAllUsers();
                    activateTab('tab-users');
                } else {
                    const txt = await res.text().catch(()=> '');
                    if(res.status===403) showError('Недостаточно прав');
                    else showError(txt || 'Не удалось создать');
                }
            }
        }catch(err){ showError(err.message); }
        finally{
            saveBtn.disabled=false;
            saveBtn.textContent=originalText;
        }
    });

    // USER SESSIONS TAB (admin per selected user)
    userSessionsFilter.addEventListener('change', ()=>{ if(currentSelectedUserId) loadUserSessions(); });
    refreshUserSessionsBtn.addEventListener('click', ()=>{ if(currentSelectedUserId) loadUserSessions(); });
    deleteUserSessionsBtn.addEventListener('click', async ()=>{
        if(!currentSelectedUserId) return;
        if(!confirm('Удалить все активные сессии пользователя '+currentSelectedUserId+'?')) return;
        try{
            const res = await fetch(`${sessionByUserRoot}?id=${currentSelectedUserId}`, {
                method:'DELETE', credentials:'include'
            });
            if(!res.ok){
                const txt=await res.text().catch(()=> '');
                if(res.status===403) showError('Недостаточно прав');
                else showError(txt || 'Ошибка удаления сессий пользователя');
                return;
            }
            showOk('Сессии пользователя деактивированы');
            await loadUserSessions();
            loadAllSessions();
        }catch(e){ showError(e.message); }
    });

    async function loadUserSessions(){
        if(!currentSelectedUserId){
            userSessionsInfo.textContent='Пользователь не выбран.';
            return;
        }
        userSessionsInfo.textContent='Загрузка...';
        const filterVal = userSessionsFilter.value;
        const params = new URLSearchParams();
        params.set('id', currentSelectedUserId);
        if(filterVal==='active') params.set('active','true');
        else if(filterVal==='inactive') params.set('active','false');
        try {
            const data = await fetchJSON(`${sessionByUserRoot}?${params.toString()}`);
            renderUserSessions(data||[]);
        }catch(e){
            showError(e.message);
            userSessionsInfo.textContent='Ошибка';
        }
    }

    function formatDateTime(ts){
        if(!ts) return '';
        const d=new Date(ts);
        return d.toLocaleString('ru-RU',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit',second:'2-digit'});
    }
    function formatShortDateTime(ts){
        if(!ts) return '';
        const d=new Date(ts);
        return d.toLocaleString('ru-RU',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'});
    }
    function formatRemaining(ts){
        if(!ts) return '';
        const diff = ts - Date.now();
        const past = diff < 0;
        const abs = Math.abs(diff);
        const MIN=60000, H=3600000, D=86400000;
        let text;
        if(abs<MIN) text='<1 мин';
        else if(abs<H){
            const m=Math.round(abs/MIN); text=m+' м';
        } else if(abs<D){
            const h=Math.floor(abs/H);
            const m=Math.round((abs%H)/MIN);
            text=h+' ч'+(m?' '+m+' м':'');
        } else {
            const d=Math.floor(abs/D);
            const h=Math.round((abs%D)/H);
            text=d+' д'+(h?' '+h+' ч':'');
        }
        return past?('просрочена '+text):('осталось '+text);
    }

    function renderUserSessions(list){
        userSessionsTableBody.innerHTML='';
        if(!list.length){
            userSessionsTable.style.display='none';
            userSessionsEmpty.style.display='block';
            userSessionsInfo.textContent='Сессий нет';
            return;
        }
        userSessionsTable.style.display='';
        userSessionsEmpty.style.display='none';
        userSessionsInfo.textContent='Сессий: '+list.length;
        list.forEach(s=>{
            const tr=document.createElement('tr');
            const activeBadge = s.active
                ? '<span class="badge badge-active">Да</span>'
                : '<span class="badge badge-inactive">Нет</span>';
            const loginTs = s.requestData?.login_time;
            const expiresTs = s.expiresAt;
            tr.innerHTML=`
                <td>${s.id}</td>
                <td>${activeBadge}</td>
                <td class="truncate" title="${formatDateTime(loginTs)}">${formatShortDateTime(loginTs)}</td>
                <td class="truncate" title="${escapeHtml(s.requestData?.ip||'')}">${escapeHtml(s.requestData?.ip||'')}</td>
                <td class="truncate-wide" title="${escapeHtml(s.requestData?.user_agent||'')}">${escapeHtml((s.requestData?.user_agent||'').substring(0,140))}</td>
                <td class="truncate" title="Истекает: ${formatDateTime(expiresTs)}">${formatRemaining(expiresTs)}</td>
                <td>${s.googleLogin?'<span class="badge badge-google" title="Google OAuth">G</span>':''}</td>
                <td class="row-actions">${s.active?`<button type="button" class="danger outline small-btn" data-del-session="${s.id}">Удалить</button>`:`<button type="button" class="danger outline small-btn" disabled style="opacity:.3;">Удалить</button>`}</td>
            `;
            userSessionsTableBody.appendChild(tr);
        });
    }

    userSessionsTableBody.addEventListener('click', async e=>{
        const btn=e.target.closest('button[data-del-session]');
        if(!btn) return;
        const sid=btn.dataset.delSession;
        if(!confirm('Удалить сессию '+sid+'?')) return;
        try{
            const res = await fetch(`${sessionApiRoot}?id=${encodeURIComponent(sid)}`, { method:'DELETE', credentials:'include' });
            if(!res.ok){
                const txt=await res.text().catch(()=> '');
                if(res.status===403) showError('Недостаточно прав');
                else showError(txt || 'Ошибка удаления сессии');
                return;
            }
            showOk('Сессия удалена');
            await loadUserSessions();
            loadAllSessions();
        }catch(err){ showError(err.message); }
    });

    // ALL SESSIONS
    allSessionsFilter.addEventListener('change', loadAllSessions);
    refreshAllSessionsBtn.addEventListener('click', loadAllSessions);
    deleteAllSessionsBtn.addEventListener('click', async ()=>{
        if(!confirm('Удалить АБСОЛЮТНО все активные сессии? Вы будете разлогинены.')) return;
        try{
            const res = await fetch(sessionApiRoot, { method:'DELETE', credentials:'include' });
            if(!res.ok){
                const txt=await res.text().catch(()=> '');
                if(res.status===403) showError('Недостаточно прав'); else showError(txt || 'Ошибка глобального удаления');
                return;
            }
            showOk('Все сессии деактивированы. Перезагрузка...');
            setTimeout(()=>window.location.reload(),800);
        }catch(e){ showError(e.message); }
    });

    async function loadAllSessions(){
        const filterVal = allSessionsFilter.value;
        let url = sessionApiRoot;
        if(filterVal==='active') url+='?active=true';
        else if(filterVal==='inactive') url+='?active=false';
        try{
            const list = await fetchJSON(url);
            renderAllSessions(list||[]);
        }catch(e){
            showError('Не удалось загрузить сессии: '+e.message);
        }
    }
    function renderAllSessions(list){
        allSessionsTableBody.innerHTML='';
        list.forEach(s=>{
            const activeBadge = s.active
                ? '<span class="badge badge-active">Да</span>'
                : '<span class="badge badge-inactive">Нет</span>';
            const loginTs = s.requestData?.login_time;
            const expiresTs = s.expiresAt;
            const delBtn = s.active
                ? `<button type="button" class="danger outline small-btn" data-del-global-session="${s.id}">Удалить</button>`
                : `<button type="button" class="danger outline small-btn" disabled style="opacity:.3;">Удалить</button>`;
            const tr=document.createElement('tr');
            tr.innerHTML=`
                <td>${s.id}</td>
                <td>${activeBadge}</td>
                <td>${typeof s.userId!=='undefined'? s.userId : '?'}</td>
                <td class="truncate" title="${formatDateTime(loginTs)}">${formatShortDateTime(loginTs)}</td>
                <td class="truncate" title="${escapeHtml(s.requestData?.ip||'')}">${escapeHtml(s.requestData?.ip||'')}</td>
                <td class="truncate-wide" title="${escapeHtml(s.requestData?.user_agent||'')}">${escapeHtml((s.requestData?.user_agent||'').substring(0,140))}</td>
                <td class="truncate" title="Истекает: ${formatDateTime(expiresTs)}">${formatRemaining(expiresTs)}</td>
                <td>${s.googleLogin?'<span class="badge badge-google" title="Google OAuth">G</span>':''}</td>
                <td class="row-actions">${delBtn}</td>
            `;
            allSessionsTableBody.appendChild(tr);
        });
        allSessionsCount.textContent='Всего сессий: '+list.length;
    }

    allSessionsTableBody.addEventListener('click', async e=>{
        const btn=e.target.closest('button[data-del-global-session]');
        if(!btn) return;
        const sid=btn.dataset.delGlobalSession;
        if(!confirm('Удалить сессию '+sid+'?')) return;
        try{
            const res=await fetch(`${sessionApiRoot}?id=${encodeURIComponent(sid)}`, { method:'DELETE', credentials:'include' });
            if(!res.ok){
                const txt=await res.text().catch(()=> '');
                if(res.status===403) showError('Недостаточно прав'); else showError(txt || 'Ошибка удаления сессии');
                return;
            }
            showOk('Сессия удалена');
            await loadAllSessions();
            if(currentSelectedUserId) loadUserSessions();
        }catch(err){ showError(err.message); }
    });

    // Session ID search
    btnSessionIdsSearch.addEventListener('click', searchSessionsByIds);
    inputSessionIds.addEventListener('keydown', e=>{
        if(e.key==='Enter'){ e.preventDefault(); searchSessionsByIds(); }
    });
    async function searchSessionsByIds(){
        const raw = inputSessionIds.value.trim();
        if(!raw){ showError('Введите ID сессий'); return; }
        const ids = parseIdList(raw);
        if(!ids.length){ showError('Некорректные ID'); return; }
        try{
            const list = await fetchJSON(`${sessionApiRoot}?id=${encodeURIComponent(ids.join(','))}`);
            if(!list || !list.length){
                renderAllSessions([]);
                allSessionsCount.textContent='Всего сессий: 0';
                showError('Сессии не найдены');
            }else{
                renderAllSessions(list);
                allSessionsCount.textContent='Найдено сессий: '+list.length;
                clearMessages();
            }
        }catch(e){ showError(e.message); renderAllSessions([]); allSessionsCount.textContent='Всего сессий: 0'; }
    }

    // Init
    (async function init(){
        await loadCurrentUser();
        await loadAllUsers();
        clearUserSelection();
        resetForm();
        loadAllSessions();
    })();

})();