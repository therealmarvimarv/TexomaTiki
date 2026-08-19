import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import fileUpload from 'express-fileupload';
import { config } from './config.js';
import { authRouter } from './routes/auth.js';
import { propertiesRouter } from './routes/properties.js';
import { bookingsRouter } from './routes/bookings.js';
import { adminRouter } from './routes/admin.js';
import { webhookRouter } from './routes/webhooks.js';
import { startIcalSync } from './services/ical-sync.js';

const app = express();

app.use(cors({
  origin: config.frontendUrl,
  credentials: true,
}));

app.use('/api/webhooks', express.raw({ type: 'application/json' }));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(fileUpload({
  limits: { fileSize: 10 * 1024 * 1024 },
  createParentPath: true,
}));

app.use(express.static('uploads'));

app.use('/api/auth', authRouter);
app.use('/api/properties', propertiesRouter);
app.use('/api/bookings', bookingsRouter);
app.use('/api/admin', adminRouter);
app.use('/api/webhooks', webhookRouter);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

startIcalSync();

app.listen(config.port, () => {
  console.log(`Server running on port ${config.port}`);
});
