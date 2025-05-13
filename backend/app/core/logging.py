"""Logging configuration for the application."""
import logging
import sys
from pathlib import Path

# Configure logging format
log_format = logging.Formatter(
    '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)

def setup_logger(name: str, log_file: str | None = None, level=logging.INFO) -> logging.Logger:
    """Set up a logger with optional file output."""
    logger = logging.getLogger(name)
    logger.setLevel(level)
    
    # Console handler
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setFormatter(log_format)
    logger.addHandler(console_handler)
    
    # File handler if log_file is specified
    if log_file:
        log_path = Path("logs")
        log_path.mkdir(exist_ok=True)
        
        file_handler = logging.FileHandler(log_path / log_file)
        file_handler.setFormatter(log_format)
        logger.addHandler(file_handler)
    
    return logger

# Create loggers
app_logger = setup_logger("app", "app.log")
security_logger = setup_logger("security", "security.log") 