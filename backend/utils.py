import os
import secrets
from datetime import datetime, timedelta
from jose import jwt, JWTError
from passlib.context import CryptContext
from fastapi_mail import FastMail, MessageSchema, ConnectionConfig, MessageType
from dotenv import load_dotenv

load_dotenv()

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
SECRET_KEY = os.getenv("SECRET_KEY")
ALGORITHM = os.getenv("ALGORITHM", "HS256")

# FastAPI Mail Configuration
conf = ConnectionConfig(
    MAIL_USERNAME=os.getenv("MAIL_USERNAME"),
    MAIL_PASSWORD=os.getenv("MAIL_PASSWORD"),
    MAIL_FROM=os.getenv("MAIL_FROM"),
    MAIL_PORT=int(os.getenv("MAIL_PORT", 587)),
    MAIL_SERVER=os.getenv("MAIL_SERVER"),
    MAIL_FROM_NAME=os.getenv("MAIL_FROM_NAME", "ShopHub"),
    MAIL_TLS=os.getenv("MAIL_TLS", "true").lower() == "true",
    MAIL_SSL=os.getenv("MAIL_SSL", "false").lower() == "true",
    USE_CREDENTIALS=True,
    VALIDATE_CERTS=True
)

fm = FastMail(conf)

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

async def send_verification_email(email: str, code: str):
    message = MessageSchema(
        subject="Verify Your ShopHub Account",
        recipients=[email],
        body=f"Your ShopHub verification code is: **{code}**. It expires in 15 minutes. Do not share this with anyone.",
        subtype=MessageType.html
    )
    await fm.send_message(message)

async def send_security_alert_email(email: str, location: str, ip: str):
    message = MessageSchema(
        subject="🚨 New Device Login Detected - ShopHub",
        recipients=[email],
        body=f"""
        <h2>New Login Detected</h2>
        <p>We detected a login to your ShopHub account from a new location.</p>
        <ul>
            <li><strong>Location:</strong> {location or 'Unknown'}</li>
            <li><strong>IP Address:</strong> {ip or 'Unknown'}</li>
            <li><strong>Time:</strong> {datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S UTC')}</li>
        </ul>
        <p>If this was you, you can safely ignore this email. If not, please change your password immediately.</p>
        """,
        subtype=MessageType.html
    )
    await fm.send_message(message)
