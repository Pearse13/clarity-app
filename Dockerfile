FROM ubuntu:22.04

# Install LibreOffice and dependencies
RUN apt-get update && apt-get install -y \
    python3 python3-pip python3-dev \
    libreoffice \
    libreoffice-writer \
    libreoffice-impress \
    libreoffice-calc \
    libreoffice-common \
    fonts-liberation \
    fonts-liberation2 \
    poppler-utils \
    unoconv \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Make sure LibreOffice is executable and properly configured
RUN chmod +x /usr/bin/libreoffice && \
    chmod +x /usr/bin/soffice && \
    ln -sf /usr/bin/soffice /usr/local/bin/soffice && \
    mkdir -p /root/.config/libreoffice/4/user && \
    echo '[Bootstrap]' > /root/.config/libreoffice/4/user/registrymodifications.xcu && \
    echo 'UserInstallation=$SYSUSERCONFIG/libreoffice/4' >> /root/.config/libreoffice/4/user/registrymodifications.xcu

# Create LibreOffice user profile directory with proper permissions
RUN mkdir -p /app/.config/libreoffice/4/user && \
    chmod -R 777 /app/.config

# Set up working directory
WORKDIR /app

# Copy requirements first for better caching
COPY backend/requirements.txt .
RUN pip3 install --no-cache-dir -r requirements.txt

# Copy the backend code
COPY backend/ .

# Create necessary directories
RUN mkdir -p data/temp data/documents data/static

# Set HOME for LibreOffice user profile
ENV HOME=/app

# Set environment variables
ENV PORT=8000
ENV PYTHONUNBUFFERED=1

# Expose the port
EXPOSE 8000

# Run the server
CMD ["python3", "run_server.py"] 