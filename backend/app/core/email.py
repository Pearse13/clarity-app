"""Email functionality for the application."""
import logging
from typing import Dict
import random
import string

logger = logging.getLogger(__name__)

# Store verification codes (in-memory for now)
verification_codes: Dict[str, str] = {}

def generate_verification_code(length: int = 6) -> str:
    """Generate a random verification code."""
    return ''.join(random.choices(string.digits, k=length))

async def send_verification_email(email: str) -> bool:
    """Send a verification email (placeholder function)."""
    try:
        # Generate verification code
        code = generate_verification_code()
        verification_codes[email] = code
        
        # In a real application, we would send an email here
        logger.info(f"Would send verification code {code} to {email}")
        
        return True
    except Exception as e:
        logger.error(f"Error sending verification email: {str(e)}")
        return False

async def verify_code(email: str, code: str) -> bool:
    """Verify a verification code."""
    try:
        stored_code = verification_codes.get(email)
        if not stored_code:
            return False
            
        # Check if code matches
        is_valid = stored_code == code
        
        # Remove code after verification attempt
        if is_valid:
            del verification_codes[email]
            
        return is_valid
    except Exception as e:
        logger.error(f"Error verifying code: {str(e)}")
        return False 