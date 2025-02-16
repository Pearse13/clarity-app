# Load production environment
Get-Content .env.production | ForEach-Object {
    $line = $_.Trim()
    if ($line -and !$line.StartsWith("#")) {
        $key, $value = $line.Split('=', 2)
        $env:$key = $value
    }
}

# Install the Sentry CLI
Invoke-WebRequest -Uri https://sentry.io/get-cli/ -OutFile sentry-cli-install.ps1
.\sentry-cli-install.ps1

# Set environment variables for deployment
$env:ENVIRONMENT = "production"
$env:SENTRY_AUTH_TOKEN = "your-sentry-auth-token-here"

# Setup configuration values
$env:SENTRY_ORG = "clarity-api"
$env:SENTRY_PROJECT = "clarity-api"
$env:VERSION = $(sentry-cli releases propose-version)

# Create and finalize release
sentry-cli releases new "$env:VERSION"
sentry-cli releases set-commits "$env:VERSION" --auto
sentry-cli releases finalize "$env:VERSION"

# Export release version for the application
$env:SENTRY_RELEASE = "$env:VERSION"

# Start your application in production mode
uvicorn main:app --host 0.0.0.0 --port 8000 --workers 4 --proxy-headers --forwarded-allow-ips='*' 