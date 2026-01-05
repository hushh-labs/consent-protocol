# Hushh Deployment Guide

This directory contains the deployment configuration for the Hushh ecosystem, specifically the **Hushh Webapp** (Frontend) and **Consent Protocol** (Backend).

## Directory Structure

- `docker-compose.yml`: Main orchestration file for running services locally or in a containerized environment.
- `webapp.Dockerfile`: Multi-stage Dockerfile for the Next.js webapp (`hushh-webapp`).
- `backend.Dockerfile`: Optimized Dockerfile for the Python backend (`consent-protocol`).

## Prerequisites

- Docker Desktop / Docker Engine installed.
- Valid `.env.local` in `hushh-webapp/` (for Firebase keys).
- Valid `.env` in `consent-protocol/`.

## Running with Docker Compose

1. **Navigate to the deploy directory:**

   ```bash
   cd deploy
   ```

2. **Build and Start:**

   ```bash
   # Ensure you have the necessary environment variables available in your shell or .env files
   docker-compose up --build
   ```

   > **Note:** The `webapp` build process requires `NEXT_PUBLIC_` variables to be present. You might need to export them or create a `.env` file in the `deploy/` directory if they are not picked up from the parent directories as expected (Compose `env_file` directives load into containers, but `args` need to be resolved).
   >
   > Recommendation: Create a `.env` in `deploy/` that aggregates necessary build args.

## Cloud Deployment (e.g., Google Cloud Run)

You can build and push these images individually.

**Backend:**

```bash
cd consent-protocol
docker build -f ../deploy/backend.Dockerfile -t gcr.io/[PROJECT_ID]/hushh-backend .
docker push gcr.io/[PROJECT_ID]/hushh-backend
```

**Webapp:**

```bash
cd hushh-webapp
docker build -f ../deploy/webapp.Dockerfile \
  --build-arg NEXT_PUBLIC_FIREBASE_API_KEY=... \
  -t gcr.io/[PROJECT_ID]/hushh-webapp .
docker push gcr.io/[PROJECT_ID]/hushh-webapp
```
