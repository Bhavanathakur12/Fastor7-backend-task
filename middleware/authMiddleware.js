/**
 * JWT Authentication Middleware
 * Verifies Bearer token from Authorization header and extracts counselor identity.
 */

const jwt = require('jsonwebtoken');
const { sendError } = require('../utils/response');

/**
 * Authenticate counselor via JWT token
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'] || req.headers['Authorization'];

  if (!authHeader) {
    return sendError(
      res,
      401,
      'Access denied: Missing Authorization header. Please provide a Bearer token.'
    );
  }

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return sendError(
      res,
      401,
      'Access denied: Invalid Authorization format. Expected format: "Bearer <token>"'
    );
  }

  const token = parts[1];
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    return sendError(res, 500, 'Server configuration error: JWT secret is not configured');
  }

  try {
    const decoded = jwt.verify(token, secret);
    // Attach validated counselor information to the request
    req.user = {
      id: decoded.id,
      email: decoded.email,
      name: decoded.name,
      role: decoded.role || 'counselor',
    };
    if (typeof next === 'function') {
      return next();
    }
    return true;
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return sendError(res, 401, 'Access denied: Token has expired. Please log in again.');
    }
    return sendError(res, 401, 'Access denied: Invalid authentication token');
  }
}

module.exports = {
  authenticateToken,
};
