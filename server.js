import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import path from 'path';
import { fileURLToPath } from 'url';

// Load environment variables BEFORE importing any route modules that read them
dotenv.config();

// Import modules that do not depend on env directly
import transporter from './config/mailer.js';

// Dynamically import route modules AFTER env is loaded (ensures process.env is available)
const jobRoutes = (await import('./routes/jobRoutes.js')).default;
const subscriptionRoutes = (await import('./routes/subscriptionRoutes.js')).default;
const mediaRoutes = (await import('./routes/mediaRoutes.js')).default;
const blogRoutes = (await import('./routes/blogRoutes.js')).default;
const companyRoutes = (await import('./routes/companyRoutes.js')).default;
const contactRoute = (await import('./routes/contact.js')).default;
const authRoutes = (await import('./routes/authRoutes.js')).default;
const userRoutes = (await import('./routes/userRoutes.js')).default;
const analyticsRoutes = (await import('./routes/analyticsRoutes.js')).default;
const aboutRoutes = (await import('./routes/aboutRoutes.js')).default;

const app = express();
const port = process.env.PORT || 5000;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Middleware
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: false,
}));
app.use(express.json());

// Serve uploaded static files (avatars, etc.)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// MongoDB connection (graceful if env missing)
const mongoUri = 'mongodb+srv://alvirebal123_db_user:f2LEQ3QaLt8pQqXn@cluster0.nereze5.mongodb.net/jobsite?retryWrites=true&w=majority&appName=Cluster0';
let isDbConnected = false;
let initPromise = null;

async function ensureDb() {
  try {
    if (mongoose.connection?.readyState === 1) return true;
    if (!initPromise) {
      initPromise = mongoose.connect(mongoUri)
        .then(() => {
          isDbConnected = true;
          console.log('MongoDB connected');
          return true;
        })
        .catch((err) => {
          isDbConnected = false;
          initPromise = null;
          console.error('MongoDB connection error:', err.message);
          return false;
        });
    }
    return await initPromise;
  } catch (_) {
    return false;
  }
}

// Health route
app.get('/', async (_req, res) => {
  const ok = await ensureDb();
  res.json({ status: 'ok', db: ok ? 'connected' : 'not_connected' });
});

// Contact API
app.use('/api/contact', contactRoute);

// Test mail route using global transporter
app.get('/api/test-mail', async (_req, res) => {
  try {
    await transporter.sendMail({
      from: process.env.ADMIN_EMAIL,
      to: process.env.ADMIN_EMAIL,
      subject: 'Test Mail',
      text: 'Hello! This is a test from global Nodemailer setup.',
    });
    res.send('Test email sent successfully!');
  } catch (error) {
    console.error('Error sending test mail:', error);
    res.status(500).send('Error sending email.');
  }
});

// Jobs API
app.use('/api/jobs', jobRoutes);
// Newsletter subscription: support both plural and singular endpoints
app.use('/api/subscriptions', subscriptionRoutes);
app.use('/api/subscribe', subscriptionRoutes);
app.use('/api/assets', mediaRoutes);
app.use('/api/blogs', blogRoutes);
app.use('/api/companies', companyRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/user', userRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/about', aboutRoutes);

if (!process.env.VERCEL) {
  app.listen(port, () => {
    console.log(`Backend server listening on port ${port}`);
  });
}

export default app;
