const API_URL = '/api';
let currentUser = null;
let categories = [];
let uploadedProductImageUrl = '';
let uploadedLogoUrl = '';

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

        document.getElementById('userName').textContent = currentUser.full_name;
        document.getElementById('userRole').textContent = currentUser.user_type;
        document.getElementById('userAvatar').textContent = currentUser.full_name.charAt(0).toUpperCase();

        renderSidebar();
        await loadCategories();

        // Default view
        showSection('overview');

        // Load notifications AFTER everything else, with its own error handling
        loadNotificationsAsync();

    } catch (error) {
        console.error('Dashboard init error:', error);
        localStorage.removeItem('token');
        window.location.href = '/login';
    }
});

// Separate async function for notifications that doesn't affect main flow
async function loadNotificationsAsync() {
    try {
        await loadNotifications();
    } catch (error) {
        console.warn('Failed to load notifications (non-critical):', error);
        // Don't log out, just log the warning
    }
}

function renderSidebar() {
    const menu = document.getElementById('sidebarMenu');
    if (currentUser.user_type === 'seller') {
        menu.innerHTML = `
            <li><a href="#" onclick="showSection('overview')" class="active" id="nav-overview"><i class="fas fa-chart-line"></i> Overview</a></li>
            <li><a href="#" onclick="showSection('products')" id="nav-products"><i class="fas fa-box"></i> My Products</a></li>
            <li><a href="#" onclick="showSection('profile')" id="nav-profile"><i class="fas fa-user-circle"></i> Store Profile</a></li>
            <li><a href="#" onclick="showSection('orders')" id="nav-orders"><i class="fas fa-shopping-cart"></i> Orders</a></li>
        `;
        document.getElementById('sellerStats').style.display = 'grid';
        document.getElementById('sellerProductsSection').style.display = 'block';
    } else {
        menu.innerHTML = `
            <li><a href="#" class="active"><i class="fas fa-home"></i> Overview</a></li>
            <li><a href="#"><i class="fas fa-shopping-bag"></i> My Orders</a></li>
        `;
        document.getElementById('buyerSection').style.display = 'block';
    }
}

function showSection(section) {
    // Helper functions to safely show/hide elements without throwing errors
    const hide = (id) => {
        const el = document.getElementById(id);
        if (el) el.style.display = 'none';
    };
    
    const showBlock = (id) => {
        const el = document.getElementById(id);
        if (el) el.style.display = 'block';
    };

    const showGrid = (id) => {
        const el = document.getElementById(id);
        if (el) el.style.display = 'grid';
    };

    // Safely hide all possible sections
    hide('sellerStats');
    hide('sellerProductsSection');
    hide('sellerProfileSection');
    hide('sellerOrdersSection');
    hide('overviewSection');
    hide('buyerSection');

    // Remove active class from all nav links
    document.querySelectorAll('.sidebar-menu a').forEach(a => a.classList.remove('active'));

    // Show the requested section safely
    if (currentUser.user_type === 'seller') {
        if (section === 'overview') {
            showGrid('sellerStats');
            showBlock('overviewSection');
            const nav = document.getElementById('nav-overview'); if (nav) nav.classList.add('active');
            const title = document.getElementById('pageTitle'); if (title) title.textContent = 'Seller Dashboard';
            loadSellerData();
            loadOverviewProducts();
        } else if (section === 'products') {
            showBlock('sellerProductsSection');
            const nav = document.getElementById('nav-products'); if (nav) nav.classList.add('active');
            const title = document.getElementById('pageTitle'); if (title) title.textContent = 'My Products';
            loadSellerData();
        } else if (section === 'profile') {
            showBlock('sellerProfileSection');
            const nav = document.getElementById('nav-profile'); if (nav) nav.classList.add('active');
            const title = document.getElementById('pageTitle'); if (title) title.textContent = 'Store Profile';
            loadSellerProfile();
        } else if (section === 'orders') {
            showBlock('sellerOrdersSection');
            const nav = document.getElementById('nav-orders'); if (nav) nav.classList.add('active');
            const title = document.getElementById('pageTitle'); if (title) title.textContent = 'Customer Orders';
            loadSellerOrders();
        }
    } else {
        // Buyer view
        showBlock('buyerSection');
        const title = document.getElementById('pageTitle'); if (title) title.textContent = 'Buyer Dashboard';
    }
}

