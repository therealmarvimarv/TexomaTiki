# Tiki Cottage - Vacation Rental Booking System

A complete, production-ready vacation rental booking website built with React, Node.js, Express, Prisma, and MySQL. Designed for self-hosting on dedicated servers with full control over your data.

## Features

### Frontend
- Airbnb-inspired user interface
- Responsive design (mobile-first)
- Photo gallery with lightbox
- Real-time availability checking
- Dynamic pricing calculator
- Sticky booking card
- Smooth scroll navigation
- Review display with ratings
- Interactive map

### Backend
- RESTful API with Express
- MySQL database with Prisma ORM
- Stripe payment processing
- Webhook handling for payment confirmation
- iCal import from Airbnb, Booking.com, VRBO
- iCal export for calendar sync
- Automatic calendar sync (30-minute intervals)
- Double-booking prevention
- 10-minute booking holds

### Admin Panel
- Secure authentication
- Property editor
- Image upload and management
- Pricing configuration
- Booking management
- Manual iCal sync trigger
- Drag-and-drop photo reordering

## Tech Stack

**Frontend:**
- React 18
- TypeScript
- Vite
- React Router
- Tailwind CSS
- Lucide Icons

**Backend:**
- Node.js
- Express
- TypeScript
- Prisma ORM
- MySQL
- Stripe
- iCal.js
- node-cron

**Deployment:**
- Nginx (reverse proxy)
- PM2 (process manager)
- Let's Encrypt (SSL)

## Quick Start (Development)

### Prerequisites
- Node.js 20+
- MySQL 8+

### Backend Setup

```bash
cd backend
npm install
```

Create `backend/.env`:
```env
DATABASE_URL="mysql://user:password@localhost:3306/tiki_cottage"
JWT_SECRET="your-secret-key"
STRIPE_SECRET_KEY="sk_test_..."
STRIPE_WEBHOOK_SECRET="whsec_..."
FRONTEND_URL="http://localhost:5173"
PORT=3001
NODE_ENV="development"
```

Run migrations and seed:
```bash
npx prisma generate
npx prisma db push
npm run prisma:seed
```

Start backend:
```bash
npm run dev
```

### Frontend Setup

```bash
npm install
```

Create `.env`:
```env
VITE_API_URL=http://localhost:3001
VITE_STRIPE_PUBLIC_KEY=pk_test_...
```

Start frontend:
```bash
npm run dev
```

Visit `http://localhost:5173`

## Production Deployment

See [DEPLOYMENT_GUIDE.md](deploy/DEPLOYMENT_GUIDE.md) for complete instructions.

### Quick Deploy to GoDaddy

1. Upload files to `/var/www/tikicottage`
2. Run setup scripts:
   ```bash
   cd /var/www/tikicottage/deploy
   chmod +x *.sh
   ./setup.sh
   ./database-setup.sh
   ./ssl-setup.sh
   ./deploy.sh
   ```
3. Configure Stripe webhooks
4. Access admin panel at `https://yourdomain.com/admin/login`

## Admin Credentials

Default credentials (change immediately):
- Email: `admin@tikicottage.com`
- Password: `admin123`

## API Endpoints

### Public
- `GET /api/properties/:id` - Get property details
- `GET /api/properties/:id/availability` - Check availability
- `GET /api/properties/:id/ical.ics` - Export iCal feed
- `POST /api/bookings/calculate` - Calculate pricing
- `POST /api/bookings/create` - Create booking
- `GET /api/bookings/:id` - Get booking details

### Admin (requires authentication)
- `POST /api/auth/login` - Login
- `POST /api/auth/logout` - Logout
- `GET /api/auth/me` - Get current user
- `GET /api/admin/properties/:id` - Get property for editing
- `PUT /api/admin/properties/:id` - Update property
- `POST /api/admin/properties/:id/images` - Upload image
- `DELETE /api/admin/images/:id` - Delete image
- `PUT /api/admin/images/reorder` - Reorder images
- `GET /api/admin/bookings` - List all bookings
- `POST /api/admin/ical/sync` - Manually sync iCal feeds

### Webhooks
- `POST /api/webhooks/stripe` - Stripe payment webhooks

## Database Schema

Main tables:
- `users` - Admin users
- `properties` - Property listings
- `property_images` - Photo gallery
- `highlights` - Feature highlights
- `amenities` - Available amenities
- `sleeping_arrangements` - Bedroom details
- `reviews` - Guest reviews
- `bookings` - Reservations
- `blocked_dates` - Unavailable dates
- `ical_sources` - External calendar URLs
- `pricing_rules` - Seasonal pricing

## iCal Integration

### Import (from external platforms)
Pre-configured URLs:
- Airbnb
- Booking.com
- VRBO

Syncs every 30 minutes automatically. Manual sync available in admin panel.

### Export (to external platforms)
Feed URL: `https://yourdomain.com/api/properties/default-property/ical.ics`

Add this URL to Airbnb, Booking.com, and VRBO to sync your WordPress bookings to those platforms.

## Stripe Integration

1. Create Stripe account
2. Get API keys (Developers → API keys)
3. Add to environment variables
4. Set up webhook endpoint: `https://yourdomain.com/api/webhooks/stripe`
5. Listen for event: `checkout.session.completed`
6. Add webhook secret to backend .env

## File Upload

Images are stored in `backend/uploads/` directory.

Supported formats: JPG, PNG, GIF
Max size: 10MB per image

Served by Nginx with 1-year cache headers.

## Environment Variables

### Backend
- `DATABASE_URL` - MySQL connection string
- `JWT_SECRET` - JWT signing secret
- `STRIPE_SECRET_KEY` - Stripe secret key
- `STRIPE_WEBHOOK_SECRET` - Stripe webhook signing secret
- `FRONTEND_URL` - Frontend URL for CORS
- `PORT` - Backend port (default: 3001)
- `NODE_ENV` - Environment (development/production)

### Frontend
- `VITE_API_URL` - Backend API URL
- `VITE_STRIPE_PUBLIC_KEY` - Stripe publishable key

## Security Features

- HTTPS only in production
- HTTP-only cookies for authentication
- JWT token-based auth
- CORS protection
- Input validation
- SQL injection prevention (Prisma)
- XSS protection headers
- CSRF protection
- Rate limiting (configurable)
- Secure password hashing (bcrypt)

## Performance

- Clustered Node.js with PM2 (2 instances)
- Nginx gzip compression
- Static asset caching (1 year)
- Image lazy loading
- Code splitting
- Production builds optimized

## Browser Support

- Chrome/Edge (latest 2 versions)
- Firefox (latest 2 versions)
- Safari (latest 2 versions)
- Mobile browsers (iOS Safari, Chrome)

## License

Proprietary - All rights reserved

## Support

For deployment issues, check:
- [DEPLOYMENT_GUIDE.md](deploy/DEPLOYMENT_GUIDE.md)
- Backend logs: `pm2 logs tikicottage-backend`
- Nginx logs: `/var/log/nginx/error.log`
