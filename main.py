from fastapi import FastAPI, Request, Depends, HTTPException, Header, UploadFile, File
from fastapi.responses import HTMLResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from pydantic import BaseModel, EmailStr
from typing import Optional, List
from datetime import datetime, timedelta, timezone
from pathlib import Path
from jose import jwt, JWTError
import os
from fastapi.middleware.cors import CORSMiddleware
from collections import defaultdict
import cloudinary
import cloudinary.uploader
from cloudinary.utils import cloudinary_url

from backend.database import lifespan, get_db
from backend.utils import (
    get_password_hash, verify_password, create_access_token,
    generate_verification_code, send_verification_email, send_security_alert_email
)


# Initialize FastAPI
app = FastAPI(
    title="ShopHub E-Commerce API",
    description="A modern full-stack e-commerce platform",
    version="1.0.0",
    lifespan=lifespan
)

# CORS Middleware (Useful when we add frontend frameworks later)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Define base directory (points to the root 'ecommerce_portfolio' folder)
BASE_DIR = Path(__file__).resolve().parent

# Mount static files (CSS, JS, Images)
app.mount("/static", StaticFiles(directory=BASE_DIR / "frontend" / "static"), name="static")

# Configure Jinja2 templates
templates = Jinja2Templates(directory=BASE_DIR / "frontend" / "templates")


SECRET_KEY = os.getenv("SECRET_KEY", "fallback-secret")
ALGORITHM = os.getenv("ALGORITHM", "HS256")


cloudinary.config(
    cloud_name=os.getenv("CLOUDINARY_CLOUD_NAME"),
    api_key=os.getenv("CLOUDINARY_API_KEY"),
    api_secret=os.getenv("CLOUDINARY_API_SECRET")
)

# --- Pydantic Models ---
class RegisterRequest(BaseModel):
    full_name: str
    email: EmailStr
    password: str
    user_type: str
    ip_address: Optional[str] = None
    location: Optional[str] = None

class LoginRequest(BaseModel):
    email: EmailStr
    password: str
    ip_address: Optional[str] = None
    location: Optional[str] = None

class VerifyRequest(BaseModel):
    email: EmailStr
    code: str

class ResendCodeRequest(BaseModel):
    email: EmailStr

class ForgotPasswordRequest(BaseModel):
    email: EmailStr

class ResetPasswordRequest(BaseModel):
    email: EmailStr
    code: str
    new_password: str
    
class ProductCreate(BaseModel):
    name: str
    description: str
    price: float
    stock_quantity: int
    category_id: int
    image_url: Optional[str] = None

class ProductUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    price: Optional[float] = None
    stock_quantity: Optional[int] = None
    is_active: Optional[bool] = None

class CartItemAdd(BaseModel):
    product_id: int
    quantity: int = 1

class CartItemUpdate(BaseModel):
    quantity: int

class CheckoutRequest(BaseModel):
    full_name: str
    shipping_address: str
    city: str
    zip_code: str
    phone: str

class SellerProfileUpdate(BaseModel):
    business_name: Optional[str] = None
    business_description: Optional[str] = None
    website: Optional[str] = None
    logo_url: Optional[str] = None


class OrderStatusUpdate(BaseModel):
    status: str


class BuyerProfileUpdate(BaseModel):
    phone: Optional[str] = None
    default_shipping_address: Optional[str] = None
    default_billing_address: Optional[str] = None

class ReviewCreate(BaseModel):
    product_id: int
    order_id: int
    rating: int
    review_text: Optional[str] = ""

