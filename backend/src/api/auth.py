import uuid
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session
from src.db.session import get_db
from src.models.workspace import User, Workspace
from src.core.security import create_access_token

router = APIRouter()


class LoginRequest(BaseModel):
    email: str
    name: str


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    workspace_id: str
    user_id: str
    name: str
    email: str


@router.post("/login", response_model=LoginResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    """
    Simulated SSO login endpoint.
    Finds or creates a User + Workspace by email, returns a signed JWT.
    """
    # Find or create user keyed by email
    user = db.query(User).filter(User.email == payload.email).first()
    if not user:
        user = User(id=str(uuid.uuid4()), email=payload.email)
        db.add(user)
        db.flush()

    # Find or create their personal workspace
    workspace = db.query(Workspace).filter(Workspace.user_id == user.id).first()
    if not workspace:
        workspace = Workspace(
            id=uuid.uuid4(),
            user_id=user.id,
            name=f"{payload.name}'s Workspace"
        )
        db.add(workspace)

    db.commit()
    db.refresh(user)
    db.refresh(workspace)

    token = create_access_token(user_id=str(user.id))

    return LoginResponse(
        access_token=token,
        workspace_id=str(workspace.id),
        user_id=str(user.id),
        name=payload.name,
        email=user.email,
    )
