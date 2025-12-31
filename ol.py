#!/usr/bin/env python3
"""
Send a chat request to a local Ollama server using model "llama3.1:8b"
with both a system prompt and a user prompt.

Requires: requests
  pip install requests
"""

import json
import sys
import requests


OLLAMA_URL = "http://localhost:11434/api/chat"
MODEL = "llama3.1:8b"


def chat(system_prompt: str, user_prompt: str, stream: bool = False) -> str:
    payload = {
        "model": MODEL,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        "stream": stream,
    }

    resp = requests.post(OLLAMA_URL, json=payload, timeout=300)
    resp.raise_for_status()

    # Non-streaming response is a single JSON object.
    if not stream:
        data = resp.json()
        return data["message"]["content"]

    # Streaming response is NDJSON (one JSON object per line).
    out_chunks = []
    for line in resp.iter_lines(decode_unicode=True):
        if not line:
            continue
        obj = json.loads(line)
        if "message" in obj and "content" in obj["message"]:
            chunk = obj["message"]["content"]
            out_chunks.append(chunk)
            print(chunk, end="", flush=True)
        if obj.get("done"):
            break
    print()
    return "".join(out_chunks)


def main():
    system_prompt = """You are given a single algebraic rewrite rule written in a low-level DSL.

Your task is to summarize the rule as one short English action phrase, using the known verbs, entities, focus, and properties, but without labels.

Do not:
	•	restate the rule,
	•	explain mechanics,
	•	mention variables or DSL syntax.

The output should read like a human planning step.

⸻

Allowed vocabulary (implicit)
	•	Verbs: normalize, collect, expand, factor, move, isolate, eliminate, reduce, classify, substitute, split, evaluate, check, finish, reframe
	•	Entities: equation, expression, term, factor, fraction, constant, variable, etc.
	•	Focus & props: left/right side, constant, variable term, denominator, common factor, even, matching pattern, etc.

⸻

Output format

Write one short sentence fragment, imperative mood.

Examples of good outputs:
	•	“move constant term from left to right”
	•	“factor out the common expression”
	•	“eliminate the denominator”
	•	“collect like terms”
	•	“expand the product”
	•	“isolate the variable”
	•	“evaluate the numeric sum”
	•	“split into cases”
	•	“check candidate solutions”

⸻

Example

Input rule

eq(sum(?t, ?c), 0) => eq(?t, neg(?c))

Output

move constant term from left to right

⸻

Guidance
	•	Prefer what a human would say while solving on paper.
	•	Keep it short; omit articles if natural.
	•	If multiple phrasings fit, choose the most generic one."""

    # user_prompt = "eq(sum(?lhs, neg(?rhs)), 0) => eq(mul(sym(?x), ?a), number(?c)), 0) where is_number(?a), is_number(?c)"
    user_prompt = "eq(sum(?x, ?a), neg(?c)) => eq(?x, div(neg(?c) / ?a)"

    # Optional CLI usage:
    #   python ollama_chat.py "SYSTEM..." "USER..."
    if len(sys.argv) >= 3:
        system_prompt = sys.argv[1]
        user_prompt = sys.argv[2]

    answer = chat(system_prompt, user_prompt, stream=False)
    print(answer)


if __name__ == "__main__":
    main()