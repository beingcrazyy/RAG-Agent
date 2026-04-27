import os
import sys
import glob
import json
import random
from pathlib import Path
from dotenv import load_dotenv

# Fix python path
sys.path.append(str(Path(__file__).resolve().parents[2]))
load_dotenv(Path(__file__).resolve().parents[3] / ".env", override=True)

from langchain_community.document_loaders import PyPDFLoader
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.messages import HumanMessage

DATA_DIR = Path("../../data").resolve()
OUTPUT_FILE = Path("eval_dataset.json").resolve()

# We'll use Gemini to generate the Q&A dataset
llm = ChatGoogleGenerativeAI(model="gemini-2.5-flash", temperature=0.2)

PROMPT_TEMPLATE = """
You are an expert data annotator building an evaluation dataset for a RAG system.
I will provide you with a text chunk from a document named "{filename}".

Your task is to generate exactly 2 challenging questions based ONLY on this text.
1. A factual question (e.g., retrieving a specific number or fact).
2. A reasoning or summarization question (e.g., synthesizing multiple points).

For each question, provide the exact ground truth answer.

Format your output STRICTLY as a valid JSON array of objects, with no markdown formatting or extra text. Like this:
[
  {{
    "question": "What is the capital of France?",
    "ground_truth": "The capital of France is Paris.",
    "context": "Context snippet..."
  }}
]

Here is the chunk:
---
{chunk}
---
"""

def generate_dataset():
    pdf_files = list(DATA_DIR.glob("*.pdf"))
    if not pdf_files:
        print(f"No PDFs found in {DATA_DIR}")
        return

    dataset = []
    print(f"Found {len(pdf_files)} PDFs. Generating eval dataset...")

    for file_path in pdf_files:
        print(f"Processing {file_path.name}...")
        try:
            loader = PyPDFLoader(str(file_path))
            docs = loader.load()
            
            # Pick up to 3 random pages to generate questions from to save time and API quota
            if len(docs) > 3:
                sample_docs = random.sample(docs, 3)
            else:
                sample_docs = docs
                
            for doc in sample_docs:
                # Truncate if insanely long
                content = doc.page_content[:3000]
                if len(content.strip()) < 100:
                    continue # Skip empty pages
                
                try:
                    prompt = PROMPT_TEMPLATE.format(filename=file_path.name, chunk=content)
                    res = llm.invoke([HumanMessage(content=prompt)])
                    
                    # Clean up JSON response
                    raw = res.content.strip()
                    if raw.startswith("```json"):
                        raw = raw[7:-3].strip()
                    elif raw.startswith("```"):
                        raw = raw[3:-3].strip()
                        
                    parsed = json.loads(raw)
                    for item in parsed:
                        item["source_file"] = file_path.name
                        dataset.append(item)
                except Exception as e:
                    print(f"  Error parsing specific chunk from {file_path.name}: {e}")
        except Exception as e:
            print(f"Failed to process {file_path.name}: {e}")

    print(f"Generated {len(dataset)} QA pairs.")
    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(dataset, f, indent=2)
    print(f"Dataset securely written to {OUTPUT_FILE}")

if __name__ == "__main__":
    generate_dataset()
