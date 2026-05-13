import os
import shutil
import uuid
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import func, text
from typing import Optional, List

from src.db.session import get_db
from src.core.security import get_current_user, get_token_payload
from src.models.workspace import User
from src.models.enterprise import Enterprise, EnterpriseUser, TokenUsageLog, QueryLog

router = APIRouter()

LOGO_UPLOAD_DIR = "/app/uploads/logos"
ALLOWED_MODELS = ["gpt-4.1-mini", "gpt-4o-mini", "gpt-4o"]


# ── Helpers ───────────────────────────────────────────────────────────────────

def _require_admin(token_payload: dict, db: Session) -> Enterprise:
    enterprise_id = token_payload.get("enterprise_id")
    if not enterprise_id or token_payload.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Enterprise admin access required")
    enterprise = db.query(Enterprise).filter(Enterprise.id == enterprise_id).first()
    if not enterprise:
        raise HTTPException(status_code=404, detail="Enterprise not found")
    return enterprise


def _require_member(token_payload: dict, db: Session) -> Enterprise:
    enterprise_id = token_payload.get("enterprise_id")
    if not enterprise_id:
        raise HTTPException(status_code=403, detail="No enterprise membership")
    enterprise = db.query(Enterprise).filter(Enterprise.id == enterprise_id).first()
    if not enterprise:
        raise HTTPException(status_code=404, detail="Enterprise not found")
    return enterprise


# ── Enterprise Profile ────────────────────────────────────────────────────────

@router.get("/me")
def get_enterprise(
    token_payload: dict = Depends(get_token_payload),
    db: Session = Depends(get_db),
):
    enterprise = _require_member(token_payload, db)
    return {
        "id": str(enterprise.id),
        "name": enterprise.name,
        "slug": enterprise.slug,
        "invite_code": enterprise.invite_code if token_payload.get("role") == "admin" else None,
        "allowed_email_domains": enterprise.allowed_email_domains or [],
        "logo_url": enterprise.logo_url,
        "theme_json": enterprise.theme_json or {},
        "system_prompt": enterprise.system_prompt,
        "llm_model": enterprise.llm_model,
        "workspace_id": str(enterprise.workspace_id) if enterprise.workspace_id else None,
        # Multi-provider LLM config
        "llm_provider": enterprise.llm_provider or "azure_openai",
        "llm_endpoint": enterprise.llm_endpoint,
        "llm_deployment": enterprise.llm_deployment,
        "llm_api_version": enterprise.llm_api_version,
        "has_api_key": bool(enterprise.llm_api_key),
    }


class EnterpriseUpdateRequest(BaseModel):
    system_prompt: Optional[str] = None
    llm_model: Optional[str] = None
    theme_json: Optional[dict] = None
    allowed_email_domains: Optional[List[str]] = None
    name: Optional[str] = None
    # Multi-provider LLM config
    llm_provider: Optional[str] = None
    llm_api_key: Optional[str] = None
    llm_endpoint: Optional[str] = None
    llm_deployment: Optional[str] = None
    llm_api_version: Optional[str] = None


class LLMConfigRequest(BaseModel):
    llm_provider: str
    llm_api_key: Optional[str] = None
    llm_model: str
    llm_endpoint: Optional[str] = None
    llm_deployment: Optional[str] = None
    llm_api_version: Optional[str] = None


@router.put("/me")
def update_enterprise(
    payload: EnterpriseUpdateRequest,
    token_payload: dict = Depends(get_token_payload),
    db: Session = Depends(get_db),
):
    enterprise = _require_admin(token_payload, db)
    if payload.name is not None:
        enterprise.name = payload.name
    if payload.system_prompt is not None:
        enterprise.system_prompt = payload.system_prompt
    if payload.llm_model is not None:
        if payload.llm_model not in ALLOWED_MODELS:
            raise HTTPException(status_code=400, detail=f"Model must be one of: {ALLOWED_MODELS}")
        enterprise.llm_model = payload.llm_model
    if payload.theme_json is not None:
        enterprise.theme_json = payload.theme_json
    if payload.allowed_email_domains is not None:
        enterprise.allowed_email_domains = payload.allowed_email_domains
    # Multi-provider LLM config updates
    if payload.llm_provider is not None:
        if payload.llm_provider not in ("azure_openai", "openai", "anthropic", "gemini"):
            raise HTTPException(status_code=400, detail="Invalid provider")
        enterprise.llm_provider = payload.llm_provider
    if payload.llm_api_key is not None:
        enterprise.llm_api_key = payload.llm_api_key
    if payload.llm_endpoint is not None:
        enterprise.llm_endpoint = payload.llm_endpoint
    if payload.llm_deployment is not None:
        enterprise.llm_deployment = payload.llm_deployment
    if payload.llm_api_version is not None:
        enterprise.llm_api_version = payload.llm_api_version
    db.commit()
    return {"status": "updated"}


