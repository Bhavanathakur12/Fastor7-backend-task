/**
 * Request Validation Helpers
 */

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const NUMERIC_ID_REGEX = /^[1-9]\d*$/;

/**
 * Validate email string
 * @param {string} email
 * @returns {boolean}
 */
function isValidEmail(email) {
  if (typeof email !== 'string') return false;
  return EMAIL_REGEX.test(email.trim());
}

/**
 * Validate password strength (at least 6 characters)
 * @param {string} password
 * @returns {boolean}
 */
function isValidPassword(password) {
  if (typeof password !== 'string') return false;
  return password.length >= 6;
}

/**
 * Validate positive integer database ID
 * @param {string|number} id
 * @returns {boolean}
 */
function isValidId(id) {
  if (id === null || id === undefined) return false;
  const str = String(id).trim();
  return NUMERIC_ID_REGEX.test(str);
}

/**
 * Backwards compatibility alias for ID validation
 */
const isValidObjectId = isValidId;

/**
 * Validate Counselor Registration Input
 * @param {object} body
 * @returns {{ isValid: boolean, errors: string[] }}
 */
function validateRegisterInput(body) {
  const errors = [];

  if (!body || typeof body !== 'object') {
    return { isValid: false, errors: ['Request body must be a valid JSON object'] };
  }

  const { name, email, password } = body;

  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    errors.push('Name is required and must be a non-empty string');
  } else if (name.trim().length > 100) {
    errors.push('Name must not exceed 100 characters');
  }

  if (!email || !isValidEmail(email)) {
    errors.push('A valid email address is required');
  }

  if (!password || !isValidPassword(password)) {
    errors.push('Password is required and must be at least 6 characters long');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Validate Counselor Login Input
 * @param {object} body
 * @returns {{ isValid: boolean, errors: string[] }}
 */
function validateLoginInput(body) {
  const errors = [];

  if (!body || typeof body !== 'object') {
    return { isValid: false, errors: ['Request body must be a valid JSON object'] };
  }

  const { email, password } = body;

  if (!email || !isValidEmail(email)) {
    errors.push('A valid email address is required');
  }

  if (!password || typeof password !== 'string' || password.length === 0) {
    errors.push('Password is required');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Validate Public Enquiry Input
 * @param {object} body
 * @returns {{ isValid: boolean, errors: string[] }}
 */
function validateEnquiryInput(body) {
  const errors = [];

  if (!body || typeof body !== 'object') {
    return { isValid: false, errors: ['Request body must be a valid JSON object'] };
  }

  const { name, email, courseInterest, phone, message } = body;

  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    errors.push('Enquirer name is required and must be a non-empty string');
  } else if (name.trim().length > 100) {
    errors.push('Enquirer name must not exceed 100 characters');
  }

  if (!email || !isValidEmail(email)) {
    errors.push('A valid email address is required');
  }

  if (!courseInterest || typeof courseInterest !== 'string' || courseInterest.trim().length === 0) {
    errors.push('Course interest is required and must be a non-empty string');
  } else if (courseInterest.trim().length > 150) {
    errors.push('Course interest must not exceed 150 characters');
  }

  if (phone !== undefined && phone !== null && phone !== '') {
    if (typeof phone !== 'string' || phone.trim().length < 7 || phone.trim().length > 20) {
      errors.push('Phone number, if provided, must be a string between 7 and 20 characters');
    }
  }

  if (message !== undefined && message !== null && message !== '') {
    if (typeof message !== 'string' || message.trim().length > 1000) {
      errors.push('Message, if provided, must not exceed 1000 characters');
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

module.exports = {
  isValidEmail,
  isValidPassword,
  isValidId,
  isValidObjectId,
  validateRegisterInput,
  validateLoginInput,
  validateEnquiryInput,
};
