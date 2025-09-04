from fastapi import FastAPI, APIRouter, HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, validator
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timezone, timedelta
import jwt
from passlib.context import CryptContext
import re
import random
import aiosmtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import requests
import asyncio

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Create the main app
app = FastAPI(title="Fuel Station Client Portal", version="1.0.0")

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Security
security = HTTPBearer()
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
SECRET_KEY = "your-secret-key-change-in-production"
ALGORITHM = "HS256"

# Email configuration
SMTP_SERVER = os.environ.get('SMTP_SERVER', 'smtp.gmail.com')
SMTP_PORT = int(os.environ.get('SMTP_PORT', 587))
EMAIL_ADDRESS = os.environ.get('EMAIL_ADDRESS', '')
EMAIL_PASSWORD = os.environ.get('EMAIL_PASSWORD', '')

# Z-API WhatsApp configuration
ZAPI_TOKEN = os.environ.get('ZAPI_TOKEN', '')
ZAPI_INSTANCE_ID = os.environ.get('ZAPI_INSTANCE_ID', '')
ZAPI_BASE_URL = os.environ.get('ZAPI_BASE_URL', 'https://api.z-api.io')
ZAPI_SECURITY_TOKEN = os.environ.get('ZAPI_SECURITY_TOKEN', '')

# Utility functions
def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password):
    return pwd_context.hash(password)

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(hours=24)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        cnpj: str = payload.get("sub")
        if cnpj is None:
            raise HTTPException(status_code=401, detail="Invalid authentication")
        user = await db.clients.find_one({"cnpj": cnpj})
        if user is None:
            raise HTTPException(status_code=401, detail="User not found")
        return user
    except jwt.JWTError:
        raise HTTPException(status_code=401, detail="Invalid authentication")

# 2FA Helper Functions
def generate_verification_code() -> str:
    """Generate a 6-digit verification code"""
    return str(random.randint(100000, 999999))

async def send_email_code(email: str, code: str) -> bool:
    """Send verification code via email"""
    try:
        if not EMAIL_ADDRESS or not EMAIL_PASSWORD:
            logger.warning("Email credentials not configured")
            return False
            
        message = MIMEMultipart("alternative")
        message["Subject"] = "Código de Verificação - Portal do Cliente"
        message["From"] = EMAIL_ADDRESS
        message["To"] = email

        html_content = f"""
        <html>
          <body>
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #2563eb;">Portal do Cliente - Código de Verificação</h2>
              <p>Seu código de verificação é:</p>
              <div style="background-color: #f3f4f6; padding: 20px; text-align: center; margin: 20px 0;">
                <h1 style="color: #1f2937; font-size: 32px; margin: 0;">{code}</h1>
              </div>
              <p>Este código expira em 5 minutos.</p>
              <p style="color: #6b7280; font-size: 12px;">Se você não solicitou este código, ignore este email.</p>
            </div>
          </body>
        </html>
        """
        
        part = MIMEText(html_content, "html")
        message.attach(part)

        await aiosmtplib.send(
            message,
            hostname=SMTP_SERVER,
            port=SMTP_PORT,
            start_tls=True,
            username=EMAIL_ADDRESS,
            password=EMAIL_PASSWORD,
        )
        return True
    except Exception as e:
        logger.error(f"Error sending email: {e}")
        return False

async def send_whatsapp_code(phone: str, code: str) -> bool:
    """Send verification code via WhatsApp using Z-API"""
    try:
        if not ZAPI_TOKEN or not ZAPI_INSTANCE_ID:
            logger.warning("Z-API credentials not configured")
            return False
            
        # Use fixed phone number for now
        clean_phone = "5534999402367"  # Fixed number: +5534999402367
            
        url = f"{ZAPI_BASE_URL}/instances/{ZAPI_INSTANCE_ID}/token/{ZAPI_TOKEN}/send-text"
        
        payload = {
            "phone": clean_phone,
            "message": f"🔐 *Portal do Cliente*\n\nSeu código de verificação é: *{code}*\n\n⏰ Este código expira em 5 minutos.\n\nSe você não solicitou este código, ignore esta mensagem."
        }

        headers = {
            'Content-Type': 'application/json',
            'Client-Token': ZAPI_SECURITY_TOKEN
        }

        response = requests.post(url, json=payload, headers=headers, timeout=10)
        
        logger.info(f"WhatsApp API Response: {response.status_code} - {response.text}")
        
        if response.status_code == 200:
            logger.info(f"WhatsApp message sent successfully to {clean_phone}")
            return True
        else:
            logger.error(f"WhatsApp API error: {response.status_code} - {response.text}")
            return False
            
    except Exception as e:
        logger.error(f"Error sending WhatsApp message: {e}")
        return False

