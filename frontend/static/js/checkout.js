const API_URL = '/api';
let checkoutTotal = 0;

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
        const res = await fetch(`${API_URL}/cart`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) throw new Error('Failed to load cart');
        const cartData = await res.json();
        
        if (cartData.length === 0) {
            window.location.href = '/cart';
            return;
        }

        const container = document.getElementById('checkoutItemsList');
        checkoutTotal = 0;

        container.innerHTML = cartData.map(item => {
            const itemTotal = item.price * item.quantity;
            checkoutTotal += itemTotal;
            return `
            <div class="checkout-item">
                <div>
                    <div class="checkout-item-name">${item.name}</div>
                    <div class="checkout-item-qty">Qty: ${item.quantity}</div>
                </div>
                <div style="font-weight: 600;">$${itemTotal.toFixed(2)}</div>
            </div>`;
        }).join('');

        document.getElementById('checkoutTotal').textContent = `$${checkoutTotal.toFixed(2)}`;
    } catch (error) {
        window.location.href = '/cart';
    }
}

document.getElementById('checkoutForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('submitBtn');
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing Order...';

    const payload = {
        full_name: document.getElementById('fullName').value,
        shipping_address: document.getElementById('address').value,
        city: document.getElementById('city').value,
        zip_code: document.getElementById('zipCode').value,
        phone: document.getElementById('phone').value
    };

    const token = localStorage.getItem('token');
    try {
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
            alert(`Order placed successfully! Order #${data.order_ids.join(', #')}`);
            window.location.href = '/dashboard'; // Redirect to dashboard to see notifications
        } else {
            alert(data.detail || 'Checkout failed. Please try again.');
            btn.disabled = false;
            btn.innerHTML = 'Place Order';
        }
    } catch (error) {
        alert('Network error during checkout.');
        btn.disabled = false;
        btn.innerHTML = 'Place Order';
    }
});
