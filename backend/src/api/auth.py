import uuid
import secrets
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from passlib.context import CryptContext
from src.db.session import get_db
from src.models.workspace import User, Workspace
from src.models.enterprise import Enterprise, EnterpriseUser
from src.core.security import create_access_token

router = APIRouter()
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


# ── Request / Response schemas ────────────────────────────────────────────────

class EnterpriseRegisterRequest(BaseModel):
    email: str
    password: str
    name: str
    company_name: str
    allowed_email_domains: list[str] = []


class UserRegisterRequest(BaseModel):
    email: str
    password: str
    name: str
    enterprise_slug: str | None = None
    invite_code: str | None = None


class LoginRequest(BaseModel):
    email: str
    password: str


class AuthResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    workspace_id: str
    user_id: str
    name: str
    email: str
    role: str
    enterprise_id: str
    enterprise_name: str
    logo_url: str | None = None
    theme_json: dict | None = None


# ── Register Enterprise ───────────────────────────────────────────────────────

@router.post("/register/enterprise", response_model=AuthResponse, status_code=201)
def register_enterprise(payload: EnterpriseRegisterRequest, db: Session = Depends(get_db)):
    if db.query(User).filter(User.email == payload.email).first():
        raise HTTPException(status_code=400, detail="Email already registered")

    # Build unique slug from company name
    slug_base = payload.company_name.lower().strip().replace(" ", "-")
    slug = slug_base
    if db.query(Enterprise).filter(Enterprise.slug == slug).first():
        slug = f"{slug_base}-{secrets.token_hex(3)}"

    invite_code = secrets.token_urlsafe(12)

    user = User(
        id=str(uuid.uuid4()),
        email=payload.email,
        name=payload.name,
        hashed_password=pwd_context.hash(payload.password),
    )
    db.add(user)
    db.flush()

    workspace = Workspace(
        id=uuid.uuid4(),
        user_id=user.id,
        name=f"{payload.company_name} Knowledge Base",
    )
    db.add(workspace)
    db.flush()

    enterprise = Enterprise(
        id=uuid.uuid4(),
        name=payload.company_name,
        slug=slug,
        invite_code=invite_code,
        allowed_email_domains=payload.allowed_email_domains,
        workspace_id=workspace.id,
    )
    db.add(enterprise)
    db.flush()

    membership = EnterpriseUser(
        id=uuid.uuid4(),
        enterprise_id=enterprise.id,
        user_id=user.id,
        role="admin",
        status="active",
    )
    db.add(membership)
    db.commit()

    token = create_access_token(
        user_id=user.id,
        enterprise_id=str(enterprise.id),
        workspace_id=str(workspace.id),
        role="admin",
    )
    return AuthResponse(
        access_token=token,
        workspace_id=str(workspace.id),
        user_id=user.id,
        name=payload.name,
        email=user.email,
        role="admin",
        enterprise_id=str(enterprise.id),
        enterprise_name=enterprise.name,
        logo_url=enterprise.logo_url,
        theme_json=enterprise.theme_json,
    )


# ── Register User ─────────────────────────────────────────────────────────────

@router.post("/register/user")
def register_user(payload: UserRegisterRequest, db: Session = Depends(get_db)):
    if db.query(User).filter(User.email == payload.email).first():
        raise HTTPException(status_code=400, detail="Email already registered")
    if not payload.enterprise_slug and not payload.invite_code:
        raise HTTPException(status_code=400, detail="Provide enterprise_slug or invite_code")

    enterprise = None
    if payload.invite_code:
        enterprise = db.query(Enterprise).filter(Enterprise.invite_code == payload.invite_code).first()
    if not enterprise and payload.enterprise_slug:
        enterprise = db.query(Enterprise).filter(Enterprise.slug == payload.enterprise_slug).first()
    if not enterprise:
        raise HTTPException(status_code=404, detail="Enterprise not found")

    # Domain-based auto-approval
    email_domain = payload.email.split("@")[-1].lower()
    allowed = enterprise.allowed_email_domains or []
    if payload.invite_code:
        status = "active"   # invite code → instant access
    elif not allowed or email_domain in allowed:
        status = "active"   # domain matches or enterprise is open
    else:
        status = "pending"  # needs admin approval

    user = User(
        id=str(uuid.uuid4()),
        email=payload.email,
        name=payload.name,
        hashed_password=pwd_context.hash(payload.password),
    )
    db.add(user)
    db.flush()

    membership = EnterpriseUser(
        id=uuid.uuid4(),
        enterprise_id=enterprise.id,
        user_id=user.id,
        role="member",
        status=status,
    )
    db.add(membership)
    db.commit()

    if status == "pending":
        return {
            "status": "pending",
            "message": "Registration submitted. Awaiting approval from your enterprise admin.",
        }

    token = create_access_token(
        user_id=user.id,
        enterprise_id=str(enterprise.id),
        workspace_id=str(enterprise.workspace_id),
        role="member",
    )
    return AuthResponse(
        access_token=token,
        workspace_id=str(enterprise.workspace_id),
        user_id=user.id,
        name=payload.name,
        email=user.email,
        role="member",
        enterprise_id=str(enterprise.id),
        enterprise_name=enterprise.name,
        logo_url=enterprise.logo_url,
        theme_json=enterprise.theme_json,
    )


# ── Login ─────────────────────────────────────────────────────────────────────

@router.post("/login", response_model=AuthResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == payload.email).first()
    if not user or not user.hashed_password:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    if not pwd_context.verify(payload.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    membership = (
        db.query(EnterpriseUser)
        .filter(EnterpriseUser.user_id == user.id, EnterpriseUser.status == "active")
        .first()
    )
    if not membership:
        raise HTTPException(status_code=403, detail="No active enterprise membership. Contact your admin.")

    enterprise = db.query(Enterprise).filter(Enterprise.id == membership.enterprise_id).first()
    token = create_access_token(
        user_id=user.id,
        enterprise_id=str(enterprise.id),
        workspace_id=str(enterprise.workspace_id),
        role=membership.role,
    )
    return AuthResponse(
        access_token=token,
        workspace_id=str(enterprise.workspace_id),
        user_id=user.id,
        name=user.name or user.email,
        email=user.email,
        role=membership.role,
        enterprise_id=str(enterprise.id),
        enterprise_name=enterprise.name,
        logo_url=enterprise.logo_url,
        theme_json=enterprise.theme_json,
    )


# ── Public: list enterprises for user signup ──────────────────────────────────

@router.get("/enterprises")
def list_enterprises(db: Session = Depends(get_db)):
    enterprises = db.query(Enterprise).order_by(Enterprise.name).all()
    return [{"slug": e.slug, "name": e.name, "id": str(e.id)} for e in enterprises]

