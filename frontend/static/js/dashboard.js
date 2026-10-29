const API_URL = '/api';
let currentUser = null;
let categories = [];
let allProducts = [];
let uploadedProductImageUrl = '';
let uploadedLogoUrl = '';

// --- TOAST NOTIFICATION SYSTEM ---
function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    let icon = 'fa-info-circle';
    if (type === 'success') icon = 'fa-check-circle';
    if (type === 'error') icon = 'fa-exclamation-circle';

    toast.innerHTML = `<i class="fas ${icon}"></i> <span>${message}</span>`;
    container.appendChild(toast);

    // Auto remove after 4 seconds
    setTimeout(() => {
        toast.style.animation = 'fadeOut 0.3s ease-out forwards';
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

// --- CART COUNT UPDATER ---
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
    } catch (error) {
        console.warn('Cart count update failed:', error);
    }
}

// --- INITIALIZATION ---
document.addEventListener('DOMContentLoaded', async () => {
    const token = localStorage.getItem('token');
    if (!token) {
        window.location.href = '/login';
        return;
    }

    try {
        const userRes = await fetch(`${API_URL}/me`, { headers: { 'Authorization': `Bearer ${token}` } });
        if (!userRes.ok) throw new Error('Unauthorized');
        currentUser = await userRes.json();

        const userNameEl = document.getElementById('userName');
        const userRoleEl = document.getElementById('userRole');
        const userAvatarEl = document.getElementById('userAvatar');
        
        if (userNameEl) userNameEl.textContent = currentUser.full_name;
        if (userRoleEl) userRoleEl.textContent = currentUser.user_type;
        if (userAvatarEl) userAvatarEl.textContent = currentUser.full_name.charAt(0).toUpperCase();

        renderSidebar();
        await loadCategories();
        await updateNavCartCount(); // Load cart count on dashboard load
        loadNotificationsAsync();

        // ✅ AUTOMATICALLY SHOW CORRECT DASHBOARD OVERVIEW
        const defaultView = currentUser.user_type === 'seller' ? 'overview' : 'buyerOverview';
        showSection(defaultView);

    } catch (error) {
        console.error('Dashboard init error:', error);
        localStorage.removeItem('token');
        window.location.href = '/login';
    }
});

// --- NAVIGATION & UI ---
function renderSidebar() {
    const menu = document.getElementById('sidebarMenu');
    if (!menu) return;

    if (currentUser.user_type === 'seller') {
        menu.innerHTML = `
            <li><a href="#" onclick="showSection('overview')" class="active" id="nav-overview"><i class="fas fa-chart-line"></i> Overview</a></li>
            <li><a href="#" onclick="showSection('products')" id="nav-products"><i class="fas fa-box"></i> My Products</a></li>
            <li><a href="#" onclick="showSection('profile')" id="nav-profile"><i class="fas fa-user-circle"></i> Store Profile</a></li>
            <li><a href="#" onclick="showSection('orders')" id="nav-orders"><i class="fas fa-shopping-cart"></i> Orders</a></li>
        `;
    } else {
        menu.innerHTML = `
            <li><a href="#" onclick="showSection('buyerOverview')" class="active" id="nav-buyerOverview"><i class="fas fa-home"></i> Overview</a></li>
            <li><a href="#" onclick="showSection('marketplace')" id="nav-marketplace"><i class="fas fa-store"></i> Browse Marketplace</a></li>
            <li><a href="#" onclick="showSection('buyerOrders')" id="nav-buyerOrders"><i class="fas fa-shopping-bag"></i> My Orders</a></li>
            <li><a href="#" onclick="showSection('buyerWishlist')" id="nav-buyerWishlist"><i class="fas fa-heart"></i> Wishlist</a></li>
            <li><a href="#" onclick="showSection('buyerProfile')" id="nav-buyerProfile"><i class="fas fa-cog"></i> Profile & Settings</a></li>
        `;
    }
}

