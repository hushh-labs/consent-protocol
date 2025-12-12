# Use official Python runtime as a parent image
FROM python:3.11-slim

# Set environment variables
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=off \
    PIP_DISABLE_PIP_VERSION_CHECK=on \
    UV_PROJECT_ENVIRONMENT="/usr/local"

# Install system dependencies and uv package manager
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/* \
    && pip install uv

# Set working directory
WORKDIR /app

# Copy project files
COPY . .

# Install dependencies
RUN uv pip install -r pyproject.toml --system

# Make the start script executable
RUN chmod +x ./.deploy/start.sh

# Expose ports
EXPOSE 8080 8081

# Run the unified start script
CMD ["./.deploy/start.sh"]
