(function(){
    const qs = new URLSearchParams(location.search);
    const file = qs.get('filename');
    const errBox = document.getElementById('err');
    const content = document.getElementById('content');
    const fileNameEl = document.getElementById('fileName');
    const player = document.getElementById('player');
    const downloadBtn = document.getElementById('downloadBtn');
    const meta = document.getElementById('meta');

    function showError(msg){
        errBox.textContent = msg;
        errBox.classList.add('show');
    }
    function esc(s){
        return (s||'').toString().replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
    }

    if(!file){
        showError('Не указан filename (?filename=...)');
        return;
    }
    if (file.includes('..') || file.includes('/') || file.includes('\\')) {
        showError('Недопустимое имя файла');
        return;
    }

    const rawUrl = '/api/records?filename=' + encodeURIComponent(file) + '&raw=true';
    const downloadUrl = '/api/records?filename=' + encodeURIComponent(file) + '&download=true';

    fileNameEl.innerHTML = 'Файл: ' + esc(file);
    downloadBtn.href = downloadUrl;
    meta.innerHTML = 'Прямая ссылка: <code>' + esc(rawUrl) + '</code><br>Если не играет — попробуйте «Скачать».';
    content.hidden = false;

    // Добавим через <source> с типом, чтобы браузер корректно послал Range
    const source = document.createElement('source');
    source.src = rawUrl;
    // Попробуем угадать тип по расширению
    const lower = file.toLowerCase();
    if (lower.endsWith('.mp4')) source.type = 'video/mp4';
    else if (lower.endsWith('.webm')) source.type = 'video/webm';
    else if (lower.endsWith('.mkv')) source.type = 'video/x-matroska';
    player.appendChild(source);

    // Диагностика
    player.addEventListener('error', () => {
        const err = player.error;
        if (!err) return;
        let msg = 'Ошибка воспроизведения (code=' + err.code + ')';
        switch (err.code) {
            case MediaError.MEDIA_ERR_ABORTED: msg += ': Прервано пользователем/браузером.'; break;
            case MediaError.MEDIA_ERR_NETWORK: msg += ': Сеть/Range.'; break;
            case MediaError.MEDIA_ERR_DECODE: msg += ': Декодирование.'; break;
            case MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED: msg += ': Источник не поддержан.'; break;
        }
        console.error('VIDEO ERROR', err);
        showError(msg + ' Проверьте ответ /api/records?filename=...&raw=true в Network.');
    });

    // Показать, когда пошли данные
    player.addEventListener('loadedmetadata', () => {
        console.log('Metadata loaded, duration=', player.duration);
    });
    player.addEventListener('loadeddata', () => {
        console.log('First frame loaded');
    });
})();