FROM python:3.11-slim

WORKDIR /app

# Copy requirements and install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY bridge.py .

# Expose port
EXPOSE 8002

# Run the application
CMD ["python", "-m", "uvicorn", "bridge:app", "--host", "0.0.0.0", "--port", "8002"]

