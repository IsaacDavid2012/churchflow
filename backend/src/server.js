const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');
const dotenv = require('dotenv');
const rateLimit = require('express-rate-limit');

dotenv.config();

const authRoutes = require('./routes/auth');
const churchRoutes = require('./routes/church');
const musiciansRoutes = require('./routes/musicians');
const positionsRoutes = require('./routes/positions');
const servicesRoutes = require('./routes/services');
const songsRoutes = require('./routes/songs');
const groupsRoutes = require('./routes/groups');
const notificationsRoutes = require('./routes/notifications');
const publicRoutes = require('./routes/public');
const { startDeadlineMonitor } = require('./services/cronService');

const app = express();
const PORT = process.env.PORT || 3000;

// Trust reverse proxy (Cloudflare Tunnel / cloudflared)
app.set('trust proxy', 1);

// CORS configuration (allow environment specified origin, church domains, and local dev)
const allowedOrigins = process.env.CORS_ORIGIN 
  ? process.env.CORS_ORIGIN.split(',').map((o) => o.trim())
  : ['http://localhost:3000', 'http://localhost:3030', 'http://localhost:5173', 'https://serve.creativeclicks.art'];

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps, curl, server-to-server)
    if (!origin || allowedOrigins.includes('*') || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(null, true); // Permissive fallback for church subdomains while maintaining headers
  },
  credentials: true,
}));

app.use(express.json());
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('dev'));
}

// Rate Limiting
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30, // 30 attempts per 15 min
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login or authentication requests from this IP. Please try again after 15 minutes.' },
});

const publicAvailLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 120, // 120 requests per 15 min
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many attendance confirmation requests. Please try again in a few minutes.' },
});

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'churchflow-worship-management',
    timestamp: new Date().toISOString(),
    church: 'Jesus My Rock Church',
  });
});

// Serve public static assets
app.use(express.static(path.join(__dirname, '../public')));

// Musician-facing token URL routes to public HTML view
app.get('/avail/:token', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/avail.html'));
});

// API Routes with rate limiters
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/public', publicAvailLimiter, publicRoutes);
app.use('/api/church', churchRoutes);
app.use('/api/musicians', musiciansRoutes);
app.use('/api/positions', positionsRoutes);
app.use('/api/services', servicesRoutes);
app.use('/api/songs', songsRoutes);
app.use('/api/groups', groupsRoutes);
app.use('/api/notifications', notificationsRoutes);

// In production, serve React frontend build
const frontendDist = path.join(__dirname, '../../frontend/dist');

// Serve hashed static assets with caching, but never index.html
app.use(express.static(frontendDist, {
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.html')) {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
    }
  }
}));

app.get('*', (req, res, next) => {
  if (req.url.startsWith('/api/') || req.url.startsWith('/avail/')) {
    return next();
  }
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  const indexPath = path.join(frontendDist, 'index.html');
  res.sendFile(indexPath, (err) => {
    if (err) {
      res.status(200).send(`
        <!DOCTYPE html>
        <html>
        <head><title>ServeSync — Jesus My Rock Church</title><meta name="viewport" content="width=device-width, initial-scale=1"></head>
        <body style="font-family: sans-serif; background: #0f172a; color: #f8fafc; padding: 40px; text-align: center;">
          <h2>Jesus My Rock Church Management API is running!</h2>
          <p>Planning Center alternative backend is active.</p>
        </body>
        </html>
      `);
    }
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: err.message || 'Internal Server Error' });
});

if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`ServeSync API running on http://localhost:${PORT}`);
    console.log(`Musician link preview: http://localhost:${PORT}/avail/<token>`);
    
    // Start background deadline monitoring
    startDeadlineMonitor(15);
  });
}

module.exports = app;
