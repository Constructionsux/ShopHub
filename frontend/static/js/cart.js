const API_URL = '/api';
let cartData = [];
const SHIPPING_FEE = 20.00; 

document.addEventListener('DOMContentLoaded', async () => {
    const token = localStorage.getItem('token');
    if (!token) {
        window.location.href = '/login?redirect=/cart';
        return;
    }
    updateNavCartCount();
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
            <div class="empty-state" style="grid-column: 1/-1; text-align: center; padding: 60px 20px;">
                <i class="fas fa-shopping-cart" style="font-size: 4rem; margin-bottom: 20px; color: #cbd5e1;"></i>
                <h3>Your cart is empty</h3>
                <p style="color: var(--text-muted); margin-bottom: 20px;">Looks like you haven't added anything yet.</p>
                <a href="/dashboard" onclick="showSection('marketplace')" class="btn btn-primary">Start Shopping</a>
            </div>`;
        checkoutBtn.disabled = true;
        updateSummary(0);
        return;
    }

    checkoutBtn.disabled = false;
    let subtotal = 0;

    container.innerHTML = cartData.map(item => {
        const itemTotal = item.price * item.quantity;
        subtotal += itemTotal;
        return `
        <div class="cart-item" data-id="${item.id}">
            <div class="item-image">
                ${item.image_url ? `<img src="${item.image_url}" alt="${item.name}">` : '<i class="fas fa-box"></i>'}
            </div>
            <div class="item-details">
                <div>
                    <div class="item-name">${item.name}</div>
                    <div class="item-seller">Sold by: ShopHub Seller</div>
                    <div class="item-price">$${item.price.toFixed(2)}</div>
                </div>
                <div class="item-controls">
                    <div class="quantity-control">
                        <button class="qty-btn" onclick="updateQuantity(${item.id}, ${item.quantity - 1})"><i class="fas fa-minus"></i></button>
                        <input type="text" class="qty-input" value="${item.quantity}" readonly>
                        <button class="qty-btn" onclick="updateQuantity(${item.id}, ${item.quantity + 1}, ${item.stock_quantity})"><i class="fas fa-plus"></i></button>
                    </div>
                    <button class="remove-btn" onclick="removeItem(${item.id})">
                        <i class="fas fa-trash-alt"></i> Remove
                    </button>
                </div>
            </div>
        </div>`;
    }).join('');

    updateSummary(subtotal);
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

function updateSummary(subtotal) {
    const total = subtotal > 0 ? subtotal + SHIPPING_FEE : 0;
    document.getElementById('summarySubtotal').textContent = `$${subtotal.toFixed(2)}`;
    document.getElementById('summaryShipping').textContent = `$${SHIPPING_FEE.toFixed(2)}`;
    document.getElementById('summaryTotal').textContent = `$${total.toFixed(2)}`;
}

async function updateNavCartCount() {
    const token = localStorage.getItem('token');
    if (!token) return;
    try {
        const res = await fetch(`${API_URL}/cart`, { headers: { 'Authorization': `Bearer ${token}` } });
        if (res.ok) {
            const cart = await res.json();
            const count = cart.reduce((sum, item) => sum + item.quantity, 0);
            const badge = document.getElementById('navCartCount');
            if (badge) {
                badge.textContent = count;
                badge.style.display = count > 0 ? 'flex' : 'none';
            }
        }
    } catch (error) { console.warn('Cart count error:', error); }
}
