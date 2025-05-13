from fastapi import FastAPI, Request, HTTPException, Depends, APIRouter
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer
from fastapi.responses import JSONResponse
import sys
import os
import time
from collections import defaultdict
import asyncio
import logging
import sentry_sdk
from sentry_sdk.integrations.asgi import SentryAsgiMiddleware
from sentry_sdk.integrations.fastapi import FastApiIntegration
from typing import Dict, Set, Any, Optional, Union, DefaultDict, TypedDict, Callable
from datetime import datetime, timedelta
from jose import jwt
from sentry_sdk import Hub

# Configure Sentry
if os.getenv("ENVIRONMENT") == "production":
    def before_send(event: Any, hint: Any) -> Any:
        """Process the event before sending to Sentry"""
        if not event:
            return None
        
        # Create a new event with additional data
        if isinstance(event, dict):
            event.update({
                "timestamp": time.time(),
                "datetime": datetime.utcnow().isoformat()
            })
        return event

    sentry_sdk.init(
        dsn=os.getenv("SENTRY_DSN"),
        environment=os.getenv("ENVIRONMENT"),
        traces_sample_rate=1.0,
        send_default_pii=True,
        enable_tracing=True,
        attach_stacktrace=True,
        server_name=os.getenv("VERCEL_URL", "localhost"),
        debug=True,  # Enable debug mode temporarily
        before_send=before_send,
        integrations=[
            FastApiIntegration(
                transaction_style="endpoint",
                middleware_spans=True,
            ),
        ],
        release=os.getenv("VERCEL_GIT_COMMIT_SHA", "development"),
    )

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Add the backend directory to Python path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from backend.main import app as backend_app

# Create handler for Vercel
app = FastAPI()

# Wrap app with Sentry
if os.getenv("ENVIRONMENT") == "production":
    wrapped_app = SentryAsgiMiddleware(app)
else:
    wrapped_app = app

# Update security settings
RATE_LIMIT_DURATION = 60  # 1 minute window
MAX_REQUESTS = int(os.getenv("RATE_LIMIT_MAX_REQUESTS", "50"))  # Reduced to 50 requests per minute
BLOCK_DURATION = 300  # 5 minutes block
MAX_REQUEST_SIZE = 1024 * 50  # 50KB max request size

# Type definitions for rate limiting
BLOCKED_IPS: Dict[str, float] = {}  # Store blocked IPs and their timeout
REQUEST_HISTORY: DefaultDict[str, list] = defaultdict(list)  # Store request timestamps per IP

# Rate limit metrics with proper type annotations
class RateLimitMetrics:
    def __init__(self):
        self.total_requests: int = 0
        self.blocked_requests: int = 0
        self.unique_ips: Set[str] = set()
        self.hourly_stats: DefaultDict[str, int] = defaultdict(int)
        self.last_reset: float = time.time()

RATE_LIMIT_METRICS = RateLimitMetrics()

async def cleanup_old_requests():
    """Periodically cleanup old request history"""
    while True:
        current_time = time.time()
        for ip in list(REQUEST_HISTORY.keys()):
            REQUEST_HISTORY[ip] = [
                timestamp for timestamp in REQUEST_HISTORY[ip]
                if current_time - timestamp < RATE_LIMIT_DURATION
            ]
            if not REQUEST_HISTORY[ip]:
                del REQUEST_HISTORY[ip]
        
        # Cleanup blocked IPs
        for ip in list(BLOCKED_IPS.keys()):
            if current_time > BLOCKED_IPS[ip]:
                del BLOCKED_IPS[ip]
                
        await asyncio.sleep(60)  # Cleanup every minute

