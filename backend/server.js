/**
 * CRM Lead/Enquiry Management REST API
 * Express.js + MySQL Implementation
 */

require('dotenv').config();
const http = require('http');
const express = require('express');
const { connectDB, closeDB } = require('./config/db');
const { handleCors } = require('./middleware/corsMiddleware');
const router = require('./routes/router');
const { sendError } = require('./utils/response');

const PORT = parseInt(process.env.PORT, 10) || 5000;
const NODE_ENV = process.env.NODE_ENV || 'development';

/**
 * Create and configure Express application
 * @returns {express.Express}
 */
function createApp() {
  const app = express();

  // 1. CORS and preflight handling
  app.use(handleCors);

  // 2. Body Parser with payload limit
  const maxBodySize = parseInt(process.env.MAX_BODY_SIZE, 10) || 1048576; // 1 MB
  app.use(express.json({ limit: maxBodySize }));

  // 3. Catch JSON body parsing errors (malformed JSON & payload too large)
  app.use((err, req, res, next) => {
    if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
      return sendError(res, 400, 'Invalid JSON: Malformed request body');
    }
    if (err.type === 'entity.too.large') {
      return sendError(
        res,
        413,
        `Payload too large: Request body exceeds maximum allowed size of ${maxBodySize} bytes`
      );
    }
    return next(err);
  });

  // 4. API Routes
  app.use(router);

  // 5. 404 Handler for undefined routes
  app.use((req, res) => {
    return sendError(res, 404, `Route not found: [${req.method}] ${req.originalUrl}`);
  });

  // 6. Global Error Handler
  app.use((err, req, res, next) => {
    console.error('Unhandled Server Error:', err);
    if (!res.headersSent) {
      return sendError(res, 500, 'An unexpected internal server error occurred');
    }
  });

  return app;
}

/**
 * Create and configure HTTP Server instance
 * @returns {http.Server}
 */
function createServer() {
  const app = createApp();
  return http.createServer(app);
}

/**
 * Start the application server
 */
async function startServer() {
  try {
    // 1. Validate required environment configurations strictly - No hardcoded fallbacks
    if (!process.env.JWT_SECRET) {
      console.error(
        'FATAL CONFIGURATION ERROR: JWT_SECRET environment variable is not defined!' +
        '\nPlease set JWT_SECRET in your .env file before starting the server.'
      );
      process.exit(1);
    }

    // 2. Connect to MySQL Database & initialize tables
    console.log('Connecting to MySQL database...');
    await connectDB();
    console.log('MySQL Database connected and schema verified.');

    // 3. Initialize and Start HTTP Server
    const app = createApp();
    const server = app.listen(PORT, () => {
      console.log('====================================================');
      console.log(` Fastor7 CRM Lead Management API is running!`);
      console.log(` Framework   : Express.js`);
      console.log(` Database    : MySQL`);
      console.log(` Environment : ${NODE_ENV}`);
      console.log(` Server Port : ${PORT}`);
      console.log(` URL         : http://localhost:${PORT}`);
      console.log('====================================================');
      console.log('Available Endpoints:');
      console.log('  POST  /api/auth/register    - Register a new counselor');
      console.log('  POST  /api/auth/login       - Counselor login (returns JWT)');
      console.log('  POST  /api/enquiries        - Public enquiry submission');
      console.log('  GET   /api/enquiries/public - Fetch unclaimed enquiries (Auth)');
      console.log('  PATCH /api/enquiries/:id/claim - Claim an enquiry (Auth)');
      console.log('  GET   /api/enquiries/my     - Fetch claimed enquiries (Auth)');
      console.log('  GET   /api/health           - Server health check');
      console.log('====================================================');
    });

    // Graceful Shutdown Handlers
    const handleShutdown = async (signal) => {
      console.log(`\nReceived ${signal}. Shutting down gracefully...`);
      server.close(async () => {
        console.log('HTTP server closed.');
        try {
          await closeDB();
          console.log('MySQL connection pool closed.');
          process.exit(0);
        } catch (err) {
          console.error('Error closing database pool:', err);
          process.exit(1);
        }
      });

      setTimeout(() => {
        console.error('Forced shutdown due to timeout.');
        process.exit(1);
      }, 5000).unref();
    };

    process.on('SIGINT', () => handleShutdown('SIGINT'));
    process.on('SIGTERM', () => handleShutdown('SIGTERM'));

    return server;
  } catch (err) {
    console.error('Failed to start server:', err.message);
    if (err.code === 'ECONNREFUSED') {
      console.error(
        '\nMySQL Connection Error: Could not connect to MySQL server.' +
        '\nPlease ensure MySQL is running (e.g., via WampServer, XAMPP, or local service) and check DB_HOST/DB_PORT.'
      );
    }
    process.exit(1);
  }
}

// Automatically start if executed directly
if (require.main === module) {
  startServer();
}

module.exports = {
  createApp,
  createServer,
  startServer,
};