function showSection(section) {
    const hide = (id) => { const el = document.getElementById(id); if (el) el.style.display = 'none'; };
    const showBlock = (id) => { const el = document.getElementById(id); if (el) el.style.display = 'block'; };
    const showGrid = (id) => { const el = document.getElementById(id); if (el) el.style.display = 'grid'; };

    // Hide all sections
    ['sellerStats', 'sellerProductsSection', 'sellerProfileSection', 'sellerOrdersSection', 'overviewSection', 
     'buyerOverviewSection', 'buyerMarketplaceSection', 'buyerProfileSection', 'buyerSection'].forEach(hide);

    document.querySelectorAll('.sidebar-menu a').forEach(a => a.classList.remove('active'));

    if (currentUser.user_type === 'seller') {
        if (section === 'overview') {
            showGrid('sellerStats'); showBlock('overviewSection');
            document.getElementById('nav-overview')?.classList.add('active');
            document.getElementById('pageTitle').textContent = 'Seller Dashboard';
            loadSellerData(); loadOverviewProducts();
        } else if (section === 'products') {
            showBlock('sellerProductsSection');
            document.getElementById('nav-products')?.classList.add('active');
            document.getElementById('pageTitle').textContent = 'My Products';
            loadSellerData();
        } else if (section === 'profile') {
            showBlock('sellerProfileSection');
            document.getElementById('nav-profile')?.classList.add('active');
            document.getElementById('pageTitle').textContent = 'Store Profile';
            loadSellerProfile();
        } else if (section === 'orders') {
            showBlock('sellerOrdersSection');
            document.getElementById('nav-orders')?.classList.add('active');
            document.getElementById('pageTitle').textContent = 'Customer Orders';
            loadSellerOrders();
        }
    } else {
        if (section === 'buyerOverview') {
            showBlock('buyerOverviewSection');
            document.getElementById('nav-buyerOverview')?.classList.add('active');
            document.getElementById('pageTitle').textContent = 'Buyer Dashboard';
            document.getElementById('buyerWelcomeName').textContent = currentUser.full_name.split(' ')[0];
            loadBuyerStats();
        } else if (section === 'marketplace') {
            showBlock('buyerMarketplaceSection');
            document.getElementById('nav-marketplace')?.classList.add('active');
            document.getElementById('pageTitle').textContent = 'Browse Marketplace';
            loadMarketplaceCategories();
            loadMarketplaceProducts();
        } else if (section === 'buyerProfile') {
            showBlock('buyerProfileSection');
            document.getElementById('nav-buyerProfile')?.classList.add('active');
            document.getElementById('pageTitle').textContent = 'Profile & Settings';
            loadBuyerProfile();
        } else {
            // Fallback for Orders/Wishlist placeholders
            showBlock('buyerSection');
            document.getElementById('pageTitle').textContent = section === 'buyerOrders' ? 'My Orders' : 'Wishlist';
        }
    }
}

// --- NOTIFICATIONS ---
async function loadNotificationsAsync() {
    try { await loadNotifications(); } 
    catch (error) { console.warn('Failed to load notifications (non-critical):', error); }
}

async function loadNotifications() {
    const token = localStorage.getItem('token');
    if (!token) return;
    try {
        const res = await fetch(`${API_URL}/notifications`, { headers: { 'Authorization': `Bearer ${token}` } });
        if (res.status === 401 || !res.ok) return;
        const notifs = await res.json();
        const unreadCount = notifs.filter(n => !n.is_read).length;
        const badge = document.getElementById('notifBadge');
        if (badge) {
            badge.textContent = unreadCount;
            badge.style.display = unreadCount > 0 ? 'flex' : 'none';
        }
        const list = document.getElementById('notifList');
        if (list) {
            if (notifs.length === 0) {
                list.innerHTML = '<p style="padding: 20px; text-align: center; color: var(--text-muted);">No notifications</p>';
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
    } catch (error) { console.warn('Notification loading error:', error); }
}

const notifBtn = document.getElementById('notifBtn');
if (notifBtn) {
    notifBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const dropdown = document.getElementById('notifDropdown');
        if (dropdown) {
            dropdown.classList.toggle('active');
            if (dropdown.classList.contains('active')) await loadNotifications();
        }
    });
}

document.addEventListener('click', (e) => {
    const dropdown = document.getElementById('notifDropdown');
    const bell = document.getElementById('notifBtn');
    if (dropdown && bell && !dropdown.contains(e.target) && !bell.contains(e.target)) {
        dropdown.classList.remove('active');
    }
});

async function markAsRead(notifId) {
    const token = localStorage.getItem('token');
    if (!token) return;
    try {
        await fetch(`${API_URL}/notifications/${notifId}/read`, { method: 'PUT', headers: { 'Authorization': `Bearer ${token}` } });
        await loadNotifications();
    } catch (error) { console.warn('Mark read error:', error); }
}

const markAllReadBtn = document.getElementById('markAllRead');
if (markAllReadBtn) {
    markAllReadBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const token = localStorage.getItem('token');
        if (!token) return;
        try {
            const res = await fetch(`${API_URL}/notifications`, { headers: { 'Authorization': `Bearer ${token}` } });
            if (!res.ok) return;
            const notifs = await res.json();
            for (const n of notifs) {
                if (!n.is_read) {
                    await fetch(`${API_URL}/notifications/${n.id}/read`, { method: 'PUT', headers: { 'Authorization': `Bearer ${token}` } });
                }
            }
            await loadNotifications();
        } catch (error) { console.warn('Mark all read error:', error); }
    });
}

// --- SELLER DATA & PRODUCTS ---
async function loadSellerData() {
    const token = localStorage.getItem('token');
    const headers = { 'Authorization': `Bearer ${token}` };
    try {
        const statsRes = await fetch(`${API_URL}/dashboard/stats`, { headers });
        if (statsRes.ok) {
            const stats = await statsRes.json();
            const el1 = document.getElementById('statActiveProducts'); if(el1) el1.textContent = stats.active_products;
            const el2 = document.getElementById('statLowStock'); if(el2) el2.textContent = stats.low_stock;
            const el3 = document.getElementById('statInventoryValue'); if(el3) el3.textContent = `$${parseFloat(stats.inventory_value || 0).toFixed(2)}`;
        }
        const productsRes = await fetch(`${API_URL}/seller/products`, { headers });
        if (productsRes.ok) {
            allProducts = await productsRes.json();
            populateCategoryFilter();
            renderProductsTable(allProducts);
        }
    } catch (error) { console.error('Load seller data error:', error); }
}

