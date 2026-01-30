#!/usr/bin/env python3
"""
List available Gemini models and save to file.
Uses google.generativeai SDK (deprecated but still works).
"""

import google.generativeai as genai
import os
from dotenv import load_dotenv

load_dotenv("consent-protocol/.env")
api_key = os.getenv("GOOGLE_API_KEY")

if not api_key:
    print("ERROR: GOOGLE_API_KEY not found in environment")
    exit(1)

genai.configure(api_key=api_key)

# Get repo root (parent of scripts/)
import pathlib
repo_root = pathlib.Path(__file__).parent.parent
config_file = repo_root / "config" / "available_models.txt"

with open(config_file, "w") as f:
    for m in genai.list_models():
        if "generateContent" in m.supported_generation_methods:
            f.write(m.name + "\n")

print(f"Models saved to {config_file}")

# Also print Gemini 3 Flash models specifically
print("\nGemini 3 Flash models available:")
for m in genai.list_models():
    if 'gemini-3' in m.name.lower() and 'flash' in m.name.lower():
        print(f"  - {m.name}")
