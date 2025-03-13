"""Security middleware for the application."""
from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import Response
import logging
from .rate_limit import rate_limiter

logger = logging.getLogger(__name__)

class SecurityMiddleware(BaseHTTPMiddleware):
    """Middleware for handling security concerns."""
    
    async def dispatch(self, request: Request, call_next):
        """Process the request and apply security measures."""
        try:
            # Get client IP
            client_ip = request.client.host if request.client else "unknown"
            
            # Check rate limit
            if not rate_limiter.is_allowed(client_ip):
                logger.warning(f"Rate limit exceeded for IP: {client_ip}")
                return Response(
                    content="Rate limit exceeded",
                    status_code=429
                )
            
            # Add security headers
            response = await call_next(request)
            
            # Set security headers
            response.headers["X-Content-Type-Options"] = "nosniff"
            response.headers["X-Frame-Options"] = "DENY"
            response.headers["X-XSS-Protection"] = "1; mode=block"
            response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
            
            return response
            
        except Exception as e:
            logger.error(f"Error in security middleware: {str(e)}")
            return Response(
                content="Internal server error",
                status_code=500
            ) 