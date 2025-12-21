(function () {
    const videoEl = document.getElementById('streamVideo');

    // UI для "перемотки" (это НЕ нативный video timeline, это наш контрол)
    const seekEl = document.getElementById('rewindRange');      // input[type=range], 0..30
    const seekLabelEl = document.getElementById('rewindLabel'); // span
    const btnLive = document.getElementById('btnLive');         // кнопка "LIVE"
    const btnPause = document.getElementById('btnPause');       // кнопка "Pause"
    const btnPlay = document.getElementById('btnPlay');         // кнопка "Play"

    let pc = null;
    let dc = null;
    let seekDebounceT = null;

    function setSeekLabel(v) {
        if (!seekLabelEl) return;
        const s = Number(v);
        if (!isFinite(s)) return;
        seekLabelEl.textContent = (s === 0 ? 'LIVE' : `-${s.toFixed(1)}s`);
    }

    async function startWebRTC() {
        const config = {
            sdpSemantics: 'unified-plan',
            // LAN => обычно быстрее без STUN
            iceServers: []
        };

        pc = new RTCPeerConnection(config);

        // datachannel for controls
        dc = pc.createDataChannel('control');

        dc.onopen = () => {
            // init
            if (seekEl) {
                seekEl.value = "0";
                setSeekLabel(0);
            }
            // сразу live
            dc.send('seek:0');
        };

        dc.onmessage = (ev) => {
            // можно логировать состояния, если нужно
            // console.log('DC:', ev.data);
        };

        pc.ontrack = function (evt) {
            if (evt.track.kind === 'video') {
                videoEl.srcObject = evt.streams[0];
                videoEl.play?.().catch(() => {});
            }
        };

        pc.addTransceiver('video', {direction: 'recvonly'});

        try {
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);

            // НЕ ждём iceGatheringState complete (ускоряет старт)
            const offerPayload = {
                sdp: pc.localDescription.sdp,
                type: pc.localDescription.type
            };

            const response = await fetch('/api/stream/offer', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify(offerPayload)
            });

            if (!response.ok) throw new Error('Network response was not ok');

            const answer = await response.json();
            await pc.setRemoteDescription(answer);

        } catch (e) {
            showToast('Ошибка WebRTC соединения', true);
            console.error(e);
            setTimeout(startWebRTC, 3000);
        }
    }

    function sendSeek(secondsAgo) {
        if (!dc || dc.readyState !== 'open') return;
        const v = Math.max(0, Math.min(30, Number(secondsAgo)));
        dc.send(`seek:${v}`);
        setSeekLabel(v);
    }

    function initRewindUi() {
        if (seekEl) {
            // обновляем подпись сразу
            setSeekLabel(seekEl.value);

            // input — во время перетаскивания (часто), поэтому делаем debounce
            seekEl.addEventListener('input', () => {
                setSeekLabel(seekEl.value);
                clearTimeout(seekDebounceT);
                seekDebounceT = setTimeout(() => sendSeek(seekEl.value), 120);
            });

            // change — когда отпустили (гарантированно отправим)
            seekEl.addEventListener('change', () => {
                clearTimeout(seekDebounceT);
                sendSeek(seekEl.value);
            });
        }

        btnLive && btnLive.addEventListener('click', () => {
            if (seekEl) seekEl.value = "0";
            sendSeek(0);
        });

        btnPause && btnPause.addEventListener('click', () => {
            if (dc && dc.readyState === 'open') dc.send('pause');
        });

        btnPlay && btnPlay.addEventListener('click', () => {
            if (dc && dc.readyState === 'open') dc.send('play');
        });
    }

    function initVideo() {
        initRewindUi();
        startWebRTC();
    }

    /* ... твой остальной код (door, ws logs/status, etc) без изменений ... */

    initVideo();

    // NOTE: в конце файла у тебя уже идут fetchDoorForce/connectStatusWs/connectLogsWs и т.д.
    // Оставь их как есть.
})();