import requests
import time
import os

# To use this locally, put your actual Gemini API Key here or export it into your bash vars!
if not os.environ.get("GOOGLE_API_KEY"):
    print("WARNING: GOOGLE_API_KEY is not set. The LLM extraction heavily relies on it.")

API_BASE = "http://localhost:8000/api/v1"
HEADERS = {"Authorization": "Bearer mock-token"}

def run_test():
    print("--- 1. Verification ---")
    res = requests.get("http://localhost:8000/health")
    if res.status_code != 200:
        print("Backend is offline. Start the docker containers first!")
        return
    print("Backend hit successfully.")

    # 2. Creating Workspace & Documents bypasses UI workflows
    # Normally this is done via Frontend. We will just use the API.
    print("--- 2. To test the ingestion fully, you must construct the DB via alembic first ---")
    print("Run `docker compose exec backend alembic revision --autogenerate -m 'init'`")
    print("Run `docker compose exec backend alembic upgrade head`")
    
    print("\nIf tables exist, you can hit the API like so:")
    print('''
    # 1. Create Document (Mock a workspace UUID in your DB first to foreign-key to)
    # 2. Upload "test.pdf" to localhost:4443
    # 3. Post to /api/v1/documents/{id}/process
    # 4. Prompt the local brain:
    import requests
    requests.post("http://localhost:8000/api/v1/chat/", json={
        "workspace_id": "<WORKSPACE_UUID>",
        "thread_id": "123e4567-e89b-12d3-a456-426614174000",
        "message": "What is the summary of the document uploaded?"
    }, headers={"Authorization": "Bearer mock-token"})
    ''')

if __name__ == "__main__":
    run_test()
