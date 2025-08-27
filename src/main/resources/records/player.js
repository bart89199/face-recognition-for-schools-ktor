(function(){
    const qs = new URLSearchParams(location.search);
    const file = qs.get('filename');
    const errBox = document.getElementById('err');
    const content = document.getElementById('content');
    const fileNameEl = document.getElementById('fileName');
    const player = document.getElementById('player');
    const downloadBtn = document.getElementById('downloadBtn');
    const meta = document.getElementById('meta');

    function esc(s){
        return (s||'').toString().replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
    }

    if(!file){
        errBox.textContent = 'Не указан filename (?filename=...)';
        errBox.classList.add('show');
        return;
    }
    if (file.includes('..') || file.includes('/') || file.includes('\\')) {
        errBox.textContent = 'Недопустимое имя файла';
        errBox.classList.add('show');
        return;
    }

    const rawUrl = '/api/records?filename=' + encodeURIComponent(file) + '&raw=true';
    const downloadUrl = '/api/records?filename=' + encodeURIComponent(file) + '&download=true';

    fileNameEl.innerHTML = 'Файл: ' + esc(file);
    player.src = rawUrl;
    downloadBtn.href = downloadUrl;
    meta.innerHTML = 'Прямая ссылка: <code>' + esc(rawUrl) + '</code><br>' +
        'Если не играет — попробуйте «Скачать».';
    content.hidden = false;
})();