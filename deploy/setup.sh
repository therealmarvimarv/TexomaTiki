#!/bin/bash
set -e

echo "=== Tiki Cottage Deployment Setup ==="

# Update system
echo "Updating system packages..."
sudo apt update && sudo apt upgrade -y

# Install Node.js 20.x
echo "Installing Node.js..."
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Install MySQL
echo "Installing MySQL..."
sudo apt install -y mysql-server
sudo systemctl start mysql
sudo systemctl enable mysql

# Install Nginx
echo "Installing Nginx..."
sudo apt install -y nginx
sudo systemctl start nginx
sudo systemctl enable nginx

# Install PM2
echo "Installing PM2..."
sudo npm install -g pm2

# Install Certbot for Let's Encrypt
echo "Installing Certbot..."
sudo apt install -y certbot python3-certbot-nginx

# Create application directory
echo "Creating application directory..."
sudo mkdir -p /var/www/tikicottage
sudo chown -R $USER:$USER /var/www/tikicottage

# Create log directory for PM2
echo "Creating log directory..."
sudo mkdir -p /var/log/pm2
sudo chown -R $USER:$USER /var/log/pm2

# Create uploads directory
echo "Creating uploads directory..."
mkdir -p /var/www/tikicottage/backend/uploads
chmod 755 /var/www/tikicottage/backend/uploads

echo ""
echo "=== Basic Setup Complete ==="
echo ""
echo "Next steps:"
echo "1. Configure MySQL database (see database-setup.sh)"
echo "2. Upload your application files to /var/www/tikicottage"
echo "3. Configure environment variables"
echo "4. Set up SSL certificates (see ssl-setup.sh)"
echo "5. Deploy the application (see deploy.sh)"
