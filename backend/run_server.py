import uvicorn
import os
from pathlib import Path

if __name__ == "__main__":
    # Get the absolute path to the backend directory
    backend_dir = Path(__file__).parent.absolute()
    
    # Change to the backend directory
    os.chdir(backend_dir)
    
    # Run the server without auto-reload
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8000,
        reload=False,  # Disable auto-reload
        log_level="info"
    ) 