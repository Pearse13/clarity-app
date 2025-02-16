from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware
from typing import Dict, Optional
import re
from .logging import security_logger
from .config import settings

class SecurityMiddleware(BaseHTTPMiddleware):
    def __init__(self, app, max_content_length: int = 1024 * 1024):  # 1MB default
        super().__init__(app)
        self.max_content_length = max_content_length
        # Regex for basic XSS pattern detection
        self.xss_pattern = re.compile(r"<script|javascript:|data:|vbscript:", re.IGNORECASE)
        
    async def set_security_headers(self, response: Response, request: Request):
        """Set security headers for all responses"""
        origin = request.headers.get("Origin")
        
        # Set CORS headers if origin is allowed
        if origin in settings.cors_origins:
            response.headers["Access-Control-Allow-Origin"] = origin
            response.headers["Access-Control-Allow-Credentials"] = "true"
            response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, OPTIONS"
            response.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization, X-API-Key"
        
        # Set security headers
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
        response.headers["Content-Security-Policy"] = "default-src 'self'; connect-src 'self' https://dev-8utndajax3l877vt.us.auth0.com; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        
    def sanitize_input(self, data: Dict) -> Optional[str]:
        """Check for potentially malicious input"""
        if isinstance(data, dict):
            for key, value in data.items():
                if isinstance(value, str):
                    if self.xss_pattern.search(value):
                        return f"Potential XSS detected in field: {key}"
                    if len(value) > 10000:  # Max field length
                        return f"Field too long: {key}"
        return None
        
    async def dispatch(self, request: Request, call_next):
        # Handle preflight requests
        if request.method == "OPTIONS":
            response = Response()
            await self.set_security_headers(response, request)
            return response
            
        # Check content length for non-OPTIONS requests
        if request.method != "OPTIONS":
            content_length = request.headers.get("content-length", 0)
            if int(content_length or 0) > self.max_content_length:
                security_logger.log_security_event("content_length_exceeded", {
                    "content_length": content_length,
                    "max_allowed": self.max_content_length
                })
                return Response(
                    content="Request too large",
                    status_code=413
                )
            
            # Validate request body for POST/PUT/PATCH
            if request.method in ["POST", "PUT", "PATCH"]:
                try:
                    body = await request.json()
                    error = self.sanitize_input(body)
                    if error:
                        security_logger.log_security_event("input_validation_failed", {
                            "error": error,
                            "client_host": request.client.host
                        })
                        return Response(
                            content=error,
                            status_code=400
                        )
                except Exception as e:
                    security_logger.log_security_event("request_parsing_failed", {
                        "error": str(e),
                        "client_host": request.client.host
                    })
                    return Response(
                        content="Invalid request body",
                        status_code=400
                    )
        
        # Process the request
        response = await call_next(request)
        
        # Add security headers
        await self.set_security_headers(response, request)
        
        return response 