# ── LLM Configuration ─────────────────────────────────────────────────────────

ALLOWED_PROVIDERS = {
    "azure_openai": {
        "models": ["gpt-4.1-mini", "gpt-4o-mini", "gpt-4o", "gpt-4o-2025-04-01", "o1-mini"],
        "requires_endpoint": True,
        "requires_deployment": True,
    },
    "openai": {
        "models": ["gpt-4.1-mini", "gpt-4o-mini", "gpt-4o", "gpt-4o-2025-04-01", "o1-mini", "o1-preview"],
        "requires_endpoint": False,
        "requires_deployment": False,
    },
    "anthropic": {
        "models": ["claude-sonnet-4-20250514", "claude-opus-4-7", "claude-haiku-4-5-20251001"],
        "requires_endpoint": False,
        "requires_deployment": False,
    },
    "gemini": {
        "models": ["gemini-2.0-flash", "gemini-2.0-flash-lite", "gemini-1.5-pro", "gemini-1.5-flash"],
        "requires_endpoint": False,
        "requires_deployment": False,
    },
}


@router.get("/llm-config")
def get_llm_config(
    token_payload: dict = Depends(get_token_payload),
    db: Session = Depends(get_db),
):
    """Get current LLM configuration (without API key)"""
    enterprise = _require_member(token_payload, db)
    return {
        "llm_provider": enterprise.llm_provider or "azure_openai",
        "llm_model": enterprise.llm_model,
        "llm_endpoint": enterprise.llm_endpoint,
        "llm_deployment": enterprise.llm_deployment,
        "llm_api_version": enterprise.llm_api_version,
        "has_api_key": bool(enterprise.llm_api_key),
        "allowed_providers": ALLOWED_PROVIDERS,
    }


@router.post("/llm-config")
def save_llm_config(
    payload: LLMConfigRequest,
    token_payload: dict = Depends(get_token_payload),
    db: Session = Depends(get_db),
):
    """Save LLM configuration"""
    enterprise = _require_admin(token_payload, db)

    if payload.llm_provider not in ALLOWED_PROVIDERS:
        raise HTTPException(status_code=400, detail="Invalid provider")

    provider_info = ALLOWED_PROVIDERS[payload.llm_provider]
    if payload.llm_model not in provider_info["models"]:
        raise HTTPException(status_code=400, detail=f"Invalid model for {payload.llm_provider}")

    if provider_info["requires_endpoint"] and not payload.llm_endpoint:
        raise HTTPException(status_code=400, detail="Endpoint is required for Azure OpenAI")

    enterprise.llm_provider = payload.llm_provider
    enterprise.llm_model = payload.llm_model
    enterprise.llm_api_key = payload.llm_api_key
    enterprise.llm_endpoint = payload.llm_endpoint
    enterprise.llm_deployment = payload.llm_deployment
    enterprise.llm_api_version = payload.llm_api_version

    db.commit()
    return {"status": "saved", "llm_provider": enterprise.llm_provider, "llm_model": enterprise.llm_model}


