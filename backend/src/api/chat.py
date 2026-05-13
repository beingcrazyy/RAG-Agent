from fastapi import APIRouter, Depends, HTTPException, Request
from slowapi import Limiter
from slowapi.util import get_remote_address
from sqlalchemy.orm import Session
from src.db.session import get_db
from src.core.security import get_current_user, get_token_payload
from src.models.workspace import User, Workspace
from src.models.chat import ChatThread, ChatMessage
from src.models.enterprise import Enterprise, QueryLog, TokenUsageLog
from src.services.langgraph_orchestrator import rag_chain
from pydantic import BaseModel
from langchain_core.messages import HumanMessage
import uuid as _uuid

router = APIRouter()
limiter = Limiter(key_func=get_remote_address)


def get_llm_for_enterprise(enterprise, db):
    """Get LLM instance based on enterprise's LLM configuration."""
    from langchain_openai import AzureChatOpenAI, OpenAI

    if not enterprise or not enterprise.llm_provider:
        # Fall back to default Azure config
        from src.core.config import settings as _az
        return AzureChatOpenAI(
            azure_deployment=_az.AZURE_OPENAI_DEPLOYMENT,
            azure_endpoint=_az.AZURE_OPENAI_ENDPOINT,
            api_key=_az.AZURE_OPENAI_API_KEY,
            api_version=_az.AZURE_OPENAI_API_VERSION,
            temperature=0.3,
        )

    provider = enterprise.llm_provider
    api_key = enterprise.llm_api_key

    # Fall back to workspace credentials if no API key set at enterprise level
    if not api_key:
        from src.models.workspace import ProviderCredential
        creds = db.query(ProviderCredential).filter(
            ProviderCredential.workspace_id == enterprise.workspace_id
        ).first()
        if creds:
            api_key = creds.encrypted_api_key

    if not api_key:
        # Fall back to default config
        from src.core.config import settings as _az
        return AzureChatOpenAI(
            azure_deployment=_az.AZURE_OPENAI_DEPLOYMENT,
            azure_endpoint=_az.AZURE_OPENAI_ENDPOINT,
            api_key=_az.AZURE_OPENAI_API_KEY,
            api_version=_az.AZURE_OPENAI_API_VERSION,
            temperature=0.3,
        )

    if provider == "azure_openai":
        return AzureChatOpenAI(
            azure_deployment=enterprise.llm_deployment or enterprise.llm_model,
            azure_endpoint=enterprise.llm_endpoint,
            api_key=api_key,
            api_version=enterprise.llm_api_version or "2024-12-01-preview",
            temperature=0.3,
        )
    elif provider == "openai":
        from langchain_openai import ChatOpenAI
        return ChatOpenAI(model=enterprise.llm_model, api_key=api_key, temperature=0.3)
    elif provider == "anthropic":
        # Anthropic - use direct SDK, wrap for langchain interface
        try:
            from langchain_anthropic import ChatAnthropic
            return ChatAnthropic(model=enterprise.llm_model, anthropic_api_key=api_key)
        except ImportError:
            # Fallback to Azure if Anthropic not available
            from src.core.config import settings as _az
            return AzureChatOpenAI(
                azure_deployment=_az.AZURE_OPENAI_DEPLOYMENT,
                azure_endpoint=_az.AZURE_OPENAI_ENDPOINT,
                api_key=_az.AZURE_OPENAI_API_KEY,
                api_version=_az.AZURE_OPENAI_API_VERSION,
                temperature=0.3,
            )
    elif provider == "gemini":
        try:
            from langchain_google_genai import ChatGoogleGenerativeAI
            return ChatGoogleGenerativeAI(model=enterprise.llm_model, api_key=api_key)
        except ImportError:
            # Fallback to Azure if Gemini not available
            from src.core.config import settings as _az
            return AzureChatOpenAI(
                azure_deployment=_az.AZURE_OPENAI_DEPLOYMENT,
                azure_endpoint=_az.AZURE_OPENAI_ENDPOINT,
                api_key=_az.AZURE_OPENAI_API_KEY,
                api_version=_az.AZURE_OPENAI_API_VERSION,
                temperature=0.3,
            )
    else:
        # Default fallback
        from src.core.config import settings as _az
        return AzureChatOpenAI(
            azure_deployment=_az.AZURE_OPENAI_DEPLOYMENT,
            azure_endpoint=_az.AZURE_OPENAI_ENDPOINT,
            api_key=_az.AZURE_OPENAI_API_KEY,
            api_version=_az.AZURE_OPENAI_API_VERSION,
            temperature=0.3,
        )

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
    thread = ChatThread(id=str(uuid.uuid4()), workspace_id=workspace_id, user_id=current_user.id, title="New Chat")
    db.add(thread)
    db.commit()
    return {"id": str(thread.id), "title": thread.title}