# --- Auth Dependencies ---
async def get_current_user(authorization: Optional[str] = Header(None), db=Depends(get_db)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Invalid or missing token")
    
    token = authorization.split(" ")[1]
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None:
            raise HTTPException(status_code=401, detail="Invalid token")
        
        user = await db.fetchrow("SELECT id, email, full_name, user_type, is_verified FROM users WHERE id = $1", int(user_id))
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        return dict(user)
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")

async def require_seller(current_user: dict = Depends(get_current_user)):
    if current_user["user_type"] != "seller":
        raise HTTPException(status_code=403, detail="Access denied: Sellers only")
    return current_user

async def require_buyer(current_user: dict = Depends(get_current_user)):
    if current_user["user_type"] != "buyer":
        raise HTTPException(status_code=403, detail="Access denied: Buyers only")
    return current_user
    
# --- Page Routes ---
@app.get("/", response_class=HTMLResponse)
async def serve_landing(request: Request): return templates.TemplateResponse("index.html", {"request": request})

@app.get("/login", response_class=HTMLResponse)
async def serve_login(request: Request): return templates.TemplateResponse("login.html", {"request": request})

@app.get("/register", response_class=HTMLResponse)
async def serve_register(request: Request): return templates.TemplateResponse("register.html", {"request": request})

@app.get("/verify", response_class=HTMLResponse)
async def serve_verify(request: Request, email: str = ""): return templates.TemplateResponse("verify.html", {"request": request, "email": email})

@app.get("/dashboard", response_class=HTMLResponse)
async def serve_dashboard(request: Request): return templates.TemplateResponse("dashboard.html", {"request": request})

@app.get("/forgot-password", response_class=HTMLResponse)
async def serve_forgot_password(request: Request):
    return templates.TemplateResponse("forgot-password.html", {"request": request})

@app.get("/reset-password", response_class=HTMLResponse)
async def serve_reset_password(request: Request, email: str = ""):
    return templates.TemplateResponse("reset-password.html", {"request": request, "email": email})

@app.get("/cart", response_class=HTMLResponse)
async def serve_cart(request: Request):
    return templates.TemplateResponse("cart.html", {"request": request})


@app.get("/checkout", response_class=HTMLResponse)
async def serve_cart(request: Request):
    return templates.TemplateResponse("checkout.html", {"request": request})
    
@app.post("/api/register")
async def register_user(data: RegisterRequest, db=Depends(get_db)):
    existing = await db.fetchrow("SELECT id FROM users WHERE email = $1", data.email)
    if existing: raise HTTPException(status_code=400, detail="Email already registered")

    verify_code = generate_verification_code()
    # ✅ FIXED: Use timezone-aware UTC datetime
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=15)

    user_id = await db.fetchval(
        """INSERT INTO users (email, password_hash, full_name, user_type, verification_code, verification_code_expires, is_verified, last_login_ip, last_login_location)
           VALUES ($1, $2, $3, $4, $5, $6, FALSE, $7, $8) RETURNING id""",
        data.email, get_password_hash(data.password), data.full_name, data.user_type,
        verify_code, expires_at, data.ip_address, data.location
    )

    profile_table = "seller_profiles" if data.user_type == "seller" else "buyer_profiles"
    await db.execute(f"INSERT INTO {profile_table} (user_id) VALUES ($1)", user_id)
    await send_verification_email(data.email, verify_code)
    return {"message": "Registration successful. Please check your email."}
    
@app.post("/api/verify-email")
async def verify_email(data: VerifyRequest, db=Depends(get_db)):
    user = await db.fetchrow(
        "SELECT id, verification_code, verification_code_expires FROM users WHERE email = $1", 
        data.email
    )
    if not user: 
        raise HTTPException(status_code=404, detail="User not found")
    
    if user["verification_code"] != data.code: 
        raise HTTPException(status_code=400, detail="Invalid code")
    
    # ✅ FIXED: Compare timezone-aware current time with PostgreSQL timestamp
    if datetime.now(timezone.utc) > user["verification_code_expires"]:
        raise HTTPException(status_code=400, detail="Code expired")

    # Mark as verified
    await db.execute(
        "UPDATE users SET is_verified = TRUE, verification_code = NULL WHERE id = $1", 
        user["id"]
    )
    return {"message": "Email verified successfully. You can Login Now"}

@app.post("/api/login")
async def login_user(data: LoginRequest, db=Depends(get_db)):
    user = await db.fetchrow("SELECT * FROM users WHERE email = $1", data.email)
    
    if not user or not verify_password(data.password, user["password_hash"]):
        # Log failed attempt
        await db.execute(
            "INSERT INTO security_logs (user_id, event_type, severity, description, ip_address) VALUES ((SELECT id FROM users WHERE email=$1), 'login_failed', 'warning', 'Invalid credentials', $2)",
            data.email, data.ip_address
        )
        raise HTTPException(status_code=401, detail="Invalid email or password")

    if not user["is_verified"]:
        raise HTTPException(status_code=403, detail="Please verify your email before logging in.")

    # Security Check: New Device / Location
    is_new_location = (user["last_login_ip"] != data.ip_address) or (user["last_login_location"] != data.location)
    
    if is_new_location and user["last_login_ip"] is not None:
        # Send security alert email (fire and forget)
        await send_security_alert_email(user["email"], data.location, data.ip_address)
        
        # Log security event
        await db.execute(
            "INSERT INTO security_logs (user_id, event_type, severity, description, ip_address) VALUES ($1, 'new_location_login', 'warning', $2, $3)",
            user["id"], f"Login from new location: {data.location}", data.ip_address
        )

    # Update last login info
    await db.execute(
        "UPDATE users SET last_login_ip = $1, last_login_location = $2 WHERE id = $3",
        data.ip_address, data.location, user["id"]
    )

    # Log successful login
    await db.execute(
        "INSERT INTO activity_logs (user_id, action, details, ip_address) VALUES ($1, 'login', 'Successful login', $2)",
        user["id"], data.ip_address
    )

    # Generate Token
    token = create_access_token({"sub": str(user["id"]), "type": user["user_type"]})
    
    return {"access_token": token, "token_type": "bearer", "user_type": user["user_type"]}