async def store_verification_code(cnpj: str, code: str, method: str):
    """Store verification code in database with expiration"""
    await db.verification_codes.delete_many({"cnpj": cnpj})  # Remove old codes
    
    verification_data = {
        "cnpj": cnpj,
        "code": code,
        "method": method,
        "created_at": datetime.now(timezone.utc),
        "expires_at": datetime.now(timezone.utc) + timedelta(minutes=5)
    }
    
    await db.verification_codes.insert_one(verification_data)

async def verify_code(cnpj: str, code: str) -> bool:
    """Verify the provided code against stored code"""
    stored_code = await db.verification_codes.find_one({
        "cnpj": cnpj,
        "code": code,
        "expires_at": {"$gt": datetime.now(timezone.utc)}
    })
    
    if stored_code:
        # Remove used code
        await db.verification_codes.delete_one({"_id": stored_code["_id"]})
        return True
    return False

# Credit and notification functions
async def calculate_client_credit_usage(client_id: str) -> float:
    """Calculate current credit usage from open invoices"""
    open_invoices = await db.invoices.find({
        "client_id": client_id,
        "status": {"$in": ["open", "overdue"]}
    }).to_list(None)
    
    return sum(invoice["total_amount"] for invoice in open_invoices)

async def check_credit_alerts(client_id: str, client_data: dict):
    """Check if client has reached credit limit thresholds and send alerts"""
    credit_limit = client_data.get("credit_limit", 10000.0)
    current_usage = await calculate_client_credit_usage(client_id)
    
    if credit_limit <= 0:
        return
    
    percentage = (current_usage / credit_limit) * 100
    
    # Update client's current usage
    await db.clients.update_one(
        {"id": client_id},
        {"$set": {"current_credit_usage": current_usage}}
    )
    
    # Check alert thresholds
    now = datetime.now(timezone.utc)
    alerts_to_send = []
    
    # Check 70% threshold
    if percentage >= 70 and percentage < 80:
        last_alert = client_data.get("last_70_alert")
        if not last_alert or (now - last_alert).days >= 1:
            alerts_to_send.append("70")
            await db.clients.update_one({"id": client_id}, {"$set": {"last_70_alert": now}})
    
    # Check 80% threshold
    elif percentage >= 80 and percentage < 90:
        last_alert = client_data.get("last_80_alert")
        if not last_alert or (now - last_alert).days >= 1:
            alerts_to_send.append("80")
            await db.clients.update_one({"id": client_id}, {"$set": {"last_80_alert": now}})
    
    # Check 90% threshold
    elif percentage >= 90 and percentage < 100:
        last_alert = client_data.get("last_90_alert")
        if not last_alert or (now - last_alert).days >= 1:
            alerts_to_send.append("90")
            await db.clients.update_one({"id": client_id}, {"$set": {"last_90_alert": now}})
    
    # Check 100% threshold
    elif percentage >= 100:
        last_alert = client_data.get("last_100_alert")
        if not last_alert or (now - last_alert).hours >= 6:  # More frequent for 100%
            alerts_to_send.append("100")
            await db.clients.update_one({"id": client_id}, {"$set": {"last_100_alert": now}})
    
    # Send alerts
    for alert_type in alerts_to_send:
        await send_credit_alert(client_data, alert_type, percentage, current_usage, credit_limit)
        
        # Store alert in database
        alert = CreditAlert(
            client_id=client_id,
            alert_type=alert_type,
            current_usage=current_usage,
            credit_limit=credit_limit,
            percentage=percentage
        )
        await db.credit_alerts.insert_one(alert.dict())

