// --- IP & LOCATION DETECTION (ipapi.co) ---
async function getClientLocation() {
    try {
        const response = await fetch('https://ipapi.co/json/');
        const data = await response.json();
        return {
            ip: data.ip,
            location: `${data.city}, ${data.country_name}`
        };
    } catch (error) {
        console.warn("IP API failed, using fallback", error);
        return { ip: 'unknown', location: 'unknown' };
    }
}

// --- UI HELPERS ---
function showError(msg) {
    const el = document.getElementById('errorMsg');
    if (el) {
        el.textContent = msg;
        el.style.display = 'block';
    }
}

function showSuccess(msg) {
    const el = document.getElementById('successMsg');
    if (el) {
        el.textContent = msg;
        el.style.display = 'block';
    }
}

function setLoading(isLoading) {
    const btn = document.getElementById('submitBtn');
    if (btn) {
        btn.disabled = isLoading;
        btn.innerHTML = isLoading ? '<i class="fas fa-spinner fa-spin"></i> Processing...' : (btn.dataset.originalText || btn.innerHTML);
        if (!btn.dataset.originalText) btn.dataset.originalText = btn.innerHTML;
    }
}

// --- REGISTER HANDLER ---
const registerForm = document.getElementById('registerForm');
if (registerForm) {
    registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        setLoading(true);
        document.getElementById('errorMsg').style.display = 'none';

        const locationData = await getClientLocation();

        const payload = {
            full_name: document.getElementById('fullName').value,
            email: document.getElementById('email').value,
            password: document.getElementById('password').value,
            user_type: document.getElementById('userType').value,
            ip_address: locationData.ip,
            location: locationData.location
        };

        try {
            const res = await fetch('/api/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const data = await res.json();

            if (res.ok) {
                window.location.href = `/verify?email=${encodeURIComponent(payload.email)}`;
            } else {
                showError(data.detail || 'Registration failed');
            }
        } catch (err) {
            showError('Network error. Please try again.');
        } finally {
            setLoading(false);
        }
    });
}

// --- LOGIN HANDLER ---
const loginForm = document.getElementById('loginForm');
if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        setLoading(true);
        document.getElementById('errorMsg').style.display = 'none';

        const locationData = await getClientLocation();

        const payload = {
            email: document.getElementById('email').value,
            password: document.getElementById('password').value,
            ip_address: locationData.ip,
            location: locationData.location
        };

        try {
            const res = await fetch('/api/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const data = await res.json();

            if (res.ok) {
                localStorage.setItem('token', data.access_token);
                localStorage.setItem('userType', data.user_type);
                window.location.href = '/dashboard'; // Redirect to dashboard/home
            } else {
                showError(data.detail || 'Login failed');
            }
        } catch (err) {
            showError('Network error. Please try again.');
        } finally {
            setLoading(false);
        }
    });
}

// --- VERIFICATION HANDLER ---
const verifyForm = document.getElementById('verifyForm');
if (verifyForm) {
    // Auto-focus next input
    const inputs = document.querySelectorAll('.code-digit');
    inputs.forEach((input, index) => {
        input.addEventListener('input', (e) => {
            if (e.target.value.length === 1 && index < inputs.length - 1) {
                inputs[index + 1].focus();
            }
        });
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Backspace' && !e.target.value && index > 0) {
                inputs[index - 1].focus();
            }
        });
    });

    verifyForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        setLoading(true);
        document.getElementById('errorMsg').style.display = 'none';

        const code = Array.from(inputs).map(i => i.value).join('');
        const email = document.getElementById('email').value;

        try {
            const res = await fetch('/api/verify-email', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, code })
            });
            const data = await res.json();

            if (res.ok) {
                showSuccess('Email verified! Redirecting to login...');
                setTimeout(() => {
                    window.location.href = '/login';
                }, 2000);
            } else {
                showError(data.detail || 'Verification failed');
                inputs.forEach(i => i.value = '');
                inputs[0].focus();
            }
        } catch (err) {
            showError('Network error. Please try again.');
        } finally {
            setLoading(false);
        }
    });
}

// --- RESEND CODE HANDLER ---
let resendCooldown = 0;
let cooldownInterval = null;

async function resendCode() {
    if (resendCooldown > 0) return;

    const email = document.getElementById('email').value;
    const btn = document.getElementById('resendBtn');
    const timer = document.getElementById('resendTimer');
    const countdown = document.getElementById('countdown');
    
    // Hide any previous messages
    document.getElementById('errorMsg').style.display = 'none';
    document.getElementById('successMsg').style.display = 'none';

    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sending...';

    try {
        const res = await fetch('/api/resend-code', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email })
        });
        const data = await res.json();

        if (res.ok) {
            showSuccess('New verification code sent! Please check your email.');
            
            // Start 60-second cooldown
            resendCooldown = 60;
            btn.style.display = 'none';
            timer.style.display = 'block';
            
            cooldownInterval = setInterval(() => {
                resendCooldown--;
                countdown.textContent = resendCooldown;
                
                if (resendCooldown <= 0) {
                    clearInterval(cooldownInterval);
                    btn.style.display = 'inline-flex';
                    btn.disabled = false;
                    btn.innerHTML = 'Resend Code';
                    timer.style.display = 'none';
                }
            }, 1000);
        } else {
            showError(data.detail || 'Failed to resend code');
            btn.disabled = false;
            btn.innerHTML = 'Resend Code';
        }
    } catch (err) {
        showError('Network error. Please try again.');
        btn.disabled = false;
        btn.innerHTML = 'Resend Code';
    }
}
