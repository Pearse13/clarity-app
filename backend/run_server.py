import uvicorn
import os
from pathlib import Path

if __name__ == "__main__":
    # Get the absolute path to the backend directory
    backend_dir = Path(__file__).parent.absolute()
    
    # Change to the backend directory
    os.chdir(backend_dir)
    
    # Get port from environment variable or use default
    port = int(os.environ.get("PORT", 8000))
    
    # Run the server without auto-reload
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=port,
        reload=False,  # Disable auto-reload
        log_level="info"
    ) 