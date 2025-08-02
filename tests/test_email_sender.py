import sys
import os

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from hushh_mcp.agents.email_sender import index

input_data = {
    "user_prompt": "Please send an event invitation.",
    "file_path": "C:/Users/Asus/AutoIntern/email.xlsx",
    "email_subject": "You're Invited!",
    "email_template": "Hi {name},\n\nYou are invited to our event.\n\nThanks,\nAlok"
}

response = index.run(input_data)
print(response)