(function () {
    const WS_URL = (location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + '/api/status/ws';

    // DOM
    const wsStateEl = document.getElementById('wsState');
    const doorValueEl = document.getElementById('doorValue');
    const doorHintEl = document.getElementById('doorHint');
    const lastUpdateEl = document.getElementById('lastUpdate');
    const lastRecognizedEl = document.getElementById('lastRecognized');
    const recognitionHintEl = document.getElementById('recognitionHint');

    // State
    let ws = null;
    let reconnectTimer = null;
    let manualClosed = false;
    let previousRecognitions = new Set();
    let lastShownRecognition = null;

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

        ws.onopen = () => {
            setWsState('connected');
        };

        ws.onclose = () => {
            setWsState('closed');
            if (!manualClosed) scheduleReconnect();
        };

        ws.onerror = () => {
            setWsState('closed');
        };

        ws.onmessage = (ev) => {
            applyStatus(ev.data);
        };
    }

    function applyStatus(raw) {
        let data;
        try {
            data = JSON.parse(raw);
        } catch {
            return;
        }
        if (!data) return;

        // Обновление времени (используем server time из поля time)
        if (typeof data.time === 'number') {
            const clientNow = new Date();
            const serverDate = new Date(data.time);
            lastUpdateEl.textContent =
                'Последнее обновление: ' + serverDate.toLocaleString() +
                ' (сервер), локально: ' + clientNow.toLocaleTimeString();
        }

        // Дверь
        if (typeof data.door === 'boolean') {
            doorValueEl.textContent = data.door ? 'Открыта' : 'Закрыта';
            doorValueEl.className = 'value ' + (data.door ? 'status-ok' : '');
            doorHintEl.textContent = data.door ? 'Дверь сейчас открыта' : 'Дверь закрыта';
        }

        // Последнее распознавание
        handleRecognition(data.recognitions);
    }

    function handleRecognition(recognitions) {
        if (!Array.isArray(recognitions)) {
            recognitionHintEl.textContent = 'Нет данных';
            return;
        }

        // Ищем новые имена, которых не было в previousRecognitions
        const currentSet = new Set(recognitions);
        let newest = null;
        for (const name of currentSet) {
            if (!previousRecognitions.has(name)) {
                newest = name;
            }
        }

        if (newest) {
            lastShownRecognition = newest;
            lastRecognizedEl.textContent = newest;
            lastRecognizedEl.className = 'value status-ok';
            recognitionHintEl.textContent = 'Новое распознавание';
        } else {
            // Нет новых - если вообще ничего не распознано
            if (currentSet.size === 0 && !lastShownRecognition) {
                lastRecognizedEl.textContent = '—';
                lastRecognizedEl.className = 'value';
                recognitionHintEl.textContent = 'Распознаваний нет';
            } else if (lastShownRecognition) {
                recognitionHintEl.textContent = 'Новых не было';
            } else {
                // массив был, но мы ещё ничего не отметили (примем последний элемент)
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

    window.addEventListener('beforeunload', () => {
        manualClosed = true;
        try { ws && ws.close(); } catch (_) {}
    });

    // Старт
    connect();
})();