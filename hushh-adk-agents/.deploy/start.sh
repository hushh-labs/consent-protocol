#!/bin/bash

# Cloud Run defines PORT for the public-facing service (Fusion Agent / ADK Web)
ADK_PORT=${PORT:-8080}

# Internal Ports for Microservices
MCP_PORT=8081
KAI_PORT=10001
KUSHAL_PORT=10002

export MCP_SERVER_URL="http://localhost:${MCP_PORT}/mcp"

echo "🚀 Starting Hushh Cloud Mesh (Distributed A2A)..."
echo "🔌 MCP Service:     ${MCP_PORT}"
echo "💰 Kai Service:     ${KAI_PORT}"
echo "🚀 Kushal Service:  ${KUSHAL_PORT}"
echo "🌐 Fusion Gateway:  ${ADK_PORT}"

# 1. Start MCP Server (Data Layer)
echo "   [1/4] Booting MCP..."
PORT=$MCP_PORT uv run python ._mcp_kai/server.py &

echo "⏳ Waiting 5s for MCP to warm up..."
sleep 5

# 2. Start Kai Agent (Hustler Microservice)
echo "   [2/4] Booting Kai Service..."
uv run uvicorn kai_agent:a2a_app --host 0.0.0.0 --port $KAI_PORT &

# 3. Start Kushal Agent (Profile Microservice)
echo "   [3/4] Booting Kushal Service..."
uv run uvicorn kushal_agent:a2a_app --host 0.0.0.0 --port $KUSHAL_PORT &

# Wait for mesh to stabilize
echo "⏳ Stabilizing Mesh (5s)..."
sleep 5

# 4. Start Fusion Agent / ADK Web (Public Gateway)
echo "🌟 [4/4] Starting Public Gateway (ADK Web)..."
# We run ADK Web which exposes all agents, but we'll use tech_fusion_agent primarily
uv run adk web . --host 0.0.0.0 --port $ADK_PORT
