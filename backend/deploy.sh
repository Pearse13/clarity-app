#!/bin/bash

# Install the Sentry CLI
curl -sL https://sentry.io/get-cli/ | bash

# Setup configuration values
export SENTRY_AUTH_TOKEN="your-auth-token-here"
export SENTRY_ORG="clarity-api"
export SENTRY_PROJECT="clarity-api"
export VERSION=$(sentry-cli releases propose-version)

# Create and finalize release
sentry-cli releases new "$VERSION"
sentry-cli releases set-commits "$VERSION" --auto
sentry-cli releases finalize "$VERSION"

# Export release version for the application
export SENTRY_RELEASE="$VERSION"

# Start your application (modify as needed)
uvicorn main:app --host 0.0.0.0 --port 8000 