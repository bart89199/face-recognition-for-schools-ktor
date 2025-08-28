(function () {
    const WS_URL = (location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + '/api/status/ws';
    const FORCE_URL = '/api/door/force';

    // WS DOM
    const wsStateEl = document.getElementById('wsState');
    const doorValueEl = document.getElementById('doorValue');
    const doorHintEl = document.getElementById('doorHint');
    const lastUpdateEl = document.getElementById('lastUpdate');
    const lastRecognizedEl = document.getElementById('lastRecognized');
    const recognitionHintEl = document.getElementById('recognitionHint');

    // Force control DOM
    const forceStatusLine = document.getElementById('forceStatusLine');
    const doorForceControls = document.getElementById('doorForceControls');
    const btnForceOpen = document.getElementById('btnForceOpen');
    const btnForceClose = document.getElementById('btnForceClose');
    const btnForceReset = document.getElementById('btnForceReset');

    // State
    let ws = null;
    let reconnectTimer = null;
    let manualClosed = false;
    let previousRecognitions = new Set();
    let lastShownRecognition = null;

    let currentForce = null; // null | true | false
    let forceForbidden = false;
    let forceMsgTimer = null;

    function setWsState(state) {
        wsStateEl.textContent = state.toUpperCase();
        wsStateEl.className = 'ws-badge ' + state;
    }

    function scheduleReconnect() {
        if (reconnectTimer) return;
        reconnectTimer = setTimeout(() => {
            reconnectTimer = null;
            if (!manualClosed) connect();
        }, 3000);
    }

    function connect() {
        manualClosed = false;
        if (ws) {
            try { ws.close(); } catch (_) {}
        }
        setWsState('connecting');
        ws = new WebSocket(WS_URL);

        ws.onopen = () => setWsState('connected');
        ws.onclose = () => {
            setWsState('closed');
            if (!manualClosed) scheduleReconnect();
        };
        ws.onerror = () => setWsState('closed');
        ws.onmessage = (ev) => applyStatus(ev.data);
    }

    function applyStatus(raw) {
        let data;
        try { data = JSON.parse(raw); } catch { return; }
        if (!data) return;

        if (typeof data.time === 'number') {
            const serverDate = new Date(data.time);
            lastUpdateEl.textContent =
                'Последнее обновление: ' + serverDate.toLocaleString();
        }

        if (typeof data.door === 'boolean') {
            doorValueEl.textContent = data.door ? 'Открыта' : 'Закрыта';
            doorValueEl.className = 'value ' + (data.door ? 'status-ok' : '');
            doorHintEl.textContent = data.door ? 'Дверь сейчас открыта' : 'Дверь закрыта';
        }

        handleRecognition(data.recognitions);
    }

    function handleRecognition(recognitions) {
        if (!Array.isArray(recognitions)) {
            recognitionHintEl.textContent = 'Нет данных';
            return;
        }
        const currentSet = new Set(recognitions);
        let newest = null;
        for (const name of currentSet) {
            if (!previousRecognitions.has(name)) newest = name;
        }

        if (newest) {
            lastShownRecognition = newest;
            lastRecognizedEl.textContent = newest;
            lastRecognizedEl.className = 'value status-ok';
            recognitionHintEl.textContent = 'Новое распознавание';
        } else {
            if (currentSet.size === 0 && !lastShownRecognition) {
                lastRecognizedEl.textContent = '—';
                lastRecognizedEl.className = 'value';
                recognitionHintEl.textContent = 'Распознаваний нет';
            } else if (lastShownRecognition) {
                recognitionHintEl.textContent = 'Новых не было';
            } else {
                const arr = Array.from(currentSet);
                if (arr.length) {
                    lastShownRecognition = arr[arr.length - 1];
                    lastRecognizedEl.textContent = lastShownRecognition;
                    lastRecognizedEl.className = 'value';
                    recognitionHintEl.textContent = 'Последнее из текущего списка';
                }
            }
        }
        previousRecognitions = currentSet;
    }

    // ----- Force door control -----
    function setForceMessage(msg, type = '') {
        clearTimeout(forceMsgTimer);
        forceStatusLine.textContent = msg;
        forceStatusLine.className = 'force-status ' + (type ? ('msg-' + type) : '');
        if (type === 'err' || type === 'warn' || type === 'ok') {
            forceMsgTimer = setTimeout(() => {
                forceStatusLine.className = 'force-status';
                updateForceStatusLine(); // вернём актуальный текст
            }, 4000);
        }
    }

    function updateForceStatusLine() {
        if (forceForbidden) {
            forceStatusLine.textContent = 'Нет прав для принудительного управления дверью (нужны door_control).';
            forceStatusLine.className = 'force-status msg-warn';
            return;
        }
        let txt;
        if (currentForce === null) txt = 'Принудительный режим: нет (используется фактическое состояние из Python)';
        else if (currentForce === true) txt = 'Принудительный режим: ОТКРЫТА (дверь будет считаться открытой)';
        else txt = 'Принудительный режим: ЗАКРЫТА (дверь будет считаться закрытой)';
        forceStatusLine.textContent = txt;
        forceStatusLine.className = 'force-status';
    }

    async function fetchForceStatus() {
        try {
            const res = await fetch(FORCE_URL, { credentials: 'include' });
            if (res.redirected && res.url.includes('/login')) {
                window.location = res.url;
                return;
            }
            if (res.status === 403) {
                forceForbidden = true;
                doorForceControls.style.display = 'none';
                updateForceStatusLine();
                return;
            }
            if (!res.ok) {
                setForceMessage('Ошибка загрузки статуса (' + res.status + ')', 'err');
                return;
            }
            const text = (await res.text()).trim();
            if (text === 'true') currentForce = true;
            else if (text === 'false') currentForce = false;
            else currentForce = null;
            forceForbidden = false;
            doorForceControls.style.display = 'flex';
            updateForceStatusLine();
        } catch (e) {
            setForceMessage('Сеть: ' + e.message, 'err');
        }
    }

    async function postForce(statusValue) {
        if (forceForbidden) return;
        try {
            const payload = { status: statusValue };
            const res = await fetch(FORCE_URL, {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            if (res.status === 403) {
                forceForbidden = true;
                doorForceControls.style.display = 'none';
                updateForceStatusLine();
                return;
            }
            if (!res.ok) {
                const txt = await res.text().catch(() => '');
                setForceMessage('Ошибка (' + res.status + '): ' + (txt || 'не удалось применить'), 'err');
                return;
            }
            setForceMessage('Успешно применено', 'ok');
            await fetchForceStatus();
        } catch (e) {
            setForceMessage('Сеть: ' + e.message, 'err');
        }
    }

    btnForceOpen.addEventListener('click', () => postForce(true));
    btnForceClose.addEventListener('click', () => postForce(false));
    btnForceReset.addEventListener('click', () => postForce(null));

    // ----- Init -----
    window.addEventListener('beforeunload', () => {
        manualClosed = true;
        try { ws && ws.close(); } catch (_) {}
    });

    fetchForceStatus();
    connect();
})();