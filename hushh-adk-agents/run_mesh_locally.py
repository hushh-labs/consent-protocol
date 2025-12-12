import subprocess
import time
import os
import sys
import signal

# Configuration
MCP_PORT = 8081
KAI_PORT = 10001
KUSHAL_PORT = 10002
NAV_PORT = 10003
FUSION_PORT = 8080

processes = []

def stream_logs(proc, name):
    """Simple log streamer (not blocking)"""
    # Real-world: use threads to read stdout/stderr.
    # For this script, we rely on the subproccess inheriting stdout for users to see.
    pass

def start_service(command, name, port, env=None):
    print(f"🚀 [{name}] Starting on port {port}...")
    final_env = os.environ.copy()
    if env:
        final_env.update(env)
    
    # Use shell=True for simple command execution on Windows
    p = subprocess.Popen(command, shell=True, env=final_env)
    processes.append(p)
    return p

def cleanup(signum, frame):
    print("\n🛑 Stopping all services...")
    for p in processes:
        p.terminate()
        # on windows this might not kill child processes of shell=True
        if sys.platform == 'win32':
             subprocess.call(['taskkill', '/F', '/T', '/PID', str(p.pid)])
    sys.exit(0)

# Register cleanup
signal.signal(signal.SIGINT, cleanup)

print("🔗 Starting Hushh A2A Mesh (Local Test Mode)")
print("===========================================")

# 1. MCP Server
start_service(
    f"uv run python ._mcp_kai/server.py", 
    "MCP Server", 
    MCP_PORT,
    env={"PORT": str(MCP_PORT)}
)

# 2. Kai Service
start_service(
    f"uv run uvicorn kai_agent:a2a_app --host 0.0.0.0 --port {KAI_PORT}",
    "Kai Service",
    KAI_PORT,
    env={"MCP_SERVER_URL": f"http://localhost:{MCP_PORT}/mcp"}
)

# 3. Kushal Service
start_service(
    f"uv run uvicorn kushal_agent:a2a_app --host 0.0.0.0 --port {KUSHAL_PORT}",
    "Kushal Service",
    KUSHAL_PORT
)

# 4. Nav Service
NAV_PORT = 10003
start_service(
    f"uv run uvicorn nav_agent:a2a_app --host 0.0.0.0 --port {NAV_PORT}",
    "Nav Service",
    NAV_PORT
)

print("⏳ Waiting 15s for services to stabilize...")
time.sleep(15)

# 4. Fusion Gateway (ADK Web)
print(f"🌟 Starting Fusion Gateway at http://localhost:{FUSION_PORT}")
start_service(
    f"uv run adk web . --port {FUSION_PORT}",
    "Fusion Gateway",
    FUSION_PORT,
    env={
        "MCP_SERVER_URL": f"http://localhost:{MCP_PORT}/mcp"
    }
)

print("\n✅ All systems GO! Press Ctrl+C to stop.")
print("Open http://localhost:8080 and select 'tech_fusion_agent' to test.")

# Keep main thread alive
while True:
    try:
        time.sleep(1)
    except KeyboardInterrupt:
        cleanup(None, None)
