#!/bin/bash
set -e

echo "=== Deploying Tiki Cottage Application ==="

APP_DIR="/var/www/tikicottage"
BACKEND_DIR="${APP_DIR}/backend"
FRONTEND_DIR="${APP_DIR}/frontend"

# Navigate to backend
echo "Building backend..."
cd ${BACKEND_DIR}
npm install --production=false
npx prisma generate
npm run build

# Run database migrations
echo "Running database migrations..."
npx prisma db push

# Seed database (only on first deployment)
read -p "Seed database with default data? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    npm run prisma:seed
fi

# Navigate to frontend
echo "Building frontend..."
cd ${FRONTEND_DIR}
npm install
npm run build

# Copy nginx configuration
echo "Configuring Nginx..."
sudo cp ${APP_DIR}/deploy/nginx.conf /etc/nginx/sites-available/tikicottage
sudo ln -sf /etc/nginx/sites-available/tikicottage /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default

# Test nginx configuration
sudo nginx -t

# Reload nginx
sudo systemctl reload nginx

# Start backend with PM2
echo "Starting backend with PM2..."
cd ${BACKEND_DIR}
pm2 delete tikicottage-backend 2>/dev/null || true
pm2 start ${APP_DIR}/deploy/ecosystem.config.js

# Save PM2 configuration
pm2 save

# Set up PM2 to start on boot
pm2 startup systemd -u $USER --hp $HOME

# Configure Stripe webhooks
echo ""
echo "=== Deployment Complete ==="
echo ""
echo "Application is now running!"
echo ""
echo "Frontend: https://tikicottage.com"
echo "Admin Panel: https://tikicottage.com/admin/login"
echo ""
echo "IMPORTANT: Configure Stripe webhook endpoint:"
echo "  URL: https://tikicottage.com/api/webhooks/stripe"
echo "  Events to listen for: checkout.session.completed"
echo "  Add the webhook secret to backend/.env as STRIPE_WEBHOOK_SECRET"
echo ""
echo "Default admin credentials:"
echo "  Email: admin@tikicottage.com"
echo "  Password: admin123"
echo "  CHANGE THIS IMMEDIATELY!"
echo ""
echo "Monitor logs with:"
echo "  pm2 logs tikicottage-backend"
echo "  sudo tail -f /var/log/nginx/error.log"
