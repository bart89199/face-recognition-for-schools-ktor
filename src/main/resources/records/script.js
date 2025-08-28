(function() {
    const API = '/api/records';

    const startInput = document.getElementById('startInput');
    const endInput = document.getElementById('endInput');
    const nameFilter = document.getElementById('nameFilter');

    const loadBtn = document.getElementById('loadBtn');
    const clearBtn = document.getElementById('clearBtn');
    const downloadSelectedBtn = document.getElementById('downloadSelectedBtn');
    const toggleSelectAllBtn = document.getElementById('toggleSelectAllBtn');

    const table = document.getElementById('recordsTable');
    const tbody = table.querySelector('tbody');
    const metaLine = document.getElementById('metaLine');
    const emptyState = document.getElementById('emptyState');
    const toastEl = document.getElementById('toast');

    let original = [];
    let filtered = [];
    let selected = new Set();
    let sortState = { key: 'created', asc: false };

    function showToast(msg, error=false, timeout=2500){
        if(!msg) return;
        toastEl.textContent = msg;
        toastEl.className = 'toast' + (error? ' error':'');
        toastEl.style.display='flex';
        clearTimeout(showToast._t);
        showToast._t = setTimeout(()=> toastEl.style.display='none', timeout);
    }

    function toLocalInputValue(date){
        const p=n=>String(n).padStart(2,'0');
        return `${date.getFullYear()}-${p(date.getMonth()+1)}-${p(date.getDate())}T${p(date.getHours())}:${p(date.getMinutes())}`;
    }

    function initDefaultRange(){
        const now = new Date();
        const start = new Date(now.getTime() - 24*3600*1000);
        startInput.value = toLocalInputValue(start);
        endInput.value = toLocalInputValue(now);
    }

    function parseDtLocal(inp){
        if(!inp.value) return null;
        const ms = new Date(inp.value).getTime();
        return isNaN(ms)? null : ms;
    }

    async function loadRecords(){
        const start = parseDtLocal(startInput);
        const end = parseDtLocal(endInput);

        let url = API;
        const params = new URLSearchParams();
        if(start != null) params.set('start', String(start));
        if(end != null) params.set('end', String(end));
        if(start != null || end != null){
            url += '?' + params.toString();
        }

        setLoading(true);
        try {
            const resp = await fetch(url, { credentials:'include' });
            if(resp.redirected && resp.url.includes('/login')){
                window.location = resp.url;
                return;
            }
            if(!resp.ok){
                showToast('Ошибка загрузки: ' + resp.status, true);
                original = [];
            } else {
                const data = await resp.json().catch(()=>[]);
                original = Array.isArray(data)? data : [];
            }
        } catch(e){
            showToast('Сеть: '+e.message, true);
            original = [];
        } finally {
            applyFiltersAndRender();
            setLoading(false);
        }
    }

    function applyFiltersAndRender(){
        const q = nameFilter.value.trim().toLowerCase();
        filtered = original.filter(r => {
            if(!q) return true;
            return r.filename.toLowerCase().includes(q);
        });
        sortAndRender();
    }

    function sortAndRender(){
        const { key, asc } = sortState;
        filtered.sort((a,b)=>{
            if(key === 'filename'){
                return asc
                    ? a.filename.localeCompare(b.filename)
                    : b.filename.localeCompare(a.filename);
            }
            const av = a[key];
            const bv = b[key];
            return asc ? (av - bv) : (bv - av);
        });
        renderTable();
    }

    function fmt(ms){
        if(ms == null) return '';
        const d = new Date(ms);
        if(isNaN(d.getTime())) return '-';
        return d.toLocaleString();
    }

    function renderTable(){
        tbody.innerHTML='';
        const count = filtered.length;
        if(!count){
            emptyState.style.display='block';
            metaLine.textContent='Нет записей';
        } else {
            emptyState.style.display='none';
            metaLine.textContent = `Всего: ${original.length} / отображается: ${filtered.length} / выбранных: ${selected.size}`;
        }

        filtered.forEach(r=>{
            const tr = document.createElement('tr');
            if(selected.has(r.filename)) tr.classList.add('selected');
            tr.dataset.filename = r.filename;

            const tdName = document.createElement('td');
            tdName.textContent = r.filename;

            const tdCreated = document.createElement('td');
            tdCreated.className='mono';
            tdCreated.textContent = fmt(r.created);

            const tdMod = document.createElement('td');
            tdMod.className='mono';
            tdMod.textContent = fmt(r.last_modified);

            const tdDl = document.createElement('td');
            const btn = document.createElement('button');
            btn.type='button';
            btn.className='outline';
            btn.style.fontSize='.6rem';
            btn.style.padding='5px 8px';
            btn.textContent='Скачать';
            btn.addEventListener('click', (e)=>{
                e.stopPropagation();
                downloadOne(r.filename);
            });
            tdDl.appendChild(btn);

            tr.appendChild(tdName);
            tr.appendChild(tdCreated);
            tr.appendChild(tdMod);
            tr.appendChild(tdDl);

            tr.addEventListener('click', ()=>{
                if(selected.has(r.filename)) selected.delete(r.filename);
                else selected.add(r.filename);
                renderTable();
                updateButtons();
            });

            tbody.appendChild(tr);
        });

        updateButtons();
        updateSortHeaders();
    }

    function updateButtons(){
        downloadSelectedBtn.disabled = selected.size === 0;
        toggleSelectAllBtn.textContent = (selected.size && selected.size === filtered.length)
            ? 'Снять выделение'
            : 'Выделить все';
        metaLine.textContent = `Всего: ${original.length} / отображается: ${filtered.length} / выбранных: ${selected.size}`;
    }

    function downloadOne(filename){
        // Открываем в новой вкладке / начинаем загрузку
        window.open(`${API}?filename=${encodeURIComponent(filename)}`, '_blank');
    }

    function downloadSelected(){
        // Простая стратегия: открыть каждую в новой вкладке (браузер может заблокировать, если много)
        const arr = Array.from(selected);
        if(!arr.length) return;
        arr.forEach((f,i)=>{
            setTimeout(()=> {
                window.open(`${API}?filename=${encodeURIComponent(f)}`, '_blank');
            }, i * 200); // небольшая задержка чтобы уменьшить блокировки popup
        });
        showToast(`Старт загрузки: ${arr.length} файл(ов)`);
    }

    function toggleSelectAll(){
        if(filtered.length && selected.size === filtered.length){
            selected.clear();
        } else {
            filtered.forEach(r => selected.add(r.filename));
        }
        renderTable();
    }

    function clearFilters(){
        nameFilter.value='';
        selected.clear();
        initDefaultRange();
        loadRecords();
    }

    function setLoading(state){
        const btnText = loadBtn.querySelector('.btn-text');
        if(state){
            loadBtn.disabled = true;
            if(!loadBtn.querySelector('.spinner')){
                const sp = document.createElement('div');
                sp.className='spinner';
                loadBtn.appendChild(sp);
            }
            if(btnText) btnText.style.visibility='hidden';
        } else {
            loadBtn.disabled = false;
            const sp = loadBtn.querySelector('.spinner');
            if(sp) sp.remove();
            if(btnText) btnText.style.visibility='visible';
        }
    }

    // Сортировка
    function updateSortHeaders(){
        table.querySelectorAll('th[data-sort]').forEach(th=>{
            const key = th.dataset.sort;
            th.style.opacity = (sortState.key === key) ? '1' : '.7';
            th.title = 'Сортировка: ' + key + (sortState.key === key ? (sortState.asc ? ' (↑)' : ' (↓)') : '');
        });
    }

    table.querySelectorAll('th[data-sort]').forEach(th=>{
        th.addEventListener('click', ()=>{
            const key = th.dataset.sort;
            if(sortState.key === key){
                sortState.asc = !sortState.asc;
            } else {
                sortState.key = key;
                sortState.asc = (key === 'filename'); // для имени по возрастанию по умолчанию
            }
            sortAndRender();
        });
    });

    // Events
    loadBtn.addEventListener('click', ()=> loadRecords());
    clearBtn.addEventListener('click', clearFilters);
    nameFilter.addEventListener('input', ()=> applyFiltersAndRender());
    downloadSelectedBtn.addEventListener('click', downloadSelected);
    toggleSelectAllBtn.addEventListener('click', toggleSelectAll);

    [startInput, endInput].forEach(inp=>{
        inp.addEventListener('keydown', e=>{
            if(e.key === 'Enter'){
                e.preventDefault();
                loadRecords();
            }
        });
    });

    // init
    initDefaultRange();
    loadRecords();

})();