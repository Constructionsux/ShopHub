import os
import secrets
import httpx
from datetime import datetime, timedelta
from jose import jwt, JWTError
from passlib.context import CryptContext
from dotenv import load_dotenv

load_dotenv()

pwd_context = CryptContext( schemes=["argon2", "bcrypt"], deprecated="bcrypt" )
SECRET_KEY = os.getenv("SECRET_KEY")
ALGORITHM = os.getenv("ALGORITHM", "HS256")

# Mailtrap Config
MAILTRAP_TOKEN = os.getenv("MAILTRAP_API_TOKEN")
MAILTRAP_FROM_EMAIL = os.getenv("MAILTRAP_FROM_EMAIL", "mailtrap@demomailtrap.com")
MAILTRAP_FROM_NAME = os.getenv("MAILTRAP_FROM_NAME", "ShopHub")
MAILTRAP_API_URL = "https://send.api.mailtrap.io/api/send"

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)

def create_access_token(data: dict, expires_delta: timedelta = None):
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", 60))))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

def generate_verification_code() -> str:
    return str(secrets.randbelow(900000) + 100000)  # 6-digit code

async def send_mailtrap_email(to_email: str, subject: str, html_content: str):
    """High-speed, async HTTP email sender using Mailtrap API"""
    headers = {
        "Authorization": f"Bearer {MAILTRAP_TOKEN}",
        "Content-Type": "application/json"
    }
    
    payload = {
        "from": {"email": MAILTRAP_FROM_EMAIL, "name": MAILTRAP_FROM_NAME},
        "to": [{"email": to_email}],
        "subject": subject,
        "html": html_content,
        "category": "Transactional"
    }
    
    # httpx is async and non-blocking, perfect for FastAPI
    async with httpx.AsyncClient() as client:
        try:
            response = await client.post(MAILTRAP_API_URL, headers=headers, json=payload, timeout=10.0)
            response.raise_for_status()
            return True
        except httpx.HTTPStatusError as e:
            print(f"Mailtrap API Error: {e.response.text}")
            return False
        except Exception as e:
            print(f"Mailtrap Connection Error: {str(e)}")
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
    await send_mailtrap_email(email, "Verify Your ShopHub Account", html_content)

async def send_security_alert_email(email: str, location: str, ip: str):
    html_content = f"""
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #dc2626;">🚨 New Device Login Detected</h2>
        <p>Hello,</p>
        <p>We detected a login to your ShopHub account from a new location. If this was you, you can safely ignore this email.</p>
        <div style="background-color: #fef2f2; border-left: 4px solid #dc2626; padding: 15px; margin: 20px 0;">
            <p style="margin: 5px 0;"><strong>📍 Location:</strong> {location or 'Unknown'}</p>
            <p style="margin: 5px 0;"><strong>🌐 IP Address:</strong> {ip or 'Unknown'}</p>
            <p style="margin: 5px 0;"><strong>🕒 Time:</strong> {datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S UTC')}</p>
        </div>
        <p>If this was <strong>NOT</strong> you, please change your password immediately and contact support.</p>
        <br>
        <p>Best regards,<br>ShopHub Security Team</p>
    </div>
    """
    await send_mailtrap_email(email, "🚨 New Device Login Detected - ShopHub", html_content)
