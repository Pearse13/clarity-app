# Set Python path to include both backend and api directories
$env:PYTHONPATH = "$PSScriptRoot;$PSScriptRoot\.."

# Change to the backend directory
Set-Location $PSScriptRoot

# Create a .env file if it doesn't exist
if (-not (Test-Path .env)) {
    Copy-Item .env.example .env -ErrorAction SilentlyContinue
}

# Start uvicorn with proper configuration
python -m uvicorn main:get_application --reload --host 0.0.0.0 --port 8000 --reload-dir . 