async function loadOverviewProducts() {
    const token = localStorage.getItem('token');
    try {
        const res = await fetch(`${API_URL}/seller/products`, { headers: { 'Authorization': `Bearer ${token}` } });
        if (!res.ok) return;
        const products = await res.json();
        const recentProducts = products.filter(p => p.is_active).slice(0, 3);
        const grid = document.getElementById('recentProductsGrid');
        if (!grid) return;
        if (recentProducts.length === 0) {
            grid.innerHTML = '<p style="color: var(--text-muted); grid-column: 1/-1; text-align: center; padding: 30px;">No active products yet.</p>';
            return;
        }
        grid.innerHTML = recentProducts.map(p => `
            <div class="recent-product-card">
                ${p.image_url ? `<img src="${p.image_url}" alt="${p.name}">` : `<div class="no-image"><i class="fas fa-box"></i></div>`}
                <div class="recent-product-info">
                    <h4>${p.name}</h4>
                    <p>${p.category_name || 'Uncategorized'}</p>
                    <p class="price">$${parseFloat(p.price).toFixed(2)}</p>
                </div>
            </div>
        `).join('');
    } catch (error) { console.error('Overview products error:', error); }
}

async function loadCategories() {
    try {
        const res = await fetch(`${API_URL}/categories`);
        if (res.ok) {
            categories = await res.json();
            const select = document.getElementById('prodCategory');
            if (select) select.innerHTML = categories.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
        }
    } catch (error) { console.error('Load categories error:', error); }
}

function populateCategoryFilter() {
    const select = document.getElementById('categoryFilter');
    if (!select) return;
    const uniqueCategories = [...new Set(allProducts.map(p => p.category_name).filter(Boolean))];
    select.innerHTML = '<option value="all">All Categories</option>' + uniqueCategories.map(cat => `<option value="${cat}">${cat}</option>`).join('');
}

function filterProducts() {
    const searchTerm = document.getElementById('productSearch')?.value.toLowerCase() || '';
    const statusFilter = document.getElementById('statusFilter')?.value || 'all';
    const categoryFilter = document.getElementById('categoryFilter')?.value || 'all';
    let filtered = allProducts;
    if (searchTerm) filtered = filtered.filter(p => p.name.toLowerCase().includes(searchTerm));
    if (statusFilter === 'active') filtered = filtered.filter(p => p.is_active);
    else if (statusFilter === 'archived') filtered = filtered.filter(p => !p.is_active);
    if (categoryFilter !== 'all') filtered = filtered.filter(p => p.category_name === categoryFilter);
    renderProductsTable(filtered);
}