@router.get("/threads")
def list_threads(
    workspace_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Each user only sees their own threads
    threads = db.query(ChatThread).filter(
        ChatThread.workspace_id == workspace_id,
        ChatThread.user_id == current_user.id,
    ).order_by(ChatThread.created_at.desc()).limit(20).all()
    return [{"id": str(t.id), "title": t.title, "date": "Recent"} for t in threads]

@router.get("/{thread_id}/messages")
def get_historical_chat_context(
    thread_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    thread = db.query(ChatThread).filter(ChatThread.id == thread_id).first()
    if not thread:
        raise HTTPException(status_code=404, detail="Thread not found")
    if thread.user_id and thread.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not your thread")
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
    if thread.user_id and thread.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not your thread")

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
    if thread.user_id and thread.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not your thread")

    thread.title = payload.title
    db.commit()
    return {"id": thread.id, "title": thread.title}

@router.post("/", status_code=201)
@limiter.limit("60/minute")
def chat_with_rag(
    request: Request,
    payload: ChatRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    token_payload: dict = Depends(get_token_payload),
):
    # Verify workspace matches the enterprise workspace in the JWT
    token_ws = token_payload.get("workspace_id")
    if token_ws and str(payload.workspace_id) != str(token_ws):
        raise HTTPException(status_code=403, detail="Workspace access denied")

    workspace = db.query(Workspace).filter(Workspace.id == payload.workspace_id).first()
    if not workspace:
        raise HTTPException(status_code=404, detail="Workspace not found")

    # Load enterprise for system_prompt and llm_model
    enterprise_id = token_payload.get("enterprise_id")
    enterprise = db.query(Enterprise).filter(Enterprise.id == enterprise_id).first() if enterprise_id else None
        
    thread = db.query(ChatThread).filter(ChatThread.id == payload.thread_id).first()
    
    # Check if thread is dynamically new
    is_new = False
    if not thread:
        is_new = True
        thread = ChatThread(id=payload.thread_id, workspace_id=workspace.id, user_id=current_user.id, title="New Chat")
        db.add(thread)
        db.commit()
    elif thread.title in ["New RAG Conversation", "New Chat"]:
        is_new = True

    # Ownership: only thread owner may post (admins also need their own threads)
    if thread.user_id and thread.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not your thread")
    if not thread.user_id:
        thread.user_id = current_user.id
        db.commit()

    if is_new:
        try:
            from langchain_core.messages import HumanMessage
            llm = get_llm_for_enterprise(enterprise, db)
            # For title generation, use a simpler model if available
            if enterprise and enterprise.llm_provider == "openai":
                llm.model = "gpt-4o-mini"
            elif enterprise and enterprise.llm_provider == "anthropic":
                llm.model = "claude-haiku-4-5-20251001"
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
    from langchain_openai import AzureChatOpenAI
    from src.core.config import settings as _az
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

        # Build a numbered context block — O(N) grouping by source
        blocks_by_src: dict[str, list[str]] = {}
        for block in context_str.split("\n\n"):
            if not block.strip():
                continue
            text_part = block.split("| Text:")[-1].strip() if "| Text:" in block else block
            for src in sources:
                src_base = src.split(" \u2022 ")[0]
                if src_base in block:
                    blocks_by_src.setdefault(src_base, []).append(text_part)
                    break

        numbered_lines = []
        for i, src in enumerate(sources, start=1):
            src_base = src.split(" \u2022 ")[0]
            parts = blocks_by_src.get(src_base, [])
            combined_text = " [...] ".join(parts)[:2500]
            if combined_text:
                numbered_lines.append(f"[{i}] {src_base}: {combined_text}")

        numbered_context = "\n".join(numbered_lines) if numbered_lines else context_str

        # Instruct the LLM to cite by number — appended AFTER the answer
        org_persona = ""
        if enterprise and enterprise.system_prompt:
            org_persona = f"ORGANISATION INSTRUCTIONS: {enterprise.system_prompt}\n"

        # Pull recent conversation history for context (last 8 turns max)
        prior_msgs = (
            db.query(ChatMessage)
            .filter(ChatMessage.thread_id == thread.id, ChatMessage.id != user_msg.id)
            .order_by(ChatMessage.created_at.desc())
            .limit(8)
            .all()
        )
        prior_msgs.reverse()
        history_block = ""
        if prior_msgs:
            lines = []
            for m in prior_msgs:
                speaker = "User" if m.role == "user" else "Assistant"
                # strip any [[USED:...]] markers and trailing |SOURCES:...|
                import re as _re_h
                clean = _re_h.sub(r'\s*\[\[USED:.*?\]\]', '', m.content)
                clean = _re_h.sub(r'\|SOURCES:.*?\|', '', clean).strip()
                lines.append(f"{speaker}: {clean[:600]}")
            history_block = "Conversation so far:\n" + "\n".join(lines) + "\n\n"

        system_prompt = (
            f"{org_persona}"
            "You are a friendly, conversational AI assistant for the user's company knowledge base.\n"
            "Answer naturally — like a helpful colleague — using ONLY the numbered sources below.\n"
            "If the sources don't contain the answer, say so politely and suggest what info would help.\n\n"
            "STYLE:\n"
            "- Conversational tone. Acknowledge follow-ups (\"Sure\", \"Good question\", \"Building on that...\") when natural.\n"
            "- Default length: 4-8 sentences. For 'analyze', 'explain', 'compare', 'walk me through', use up to 12 sentences with bullet points or short paragraphs.\n"
            "- Use bullet points for lists, numbers, or comparisons when it improves clarity.\n"
            "- Reference the conversation history when the user says 'it', 'that', 'the previous one', etc.\n"
            "FACTS:\n"
            "- Use exact figures, dates, and names from the sources.\n"
            "- If the question targets a specific company/period, only use sources matching it.\n"
            "- Do not use external/training knowledge — only the sources.\n\n"
            "At the END of your answer, on a new line, output exactly:\n"
            "[[USED:comma-separated-source-numbers]] or [[USED:NONE]]\n\n"
            f"Sources:\n{numbered_context}\n\n"
            f"{history_block}"
            f"Current user question: {payload.message}\n\nAnswer:"
        )

        # Enterprise can pick from preset models; fall back to platform default
        llm = get_llm_for_enterprise(enterprise, db)
        # Set streaming and max_tokens for all providers
        llm.streaming = True
        if hasattr(llm, 'max_tokens'):
            llm.max_tokens = 1200

        full_response = ""
        try:
            for chunk in llm.stream([HumanMessage(content=system_prompt)]):
                token = chunk.content if hasattr(chunk, 'content') else str(chunk)
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

        # Log query + token usage for enterprise analytics
        if enterprise_id:
            try:
                db.add(QueryLog(
                    id=_uuid.uuid4(),
                    enterprise_id=enterprise_id,
                    user_id=current_user.id,
                    query_text=payload.message[:500],
                ))
                db.add(TokenUsageLog(
                    id=_uuid.uuid4(),
                    enterprise_id=enterprise_id,
                    user_id=current_user.id,
                    tokens_in=len(numbered_context) // 4,
                    tokens_out=len(clean_stored) // 4,
                    model=model_name,
                ))
            except Exception:
                pass  # never let logging break the chat response

        db.commit()

    from fastapi.responses import StreamingResponse
    return StreamingResponse(generate_streaming_response(), media_type="text/plain; charset=utf-8")


class FollowUpRequest(BaseModel):
    workspace_id: str
    thread_id: str
    last_user_message: str
    last_assistant_response: str


@router.post("/follow-up-questions")
def generate_follow_up_questions(
    payload: FollowUpRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    token_payload: dict = Depends(get_token_payload),
):
    """Generate follow-up questions based on the last user message and assistant response."""
    from langchain_openai import AzureChatOpenAI
    from langchain_core.messages import HumanMessage
    from src.core.config import settings as _az

    try:
        llm = AzureChatOpenAI(
            azure_deployment=_az.AZURE_OPENAI_DEPLOYMENT,
            azure_endpoint=_az.AZURE_OPENAI_ENDPOINT,
            api_key=_az.AZURE_OPENAI_API_KEY,
            api_version=_az.AZURE_OPENAI_API_VERSION,
            temperature=0.7,
        )

        prompt = f"""Based on this conversation:
User asked: {payload.last_user_message}
Assistant answered: {payload.last_assistant_response[:500]}

Generate 3 natural follow-up questions that the user might want to ask next.
Return ONLY a JSON array with exactly 3 questions, nothing else.
Example format: ["question 1", "question 2", "question 3"]"""

        result = llm.invoke([HumanMessage(content=prompt)])
        content = result.content.strip()

        # Parse JSON array from response
        import json
        import re
        match = re.search(r'\[.*\]', content, re.DOTALL)
        if match:
            questions = json.loads(match.group())
            if isinstance(questions, list) and len(questions) > 0:
                return {"follow_up_questions": questions[:3]}

        return {"follow_up_questions": []}
    except Exception as e:
        return {"follow_up_questions": []}
