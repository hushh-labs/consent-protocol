# hushh_mcp/operons/verify_email.py

import re

EMAIL_REGEX = re.compile(
    r"^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$"
)

def verify_user_email(email: str) -> bool:
    """
    Checks whether the provided email address is valid in format.

    Args:
        email (str): The email address to validate.

    Returns:
        bool: True if valid, False otherwise.
    """
    if not email or not isinstance(email, str):
        return False

    return EMAIL_REGEX.match(email) is not None
