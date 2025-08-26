(function() {
    // ===== ENUM LISTS (sync with backend) =====
    const SYSTEM_TYPES = [
        "SYSTEM_START","SYSTEM_STOP","DOOR","RECOGNIZE","SETTINGS_CHANGE",
        "BACKUP_CREATE","BACKUP_DELETE","BACKUP_UPLOAD","FRAME_ADD","FRAME_REMOVE",
        "HUMAN_ADD","HUMAN_REMOVE","FORM_CREATE","FORM_DELETE","FORM_UPLOAD",
        "FORM_ANSWER_ADD","FORM_ANSWER_REMOVE","WARN","ERROR"
    ];
    const ADMIN_TYPES = [
        "USER_LOGIN","USER_LOGOUT","USER_CREATED","USER_UPDATE","USER_DELETE",
        "SESSION_DELETE","DOOR","LOGS_DOWNLOAD","RECORD_DOWNLOAD","SETTINGS_CHANGE",
        "BACKUP_CREATE","BACKUP_DELETE","BACKUP_UPLOAD","FORM_CREATE","FORM_UPLOAD",
        "FORM_DELETE","FRAME_ADD","FRAME_REMOVE","HUMAN_ADD","HUMAN_REMOVE"
    ];

    // ===== CORRECT ENDPOINTS AFTER FIX =====
    const systemEndpoint = "/api/logs/system";
    const adminEndpoint  = "/api/logs/admin";

    // ===== DOM =====
    const sysStart = document.getElementById("sysStart");
    const sysEnd   = document.getElementById("sysEnd");
    const admStart = document.getElementById("admStart");
    const admEnd   = document.getElementById("admEnd");

    const sysLoadBtn = document.getElementById("sysLoadBtn");
    const sysClearBtn = document.getElementById("sysClearBtn");
    const sysDownloadBtn = document.getElementById("sysDownloadBtn");
    const admLoadBtn = document.getElementById("admLoadBtn");
    const admClearBtn = document.getElementById("admClearBtn");
    const admDownloadBtn = document.getElementById("admDownloadBtn");

    const sysSelectAllTypes = document.getElementById("sysSelectAllTypes");
    const sysClearTypes = document.getElementById("sysClearTypes");
    const admSelectAllTypes = document.getElementById("admSelectAllTypes");
    const admClearTypes = document.getElementById("admClearTypes");

    const sysTypesGrid = document.getElementById("sysTypesGrid");
    const admTypesGrid = document.getElementById("admTypesGrid");

    const sysTableBody = document.querySelector("#sysTable tbody");
    const admTableBody = document.querySelector("#admTable tbody");
    const sysCount = document.getElementById("sysCount");
    const admCount = document.getElementById("admCount");

    const errBox = document.getElementById("errBox");
    const okBox = document.getElementById("okBox");

    const systemTabBtn = document.getElementById("systemTabBtn");
    const adminTabBtn = document.getElementById("adminTabBtn");
    const systemTab = document.getElementById("systemTab");
    const adminTab = document.getElementById("adminTab");

    // ===== STATE =====
    let userProfile = null;
    let systemLoaded = false;
    let adminLoaded = false;

    // ===== UTIL =====
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
    function clearMessages() {
        errBox.classList.remove("show");
        okBox.classList.remove("show");
    }

    function buildCheckboxGrid(container, values) {
        container.innerHTML = "";
        values.forEach(v => {
            const label = document.createElement("label");
            label.className = "type-chip";
            const cb = document.createElement("input");
            cb.type = "checkbox";
            cb.value = v;
            cb.addEventListener("change", () => {
                label.classList.toggle("active", cb.checked);
            });
            const span = document.createElement("span");
            span.textContent = v;
            label.appendChild(cb);
            label.appendChild(span);
            container.appendChild(label);
        });
    }

    function getChecked(container) {
        return [...container.querySelectorAll('input[type=checkbox]:checked')].map(i => i.value);
    }

    function setAll(container, state) {
        container.querySelectorAll('input[type=checkbox]').forEach(cb => {
            cb.checked = state;
            cb.parentElement.classList.toggle("active", state);
        });
    }

    function dtLocalToEpochMs(input) {
        const v = input.value;
        if (!v) return null;
        const ms = new Date(v).getTime();
        return isNaN(ms) ? null : ms;
    }

    function formatDate(ms) {
        if (ms == null) return "";
        const d = new Date(ms);
        return isNaN(d.getTime()) ? "" : d.toLocaleString("ru-RU");
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

    function applyDefaultInterval() {
        const now = new Date();
        const endStr = toLocalInputValue(now);
        const start = new Date(now.getTime() - 24 * 3600 * 1000);
        const startStr = toLocalInputValue(start);
        sysStart.value = startStr;
        sysEnd.value = endStr;
        admStart.value = startStr;
        admEnd.value = endStr;
    }

    function toLocalInputValue(date) {
        const pad = n => String(n).padStart(2,"0");
        return `${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
    }

    function buildQuery(startMs, endMs, typesArr) {
        const params = new URLSearchParams();
        if (startMs != null) params.set("start", String(startMs));
        if (endMs != null) params.set("end", String(endMs));
        if (typesArr && typesArr.length) params.set("type", typesArr.join(","));
        return params.toString();
    }

    function downloadLogs(endpoint, startMs, endMs, typesArr) {
        const query = buildQuery(startMs, endMs, typesArr);
        const url = endpoint + (query ? "?" + query + "&download=true" : "?download=true");
        window.open(url, "_blank");
        showOk("Начата загрузка файла");
    }

    async function loadProfile() {
        try {
            const resp = await fetch("/api/user/profile", { credentials:"include" });
            if (resp.redirected && resp.url.includes("/login")) {
                window.location = resp.url;
                return;
            }
            if (!resp.ok) return;
            userProfile = await resp.json();
            const isAdmin = (userProfile.root === true) || (userProfile.permissions && userProfile.permissions.admin);
            if (!isAdmin) {
                adminTabBtn.classList.add("hidden");
                adminTab.classList.add("hidden");
            }
        } catch (_e) { /* ignore */ }
    }

    async function fetchLogs(endpoint, startMs, endMs, typesArr, targetTbody, counterEl, btn) {
        clearMessages();
        setLoading(btn, true);
        try {
            const query = buildQuery(startMs, endMs, typesArr);
            const resp = await fetch(endpoint + (query ? ("?" + query) : ""), { credentials:"include" });
            if (resp.redirected && resp.url.includes("/login")) {
                window.location = resp.url;
                return;
            }
            if (!resp.ok) {
                const tx = await resp.text().catch(()=> "");
                showError("Ошибка загрузки: " + (tx || resp.status));
                renderLogs([], targetTbody, counterEl, endpoint === adminEndpoint);
                return;
            }
            const data = await resp.json().catch(()=> []);
            renderLogs(Array.isArray(data)? data : [], targetTbody, counterEl, endpoint === adminEndpoint);
        } catch (e) {
            showError("Ошибка сети: " + e.message);
            renderLogs([], targetTbody, counterEl, endpoint === adminEndpoint);
        } finally {
            setLoading(btn, false);
        }
    }

    function renderLogs(list, tbody, counterEl, isAdmin) {
        tbody.innerHTML = "";
        counterEl.textContent = "Логов: " + list.length;
        if (!list.length) {
            const tr = document.createElement("tr");
            const td = document.createElement("td");
            td.colSpan = isAdmin ? 4 : 3;
            td.style.padding = "14px";
            td.style.textAlign = "center";
            td.style.color = "var(--muted,#64748b)";
            td.textContent = "Пусто";
            tr.appendChild(td);
            tbody.appendChild(tr);
            return;
        }
        list.sort((a,b)=> a.time - b.time);
        for (const log of list) {
            const tr = document.createElement("tr");

            const timeTd = document.createElement("td");
            timeTd.className = "nowrap mono";
            timeTd.textContent = formatDate(log.time);
            tr.appendChild(timeTd);

            const typeTd = document.createElement("td");
            typeTd.innerHTML = `<span class="log-type-badge">${log.type}</span>`;
            tr.appendChild(typeTd);

            const msgTd = document.createElement("td");
            msgTd.className = "mono";
            msgTd.textContent = log.message || "";
            tr.appendChild(msgTd);

            if (isAdmin) {
                const sesTd = document.createElement("td");
                sesTd.className = "mono nowrap";
                sesTd.textContent = (log.sessionId != null) ? String(log.sessionId) : "-";
                tr.appendChild(sesTd);
            }

            tbody.appendChild(tr);
        }
    }

    function attachTabHandlers() {
        document.getElementById("tabs").addEventListener("click", async e => {
            const btn = e.target.closest(".tab-btn");
            if (!btn || btn.disabled) return;
            const tab = btn.dataset.tab;
            if (!tab) return;
            [...document.querySelectorAll(".tab-btn")].forEach(b=> b.classList.toggle("active", b===btn));
            [...document.querySelectorAll("main > section")].forEach(sec => {
                sec.id === tab ? sec.classList.remove("hidden") : sec.classList.add("hidden");
            });
            clearMessages();
            if (tab === "adminTab" && !adminLoaded && !adminTabBtn.classList.contains("hidden")) {
                await loadAdminLogs();
            }
            if (tab === "systemTab" && !systemLoaded) {
                await loadSystemLogs();
            }
        });
    }

    function dtInputsEnter(inputs, button) {
        inputs.forEach(inp => inp.addEventListener("keydown", e=>{
            if (e.key === "Enter") button.click();
        }));
    }

    // ===== LOAD WRAPPERS =====
    function loadSystemLogs() {
        const startMs = dtLocalToEpochMs(sysStart);
        const endMs = dtLocalToEpochMs(sysEnd);
        const types = getChecked(sysTypesGrid);
        systemLoaded = true;
        return fetchLogs(systemEndpoint, startMs, endMs, types, sysTableBody, sysCount, sysLoadBtn);
    }
    function loadAdminLogs() {
        const startMs = dtLocalToEpochMs(admStart);
        const endMs = dtLocalToEpochMs(admEnd);
        const types = getChecked(admTypesGrid);
        adminLoaded = true;
        return fetchLogs(adminEndpoint, startMs, endMs, types, admTableBody, admCount, admLoadBtn);
    }

    // ===== EVENTS =====
    sysLoadBtn.addEventListener("click", loadSystemLogs);
    sysClearBtn.addEventListener("click", () => {
        sysStart.value = "";
        sysEnd.value = "";
        setAll(sysTypesGrid, false);
        clearMessages();
        sysTableBody.innerHTML = "";
        sysCount.textContent = "";
        systemLoaded = false;
    });
    sysDownloadBtn.addEventListener("click", () => {
        const startMs = dtLocalToEpochMs(sysStart);
        const endMs = dtLocalToEpochMs(sysEnd);
        downloadLogs(systemEndpoint, startMs, endMs, getChecked(sysTypesGrid));
    });
    sysSelectAllTypes.addEventListener("click", () => setAll(sysTypesGrid, true));
    sysClearTypes.addEventListener("click", () => setAll(sysTypesGrid, false));

    admLoadBtn.addEventListener("click", loadAdminLogs);
    admClearBtn.addEventListener("click", () => {
        admStart.value = "";
        admEnd.value = "";
        setAll(admTypesGrid, false);
        clearMessages();
        admTableBody.innerHTML = "";
        admCount.textContent = "";
        adminLoaded = false;
    });
    admDownloadBtn.addEventListener("click", () => {
        const startMs = dtLocalToEpochMs(admStart);
        const endMs = dtLocalToEpochMs(admEnd);
        downloadLogs(adminEndpoint, startMs, endMs, getChecked(admTypesGrid));
    });
    admSelectAllTypes.addEventListener("click", () => setAll(admTypesGrid, true));
    admClearTypes.addEventListener("click", () => setAll(admTypesGrid, false));

    dtInputsEnter([sysStart, sysEnd], sysLoadBtn);
    dtInputsEnter([admStart, admEnd], admLoadBtn);

    // ===== INIT =====
    function init() {
        buildCheckboxGrid(sysTypesGrid, SYSTEM_TYPES);
        buildCheckboxGrid(admTypesGrid, ADMIN_TYPES);
        applyDefaultInterval();
        attachTabHandlers();
        loadProfile().then(() => {
            // Автозагрузка system логов
            loadSystemLogs();
        });
    }

    init();
})();