@app.post("/api/resend-code")
async def resend_verification_code(data: ResendCodeRequest, db=Depends(get_db)):
    # 1. Check if user exists
    user = await db.fetchrow(
        "SELECT id, email, is_verified, verification_code_expires FROM users WHERE email = $1",
        data.email
    )
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    if user["is_verified"]:
        raise HTTPException(status_code=400, detail="Email is already verified")
    
    # 2. Rate limiting: Don't allow resend if last code was sent less than 60 seconds ago
    if user["verification_code_expires"]:
        time_since_last = datetime.now(timezone.utc) - user["verification_code_expires"].replace(tzinfo=timezone.utc)
        # Code expires in 15 mins, so if it expires in more than 14 mins, it was just sent
        if time_since_last.total_seconds() < -840:  # 14 minutes = 840 seconds
            raise HTTPException(status_code=429, detail="Please wait 60 seconds before requesting a new code")
    
    # 3. Generate new code
    new_code = generate_verification_code()
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=15)
    
    # 4. Update database
    await db.execute(
        "UPDATE users SET verification_code = $1, verification_code_expires = $2 WHERE id = $3",
        new_code, expires_at, user["id"]
    )
    
    # 5. Send email
    await send_verification_email(data.email, new_code)
    
    return {"message": "New verification code sent. Please check your email."}


@app.post("/api/forgot-password")
async def forgot_password(data: ForgotPasswordRequest, db=Depends(get_db)):
    # 1. Check if user exists and is verified
    user = await db.fetchrow(
        "SELECT id, email, is_verified FROM users WHERE email = $1", 
        data.email
    )
    
    # Security: Don't reveal if email exists or not. Always return success message.
    if not user or not user["is_verified"]:
        return {"message": "If an account with this email exists and is verified, a reset code has been sent."}
    
    # 2. Generate new reset code
    reset_code = generate_verification_code()
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=15)
    
    # 3. Update database
    await db.execute(
        "UPDATE users SET reset_code = $1, reset_code_expires = $2 WHERE id = $3",
        reset_code, expires_at, user["id"]
    )
    
    # 4. Send email
    await send_password_reset_email(data.email, reset_code)
    
    # 5. Log security event
    await db.execute(
        "INSERT INTO security_logs (user_id, event_type, severity, description) VALUES ($1, 'password_reset_requested', 'info', 'Password reset code generated')",
        user["id"]
    )
    
    return {"message": "If an account with this email exists, a reset code has been sent."}

@app.post("/api/reset-password")
async def reset_password(data: ResetPasswordRequest, db=Depends(get_db)):
    # 1. Fetch user with reset data
    user = await db.fetchrow(
        "SELECT id, reset_code, reset_code_expires FROM users WHERE email = $1",
        data.email
    )
    
    if not user or not user["reset_code"]:
        raise HTTPException(status_code=400, detail="Invalid or expired reset request")
    
    # 2. Verify code
    if user["reset_code"] != data.code:
        raise HTTPException(status_code=400, detail="Invalid reset code")
    
    # 3. Check expiration (timezone-aware)
    if datetime.now(timezone.utc) > user["reset_code_expires"]:
        raise HTTPException(status_code=400, detail="Reset code has expired")
    
    # 4. Update password and clear reset code
    new_hash = get_password_hash(data.new_password)
    await db.execute(
        """UPDATE users 
           SET password_hash = $1, reset_code = NULL, reset_code_expires = NULL 
           WHERE id = $2""",
        new_hash, user["id"]
    )
    
    # 5. Log security event
    await db.execute(
        "INSERT INTO security_logs (user_id, event_type, severity, description) VALUES ($1, 'password_reset_success', 'warning', 'Password was successfully reset')",
        user["id"]
    )
    
    return {"message": "Password reset successfully. You can now log in."}
    
