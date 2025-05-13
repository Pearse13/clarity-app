# Clarity Lecture Platform

## Project Overview
Clarity is a dual-purpose AI-powered educational platform:
1. **Text Transformer**: An intelligent text refinement tool offering four transformation modes with varying intensity levels for enhancing written communication.
2. **Clarity Lectures**: An interactive learning companion that transforms educational content into digestible formats with AI-powered comprehension tools.

## Chat Feature Setup

The Lecture platform now includes a chat feature powered by Anthropic's Claude 3.5 Sonnet model. To use this feature, you need to:

1. **Create an Anthropic Account:**
   - Sign up at [console.anthropic.com](https://console.anthropic.com/)
   - Navigate to the "API Keys" section
   - Create a new API key named "Clarity App"
   - Copy your API key

2. **Configure Your Backend:**
   - Add your Anthropic API key to `backend/.env`:
     ```
     ANTHROPIC_API_KEY=your_api_key_here
     ANTHROPIC_MODEL=claude-3-5-sonnet-20240620
     ```

3. **Start the Backend:**
   ```
   cd backend
   pip install -r requirements.txt
   uvicorn app.main:app --reload
   ```

4. **Start the Frontend:**
   ```
   cd frontend/project
   npm install
   npm run dev
   ```

5. **Test the Chat Feature:**
   - Upload a lecture document
   - Switch to the "Chat" tab
   - Ask questions about your lecture material

## API Configuration

The API is configured to work in both development and production environments:

- **Development API URL:** `http://localhost:8000`
- **Production API URL:** Configured via environment variables

## Environment Variables

### Backend
See `backend/.env.example` for required environment variables.

### Frontend
Create a `.env.local` file in `frontend/project/` with:
```
VITE_AUTH0_DOMAIN=your-tenant.us.auth0.com
VITE_AUTH0_CLIENT_ID=your-auth0-client-id
VITE_AUTH0_AUDIENCE=https://your-api-identifier.com
VITE_API_URL=http://localhost:8000
```

## Tech Stack
- **Frontend:** React + Vite (TypeScript)
- **Backend:** FastAPI (Python)
- **Authentication:** Auth0
- **AI:** Anthropic Claude 3.5 Sonnet, OpenAI
- **Deployment:** Vercel (frontend), Railway (backend)

## Features
- Document upload and viewing
- Text transformation with different modes
- AI-powered chat for document understanding
- Text selection for context-specific questions 