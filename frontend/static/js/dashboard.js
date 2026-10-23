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

    } catch (error) {
        console.error('Dashboard init error:', error);
        localStorage.removeItem('token');
        window.location.href = '/login';
    }
});

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
    // Hide all sections
    document.getElementById('sellerStats').style.display = 'none';
    document.getElementById('sellerProductsSection').style.display = 'none';
    document.getElementById('sellerProfileSection').style.display = 'none';
    document.getElementById('buyerSection').style.display = 'none';

    // Remove active class from nav
    document.querySelectorAll('.sidebar-menu a').forEach(a => a.classList.remove('active'));

    if (currentUser.user_type === 'seller') {
        if (section === 'overview') {
            document.getElementById('sellerStats').style.display = 'grid';
            document.getElementById('sellerProductsSection').style.display = 'block';
            document.getElementById('nav-overview').classList.add('active');
            document.getElementById('pageTitle').textContent = 'Seller Dashboard';
            loadSellerData();
        } else if (section === 'products') {
            document.getElementById('sellerProductsSection').style.display = 'block';
            document.getElementById('nav-products').classList.add('active');
            document.getElementById('pageTitle').textContent = 'My Products';
            loadSellerData();
        } else if (section === 'profile') {
            document.getElementById('sellerProfileSection').style.display = 'block';
            document.getElementById('nav-profile').classList.add('active');
            document.getElementById('pageTitle').textContent = 'Store Profile';
            loadSellerProfile();
        }
    } else {
        document.getElementById('buyerSection').style.display = 'block';
        document.getElementById('pageTitle').textContent = 'Buyer Dashboard';
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

function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('userType');
    window.location.href = '/login';
}
