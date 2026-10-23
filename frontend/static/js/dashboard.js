const API_URL = '/api';
let currentUser = null;
let categories = [];

// --- Initialization ---
document.addEventListener('DOMContentLoaded', async () => {
    const token = localStorage.getItem('token');
    if (!token) {
        window.location.href = '/login';
        return;
    }

    try {
        // Fetch user profile
        const userRes = await fetch(`${API_URL}/me`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!userRes.ok) throw new Error('Unauthorized');
        currentUser = await userRes.json();

        // Update UI with user info
        document.getElementById('userName').textContent = currentUser.full_name;
        document.getElementById('userAvatar').textContent = currentUser.full_name.charAt(0).toUpperCase();

        // Render Role-Specific UI
        renderSidebar();
        if (currentUser.user_type === 'seller') {
            document.getElementById('sellerStats').style.display = 'grid';
            document.getElementById('sellerProductsSection').style.display = 'block';
            document.getElementById('pageTitle').textContent = 'Seller Dashboard';
            await loadSellerData();
        } else {
            document.getElementById('buyerSection').style.display = 'block';
            document.getElementById('pageTitle').textContent = 'Buyer Dashboard';
        }

        // Load Notifications
        await loadNotifications();
        
        // Load Categories for Modal
        await loadCategories();

    } catch (error) {
        console.error('Dashboard init error:', error);
        localStorage.removeItem('token');
        window.location.href = '/login';
    }
});

// --- UI Rendering ---
function renderSidebar() {
    const menu = document.getElementById('sidebarMenu');
    if (currentUser.user_type === 'seller') {
        menu.innerHTML = `
            <li><a href="#" class="active"><i class="fas fa-chart-line"></i> Overview</a></li>
            <li><a href="#"><i class="fas fa-box"></i> My Products</a></li>
            <li><a href="#"><i class="fas fa-shopping-cart"></i> Orders</a></li>
            <li><a href="#"><i class="fas fa-cog"></i> Settings</a></li>
        `;
    } else {
        menu.innerHTML = `
            <li><a href="#" class="active"><i class="fas fa-home"></i> Overview</a></li>
            <li><a href="#"><i class="fas fa-shopping-bag"></i> My Orders</a></li>
            <li><a href="#"><i class="fas fa-heart"></i> Wishlist</a></li>
            <li><a href="#"><i class="fas fa-cog"></i> Settings</a></li>
        `;
    }
}

// --- Seller Data Loading ---
async function loadSellerData() {
    const token = localStorage.getItem('token');
    const headers = { 'Authorization': `Bearer ${token}` };

    // Load Stats
    const statsRes = await fetch(`${API_URL}/dashboard/stats`, { headers });
    const stats = await statsRes.json();
    document.getElementById('statActiveProducts').textContent = stats.active_products;
    document.getElementById('statLowStock').textContent = stats.low_stock;
    document.getElementById('statInventoryValue').textContent = `$${parseFloat(stats.inventory_value).toFixed(2)}`;

    // Load Products
    const productsRes = await fetch(`${API_URL}/seller/products`, { headers });
    const products = await productsRes.json();
    renderProductsTable(products);
}

function renderProductsTable(products) {
    const tbody = document.getElementById('productsTableBody');
    if (products.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding: 40px;">No products found. Click "Add Product" to get started.</td></tr>';
        return;
    }

    tbody.innerHTML = products.map(p => `
        <tr>
            <td><strong>${p.name}</strong></td>
            <td>${p.category_name || 'Uncategorized'}</td>
            <td>$${parseFloat(p.price).toFixed(2)}</td>
            <td style="color: ${p.stock_quantity < 5 ? '#dc2626' : 'inherit'}; font-weight: ${p.stock_quantity < 5 ? 'bold' : 'normal'}">
                ${p.stock_quantity} ${p.stock_quantity < 5 ? '⚠️' : ''}
            </td>
            <td><span class="status-badge ${p.is_active ? 'status-active' : 'status-inactive'}">${p.is_active ? 'Active' : 'Archived'}</span></td>
            <td>
                <div class="action-btns">
                    <button class="btn btn-outline btn-sm btn-icon" onclick='editProduct(${JSON.stringify(p).replace(/'/g, "&#39;")})'><i class="fas fa-edit"></i></button>
                    <button class="btn btn-outline btn-sm btn-icon" style="color: #dc2626; border-color: #fecaca;" onclick="deleteProduct(${p.id})"><i class="fas fa-trash"></i></button>
                </div>
            </td>
        </tr>
    `).join('');
}

// --- Product CRUD ---
async function loadCategories() {
    const res = await fetch(`${API_URL}/categories`);
    categories = await res.json();
    const select = document.getElementById('prodCategory');
    select.innerHTML = categories.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
}

