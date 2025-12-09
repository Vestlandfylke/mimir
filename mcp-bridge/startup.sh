#!/bin/bash
# Startup script for Azure App Service (Linux)
gunicorn -w 2 -k uvicorn.workers.UvicornWorker -b 0.0.0.0:8000 bridge:app

