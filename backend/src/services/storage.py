import os
import shutil
from pathlib import Path

UPLOADS_DIR = Path(os.getenv("UPLOADS_DIR", "/app/uploads"))


def _blob_path(workspace_id: str, document_id: str, filename: str) -> Path:
    return UPLOADS_DIR / "workspaces" / workspace_id / document_id / filename


def upload_file(workspace_id: str, document_id: str, filename: str, file_bytes: bytes) -> str:
    """Write file bytes to persistent local storage. Returns the local path as URI."""
    dest = _blob_path(workspace_id, document_id, filename)
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_bytes(file_bytes)
    return str(dest)


def download_file_to_temp(workspace_id: str, document_id: str, filename: str, local_path: str):
    """Copy the stored file to a temp path for processing."""
    src = _blob_path(workspace_id, document_id, filename)
    shutil.copy2(str(src), local_path)