function renderProductsTable(products) {
    const tbody = document.getElementById('productsTableBody');
    const emptyState = document.getElementById('emptyProductsState');
    const tableContainer = document.querySelector('#sellerProductsSection .table-container');
    if (!tbody) return;
    if (!products || products.length === 0) {
        tbody.innerHTML = '';
        if (emptyState) emptyState.style.display = 'block';
        if (tableContainer) tableContainer.style.display = 'none';
        return;
    }
    if (emptyState) emptyState.style.display = 'none';
    if (tableContainer) tableContainer.style.display = 'block';
    tbody.innerHTML = products.map(p => `
        <tr>
            <td>${p.image_url ? `<img src="${p.image_url}" alt="${p.name}">` : `<div class="no-image"><i class="fas fa-box"></i></div>`}</td>
            <td><strong>${p.name}</strong></td>
            <td>${p.category_name || 'Uncategorized'}</td>
            <td><strong>$${parseFloat(p.price).toFixed(2)}</strong></td>
            <td><span style="color: ${p.stock_quantity < 5 ? '#dc2626' : 'inherit'}">${p.stock_quantity} ${p.stock_quantity < 5 ? '⚠️' : ''}</span></td>
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

// --- PRODUCT MODAL & UPLOADS ---
function openProductModal(product = null) {
    const modal = document.getElementById('productModal');
    const form = document.getElementById('productForm');
    if (!modal || !form) return;
    form.reset();
    document.getElementById('productId').value = '';
    document.getElementById('modalTitle').textContent = 'Add New Product';
    document.getElementById('productImagePreview').style.display = 'none';
    document.getElementById('uploadText').textContent = 'Click to upload image';
    uploadedProductImageUrl = '';

    if (product) {
        document.getElementById('modalTitle').textContent = 'Edit Product';
        document.getElementById('productId').value = product.id;
        document.getElementById('prodName').value = product.name;
        document.getElementById('prodCategory').value = product.category_id || (categories[0]?.id || '');
        document.getElementById('prodPrice').value = product.price;
        document.getElementById('prodStock').value = product.stock_quantity;
        document.getElementById('prodDesc').value = product.description || '';
        if (product.image_url) {
            uploadedProductImageUrl = product.image_url;
            document.getElementById('prodImageUrl').value = product.image_url;
            document.getElementById('productImagePreview').src = product.image_url;
            document.getElementById('productImagePreview').style.display = 'block';
            document.getElementById('uploadText').textContent = 'Change Image';
        }
    }
    modal.classList.add('active');
}

function closeProductModal() {
    const modal = document.getElementById('productModal');
    if (modal) modal.classList.remove('active');
}

async function handleProductImageUpload(input) {
    if (input.files && input.files[0]) {
        const formData = new FormData();
        formData.append('file', input.files[0]);
        document.getElementById('uploadText').textContent = 'Uploading...';
        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`${API_URL}/upload-image`, { method: 'POST', headers: { 'Authorization': `Bearer ${token}` }, body: formData });
            const data = await res.json();
            if (res.ok) {
                uploadedProductImageUrl = data.url;
                document.getElementById('prodImageUrl').value = data.url;
                document.getElementById('productImagePreview').src = data.url;
                document.getElementById('productImagePreview').style.display = 'block';
                document.getElementById('uploadText').textContent = 'Change Image';
                showToast('Image uploaded successfully!', 'success');
            } else {
                showToast(data.detail || 'Upload failed', 'error');
                document.getElementById('uploadText').textContent = 'Click to upload image';
            }
        } catch (error) {
            showToast('Network error during upload', 'error');
            document.getElementById('uploadText').textContent = 'Click to upload image';
        }
    }
}

document.getElementById('productForm')?.addEventListener('submit', async (e) => {
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
        image_url: uploadedProductImageUrl || null
    };
    const url = isEdit ? `${API_URL}/seller/products/${productId}` : `${API_URL}/seller/products`;
    const method = isEdit ? 'PUT' : 'POST';
    const btn = document.getElementById('saveProductBtn');
    if (btn) { btn.disabled = true; btn.textContent = 'Saving...'; }

    try {
        const res = await fetch(url, { method, headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        if (res.ok) {
            closeProductModal();
            showToast(isEdit ? 'Product updated successfully!' : 'Product created successfully!', 'success');
            await loadSellerData();
            await loadNotifications(); // Refresh notifications for the new product event
        } else {
            const err = await res.json();
            showToast(err.detail || 'Failed to save product', 'error');
        }
    } catch (error) { showToast('Network error', 'error'); } 
    finally { if (btn) { btn.disabled = false; btn.textContent = 'Save Product'; } }
});

function editProduct(product) { openProductModal(product); }

async function deleteProduct(productId) {
    if (!confirm('Archive this product?')) return;
    const token = localStorage.getItem('token');
    try {
        const res = await fetch(`${API_URL}/seller/products/${productId}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } });
        if (res.ok) {
            showToast('Product archived successfully', 'success');
            await loadSellerData();
            await loadNotifications();
        } else { showToast('Failed to archive product', 'error'); }
    } catch (error) { showToast('Network error', 'error'); }
}

// --- SELLER PROFILE ---
async function loadSellerProfile() {
    const token = localStorage.getItem('token');
    try {
        const res = await fetch(`${API_URL}/seller/profile`, { headers: { 'Authorization': `Bearer ${token}` } });
        if (!res.ok) return;
        const profile = await res.json();
        const elName = document.getElementById('displayBusinessName'); if(elName) elName.textContent = profile.business_name || 'Unnamed Store';
        const elEmail = document.getElementById('displayEmail'); if(elEmail) elEmail.textContent = profile.email;
        const elBusName = document.getElementById('profileBusinessName'); if(elBusName) elBusName.value = profile.business_name || '';
        const elWeb = document.getElementById('profileWebsite'); if(elWeb) elWeb.value = profile.website || '';
        const elDesc = document.getElementById('profileDescription'); if(elDesc) elDesc.value = profile.business_description || '';
        if (profile.logo_url) {
            const elLogo = document.getElementById('profileLogoPreview');
            if(elLogo) elLogo.src = profile.logo_url;
            uploadedLogoUrl = profile.logo_url;
        }
        const badge = document.getElementById('verificationBadge');
        if (badge) {
            if (profile.is_verified_seller) {
                badge.textContent = 'Verified Seller';
                badge.className = 'status-badge status-active';
            } else {
                badge.textContent = 'Pending Verification';
                badge.className = 'status-badge status-inactive';
            }
        }
    } catch (error) { console.error('Failed to load profile', error); }
}

async function handleLogoUpload(input) {
    if (input.files && input.files[0]) {
        const formData = new FormData();
        formData.append('file', input.files[0]);
        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`${API_URL}/upload-image`, { method: 'POST', headers: { 'Authorization': `Bearer ${token}` }, body: formData });
            const data = await res.json();
            if (res.ok) {
                uploadedLogoUrl = data.url;
                const elLogo = document.getElementById('profileLogoPreview');
                if(elLogo) elLogo.src = data.url;
                showToast('Logo uploaded successfully!', 'success');
            } else { showToast(data.detail || 'Upload failed', 'error'); }
        } catch (error) { showToast('Network error during upload', 'error'); }
    }
}