@app.get("/api/me")
async def get_me(current_user: dict = Depends(get_current_user)):
    return current_user

# --- Dashboard & Product Management Routes (Seller) ---
@app.get("/api/dashboard/stats")
async def get_dashboard_stats(current_user: dict = Depends(require_seller), db=Depends(get_db)):
    stats = await db.fetchrow(
        """SELECT 
            COUNT(*) FILTER (WHERE is_active = TRUE) as active_products,
            COUNT(*) FILTER (WHERE stock_quantity < 5 AND is_active = TRUE) as low_stock,
            COALESCE(SUM(price * stock_quantity), 0) as inventory_value
           FROM products WHERE seller_id = $1""",
        current_user["id"]
    )
    return dict(stats)

@app.get("/api/seller/products")
async def get_seller_products(current_user: dict = Depends(require_seller), db=Depends(get_db)):
    products = await db.fetch(
        """SELECT p.id, p.name, p.price, p.stock_quantity, p.is_active, c.name as category_name 
           FROM products p 
           LEFT JOIN categories c ON p.category_id = c.id 
           WHERE p.seller_id = $1 
           ORDER BY p.created_at DESC""",
        current_user["id"]
    )
    return [dict(p) for p in products]

@app.post("/api/seller/products")
async def create_product(data: ProductCreate, current_user: dict = Depends(require_seller), db=Depends(get_db)):
    product_id = await db.fetchval(
        """INSERT INTO products (seller_id, category_id, name, description, price, stock_quantity, image_url, is_active)
           VALUES ($1, $2, $3, $4, $5, $6, $7, TRUE) RETURNING id""",
        current_user["id"], data.category_id, data.name, data.description, data.price, data.stock_quantity, data.image_url
    )
    
    # Trigger Notification
    await db.execute(
        """INSERT INTO notifications (user_id, title, message, type) 
           VALUES ($1, $2, $3, $4)""",
        current_user["id"], "Product Created", f"Your product '{data.name}' has been successfully listed.", "success"
    )
    
    # Log Activity
    await db.execute(
        "INSERT INTO activity_logs (user_id, action, details) VALUES ($1, $2, $3)",
        current_user["id"], "create_product", f"Created product: {data.name}"
    )
    
    return {"id": product_id, "message": "Product created successfully"}

@app.put("/api/seller/products/{product_id}")
async def update_product(product_id: int, data: ProductUpdate, current_user: dict = Depends(require_seller), db=Depends(get_db)):
    # Ensure seller owns this product
    product = await db.fetchrow("SELECT id, name FROM products WHERE id = $1 AND seller_id = $2", product_id, current_user["id"])
    if not product:
        raise HTTPException(status_code=404, detail="Product not found or access denied")

    # Build dynamic update query
    update_fields = []
    values = []
    idx = 1
    for field, value in data.dict(exclude_unset=True).items():
        update_fields.append(f"{field} = ${idx}")
        values.append(value)
        idx += 1
    
    if not update_fields:
        raise HTTPException(status_code=400, detail="No fields to update")

    values.append(product_id)
    query = f"UPDATE products SET {', '.join(update_fields)} WHERE id = ${idx} RETURNING id"
    await db.execute(query, *values)

    await db.execute(
        """INSERT INTO notifications (user_id, title, message, type) 
           VALUES ($1, $2, $3, $4)""",
        current_user["id"], "Product Updated", f"Product '{product['name']}' was updated.", "info"
    )
    
    return {"message": "Product updated successfully"}

@app.delete("/api/seller/products/{product_id}")
async def delete_product(product_id: int, current_user: dict = Depends(require_seller), db=Depends(get_db)):
    # Soft delete
    result = await db.execute(
        "UPDATE products SET is_active = FALSE WHERE id = $1 AND seller_id = $2",
        product_id, current_user["id"]
    )
    if result == "UPDATE 0":
        raise HTTPException(status_code=404, detail="Product not found or access denied")
    
    await db.execute(
        """INSERT INTO notifications (user_id, title, message, type) 
           VALUES ($1, $2, $3, $4)""",
        current_user["id"], "Product Archived", "The product has been removed from the storefront.", "warning"
    )
    
    return {"message": "Product archived successfully"}

# --- Notification Routes ---
@app.get("/api/notifications")
async def get_notifications(current_user: dict = Depends(get_current_user), db=Depends(get_db)):
    notifications = await db.fetch(
        "SELECT id, title, message, type, is_read, created_at FROM notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 20",
        current_user["id"]
    )
    return [dict(n) for n in notifications]