// --- IMAGE UPLOAD HANDLERS ---
async function handleProductImageUpload(input) {
    if (input.files && input.files[0]) {
        const file = input.files[0];
        const formData = new FormData();
        formData.append('file', file);

        document.getElementById('uploadText').textContent = 'Uploading...';
        
        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`${API_URL}/upload-image`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` },
                body: formData
            });
            const data = await res.json();
            
            if (res.ok) {
                uploadedProductImageUrl = data.url;
                document.getElementById('prodImageUrl').value = data.url;
                document.getElementById('productImagePreview').src = data.url;
                document.getElementById('productImagePreview').style.display = 'block';
                document.getElementById('uploadText').textContent = 'Change Image';
            } else {
                alert(data.detail || 'Upload failed');
                document.getElementById('uploadText').textContent = 'Click to upload image';
            }
        } catch (error) {
            alert('Network error during upload');
            document.getElementById('uploadText').textContent = 'Click to upload image';
        }
    }
}

async function handleLogoUpload(input) {
    if (input.files && input.files[0]) {
        const file = input.files[0];
        const formData = new FormData();
        formData.append('file', file);

        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`${API_URL}/upload-image`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` },
                body: formData
            });
            const data = await res.json();
            
            if (res.ok) {
                uploadedLogoUrl = data.url;
                document.getElementById('profileLogoPreview').src = data.url;
            } else {
                alert(data.detail || 'Upload failed');
            }
        } catch (error) {
            alert('Network error during upload');
        }
    }
}

// --- PRODUCT CRUD (Updated for Image) ---
async function loadCategories() {
    const res = await fetch(`${API_URL}/categories`);
    categories = await res.json();
    const select = document.getElementById('prodCategory');
    if(select) select.innerHTML = categories.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
}

