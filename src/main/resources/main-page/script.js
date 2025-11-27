(function() {
    const videoEl = document.getElementById('streamVideo');

    // HLS stream assumptions: master playlist located at /stream/index.m3u8
    // If naming differs adjust STREAM_SRC below.
    const STREAM_SRC = '/stream/stream.m3u8';

    let hlsInstance = null;

    function initVideo() {
        if (typeof Hls !== 'undefined' && Hls.isSupported()) {
            hlsInstance = new Hls({
                enableWorker: true,
                lowLatencyMode: true
            });
            hlsInstance.loadSource(STREAM_SRC);
            hlsInstance.attachMedia(videoEl);
            hlsInstance.on(Hls.Events.MANIFEST_PARSED, function() {
                videoEl.play().catch(function() {
                    // Autoplay may be blocked; user can click play
                });
            });
            hlsInstance.on(Hls.Events.ERROR, function(event, data) {
                if (data.fatal) {
                    switch (data.type) {
                        case Hls.ErrorTypes.NETWORK_ERROR:
                            showToast('Сетевая ошибка, пытаемся восстановить...', true);
                            hlsInstance.startLoad();
                            break;
                        case Hls.ErrorTypes.MEDIA_ERROR:
                            showToast('Ошибка медиа, пытаемся восстановить...', true);
                            hlsInstance.recoverMediaError();
                            break;
                        default:
                            showToast('Ошибка воспроизведения потока', true);
                            hlsInstance.destroy();
                            hlsInstance = null;
                            break;
                    }
                }
            });
        } else if (videoEl.canPlayType('application/vnd.apple.mpegurl')) {
            // Native HLS support (Safari)
            videoEl.src = STREAM_SRC;
            videoEl.addEventListener('loadedmetadata', function() {
                videoEl.play().catch(function() {
                    // Autoplay may be blocked; user can click play
                });
            });
            videoEl.addEventListener('error', function() {
                showToast('Ошибка воспроизведения потока', true);
            });
        } else {
            showToast('Ваш браузер не поддерживает HLS потоки', true);
        }
    }

    /* Door control */
    const doorStateBadge = document.getElementById('doorState');
    const btnOpen = document.getElementById('btnDoorOpen');
    const btnClose = document.getElementById('btnDoorClose');
    const btnAuto = document.getElementById('btnDoorAuto');
    const btnDoorRefresh = document.getElementById('btnDoorRefresh');

    let forceDoorStatus = null; // null => auto, true => forced open, false => forced closed
    let lastDoorFromStatus = null; // actual door sensor boolean from system status
    let doorUpdating = false;

    function refreshDoorUi() {
        // Visual priority: forced state
        doorStateBadge.className = 'door-status';
        let text;
        if (forceDoorStatus === true) {
            doorStateBadge.classList.add('forced');
            text = 'Принудительно: Открыта';
        } else if (forceDoorStatus === false) {
            doorStateBadge.classList.add('forced');
            text = 'Принудительно: Закрыта';
        } else {
            // auto mode
            if (lastDoorFromStatus == null) {
                text = '—';
            } else if (lastDoorFromStatus) {
                doorStateBadge.classList.add('open');
                text = 'Открыта (авто)';
            } else {
                doorStateBadge.classList.add('closed');
                text = 'Закрыта (авто)';
            }
        }
        doorStateBadge.textContent = text;
    }

    async function fetchDoorForce() {
        try {
            const res = await fetch('/api/door/force', { credentials:'include' });
            if (!res.ok) return;
            const txt = (await res.text()).trim();
            forceDoorStatus = (txt === 'true') ? true : (txt === 'false' ? false : null);
            refreshDoorUi();
        } catch {
            // ignore
        }
    }

    async function sendDoorForce(value) {
        if (doorUpdating) return;
        doorUpdating = true;
        setButtonsDisabled(true);
        try {
            const res = await fetch('/api/door/force', {
                method:'POST',
                headers:{ 'Content-Type':'application/json' },
                credentials:'include',
                body: JSON.stringify({ status: value })
            });
            if (!res.ok) {
                showToast('Не удалось изменить состояние двери', true);
            } else {
                forceDoorStatus = value;
                showToast(value === null ? 'Режим авто' : (value ? 'Дверь принудительно открыта' : 'Дверь принудительно закрыта'), false);
            }
        } catch {
            showToast('Сеть недоступна', true);
        } finally {
            doorUpdating = false;
            setButtonsDisabled(false);
            refreshDoorUi();
        }
    }

    function setButtonsDisabled(v) {
        [btnOpen, btnClose, btnAuto, btnDoorRefresh].forEach(b => b.disabled = v);
    }

    btnOpen.addEventListener('click', () => sendDoorForce(true));
    btnClose.addEventListener('click', () => sendDoorForce(false));
    btnAuto.addEventListener('click', () => sendDoorForce(null));
    btnDoorRefresh.addEventListener('click', () => fetchDoorForce());

    /* System status via websocket */
    const statTime = document.getElementById('statTime');
    const statDoor = document.getElementById('statDoor');
    const statRecognitions = document.getElementById('statRecognitions');

    let statusWs;
    let statusReconnectAttempts = 0;

    function connectStatusWs() {
        const url = makeWsUrl('/api/status/ws');
        statusWs = new WebSocket(url);
        statusWs.onopen = () => {
            statusReconnectAttempts = 0;
        };
        statusWs.onmessage = ev => {
            try {
                const data = JSON.parse(ev.data);
                if (!data) return;
                renderStatus(data);
            } catch {
                // ignore
            }
        };
        statusWs.onclose = () => {
            retryStatusWs();
        };
        statusWs.onerror = () => {
            try { statusWs.close(); } catch {}
        };
    }

    function retryStatusWs() {
        statusReconnectAttempts++;
        const timeout = Math.min(10000, 500 * statusReconnectAttempts);
        setTimeout(connectStatusWs, timeout);
    }

    function renderStatus(data) {
        if (typeof data.time === 'number') {
            const dt = new Date(data.time);
            statTime.textContent = dt.toLocaleString();
        }
        if (typeof data.door === 'boolean') {
            lastDoorFromStatus = data.door;
            statDoor.textContent = data.door ? 'Открыта' : 'Закрыта';
        } else {
            statDoor.textContent = '—';
        }
        statRecognitions.innerHTML = '';
        if (Array.isArray(data.recognitions) && data.recognitions.length) {
            for (const name of data.recognitions.slice(-10)) {
                const span = document.createElement('span');
                span.textContent = name;
                span.style.background = '#2563eb';
                span.style.color = '#fff';
                span.style.padding = '3px 8px 4px';
                span.style.borderRadius = '999px';
                span.style.fontSize = '.55rem';
                span.style.fontWeight = '600';
                statRecognitions.appendChild(span);
            }
        } else {
            const span = document.createElement('span');
            span.textContent = '—';
            span.style.opacity = '.7';
            statRecognitions.appendChild(span);
        }
        refreshDoorUi();
    }

    /* Live system logs websocket */
    const logsList = document.getElementById('logsList');
    const logsEmpty = document.getElementById('logsEmpty');
    const logFilter = document.getElementById('logFilter');
    const btnClearLogs = document.getElementById('btnClearLogs');
    let logs = [];
    let logsWs;
    let logsReconnectAttempts = 0;
    const MAX_LOGS = 400;

    function connectLogsWs() {
        const url = makeWsUrl('/api/logs/system/ws');
        logsWs = new WebSocket(url);
        logsWs.onopen = () => {
            logsReconnectAttempts = 0;
        };
        logsWs.onmessage = ev => {
            try {
                const obj = JSON.parse(ev.data);
                if (obj && obj.type && typeof obj.time === 'number') {
                    logs.push(obj);
                    if (logs.length > MAX_LOGS) logs.splice(0, logs.length - MAX_LOGS);
                    renderLogs();
                }
            } catch {
                // ignore
            }
        };
        logsWs.onclose = () => {
            retryLogsWs();
        };
        logsWs.onerror = () => {
            try { logsWs.close(); } catch {}
        };
    }

    function retryLogsWs() {
        logsReconnectAttempts++;
        const timeout = Math.min(10000, 500 * logsReconnectAttempts);
        setTimeout(connectLogsWs, timeout);
    }

    function renderLogs() {
        const filter = logFilter.value;
        logsList.innerHTML = '';
        const filtered = filter === 'all' ? logs : logs.filter(l => l.type === filter);
        if (!filtered.length) {
            logsEmpty.style.display = 'block';
            return;
        }
        logsEmpty.style.display = 'none';
        for (let i = filtered.length - 1; i >= 0; i--) {
            const log = filtered[i];
            logsList.appendChild(buildLogItem(log));
        }
    }

    function buildLogItem(log) {
        const div = document.createElement('div');
        div.className = 'log-item';
        const badgeClass =
            log.type === 'ERROR' ? 'badge error' :
                log.type === 'WARN' ? 'badge warn' : 'badge';

        const timeStr = new Date(log.time).toLocaleTimeString();
        div.innerHTML = `
            <div class="log-head">
                <span class="${badgeClass}">${escapeHtml(log.type)}</span>
                <span class="log-time">${escapeHtml(timeStr)}</span>
            </div>
            <div class="log-msg">${escapeHtml(log.message || '')}</div>
        `;
        return div;
    }

    btnClearLogs.addEventListener('click', () => {
        logs = [];
        renderLogs();
    });
    logFilter.addEventListener('change', () => renderLogs());

    function escapeHtml(s) {
        return (s == null ? '' : String(s)).replace(/[&<>"']/g, c =>
            ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])
        );
    }

    /* Helpers */
    function makeWsUrl(path) {
        const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        return proto + '//' + window.location.host + path;
    }

    const toastEl = document.getElementById('toast');
    function showToast(msg, error=false, timeout=2600) {
        if (!msg) return;
        toastEl.textContent = msg;
        toastEl.className = 'toast' + (error ? ' error' : '');
        toastEl.style.display = 'block';
        clearTimeout(showToast._t);
        showToast._t = setTimeout(() => { toastEl.style.display='none'; }, timeout);
    }

    /* Init */
    initVideo();
    fetchDoorForce();
    connectStatusWs();
    connectLogsWs();

    // Periodic fallback for status (if ws not working)
    setInterval(async () => {
        if (!statusWs || statusWs.readyState !== 1) {
            try {
                const res = await fetch('/api/status', { credentials:'include' });
                if (res.status === 204) return;
                if (res.ok) {
                    const data = await res.json();
                    renderStatus(data);
                }
            } catch {}
        }
    }, 5000);

    window.addEventListener('beforeunload', () => {
        try { hlsInstance && hlsInstance.destroy(); } catch {}
        try { statusWs && statusWs.close(); } catch {}
        try { logsWs && logsWs.close(); } catch {}
    });
})();