// --- MOCK PRODUCTS DATA ---
const mockProducts = [
    { id: 1, name: "Wireless Noise-Cancelling Headphones", category: "Electronics", price: 249.99, icon: "fa-headphones" },
    { id: 2, name: "Smart Fitness Watch Pro", category: "Wearables", price: 199.50, icon: "fa-stopwatch" },
    { id: 3, name: "Premium Leather Backpack", category: "Accessories", price: 89.00, icon: "fa-briefcase" },
    { id: 4, name: "Mechanical Gaming Keyboard", category: "Gaming", price: 129.99, icon: "fa-keyboard" },
    { id: 5, name: "4K Ultra HD Webcam", category: "Electronics", price: 149.00, icon: "fa-video" },
    { id: 6, name: "Ergonomic Office Chair", category: "Furniture", price: 349.99, icon: "fa-chair" }
];

// --- RENDER PRODUCTS ---
function renderProducts() {
    const grid = document.getElementById('productsGrid');
    if (!grid) return;

    grid.innerHTML = mockProducts.map(product => `
        <div class="product-card">
            <div class="product-image">
                <i class="fas ${product.icon}"></i>
            </div>
            <div class="product-info">
                <span class="product-category">${product.category}</span>
                <h3 class="product-name">${product.name}</h3>
                <div class="product-price">$${product.price.toFixed(2)}</div>
                <div class="product-actions">
                    <button class="btn btn-outline" onclick="handleAuthRedirect('cart')">
                        <i class="fas fa-cart-plus"></i> Add
                    </button>
                    <button class="btn btn-primary" onclick="handleAuthRedirect('buy')">
                        Buy Now
                    </button>
                </div>
            </div>
        </div>
    `).join('');
}

// --- HANDLE REDIRECT TO LOGIN ---
function handleAuthRedirect(action) {
    // Since we haven't built the login page yet, this will route to /login.
    // Once we build the backend route for /login, this will work perfectly.
    window.location.href = '/login';
}

// --- MOBILE MENU TOGGLE ---
function setupMobileMenu() {
    const btn = document.getElementById('mobileMenuBtn');
    const links = document.getElementById('navLinks');
    
    if (btn && links) {
        btn.addEventListener('click', () => {
            links.classList.toggle('active');
            const icon = btn.querySelector('i');
            if (links.classList.contains('active')) {
                icon.classList.remove('fa-bars');
                icon.classList.add('fa-times');
            } else {
                icon.classList.remove('fa-times');
                icon.classList.add('fa-bars');
            }
        });
    }
}

// --- INITIALIZE ---
document.addEventListener('DOMContentLoaded', () => {
    renderProducts();
    setupMobileMenu();
});