async def send_credit_alert(client_data: dict, alert_type: str, percentage: float, usage: float, limit: float):
    """Send credit limit alert via email and/or WhatsApp"""
    try:
        message = f"""🔴 *ALERTA DE LIMITE DE CRÉDITO*

Empresa: {client_data['company_name']}
CNPJ: {client_data['cnpj']}

⚠️ Você atingiu {alert_type}% do seu limite de crédito!

💰 Limite: R$ {limit:,.2f}
📊 Utilizado: R$ {usage:,.2f} ({percentage:.1f}%)
💳 Disponível: R$ {limit - usage:,.2f}

{'🚨 LIMITE EXCEDIDO! Entre em contato conosco.' if percentage >= 100 else '⚠️ Monitore seus gastos para evitar bloqueios.'}

Portal do Cliente - Rede de Postos"""

        # Send email if configured
        if client_data.get("email_notifications", True):
            email = client_data.get("notification_email") or client_data.get("email")
            if email:
                await send_email_code(email, f"ALERTA: {alert_type}% do limite de crédito atingido", message)
        
        # Send WhatsApp if configured  
        if client_data.get("whatsapp_notifications", True):
            phone = client_data.get("notification_whatsapp") or client_data.get("whatsapp") or client_data.get("phone")
            if phone:
                await send_whatsapp_code(phone, message)
                
    except Exception as e:
        logger.error(f"Error sending credit alert: {e}")

async def send_email_code(email: str, subject: str, message: str = None, code: str = None) -> bool:
    """Send verification code or message via email"""
    try:
        if not EMAIL_ADDRESS or not EMAIL_PASSWORD:
            logger.warning("Email credentials not configured")
            return False
            
        email_message = MIMEMultipart("alternative")
        email_message["Subject"] = subject
        email_message["From"] = EMAIL_ADDRESS
        email_message["To"] = email

        if code:
            # Verification code email
            html_content = f"""
            <html>
              <body>
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                  <h2 style="color: #2563eb;">Portal do Cliente - Código de Verificação</h2>
                  <p>Seu código de verificação é:</p>
                  <div style="background-color: #f3f4f6; padding: 20px; text-align: center; margin: 20px 0;">
                    <h1 style="color: #1f2937; font-size: 32px; margin: 0;">{code}</h1>
                  </div>
                  <p>Este código expira em 5 minutos.</p>
                  <p style="color: #6b7280; font-size: 12px;">Se você não solicitou este código, ignore este email.</p>
                </div>
              </body>
            </html>
            """
        else:
            # Alert or message email
            html_content = f"""
            <html>
              <body>
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                  <h2 style="color: #dc2626;">Portal do Cliente - Alerta</h2>
                  <div style="background-color: #fef2f2; border-left: 4px solid #dc2626; padding: 20px; margin: 20px 0;">
                    <pre style="white-space: pre-wrap; font-family: Arial, sans-serif;">{message}</pre>
                  </div>
                </div>
              </body>
            </html>
            """
        
        part = MIMEText(html_content, "html")
        email_message.attach(part)

        await aiosmtplib.send(
            email_message,
            hostname=SMTP_SERVER,
            port=SMTP_PORT,
            start_tls=True,
            username=EMAIL_ADDRESS,
            password=EMAIL_PASSWORD,
        )
        return True
    except Exception as e:
        logger.error(f"Error sending email: {e}")
        return False

