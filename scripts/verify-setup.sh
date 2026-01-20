#!/bin/bash
# ============================================
# Mimir Setup Verification Script
# ============================================
# Checks that your development environment is ready to run Mimir.
#
# Usage: ./scripts/verify-setup.sh

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

all_passed=true

check_result() {
    local message=$1
    local success=$2
    
    if [ "$success" = true ]; then
        echo -e "${GREEN}[OK]${NC} $message"
    else
        echo -e "${RED}[FAIL]${NC} $message"
    fi
}

header() {
    echo ""
    echo -e "${CYAN}=== $1 ===${NC}"
}

echo ""
echo -e "${CYAN}Mimir Setup Verification${NC}"
echo -e "${CYAN}========================${NC}"

# ============================================
# Check Docker
# ============================================
header "Docker"

docker_running=false
if docker info > /dev/null 2>&1; then
    docker_running=true
fi

check_result "Docker is running" $docker_running
if [ "$docker_running" = false ]; then
    echo -e "  ${YELLOW}-> Start Docker Desktop and try again${NC}"
    all_passed=false
fi

# ============================================
# Check .env file
# ============================================
header "Configuration"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_PATH="$SCRIPT_DIR/../.env"

env_exists=false
if [ -f "$ENV_PATH" ]; then
    env_exists=true
fi

check_result ".env file exists" $env_exists

if [ "$env_exists" = false ]; then
    echo -e "  ${YELLOW}-> Run: cp .env.example .env${NC}"
    all_passed=false
else
    # Check required variables
    has_endpoint=false
    has_key=false
    has_chat=false
    has_embed=false
    
    if grep -q "AZURE_OPENAI_ENDPOINT=https://" "$ENV_PATH"; then
        has_endpoint=true
    fi
    
    if grep -q "AZURE_OPENAI_API_KEY=" "$ENV_PATH" && ! grep -q "AZURE_OPENAI_API_KEY=your-api-key-here" "$ENV_PATH"; then
        has_key=true
    fi
    
    if grep -q "AZURE_OPENAI_CHAT_DEPLOYMENT=" "$ENV_PATH"; then
        has_chat=true
    fi
    
    if grep -q "AZURE_OPENAI_EMBEDDING_DEPLOYMENT=" "$ENV_PATH"; then
        has_embed=true
    fi
    
    check_result "AZURE_OPENAI_ENDPOINT is set" $has_endpoint
    check_result "AZURE_OPENAI_API_KEY is set (not placeholder)" $has_key
    check_result "AZURE_OPENAI_CHAT_DEPLOYMENT is set" $has_chat
    check_result "AZURE_OPENAI_EMBEDDING_DEPLOYMENT is set" $has_embed
    
    if [ "$has_endpoint" = false ]; then
        echo -e "  ${YELLOW}-> Add your Azure OpenAI endpoint to .env${NC}"
        all_passed=false
    fi
    if [ "$has_key" = false ]; then
        echo -e "  ${YELLOW}-> Add your Azure OpenAI API key to .env${NC}"
        all_passed=false
    fi
fi

# ============================================
# Check ports
# ============================================
header "Ports"

check_port() {
    local port=$1
    if ! lsof -i :$port > /dev/null 2>&1 && ! netstat -tuln 2>/dev/null | grep -q ":$port "; then
        return 0  # Port is free
    else
        return 1  # Port is in use
    fi
}

port_3000_free=false
port_8080_free=false

if check_port 3000; then
    port_3000_free=true
fi

if check_port 8080; then
    port_8080_free=true
fi

check_result "Port 3000 is available (frontend)" $port_3000_free
check_result "Port 8080 is available (backend)" $port_8080_free

if [ "$port_3000_free" = false ]; then
    echo -e "  ${YELLOW}-> Stop the service using port 3000, or change the port in docker-compose.dev.yml${NC}"
    all_passed=false
fi
if [ "$port_8080_free" = false ]; then
    echo -e "  ${YELLOW}-> Stop the service using port 8080, or change the port in docker-compose.dev.yml${NC}"
    all_passed=false
fi

# ============================================
# Check Azure OpenAI connectivity (optional)
# ============================================
if [ "$env_exists" = true ] && [ "$has_endpoint" = true ]; then
    header "Azure OpenAI Connectivity"
    
    endpoint=$(grep "AZURE_OPENAI_ENDPOINT=" "$ENV_PATH" | cut -d'=' -f2)
    
    reachable=false
    http_code=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 5 "$endpoint" 2>/dev/null || echo "000")
    
    if [ "$http_code" != "000" ]; then
        reachable=true
    fi
    
    check_result "Azure OpenAI endpoint is reachable" $reachable
    if [ "$reachable" = false ]; then
        echo -e "  ${YELLOW}-> Check your internet connection and endpoint URL${NC}"
    fi
fi

# ============================================
# Summary
# ============================================
echo ""
echo -e "${CYAN}========================================${NC}"
if [ "$all_passed" = true ]; then
    echo -e "${GREEN}All checks passed! You're ready to go.${NC}"
    echo ""
    echo "Run: docker compose -f docker-compose.dev.yml up --build"
    echo "Then open: http://localhost:3000"
else
    echo -e "${YELLOW}Some checks failed. Fix the issues above and try again.${NC}"
fi
echo -e "${CYAN}========================================${NC}"
echo ""