@app.put("/api/notifications/{notification_id}/read")
async def mark_notification_read(notification_id: int, current_user: dict = Depends(get_current_user), db=Depends(get_db)):
    await db.execute(
        "UPDATE notifications SET is_read = TRUE WHERE id = $1 AND user_id = $2",
        notification_id, current_user["id"]
    )
    return {"message": "Notification marked as read"}

@app.get("/api/categories")
async def get_categories(db=Depends(get_db)):
    # Seed categories if empty
    count = await db.fetchval("SELECT COUNT(*) FROM categories")
    if count == 0:
        await db.execute("INSERT INTO categories (name, description) VALUES ('Electronics', 'Gadgets and devices'), ('Fashion', 'Clothing and accessories'), ('Home', 'Furniture and decor')")
    
    categories = await db.fetch("SELECT id, name FROM categories")
    return [dict(c) for c in categories]



# --- CART ROUTES ---
@app.get("/api/cart")
async def get_cart(current_user: dict = Depends(require_buyer), db=Depends(get_db)):
    items = await db.fetch(
        """SELECT ci.id, ci.product_id, ci.quantity, p.name, p.price, p.image_url, p.stock_quantity, p.seller_id 
           FROM cart_items ci 
           JOIN products p ON ci.product_id = p.id 
           WHERE ci.buyer_id = $1 AND p.is_active = TRUE""",
        current_user["id"]
    )
    return [dict(item) for item in items]

@app.post("/api/cart")
async def add_to_cart(data: CartItemAdd, current_user: dict = Depends(require_buyer), db=Depends(get_db)):
    # Verify product exists and is active
    product = await db.fetchrow("SELECT id, stock_quantity, is_active FROM products WHERE id = $1", data.product_id)
    if not product or not product["is_active"]:
        raise HTTPException(status_code=404, detail="Product not found or unavailable")
    if product["stock_quantity"] < data.quantity:
        raise HTTPException(status_code=400, detail="Insufficient stock")

    # Upsert cart item
    existing = await db.fetchrow(
        "SELECT id, quantity FROM cart_items WHERE buyer_id = $1 AND product_id = $2",
        current_user["id"], data.product_id
    )
    
    if existing:
        new_qty = existing["quantity"] + data.quantity
        if product["stock_quantity"] < new_qty:
            raise HTTPException(status_code=400, detail="Insufficient stock for requested quantity")
        await db.execute(
            "UPDATE cart_items SET quantity = $1 WHERE id = $2",
            new_qty, existing["id"]
        )
    else:
        await db.execute(
            "INSERT INTO cart_items (buyer_id, product_id, quantity) VALUES ($1, $2, $3)",
            current_user["id"], data.product_id, data.quantity
        )
    
    return {"message": "Item added to cart"}

@app.put("/api/cart/{item_id}")
async def update_cart_item(item_id: int, data: CartItemUpdate, current_user: dict = Depends(require_buyer), db=Depends(get_db)):
    if data.quantity <= 0:
        await db.execute("DELETE FROM cart_items WHERE id = $1 AND buyer_id = $2", item_id, current_user["id"])
        return {"message": "Item removed"}
    
    # Check stock before updating
    cart_item = await db.fetchrow("SELECT product_id FROM cart_items WHERE id = $1 AND buyer_id = $2", item_id, current_user["id"])
    if not cart_item:
        raise HTTPException(status_code=404, detail="Cart item not found")
        
    product = await db.fetchrow("SELECT stock_quantity FROM products WHERE id = $1", cart_item["product_id"])
    if product["stock_quantity"] < data.quantity:
        raise HTTPException(status_code=400, detail="Insufficient stock")

    await db.execute(
        "UPDATE cart_items SET quantity = $1 WHERE id = $2 AND buyer_id = $3",
        data.quantity, item_id, current_user["id"]
    )
    return {"message": "Cart updated"}

@app.delete("/api/cart/{item_id}")
async def remove_from_cart(item_id: int, current_user: dict = Depends(require_buyer), db=Depends(get_db)):
    await db.execute("DELETE FROM cart_items WHERE id = $1 AND buyer_id = $2", item_id, current_user["id"])
    return {"message": "Item removed from cart"}