@router.post("/llm-config/test")
def test_llm_config(
    payload: LLMConfigRequest,
    token_payload: dict = Depends(get_token_payload),
    db: Session = Depends(get_db),
):
    """Test LLM configuration by making a simple API call"""
    if not payload.llm_api_key:
        return {"success": False, "error": "API key is required"}

    try:
        if payload.llm_provider == "azure_openai":
            import requests
            url = f"{payload.llm_endpoint}/openai/deployments/{payload.llm_deployment or 'gpt-4.1-mini'}/chat/completions?api-version={payload.llm_api_version or '2024-12-01-preview'}"
            headers = {"api-key": payload.llm_api_key, "Content-Type": "application/json"}
            data = {"messages": [{"role": "user", "content": "Say 'OK' if you receive this."}], "max_tokens": 10}
            resp = requests.post(url, json=data, headers=headers, timeout=10)
            if resp.status_code == 200:
                return {"success": True, "message": "Azure OpenAI connection successful"}
            return {"success": False, "error": f"Azure API error: {resp.text[:200]}"}

        elif payload.llm_provider == "openai":
            import requests
            headers = {"Authorization": f"Bearer {payload.llm_api_key}", "Content-Type": "application/json"}
            data = {"model": payload.llm_model, "messages": [{"role": "user", "content": "Say 'OK' if you receive this."}], "max_tokens": 10}
            resp = requests.post("https://api.openai.com/v1/chat/completions", json=data, headers=headers, timeout=10)
            if resp.status_code == 200:
                return {"success": True, "message": "OpenAI connection successful"}
            return {"success": False, "error": f"OpenAI API error: {resp.text[:200]}"}

        elif payload.llm_provider == "anthropic":
            import anthropic
            client = anthropic.Anthropic(api_key=payload.llm_api_key)
            client.messages.create(model=payload.llm_model, max_tokens=10, messages=[{"role": "user", "content": "Say 'OK' if you receive this."}])
            return {"success": True, "message": "Anthropic connection successful"}

        elif payload.llm_provider == "gemini":
            import requests
            url = f"https://generativelanguage.googleapis.com/v1beta/models/{payload.llm_model}:generateContent?key={payload.llm_api_key}"
            data = {"contents": [{"parts": [{"text": "Say 'OK' if you receive this."}]}]}
            resp = requests.post(url, json=data, timeout=10)
            if resp.status_code == 200:
                return {"success": True, "message": "Google Gemini connection successful"}
            return {"success": False, "error": f"Gemini API error: {resp.text[:200]}"}

    except Exception as e:
        return {"success": False, "error": str(e)}


@router.post("/logo")
async def upload_logo(
    file: UploadFile = File(...),
    token_payload: dict = Depends(get_token_payload),
    db: Session = Depends(get_db),
):
    enterprise = _require_admin(token_payload, db)
    ext = file.filename.rsplit(".", 1)[-1].lower() if "." in (file.filename or "") else "png"
    if ext not in ("png", "jpg", "jpeg", "svg", "webp"):
        raise HTTPException(status_code=400, detail="Logo must be png/jpg/jpeg/svg/webp")
    os.makedirs(LOGO_UPLOAD_DIR, exist_ok=True)
    filename = f"{enterprise.slug}.{ext}"
    dest = os.path.join(LOGO_UPLOAD_DIR, filename)
    with open(dest, "wb") as f:
        shutil.copyfileobj(file.file, f)
    enterprise.logo_url = f"/logos/{filename}"
    db.commit()
    return {"logo_url": enterprise.logo_url}


# ── User Management ───────────────────────────────────────────────────────────

@router.get("/users")
def list_enterprise_users(
    token_payload: dict = Depends(get_token_payload),
    db: Session = Depends(get_db),
):
    enterprise = _require_admin(token_payload, db)
    memberships = db.query(EnterpriseUser).filter(
        EnterpriseUser.enterprise_id == enterprise.id
    ).all()

    result = []
    for m in memberships:
        user = db.query(User).filter(User.id == m.user_id).first()
        query_count = db.query(func.count(QueryLog.id)).filter(
            QueryLog.user_id == m.user_id,
            QueryLog.enterprise_id == enterprise.id,
        ).scalar() or 0
        token_total = db.query(
            func.coalesce(func.sum(TokenUsageLog.tokens_in + TokenUsageLog.tokens_out), 0)
        ).filter(
            TokenUsageLog.user_id == m.user_id,
            TokenUsageLog.enterprise_id == enterprise.id,
        ).scalar() or 0
        result.append({
            "user_id": m.user_id,
            "email": user.email if user else "",
            "name": user.name if user else "",
            "role": m.role,
            "status": m.status,
            "joined_at": m.joined_at.isoformat() if m.joined_at else None,
            "query_count": int(query_count),
            "token_total": int(token_total),
        })
    return result


