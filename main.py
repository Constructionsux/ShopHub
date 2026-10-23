from fastapi import FastAPI, Request, Depends, HTTPException, Form
from fastapi.responses import HTMLResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from fastapi.middleware.cors import CORSMiddleware
from pathlib import Path
import os
from pydantic import BaseModel, EmailStr
from typing import Optional
from datetime import datetime, timedelta
import httpx

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
BASE_DIR = Path(__file__).resolve().parent.parent

# Mount static files (CSS, JS, Images)
app.mount("/static", StaticFiles(directory=BASE_DIR / "frontend" / "static"), name="static")

# Configure Jinja2 templates
templates = Jinja2Templates(directory=BASE_DIR / "frontend" / "templates")


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

# --- Routes ---
@app.get("/", response_class=HTMLResponse)
async def serve_landing(request: Request):
    return templates.TemplateResponse("index.html", {"request": request})

@app.get("/login", response_class=HTMLResponse)
async def serve_login(request: Request):
    return templates.TemplateResponse("login.html", {"request": request})

@app.get("/register", response_class=HTMLResponse)
async def serve_register(request: Request):
    return templates.TemplateResponse("register.html", {"request": request})

@app.get("/verify", response_class=HTMLResponse)
async def serve_verify(request: Request, email: str = ""):
    return templates.TemplateResponse("verify.html", {"request": request, "email": email})

@app.post("/api/register")
async def register_user(data: RegisterRequest, db=Depends(get_db)):
    # 1. Check if user exists
    existing = await db.fetchrow("SELECT id FROM users WHERE email = $1", data.email)
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    # 2. Generate verification code (expires in 15 mins)
    verify_code = generate_verification_code()
    expires_at = datetime.utcnow() + timedelta(minutes=15)

    # 3. Insert user
    user_id = await db.fetchval(
        """INSERT INTO users (email, password_hash, full_name, user_type, verification_code, verification_code_expires, is_verified, last_login_ip, last_login_location)
           VALUES ($1, $2, $3, $4, $5, $6, FALSE, $7, $8) RETURNING id""",
        data.email, get_password_hash(data.password), data.full_name, data.user_type,
        verify_code, expires_at, data.ip_address, data.location
    )

    # 4. Create profile
    profile_table = "seller_profiles" if data.user_type == "seller" else "buyer_profiles"
    await db.execute(f"INSERT INTO {profile_table} (user_id) VALUES ($1)", user_id)

    # 5. Send Verification Email (Async, non-blocking)
    await send_verification_email(data.email, verify_code)

    # 6. Log activity
    await db.execute(
        "INSERT INTO activity_logs (user_id, action, details, ip_address) VALUES ($1, $2, $3, $4)",
        user_id, "register", f"New {data.user_type} registered", data.ip_address
    )

    return {"message": "Registration successful. Please check your email for the verification code."}

@app.post("/api/verify-email")
async def verify_email(data: VerifyRequest, db=Depends(get_db)):
    user = await db.fetchrow(
        "SELECT id, verification_code, verification_code_expires FROM users WHERE email = $1",
        data.email
    )
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    if user["verification_code"] != data.code:
        raise HTTPException(status_code=400, detail="Invalid verification code")
    
    if datetime.utcnow() > user["verification_code_expires"]:
        raise HTTPException(status_code=400, detail="Verification code has expired")

    # Mark as verified
    await db.execute(
        "UPDATE users SET is_verified = TRUE, verification_code = NULL WHERE id = $1",
        user["id"]
    )

    return {"message": "Email verified successfully. You can now log in."}

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

if __name__ == "__main__":
    import uvicorn
    # uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)