# --- CHECKOUT ROUTE ---
@app.post("/api/checkout")
async def process_checkout(data: CheckoutRequest, current_user: dict = Depends(require_buyer), db=Depends(get_db)):
    # 1. Fetch cart items
    cart = await db.fetch(
        """SELECT ci.product_id, ci.quantity, p.price, p.seller_id, p.stock_quantity, p.name 
           FROM cart_items ci 
           JOIN products p ON ci.product_id = p.id 
           WHERE ci.buyer_id = $1 AND p.is_active = TRUE""",
        current_user["id"]
    )
    if not cart:
        raise HTTPException(status_code=400, detail="Your cart is empty")

    # 2. Validate stock for all items
    for item in cart:
        if item["stock_quantity"] < item["quantity"]:
            raise HTTPException(status_code=400, detail=f"Insufficient stock for '{item['name']}'")

    # 3. Group items by seller (to create separate orders per seller)
    seller_items = defaultdict(list)
    for item in cart:
        seller_items[item["seller_id"]].append(item)

    created_orders = []

    # 4. Execute Atomic Transaction (Prevents race conditions)
    async with db.transaction():
        for seller_id, items in seller_items.items():
            total_amount = sum(item["price"] * item["quantity"] for item in items)
            full_address = f"{data.shipping_address}, {data.city}, {data.zip_code}"
            
            # Create Order
            order_id = await db.fetchval(
                """INSERT INTO orders (buyer_id, seller_id, total_amount, status, shipping_address) 
                   VALUES ($1, $2, $3, 'pending', $4) RETURNING id""",
                current_user["id"], seller_id, total_amount, full_address
            )
            created_orders.append(order_id)

            # Create Order Items & Deduct Stock
            for item in items:
                await db.execute(
                    """INSERT INTO order_items (order_id, product_id, quantity, price_at_purchase) 
                       VALUES ($1, $2, $3, $4)""",
                    order_id, item["product_id"], item["quantity"], item["price"]
                )
                await db.execute(
                    "UPDATE products SET stock_quantity = stock_quantity - $1 WHERE id = $2",
                    item["quantity"], item["product_id"]
                )
        
        # Clear Cart
        await db.execute("DELETE FROM cart_items WHERE buyer_id = $1", current_user["id"])

    # 5. Create Notifications (Outside transaction for performance)
    await db.execute(
        """INSERT INTO notifications (user_id, title, message, type) 
           VALUES ($1, $2, $3, $4)""",
        current_user["id"], "Order Placed! 🎉", f"Your order(s) #{', #'.join(map(str, created_orders))} have been confirmed.", "success"
    )
    
    # Notify sellers
    for seller_id, items in seller_items.items():
        await db.execute(
            """INSERT INTO notifications (user_id, title, message, type) 
               VALUES ($1, $2, $3, $4)""",
            seller_id, "New Order Received! 📦", f"You have a new pending order. Check your dashboard.", "info"
        )

    return {"order_ids": created_orders, "message": "Checkout successful!"}


