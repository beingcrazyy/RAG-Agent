import io
from fastapi import APIRouter, Depends, BackgroundTasks, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session
from src.db.session import get_db
from src.core.security import get_current_user, get_token_payload
from src.models.workspace import User, Workspace
from src.models.document import Document
from src.services.storage import upload_file
from src.services.rag_ingestion import process_document
from pydantic import BaseModel

router = APIRouter()


def _resolve_workspace(token_payload: dict, db: Session) -> Workspace:
    """Returns the enterprise workspace from the JWT — shared across all members."""
    workspace_id = token_payload.get("workspace_id")
    if not workspace_id:
        raise HTTPException(status_code=403, detail="No workspace in token")
    workspace = db.query(Workspace).filter(Workspace.id == workspace_id).first()
    if not workspace:
        raise HTTPException(status_code=404, detail="Workspace not found")
    return workspace


@router.get("/")
def get_documents_for_workspace(
    workspace_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    token_payload: dict = Depends(get_token_payload),
):
    # Any active member can list docs — workspace must match their enterprise workspace
    token_ws = token_payload.get("workspace_id")
    if token_ws and str(workspace_id) != str(token_ws):
        raise HTTPException(status_code=403, detail="Access denied")

    docs = db.query(Document).filter(
        Document.workspace_id == workspace_id
    ).order_by(Document.created_at.desc()).all()

    return [
        {"id": str(d.id), "name": d.name, "status": d.status}
        for d in docs
    ]


@router.post("/upload", status_code=201)
async def upload_document(
    workspace_id: str = Form(...),
    file: UploadFile = File(...),
    background_tasks: BackgroundTasks = BackgroundTasks(),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    token_payload: dict = Depends(get_token_payload),
):
    """Only enterprise admins can upload documents."""
    if token_payload.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Only enterprise admins can upload documents")

    workspace = _resolve_workspace(token_payload, db)
    if str(workspace.id) != str(workspace_id):
        raise HTTPException(status_code=403, detail="Workspace mismatch")

    doc = Document(
        workspace_id=workspace.id,
        name=file.filename,
        gcs_uri=f"local://uploads/workspaces/{workspace.id}/"
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)

    file_bytes = await file.read()
    upload_file(str(workspace.id), str(doc.id), file.filename, file_bytes)
    background_tasks.add_task(process_document, db, str(doc.id))

    return {"id": str(doc.id), "name": doc.name, "status": doc.status}


@router.delete("/{document_id}")
def delete_document(
    document_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    token_payload: dict = Depends(get_token_payload),
):
    """Only enterprise admins can delete documents."""
    if token_payload.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Only enterprise admins can delete documents")

    doc = db.query(Document).filter(Document.id == document_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    # Verify the doc belongs to the enterprise's workspace
    token_ws = token_payload.get("workspace_id")
    if token_ws and str(doc.workspace_id) != str(token_ws):
        raise HTTPException(status_code=403, detail="Access denied")

    db.delete(doc)
    db.commit()
    return {"status": "deleted"}