document.getElementById('profileForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const token = localStorage.getItem('token');
    const btn = document.getElementById('saveProfileBtn');
    if (btn) { btn.disabled = true; btn.textContent = 'Saving...'; }
    const payload = {
        business_name: document.getElementById('profileBusinessName').value,
        website: document.getElementById('profileWebsite').value || null,
        business_description: document.getElementById('profileDescription').value || null,
        logo_url: uploadedLogoUrl || null
    };
    try {
        const res = await fetch(`${API_URL}/seller/profile`, { method: 'PUT', headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        if (res.ok) { 
            showToast('Profile updated successfully!', 'success'); 
            loadSellerProfile(); 
        } else { 
            const err = await res.json(); showToast(err.detail || 'Failed to update profile', 'error'); 
        }
    } catch (error) { showToast('Network error', 'error'); } 
    finally { if (btn) { btn.disabled = false; btn.textContent = 'Save Changes'; } }
});

// --- SELLER ORDERS ---
async function loadSellerOrders() {
    const token = localStorage.getItem('token');
    const statusFilter = document.getElementById('orderStatusFilter')?.value || 'all';
    try {
        const res = await fetch(`${API_URL}/seller/orders?status=${statusFilter}`, { headers: { 'Authorization': `Bearer ${token}` } });
        if (res.ok) renderOrdersTable(await res.json());
        const allOrdersRes = await fetch(`${API_URL}/seller/orders`, { headers: { 'Authorization': `Bearer ${token}` } });
        if (allOrdersRes.ok) renderOrdersStats(await allOrdersRes.json());
    } catch (error) { console.error('Error loading orders:', error); }
}

function renderOrdersStats(orders) {
    const grid = document.getElementById('ordersStatsGrid');
    if (!grid) return;
    const stats = {
        pending: orders.filter(o => o.status === 'pending').length,
        processing: orders.filter(o => o.status === 'processing').length,
        shipped: orders.filter(o => o.status === 'shipped').length,
        delivered: orders.filter(o => o.status === 'delivered').length
    };
    grid.innerHTML = `
        <div class="order-stat-card pending"><h4>Pending</h4><p>${stats.pending}</p></div>
        <div class="order-stat-card processing"><h4>Processing</h4><p>${stats.processing}</p></div>
        <div class="order-stat-card shipped"><h4>Shipped</h4><p>${stats.shipped}</p></div>
        <div class="order-stat-card delivered"><h4>Delivered</h4><p>${stats.delivered}</p></div>
    `;
}

function renderOrdersTable(orders) {
    const tbody = document.getElementById('ordersTableBody');
    const emptyState = document.getElementById('emptyOrdersState');
    const tableContainer = document.querySelector('#sellerOrdersSection .table-container');
    if (!tbody) return;
    if (!orders || orders.length === 0) {
        tbody.innerHTML = '';
        if (emptyState) emptyState.style.display = 'block';
        if (tableContainer) tableContainer.style.display = 'none';
        return;
    }
    if (emptyState) emptyState.style.display = 'none';
    if (tableContainer) tableContainer.style.display = 'block';
    tbody.innerHTML = orders.map(order => `
        <tr>
            <td><strong>#${order.id}</strong></td>
            <td><div>${order.buyer_name}</div><div style="font-size: 0.8rem; color: var(--text-muted);">${order.buyer_email}</div></td>
            <td>${order.items_count} item${order.items_count > 1 ? 's' : ''}</td>
            <td><strong>$${parseFloat(order.total_amount).toFixed(2)}</strong></td>
            <td><span class="status-badge status-${order.status}">${order.status.charAt(0).toUpperCase() + order.status.slice(1)}</span></td>
            <td>${new Date(order.created_at).toLocaleDateString()}</td>
            <td><button class="btn btn-outline btn-sm" onclick="viewOrderDetails(${order.id})"><i class="fas fa-eye"></i> View</button></td>
        </tr>
    `).join('');
}

async function viewOrderDetails(orderId) {
    const token = localStorage.getItem('token');
    const modal = document.getElementById('orderDetailModal');
    const content = document.getElementById('orderDetailContent');
    if (!modal || !content) return;
    content.innerHTML = '<div style="text-align: center; padding: 40px;"><i class="fas fa-spinner fa-spin"></i> Loading...</div>';
    modal.classList.add('active');
    try {
        const res = await fetch(`${API_URL}/seller/orders/${orderId}`, { headers: { 'Authorization': `Bearer ${token}` } });
        if (!res.ok) throw new Error('Failed to load order');
        const data = await res.json();
        const order = data.order;
        const items = data.items;
        const title = document.getElementById('orderModalTitle');
        if (title) title.textContent = `Order #${order.id}`;
        content.innerHTML = `
            <div class="order-info-grid">
                <div class="order-info-block"><h5>Customer</h5><p>${order.buyer_name}</p><p style="font-size: 0.85rem; color: var(--text-muted);">${order.buyer_email}</p>${order.buyer_phone ? `<p style="font-size: 0.85rem; color: var(--text-muted);">${order.buyer_phone}</p>` : ''}</div>
                <div class="order-info-block"><h5>Status</h5><span class="status-badge status-${order.status}" style="font-size: 0.9rem; padding: 6px 12px;">${order.status.charAt(0).toUpperCase() + order.status.slice(1)}</span></div>
                <div class="order-info-block"><h5>Order Date</h5><p>${new Date(order.created_at).toLocaleString()}</p></div>
                <div class="order-info-block"><h5>Total Amount</h5><p style="color: var(--primary); font-size: 1.2rem; font-weight: 700;">$${parseFloat(order.total_amount).toFixed(2)}</p></div>
                <div class="order-info-block" style="grid-column: 1 / -1;"><h5>Shipping Address</h5><p>${order.shipping_address}</p></div>
            </div>
            <div class="order-items-list">
                <h4>Items (${items.length})</h4>
                ${items.map(item => `
                    <div class="order-item-row">
                        ${item.image_url ? `<img src="${item.image_url}" alt="${item.name}">` : `<div class="no-img"><i class="fas fa-box"></i></div>`}
                        <div class="order-item-info"><h5>${item.name}</h5><p>Qty: ${item.quantity} × $${parseFloat(item.price_at_purchase).toFixed(2)}</p></div>
                        <div class="order-item-price">$${(item.quantity * item.price_at_purchase).toFixed(2)}</div>
                    </div>
                `).join('')}
            </div>
            <div class="order-status-selector">
                <label>Update Status:</label>
                <select id="newOrderStatus">
                    <option value="pending" ${order.status === 'pending' ? 'selected' : ''}>Pending</option>
                    <option value="processing" ${order.status === 'processing' ? 'selected' : ''}>Processing</option>
                    <option value="shipped" ${order.status === 'shipped' ? 'selected' : ''}>Shipped</option>
                    <option value="delivered" ${order.status === 'delivered' ? 'selected' : ''}>Delivered</option>
                    <option value="cancelled" ${order.status === 'cancelled' ? 'selected' : ''}>Cancelled</option>
                </select>
                <button class="btn btn-primary btn-sm" onclick="updateOrderStatus(${order.id})">Update</button>
            </div>
        `;
    } catch (error) {
        content.innerHTML = '<div style="text-align: center; padding: 40px; color: #dc2626;">Failed to load order details</div>';
    }
}

async function updateOrderStatus(orderId) {
    const token = localStorage.getItem('token');
    const newStatus = document.getElementById('newOrderStatus')?.value;
    if (!newStatus) return;
    try {
        const res = await fetch(`${API_URL}/seller/orders/${orderId}/status`, {
            method: 'PUT', headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: newStatus })
        });
        if (res.ok) {
            showToast(`Order status updated to ${newStatus}!`, 'success');
            closeOrderModal();
            loadSellerOrders();
            loadNotifications();
        } else {
            const err = await res.json();
            showToast(err.detail || 'Failed to update status', 'error');
        }
    } catch (error) { showToast('Network error', 'error'); }
}

