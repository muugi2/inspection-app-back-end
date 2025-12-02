const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables
// Priority: 1. Environment variables (Docker/Production), 2. config.env file (Development)
// Docker container дотор environment variables байгаа бол config.env унших шаардлагагүй
if (!process.env.DB_HOST && !process.env.PORT) {
  // Development mode - host дээр ажиллах үед config.env унших
  dotenv.config({ path: path.join(__dirname, 'config.env') });
}

// Set DATABASE_URL for Prisma
if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = `mysql://${process.env.DB_USER}:${process.env.DB_PASSWORD}@${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}`;
}

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(helmet()); // Security headers
app.use(cors()); // Enable CORS
app.use(morgan('combined')); // Logging
app.use(express.json({ limit: '50mb' })); // Parse JSON bodies (increased limit for image uploads)
app.use(express.urlencoded({ extended: true, limit: '50mb' })); // Parse URL-encoded bodies (increased limit for image uploads)

// Serve uploaded inspection images from FTP storage via HTTP
const FTP_STORAGE_PATH =
  process.env.FTP_STORAGE_PATH || path.resolve('C:/ftp_data');
app.use(
  '/uploads',
  express.static(path.resolve(FTP_STORAGE_PATH), {
    setHeaders: res => {
      res.setHeader('Cache-Control', 'public, max-age=86400');
    },
  })
);

// Routes
app.get('/', (req, res) => {
  res.json({
    message: 'Welcome to Inspection App API',
    version: '1.0.0',
    status: 'running',
  });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
  });
});

// API routes
// IMPORTANT: More specific routes should be registered before more general ones
app.use('/api/auth', require('./routes/auth'));
app.use('/api/upload', require('./routes/upload')); // Image upload endpoint
app.use('/api/inspections', require('./routes/inspections'));
app.use('/api/inspection-answers', require('./routes/answers'));
app.use('/api/organizations', require('./routes/organizations'));
app.use('/api/sites', require('./routes/sites'));
app.use('/api/contracts', require('./routes/contracts'));
app.use('/api/device-models', require('./routes/device-models'));
app.use('/api/devices', require('./routes/devices'));
app.use('/api/users', require('./routes/users'));
app.use('/api/templates', require('./routes/templates'));
app.use('/api/documents', require('./routes/documents'));

// 404 handler
app.use('*', (req, res) => {
  console.log(`[server] ❌ 404 - Route not found: ${req.method} ${req.originalUrl}`);
  console.log(`[server] Request path: ${req.path}, Base URL: ${req.baseUrl}`);
  res.status(404).json({
    error: 'Route not found',
    message: `Cannot ${req.method} ${req.originalUrl}`,
    path: req.path,
    baseUrl: req.baseUrl,
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    error: 'Something went wrong!',
    message:
      process.env.NODE_ENV === 'development'
        ? err.message
        : 'Internal server error',
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server is running on port ${PORT}`);
  console.log(`📱 API available at http://localhost:${PORT}`);
  console.log(`🏥 Health check at http://localhost:${PORT}/health`);
});

module.exports = app;