@router.post("/users/{user_id}/approve")
def approve_user(
    user_id: str,
    token_payload: dict = Depends(get_token_payload),
    db: Session = Depends(get_db),
):
    enterprise = _require_admin(token_payload, db)
    membership = db.query(EnterpriseUser).filter(
        EnterpriseUser.enterprise_id == enterprise.id,
        EnterpriseUser.user_id == user_id,
    ).first()
    if not membership:
        raise HTTPException(status_code=404, detail="User not found in enterprise")
    membership.status = "active"
    db.commit()
    return {"status": "approved"}


@router.post("/users/{user_id}/revoke")
def revoke_user(
    user_id: str,
    token_payload: dict = Depends(get_token_payload),
    db: Session = Depends(get_db),
):
    enterprise = _require_admin(token_payload, db)
    membership = db.query(EnterpriseUser).filter(
        EnterpriseUser.enterprise_id == enterprise.id,
        EnterpriseUser.user_id == user_id,
    ).first()
    if not membership:
        raise HTTPException(status_code=404, detail="User not found in enterprise")
    membership.status = "revoked"
    db.commit()
    return {"status": "revoked"}


@router.get("/invite-code")
def get_invite_code(
    token_payload: dict = Depends(get_token_payload),
    db: Session = Depends(get_db),
):
    enterprise = _require_admin(token_payload, db)
    return {"invite_code": enterprise.invite_code, "slug": enterprise.slug}


# ── Analytics ─────────────────────────────────────────────────────────────────

@router.get("/analytics")
def get_analytics(
    token_payload: dict = Depends(get_token_payload),
    db: Session = Depends(get_db),
):
    enterprise = _require_admin(token_payload, db)
    eid = str(enterprise.id)

    token_totals = db.execute(text("""
        SELECT
            COALESCE(SUM(tokens_in), 0)  AS total_in,
            COALESCE(SUM(tokens_out), 0) AS total_out
        FROM token_usage_log
        WHERE enterprise_id = CAST(:eid AS uuid)
    """), {"eid": eid}).fetchone()

    top_users_rows = db.execute(text("""
        SELECT u.name, u.email, COUNT(q.id) AS query_count
        FROM query_log q
        JOIN "user" u ON u.id = q.user_id
        WHERE q.enterprise_id = CAST(:eid AS uuid)
        GROUP BY u.id, u.name, u.email
        ORDER BY query_count DESC
        LIMIT 10
    """), {"eid": eid}).fetchall()

    top_questions_rows = db.execute(text("""
        SELECT query_text, COUNT(*) AS cnt
        FROM query_log
        WHERE enterprise_id = CAST(:eid AS uuid)
        GROUP BY query_text
        ORDER BY cnt DESC
        LIMIT 10
    """), {"eid": eid}).fetchall()

    daily_rows = db.execute(text("""
        SELECT DATE(created_at) AS day, COUNT(*) AS queries
        FROM query_log
        WHERE enterprise_id = CAST(:eid AS uuid)
          AND created_at >= NOW() - INTERVAL '30 days'
        GROUP BY DATE(created_at)
        ORDER BY day
    """), {"eid": eid}).fetchall()

    return {
        "total_tokens_in": int(token_totals.total_in),
        "total_tokens_out": int(token_totals.total_out),
        "top_users": [
            {"name": r.name or r.email, "email": r.email, "query_count": r.query_count}
            for r in top_users_rows
        ],
        "top_questions": [
            {"question": r.query_text[:120], "count": r.cnt}
            for r in top_questions_rows
        ],
        "daily_usage": [
            {"day": str(r.day), "queries": r.queries}
            for r in daily_rows
        ],
    }


# ── Public: theme by slug ─────────────────────────────────────────────────────

@router.get("/theme/{slug}")
def get_theme_by_slug(slug: str, db: Session = Depends(get_db)):
    """Public endpoint — returns theme + logo for white-labeling on load."""
    enterprise = db.query(Enterprise).filter(Enterprise.slug == slug).first()
    if not enterprise:
        raise HTTPException(status_code=404, detail="Enterprise not found")
    return {
        "name": enterprise.name,
        "logo_url": enterprise.logo_url,
        "theme_json": enterprise.theme_json or {},
    }