async def monitor_rate_limits():
    """Monitor and log rate limit metrics"""
    while True:
        try:
            current_hour = datetime.now().strftime("%Y-%m-%d %H:00")
            total_reqs = RATE_LIMIT_METRICS.total_requests
            blocked = RATE_LIMIT_METRICS.blocked_requests
            unique_ips = len(RATE_LIMIT_METRICS.unique_ips)
            hourly_reqs = RATE_LIMIT_METRICS.hourly_stats[current_hour]

            logger.info(
                f"Rate Limit Metrics - Hour: {current_hour}, "
                f"Total Requests: {total_reqs}, "
                f"Blocked: {blocked}, "
                f"Unique IPs: {unique_ips}, "
                f"Hourly Requests: {hourly_reqs}"
            )

            # Log to Sentry if blocking rate is high
            if blocked > 0 and total_reqs > 0 and (blocked / total_reqs) > 0.1:  # More than 10% requests blocked
                sentry_sdk.capture_message(
                    f"High rate limit blocking: {blocked}/{total_reqs} requests blocked",
                    level="warning"
                )

            # Reset counters every day
            if time.time() - RATE_LIMIT_METRICS.last_reset > 86400:  # 24 hours
                RATE_LIMIT_METRICS.total_requests = 0
                RATE_LIMIT_METRICS.blocked_requests = 0
                RATE_LIMIT_METRICS.unique_ips.clear()
                RATE_LIMIT_METRICS.hourly_stats.clear()
                RATE_LIMIT_METRICS.last_reset = time.time()

        except Exception as e:
            logger.error(f"Error in rate limit monitoring: {str(e)}")
            if os.getenv("ENVIRONMENT") == "production":
                sentry_sdk.capture_exception(e)

        await asyncio.sleep(3600)  # Log every hour

@app.on_event("startup")
async def startup_event():
    asyncio.create_task(cleanup_old_requests())
    asyncio.create_task(monitor_rate_limits())

def get_client_ip(request: Request) -> str:
    """Get the real client IP, considering Vercel's forwarded headers"""
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0]
    client_host = request.client.host if request.client and request.client.host else "unknown"
    return client_host

async def check_rate_limit(request: Request):
    """Rate limiting middleware with monitoring"""
    client_ip = get_client_ip(request)
    current_time = time.time()
    current_hour = datetime.now().strftime("%Y-%m-%d %H:00")
    
    # Update metrics
    RATE_LIMIT_METRICS.total_requests += 1
    RATE_LIMIT_METRICS.unique_ips.add(client_ip)
    RATE_LIMIT_METRICS.hourly_stats[current_hour] += 1
    
    # Check if IP is blocked
    if client_ip in BLOCKED_IPS:
        if current_time < BLOCKED_IPS[client_ip]:
            RATE_LIMIT_METRICS.blocked_requests += 1
            raise HTTPException(
                status_code=429,
                detail="Too many requests. Please try again later."
            )
        else:
            del BLOCKED_IPS[client_ip]
    
    # Rest of the existing rate limit logic...
    REQUEST_HISTORY[client_ip].append(current_time)
    recent_requests = len([
        t for t in REQUEST_HISTORY[client_ip]
        if current_time - t < RATE_LIMIT_DURATION
    ])
    
    if recent_requests > MAX_REQUESTS:
        RATE_LIMIT_METRICS.blocked_requests += 1
        BLOCKED_IPS[client_ip] = current_time + BLOCK_DURATION
        raise HTTPException(
            status_code=429,
            detail="Rate limit exceeded. Please try again in 5 minutes."
        )

    # Add rate limit headers
    request.state.rate_limit = {
        "remaining": MAX_REQUESTS - recent_requests,
        "reset": int(current_time + RATE_LIMIT_DURATION)
    }

def get_allowed_origins() -> list[str]:
    """Get allowed origins based on environment"""
    if os.getenv('ENVIRONMENT') == 'production':
        # In production, only allow the specific domain and Vercel preview URLs
        origins = []
        prod_domain = os.getenv("PRODUCTION_DOMAIN")
        vercel_url = os.getenv("VERCEL_URL")
        
        if prod_domain:
            origins.append(f"https://{prod_domain}")
        if vercel_url:
            origins.append(f"https://{vercel_url}")
        
        return origins
    else:
        # In development, only allow localhost
        return [
            "http://localhost:5174",
            "http://127.0.0.1:5174"
        ]