# --- IMAGE UPLOAD ROUTE ---
@app.post("/api/upload-image")
async def upload_image(file: UploadFile = File(...)):
    # Validate file type
    if not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File must be an image")
    
    try:
        # Upload to Cloudinary
        upload_result = cloudinary.uploader.upload(
            file.file,
            folder="shophub_products",
            resource_type="image"
        )
        return {"url": upload_result["secure_url"]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Image upload failed: {str(e)}")

@app.get("/api/seller/profile")
async def get_seller_profile(current_user: dict = Depends(require_seller), db=Depends(get_db)):
    profile = await db.fetchrow(
        """SELECT sp.business_name, sp.business_description, sp.rating, sp.total_sales, sp.is_verified_seller, sp.logo_url, sp.website, u.email, u.full_name, u.phone
           FROM seller_profiles sp
           JOIN users u ON sp.user_id = u.id
           WHERE sp.user_id = $1""",
        current_user["id"]
    )
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")
    return dict(profile)

@app.put("/api/seller/profile")
async def update_seller_profile(data: SellerProfileUpdate, current_user: dict = Depends(require_seller), db=Depends(get_db)):
    # Build dynamic update query
    update_fields = []
    values = []
    idx = 1
    for field, value in data.dict(exclude_unset=True).items():
        update_fields.append(f"{field} = ${idx}")
        values.append(value)
        idx += 1
    
    if not update_fields:
        raise HTTPException(status_code=400, detail="No fields to update")

    values.append(current_user["id"])
    query = f"UPDATE seller_profiles SET {', '.join(update_fields)} WHERE user_id = ${idx}"
    await db.execute(query, *values)
    
    return {"message": "Profile updated successfully"}


# --- SELLER ORDERS ROUTES ---
@app.get("/api/seller/orders")
async def get_seller_orders(
    status: Optional[str] = None,
    current_user: dict = Depends(require_seller), 
    db=Depends(get_db)
):
    query = """
        SELECT o.id, o.total_amount, o.status, o.shipping_address, o.created_at,
               u.full_name as buyer_name, u.email as buyer_email,
               COUNT(oi.id) as items_count
        FROM orders o
        JOIN users u ON o.buyer_id = u.id
        LEFT JOIN order_items oi ON o.id = oi.order_id
        WHERE o.seller_id = $1
    """
    params = [current_user["id"]]
    
    if status and status != "all":
        query += " AND o.status = $2"
        params.append(status)
    
    query += " GROUP BY o.id, u.full_name, u.email ORDER BY o.created_at DESC"
    
    orders = await db.fetch(query, *params)
    return [dict(order) for order in orders]

@app.get("/api/seller/orders/{order_id}")
async def get_seller_order_detail(order_id: int, current_user: dict = Depends(require_seller), db=Depends(get_db)):
    # Verify seller owns this order
    order = await db.fetchrow(
        """SELECT o.id, o.total_amount, o.status, o.shipping_address, o.created_at,
                  u.full_name as buyer_name, u.email as buyer_email, u.phone as buyer_phone
           FROM orders o
           JOIN users u ON o.buyer_id = u.id
           WHERE o.id = $1 AND o.seller_id = $2""",
        order_id, current_user["id"]
    )
    
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    # Get order items
    items = await db.fetch(
        """SELECT oi.quantity, oi.price_at_purchase, p.name, p.image_url
           FROM order_items oi
           JOIN products p ON oi.product_id = p.id
           WHERE oi.order_id = $1""",
        order_id
    )
    
    return {
        "order": dict(order),
        "items": [dict(item) for item in items]
    }

@app.put("/api/seller/orders/{order_id}/status")
async def update_order_status(
    order_id: int, 
    data: OrderStatusUpdate, 
    current_user: dict = Depends(require_seller), 
    db=Depends(get_db)
):
    valid_statuses = ['pending', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded']
    if data.status not in valid_statuses:
        raise HTTPException(status_code=400, detail="Invalid status")
    
    # Verify seller owns this order
    order = await db.fetchrow(
        "SELECT id, buyer_id, status FROM orders WHERE id = $1 AND seller_id = $2",
        order_id, current_user["id"]
    )
    
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    # Update status
    await db.execute(
        "UPDATE orders SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2",
        data.status, order_id
    )
    
    # Notify buyer
    status_messages = {
        'processing': 'Your order is being prepared',
        'shipped': 'Your order has been shipped! 🚚',
        'delivered': 'Your order has been delivered ✅',
        'cancelled': 'Your order has been cancelled',
        'refunded': 'Your order has been refunded'
    }
    
    if data.status in status_messages:
        await db.execute(
            """INSERT INTO notifications (user_id, title, message, type) 
               VALUES ($1, $2, $3, $4)""",
            order["buyer_id"], 
            f"Order #{order_id} Update", 
            status_messages[data.status],
            "order_update"
        )
    
    # Log activity
    await db.execute(
        "INSERT INTO activity_logs (user_id, action, details) VALUES ($1, 'update_order_status', $2)",
        current_user["id"], f"Order #{order_id} status changed to {data.status}"
    )
    
    return {"message": f"Order status updated to {data.status}"}


# --- BUYER PROFILE ROUTES ---
@app.get("/api/buyer/profile")
async def get_buyer_profile(current_user: dict = Depends(require_buyer), db=Depends(get_db)):
    profile = await db.fetchrow(
        """SELECT bp.default_shipping_address, bp.default_billing_address, u.email, u.full_name, u.phone
           FROM buyer_profiles bp
           JOIN users u ON bp.user_id = u.id
           WHERE bp.user_id = $1""",
        current_user["id"]
    )
    return dict(profile) if profile else {}

@app.put("/api/buyer/profile")
async def update_buyer_profile(data: BuyerProfileUpdate, current_user: dict = Depends(require_buyer), db=Depends(get_db)):
    # Update user phone if provided
    if data.phone is not None:
        await db.execute("UPDATE users SET phone = $1 WHERE id = $2", data.phone, current_user["id"])
    
    # Update buyer profile addresses
    await db.execute(
        """UPDATE buyer_profiles 
           SET default_shipping_address = $1, default_billing_address = $2 
           WHERE user_id = $3""",
        data.default_shipping_address, data.default_billing_address, current_user["id"]
    )
    return {"message": "Profile updated successfully"}

# --- MARKETPLACE ROUTES (For Buyers) ---
@app.get("/api/marketplace/products")
async def get_marketplace_products(
    search: Optional[str] = None,
    category_id: Optional[int] = None,
    sort_by: str = "bestsellers",  # bestsellers, price_low, price_high, newest
    db=Depends(get_db)
):
    query = """
        SELECT p.id, p.name, p.description, p.price, p.image_url, p.category_id, c.name as category_name,
               sp.business_name as seller_name, sp.rating as seller_rating, sp.total_sales
        FROM products p
        JOIN categories c ON p.category_id = c.id
        JOIN seller_profiles sp ON p.seller_id = sp.user_id
        WHERE p.is_active = TRUE
    """
    params = []
    param_idx = 1

    if search:
        query += f" AND (p.name ILIKE ${param_idx} OR p.description ILIKE ${param_idx})"
        params.append(f"%{search}%")
        param_idx += 1

    if category_id:
        query += f" AND p.category_id = ${param_idx}"
        params.append(category_id)
        param_idx += 1

    # Sorting
    if sort_by == "bestsellers":
        query += " ORDER BY sp.total_sales DESC, p.created_at DESC"
    elif sort_by == "price_low":
        query += " ORDER BY p.price ASC"
    elif sort_by == "price_high":
        query += " ORDER BY p.price DESC"
    else: # newest
        query += " ORDER BY p.created_at DESC"

    products = await db.fetch(query, *params)
    return [dict(p) for p in products]


# --- REVIEW ROUTES ---
@app.post("/api/reviews")
async def submit_review(
    data: ReviewCreate, 
    current_user: dict = Depends(require_buyer), 
    db=Depends(get_db)
):
    # 1. Verify the buyer actually purchased this product in this order
    order_check = await db.fetchrow(
        """SELECT 1 FROM order_items oi 
           JOIN orders o ON oi.order_id = o.id 
           WHERE oi.order_id = $1 AND oi.product_id = $2 AND o.buyer_id = $3""",
        data.order_id, data.product_id, current_user["id"]
    )
    
    if not order_check:
        raise HTTPException(status_code=403, detail="You can only review products you have purchased.")

    # 2. Check if already reviewed
    existing = await db.fetchrow(
        "SELECT id FROM product_reviews WHERE product_id = $1 AND buyer_id = $2 AND order_id = $3",
        data.product_id, current_user["id"], data.order_id
    )
    if existing:
        raise HTTPException(status_code=400, detail="You have already reviewed this product for this order.")

    # 3. Insert Review (Trigger will automatically update seller rating)
    await db.execute(
        """INSERT INTO product_reviews (product_id, buyer_id, order_id, rating, review_text) 
           VALUES ($1, $2, $3, $4, $5)""",
        data.product_id, current_user["id"], data.order_id, data.rating, data.review_text
    )

    # 4. Notify Seller
    product = await db.fetchrow("SELECT name, seller_id FROM products WHERE id = $1", data.product_id)
    if product:
        await db.execute(
            """INSERT INTO notifications (user_id, title, message, type) 
               VALUES ($1, $2, $3, $4)""",
            product["seller_id"], 
            "New Product Review! ⭐", 
            f"You received a {data.rating}-star review for '{product['name']}'.", 
            "info"
        )

    return {"message": "Review submitted successfully!"}

@app.get("/api/products/{product_id}/reviews")
async def get_product_reviews(product_id: int, db=Depends(get_db)):
    reviews = await db.fetch(
        """SELECT pr.rating, pr.review_text, pr.created_at, u.full_name as buyer_name
           FROM product_reviews pr
           JOIN users u ON pr.buyer_id = u.id
           WHERE pr.product_id = $1
           ORDER BY pr.created_at DESC""",
        product_id
    )
    
    # Calculate average rating
    avg_rating = await db.fetchval(
        "SELECT COALESCE(AVG(rating), 0) FROM product_reviews WHERE product_id = $1", 
        product_id
    )
    
    return {
        "average_rating": round(float(avg_rating), 1) if avg_rating else 0.0,
        "total_reviews": len(reviews),
        "reviews": [dict(r) for r in reviews]
    }
    

if __name__ == "__main__":
    import uvicorn
    # uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)
