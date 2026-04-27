import os
import sys
import json
import time
import re
import uuid
import requests
from pathlib import Path
from dotenv import load_dotenv

# Fix python path and load env FIRST before any LLM imports
sys.path.append(str(Path(__file__).resolve().parents[2]))
load_dotenv(Path(__file__).resolve().parents[3] / ".env", override=True)

from langchain_openai import ChatOpenAI
from langchain_core.messages import HumanMessage

API_BASE = os.environ.get("RAG_API_BASE", "http://localhost:8000/api/v1")
DATASET_FILE = Path(__file__).parent / "eval_dataset.json"

# OpenAI GPT-4o-mini as the Judge (much higher rate limits, cheaper than Gemini paid tier)
judge_llm = ChatOpenAI(model="gpt-4o-mini", temperature=0.0)

EVAL_PROMPT = """
You are an expert RAG evaluator. Grade the AI response against the ground truth.

Question: {question}
Ground Truth: {ground_truth}
AI Response: {ai_response}

Output ONLY a valid JSON object with these exact three keys:
- "answer_relevance" (float 0.0 to 1.0): Does the response actually answer the question?
- "faithfulness" (float 0.0 to 1.0): Is it factually grounded in the ground truth? 1.0=perfect match, 0.0=hallucination.
- "reason": One sentence explanation.

JSON only, no markdown:
"""


def authenticate():
    res = requests.post(f"{API_BASE}/auth/login", json={
        "email": "test-evaluator@loomind.ai",
        "name": "Eval Bot"
    })
    res.raise_for_status()
    data = res.json()
    return data["workspace_id"], data["access_token"]


def parse_rag_response(raw: str) -> str:
    """Strip all backend control signals and return only the actual LLM answer."""
    # Everything before [SYS:FOUND] is the "Searching in..." overlay text — discard it
    if '[SYS:FOUND]' in raw:
        raw = raw.split('[SYS:FOUND]', 1)[1].lstrip('|')
    elif '[SYS:SEARCHING]' in raw:
        # Fallback: remove the whole searching block
        raw = re.sub(r'\[SYS:SEARCHING\].*?\[SYS:FOUND\]', '', raw, flags=re.DOTALL)

    # Remove [[USED:...]] citation markers
    clean = re.sub(r'\[\[USED:[^\]]*\]\]', '', raw)
    # Remove |SOURCES:...|  block (everything from the marker to end)
    clean = re.sub(r'\|SOURCES:.*', '', clean, flags=re.DOTALL)
    # Remove any remaining [SYS:...] markers
    clean = re.sub(r'\[SYS:[^\]]*\]', '', clean)
    # Collapse excess whitespace
    clean = '\n'.join(line for line in clean.splitlines() if line.strip())
    return clean.strip()


def query_rag(workspace_id, token, thread_id, question):
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }
    payload = {
        "workspace_id": workspace_id,
        "thread_id": thread_id,
        "message": question
    }

    start_time = time.time()
    response_text = ""

    try:
        with requests.post(f"{API_BASE}/chat", headers=headers, json=payload, stream=True, timeout=90) as r:
            r.raise_for_status()
            for chunk in r.iter_content(chunk_size=None, decode_unicode=True):
                if chunk:
                    response_text += chunk
    except Exception as e:
        return f"[RAG ERROR: {e}]", time.time() - start_time

    latency = time.time() - start_time
    return parse_rag_response(response_text), latency


def grade_with_retry(prompt: str, retries: int = 3) -> dict:
    """Call the judge LLM with exponential backoff on rate limit."""
    for attempt in range(retries):
        try:
            grade_res = judge_llm.invoke([HumanMessage(content=prompt)]).content.strip()
            # Strip markdown fences if present
            if grade_res.startswith("```json"):
                grade_res = grade_res[7:-3].strip()
            elif grade_res.startswith("```"):
                grade_res = grade_res[3:-3].strip()
            return json.loads(grade_res)
        except Exception as e:
            wait = 15 * (attempt + 1)
            print(f"  Judge error (attempt {attempt+1}): {e}. Retrying in {wait}s...")
            time.sleep(wait)
    return {"answer_relevance": 0.0, "faithfulness": 0.0, "reason": "Judge failed after retries"}


def evaluate_dataset():
    if not DATASET_FILE.exists():
        print(f"Error: {DATASET_FILE} not found. Run generate_eval_dataset.py first.")
        return

    with open(DATASET_FILE, "r") as f:
        dataset = json.load(f)

    workspace_id, token = authenticate()

    results = []
    print(f"Loaded {len(dataset)} evaluation questions.\n")

    for idx, item in enumerate(dataset):
        thread_id = str(uuid.uuid4())
        question = item['question']
        ground_truth = item['ground_truth']

        print(f"[{idx+1}/{len(dataset)}] {question[:90]}")

        ai_response, latency = query_rag(workspace_id, token, thread_id, question)
        print(f"  Latency: {latency:.2f}s")
        print(f"  Response: {ai_response[:120]}...")

        prompt = EVAL_PROMPT.format(
            question=question,
            ground_truth=ground_truth,
            ai_response=ai_response
        )

        grade = grade_with_retry(prompt)
        relevance = grade.get("answer_relevance", 0.0)
        faithfulness = grade.get("faithfulness", 0.0)
        print(f"  Relevance: {relevance:.2f} | Faithfulness: {faithfulness:.2f} | {grade.get('reason', '')}")

        results.append({
            "question": question,
            "ground_truth": ground_truth,
            "ai_response": ai_response,
            "latency_s": round(latency, 2),
            "answer_relevance": relevance,
            "faithfulness": faithfulness,
            "judge_reason": grade.get("reason", "")
        })

        # Stay safely under the 60/minute rate limit
        time.sleep(1.5)

    if not results:
        print("No results computed.")
        return

    avg_rel = sum(r['answer_relevance'] for r in results) / len(results)
    avg_faith = sum(r['faithfulness'] for r in results) / len(results)
    avg_latency = sum(r['latency_s'] for r in results) / len(results)

    # Find worst performers for targeted improvement
    worst = sorted(results, key=lambda x: x['answer_relevance'])[:5]

    print("\n" + "=" * 50)
    print("         LOOMIND RAG EVALUATION REPORT")
    print("=" * 50)
    print(f"  Questions Evaluated : {len(results)}")
    print(f"  Answer Relevance    : {avg_rel:.2f} / 1.00")
    print(f"  Faithfulness        : {avg_faith:.2f} / 1.00")
    print(f"  Avg Latency         : {avg_latency:.2f}s")
    print("\n  ⚠ Top 3 Worst-Performing Questions:")
    for i, w in enumerate(worst[:3]):
        print(f"    {i+1}. [{w['answer_relevance']:.2f}] {w['question'][:80]}")
        print(f"       Reason: {w['judge_reason']}")
    print("=" * 50)

    output_path = Path("eval_results_report.json").resolve()
    with open(output_path, "w") as f:
        json.dump({
            "summary": {
                "total": len(results),
                "answer_relevance": round(avg_rel, 3),
                "faithfulness": round(avg_faith, 3),
                "avg_latency_s": round(avg_latency, 2)
            },
            "evaluations": results
        }, f, indent=2)
    print(f"\n  Full report saved to: {output_path}")


if __name__ == "__main__":
    evaluate_dataset()
