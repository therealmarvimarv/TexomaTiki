#!/bin/bash
set -e

echo "=== SSL Certificate Setup with Let's Encrypt ==="

# Your domain name (change this!)
DOMAIN="tikicottage.com"
EMAIL="admin@tikicottage.com"

echo "Setting up SSL certificate for ${DOMAIN}..."

# Stop nginx temporarily
sudo systemctl stop nginx

# Obtain certificate
sudo certbot certonly --standalone \
    -d ${DOMAIN} \
    -d www.${DOMAIN} \
    --non-interactive \
    --agree-tos \
    --email ${EMAIL} \
    --preferred-challenges http

# Start nginx
sudo systemctl start nginx

# Set up auto-renewal
echo "Setting up automatic renewal..."
sudo systemctl enable certbot.timer
sudo systemctl start certbot.timer

# Test renewal
sudo certbot renew --dry-run

echo ""
echo "=== SSL Setup Complete ==="
echo ""
echo "Certificates installed for: ${DOMAIN}"
echo "Auto-renewal is enabled via systemd timer"
echo ""
echo "Certificate locations:"
echo "  Certificate: /etc/letsencrypt/live/${DOMAIN}/fullchain.pem"
echo "  Private Key: /etc/letsencrypt/live/${DOMAIN}/privkey.pem"
