#!/bin/bash
set -e

echo "========================================="
echo "  Initial Server Setup for Listmonk"
echo "  Contabo VPS - nepalfillings.com"
echo "========================================="

# Update system
echo "[1/8] Updating system packages..."
apt update && apt upgrade -y

# Install Docker
echo "[2/8] Installing Docker..."
if ! command -v docker &> /dev/null; then
    curl -fsSL https://get.docker.com | sh
    systemctl enable docker
    systemctl start docker
    echo "Docker installed successfully."
else
    echo "Docker already installed."
fi

# Install Docker Compose plugin
echo "[3/8] Checking Docker Compose..."
if ! docker compose version &> /dev/null; then
    apt install -y docker-compose-plugin
    echo "Docker Compose plugin installed."
else
    echo "Docker Compose already available."
fi

# Install Git
echo "[4/8] Installing Git..."
apt install -y git

# Clone the repository
APP_DIR="/opt/listmonk"
echo "[5/8] Setting up application directory..."
if [ -d "$APP_DIR" ]; then
    echo "Directory exists. Pulling latest..."
    cd "$APP_DIR"
    git pull origin master
else
    git clone https://github.com/sand58957/nepsetradingemail.git "$APP_DIR"
    cd "$APP_DIR"
fi

# Create .env file
echo "[6/8] Creating environment file..."
if [ ! -f "$APP_DIR/.env" ]; then
    cat > "$APP_DIR/.env" << 'ENVEOF'
# Database credentials
DB_USER=listmonk
DB_PASSWORD=CHANGE_ME_TO_STRONG_PASSWORD
DB_NAME=listmonk

# Listmonk admin credentials (only used on first run)
LISTMONK_ADMIN_USER=admin
LISTMONK_ADMIN_PASSWORD=CHANGE_ME_TO_STRONG_PASSWORD
ENVEOF
    echo "Created .env file. PLEASE EDIT /opt/listmonk/.env WITH STRONG PASSWORDS!"
else
    echo ".env file already exists."
fi

# Create uploads directory
mkdir -p "$APP_DIR/uploads"

# Setup SSL with Let's Encrypt (initial cert)
echo "[7/8] Setting up SSL certificate..."
mkdir -p "$APP_DIR/certbot/www" "$APP_DIR/certbot/conf"

# First, start nginx with HTTP only for certbot challenge
cat > "$APP_DIR/nginx/conf.d/default.conf" << 'NGINXEOF'
server {
    listen 80;
    server_name nepalfillings.com www.nepalfillings.com;

    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    location / {
        proxy_pass http://app:9000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
NGINXEOF

# Start services (HTTP only first)
echo "[8/8] Starting services..."
cd "$APP_DIR"
docker compose -f docker-compose.prod.yml up -d

echo ""
echo "========================================="
echo "  Server setup complete!"
echo "========================================="
echo ""
echo "IMPORTANT NEXT STEPS:"
echo ""
echo "1. Edit passwords in /opt/listmonk/.env"
echo "   nano /opt/listmonk/.env"
echo ""
echo "2. Get SSL certificate by running:"
echo "   docker run --rm -v /opt/listmonk/certbot/www:/var/www/certbot -v /opt/listmonk/certbot/conf:/etc/letsencrypt certbot/certbot certonly --webroot --webroot-path=/var/www/certbot -d nepalfillings.com -d www.nepalfillings.com --email your-email@example.com --agree-tos --no-eff-email"
echo ""
echo "3. After SSL cert is obtained, restore HTTPS nginx config:"
echo "   cd /opt/listmonk && git checkout nginx/conf.d/default.conf"
echo "   docker compose -f docker-compose.prod.yml restart nginx"
echo ""
echo "4. App will be available at: http://nepalfillings.com"
echo "   (https after SSL setup)"
echo ""