function closeOrderModal() {
    const modal = document.getElementById('orderDetailModal');
    if (modal) modal.classList.remove('active');
}

// --- BUYER MARKETPLACE ---
let marketplaceDebounceTimer;
function debounceLoadMarketplace() {
    clearTimeout(marketplaceDebounceTimer);
    marketplaceDebounceTimer = setTimeout(loadMarketplaceProducts, 400);
}

async function loadMarketplaceCategories() {
    try {
        const res = await fetch(`${API_URL}/categories`);
        if (res.ok) {
            const cats = await res.json();
            const select = document.getElementById('marketplaceCategory');
            if (select) {
                select.innerHTML = '<option value="">All Categories</option>' + cats.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
            }
        }
    } catch (error) { console.warn('Load marketplace categories error:', error); }
}

async function loadMarketplaceProducts() {
    const search = document.getElementById('marketplaceSearch')?.value || '';
    const categoryId = document.getElementById('marketplaceCategory')?.value || '';
    const sortBy = document.getElementById('marketplaceSort')?.value || 'bestsellers';
    const grid = document.getElementById('marketplaceGrid');
    const emptyState = document.getElementById('emptyMarketplaceState');
    if (grid) grid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 40px;"><i class="fas fa-spinner fa-spin"></i> Loading...</div>';

    try {
        let url = `${API_URL}/marketplace/products?sort_by=${sortBy}`;
        if (search) url += `&search=${encodeURIComponent(search)}`;
        if (categoryId) url += `&category_id=${categoryId}`;
        const res = await fetch(url);
        if (!res.ok) throw new Error('Failed to load products');
        const products = await res.json();
        if (grid) {
            if (products.length === 0) {
                grid.innerHTML = '';
                if (emptyState) emptyState.style.display = 'block';
            } else {
                if (emptyState) emptyState.style.display = 'none';
                grid.innerHTML = products.map(p => `
                    <div class="marketplace-card">
                        <div class="marketplace-image">
                            ${p.image_url ? `<img src="${p.image_url}" alt="${p.name}">` : `<div class="no-img"><i class="fas fa-box"></i></div>`}
                            <div class="seller-badge"><i class="fas fa-star"></i> ${p.seller_rating || 'New'} | ${p.total_sales || 0} sold</div>
                        </div>
                        <div class="marketplace-info">
                            <h4>${p.name}</h4>
                            <div class="category">${p.category_name} • by ${p.seller_name || 'Unknown Seller'}</div>
                            <div class="price-row">
                                <span class="price">$${parseFloat(p.price).toFixed(2)}</span>
                                <button class="add-cart-btn" onclick="addToCartFromMarketplace(${p.id})" title="Add to Cart">
                                    <i class="fas fa-plus"></i>
                                </button>
                            </div>
                        </div>
                    </div>
                `).join('');
            }
        }
    } catch (error) {
        console.error('Marketplace load error:', error);
        if (grid) grid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 40px; color: #dc2626;">Failed to load products</div>';
    }
}

