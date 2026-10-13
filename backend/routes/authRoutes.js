/**
 * Express Authentication Routes
 */

const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

// 1. Employee/Counselor Registration
router.post('/register', authController.register);

// 2. Employee/Counselor Login
router.post('/login', authController.login);

module.exports = router;
