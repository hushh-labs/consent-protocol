# Food Dining Agent API

FastAPI wrapper for the Hushh Food & Dining Agent.

## Quick Start

```bash
# Install dependencies
pip install -r requirements.txt

# Run server
python main.py
```

Server runs on: **http://localhost:8000**

## Endpoints

- `POST /api/agents/food-dining/recommend` - Get restaurant recommendations
- `GET /api/agents/food-dining/info` - Agent manifest
- `GET /health` - Health check

## Architecture

```
Next.js Frontend (localhost:3000)
        ↓
Next.js API Proxy (/api/agent/recommend)
        ↓
FastAPI Server (localhost:8000)
        ↓
HushhFoodDiningAgent
        ↓
Operons (dietary, budget, preferences)
```

## Testing

```bash
# Health check
curl http://localhost:8000/health

# Agent info
curl http://localhost:8000/api/agents/food-dining/info
```