async function addToCartFromMarketplace(productId) {
    const token = localStorage.getItem('token');
    try {
        const res = await fetch(`${API_URL}/cart`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ product_id: productId, quantity: 1 })
        });
        if (res.ok) {
            showToast('Added to cart successfully!', 'success');
            await updateNavCartCount(); // ✅ AUTO-UPDATE CART COUNT
        } else {
            const err = await res.json();
            showToast(err.detail || 'Failed to add to cart', 'error');
        }
    } catch (error) { showToast('Network error', 'error'); }
}

// --- BUYER PROFILE ---
async function loadBuyerProfile() {
    const token = localStorage.getItem('token');
    try {
        const res = await fetch(`${API_URL}/buyer/profile`, { headers: { 'Authorization': `Bearer ${token}` } });
        if (!res.ok) return;
        const profile = await res.json();
        const elName = document.getElementById('buyerFullName'); if(elName) elName.value = profile.full_name || '';
        const elEmail = document.getElementById('buyerEmail'); if(elEmail) elEmail.value = profile.email || '';
        const elPhone = document.getElementById('buyerPhone'); if(elPhone) elPhone.value = profile.phone || '';
        const elShip = document.getElementById('buyerShippingAddress'); if(elShip) elShip.value = profile.default_shipping_address || '';
        const elBill = document.getElementById('buyerBillingAddress'); if(elBill) elBill.value = profile.default_billing_address || '';
    } catch (error) { console.error('Failed to load buyer profile', error); }
}

document.getElementById('buyerProfileForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const token = localStorage.getItem('token');
    const btn = document.getElementById('saveBuyerProfileBtn');
    if (btn) { btn.disabled = true; btn.textContent = 'Saving...'; }
    const payload = {
        phone: document.getElementById('buyerPhone').value || null,
        default_shipping_address: document.getElementById('buyerShippingAddress').value || null,
        default_billing_address: document.getElementById('buyerBillingAddress').value || null
    };
    try {
        const res = await fetch(`${API_URL}/buyer/profile`, {
            method: 'PUT', headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        if (res.ok) { 
            showToast('Profile updated successfully!', 'success'); 
        } else { 
            const err = await res.json(); showToast(err.detail || 'Failed to update profile', 'error'); 
        }
    } catch (error) { showToast('Network error', 'error'); } 
    finally { if (btn) { btn.disabled = false; btn.textContent = 'Save Changes'; } }
});

async function loadBuyerStats() {
    const el = document.getElementById('buyerTotalOrders');
    if (el) el.textContent = '0'; // Placeholder for future order stats
}

// --- STAR RATING UI HELPERS ---
function generateStarRating(rating, isInteractive = false, productId = 0, orderId = 0) {
    let starsHtml = '';
    for (let i = 1; i <= 5; i++) {
        const isActive = i <= rating ? 'active' : '';
        const readonlyClass = isInteractive ? '' : 'readonly';
        const clickAttr = isInteractive ? `onclick="setRating(${i}, ${productId}, ${orderId})"` : '';
        starsHtml += `<i class="fas fa-star star ${isActive} ${readonlyClass}" ${clickAttr} data-value="${i}"></i>`;
    }
    return `<div class="star-rating ${readonlyClass}" id="star-rating-${productId}-${orderId}">${starsHtml}</div>`;
}

let currentRating = 0;
function setRating(value, productId, orderId) {
    currentRating = value;
    const container = document.getElementById(`star-rating-${productId}-${orderId}`);
    const stars = container.querySelectorAll('.star');
    stars.forEach((star, index) => {
        if (index < value) {
            star.classList.add('active');
        } else {
            star.classList.remove('active');
        }
    });
}

// --- SUBMIT REVIEW ---
async function submitReview(productId, orderId) {
    if (currentRating === 0) {
        showToast('Please select a star rating', 'error');
        return;
    }

    const reviewText = document.getElementById(`review-text-${productId}-${orderId}`)?.value || '';
    const token = localStorage.getItem('token');
    const btn = document.getElementById(`submit-review-btn-${productId}-${orderId}`);
    
    if (btn) { btn.disabled = true; btn.textContent = 'Submitting...'; }

    try {
        const res = await fetch(`${API_URL}/reviews`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                product_id: productId,
                order_id: orderId,
                rating: currentRating,
                review_text: reviewText
            })
        });

        const data = await res.json();
        if (res.ok) {
            showToast('Review submitted successfully!', 'success');
            // Hide form, show success or refresh order list
            const form = document.getElementById(`review-form-${productId}-${orderId}`);
            if (form) form.style.display = 'none';
            currentRating = 0; // Reset
        } else {
            showToast(data.detail || 'Failed to submit review', 'error');
        }
    } catch (error) {
        showToast('Network error', 'error');
    } finally {
        if (btn) { btn.disabled = false; btn.textContent = 'Submit Review'; }
    }
}

