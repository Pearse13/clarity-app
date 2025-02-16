import smtplib
import random
import string
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from datetime import datetime, timedelta
from typing import Dict
import os
from dotenv import load_dotenv

load_dotenv()

# Email configuration
EMAIL_HOST = os.getenv("EMAIL_HOST")
EMAIL_PORT = int(os.getenv("EMAIL_PORT", "587"))
EMAIL_USERNAME = os.getenv("EMAIL_USERNAME")
EMAIL_PASSWORD = os.getenv("EMAIL_PASSWORD")
EMAIL_FROM = os.getenv("EMAIL_FROM")

# Store verification codes with expiration (in memory for now, use database in production)
verification_codes: Dict[str, Dict] = {}

def generate_verification_code(length: int = 6) -> str:
    """Generate a random verification code."""
    return ''.join(random.choices(string.digits, k=length))

def store_verification_code(email: str, code: str, expiry_minutes: int = 10):
    """Store verification code with expiration time."""
    verification_codes[email] = {
        'code': code,
        'expires_at': datetime.now() + timedelta(minutes=expiry_minutes)
    }

def verify_code(email: str, code: str) -> bool:
    """Verify the code for the given email."""
    if email not in verification_codes:
        return False
    
    stored = verification_codes[email]
    if datetime.now() > stored['expires_at']:
        del verification_codes[email]
        return False
    
    if stored['code'] != code:
        return False
    
    # Code is valid - remove it so it can't be reused
    del verification_codes[email]
    return True

def send_verification_email(to_email: str) -> bool:
    """Send verification email with code."""
    try:
        code = generate_verification_code()
        store_verification_code(to_email, code)

        msg = MIMEMultipart()
        msg['From'] = EMAIL_FROM
        msg['To'] = to_email
        msg['Subject'] = "Your Clarity App Verification Code"

        body = f"""
        Welcome to Clarity App!
        
        Your verification code is: {code}
        
        This code will expire in 10 minutes.
        
        If you didn't request this code, please ignore this email.
        """
        msg.attach(MIMEText(body, 'plain'))

        server = smtplib.SMTP(EMAIL_HOST, EMAIL_PORT)
        server.starttls()
        server.login(EMAIL_USERNAME, EMAIL_PASSWORD)
        server.send_message(msg)
        server.quit()
        
        return True
    except Exception as e:
        print(f"Error sending email: {str(e)}")
        return False 