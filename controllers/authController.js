/**
 * Authentication Controller (Express)
 * Handles HTTP requests and responses for employee/counselor registration and login.
 */

const { validateRegisterInput, validateLoginInput } = require('../utils/validator');
const { sendSuccess, sendError } = require('../utils/response');
const authService = require('../services/authService');

/**
 * Handle Counselor Registration
 * POST /api/auth/register
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
async function register(req, res) {
  const body = req.body;

  const validation = validateRegisterInput(body);
  if (!validation.isValid) {
    return sendError(res, 400, 'Validation failed', validation.errors);
  }

  try {
    const counselor = await authService.registerCounselor({
      name: body.name,
      email: body.email,
      password: body.password,
    });

    return sendSuccess(res, 201, 'Counselor registered successfully', counselor);
  } catch (err) {
    const statusCode = err.statusCode || 500;
    const message = err.statusCode ? err.message : 'Internal server error during registration';
    return sendError(res, statusCode, message);
  }
}

/**
 * Handle Counselor Login
 * POST /api/auth/login
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
async function login(req, res) {
  const body = req.body;

  const validation = validateLoginInput(body);
  if (!validation.isValid) {
    return sendError(res, 400, 'Validation failed', validation.errors);
  }

  try {
    const result = await authService.loginCounselor({
      email: body.email,
      password: body.password,
    });

    return sendSuccess(res, 200, 'Login successful', result);
  } catch (err) {
    const statusCode = err.statusCode || 500;
    const message = err.statusCode ? err.message : 'Internal server error during login';
    return sendError(res, statusCode, message);
  }
}

module.exports = {
  register,
  login,
};
