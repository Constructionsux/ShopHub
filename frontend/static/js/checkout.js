const API_URL = '/api';
const SHIPPING_FEE = 15.00;
let checkoutSubtotal = 0;

document.addEventListener('DOMContentLoaded', async () => {
    const token = localStorage.getItem('token');
    if (!token) {
        window.location.href = '/login?redirect=/checkout';
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
            window.location.href = '/cart';
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
        document.getElementById('checkoutSubtotal').textContent = `$${checkoutSubtotal.toFixed(2)}`;
        document.getElementById('checkoutShipping').textContent = `$${SHIPPING_FEE.toFixed(2)}`;
        document.getElementById('checkoutTotal').textContent = `$${total.toFixed(2)}`;
        
        // Auto-fill profile data if available
        await prefillCheckoutData();
    } catch (error) {
        window.location.href = '/cart';
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
            if (profile.default_shipping_address) document.getElementById('address').value = profile.default_shipping_address;
        }
    } catch (error) { console.warn('Profile prefill error:', error); }
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
        // Simulate payment processing delay
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
            btn.innerHTML = '<i class="fas fa-check"></i> Order Placed Successfully!';
            btn.style.background = '#22c55e';
            setTimeout(() => {
                window.location.href = '/dashboard'; // Redirects to buyer overview
            }, 1500);
        } else {
            alert(data.detail || 'Checkout failed. Please try again.');
            btn.disabled = false;
            btn.innerHTML = originalText;
        }
    } catch (error) {
        alert('Network error during checkout.');
        btn.disabled = false;
        btn.innerHTML = originalText;
    }
});
