/**
 * Authentication Service (MySQL)
 * Business logic for counselor registration, password hashing, and JWT login.
 */

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { query } = require('../config/db');

const BCRYPT_SALT_ROUNDS = 10;

/**
 * Register a new counselor
 * @param {object} params
 * @param {string} params.name
 * @param {string} params.email
 * @param {string} params.password
 * @returns {Promise<object>} Created counselor object (without password)
 */
async function registerCounselor({ name, email, password }) {
  const normalizedEmail = email.trim().toLowerCase();

  // 1. Check if counselor with same email already exists
  const [existing] = await query('SELECT id FROM employees WHERE email = ? LIMIT 1', [
    normalizedEmail,
  ]);

  if (existing.length > 0) {
    const error = new Error('A counselor with this email address is already registered');
    error.statusCode = 409;
    throw error;
  }

  // 2. Hash password securely
  const hashedPassword = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);
  const trimmedName = name.trim();
  const now = new Date();

  try {
    const [result] = await query(
      'INSERT INTO employees (name, email, password, role, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
      [trimmedName, normalizedEmail, hashedPassword, 'counselor', now, now]
    );

    return {
      id: result.insertId,
      name: trimmedName,
      email: normalizedEmail,
      role: 'counselor',
      createdAt: now.toISOString(),
    };
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY' || err.errno === 1062) {
      const error = new Error('A counselor with this email address is already registered');
      error.statusCode = 409;
      throw error;
    }
    throw err;
  }
}

/**
 * Authenticate counselor and issue JWT
 * @param {object} params
 * @param {string} params.email
 * @param {string} params.password
 * @returns {Promise<{ token: string, counselor: object }>}
 */
async function loginCounselor({ email, password }) {
  const normalizedEmail = email.trim().toLowerCase();

  const [rows] = await query(
    'SELECT id, name, email, password, role FROM employees WHERE email = ? LIMIT 1',
    [normalizedEmail]
  );

  if (rows.length === 0) {
    const error = new Error('Invalid email or password');
    error.statusCode = 401;
    throw error;
  }

  const user = rows[0];

  const isPasswordValid = await bcrypt.compare(password, user.password);
  if (!isPasswordValid) {
    const error = new Error('Invalid email or password');
    error.statusCode = 401;
    throw error;
  }

  const secret = process.env.JWT_SECRET;
  if (!secret) {
    const error = new Error('JWT secret configuration is missing on the server');
    error.statusCode = 500;
    throw error;
  }

  const expiresIn = process.env.JWT_EXPIRES_IN || '24h';

  const tokenPayload = {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role || 'counselor',
  };

  const token = jwt.sign(tokenPayload, secret, { expiresIn });

  return {
    token,
    counselor: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role || 'counselor',
    },
  };
}

module.exports = {
  registerCounselor,
  loginCounselor,
};
