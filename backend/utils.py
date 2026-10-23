import os
import secrets
import httpx
from datetime import datetime, timedelta, timezone
from jose import jwt, JWTError
from passlib.context import CryptContext
from dotenv import load_dotenv

load_dotenv()

pwd_context = CryptContext(schemes=["argon2","bcrypt"], deprecated="auto")
SECRET_KEY = os.getenv("SECRET_KEY")
ALGORITHM = os.getenv("ALGORITHM", "HS256")

# Resend Config
RESEND_API_KEY = os.getenv("RESEND_API_KEY")
RESEND_FROM_EMAIL = os.getenv("RESEND_FROM_EMAIL", "noreply@yourdomain.com")
RESEND_FROM_NAME = os.getenv("RESEND_FROM_NAME", "ShopHub")
RESEND_API_URL = "https://api.resend.com/emails"

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)

def create_access_token(data: dict, expires_delta: timedelta = None):
    to_encode = data.copy()
    # Use timezone-aware UTC datetime
    expire = datetime.now(timezone.utc) + (expires_delta or timedelta(minutes=int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", 60))))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

def generate_verification_code() -> str:
    return str(secrets.randbelow(900000) + 100000)  # 6-digit code

async def send_resend_email(to_email: str, subject: str, html_content: str):
    """High-speed, async HTTP email sender using Resend API"""
    headers = {
        "Authorization": f"Bearer {RESEND_API_KEY}",
        "Content-Type": "application/json"
    }
    
    payload = {
        "from": f"{RESEND_FROM_NAME} <{RESEND_FROM_EMAIL}>",
        "to": [to_email],
        "subject": subject,
        "html": html_content
    }
    
    async with httpx.AsyncClient() as client:
        try:
            response = await client.post(RESEND_API_URL, headers=headers, json=payload, timeout=10.0)
            response.raise_for_status()
            return True
        except httpx.HTTPStatusError as e:
            print(f"Resend API Error: {e.response.text}")
            return False
        except Exception as e:
            print(f"Resend Connection Error: {str(e)}")
            return False

async def send_verification_email(email: str, code: str):
    html_content = f"""
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #4f46e5;">Verify Your ShopHub Account</h2>
        <p>Hello,</p>
        <p>Thank you for registering with ShopHub. To complete your registration, please use the verification code below:</p>
        <div style="background-color: #f3f4f6; padding: 20px; text-align: center; border-radius: 8px; margin: 20px 0;">
            <h1 style="margin: 0; letter-spacing: 5px; color: #1e293b;">{code}</h1>
        </div>
        <p>This code will expire in <strong>15 minutes</strong>. Do not share this code with anyone.</p>
        <p>If you did not create an account, please ignore this email.</p>
        <br>
        <p>Best regards,<br>The ShopHub Team</p>
    </div>
    """
    await send_resend_email(email, "Verify Your ShopHub Account", html_content)

async def send_security_alert_email(email: str, location: str, ip: str):
    html_content = f"""
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #dc2626;">🚨 New Device Login Detected</h2>
        <p>Hello,</p>
        <p>We detected a login to your ShopHub account from a new location. If this was you, you can safely ignore this email.</p>
        <div style="background-color: #fef2f2; border-left: 4px solid #dc2626; padding: 15px; margin: 20px 0;">
            <p style="margin: 5px 0;"><strong>📍 Location:</strong> {location or 'Unknown'}</p>
            <p style="margin: 5px 0;"><strong>🌐 IP Address:</strong> {ip or 'Unknown'}</p>
            <p style="margin: 5px 0;"><strong>🕒 Time:</strong> {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M:%S UTC')}</p>
        </div>
        <p>If this was <strong>NOT</strong> you, please change your password immediately and contact support.</p>
        <br>
        <p>Best regards,<br>ShopHub Security Team</p>
    </div>
    """
    await send_resend_email(email, "🚨 New Device Login Detected - ShopHub", html_content)


async def send_password_reset_email(email: str, code: str):
    html_content = f"""
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #dc2626;">Reset Your ShopHub Password</h2>
        <p>Hello,</p>
        <p>We received a request to reset your password. Use the code below to proceed:</p>
        <div style="background-color: #fef2f2; padding: 20px; text-align: center; border-radius: 8px; margin: 20px 0; border: 1px solid #fecaca;">
            <h1 style="margin: 0; letter-spacing: 5px; color: #dc2626;">{code}</h1>
        </div>
        <p>This code will expire in <strong>15 minutes</strong>.</p>
        <p>If you did not request a password reset, please ignore this email. Your account remains secure.</p>
        <br>
        <p>Best regards,<br>ShopHub Security Team</p>
    </div>
    """
    await send_resend_email(email, "Reset Your ShopHub Password", html_content)
