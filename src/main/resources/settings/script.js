(function() {
    const API = '/api/settings';

    // DOM references
    const tbody = document.querySelector('#settingsTable tbody');
    const reloadBtn = document.getElementById('reloadBtn');
    const saveAllBtn = document.getElementById('saveAllBtn');
    const resetBtn = document.getElementById('resetBtn');
    const emptyState = document.getElementById('emptyState');
    const metaInfo = document.getElementById('metaInfo');
    const toastEl = document.getElementById('toast');
    const savingIndicator = document.getElementById('savingIndicator');
    const dirtyInfo = document.getElementById('dirtyInfo');
    const dirtyCountSpan = document.getElementById('dirtyCount');
    const hintLine = document.getElementById('hintLine');
    const errorStack = document.getElementById('errorStack');
    const searchInput = document.getElementById('searchInput');
    const clearSearchBtn = document.getElementById('clearSearch');
    const groupButtonsContainer = document.getElementById('groupButtons');

    // State
    let original = [];            // [{name,value,comment}]
    let working = [];             // typed clone of original
    const dirtyMap = new Map();   // name -> new string value
    const savingSet = new Set();  // names saving now
    let loading = false;
    let activeGroup = 'all';
    let searchQuery = '';

    // Group mapping
    const groupMapping = {
        close_delay_ms: 'door',
        save_detection: 'general',
        use_arduino: 'door',
        forms_autoload: 'forms',
        forms_check_interval_ms: 'forms',
        last_frames_amount: 'frames',
        min_frames_for_detection: 'frames',
        need_blinks: 'blink',
        frames_for_eyes_check: 'blink',
        wait_frames_for_detection: 'frames',
        cam_port: 'door',
        arduino_port: 'door',
        max_faces: 'frames',
        face_detection_mode: 'match',
        max_avg_distance: 'match',
        max_percent_distance: 'match',
        min_match_for_person: 'match',
        save_delay_ms: 'general',
        min_eyes_difference: 'blink',
        min_dif_for_blink: 'blink',
        blinked_eyes_open: 'blink',
        close_eyes_threshold: 'blink'
    };

    const groupLabels = {
        all: 'Все',
        general: 'Общие',
        door: 'Дверь / Устройства',
        forms: 'Формы',
        frames: 'Кадры',
        blink: 'Моргания / Глаза',
        match: 'Распознавание'
    };

    function buildGroupButtons() {
        const groups = Object.keys(groupLabels);
        groupButtonsContainer.innerHTML = '';
        groups.forEach(g => {
            const btn = document.createElement('button');
            btn.type='button';
            btn.className='tag-btn';
            btn.textContent = groupLabels[g];
            btn.dataset.group = g;
            if (g === activeGroup) btn.classList.add('active');
            btn.addEventListener('click', () => {
                activeGroup = g;
                [...groupButtonsContainer.children].forEach(b => b.classList.toggle('active', b === btn));
                renderAll();
            });
            groupButtonsContainer.appendChild(btn);
        });
    }
    buildGroupButtons();

    // Constraints (client-side validation before PUT)
    const constraints = {
        close_delay_ms:         { type:'int',   min:100, max:1e9 },
        save_detection:         { type:'bool' },
        use_arduino:            { type:'bool' },
        forms_autoload:         { type:'bool' },
        forms_check_interval_ms:{ type:'int',   min:100, max:1e9 },
        last_frames_amount:     { type:'int',   min:0,   max:1000 },
        min_frames_for_detection:{type:'int',   min:0,   max:1000 },
        need_blinks:            { type:'int',   min:0,   max:1000 },
        frames_for_eyes_check:  { type:'int',   min:0,   max:1000 },
        wait_frames_for_detection:{type:'int',  min:0,   max:1000 },
        cam_port:               { type:'string' },
        arduino_port:           { type:'string' },
        max_faces:              { type:'int',   min:0,   max:1000 },
        face_detection_mode:    { type:'int',   min:1,   max:2 },
        max_avg_distance:       { type:'float', min:0.0, max:1.0, step:0.01 },
        max_percent_distance:   { type:'float', min:0.0, max:1.0, step:0.01 },
        min_match_for_person:   { type:'float', min:0.0, max:1.0, step:0.01 },
        save_delay_ms:          { type:'int',   min:0,   max:1e9 },
        min_eyes_difference:    { type:'float', min:0.0, max:10.0, step:0.01 },
        min_dif_for_blink:      { type:'float', min:0.0, max:10.0, step:0.01 },
        blinked_eyes_open:      { type:'bool' },
        close_eyes_threshold:   { type:'float', min:0.0, max:10.0, step:0.01 },
    };

    // Notifications
    function showToast(msg, isError = false, timeout = 2600) {
        if (!msg) return;
        toastEl.textContent = msg;
        toastEl.className = 'toast' + (isError ? ' error' : '');
        toastEl.style.display = 'flex';
        clearTimeout(showToast._t);
        showToast._t = setTimeout(()=> toastEl.style.display='none', timeout);
    }

    function showErrorNotice(message) {
        if (!message) return;
        const notes = errorStack.querySelectorAll('.error-note');
        if (notes.length >= 6) notes[0].remove();
        const wrap = document.createElement('div');
        wrap.className = 'error-note';
        wrap.setAttribute('role','alert');

        const msgDiv = document.createElement('div');
        msgDiv.className = 'msg';
        msgDiv.textContent = message;

        const closeBtn = document.createElement('button');
        closeBtn.type='button';
        closeBtn.className='close';
        closeBtn.setAttribute('aria-label','Закрыть уведомление');
        closeBtn.innerHTML='&times;';
        closeBtn.addEventListener('click', ()=> wrap.remove());

        wrap.appendChild(msgDiv);
        wrap.appendChild(closeBtn);
        errorStack.appendChild(wrap);
    }

    function setLoading(state) {
        loading = state;
        reloadBtn.disabled = state;
        const btnText = reloadBtn.querySelector('.btn-text');
        if (state) {
            if (!reloadBtn.querySelector('.spinner')) {
                const sp = document.createElement('div');
                sp.className='spinner';
                reloadBtn.appendChild(sp);
            }
            if (btnText) btnText.style.visibility='hidden';
        } else {
            const sp = reloadBtn.querySelector('.spinner');
            if (sp) sp.remove();
            if (btnText) btnText.style.visibility='visible';
        }
    }

    function updateDirtyUI() {
        const count = dirtyMap.size;
        dirtyCountSpan.textContent = count;
        dirtyInfo.style.display = count ? 'inline-flex' : 'none';
        saveAllBtn.disabled = count === 0;
        resetBtn.disabled = count === 0;
        hintLine.textContent = count
            ? 'Есть несохранённые изменения ('+count+'). Нажмите "Сохранить все" или кнопку "Сохранить" в строке.'
            : '';
    }

    function updateSavingIndicator() {
        savingIndicator.style.display = savingSet.size ? 'flex' : 'none';
    }

    // Typing helpers
    function detectTypeStr(val) {
        if (val === 'true' || val === 'false') return 'boolean';
        if (/^-?\d+$/.test(val)) return 'int';
        if (/^-?\d+\.\d+$/.test(val)) return 'float';
        return 'string';
    }
    function coerce(val) {
        const t = detectTypeStr(val);
        if (t === 'boolean') return val === 'true';
        if (t === 'int') return parseInt(val,10);
        if (t === 'float') return parseFloat(val);
        return val;
    }
    function valueToString(v) {
        if (typeof v === 'boolean') return v ? 'true':'false';
        return String(v);
    }

    // Load
    async function load() {
        setLoading(true);
        try {
            const res = await fetch(API, { credentials:'include' });
            if (res.redirected && res.url.includes('/login')) {
                window.location = res.url; return;
            }
            if (!res.ok) {
                showErrorNotice('Ошибка загрузки: '+res.status);
                original = [];
                working = [];
            } else {
                const data = await res.json().catch(()=>[]);
                if (Array.isArray(data)) {
                    original = data.map(o => ({...o}));
                    working = data.map(o => ({...o, value: coerce(o.value)}));
                } else {
                    original = [];
                    working = [];
                }
            }
        } catch (e) {
            showErrorNotice('Сеть: '+e.message);
            original = [];
            working = [];
        } finally {
            dirtyMap.clear();
            renderAll();
            setLoading(false);
        }
    }

    function markRowChanged(name) {
        const tr = tbody.querySelector(`tr[data-name="${CSS.escape(name)}"]`);
        if (!tr) return;
        const orig = original.find(o => o.name === name);
        const item = working.find(w => w.name === name);
        const changed = orig && item && orig.value !== valueToString(item.value);
        tr.classList.toggle('changed', !!changed);
        if (changed) dirtyMap.set(name, valueToString(item.value));
        else dirtyMap.delete(name);
        tr.classList.remove('error-row');
        updateDirtyUI();
    }

    function markRowSaving(name, saving) {
        const tr = tbody.querySelector(`tr[data-name="${CSS.escape(name)}"]`);
        if (tr) tr.classList.toggle('saving', saving);
    }
    function markRowError(name, hasError) {
        const tr = tbody.querySelector(`tr[data-name="${CSS.escape(name)}"]`);
        if (tr) tr.classList.toggle('error-row', hasError);
    }

    // Filtering
    function filteredList() {
        const q = searchQuery.trim().toLowerCase();
        return working.filter(item => {
            const group = groupMapping[item.name] || 'general';
            if (activeGroup !== 'all' && group !== activeGroup) return false;
            if (!q) return true;
            return item.name.toLowerCase().includes(q) ||
                (item.comment && item.comment.toLowerCase().includes(q));
        });
    }

    function renderAll() {
        tbody.innerHTML = '';
        const list = filteredList();
        const showHeaders = activeGroup === 'all' && !searchQuery;

        if (showHeaders) {
            const grouped = {};
            list.forEach(it => {
                const g = groupMapping[it.name] || 'general';
                (grouped[g] ||= []).push(it);
            });
            Object.keys(grouped).sort().forEach(g => {
                const headTr = document.createElement('tr');
                const td = document.createElement('td');
                td.colSpan = 4;
                td.className = 'group-header';
                td.textContent = groupLabels[g] || g;
                headTr.appendChild(td);
                tbody.appendChild(headTr);
                grouped[g].forEach(item => appendRow(item));
            });
        } else {
            list.forEach(item => appendRow(item));
        }

        emptyState.style.display = list.length ? 'none' : 'block';
        metaInfo.textContent = 'Всего: ' + working.length + (list.length !== working.length ? (' / показано: '+list.length):'');
        updateDirtyUI();
    }

    function appendRow(item) {
        const tr = document.createElement('tr');
        tr.dataset.name = item.name;
        const orig = original.find(o => o.name === item.name);
        if (orig && orig.value !== valueToString(item.value)) tr.classList.add('changed');

        const tdName = document.createElement('td');
        tdName.textContent = item.name;

        const tdValue = document.createElement('td');
        tdValue.appendChild(buildValueControl(item));

        const tdComment = document.createElement('td');
        tdComment.textContent = item.comment || '';
        tdComment.className = 'settings-comment';

        const tdActions = document.createElement('td');
        tdActions.className='row-actions';
        tdActions.appendChild(buildRowActions(item.name));

        tr.appendChild(tdName);
        tr.appendChild(tdValue);
        tr.appendChild(tdComment);
        tr.appendChild(tdActions);
        tbody.appendChild(tr);
    }

    function buildRowActions(name) {
        const wrap = document.createElement('div');
        wrap.className='row-actions';

        const saveBtn = document.createElement('button');
        saveBtn.type='button';
        saveBtn.className='outline';
        saveBtn.textContent='Сохранить';
        saveBtn.addEventListener('click', ()=> saveSingle(name));

        const revertBtn = document.createElement('button');
        revertBtn.type='button';
        revertBtn.className='outline gray';
        revertBtn.textContent='Отменить';
        revertBtn.addEventListener('click', ()=> revertSingle(name));

        wrap.appendChild(saveBtn);
        wrap.appendChild(revertBtn);
        return wrap;
    }

    // Unified control builder (stable layout)
    function buildValueControl(item) {
        // BOOLEAN
        if (typeof item.value === 'boolean') {
            const wrap = document.createElement('div');
            wrap.className='value-wrap';
            const cb = document.createElement('input');
            cb.type='checkbox';
            cb.checked = item.value;
            cb.title = item.comment || item.name;
            cb.addEventListener('change', () => {
                item.value = cb.checked;
                markRowChanged(item.name);
            });
            wrap.appendChild(cb);
            return wrap;
        }

        // NUMBER
        if (typeof item.value === 'number') {
            const cfg = constraints[item.name];
            const wrap = document.createElement('div');
            wrap.className='value-wrap';
            const input = document.createElement('input');
            input.type='number';
            input.value = String(item.value);

            if (cfg && (cfg.type === 'int' || cfg.type === 'float')) {
                if (cfg.min != null) input.min = cfg.min;
                if (cfg.max != null) input.max = cfg.max;
                input.step = cfg.step != null ? cfg.step : (cfg.type === 'int' ? '1' : '0.01');
            } else {
                input.step='1';
            }

            input.addEventListener('input', () => {
                const raw = input.value.trim();
                input.classList.remove('invalid');

                if (raw === '') {
                    input.classList.add('invalid');
                    return;
                }
                if (cfg) {
                    if (cfg.type === 'int' && !/^-?\d+$/.test(raw)) { input.classList.add('invalid'); return; }
                    if (cfg.type === 'float' && !/^-?\d+(\.\d+)?$/.test(raw)) { input.classList.add('invalid'); return; }
                }
                let val = cfg && cfg.type === 'float' ? parseFloat(raw) : parseInt(raw,10);
                if (Number.isNaN(val)) { input.classList.add('invalid'); return; }
                if (cfg) {
                    if (cfg.min != null && val < cfg.min) { input.classList.add('invalid'); return; }
                    if (cfg.max != null && val > cfg.max) { input.classList.add('invalid'); return; }
                }
                item.value = val;
                markRowChanged(item.name);
            });

            wrap.appendChild(input);
            return wrap;
        }

        // STRING
        const wrap = document.createElement('div');
        wrap.className='value-wrap';
        const input = document.createElement('input');
        input.type='text';
        input.value = String(item.value ?? '');
        input.addEventListener('input', () => {
            item.value = input.value;
            markRowChanged(item.name);
        });
        wrap.appendChild(input);
        return wrap;
    }

    function revertSingle(name) {
        const orig = original.find(o => o.name === name);
        const work = working.find(w => w.name === name);
        if (!orig || !work) return;
        work.value = coerce(orig.value);
        markRowChanged(name);
        markRowError(name,false);
        const tr = tbody.querySelector(`tr[data-name="${CSS.escape(name)}"]`);
        if (tr) {
            const cell = tr.children[1];
            cell.innerHTML = '';
            cell.appendChild(buildValueControl(work));
        }
    }

    function validateBeforeSave(name) {
        const work = working.find(w => w.name === name);
        if (!work) return false;
        const cfg = constraints[name];
        if (!cfg) return true;
        if (cfg.type === 'int' || cfg.type === 'float') {
            const val = work.value;
            if (typeof val !== 'number' || Number.isNaN(val)) {
                showErrorNotice(`Поле ${name}: некорректное число`);
                return false;
            }
            if (cfg.min != null && val < cfg.min) {
                showErrorNotice(`Поле ${name}: значение < ${cfg.min}`);
                return false;
            }
            if (cfg.max != null && val > cfg.max) {
                showErrorNotice(`Поле ${name}: значение > ${cfg.max}`);
                return false;
            }
        }
        return true;
    }

    async function saveSingle(name) {
        if (!dirtyMap.has(name) || savingSet.has(name)) return;
        if (!validateBeforeSave(name)) return;

        savingSet.add(name);
        markRowSaving(name,true);
        updateSavingIndicator();
        markRowError(name,false);

        const newValue = dirtyMap.get(name);
        try {
            const res = await fetch(API, {
                method:'PUT',
                headers:{'Content-Type':'application/json'},
                credentials:'include',
                body: JSON.stringify({ name, value: newValue })
            });
            const text = await res.text().catch(()=> '');
            if (!res.ok) {
                markRowError(name,true);
                showErrorNotice(`Ошибка (${name}): ${text || ('HTTP '+res.status)}`);
                return;
            }
            const orig = original.find(o => o.name === name);
            if (orig) orig.value = newValue;
            dirtyMap.delete(name);
            const tr = tbody.querySelector(`tr[data-name="${CSS.escape(name)}"]`);
            if (tr) tr.classList.remove('changed');
            markRowError(name,false);
            showToast(`Сохранено: ${name}`, false, 1800);
        } catch (e) {
            markRowError(name,true);
            showErrorNotice(`Сеть (${name}): ${e.message}`);
        } finally {
            savingSet.delete(name);
            markRowSaving(name,false);
            updateSavingIndicator();
            updateDirtyUI();
        }
    }

    async function saveAll() {
        if (!dirtyMap.size) return;
        const names = [...dirtyMap.keys()];
        const errors = [];
        for (const n of names) {
            await saveSingle(n);
            if (dirtyMap.has(n)) errors.push(n);
        }
        if (!errors.length) {
            showToast('Все изменения сохранены', false, 2200);
        } else {
            showErrorNotice('Не удалось сохранить: '+errors.join(', '));
        }
    }

    function resetDirty() {
        if (!dirtyMap.size) return;
        [...dirtyMap.keys()].forEach(name => revertSingle(name));
        dirtyMap.clear();
        updateDirtyUI();
        showToast('Изменения сброшены', false, 1500);
    }

    // Search & filters
    searchInput.addEventListener('input', () => {
        searchQuery = searchInput.value;
        renderAll();
    });
    clearSearchBtn.addEventListener('click', () => {
        searchQuery = '';
        searchInput.value = '';
        renderAll();
    });

    // Events
    reloadBtn.addEventListener('click', () => load());
    saveAllBtn.addEventListener('click', () => saveAll());
    resetBtn.addEventListener('click', () => resetDirty());

    // Init
    load();

    // Warn on close if unsaved
    window.addEventListener('beforeunload', e => {
        if (dirtyMap.size) {
            e.preventDefault();
            e.returnValue = '';
        }
    });
})();