const API_URL = '/api';
const SHIPPING_FEE = 15.00;
let checkoutSubtotal = 0;

document.addEventListener('DOMContentLoaded', async () => {
    const token = localStorage.getItem('token');
    if (!token) {
        showToast('Please log in to checkout', 'error');
        setTimeout(() => {
            window.location.href = '/login?redirect=/checkout';
        }, 1500);
        return;
    }
    await loadCheckoutSummary();
});

async function loadCheckoutSummary() {
    const token = localStorage.getItem('token');
    try {
        const res = await fetch(`${API_URL}/cart`, { headers: { 'Authorization': `Bearer ${token}` } });
        if (!res.ok) throw new Error('Failed to load cart');
        const cartData = await res.json();
        
        if (cartData.length === 0) {
            showToast('Your cart is empty. Add items before checking out.', 'info');
            setTimeout(() => {
                window.location.href = '/cart';
            }, 2000);
            return;
        }

        const container = document.getElementById('checkoutItemsList');
        checkoutSubtotal = 0;

        container.innerHTML = cartData.map(item => {
            const itemTotal = item.price * item.quantity;
            checkoutSubtotal += itemTotal;
            return `
            <div class="checkout-item">
                <div>
                    <div class="checkout-item-name">${item.name}</div>
                    <div class="checkout-item-qty">Qty: ${item.quantity}</div>
                </div>
                <div style="font-weight: 700;">$${itemTotal.toFixed(2)}</div>
            </div>`;
        }).join('');

        const total = checkoutSubtotal + SHIPPING_FEE;
        
        // Update summary elements (added subtotal and shipping rows for clarity)
        const subtotalEl = document.getElementById('checkoutSubtotal');
        const shippingEl = document.getElementById('checkoutShipping');
        const totalEl = document.getElementById('checkoutTotal');
        
        if (subtotalEl) subtotalEl.textContent = `$${checkoutSubtotal.toFixed(2)}`;
        if (shippingEl) shippingEl.textContent = `$${SHIPPING_FEE.toFixed(2)}`;
        if (totalEl) totalEl.textContent = `$${total.toFixed(2)}`;
        
        // Auto-fill profile data if available
        await prefillCheckoutData();
    } catch (error) {
        console.error('Checkout load error:', error);
        showToast('Error loading checkout. Redirecting to cart.', 'error');
        setTimeout(() => { window.location.href = '/cart'; }, 2000);
    }
}

async function prefillCheckoutData() {
    const token = localStorage.getItem('token');
    try {
        const res = await fetch(`${API_URL}/buyer/profile`, { headers: { 'Authorization': `Bearer ${token}` } });
        if (res.ok) {
            const profile = await res.json();
            if (profile.full_name) document.getElementById('fullName').value = profile.full_name;
            if (profile.phone) document.getElementById('phone').value = profile.phone;
            if (profile.default_shipping_address) {
                // Try to split address for better UX, or just dump it in the street field
                document.getElementById('address').value = profile.default_shipping_address;
            }
        }
    } catch (error) { 
        console.warn('Profile prefill error:', error); 
    }
}

document.getElementById('checkoutForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('submitBtn');
    const originalText = btn.innerHTML;
    
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> Processing Payment...';

    const payload = {
        full_name: document.getElementById('fullName').value,
        shipping_address: document.getElementById('address').value,
        city: document.getElementById('city').value,
        zip_code: document.getElementById('zipCode').value,
        phone: document.getElementById('phone').value
    };

    const token = localStorage.getItem('token');
    try {
        // Simulate realistic payment processing delay (2 seconds)
        await new Promise(resolve => setTimeout(resolve, 2000));

        const res = await fetch(`${API_URL}/checkout`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        const data = await res.json();

        if (res.ok) {
            showToast('Order placed successfully! 🎉', 'success');
            btn.innerHTML = '<i class="fas fa-check"></i> Order Confirmed!';
            btn.style.background = '#22c55e';
            btn.style.borderColor = '#22c55e';
            
            setTimeout(() => {
                window.location.href = '/dashboard'; // Redirects to buyer overview
            }, 1500);
        } else {
            showToast(data.detail || 'Checkout failed. Please try again.', 'error');
            btn.disabled = false;
            btn.innerHTML = originalText;
        }
    } catch (error) {
        showToast('Network error during checkout.', 'error');
        btn.disabled = false;
        btn.innerHTML = originalText;
    }
});

// --- TOAST NOTIFICATION (Fallback if dashboard.js isn't loaded) ---
function showToast(message, type = 'info') {
    // Check if toast container exists, if not, create it
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        container.className = 'toast-container';
        document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    let icon = 'fa-info-circle';
    if (type === 'success') icon = 'fa-check-circle';
    if (type === 'error') icon = 'fa-exclamation-circle';

    toast.innerHTML = `<i class="fas ${icon}"></i> <span>${message}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
        toast.style.animation = 'fadeOut 0.3s ease-out forwards';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}
