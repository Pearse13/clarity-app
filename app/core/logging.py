import logging
import json
from datetime import datetime
from typing import Dict, Any
from pathlib import Path

# Configure logging
log_dir = Path("logs")
log_dir.mkdir(exist_ok=True)

# Application logger
app_logger = logging.getLogger("clarity_app")
app_logger.setLevel(logging.INFO)

# Create handlers
file_handler = logging.FileHandler(log_dir / "app.log")
console_handler = logging.StreamHandler()

# Create formatters and add it to handlers
log_format = logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s')
file_handler.setFormatter(log_format)
console_handler.setFormatter(log_format)

# Add handlers to the logger
app_logger.addHandler(file_handler)
app_logger.addHandler(console_handler)

class SecurityLogger:
    def __init__(self):
        self.logger = logging.getLogger("clarity_security")
        self.logger.setLevel(logging.INFO)
        
        # Security events log file
        security_handler = logging.FileHandler(log_dir / "security.log")
        security_handler.setFormatter(log_format)
        self.logger.addHandler(security_handler)
    
    def log_request(self, request_data: Dict[str, Any], status_code: int):
        """Log detailed request information"""
        log_entry = {
            "timestamp": datetime.now().isoformat(),
            "ip": request_data.get("client_host"),
            "method": request_data.get("method"),
            "path": request_data.get("path"),
            "status_code": status_code,
            "user_agent": request_data.get("user_agent")
        }
        self.logger.info(f"Request: {json.dumps(log_entry)}")
    
    def log_security_event(self, event_type: str, details: Dict[str, Any]):
        """Log security-related events"""
        log_entry = {
            "timestamp": datetime.now().isoformat(),
            "event_type": event_type,
            **details
        }
        self.logger.warning(f"Security Event: {json.dumps(log_entry)}")

# Global security logger instance
security_logger = SecurityLogger() 