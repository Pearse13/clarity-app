from fastapi import FastAPI, Request, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer
import sys
import os
import time
from collections import defaultdict
import asyncio
import logging
import sentry_sdk
from sentry_sdk.integrations.asgi import SentryAsgiMiddleware
from sentry_sdk.integrations.fastapi import FastApiIntegration
from typing import Dict, Tuple
from datetime import datetime, timedelta
from jose import jwt

# Configure Sentry
if os.getenv("ENVIRONMENT") == "production":
    sentry_sdk.init(
        dsn=os.getenv("SENTRY_DSN"),
        environment=os.getenv("ENVIRONMENT"),
        traces_sample_rate=1.0,
        send_default_pii=True,
        enable_tracing=True,
        attach_stacktrace=True,
        server_name=os.getenv("VERCEL_URL", "localhost"),
        debug=True,  # Enable debug mode temporarily
        before_send=lambda event, hint: {
            **event,
            "timestamp": time.time(),
            "datetime": datetime.utcnow().isoformat()
        } if event else event,
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
    app = SentryAsgiMiddleware(app)

# Update security settings
RATE_LIMIT_DURATION = 60  # 1 minute window
MAX_REQUESTS = int(os.getenv("RATE_LIMIT_MAX_REQUESTS", "50"))  # Reduced to 50 requests per minute
BLOCK_DURATION = 300  # 5 minutes block
MAX_REQUEST_SIZE = 1024 * 50  # 50KB max request size
BLOCKED_IPS: Dict[str, float] = {}  # Store blocked IPs and their timeout
REQUEST_HISTORY: Dict[str, list] = defaultdict(list)  # Store request timestamps per IP

# Rate limit metrics
RATE_LIMIT_METRICS: Dict[str, Dict] = {
    "total_requests": 0,
    "blocked_requests": 0,
    "unique_ips": set(),
    "hourly_stats": defaultdict(int),
    "last_reset": time.time()
}

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
            total_reqs = RATE_LIMIT_METRICS["total_requests"]
            blocked = RATE_LIMIT_METRICS["blocked_requests"]
            unique_ips = len(RATE_LIMIT_METRICS["unique_ips"])
            hourly_reqs = RATE_LIMIT_METRICS["hourly_stats"][current_hour]

            logger.info(
                f"Rate Limit Metrics - Hour: {current_hour}, "
                f"Total Requests: {total_reqs}, "
                f"Blocked: {blocked}, "
                f"Unique IPs: {unique_ips}, "
                f"Hourly Requests: {hourly_reqs}"
            )

            # Log to Sentry if blocking rate is high
            if blocked > 0 and (blocked / total_reqs) > 0.1:  # More than 10% requests blocked
                sentry_sdk.capture_message(
                    f"High rate limit blocking: {blocked}/{total_reqs} requests blocked",
                    level="warning"
                )

            # Reset counters every day
            if time.time() - RATE_LIMIT_METRICS["last_reset"] > 86400:  # 24 hours
                RATE_LIMIT_METRICS.update({
                    "total_requests": 0,
                    "blocked_requests": 0,
                    "unique_ips": set(),
                    "hourly_stats": defaultdict(int),
                    "last_reset": time.time()
                })

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
    return request.client.host

async def check_rate_limit(request: Request):
    """Rate limiting middleware with monitoring"""
    client_ip = get_client_ip(request)
    current_time = time.time()
    current_hour = datetime.now().strftime("%Y-%m-%d %H:00")
    
    # Update metrics
    RATE_LIMIT_METRICS["total_requests"] += 1
    RATE_LIMIT_METRICS["unique_ips"].add(client_ip)
    RATE_LIMIT_METRICS["hourly_stats"][current_hour] += 1
    
    # Check if IP is blocked
    if client_ip in BLOCKED_IPS:
        if current_time < BLOCKED_IPS[client_ip]:
            RATE_LIMIT_METRICS["blocked_requests"] += 1
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
        RATE_LIMIT_METRICS["blocked_requests"] += 1
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

def get_allowed_origins():
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

# Copy middleware and routes from backend app
app.middleware = backend_app.middleware
app.routes = backend_app.routes

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
        
        # Enhanced security headers
        response.headers.update({
            "X-Content-Type-Options": "nosniff",
            "X-Frame-Options": "DENY",
            "X-XSS-Protection": "1; mode=block",
            "Referrer-Policy": "strict-origin-when-cross-origin",
            "X-Permitted-Cross-Domain-Policies": "none",
            "X-Download-Options": "noopen",
            "Cross-Origin-Embedder-Policy": "require-corp",
            "Cross-Origin-Opener-Policy": "same-origin",
            "Cross-Origin-Resource-Policy": "same-origin",
            "Permissions-Policy": "accelerometer=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=()",
            "Content-Security-Policy": (
                "default-src 'self'; "
                "script-src 'self' https://*.auth0.com; "
                "style-src 'self' 'unsafe-inline'; "
                "img-src 'self' data: https://*.auth0.com https://s.gravatar.com; "
                "font-src 'self' data:; "
                "connect-src 'self' https://*.auth0.com https://api.openai.com; "
                "frame-src 'self' https://*.auth0.com; "
                "base-uri 'self'; "
                "form-action 'self'; "
                "frame-ancestors 'none';"
            )
        })

        # Add HSTS in production
        if os.getenv("ENVIRONMENT") == "production":
            response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains; preload"

        # Sanitize sensitive headers
        for header in ["Server", "X-Powered-By"]:
            if header in response.headers:
                del response.headers[header]

        return response
    except Exception as e:
        logger.error(f"Error processing request: {str(e)}")
        raise

# Add rate limit headers middleware
@app.middleware("http")
async def add_rate_limit_headers(request: Request, call_next):
    response = await call_next(request)
    if hasattr(request.state, "rate_limit"):
        response.headers["X-Rate-Limit-Remaining"] = str(request.state.rate_limit["remaining"])
        response.headers["X-Rate-Limit-Reset"] = str(request.state.rate_limit["reset"])
    return response

# Add monitoring endpoint
@app.get("/api/metrics")
async def get_metrics(request: Request):
    # Only allow access from admin IPs or with admin token
    # In production, you should add proper authentication here
    if os.getenv("ENVIRONMENT") == "production":
        # Add your admin authentication logic here
        pass
    
    current_hour = datetime.now().strftime("%Y-%m-%d %H:00")
    return {
        "total_requests": RATE_LIMIT_METRICS["total_requests"],
        "blocked_requests": RATE_LIMIT_METRICS["blocked_requests"],
        "unique_ips": len(RATE_LIMIT_METRICS["unique_ips"]),
        "current_hour_requests": RATE_LIMIT_METRICS["hourly_stats"][current_hour],
        "blocked_ips_count": len(BLOCKED_IPS)
    }

# Handler for Vercel serverless function
@app.get("/api/health")
async def health_check(request: Request):
    return {
        "status": "healthy",
        "environment": os.getenv("ENVIRONMENT"),
        "allowed_origins": get_allowed_origins(),
        "client_ip": get_client_ip(request)
    }

# Error handler for rate limiting
@app.exception_handler(429)
async def rate_limit_handler(request: Request, exc: HTTPException):
    return {
        "detail": str(exc.detail),
        "retry_after": 300  # 5 minutes
    }

def filter_sensitive_data(event):
    """Filter out sensitive data from Sentry events"""
    if event.get("request", {}).get("headers"):
        # Remove sensitive headers
        sensitive_headers = ["authorization", "cookie", "x-api-key"]
        event["request"]["headers"] = {
            k: v for k, v in event["request"]["headers"].items()
            if k.lower() not in sensitive_headers
        }
    
    # Scrub sensitive data from request body
    if event.get("request", {}).get("data"):
        event["request"]["data"] = "[Filtered]"
    
    return event

@app.middleware("http")
async def sentry_transaction_middleware(request: Request, call_next):
    # Start Sentry transaction
    with sentry_sdk.start_transaction(
        op="http.server",
        name=f"{request.method} {request.url.path}",
    ) as transaction:
        # Add user context if available
        if "Authorization" in request.headers:
            try:
                token = request.headers["Authorization"].split(" ")[1]
                payload = jwt.decode(token, options={"verify_signature": False})
                sentry_sdk.set_user({"id": payload.get("sub"), "email": payload.get("email")})
            except Exception:
                pass

        # Add request context
        sentry_sdk.set_context("request", {
            "method": request.method,
            "path": request.url.path,
            "client_ip": get_client_ip(request)
        })

        try:
            response = await call_next(request)
            transaction.set_http_status(response.status_code)
            return response
        except Exception as e:
            # Capture exception with context
            sentry_sdk.capture_exception(
                e,
                contexts={
                    "request": {
                        "method": request.method,
                        "path": request.url.path,
                        "client_ip": get_client_ip(request)
                    }
                }
            )
            raise

# Add verification endpoint
@app.get("/sentry-debug")
async def trigger_error():
    division_by_zero = 1 / 0

# This is needed for Vercel
handler = app 