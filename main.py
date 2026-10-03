import uvicorn
import os
import sys

if __name__ == "__main__":
    if sys.platform == "win32":
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    
    port = int(os.environ.get("PORT", 8080))
    print("============================================================")
    print(f"Telegram Member Auditor & Remover starting on http://localhost:{port}")
    print("============================================================")
    uvicorn.run("backend.app:app", host="127.0.0.1", port=port, reload=True)

