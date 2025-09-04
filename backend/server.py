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

# Pydantic Models
class Client(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    cnpj: str
    company_name: str
    email: str
    phone: str
    whatsapp: Optional[str] = None
    password_hash: str
    is_active: bool = True
    two_factor_enabled: bool = False
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
@api_router.post("/auth/login")
async def login(client_data: ClientLogin):
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

# Vehicle Routes
@api_router.get("/vehicles", response_model=List[Vehicle])
async def get_vehicles(current_user: dict = Depends(get_current_user)):
    vehicles = await db.vehicles.find({"client_id": current_user["id"], "is_active": True}).to_list(None)
    return [Vehicle(**vehicle) for vehicle in vehicles]

@api_router.post("/vehicles", response_model=Vehicle)
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

@api_router.post("/limits", response_model=Limit)
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
    return [Invoice(**invoice) for invoice in invoices]

@api_router.get("/invoices/open")
async def get_open_invoices(current_user: dict = Depends(get_current_user)):
    invoices = await db.invoices.find({
        "client_id": current_user["id"],
        "status": {"$in": ["open", "overdue"]}
    }).sort("due_date", 1).to_list(100)
    return [Invoice(**invoice) for invoice in invoices]

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
    # Create test client
    test_client = Client(
        cnpj="12345678901234",
        company_name="Transportadora ABC Ltda",
        email="admin@transportadoraabc.com",
        phone="11999999999",
        whatsapp="11999999999",
        password_hash=get_password_hash("123456")
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
    
    # Create test invoice
    invoice = Invoice(
        client_id=test_client.id,
        invoice_number="INV-2024-001",
        total_amount=2850.75,
        due_date=datetime.now(timezone.utc) + timedelta(days=15)
    )
    await db.invoices.insert_one(invoice.dict())
    
    return {"message": "Test data created successfully"}

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