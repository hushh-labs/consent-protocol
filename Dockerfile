# ============================================
# Hushh Consent Protocol - Python FastAPI
# ============================================
# Production Dockerfile for Cloud Run

FROM python:3.11-slim

# Set working directory
WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements first for caching
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Create non-root user for security
RUN useradd --create-home --shell /bin/bash appuser
RUN chown -R appuser:appuser /app
USER appuser

# Cloud Run uses PORT environment variable
ENV PORT=8000
EXPOSE 8000

# Run with uvicorn
CMD ["sh", "-c", "uvicorn server:app --host 0.0.0.0 --port $PORT"]
