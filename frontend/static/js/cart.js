const API_URL = '/api';
let cartData = [];

document.addEventListener('DOMContentLoaded', async () => {
    const token = localStorage.getItem('token');
    if (!token) {
        window.location.href = '/login?redirect=/cart';
        return;
    }
    await loadCart();
});

async function loadCart() {
    const token = localStorage.getItem('token');
    try {
        const res = await fetch(`${API_URL}/cart`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) throw new Error('Failed to load cart');
        cartData = await res.json();
        renderCart();
    } catch (error) {
        document.getElementById('cartItemsList').innerHTML = '<div class="empty-state">Error loading cart. Please try again.</div>';
    }
}

function renderCart() {
    const container = document.getElementById('cartItemsList');
    const checkoutBtn = document.getElementById('checkoutBtn');
    
    if (cartData.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-shopping-cart" style="font-size: 3rem; margin-bottom: 15px; color: #cbd5e1;"></i>
                <h3>Your cart is empty</h3>
                <a href="/" class="btn btn-primary" style="margin-top: 15px;">Start Shopping</a>
            </div>`;
        checkoutBtn.disabled = true;
        updateSummary(0);
        return;
    }

    checkoutBtn.disabled = false;
    let total = 0;

    container.innerHTML = cartData.map(item => {
        const itemTotal = item.price * item.quantity;
        total += itemTotal;
        return `
        <div class="cart-item" data-id="${item.id}">
            <div class="item-image">
                <i class="fas fa-box"></i>
            </div>
            <div class="item-details">
                <div>
                    <div class="item-name">${item.name}</div>
                    <div class="item-price">$${item.price.toFixed(2)}</div>
                </div>
                <div class="item-controls">
                    <div class="quantity-control">
                        <button class="qty-btn" onclick="updateQuantity(${item.id}, ${item.quantity - 1})">-</button>
                        <input type="text" class="qty-input" value="${item.quantity}" readonly>
                        <button class="qty-btn" onclick="updateQuantity(${item.id}, ${item.quantity + 1}, ${item.stock_quantity})">+</button>
                    </div>
                    <button class="remove-btn" onclick="removeItem(${item.id})">
                        <i class="fas fa-trash"></i> Remove
                    </button>
                </div>
            </div>
        </div>`;
    }).join('');

    updateSummary(total);
}

async function updateQuantity(itemId, newQuantity, maxStock = 999) {
    if (newQuantity <= 0) {
        await removeItem(itemId);
        return;
    }
    if (newQuantity > maxStock) {
        alert('Maximum stock reached for this item.');
        return;
    }

    const token = localStorage.getItem('token');
    try {
        const res = await fetch(`${API_URL}/cart/${itemId}`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ quantity: newQuantity })
        });
        if (res.ok) await loadCart();
        else {
            const err = await res.json();
            alert(err.detail || 'Failed to update quantity');
        }
    } catch (error) {
        alert('Network error');
    }
}

async function removeItem(itemId) {
    if (!confirm('Remove this item from your cart?')) return;
    const token = localStorage.getItem('token');
    try {
        const res = await fetch(`${API_URL}/cart/${itemId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) await loadCart();
    } catch (error) {
        alert('Network error');
    }
}

function updateSummary(total) {
    document.getElementById('summarySubtotal').textContent = `$${total.toFixed(2)}`;
    document.getElementById('summaryTotal').textContent = `$${total.toFixed(2)}`;
}
