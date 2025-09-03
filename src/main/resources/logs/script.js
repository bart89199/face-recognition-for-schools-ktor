(function() {
    // ==== ENDPOINTS ====
    const systemEndpoint = "/api/logs/system";
    const adminEndpoint  = "/api/logs/admin";

    // Dynamic types (will be loaded from /types endpoints)
    let SYSTEM_TYPES = [];
    let ADMIN_TYPES = [];

    // ==== DOM ====
    // System
    const sysStart = document.getElementById("sysStart");
    const sysEnd = document.getElementById("sysEnd");
    const sysLoadBtn = document.getElementById("sysLoadBtn");
    const sysCurrentBtn = document.getElementById("sysCurrentBtn");
    const sysDownloadBtn = document.getElementById("sysDownloadBtn");
    const sysClearBtn = document.getElementById("sysClearBtn");
    const sysTypesList = document.getElementById("sysTypesList");
    const sysSelectAllTypes = document.getElementById("sysSelectAllTypes");
    const sysClearTypes = document.getElementById("sysClearTypes");
    const sysTableBody = document.querySelector("#sysTable tbody");
    const sysCount = document.getElementById("sysCount");
    const sysFetchInfo = document.getElementById("sysFetchInfo");
    const sysTimeHeader = document.getElementById("sysTimeHeader");
    const sysSortInd = document.getElementById("sysSortInd");

    // Admin
    const admStart = document.getElementById("admStart");
    const admEnd = document.getElementById("admEnd");
    const admLoadBtn = document.getElementById("admLoadBtn");
    const admCurrentBtn = document.getElementById("admCurrentBtn");
    const admDownloadBtn = document.getElementById("admDownloadBtn");
    const admClearBtn = document.getElementById("admClearBtn");
    const admTypesList = document.getElementById("admTypesList");
    const admSelectAllTypes = document.getElementById("admSelectAllTypes");
    const admClearTypes = document.getElementById("admClearTypes");
    const admTableBody = document.querySelector("#admTable tbody");
    const admCount = document.getElementById("admCount");
    const admFetchInfo = document.getElementById("admFetchInfo");

    const admTimeHeader = document.getElementById("admTimeHeader");
    const admTypeHeader = document.getElementById("admTypeHeader");
    const admSessionHeader = document.getElementById("admSessionHeader");
    const admSortInd = document.getElementById("admSortInd");
    const admTypeSortInd = document.getElementById("admTypeSortInd");
    const admSessionSortInd = document.getElementById("admSessionSortInd");

    // Tabs / messages
    const adminTabBtn = document.getElementById("adminTabBtn");
    const systemTabBtn = document.getElementById("systemTabBtn");
    const adminTab = document.getElementById("adminTab");
    const systemTab = document.getElementById("systemTab");
    const errBox = document.getElementById("errBox");
    const okBox = document.getElementById("okBox");

    // ==== STATE ====
    let systemLogsData = [];
    let adminLogsData = [];
    let systemSortAsc = false; // time: newest -> oldest default
    let adminSort = { key: "time", asc: false };
    let systemLastMode = "range";
    let adminLastMode = "range";
    let userProfile = null;
    let systemTypesLoaded = false;
    let adminTypesLoaded = false;

    // WebSocket state
    let sysWs = null;
    let admWs = null;
    let sysWsReconnect = 0;
    let admWsReconnect = 0;
    const MAX_LOGS_BUFFER = 2000;

    // ==== UTIL ====
    function showError(msg) {
        if (!msg) return;
        errBox.textContent = msg;
        errBox.classList.add("show");
        okBox.classList.remove("show");
    }
    function showOk(msg) {
        if (!msg) return;
        okBox.textContent = msg;
        okBox.classList.add("show");
        errBox.classList.remove("show");
    }
    function clearMessages() { errBox.classList.remove("show"); okBox.classList.remove("show"); }

    function buildTypesList(container, values, preselectAll = true) {
        container.innerHTML = "";
        if (!values.length) {
            const div = document.createElement("div");
            div.style.fontSize=".65rem";
            div.style.opacity=".7";
            div.textContent = "Типы не найдены";
            container.appendChild(div);
            return;
        }
        values.forEach(v => {
            const row = document.createElement("label");
            row.className = "type-row";
            const cb = document.createElement("input");
            cb.type = "checkbox";
            cb.value = v;
            cb.checked = preselectAll;
            row.classList.toggle("checked", cb.checked);
            cb.addEventListener("change", () => row.classList.toggle("checked", cb.checked));
            row.appendChild(cb);
            row.appendChild(document.createTextNode(v));
            row.addEventListener("click", e => {
                if (e.target === cb) return;
                cb.checked = !cb.checked;
                row.classList.toggle("checked", cb.checked);
            });
            container.appendChild(row);
        });
    }

    function getCheckedTypes(container) {
        return [...container.querySelectorAll("input[type=checkbox]:checked")].map(i => i.value);
    }
    function setAllTypes(container, state) {
        container.querySelectorAll("input[type=checkbox]").forEach(cb => {
            cb.checked = state;
            cb.parentElement.classList.toggle("checked", state);
        });
    }

    function dtLocalToEpochMs(input) {
        if (!input || !input.value) return null;
        const ms = new Date(input.value).getTime();
        return isNaN(ms) ? null : ms;
    }
    function toLocalInputValue(date) {
        const p = n => String(n).padStart(2,"0");
        return `${date.getFullYear()}-${p(date.getMonth()+1)}-${p(date.getDate())}T${p(date.getHours())}:${p(date.getMinutes())}`;
    }
    function applyDefaultInterval() {
        const now = new Date();
        const endStr = toLocalInputValue(now);
        const start = new Date(now.getTime() - 24*3600*1000);
        const startStr = toLocalInputValue(start);
        sysStart.value = startStr; sysEnd.value = endStr;
        admStart.value = startStr; admEnd.value = endStr;
    }

    function buildQuery(startMs, endMs, typesArr) {
        const params = new URLSearchParams();
        if (startMs != null) params.set("start", String(startMs));
        if (endMs != null) params.set("end", String(endMs));
        if (typesArr && typesArr.length) params.set("type", typesArr.join(","));
        return params.toString();
    }

    function downloadRange(endpoint, startMs, endMs, typesArr) {
        const q = buildQuery(startMs, endMs, typesArr);
        const url = endpoint + (q ? "?" + q + "&download=true" : "?download=true");
        window.open(url, "_blank");
        showOk("Начата загрузка файла");
    }

    function formatDate(ms) {
        if (ms == null) return "";
        const d = new Date(ms);
        if (isNaN(d.getTime())) return "";
        return d.toLocaleString("ru-RU");
    }

    function setLoading(btn, loading) {
        if (!btn) return;
        if (loading) {
            btn.disabled = true;
            if (!btn.dataset.originalText) btn.dataset.originalText = btn.textContent;
            btn.innerHTML = '<div class="spinner"></div>';
        } else {
            btn.disabled = false;
            if (btn.dataset.originalText) {
                btn.textContent = btn.dataset.originalText;
                delete btn.dataset.originalText;
            }
        }
    }

    async function loadProfile() {
        try {
            const resp = await fetch("/api/user/profile", { credentials:"include" });
            if (resp.redirected && resp.url.includes("/login")) { window.location = resp.url; return; }
            if (!resp.ok) return;
            userProfile = await resp.json();
            const isAdmin = userProfile.root === true || (userProfile.permissions && userProfile.permissions.admin);
            if (!isAdmin) {
                adminTabBtn.classList.add("hidden");
                adminTab.classList.add("hidden");
            }
        } catch {}
    }

    // ==== TYPES FETCH ====
    async function fetchTypes(endpoint) {
        try {
            const resp = await fetch(`${endpoint}/types`, { credentials:"include" });
            if (resp.redirected && resp.url.includes("/login")) { window.location = resp.url; return []; }
            if (!resp.ok) return [];
            const data = await resp.json().catch(()=>[]);
            return Array.isArray(data) ? data : [];
        } catch {
            return [];
        }
    }

    async function loadSystemTypesIfNeeded() {
        if (systemTypesLoaded) return;
        sysTypesList.innerHTML = '<div style="font-size:.65rem;opacity:.7;">Загрузка...</div>';
        const types = await fetchTypes(systemEndpoint);
        if (types.length) SYSTEM_TYPES = types;
        systemTypesLoaded = true;
        buildTypesList(sysTypesList, SYSTEM_TYPES);
    }

    async function loadAdminTypesIfNeeded() {
        if (adminTypesLoaded) return;
        if (!userProfile || !(userProfile.root || (userProfile.permissions && userProfile.permissions.admin))) return;
        admTypesList.innerHTML = '<div style="font-size:.65rem;opacity:.7;">Загрузка...</div>';
        const types = await fetchTypes(adminEndpoint);
        if (types.length) ADMIN_TYPES = types;
        adminTypesLoaded = true;
        buildTypesList(admTypesList, ADMIN_TYPES);
    }

    // ==== FETCH LOGS (HTTP) ====
    async function fetchLogs(endpoint, mode, startMs, endMs, typesArr, btn) {
        clearMessages();
        setLoading(btn, true);
        try {
            let url;
            if (mode === "current") {
                const params = new URLSearchParams();
                if (typesArr && typesArr.length) params.set("type", typesArr.join(","));
                url = endpoint + "/current" + (params.toString() ? "?" + params.toString() : "");
            } else {
                const query = buildQuery(startMs, endMs, typesArr);
                url = endpoint + (query ? "?" + query : "");
            }
            const resp = await fetch(url, { credentials:"include" });
            if (resp.redirected && resp.url.includes("/login")) { window.location = resp.url; return []; }
            if (!resp.ok) {
                const tx = await resp.text().catch(()=> "");
                showError("Ошибка загрузки: " + (tx || resp.status));
                return [];
            }
            const data = await resp.json().catch(()=> []);
            return Array.isArray(data) ? data : [];
        } catch (e) {
            showError("Ошибка сети: " + e.message);
            return [];
        } finally {
            setLoading(btn, false);
        }
    }

    // ==== RENDER / SORT ====
    function sortSystem(list) {
        return [...list].sort((a,b)=> systemSortAsc ? a.time - b.time : b.time - a.time);
    }

    function sortAdmin(list) {
        const { key, asc } = adminSort;
        const mul = asc ? 1 : -1;
        return [...list].sort((a,b) => {
            if (key === "time") return (a.time - b.time) * mul;
            if (key === "type") return a.type.localeCompare(b.type) * mul || (a.time - b.time) * -1;
            if (key === "session") return (a.sessionId - b.sessionId) * mul || (a.time - b.time) * -1;
            return (a.time - b.time) * mul;
        });
    }

    function renderSystemLogs() {
        const data = sortSystem(systemLogsData);
        sysTableBody.innerHTML = "";
        sysCount.textContent = "Логов: " + data.length;
        if (!data.length) {
            const tr = document.createElement("tr");
            const td = document.createElement("td");
            td.colSpan = 3;
            td.style.padding = "14px";
            td.style.textAlign = "center";
            td.style.color = "#64748b";
            td.textContent = "Пусто";
            tr.appendChild(td);
            sysTableBody.appendChild(tr);
            return;
        }
        for (const log of data) {
            const tr = document.createElement("tr");
            tr.innerHTML = `
                <td class="nowrap mono">${formatDate(log.time)}</td>
                <td><span class="log-type-badge">${log.type}</span></td>
                <td class="mono">${log.message || ""}</td>
            `;
            sysTableBody.appendChild(tr);
        }
        sysSortInd.classList.toggle("asc", systemSortAsc);
        sysSortInd.classList.toggle("desc", !systemSortAsc);
    }

    function renderAdminLogs() {
        const data = sortAdmin(adminLogsData);
        admTableBody.innerHTML = "";
        admCount.textContent = "Логов: " + data.length;
        if (!data.length) {
            const tr = document.createElement("tr");
            const td = document.createElement("td");
            td.colSpan = 4;
            td.style.padding = "14px";
            td.style.textAlign = "center";
            td.style.color = "#64748b";
            td.textContent = "Пусто";
            tr.appendChild(td);
            admTableBody.appendChild(tr);
            updateAdminSortIndicators();
            return;
        }
        for (const log of data) {
            const tr = document.createElement("tr");
            tr.innerHTML = `
                <td class="nowrap mono">${formatDate(log.time)}</td>
                <td><span class="log-type-badge">${log.type}</span></td>
                <td class="mono nowrap">${log.sessionId != null ? log.sessionId : "-"}</td>
                <td class="mono">${log.message || ""}</td>
            `;
            admTableBody.appendChild(tr);
        }
        updateAdminSortIndicators();
    }

    function updateAdminSortIndicators() {
        const all = [
            {ind: admSortInd, key: "time"},
            {ind: admTypeSortInd, key: "type"},
            {ind: admSessionSortInd, key: "session"}
        ];
        all.forEach(({ind, key}) => {
            ind.classList.remove("asc","desc");
            if (adminSort.key === key) {
                ind.classList.add(adminSort.asc ? "asc":"desc");
            }
        });
    }

    // ==== WEBSOCKET HELPERS ====
    function makeWsUrl(path) {
        const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
        return `${proto}//${window.location.host}${path}`;
    }

    function shouldAcceptSystemLog(log) {
        // Accept only when in "current" mode
        if (systemLastMode !== "current") return false;
        const selected = getCheckedTypes(sysTypesList);
        if (!selected.length) return true;
        return selected.includes(log.type);
    }

    function shouldAcceptAdminLog(log) {
        if (adminLastMode !== "current") return false;
        const selected = getCheckedTypes(admTypesList);
        if (!selected.length) return true;
        return selected.includes(log.type);
    }

    function trimBuffer(arr) {
        if (arr.length > MAX_LOGS_BUFFER) {
            arr.splice(0, arr.length - MAX_LOGS_BUFFER);
        }
    }

    function connectSystemWs() {
        closeSystemWs();
        sysWsReconnect++;
        const url = makeWsUrl("/api/logs/system/ws");
        sysWs = new WebSocket(url);
        sysWs.onopen = () => { sysWsReconnect = 0; };
        sysWs.onmessage = ev => {
            try {
                const log = JSON.parse(ev.data);
                if (log && log.type && typeof log.time === "number") {
                    if (shouldAcceptSystemLog(log)) {
                        systemLogsData.push(log);
                        trimBuffer(systemLogsData);
                        renderSystemLogs();
                    }
                }
            } catch {}
        };
        sysWs.onclose = () => {
            // Reconnect only if still on current mode
            if (systemLastMode === "current") {
                const delay = Math.min(10000, 300 * sysWsReconnect);
                setTimeout(connectSystemWs, delay);
            }
        };
        sysWs.onerror = () => {
            try { sysWs.close(); } catch {}
        };
    }

    function closeSystemWs() {
        if (sysWs) {
            try { sysWs.close(); } catch {}
            sysWs = null;
        }
    }

    function connectAdminWs() {
        closeAdminWs();
        if (!userProfile || !(userProfile.root || (userProfile.permissions && userProfile.permissions.admin))) return;
        admWsReconnect++;
        const url = makeWsUrl("/api/logs/admin/ws");
        admWs = new WebSocket(url);
        admWs.onopen = () => { admWsReconnect = 0; };
        admWs.onmessage = ev => {
            try {
                const log = JSON.parse(ev.data);
                if (log && log.type && typeof log.time === "number") {
                    if (shouldAcceptAdminLog(log)) {
                        adminLogsData.push(log);
                        trimBuffer(adminLogsData);
                        renderAdminLogs();
                    }
                }
            } catch {}
        };
        admWs.onclose = () => {
            if (adminLastMode === "current") {
                const delay = Math.min(10000, 300 * admWsReconnect);
                setTimeout(connectAdminWs, delay);
            }
        };
        admWs.onerror = () => {
            try { admWs.close(); } catch {}
        };
    }

    function closeAdminWs() {
        if (admWs) {
            try { admWs.close(); } catch {}
            admWs = null;
        }
    }

    function refreshSystemWsBinding() {
        // If we are in current mode ensure WS connected; else close
        if (systemLastMode === "current") {
            if (!sysWs || sysWs.readyState === 3) connectSystemWs();
        } else {
            closeSystemWs();
        }
    }

    function refreshAdminWsBinding() {
        if (adminLastMode === "current") {
            if (!admWs || admWs.readyState === 3) connectAdminWs();
        } else {
            closeAdminWs();
        }
    }

    // ==== LOAD (wrapper) ====
    async function loadSystem(mode = "range") {
        await loadSystemTypesIfNeeded();
        const startMs = mode === "range" ? dtLocalToEpochMs(sysStart) : null;
        const endMs = mode === "range" ? dtLocalToEpochMs(sysEnd) : null;
        const types = getCheckedTypes(sysTypesList);
        systemLastMode = mode;
        systemLogsData = await fetchLogs(systemEndpoint, mode, startMs, endMs, types, mode === "current" ? sysCurrentBtn : sysLoadBtn);
        sysFetchInfo.textContent = mode === "current" ? "Показаны текущие логи (live)" : "";
        renderSystemLogs();
        refreshSystemWsBinding();
    }

    async function loadAdmin(mode = "range") {
        await loadAdminTypesIfNeeded();
        const startMs = mode === "range" ? dtLocalToEpochMs(admStart) : null;
        const endMs = mode === "range" ? dtLocalToEpochMs(admEnd) : null;
        const types = getCheckedTypes(admTypesList);
        adminLastMode = mode;
        adminLogsData = await fetchLogs(adminEndpoint, mode, startMs, endMs, types, mode === "current" ? admCurrentBtn : admLoadBtn);
        admFetchInfo.textContent = mode === "current" ? "Показаны текущие логи (live)" : "";
        renderAdminLogs();
        refreshAdminWsBinding();
    }

    // ==== EVENTS: System ====
    sysLoadBtn.addEventListener("click", () => loadSystem("range"));
    sysCurrentBtn.addEventListener("click", () => loadSystem("current"));
    sysDownloadBtn.addEventListener("click", () => {
        if (systemLastMode === "current") { showError("Скачивание 'текущих' не поддерживается. Переключитесь на интервал."); return; }
        downloadRange(systemEndpoint, dtLocalToEpochMs(sysStart), dtLocalToEpochMs(sysEnd), getCheckedTypes(sysTypesList));
    });
    sysClearBtn.addEventListener("click", () => {
        sysStart.value = "";
        sysEnd.value = "";
        setAllTypes(sysTypesList,false);
        systemLogsData = [];
        sysCount.textContent = "";
        sysFetchInfo.textContent = "";
        renderSystemLogs();
        showOk("Очищено");
        refreshSystemWsBinding();
    });
    sysSelectAllTypes.addEventListener("click", () => {
        setAllTypes(sysTypesList, true);
        if (systemLastMode === "current") {
            // Перефильтровать буфер
            systemLogsData = systemLogsData.filter(l => shouldAcceptSystemLog(l) || true); // noop
            renderSystemLogs();
        }
    });
    sysClearTypes.addEventListener("click", () => {
        setAllTypes(sysTypesList, false);
        if (systemLastMode === "current") {
            // При отсутствии выбранных типов показываем все текущие
            renderSystemLogs();
        }
    });
    sysTimeHeader.addEventListener("click", () => {
        systemSortAsc = !systemSortAsc;
        renderSystemLogs();
    });
    sysTimeHeader.addEventListener("keydown", e => {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); sysTimeHeader.click(); }
    });

    // ==== EVENTS: Admin ====
    admLoadBtn.addEventListener("click", () => loadAdmin("range"));
    admCurrentBtn.addEventListener("click", () => loadAdmin("current"));
    admDownloadBtn.addEventListener("click", () => {
        if (adminLastMode === "current") { showError("Скачивание 'текущих' не поддерживается. Переключитесь на интервал."); return; }
        downloadRange(adminEndpoint, dtLocalToEpochMs(admStart), dtLocalToEpochMs(admEnd), getCheckedTypes(admTypesList));
    });
    admClearBtn.addEventListener("click", () => {
        admStart.value = "";
        admEnd.value = "";
        setAllTypes(admTypesList,false);
        adminLogsData = [];
        admCount.textContent = "";
        admFetchInfo.textContent = "";
        renderAdminLogs();
        showOk("Очищено");
        refreshAdminWsBinding();
    });
    admSelectAllTypes.addEventListener("click", () => {
        setAllTypes(admTypesList, true);
        if (adminLastMode === "current") renderAdminLogs();
    });
    admClearTypes.addEventListener("click", () => {
        setAllTypes(admTypesList, false);
        if (adminLastMode === "current") renderAdminLogs();
    });

    function toggleAdminSort(key) {
        if (adminSort.key === key) {
            adminSort.asc = !adminSort.asc;
        } else {
            adminSort.key = key;
            adminSort.asc = key !== "time";
        }
        renderAdminLogs();
    }

    [admTimeHeader, admTypeHeader, admSessionHeader].forEach(header => {
        header.addEventListener("click", () => toggleAdminSort(
            header === admTimeHeader ? "time" :
                header === admTypeHeader ? "type" : "session"
        ));
        header.addEventListener("keydown", e => {
            if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                header.click();
            }
        });
    });

    // ==== Tabs ====
    document.getElementById("tabs").addEventListener("click", async e => {
        const btn = e.target.closest(".tab-btn");
        if (!btn || btn.disabled) return;
        const tab = btn.dataset.tab;
        if (!tab) return;
        [...document.querySelectorAll(".tab-btn")].forEach(b => b.classList.toggle("active", b === btn));
        systemTab.classList.toggle("hidden", tab !== "systemTab");
        adminTab.classList.toggle("hidden", tab !== "adminTab");
        clearMessages();
        if (tab === "systemTab" && systemLogsData.length === 0) {
            await loadSystemTypesIfNeeded();
            await loadSystem("current");
        }
        if (tab === "adminTab" && !adminTabBtn.classList.contains("hidden") && adminLogsData.length === 0) {
            await loadAdminTypesIfNeeded();
            await loadAdmin("current");
        }
    });

    // Date inputs Enter -> refresh
    [sysStart, sysEnd].forEach(inp => inp.addEventListener("keydown", e => { if (e.key === "Enter") sysLoadBtn.click(); }));
    [admStart, admEnd].forEach(inp => inp.addEventListener("keydown", e => { if (e.key === "Enter") admLoadBtn.click(); }));

    // ==== INIT ====
    async function init() {
        applyDefaultInterval();

        // Placeholders
        sysTypesList.innerHTML = '<div style="font-size:.65rem;opacity:.7;">Загрузка...</div>';
        admTypesList.innerHTML = '<div style="font-size:.65rem;opacity:.7;">—</div>';

        await loadProfile();
        await loadSystemTypesIfNeeded();
        await loadSystem("current");

        if (userProfile && (userProfile.root || (userProfile.permissions && userProfile.permissions.admin))) {
            loadAdminTypesIfNeeded();
        }

        window.addEventListener("beforeunload", () => {
            closeSystemWs();
            closeAdminWs();
        });
    }
    init();
})();