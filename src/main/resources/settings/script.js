(function() {
    const API = '/api/settings';

    // DOM refs
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

    // State
    let original = [];            // [{name,value,comment}]
    let working = [];             // копия со значениями в UI (типизированными)
    const dirtyMap = new Map();   // name -> newValue (string отправляемая форма)
    const savingSet = new Set();  // строки, которые сейчас сохраняются
    let loading = false;

    // Utils
    function showToast(msg, isError = false, timeout = 2600) {
        if (!msg) return;
        toastEl.textContent = msg;
        toastEl.className = 'toast' + (isError ? ' error' : '');
        toastEl.style.display = 'flex';
        clearTimeout(showToast._t);
        showToast._t = setTimeout(()=> toastEl.style.display='none', timeout);
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
            btnText && (btnText.style.visibility='hidden');
        } else {
            const sp = reloadBtn.querySelector('.spinner');
            sp && sp.remove();
            btnText && (btnText.style.visibility='visible');
        }
    }

    function updateDirtyUI() {
        const count = dirtyMap.size;
        dirtyCountSpan.textContent = count;
        dirtyInfo.style.display = count ? 'inline-flex' : 'none';
        saveAllBtn.disabled = count === 0;
        resetBtn.disabled = count === 0;
        hintLine.textContent = count
            ? 'Есть несохранённые изменения ('+count+'). Чтобы отправить их на сервер — нажмите "Сохранить все" или кнопки "Сохранить" в строках.'
            : '';
    }

    function detectType(valStr) {
        if (valStr === 'true' || valStr === 'false') return 'boolean';
        if (/^-?\d+$/.test(valStr)) return 'number';
        return 'string';
    }
    function coerce(valStr) {
        const t = detectType(valStr);
        if (t === 'boolean') return valStr === 'true';
        if (t === 'number') return parseInt(valStr, 10);
        return valStr;
    }

    function valueToString(raw) {
        // Всегда строка для передачи
        if (typeof raw === 'boolean') return raw ? 'true' : 'false';
        return String(raw);
    }

    function markRowChanged(name) {
        const tr = tbody.querySelector(`tr[data-name="${CSS.escape(name)}"]`);
        if (!tr) return;
        const orig = original.find(o => o.name === name);
        const currStr = valueToString(working.find(w => w.name === name).value);
        if (orig && orig.value !== currStr) {
            tr.classList.add('changed');
            dirtyMap.set(name, currStr);
        } else {
            tr.classList.remove('changed');
            dirtyMap.delete(name);
        }
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

    function updateSavingIndicator() {
        savingIndicator.style.display = savingSet.size ? 'flex' : 'none';
    }

    // Rendering
    function renderAll() {
        tbody.innerHTML = '';
        const frag = document.createDocumentFragment();
        working.forEach(item => {
            const tr = document.createElement('tr');
            tr.dataset.name = item.name;

            const orig = original.find(o => o.name === item.name);
            if (orig && orig.value !== valueToString(item.value)) {
                tr.classList.add('changed');
            }

            // name
            const tdName = document.createElement('td');
            tdName.textContent = item.name;

            // value
            const tdValue = document.createElement('td');
            tdValue.appendChild(buildValueControl(item));

            // comment
            const tdComment = document.createElement('td');
            tdComment.textContent = item.comment || '';

            // actions
            const tdActions = document.createElement('td');
            tdActions.appendChild(buildRowActions(item.name));
            tdActions.className='row-actions';

            tr.appendChild(tdName);
            tr.appendChild(tdValue);
            tr.appendChild(tdComment);
            tr.appendChild(tdActions);

            frag.appendChild(tr);
        });
        tbody.appendChild(frag);
        emptyState.style.display = working.length ? 'none' : 'block';
        metaInfo.textContent = 'Всего: ' + working.length;
        updateDirtyUI();
    }

    function buildRowActions(name) {
        const wrap = document.createElement('div');
        wrap.className = 'row-actions';

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

    function buildValueControl(item) {
        const type = typeof item.value;
        if (type === 'boolean') {
            const wrap = document.createElement('div');
            wrap.className='checkbox-wrap';
            const cb = document.createElement('input');
            cb.type='checkbox';
            cb.checked = item.value;
            cb.addEventListener('change', () => {
                item.value = cb.checked;
                markRowChanged(item.name);
            });
            const label = document.createElement('span');
            label.style.fontSize='.65rem';
            label.textContent = item.comment || item.name;
            wrap.appendChild(cb);
            wrap.appendChild(label);
            return wrap;
        }
        if (type === 'number') {
            const wrap = document.createElement('div');
            wrap.className='range-wrap';
            const lbl = document.createElement('div');
            lbl.className='range-label';
            lbl.innerHTML = `<span>${item.comment || item.name}:</span> <strong class="range-value">${item.value}</strong>`;
            const input = document.createElement('input');
            input.type='range';
            let max = 100;
            if (item.value > max) {
                const magnitude = Math.pow(10, Math.floor(Math.log10(item.value)));
                max = Math.ceil((item.value * 1.25) / magnitude) * magnitude;
            }
            input.min='0'; input.max=String(max); input.value=String(item.value);
            input.addEventListener('input', () => {
                const v = parseInt(input.value,10);
                item.value = v;
                lbl.querySelector('.range-value').textContent = v;
                markRowChanged(item.name);
            });
            wrap.appendChild(lbl);
            wrap.appendChild(input);
            return wrap;
        }
        // string
        const box = document.createElement('div');
        const label = document.createElement('label');
        label.style.display='block';
        label.style.fontSize='.6rem';
        label.style.letterSpacing='.05em';
        label.style.marginBottom='4px';
        label.textContent = item.comment || item.name;
        const input = document.createElement('input');
        input.type='text';
        input.value = String(item.value ?? '');
        input.addEventListener('input', () => {
            item.value = input.value;
            markRowChanged(item.name);
        });
        box.appendChild(label);
        box.appendChild(input);
        return box;
    }

    // Actions
    async function load() {
        setLoading(true);
        try {
            const res = await fetch(API, { credentials:'include' });
            if (res.redirected && res.url.includes('/login')) {
                window.location = res.url; return;
            }
            if (!res.ok) {
                showToast('Ошибка загрузки: '+res.status, true);
                original = [];
                working = [];
            } else {
                const data = await res.json().catch(()=>[]);
                if (Array.isArray(data)) {
                    original = data.map(o => ({...o})); // value как строка
                    working = data.map(o => ({
                        ...o,
                        value: coerce(o.value)
                    }));
                } else {
                    original = [];
                    working = [];
                }
            }
        } catch (e) {
            showToast('Сеть: '+e.message, true);
            original = [];
            working = [];
        } finally {
            dirtyMap.clear();
            renderAll();
            setLoading(false);
        }
    }

    function revertSingle(name) {
        const orig = original.find(o => o.name === name);
        const work = working.find(w => w.name === name);
        if (!orig || !work) return;
        work.value = coerce(orig.value);
        markRowChanged(name); // снимет changed, если совпало
        // перерисуем значение в строке
        const tr = tbody.querySelector(`tr[data-name="${CSS.escape(name)}"]`);
        if (tr) {
            const valueCell = tr.children[1];
            valueCell.innerHTML = '';
            valueCell.appendChild(buildValueControl(work));
        }
    }

    async function saveSingle(name) {
        if (!dirtyMap.has(name) || savingSet.has(name)) return;
        savingSet.add(name);
        markRowSaving(name, true);
        updateSavingIndicator();
        markRowError(name, false);
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
                showToast(`Ошибка (${name}): ${text || res.status}`, true);
                markRowError(name, true);
                return;
            }
            // успех - обновляем original
            const orig = original.find(o => o.name === name);
            if (orig) orig.value = newValue;
            dirtyMap.delete(name);
            const tr = tbody.querySelector(`tr[data-name="${CSS.escape(name)}"]`);
            tr && tr.classList.remove('changed');
            showToast(`Сохранено: ${name}`, false, 1500);
        } catch (e) {
            showToast(`Сеть (${name}): ${e.message}`, true);
            markRowError(name, true);
        } finally {
            savingSet.delete(name);
            markRowSaving(name, false);
            updateSavingIndicator();
            updateDirtyUI();
        }
    }

    async function saveAll() {
        if (!dirtyMap.size) return;
        // Сохраняем последовательно, чтобы первая ошибка остановила
        for (const [name] of dirtyMap.entries()) {
            await saveSingle(name);
            // если при сохранении осталась ошибка — прекращаем "массовое"
            if (dirtyMap.has(name)) {
                showToast('Массовое сохранение остановлено из-за ошибки.', true, 3500);
                return;
            }
        }
        if (!dirtyMap.size) {
            showToast('Все изменения сохранены', false, 1700);
        }
    }

    function resetDirty() {
        if (!dirtyMap.size) return;
        dirtyMap.forEach((_val, name) => revertSingle(name));
        dirtyMap.clear();
        updateDirtyUI();
        showToast('Изменения сброшены', false, 1300);
    }

    // Event handlers
    reloadBtn.addEventListener('click', () => load());
    saveAllBtn.addEventListener('click', () => saveAll());
    resetBtn.addEventListener('click', () => resetDirty());

    // Init
    load();
})();