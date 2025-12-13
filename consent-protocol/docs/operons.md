# ⚙️ Writing Operons for Personal Data Agents (PDAs)

In HushhMCP, **operons** are the core building blocks of agent intelligence. They’re small, modular, testable functions that agents can call to perform permissioned tasks.

Think of them like *plugins for behavior* — compact pieces of logic that can be reused, remixed, or extended across multiple agents.

---

## 🧠 What is an Operon?

> An **operon** is a Python function (or class) that performs a specific, scoped action — such as verifying an email, parsing a receipt, calculating a score, or summarizing content.

| Trait         | Description |
|---------------|-------------|
| Small         | Does one thing well |
| Reusable      | Designed to be called by any agent |
| Testable      | Should include unit tests |
| Scope-bound   | Should enforce consent before operating |

---

## 🛠 Operon Examples

| Operon Name       | What It Does |
|-------------------|--------------|
| `verify_user_email()` | Checks if an email address is valid |
| `summarize_text()`    | Summarizes a block of user-owned text |
| `extract_receipt_data()` | Parses receipt info from an image or PDF |
| `calculate_spending_trends()` | Analyzes user vault data for finance |
| `generate_reply()` | Auto-generates a response to a user message |

---

## 🗂 File Structure

All operons should live inside:

```

hushh\_mcp/
└── operons/
└── your\_operon\_name.py

```

For example:

```

hushh\_mcp/operons/verify\_email.py

````

---

## 📄 Operon Template

```python
# hushh_mcp/operons/your_operon.py

def your_operon(input_data: str) -> dict:
    """
    Describe what this operon does.

    Args:
        input_data (str): Description of input

    Returns:
        dict: Output result
    """
    # Your logic here
    return {"result": "success"}
````

---

## ✅ Operon Design Principles

1. **Do One Thing**
   Keep the function tightly scoped. One input, one output.

2. **Be Stateless**
   Don’t write to disk, don’t cache internally.

3. **Be Safe**
   Never perform actions that haven't been consented to by the user.

4. **Be Reusable**
   Any agent should be able to import and use your operon.

5. **Be Testable**
   Include a corresponding test in `tests/`.

---

## 🧪 Example: `verify_user_email`

```python
# hushh_mcp/operons/verify_email.py

import re

EMAIL_REGEX = re.compile(
    r"^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$"
)

def verify_user_email(email: str) -> bool:
    """
    Validates email format.
    """
    if not email or not isinstance(email, str):
        return False
    return EMAIL_REGEX.match(email) is not None
```

Used in:

```python
from hushh_mcp.operons.verify_email import verify_user_email
```

---

## 🏆 Hackathon Bonus

🔁 If your operon is:

* Modular
* Useful
* Reused across teams

→ You’ll be considered for special rewards like cash prizes, hushhIDs, and shoutouts in the global repo.

---

## 💡 Inspiration for Operons

* `summarize_text()`
* `translate_text()`
* `calculate_budget()`
* `parse_booking_confirmation()`
* `detect_fraudulent_charge()`
* `label_transaction_category()`

---

Build operons that empower other builders.
Make your logic modular and memorable.

—
Team Hushh