function openProductModal(product = null) {
    const modal = document.getElementById('productModal');
    const form = document.getElementById('productForm');
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
        image_url: uploadedProductImageUrl || null
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
            await loadSellerData();
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

function editProduct(product) { openProductModal(product); }

async function deleteProduct(productId) {
    if (!confirm('Archive this product? It will be hidden from the storefront.')) return;
    const token = localStorage.getItem('token');
    try {
        const res = await fetch(`${API_URL}/seller/products/${productId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) await loadSellerData();
    } catch (error) { alert('Network error'); }
}

// --- SELLER PROFILE ---
async function loadSellerProfile() {
    const token = localStorage.getItem('token');
    try {
        const res = await fetch(`${API_URL}/seller/profile`, { headers: { 'Authorization': `Bearer ${token}` } });
        const profile = await res.json();
        
        document.getElementById('displayBusinessName').textContent = profile.business_name || 'Unnamed Store';
        document.getElementById('displayEmail').textContent = profile.email;
        document.getElementById('profileBusinessName').value = profile.business_name || '';
        document.getElementById('profileWebsite').value = profile.website || '';
        document.getElementById('profileDescription').value = profile.business_description || '';
        
        if (profile.logo_url) {
            document.getElementById('profileLogoPreview').src = profile.logo_url;
            uploadedLogoUrl = profile.logo_url;
        }
        
        const badge = document.getElementById('verificationBadge');
        if (profile.is_verified_seller) {
            badge.textContent = 'Verified Seller';
            badge.className = 'status-badge status-active';
        } else {
            badge.textContent = 'Pending Verification';
            badge.className = 'status-badge status-inactive';
        }
    } catch (error) {
        console.error('Failed to load profile', error);
    }
}

document.getElementById('profileForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const token = localStorage.getItem('token');
    const btn = document.getElementById('saveProfileBtn');
    btn.disabled = true;
    btn.textContent = 'Saving...';

    const payload = {
        business_name: document.getElementById('profileBusinessName').value,
        website: document.getElementById('profileWebsite').value || null,
        business_description: document.getElementById('profileDescription').value || null,
        logo_url: uploadedLogoUrl || null
    };

    try {
        const res = await fetch(`${API_URL}/seller/profile`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        if (res.ok) {
            alert('Profile updated successfully!');
            loadSellerProfile(); // Refresh display
        } else {
            const err = await res.json();
            alert(err.detail || 'Failed to update profile');
        }
    } catch (error) {
        alert('Network error');
    } finally {
        btn.disabled = false;
        btn.textContent = 'Save Changes';
    }
});

// --- SHARED UTILS ---
async function loadSellerData() {
    const token = localStorage.getItem('token');
    const headers = { 'Authorization': `Bearer ${token}` };
    const statsRes = await fetch(`${API_URL}/dashboard/stats`, { headers });
    const stats = await statsRes.json();
    document.getElementById('statActiveProducts').textContent = stats.active_products;
    document.getElementById('statLowStock').textContent = stats.low_stock;
    document.getElementById('statInventoryValue').textContent = `$${parseFloat(stats.inventory_value).toFixed(2)}`;

    const productsRes = await fetch(`${API_URL}/seller/products`, { headers });
    renderProductsTable(await productsRes.json());
}

function renderProductsTable(products) {
    const tbody = document.getElementById('productsTableBody');
    if (!tbody) return;
    if (products.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding: 40px;">No products found.</td></tr>';
        return;
    }
    tbody.innerHTML = products.map(p => `
        <tr>
            <td><strong>${p.name}</strong></td>
            <td>${p.category_name || 'Uncategorized'}</td>
            <td>$${parseFloat(p.price).toFixed(2)}</td>
            <td style="color: ${p.stock_quantity < 5 ? '#dc2626' : 'inherit'}">${p.stock_quantity} ${p.stock_quantity < 5 ? '⚠️' : ''}</td>
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

// --- SELLER ORDERS ---
async function loadSellerOrders() {
    const token = localStorage.getItem('token');
    const statusFilter = document.getElementById('orderStatusFilter').value;
    
    try {
        const res = await fetch(`${API_URL}/seller/orders?status=${statusFilter}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (!res.ok) throw new Error('Failed to load orders');
        const orders = await res.json();
        
        // Load stats (always fetch all for stats)
        const allOrdersRes = await fetch(`${API_URL}/seller/orders`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const allOrders = await allOrdersRes.json();
        renderOrdersStats(allOrders);
        
        renderOrdersTable(orders);
    } catch (error) {
        console.error('Error loading orders:', error);
    }
}

function renderOrdersStats(orders) {
    const stats = {
        pending: orders.filter(o => o.status === 'pending').length,
        processing: orders.filter(o => o.status === 'processing').length,
        shipped: orders.filter(o => o.status === 'shipped').length,
        delivered: orders.filter(o => o.status === 'delivered').length
    };
    
    document.getElementById('ordersStatsGrid').innerHTML = `
        <div class="order-stat-card pending">
            <h4>Pending</h4>
            <p>${stats.pending}</p>
        </div>
        <div class="order-stat-card processing">
            <h4>Processing</h4>
            <p>${stats.processing}</p>
        </div>
        <div class="order-stat-card shipped">
            <h4>Shipped</h4>
            <p>${stats.shipped}</p>
        </div>
        <div class="order-stat-card delivered">
            <h4>Delivered</h4>
            <p>${stats.delivered}</p>
        </div>
    `;
}

function renderOrdersTable(orders) {
    const tbody = document.getElementById('ordersTableBody');
    const emptyState = document.getElementById('emptyOrdersState');
    
    if (!tbody) return;
    
    if (orders.length === 0) {
        tbody.innerHTML = '';
        emptyState.style.display = 'block';
        document.querySelector('#sellerOrdersSection .table-container').style.display = 'none';
        return;
    }
    
    emptyState.style.display = 'none';
    document.querySelector('#sellerOrdersSection .table-container').style.display = 'block';
    
    tbody.innerHTML = orders.map(order => `
        <tr>
            <td><strong>#${order.id}</strong></td>
            <td>
                <div>${order.buyer_name}</div>
                <div style="font-size: 0.8rem; color: var(--text-muted);">${order.buyer_email}</div>
            </td>
            <td>${order.items_count} item${order.items_count > 1 ? 's' : ''}</td>
            <td><strong>$${parseFloat(order.total_amount).toFixed(2)}</strong></td>
            <td>
                <span class="status-badge status-${order.status}">
                    ${order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                </span>
            </td>
            <td>${new Date(order.created_at).toLocaleDateString()}</td>
            <td>
                <button class="btn btn-outline btn-sm" onclick="viewOrderDetails(${order.id})">
                    <i class="fas fa-eye"></i> View
                </button>
            </td>
        </tr>
    `).join('');
}

async function viewOrderDetails(orderId) {
    const token = localStorage.getItem('token');
    const modal = document.getElementById('orderDetailModal');
    const content = document.getElementById('orderDetailContent');
    
    content.innerHTML = '<div style="text-align: center; padding: 40px;"><i class="fas fa-spinner fa-spin"></i> Loading...</div>';
    modal.classList.add('active');
    
    try {
        const res = await fetch(`${API_URL}/seller/orders/${orderId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (!res.ok) throw new Error('Failed to load order');
        const data = await res.json();
        
        const order = data.order;
        const items = data.items;
        
        document.getElementById('orderModalTitle').textContent = `Order #${order.id}`;
        
        content.innerHTML = `
            <div class="order-info-grid">
                <div class="order-info-block">
                    <h5>Customer</h5>
                    <p>${order.buyer_name}</p>
                    <p style="font-size: 0.85rem; color: var(--text-muted);">${order.buyer_email}</p>
                    ${order.buyer_phone ? `<p style="font-size: 0.85rem; color: var(--text-muted);">${order.buyer_phone}</p>` : ''}
                </div>
                <div class="order-info-block">
                    <h5>Status</h5>
                    <span class="status-badge status-${order.status}" style="font-size: 0.9rem; padding: 6px 12px;">
                        ${order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                    </span>
                </div>
                <div class="order-info-block">
                    <h5>Order Date</h5>
                    <p>${new Date(order.created_at).toLocaleString()}</p>
                </div>
                <div class="order-info-block">
                    <h5>Total Amount</h5>
                    <p style="color: var(--primary); font-size: 1.2rem; font-weight: 700;">$${parseFloat(order.total_amount).toFixed(2)}</p>
                </div>
                <div class="order-info-block" style="grid-column: 1 / -1;">
                    <h5>Shipping Address</h5>
                    <p>${order.shipping_address}</p>
                </div>
            </div>
            
            <div class="order-items-list">
                <h4>Items (${items.length})</h4>
                ${items.map(item => `
                    <div class="order-item-row">
                        ${item.image_url 
                            ? `<img src="${item.image_url}" alt="${item.name}">`
                            : `<div class="no-img"><i class="fas fa-box"></i></div>`
                        }
                        <div class="order-item-info">
                            <h5>${item.name}</h5>
                            <p>Qty: ${item.quantity} × $${parseFloat(item.price_at_purchase).toFixed(2)}</p>
                        </div>
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
    const newStatus = document.getElementById('newOrderStatus').value;
    
    try {
        const res = await fetch(`${API_URL}/seller/orders/${orderId}/status`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ status: newStatus })
        });
        
        if (res.ok) {
            alert('Order status updated successfully!');
            closeOrderModal();
            loadSellerOrders(); // Refresh the table
        } else {
            const err = await res.json();
            alert(err.detail || 'Failed to update status');
        }
    } catch (error) {
        alert('Network error');
    }
}

function closeOrderModal() {
    document.getElementById('orderDetailModal').classList.remove('active');
}

// --- NOTIFICATIONS ---
async function loadNotifications() {
    const token = localStorage.getItem('token');
    if (!token) return;
    
    try {
        const res = await fetch(`${API_URL}/notifications`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        // If unauthorized, don't throw - just return silently
        if (res.status === 401) {
            console.warn('Notifications: Unauthorized (token may be expired)');
            return;
        }
        
        if (!res.ok) {
            console.warn('Notifications: Failed to load');
            return;
        }
        
        const notifs = await res.json();
        
        const unreadCount = notifs.filter(n => !n.is_read).length;
        const badge = document.getElementById('notifBadge');
        
        if (badge) {
            if (unreadCount > 0) {
                badge.textContent = unreadCount;
                badge.style.display = 'flex';
            } else {
                badge.style.display = 'none';
            }
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
    } catch (error) {
        // Silent fail - notifications are not critical
        console.warn('Notification loading error:', error);
    }
}

// Bell icon click handler
const notifBtn = document.getElementById('notifBtn');
if (notifBtn) {
    notifBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const dropdown = document.getElementById('notifDropdown');
        if (dropdown) {
            dropdown.classList.toggle('active');
            
            // Load notifications when opening
            if (dropdown.classList.contains('active')) {
                await loadNotifications();
            }
        }
    });
}

// Close dropdown when clicking outside
document.addEventListener('click', (e) => {
    const dropdown = document.getElementById('notifDropdown');
    const bell = document.getElementById('notifBtn');
    
    if (dropdown && bell && !dropdown.contains(e.target) && !bell.contains(e.target)) {
        dropdown.classList.remove('active');
    }
});

// Mark single notification as read
async function markAsRead(notifId) {
    const token = localStorage.getItem('token');
    if (!token) return;
    
    try {
        await fetch(`${API_URL}/notifications/${notifId}/read`, {
            method: 'PUT',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        await loadNotifications();
    } catch (error) {
        console.warn('Failed to mark notification as read:', error);
    }
}

// Mark all notifications as read
const markAllReadBtn = document.getElementById('markAllRead');
if (markAllReadBtn) {
    markAllReadBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const token = localStorage.getItem('token');
        if (!token) return;
        
        try {
            const res = await fetch(`${API_URL}/notifications`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            
            if (!res.ok) return;
            
            const notifs = await res.json();
            
            // Mark all unread as read
            for (const n of notifs) {
                if (!n.is_read) {
                    await fetch(`${API_URL}/notifications/${n.id}/read`, {
                        method: 'PUT',
                        headers: { 'Authorization': `Bearer ${token}` }
                    });
                }
            }
            
            await loadNotifications();
        } catch (error) {
            console.warn('Failed to mark all as read:', error);
        }
    });
}

function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('userType');
    window.location.href = '/login';
}
