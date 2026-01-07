import google.generativeai as genai
import os
from dotenv import load_dotenv

load_dotenv("consent-protocol/.env")
api_key = os.getenv("GOOGLE_API_KEY")
genai.configure(api_key=api_key)

with open("available_models.txt", "w") as f:
    for m in genai.list_models():
        if "generateContent" in m.supported_generation_methods:
            f.write(m.name + "\n")
