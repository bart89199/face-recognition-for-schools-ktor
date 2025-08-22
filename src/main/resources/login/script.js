(function() {

    function getQueryParam(name) {
        const params = new URLSearchParams(window.location.search);
        return params.get(name);
    }

    function sanitizeRedirect(raw) {
        if (!raw) return null;
        try {
            const url = decodeURIComponent(raw).trim();
            if (url.startsWith('/') && !url.startsWith('//')) {
                return url;
            }
            return null;
        } catch {
            return null;
        }
    }

    const rawRedirectParam = getQueryParam('redirectUrl');
    const safeRedirectParam = sanitizeRedirect(rawRedirectParam);

    const form = document.getElementById('loginForm');
    const errorBox = document.getElementById('error');
    const submitBtn = document.getElementById('submitBtn');
    const googleBtn = document.getElementById('googleBtn');
    const longLoginCheckbox = document.getElementById('longLogin');

    function showError(msg) {
        errorBox.textContent = msg;
        errorBox.classList.add('show');
    }
    function clearError() {
        errorBox.textContent = '';
        errorBox.classList.remove('show');
    }

    function setLoading(loading) {
        const textSpan = submitBtn.querySelector('.btn-text');
        if (loading) {
            submitBtn.disabled = true;
            if (!submitBtn.querySelector('.spinner')) {
                const sp = document.createElement('div');
                sp.className = 'spinner';
                textSpan.style.visibility = 'hidden';
                submitBtn.appendChild(sp);
            }
        } else {
            submitBtn.disabled = false;
            const sp = submitBtn.querySelector('.spinner');
            if (sp) sp.remove();
            textSpan.style.visibility = 'visible';
        }
    }

    function buildGoogleUrl() {
        let base = '/login/google';
        if (safeRedirectParam) {
            const g = new URL(base, window.location.origin);
            g.searchParams.set('redirectUrl', safeRedirectParam);
            return g.pathname + g.search;
        }
        return base;
    }

    function goGoogle() {
        window.location = buildGoogleUrl();
    }

    googleBtn.addEventListener('click', goGoogle);

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        clearError();

        const email = form.email.value.trim();
        const password = form.password.value;
        const long_login = !!longLoginCheckbox.checked;

        if (!email || !password) {
            showError('Заполните email и пароль.');
            return;
        }

        setLoading(true);
        try {
            const res = await fetch('/api/login/local', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ email, password, long_login }),
                credentials: 'include'
            });

            if (res.ok) {
                window.location = safeRedirectParam || '/';
                return;
            }

            if (res.status === 400) {
                let message = 'Неверный email или пароль.';
                try {
                    const data = await res.json();
                    if (data && data.error) message = data.error;
                } catch {}
                showError(message);
            } else {
                showError('Ошибка сервера. Повторите попытку позже.');
            }
        } catch (err) {
            console.error(err);
            showError('Сеть недоступна. Проверьте соединение.');
        } finally {
            setLoading(false);
        }
    });

    document.getElementById('email')?.focus();
})();