// --- FETCH & DISPLAY REVIEWS (For Marketplace/Product View) ---
async function loadProductReviews(productId) {
    try {
        const res = await fetch(`${API_URL}/products/${productId}/reviews`);
        if (!res.ok) return;
        const data = await res.json();
        
        const container = document.getElementById(`reviews-container-${productId}`);
        if (!container) return;

        let html = `
            <div class="avg-rating-display">
                <div class="big-rating">${data.average_rating}</div>
                <div>
                    ${generateStarRating(Math.round(data.average_rating), false)}
                    <div style="font-size: 0.85rem; color: var(--text-muted); margin-top: 4px;">
                        Based on ${data.total_reviews} review${data.total_reviews !== 1 ? 's' : ''}
                    </div>
                </div>
            </div>
        `;

        if (data.reviews.length === 0) {
            html += '<p style="color: var(--text-muted); text-align: center; padding: 20px;">No reviews yet. Be the first!</p>';
        } else {
            html += data.reviews.map(r => `
                <div class="review-card">
                    <div class="review-header">
                        <span class="review-author">${r.buyer_name}</span>
                        <span class="review-date">${new Date(r.created_at).toLocaleDateString()}</span>
                    </div>
                    ${generateStarRating(r.rating, false)}
                    ${r.review_text ? `<p class="review-text" style="margin-top: 8px;">${r.review_text}</p>` : ''}
                </div>
            `).join('');
        }

        container.innerHTML = html;
    } catch (error) {
        console.error('Failed to load reviews:', error);
    }
}

async function loadBuyerOrders() {
    const token = localStorage.getItem('token');
    const container = document.getElementById('buyerOrdersList');
    
    try {
        const res = await fetch(`${API_URL}/buyer/orders`, { headers: { 'Authorization': `Bearer ${token}` } });
        if (!res.ok) throw new Error('Failed to load orders');
        const orders = await res.json();

        if (orders.length === 0) {
            container.innerHTML = `
                <div class="empty-state-card">
                    <i class="fas fa-box-open"></i>
                    <h3>No orders yet</h3>
                    <p>Your order history will appear here once you make a purchase.</p>
                    <button class="btn btn-primary" onclick="showSection('marketplace')" style="margin-top: 15px;">
                        <i class="fas fa-shopping-bag"></i> Start Shopping
                    </button>
                </div>`;
            return;
        }

        container.innerHTML = orders.map(order => `
            <div class="review-card" style="margin-bottom: 20px;">
                <div class="review-header">
                    <span class="review-author">Order #${order.id}</span>
                    <span class="status-badge status-${order.status}">${order.status.charAt(0).toUpperCase() + order.status.slice(1)}</span>
                </div>
                <p style="font-size: 0.9rem; color: var(--text-muted); margin-bottom: 15px;">Total: $${parseFloat(order.total_amount).toFixed(2)} • ${new Date(order.created_at).toLocaleDateString()}</p>
                
                ${order.items.map(item => `
                    <div class="order-item-row" style="margin-bottom: 10px;">
                        ${item.image_url ? `<img src="${item.image_url}" alt="${item.name}">` : `<div class="no-img"><i class="fas fa-box"></i></div>`}
                        <div class="order-item-info">
                            <h5>${item.name}</h5>
                            <p>Qty: ${item.quantity} × $${parseFloat(item.price_at_purchase).toFixed(2)}</p>
                        </div>
                        ${order.status === 'delivered' ? `
                            <button class="btn btn-primary btn-sm" onclick="showReviewForm(${item.product_id}, ${order.id})">
                                <i class="fas fa-star"></i> Leave Review
                            </button>
                        ` : ''}
                    </div>
                    ${order.status === 'delivered' ? `
                        <div id="review-form-${item.product_id}-${order.id}" style="display: none; margin-top: 15px; padding: 15px; background: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0;">
                            <h4 style="margin-bottom: 10px; font-size: 0.95rem;">Rate this product:</h4>
                            ${generateStarRating(0, true, item.product_id, order.id)}
                            <textarea id="review-text-${item.product_id}-${order.id}" rows="3" placeholder="Share your experience (optional)..." style="width: 100%; margin-top: 10px; padding: 10px; border: 1px solid #e2e8f0; border-radius: 6px; font-family: inherit;"></textarea>
                            <div style="display: flex; gap: 10px; margin-top: 10px; justify-content: flex-end;">
                                <button class="btn btn-outline btn-sm" onclick="document.getElementById('review-form-${item.product_id}-${order.id}').style.display = 'none'">Cancel</button>
                                <button id="submit-review-btn-${item.product_id}-${order.id}" class="btn btn-primary btn-sm" onclick="submitReview(${item.product_id}, ${order.id})">Submit Review</button>
                            </div>
                        </div>
                    ` : ''}
                `).join('')}
            </div>
        `).join('');

    } catch (error) {
        console.error('Load buyer orders error:', error);
        container.innerHTML = '<p style="text-align: center; color: var(--text-muted); padding: 40px;">Failed to load orders.</p>';
    }
}

// Helper to show the review form
function showReviewForm(productId, orderId) {
    const form = document.getElementById(`review-form-${productId}-${orderId}`);
    if (form) {
        form.style.display = form.style.display === 'none' ? 'block' : 'none';
    }
}

// --- UTILS ---
function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('userType');
    window.location.href = '/login';
}
