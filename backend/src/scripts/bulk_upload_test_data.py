import os
import sys
import glob
import time
import requests
from pathlib import Path

# Fix python path
sys.path.append(str(Path(__file__).resolve().parents[2]))

DATA_DIR = Path(__file__).parent.parent.parent / "data"
API_BASE = os.environ.get("RAG_API_BASE", "http://localhost:8000/api/v1")

def authenticate():
    print("Testing Authentication...")
    res = requests.post(f"{API_BASE}/auth/login", json={
        "email": "test-evaluator@loomind.ai",
        "name": "Eval Bot"
    })
    res.raise_for_status()
    data = res.json()
    return data["workspace_id"], data["access_token"]

def upload_documents():
    workspace_id, token = authenticate()
    headers = {"Authorization": f"Bearer {token}"}
    
    pdf_files = list(DATA_DIR.glob("*.pdf"))
    if not pdf_files:
        print(f"No PDFs found in {DATA_DIR}")
        return

    print(f"Found {len(pdf_files)} PDFs. Proceeding with bulk upload.")

    for file_path in pdf_files:
        print(f"Uploading {file_path.name}...")
        with open(file_path, "rb") as f:
            files = {"file": (file_path.name, f, "application/pdf")}
            data = {"workspace_id": workspace_id}
            
            res = requests.post(
                f"{API_BASE}/documents/upload", 
                headers=headers,
                files=files,
                data=data
            )
            
            if res.status_code == 201:
                print(f"  Successfully uploaded {file_path.name}")
            else:
                print(f"  Failed to upload {file_path.name}: {res.text}")

        # Sleep briefly to avoid slamming the local ingestion queue
        time.sleep(1)
        
    print("All documents uploaded and queued for processing. Wait ~1 minute for chunking to complete.")
    return workspace_id, token

if __name__ == "__main__":
    upload_documents()
