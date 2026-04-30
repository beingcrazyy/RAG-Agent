from fastapi import APIRouter, Depends, HTTPException, Request
from slowapi import Limiter
from slowapi.util import get_remote_address
from sqlalchemy.orm import Session
from src.db.session import get_db
from src.core.security import get_current_user
from src.models.workspace import User, Workspace
from src.models.chat import ChatThread, ChatMessage
from src.services.langgraph_orchestrator import rag_chain
from pydantic import BaseModel
from langchain_core.messages import HumanMessage

router = APIRouter()
limiter = Limiter(key_func=get_remote_address)

class ChatRequest(BaseModel):
    workspace_id: str
    thread_id: str
    message: str

@router.post("/threads")
def create_thread(
    workspace_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    import uuid
    thread = ChatThread(id=str(uuid.uuid4()), workspace_id=workspace_id, title="New Chat")
    db.add(thread)
    db.commit()
    return {"id": str(thread.id), "title": thread.title}

@router.get("/threads")
def list_threads(
    workspace_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    threads = db.query(ChatThread).filter(
        ChatThread.workspace_id == workspace_id
    ).order_by(ChatThread.created_at.desc()).limit(20).all()
    return [{"id": str(t.id), "title": t.title, "date": "Recent"} for t in threads]

@router.get("/{thread_id}/messages")
def get_historical_chat_context(
    thread_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    msgs = db.query(ChatMessage).filter(
        ChatMessage.thread_id == thread_id
    ).order_by(ChatMessage.created_at.asc()).all()
    return [{"id": str(m.id), "role": m.role, "content": m.content} for m in msgs]

@router.delete("/threads/{thread_id}")
def delete_thread_matrix(
    thread_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    thread = db.query(ChatThread).filter(ChatThread.id == thread_id).first()
    if not thread:
        raise HTTPException(status_code=404, detail="Thread not found")
        
    db.delete(thread)
    db.commit()
    return {"status": "deleted"}

class RenameRequest(BaseModel):
    title: str

@router.put("/threads/{thread_id}/rename")
def rename_thread(
    thread_id: str,
    payload: RenameRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    thread = db.query(ChatThread).filter(ChatThread.id == thread_id).first()
    if not thread:
        raise HTTPException(status_code=404, detail="Thread not found")
        
    thread.title = payload.title
    db.commit()
    return {"id": thread.id, "title": thread.title}

@router.post("/", status_code=201)
@limiter.limit("60/minute")
def chat_with_rag(
    request: Request,
    payload: ChatRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Verify workspace ownership
    workspace = db.query(Workspace).filter(
        Workspace.id == payload.workspace_id,
        Workspace.user_id == current_user.id
    ).first()
    
    if not workspace:
        raise HTTPException(status_code=404, detail="Workspace not found")
        
    thread = db.query(ChatThread).filter(ChatThread.id == payload.thread_id).first()
    
    # Check if thread is dynamically new
    is_new = False
    if not thread:
        is_new = True
        thread = ChatThread(id=payload.thread_id, workspace_id=workspace.id, title="New Chat")
        db.add(thread)
        db.commit()
    elif thread.title in ["New RAG Conversation", "New Chat"]:
        is_new = True

    if is_new:
        try:
            from langchain_openai import ChatOpenAI
            from langchain_core.messages import HumanMessage
            llm = ChatOpenAI(model="gpt-4o-mini", temperature=0.3)
            ai_title_res = llm.invoke([
                HumanMessage(content=f"Generate a strictly 2 to 4 word title summarizing this message: {payload.message}")
            ])
            ai_title = ai_title_res.content.strip().strip('"').strip("'")
            thread.title = ai_title
            db.commit()
        except:
            thread.title = payload.message[:35] + "..." if len(payload.message) > 35 else payload.message
            db.commit()

    # Log Human Message
    user_msg = ChatMessage(thread_id=thread.id, role="user", content=payload.message)
    db.add(user_msg)
    db.commit()
    
    # Manual retrieval block pulling LangGraph logic out of the execution layer
    from langchain_core.messages import HumanMessage
    from langchain_core.prompts import PromptTemplate
    from langchain_openai import ChatOpenAI
    from src.services.langgraph_orchestrator import retrieve_context
    from src.models.document import Document

    state = {
        "workspace_id": str(workspace.id),
        "messages": [HumanMessage(content=payload.message)],
        "context": "",
        "db": db
    }
    
    # Define the chunking output generator - yields bytes for immediate HTTP flush
    def generate_streaming_response():
        # Pre-fetch document layout for overlay display
        docs = db.query(Document.name).filter(Document.workspace_id == workspace.id).all()
        doc_names = ", ".join([d[0] for d in docs]) if docs else "Knowledge Base"
        
        # Yield SEARCHING signal padded to 512 bytes for immediate TCP flush
        searching_signal = f"[SYS:SEARCHING]{doc_names}|"
        yield (searching_signal + " " * max(0, 512 - len(searching_signal))).encode("utf-8")
        
        # Heavy retrieval executes here
        retrieved = retrieve_context(state)
        context_str = retrieved.get("context", "")
        sources = retrieved.get("sources", [])  # ordered list: index 1..N

        yield b"[SYS:FOUND]|"

        # Build a numbered context block so the LLM can reference sources by index
        # Each source gets ALL its retrieved text concatenated (not just first match)
        numbered_lines = []
        for i, src in enumerate(sources, start=1):
            src_base = src.split(" \u2022 ")[0]  # e.g. "resume.pdf"
            blocks_for_src = [
                block.split("| Text:")[-1].strip() if "| Text:" in block else block
                for block in context_str.split("\n\n")
                if src_base in block
            ]
            combined_text = " [...] ".join(blocks_for_src)[:3000]
            if combined_text:
                numbered_lines.append(f"[{i}] {src_base}: {combined_text}")

        numbered_context = "\n".join(numbered_lines) if numbered_lines else context_str

        # Instruct the LLM to cite by number — appended AFTER the answer
        system_prompt = (
            "You are an intelligent document assistant. Answer the question using ONLY the numbered sources below.\n"
            "If the sources don't contain the answer, say so clearly.\n"
            "CRITICAL RULES:\n"
            "1. Pay close attention to specific dates, fiscal periods, and time references in the question. "
            "Only use figures from the EXACT date or period asked — never substitute data from a different date.\n"
            "2. Each source is labeled with its filename. If the question asks about a specific company, "
            "use ONLY sources from that company's document. Ignore data from other companies' documents.\n"
            "3. Do not use your training knowledge — answer strictly from the sources provided.\n"
            "At the very END of your complete answer, on a new line, output exactly:\n"
            "[[USED:comma-separated-source-numbers-you-actually-used]] or [[USED:NONE]] if none helped.\n"
            "Example: [[USED:1,3]]\n\n"
            f"Sources:\n{numbered_context}\n\n"
            f"Question: {payload.message}\n\nAnswer:"
        )

        llm = ChatOpenAI(model="gpt-4o", temperature=0.0, streaming=True)
        
        full_response = ""
        try:
            for chunk in llm.stream([HumanMessage(content=system_prompt)]):
                token = chunk.content
                if token:
                    full_response += token
                    yield token.encode("utf-8")

        except Exception as e:
            yield f"\n[Stream Error: {e}]".encode("utf-8")

        # --- Post-stream source resolution ---
        import re
        used_marker_match = re.search(r'\[\[USED:(.*?)\]\]', full_response)
        relevant_sources = []

        if used_marker_match:
            used_str = used_marker_match.group(1).strip()
            if used_str != "NONE":
                try:
                    used_indices = [int(x.strip()) for x in used_str.split(",") if x.strip().isdigit()]
                    relevant_sources = [
                        sources[i - 1] for i in used_indices
                        if 1 <= i <= len(sources)
                    ]
                except:
                    pass

        if relevant_sources:
            sources_str = f"|SOURCES:{','.join(relevant_sources)}|"
            full_response += sources_str
            yield sources_str.encode("utf-8")

        # Persist to DB — strip the [[USED:...]] marker from stored content
        clean_stored = re.sub(r'\s*\[\[USED:.*?\]\]', '', full_response).strip()
        sys_msg = ChatMessage(thread_id=thread.id, role="assistant", content=clean_stored)
        db.add(sys_msg)
        db.commit()

    from fastapi.responses import StreamingResponse
    return StreamingResponse(generate_streaming_response(), media_type="text/plain; charset=utf-8")