function openProductModal(product = null) {
    const modal = document.getElementById('productModal');
    const form = document.getElementById('productForm');
    form.reset();
    document.getElementById('productId').value = '';
    document.getElementById('modalTitle').textContent = 'Add New Product';

    if (product) {
        document.getElementById('modalTitle').textContent = 'Edit Product';
        document.getElementById('productId').value = product.id;
        document.getElementById('prodName').value = product.name;
        document.getElementById('prodCategory').value = product.category_id || (categories[0]?.id || '');
        document.getElementById('prodPrice').value = product.price;
        document.getElementById('prodStock').value = product.stock_quantity;
        document.getElementById('prodDesc').value = product.description || '';
        document.getElementById('prodImage').value = product.image_url || '';
    }
    modal.classList.add('active');
}

function closeProductModal() {
    document.getElementById('productModal').classList.remove('active');
}

document.getElementById('productForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const token = localStorage.getItem('token');
    const productId = document.getElementById('productId').value;
    const isEdit = !!productId;

    const payload = {
        name: document.getElementById('prodName').value,
        category_id: parseInt(document.getElementById('prodCategory').value),
        price: parseFloat(document.getElementById('prodPrice').value),
        stock_quantity: parseInt(document.getElementById('prodStock').value),
        description: document.getElementById('prodDesc').value,
        image_url: document.getElementById('prodImage').value || null
    };

    const url = isEdit ? `${API_URL}/seller/products/${productId}` : `${API_URL}/seller/products`;
    const method = isEdit ? 'PUT' : 'POST';

    const btn = document.getElementById('saveProductBtn');
    btn.disabled = true;
    btn.textContent = 'Saving...';

    try {
        const res = await fetch(url, {
            method,
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        if (res.ok) {
            closeProductModal();
            await loadSellerData(); // Refresh table and stats
            await loadNotifications(); // Refresh notifications (new one was created!)
        } else {
            const err = await res.json();
            alert(err.detail || 'Failed to save product');
        }
    } catch (error) {
        alert('Network error');
    } finally {
        btn.disabled = false;
        btn.textContent = 'Save Product';
    }
});

function editProduct(product) {
    openProductModal(product);
}

async function deleteProduct(productId) {
    if (!confirm('Are you sure you want to archive this product? It will be hidden from the storefront.')) return;

    const token = localStorage.getItem('token');
    try {
        const res = await fetch(`${API_URL}/seller/products/${productId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (res.ok) {
            await loadSellerData();
            await loadNotifications();
        } else {
            alert('Failed to delete product');
        }
    } catch (error) {
        alert('Network error');
    }
}

// --- Notifications ---
async function loadNotifications() {
    const token = localStorage.getItem('token');
    const res = await fetch(`${API_URL}/notifications`, {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    const notifs = await res.json();
    
    const unreadCount = notifs.filter(n => !n.is_read).length;
    const badge = document.getElementById('notifBadge');
    
    if (unreadCount > 0) {
        badge.textContent = unreadCount;
        badge.style.display = 'flex';
    } else {
        badge.style.display = 'none';
    }

    const list = document.getElementById('notifList');
    if (notifs.length === 0) {
        list.innerHTML = '<p class="empty-state" style="padding: 20px; text-align: center;">No notifications</p>';
    } else {
        list.innerHTML = notifs.map(n => `
            <div class="notif-item ${!n.is_read ? 'unread' : ''}" onclick="markAsRead(${n.id})">
                <h5>${n.title}</h5>
                <p>${n.message}</p>
                <div class="time">${new Date(n.created_at).toLocaleDateString()}</div>
            </div>
        `).join('');
    }
}

document.getElementById('notifBtn').addEventListener('click', (e) => {
    e.stopPropagation();
    document.getElementById('notifDropdown').classList.toggle('active');
});

document.addEventListener('click', () => {
    document.getElementById('notifDropdown').classList.remove('active');
});

async function markAsRead(notifId) {
    const token = localStorage.getItem('token');
    await fetch(`${API_URL}/notifications/${notifId}/read`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}` }
    });
    await loadNotifications();
}

document.getElementById('markAllRead').addEventListener('click', async (e) => {
    e.stopPropagation();
    const token = localStorage.getItem('token');
    const res = await fetch(`${API_URL}/notifications`, { headers: { 'Authorization': `Bearer ${token}` } });
    const notifs = await res.json();
    
    // Mark all unread as read (batching in real app, loop here for simplicity)
    for (const n of notifs) {
        if (!n.is_read) {
            await fetch(`${API_URL}/notifications/${n.id}/read`, {
                method: 'PUT',
                headers: { 'Authorization': `Bearer ${token}` }
            });
        }
    }
    await loadNotifications();
});

// --- Utility ---
function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('userType');
    window.location.href = '/login';
}
