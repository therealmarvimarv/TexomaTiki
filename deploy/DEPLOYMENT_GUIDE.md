# Tiki Cottage Deployment Guide

Complete step-by-step guide for deploying the Tiki Cottage vacation rental booking system to your GoDaddy dedicated Linux server.

## Prerequisites

- GoDaddy Dedicated Linux Server with Ubuntu 20.04 or later
- Root or sudo access
- Domain name pointing to your server IP
- Stripe account for payments

## Deployment Steps

### 1. Initial Server Setup

SSH into your server and run the setup script:

```bash
chmod +x deploy/setup.sh
./deploy/setup.sh
```

This installs:
- Node.js 20.x
- MySQL 8.x
- Nginx
- PM2 (process manager)
- Certbot (SSL certificates)

### 2. Configure MySQL Database

Edit `deploy/database-setup.sh` and change the passwords:
- `MYSQL_ROOT_PASSWORD`
- `DB_PASSWORD`

Then run:

```bash
chmod +x deploy/database-setup.sh
./deploy/database-setup.sh
```

This creates the database and user.

### 3. Upload Application Files

Transfer your application to the server:

```bash
# From your local machine
scp -r ./* user@your-server-ip:/var/www/tikicottage/
```

Or use Git:

```bash
cd /var/www/tikicottage
git clone <your-repository-url> .
```

### 4. Configure Environment Variables

#### Backend Environment (.env)

Create `/var/www/tikicottage/backend/.env`:

```env
DATABASE_URL="mysql://tiki_user:your_secure_db_password@localhost:3306/tiki_cottage"
JWT_SECRET="generate-a-long-random-string-here"
STRIPE_SECRET_KEY="sk_live_your_stripe_secret_key"
STRIPE_WEBHOOK_SECRET="whsec_will_get_this_after_webhook_setup"
FRONTEND_URL="https://tikicottage.com"
PORT=3001
NODE_ENV="production"
```

#### Frontend Environment (.env)

Create `/var/www/tikicottage/.env`:

```env
VITE_API_URL=https://tikicottage.com
VITE_STRIPE_PUBLIC_KEY=pk_live_your_stripe_public_key
```

### 5. Set Up SSL Certificates

Edit `deploy/ssl-setup.sh` and change:
- `DOMAIN` to your domain
- `EMAIL` to your email

Then run:

```bash
chmod +x deploy/ssl-setup.sh
./deploy/ssl-setup.sh
```

### 6. Deploy Application

Run the deployment script:

```bash
chmod +x deploy/deploy.sh
./deploy/deploy.sh
```

Answer `y` when asked to seed the database (first deployment only).

### 7. Configure Stripe Webhooks

1. Go to Stripe Dashboard → Developers → Webhooks
2. Click "Add endpoint"
3. Set URL: `https://tikicottage.com/api/webhooks/stripe`
4. Select event: `checkout.session.completed`
5. Copy the signing secret (starts with `whsec_`)
6. Add it to `backend/.env` as `STRIPE_WEBHOOK_SECRET`
7. Restart backend: `pm2 restart tikicottage-backend`

### 8. Configure iCal Sync URLs

The system is pre-configured with your Airbnb, Booking.com, and VRBO iCal URLs. The sync runs automatically every 30 minutes.

You can manually trigger a sync from the admin panel or via API:
```bash
curl -X POST https://tikicottage.com/api/admin/ical/sync \
  -H "Cookie: token=your-auth-token"
```

### 9. Verify Installation

Check that everything is running:

```bash
# Check backend
pm2 status

# Check logs
pm2 logs tikicottage-backend

# Check Nginx
sudo systemctl status nginx

# Check MySQL
sudo systemctl status mysql
```

Visit your site:
- Frontend: `https://tikicottage.com`
- Admin: `https://tikicottage.com/admin/login`

Default admin credentials:
- Email: `admin@tikicottage.com`
- Password: `admin123`

**IMPORTANT: Change the admin password immediately!**

## Export iCal Feed

Your WordPress bookings are automatically exported as an iCal feed:

```
https://tikicottage.com/api/properties/default-property/ical.ics
```

Add this URL to Airbnb, Booking.com, and VRBO to sync bookings back to those platforms.

## Ongoing Maintenance

### Update Application

```bash
cd /var/www/tikicottage
git pull
./deploy/deploy.sh
```

### View Logs

```bash
# Backend logs
pm2 logs tikicottage-backend

# Nginx access logs
sudo tail -f /var/log/nginx/access.log

# Nginx error logs
sudo tail -f /var/log/nginx/error.log
```

### Restart Services

```bash
# Restart backend
pm2 restart tikicottage-backend

# Restart Nginx
sudo systemctl restart nginx

# Restart MySQL
sudo systemctl restart mysql
```

### Database Backup

```bash
mysqldump -u tiki_user -p tiki_cottage > backup-$(date +%Y%m%d).sql
```

### SSL Certificate Renewal

Automatic renewal is enabled. Test it:

```bash
sudo certbot renew --dry-run
```

## Troubleshooting

### Backend won't start

Check logs:
```bash
pm2 logs tikicottage-backend
```

Common issues:
- Database connection: Check DATABASE_URL in .env
- Port in use: Check if another service is using port 3001
- Missing dependencies: Run `npm install` in backend directory

### Nginx 502 Bad Gateway

Check backend is running:
```bash
pm2 status
curl http://localhost:3001/api/health
```

### Images not uploading

Check permissions:
```bash
chmod 755 /var/www/tikicottage/backend/uploads
chown -R $USER:$USER /var/www/tikicottage/backend/uploads
```

### Stripe webhooks not working

1. Check webhook secret in backend/.env
2. Verify webhook URL is correct in Stripe Dashboard
3. Check backend logs for webhook errors

## Security Checklist

- [ ] Change default admin password
- [ ] Set strong MySQL passwords
- [ ] Generate random JWT_SECRET
- [ ] Use production Stripe keys
- [ ] Enable firewall (ufw)
- [ ] Set up automatic security updates
- [ ] Regular database backups
- [ ] Monitor PM2 logs for errors
- [ ] Keep Node.js and dependencies updated

## Performance Optimization

### Enable Redis Caching (Optional)

```bash
sudo apt install redis-server
npm install redis --save
```

### Enable MySQL Query Cache

Edit `/etc/mysql/mysql.conf.d/mysqld.cnf`:

```ini
query_cache_type = 1
query_cache_size = 64M
```

### Monitor Resources

```bash
# CPU and Memory
htop

# Disk usage
df -h

# PM2 monitoring
pm2 monit
```

## Support

For issues, check:
1. Backend logs: `pm2 logs`
2. Nginx logs: `/var/log/nginx/error.log`
3. MySQL logs: `/var/log/mysql/error.log`

## File Structure

```
/var/www/tikicottage/
├── backend/
│   ├── src/
│   ├── prisma/
│   ├── uploads/
│   ├── .env
│   └── package.json
├── frontend/
│   ├── src/
│   ├── dist/
│   ├── .env
│   └── package.json
└── deploy/
    ├── nginx.conf
    ├── ecosystem.config.js
    └── *.sh
```
