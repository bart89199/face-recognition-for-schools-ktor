(function() {
    const form = document.getElementById('loginForm');
    const errorBox = document.getElementById('error');
    const submitBtn = document.getElementById('submitBtn');
    const googleBtn = document.getElementById('googleBtn');
    const googleBtn2 = document.getElementById('googleBtn2');

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

    function redirectToGoogle() {
        window.location = '/login/google';
    }

    googleBtn.addEventListener('click', redirectToGoogle);
    googleBtn2.addEventListener('click', redirectToGoogle);

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        clearError();

        const email = form.email.value.trim();
        const password = form.password.value;

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
                body: JSON.stringify({ email, password }),
                credentials: 'include'
            });

            if (res.ok) {
                window.location = '/';
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