# Configure the app with the backend routes
if isinstance(backend_app, FastAPI):
    # Copy routes using include_router
    for route in backend_app.routes:
        if isinstance(route, APIRouter):
            app.include_router(route)
        else:
            # For non-APIRouter routes, add them directly
            app.router.routes.append(route)

    # Copy middleware using FastAPI's middleware system
    if hasattr(backend_app, "middleware"):
        for middleware in backend_app.middleware.middleware:
            if hasattr(middleware, "cls"):
                app.add_middleware(middleware.cls)

# Update CORS for Vercel deployment with strict settings
app.add_middleware(
    CORSMiddleware,
    allow_origins=get_allowed_origins(),
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
    expose_headers=["X-Rate-Limit-Remaining", "X-Rate-Limit-Reset"],
    max_age=3600,
)

# Add security headers middleware
@app.middleware("http")
async def security_middleware(request: Request, call_next):
    try:
        # Skip auth for OPTIONS requests and public endpoints
        if request.method == "OPTIONS" or request.url.path in ["/", "/login", "/callback", "/api/health"]:
            return await call_next(request)

        # Check request size
        content_length = request.headers.get("content-length")
        if content_length and int(content_length) > MAX_REQUEST_SIZE:
            raise HTTPException(
                status_code=413,
                detail="Request too large"
            )
        
        # Rate limiting check
        await check_rate_limit(request)
        
        # Log request details (excluding sensitive data)
        logger.info(
            f"Request: {request.method} {request.url.path} "
            f"from {get_client_ip(request)}"
        )
        
        response = await call_next(request)
        return response
        
    except Exception as e:
        logger.error(f"Error in security middleware: {str(e)}")
        if os.getenv("ENVIRONMENT") == "production":
            sentry_sdk.capture_exception(e)
        raise

@app.middleware("http")
async def add_rate_limit_headers(request: Request, call_next):
    response = await call_next(request)
    if hasattr(request.state, "rate_limit"):
        response.headers["X-Rate-Limit-Remaining"] = str(request.state.rate_limit["remaining"])
        response.headers["X-Rate-Limit-Reset"] = str(request.state.rate_limit["reset"])
    return response

@app.get("/api/metrics")
async def get_metrics(request: Request):
    # Only allow access from admin IPs or with admin token
    # In production, you should add proper authentication here
    return {
        "total_requests": RATE_LIMIT_METRICS.total_requests,
        "blocked_requests": RATE_LIMIT_METRICS.blocked_requests,
        "unique_ips": len(RATE_LIMIT_METRICS.unique_ips),
        "hourly_stats": dict(RATE_LIMIT_METRICS.hourly_stats)
    }

@app.get("/api/health")
async def health_check():
    return {
        "status": "healthy",
        "timestamp": datetime.utcnow().isoformat()
    }

@app.exception_handler(429)
async def rate_limit_handler(request: Request, exc: HTTPException):
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.detail}
    )

def filter_sensitive_data(event: dict) -> dict:
    """Filter sensitive data from Sentry events"""
    if not event:
        return event
        
    # Remove sensitive headers
    if "request" in event and "headers" in event["request"]:
        headers = event["request"]["headers"]
        filtered_headers = {
            k: v for k, v in headers.items()
            if k.lower() not in ["authorization", "cookie"]
        }
        event["request"]["headers"] = filtered_headers
        
    return event

@app.middleware("http")
async def sentry_transaction_middleware(request: Request, call_next):
    if os.getenv("ENVIRONMENT") != "production":
        return await call_next(request)
        
    hub = Hub.current
    with hub.start_transaction(
        op="http.server",
        name=f"{request.method} {request.url.path}",
    ):
        try:
            response = await call_next(request)
            return response
        except Exception as e:
            hub.capture_exception(e)
            raise

@app.get("/sentry-debug")
async def trigger_error():
    try:
        # First send a test message
        sentry_sdk.capture_message("Testing Sentry integration")
        
        # Then trigger a division by zero error
        division_by_zero = 1 / 0
        return {"status": "This should not be reached"}
    except Exception as e:
        sentry_sdk.capture_exception(e)
        return {
            "status": "error",
            "message": "Test error sent to Sentry",
            "error": str(e)
        }

# This is needed for Vercel
handler = app 