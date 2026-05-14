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
        {"id": str(d.id), "name": d.name, "status": d.status, "progress": d.progress or 0, "size": d.file_size or "0 KB"}
        for d in docs
    ]


@router.get("/suggestions")
def get_workspace_suggestions(
    workspace_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    token_payload: dict = Depends(get_token_payload),
):
    """Aggregate suggested questions + summaries across all READY documents in a workspace.
    Used by the chat empty-state to show users what they can ask."""
    token_ws = token_payload.get("workspace_id")
    if token_ws and str(workspace_id) != str(token_ws):
        raise HTTPException(status_code=403, detail="Access denied")

    docs = db.query(Document).filter(
        Document.workspace_id == workspace_id,
        Document.status == "READY",
    ).order_by(Document.created_at.desc()).limit(20).all()

    summaries = []
    questions: list[str] = []
    seen = set()
    for d in docs:
        if d.summary:
            summaries.append({"name": d.name, "summary": d.summary})
        if d.suggested_questions and isinstance(d.suggested_questions, list):
            for q in d.suggested_questions:
                ql = q.strip()
                if ql and ql.lower() not in seen:
                    seen.add(ql.lower())
                    questions.append(ql)
                    if len(questions) >= 8:
                        break
        if len(questions) >= 8:
            break

    return {
        "doc_count": len(docs),
        "summaries": summaries[:10],
        "questions": questions[:8],
    }



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

    return {"id": str(doc.id), "name": doc.name, "status": doc.status, "progress": doc.progress or 0}


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


@router.get("/{document_id}/status")
def get_document_status(
    document_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    token_payload: dict = Depends(get_token_payload),
):
    doc = db.query(Document).filter(Document.id == document_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    token_ws = token_payload.get("workspace_id")
    if token_ws and str(doc.workspace_id) != str(token_ws):
        raise HTTPException(status_code=403, detail="Access denied")
    return {"id": str(doc.id), "status": doc.status, "progress": doc.progress or 0, "name": doc.name}

