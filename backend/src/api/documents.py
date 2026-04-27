import io
from fastapi import APIRouter, Depends, BackgroundTasks, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session
from src.db.session import get_db
from src.core.security import get_current_user
from src.models.workspace import User, Workspace
from src.models.document import Document
from src.services.storage import upload_file
from src.services.rag_ingestion import process_document
from pydantic import BaseModel

router = APIRouter()


class DocumentCreate(BaseModel):
    workspace_id: str
    filename: str


@router.get("/")
def get_documents_for_workspace(
    workspace_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Enforce ownership — user can only query their own workspaces
    workspace = db.query(Workspace).filter(
        Workspace.id == workspace_id,
        Workspace.user_id == current_user.id
    ).first()
    if not workspace:
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
    current_user: User = Depends(get_current_user)
):
    """Single-step upload: receive file, persist to disk, queue processing."""
    workspace = db.query(Workspace).filter(
        Workspace.id == workspace_id,
        Workspace.user_id == current_user.id
    ).first()
    if not workspace:
        raise HTTPException(status_code=404, detail="Workspace not found")

    # Create DB record
    doc = Document(
        workspace_id=workspace.id,
        name=file.filename,
        gcs_uri=f"local://uploads/workspaces/{workspace.id}/"
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)

    # Write bytes to persistent volume
    file_bytes = await file.read()
    upload_file(str(workspace.id), str(doc.id), file.filename, file_bytes)

    # Queue background ingestion
    background_tasks.add_task(process_document, db, str(doc.id))

    return {"id": str(doc.id), "name": doc.name, "status": doc.status}


@router.delete("/{document_id}")
def delete_document(
    document_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    doc = db.query(Document).filter(Document.id == document_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    # Verify ownership
    workspace = db.query(Workspace).filter(
        Workspace.id == doc.workspace_id,
        Workspace.user_id == current_user.id
    ).first()
    if not workspace:
        raise HTTPException(status_code=403, detail="Access denied")

    db.delete(doc)
    db.commit()
    return {"status": "deleted"}