# Pydantic Models
class Contact(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    type: str  # "email" or "whatsapp"
    value: str  # email address or phone number
    is_primary: bool = False
    label: str = ""  # e.g., "Pessoal", "Comercial", "Financeiro"

class Client(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    cnpj: str
    company_name: str
    email: str  # Main email for basic info
    phone: str  # Main phone for basic info
    contacts: List[Contact] = []  # Multiple contacts
    password_hash: str
    is_active: bool = True
    two_factor_enabled: bool = False
    # Credit limit and notifications
    credit_limit: float = 10000.0  # Default credit limit
    current_credit_usage: float = 0.0
    last_70_alert: Optional[datetime] = None
    last_80_alert: Optional[datetime] = None
    last_90_alert: Optional[datetime] = None
    last_100_alert: Optional[datetime] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class ClientCreate(BaseModel):
    cnpj: str
    company_name: str
    email: str
    phone: str
    whatsapp: Optional[str] = None
    password: str

    @validator('cnpj')
    def validate_cnpj(cls, v):
        # Basic CNPJ validation
        v = re.sub(r'[^0-9]', '', v)
        if len(v) != 14:
            raise ValueError('CNPJ must have 14 digits')
        return v

class ClientLogin(BaseModel):
    cnpj: str
    password: str

class TwoFactorRequest(BaseModel):
    cnpj: str
    password: str
    method: str  # "whatsapp" or "email"

class TwoFactorVerify(BaseModel):
    cnpj: str
    code: str

class NotificationSettings(BaseModel):
    notification_email: Optional[str] = None
    notification_whatsapp: Optional[str] = None
    email_notifications: bool = True
    whatsapp_notifications: bool = True

class CreditAlert(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    client_id: str
    alert_type: str  # "70", "80", "90", "100"
    current_usage: float
    credit_limit: float
    percentage: float
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    dismissed: bool = False

class PasswordChange(BaseModel):
    current_password: str
    new_password: str

class Vehicle(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    client_id: str
    license_plate: str
    model: str
    year: int
    fuel_type: str  # "gasoline", "ethanol", "diesel"
    driver_name: Optional[str] = None
    is_active: bool = True
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class VehicleCreate(BaseModel):
    license_plate: str
    model: str
    year: int
    fuel_type: str
    driver_name: Optional[str] = None

    @validator('license_plate')
    def validate_plate(cls, v):
        v = v.upper().strip()
        # Brazilian license plate format
        if not re.match(r'^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$', v):
            raise ValueError('Invalid license plate format')
        return v

class Limit(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    client_id: str
    vehicle_id: Optional[str] = None  # If None, applies to all vehicles
    limit_type: str  # "daily", "weekly", "monthly"
    fuel_type: Optional[str] = None  # If None, applies to all fuels
    limit_value: float  # Amount in liters or currency
    limit_unit: str  # "liters" or "currency"
    current_usage: float = 0.0
    reset_date: datetime
    is_active: bool = True
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class LimitCreate(BaseModel):
    vehicle_id: Optional[str] = None
    limit_type: str
    fuel_type: Optional[str] = None
    limit_value: float
    limit_unit: str

class FuelTransaction(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    client_id: str
    vehicle_id: str
    license_plate: str
    fuel_type: str
    liters: float
    price_per_liter: float
    total_amount: float
    station_id: str
    station_name: str
    transaction_date: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    status: str = "completed"  # "pending", "completed", "cancelled"

class Invoice(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    client_id: str
    invoice_number: str
    total_amount: float
    due_date: datetime
    status: str = "open"  # "open", "paid", "overdue"
    transactions: List[str] = []  # List of transaction IDs
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

# Authentication Routes
@api_router.post("/auth/request-2fa")
async def request_two_factor(request_data: TwoFactorRequest):
    """Request 2FA code via WhatsApp or Email"""
    cnpj = re.sub(r'[^0-9]', '', request_data.cnpj)
    client = await db.clients.find_one({"cnpj": cnpj})
    
    if not client or not verify_password(request_data.password, client["password_hash"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid CNPJ or password"
        )
    
    if not client["is_active"]:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Account is deactivated"
        )
    
    # Generate verification code
    code = generate_verification_code()
    
    # Send code based on method
    success = False
    if request_data.method == "email":
        success = await send_email_code(client["email"], code)
    elif request_data.method == "whatsapp":
        phone = client.get("whatsapp") or client.get("phone")
        if phone:
            success = await send_whatsapp_code(phone, code)
        else:
            raise HTTPException(status_code=400, detail="WhatsApp number not configured")
    else:
        raise HTTPException(status_code=400, detail="Invalid method. Use 'email' or 'whatsapp'")
    
    if success:
        await store_verification_code(cnpj, code, request_data.method)
        return {
            "message": f"Verification code sent via {request_data.method}",
            "method": request_data.method
        }
    else:
        raise HTTPException(
            status_code=500, 
            detail=f"Failed to send verification code via {request_data.method}"
        )

@api_router.post("/auth/verify-2fa")
async def verify_two_factor(verify_data: TwoFactorVerify):
    """Verify 2FA code and complete login"""
    cnpj = re.sub(r'[^0-9]', '', verify_data.cnpj)
    client = await db.clients.find_one({"cnpj": cnpj})
    
    if not client:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    # Verify the code
    if not await verify_code(cnpj, verify_data.code):
        raise HTTPException(status_code=401, detail="Invalid or expired verification code")
    
    # Generate JWT token
    access_token = create_access_token(data={"sub": client["cnpj"]})
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "client": {
            "cnpj": client["cnpj"],
            "company_name": client["company_name"],
            "email": client["email"]
        }
    }

@api_router.post("/auth/login")
async def login(client_data: ClientLogin):
    """Login endpoint - with conditional 2FA"""
    cnpj = re.sub(r'[^0-9]', '', client_data.cnpj)
    client = await db.clients.find_one({"cnpj": cnpj})
    
    if not client or not verify_password(client_data.password, client["password_hash"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid CNPJ or password"
        )
    
    if not client["is_active"]:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Account is deactivated"
        )
    
    # Check if 2FA is enabled for the client and if we have the necessary configurations
    two_factor_enabled = client.get("two_factor_enabled", False)
    has_whatsapp_config = bool(ZAPI_TOKEN and ZAPI_INSTANCE_ID)
    has_email_config = bool(EMAIL_ADDRESS and EMAIL_PASSWORD)
    
    # If 2FA is enabled OR if we have external service configurations, require 2FA
    if two_factor_enabled or has_whatsapp_config or has_email_config:
        available_methods = []
        if has_email_config:
            available_methods.append("email")
        if has_whatsapp_config and client.get("whatsapp"):
            available_methods.append("whatsapp")
        
        if available_methods:
            return {
                "requires_2fa": True,
                "message": "Two-factor authentication required",
                "available_methods": available_methods
            }
    
    # Direct login if 2FA is not configured
    access_token = create_access_token(data={"sub": client["cnpj"]})
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "client": {
            "cnpj": client["cnpj"],
            "company_name": client["company_name"],
            "email": client["email"]
        }
    }

# DEVELOPMENT ONLY: Direct login bypass for testing
@api_router.post("/auth/login-dev")
async def login_dev(client_data: ClientLogin):
    """Development only: Direct login bypass for testing (remove in production)"""
    cnpj = re.sub(r'[^0-9]', '', client_data.cnpj)
    client = await db.clients.find_one({"cnpj": cnpj})
    
    if not client or not verify_password(client_data.password, client["password_hash"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid CNPJ or password"
        )
    
    if not client["is_active"]:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Account is deactivated"
        )
    
    # Direct login without 2FA for development testing
    access_token = create_access_token(data={"sub": client["cnpj"]})
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "client": {
            "cnpj": client["cnpj"],
            "company_name": client["company_name"],
            "email": client["email"]
        },
        "dev_mode": True
    }

@api_router.post("/auth/change-password")
async def change_password(password_data: PasswordChange, current_user: dict = Depends(get_current_user)):
    if not verify_password(password_data.current_password, current_user["password_hash"]):
        raise HTTPException(status_code=400, detail="Current password is incorrect")
    
    new_hash = get_password_hash(password_data.new_password)
    await db.clients.update_one(
        {"cnpj": current_user["cnpj"]},
        {"$set": {"password_hash": new_hash}}
    )
    return {"message": "Password changed successfully"}

# Configuration Routes
@api_router.get("/settings")
async def get_settings(current_user: dict = Depends(get_current_user)):
    """Get client notification settings"""
    return {
        "notification_email": current_user.get("notification_email"),
        "notification_whatsapp": current_user.get("notification_whatsapp"),
        "email_notifications": current_user.get("email_notifications", True),
        "whatsapp_notifications": current_user.get("whatsapp_notifications", True),
        "credit_limit": current_user.get("credit_limit", 10000.0),
        "current_credit_usage": await calculate_client_credit_usage(current_user["id"])
    }

@api_router.put("/settings")
async def update_settings(settings: NotificationSettings, current_user: dict = Depends(get_current_user)):
    """Update client notification settings"""
    update_data = settings.dict()
    
    await db.clients.update_one(
        {"cnpj": current_user["cnpj"]},
        {"$set": update_data}
    )
    
    return {"message": "Settings updated successfully"}

# Credit Alert Routes
@api_router.get("/credit-alerts")
async def get_credit_alerts(current_user: dict = Depends(get_current_user)):
    """Get active credit alerts for client"""
    alerts = await db.credit_alerts.find({
        "client_id": current_user["id"],
        "dismissed": False,
        "created_at": {"$gte": datetime.now(timezone.utc) - timedelta(days=7)}
    }).sort("created_at", -1).to_list(10)
    
    return [CreditAlert(**alert) for alert in alerts]

@api_router.post("/credit-alerts/{alert_id}/dismiss")
async def dismiss_credit_alert(alert_id: str, current_user: dict = Depends(get_current_user)):
    """Dismiss a credit alert"""
    result = await db.credit_alerts.update_one(
        {"id": alert_id, "client_id": current_user["id"]},
        {"$set": {"dismissed": True}}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Alert not found")
    
    return {"message": "Alert dismissed"}

# Vehicle Routes
@api_router.get("/vehicles", response_model=List[Vehicle])
async def get_vehicles(current_user: dict = Depends(get_current_user)):
    vehicles = await db.vehicles.find({"client_id": current_user["id"], "is_active": True}).to_list(None)
    return [Vehicle(**vehicle) for vehicle in vehicles]

@api_router.post("/vehicles", response_model=Vehicle, status_code=201)
async def create_vehicle(vehicle_data: VehicleCreate, current_user: dict = Depends(get_current_user)):
    # Check if license plate already exists for this client
    existing = await db.vehicles.find_one({
        "license_plate": vehicle_data.license_plate,
        "client_id": current_user["id"],
        "is_active": True
    })
    if existing:
        raise HTTPException(status_code=400, detail="Vehicle with this license plate already exists")
    
    vehicle_dict = vehicle_data.dict()
    vehicle_dict["client_id"] = current_user["id"]
    vehicle = Vehicle(**vehicle_dict)
    await db.vehicles.insert_one(vehicle.dict())
    return vehicle

@api_router.put("/vehicles/{vehicle_id}", response_model=Vehicle)
async def update_vehicle(vehicle_id: str, vehicle_data: VehicleCreate, current_user: dict = Depends(get_current_user)):
    vehicle = await db.vehicles.find_one({"id": vehicle_id, "client_id": current_user["id"]})
    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehicle not found")
    
    update_data = vehicle_data.dict()
    await db.vehicles.update_one(
        {"id": vehicle_id, "client_id": current_user["id"]},
        {"$set": update_data}
    )
    
    updated_vehicle = await db.vehicles.find_one({"id": vehicle_id})
    return Vehicle(**updated_vehicle)

@api_router.delete("/vehicles/{vehicle_id}")
async def delete_vehicle(vehicle_id: str, current_user: dict = Depends(get_current_user)):
    result = await db.vehicles.update_one(
        {"id": vehicle_id, "client_id": current_user["id"]},
        {"$set": {"is_active": False}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Vehicle not found")
    return {"message": "Vehicle deleted successfully"}

# Limits Routes
@api_router.get("/limits", response_model=List[Limit])
async def get_limits(current_user: dict = Depends(get_current_user)):
    limits = await db.limits.find({"client_id": current_user["id"], "is_active": True}).to_list(None)
    return [Limit(**limit) for limit in limits]

@api_router.post("/limits", response_model=Limit, status_code=201)
async def create_limit(limit_data: LimitCreate, current_user: dict = Depends(get_current_user)):
    limit_dict = limit_data.dict()
    limit_dict["client_id"] = current_user["id"]
    
    # Calculate reset date based on limit type
    now = datetime.now(timezone.utc)
    if limit_data.limit_type == "daily":
        reset_date = now + timedelta(days=1)
    elif limit_data.limit_type == "weekly":
        reset_date = now + timedelta(weeks=1)
    else:  # monthly
        if now.month == 12:
            reset_date = now.replace(year=now.year + 1, month=1, day=1)
        else:
            reset_date = now.replace(month=now.month + 1, day=1)
    
    limit_dict["reset_date"] = reset_date
    limit = Limit(**limit_dict)
    await db.limits.insert_one(limit.dict())
    return limit

# Transactions Routes
@api_router.get("/transactions")
async def get_transactions(current_user: dict = Depends(get_current_user)):
    transactions = await db.fuel_transactions.find({"client_id": current_user["id"]}).sort("transaction_date", -1).to_list(100)
    return [FuelTransaction(**transaction) for transaction in transactions]

@api_router.get("/transactions/vehicle/{vehicle_id}")
async def get_vehicle_transactions(vehicle_id: str, current_user: dict = Depends(get_current_user)):
    transactions = await db.fuel_transactions.find({
        "client_id": current_user["id"],
        "vehicle_id": vehicle_id
    }).sort("transaction_date", -1).to_list(100)
    return [FuelTransaction(**transaction) for transaction in transactions]

# Invoices Routes
@api_router.get("/invoices")
async def get_invoices(current_user: dict = Depends(get_current_user)):
    invoices = await db.invoices.find({"client_id": current_user["id"]}).sort("created_at", -1).to_list(100)
    
    # Check credit alerts after invoice operations
    await check_credit_alerts(current_user["id"], current_user)
    
    return [Invoice(**invoice) for invoice in invoices]

@api_router.get("/invoices/open")
async def get_open_invoices(current_user: dict = Depends(get_current_user)):
    invoices = await db.invoices.find({
        "client_id": current_user["id"],
        "status": {"$in": ["open", "overdue"]}
    }).sort("due_date", 1).to_list(100)
    
    # Check credit alerts
    await check_credit_alerts(current_user["id"], current_user)
    
    return [Invoice(**invoice) for invoice in invoices]

@api_router.get("/invoices/{invoice_id}/details")
async def get_invoice_details(invoice_id: str, current_user: dict = Depends(get_current_user)):
    """Get detailed invoice information including all transactions"""
    invoice = await db.invoices.find_one({"id": invoice_id, "client_id": current_user["id"]})
    
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    
    # Get transactions for this invoice
    transactions = []
    if invoice.get("transactions"):
        transactions = await db.fuel_transactions.find({
            "id": {"$in": invoice["transactions"]}
        }).sort("transaction_date", -1).to_list(None)
    else:
        # If no specific transactions linked, get transactions by date range (fallback)
        invoice_date = invoice["created_at"]
        start_date = invoice_date.replace(day=1)  # First day of the month
        end_date = (start_date + timedelta(days=32)).replace(day=1) - timedelta(days=1)  # Last day of the month
        
        transactions = await db.fuel_transactions.find({
            "client_id": current_user["id"],
            "transaction_date": {"$gte": start_date, "$lte": end_date}
        }).sort("transaction_date", -1).to_list(None)
    
    return {
        "invoice": Invoice(**invoice),
        "transactions": [FuelTransaction(**t) for t in transactions],
        "transaction_count": len(transactions),
        "total_liters": sum(t["liters"] for t in transactions),
        "total_amount": sum(t["total_amount"] for t in transactions)
    }

@api_router.get("/credit-status")
async def get_credit_status(current_user: dict = Depends(get_current_user)):
    """Get current credit status and limits"""
    credit_limit = current_user.get("credit_limit", 10000.0)
    current_usage = await calculate_client_credit_usage(current_user["id"])
    available_credit = max(0, credit_limit - current_usage)
    usage_percentage = (current_usage / credit_limit * 100) if credit_limit > 0 else 0
    
    return {
        "credit_limit": credit_limit,
        "current_usage": current_usage,
        "available_credit": available_credit,
        "usage_percentage": usage_percentage,
        "status": "critical" if usage_percentage >= 100 else "warning" if usage_percentage >= 90 else "normal"
    }

# Dashboard Routes
@api_router.get("/dashboard/stats")
async def get_dashboard_stats(current_user: dict = Depends(get_current_user)):
    # Get basic stats
    vehicles_count = await db.vehicles.count_documents({"client_id": current_user["id"], "is_active": True})
    
    # Current month transactions
    now = datetime.now(timezone.utc)
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    
    month_transactions = await db.fuel_transactions.find({
        "client_id": current_user["id"],
        "transaction_date": {"$gte": month_start}
    }).to_list(None)
    
    total_month_amount = sum(t["total_amount"] for t in month_transactions)
    total_month_liters = sum(t["liters"] for t in month_transactions)
    
    # Open invoices
    open_invoices = await db.invoices.find({
        "client_id": current_user["id"],
        "status": {"$in": ["open", "overdue"]}
    }).to_list(None)
    
    total_open_amount = sum(inv["total_amount"] for inv in open_invoices)
    
    # Fuel type breakdown for current month
    fuel_breakdown = {}
    for transaction in month_transactions:
        fuel_type = transaction["fuel_type"]
        if fuel_type not in fuel_breakdown:
            fuel_breakdown[fuel_type] = {"liters": 0, "amount": 0}
        fuel_breakdown[fuel_type]["liters"] += transaction["liters"]
        fuel_breakdown[fuel_type]["amount"] += transaction["total_amount"]
    
    # Convert recent transactions to serializable format
    recent_transactions = []
    if month_transactions:
        for transaction in month_transactions[-10:]:
            recent_transactions.append({
                "id": transaction["id"],
                "license_plate": transaction["license_plate"],
                "fuel_type": transaction["fuel_type"],
                "liters": transaction["liters"],
                "total_amount": transaction["total_amount"],
                "transaction_date": transaction["transaction_date"].isoformat() if isinstance(transaction["transaction_date"], datetime) else transaction["transaction_date"]
            })
    
    return {
        "vehicles_count": vehicles_count,
        "month_total_amount": total_month_amount,
        "month_total_liters": total_month_liters,
        "open_invoices_count": len(open_invoices),
        "total_open_amount": total_open_amount,
        "fuel_breakdown": fuel_breakdown,
        "recent_transactions": recent_transactions
    }

# Test data creation (remove in production)
@api_router.post("/create-test-data")
async def create_test_data():
    # Create test client with credit limit
    test_client = Client(
        cnpj="12345678901234",
        company_name="Transportadora ABC Ltda",
        email="admin@transportadoraabc.com",
        phone="11999999999",
        whatsapp="5511999999999",
        password_hash=get_password_hash("123456"),
        credit_limit=15000.0,
        current_credit_usage=0.0,
        notification_email="admin@transportadoraabc.com",
        notification_whatsapp="5511999999999",
        email_notifications=True,
        whatsapp_notifications=True
    )
    
    await db.clients.insert_one(test_client.dict())
    
    # Create test vehicles
    vehicles = [
        Vehicle(
            client_id=test_client.id,
            license_plate="ABC1234",
            model="Mercedes Sprinter",
            year=2022,
            fuel_type="diesel",
            driver_name="João Silva"
        ),
        Vehicle(
            client_id=test_client.id,
            license_plate="DEF5678",
            model="Volkswagen Delivery",
            year=2021,
            fuel_type="diesel",
            driver_name="Maria Santos"
        )
    ]
    
    for vehicle in vehicles:
        await db.vehicles.insert_one(vehicle.dict())
    
    # Create test transactions
    import random
    transaction_ids = []
    for i in range(20):
        transaction = FuelTransaction(
            client_id=test_client.id,
            vehicle_id=vehicles[random.randint(0, 1)].id,
            license_plate=vehicles[random.randint(0, 1)].license_plate,
            fuel_type="diesel",
            liters=random.uniform(30, 80),
            price_per_liter=5.45,
            total_amount=0,
            station_id="station_001",
            station_name="Posto Shell Centro",
            transaction_date=datetime.now(timezone.utc) - timedelta(days=random.randint(0, 30))
        )
        transaction.total_amount = transaction.liters * transaction.price_per_liter
        await db.fuel_transactions.insert_one(transaction.dict())
        transaction_ids.append(transaction.id)
    
    # Create test invoices
    invoice1 = Invoice(
        client_id=test_client.id,
        invoice_number="INV-2024-001",
        total_amount=2850.75,
        due_date=datetime.now(timezone.utc) + timedelta(days=15),
        transactions=transaction_ids[:10]
    )
    await db.invoices.insert_one(invoice1.dict())
    
    invoice2 = Invoice(
        client_id=test_client.id,
        invoice_number="INV-2024-002",
        total_amount=4200.50,
        due_date=datetime.now(timezone.utc) + timedelta(days=5),
        transactions=transaction_ids[10:]
    )
    await db.invoices.insert_one(invoice2.dict())
    
    # Create test credit alert (90% usage)
    alert = CreditAlert(
        client_id=test_client.id,
        alert_type="90",
        current_usage=13500.0,
        credit_limit=15000.0,
        percentage=90.0
    )
    await db.credit_alerts.insert_one(alert.dict())
    
    return {"message": "Test data created successfully with credit system"}

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()