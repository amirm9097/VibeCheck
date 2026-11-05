
# ==========================================
# Stage 1: Official Node.js runtime
# ==========================================
FROM node:22-bookworm-slim AS node-runtime

# ==========================================
# Stage 2: Python + Django Backend
# ==========================================
FROM python:3.12-slim-bookworm

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PLAYWRIGHT_BROWSERS_PATH=/ms-playwright \
    PLAYWRIGHT_DOWNLOAD_CONNECTION_TIMEOUT=120000 \
    npm_config_fetch_retries=5 \
    npm_config_fetch_timeout=120000

WORKDIR /app

# Copy Node.js and npm from official image
COPY --from=node-runtime /usr/local/ /usr/local/

# ==========================================
# Configure Debian download retries
# ==========================================
RUN printf 'Acquire::Retries "5";\nAcquire::http::Timeout "120";\nAcquire::https::Timeout "120";\n' \
    > /etc/apt/apt.conf.d/80-retries

# ==========================================
# Install system dependencies
# ==========================================
# Configure Aliyun Debian mirror
RUN rm -f /etc/apt/sources.list.d/debian.sources \
    /etc/apt/sources.list.d/debian.list \
    && printf '%s\n' \
    'deb https://mirrors.aliyun.com/debian bookworm main contrib non-free non-free-firmware' \
    'deb https://mirrors.aliyun.com/debian bookworm-updates main contrib non-free non-free-firmware' \
    'deb https://mirrors.aliyun.com/debian-security bookworm-security main contrib non-free non-free-firmware' \
    > /etc/apt/sources.list

# Install system dependencies
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        ca-certificates \
        libpq5 \
        fonts-liberation \
    && rm -rf /var/lib/apt/lists/*

# ==========================================
# Install Lighthouse using npm mirror
# ==========================================
RUN npm install --global lighthouse@13.6.0 \
    --registry=https://registry.npmmirror.com \
    --no-audit \
    --no-fund \
    --fetch-retries=5 \
    --fetch-timeout=120000

# ==========================================
# Install Python dependencies
# ==========================================
COPY requirements.txt ./requirements.txt

RUN pip install \
    --no-cache-dir \
    --disable-pip-version-check \
    --retries 5 \
    --timeout 120 \
    --index-url https://mirrors.aliyun.com/pypi/simple/ \
    -r requirements.txt


# Increase Playwright download timeout
ENV PLAYWRIGHT_DOWNLOAD_CONNECTION_TIMEOUT=180000

# Install Chromium system dependencies
RUN python -m playwright install-deps chromium

# Download Chromium browser

# Install Chromium from Debian
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        chromium \
        chromium-sandbox \
    && rm -rf /var/lib/apt/lists/*

ENV PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium

# Copy application
COPY . .

RUN mkdir -p /app/media /app/staticfiles \
    && useradd --create-home --uid 10001 appuser \
    && chown -R appuser:appuser /app

USER appuser

EXPOSE 8000

CMD ["gunicorn", "config.wsgi:application", "--bind=0.0.0.0:8000", "--workers=3", "--timeout=120", "--access-logfile=-", "--error-logfile=-"]