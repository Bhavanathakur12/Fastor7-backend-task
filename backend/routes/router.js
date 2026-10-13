/**
 * Express Main Router
 */

const express = require('express');
const router = express.Router();
const authRoutes = require('./authRoutes');
const enquiryRoutes = require('./enquiryRoutes');
const { sendSuccess } = require('../utils/response');

// Root & Health
router.get('/', (req, res) => {
  sendSuccess(res, 200, 'Fastor7 CRM Lead/Enquiry Management REST API is running (Express + MySQL)', {
    version: '2.0.0',
    framework: 'Express.js',
    database: 'MySQL',
    documentation: 'Refer to README.md for endpoint details',
  });
});

router.get('/api/health', (req, res) => {
  sendSuccess(res, 200, 'API Health Check OK', {
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    nodeVersion: process.version,
    framework: 'Express.js',
    database: 'MySQL',
  });
});

// Mount modular sub-routers
router.use('/api/auth', authRoutes);
router.use('/api/enquiries', enquiryRoutes);

module.exports = router;
