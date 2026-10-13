/**
 * Standardized JSON API Response Helpers
 */

/**
 * Send a standardized success JSON response
 * @param {import('express').Response} res - HTTP Server Response
 * @param {number} statusCode - HTTP Status code (default 200)
 * @param {string} message - Human-readable success message
 * @param {*} data - Payload data (object, array, null)
 */
function sendSuccess(res, statusCode = 200, message = 'Success', data = null) {
  const payload = {
    success: true,
    statusCode,
    message,
  };

  if (data !== undefined && data !== null) {
    payload.data = data;
  }

  if (typeof res.status === 'function' && typeof res.json === 'function') {
    return res.status(statusCode).json(payload);
  }

  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
  });
  return res.end(JSON.stringify(payload));
}

/**
 * Send a standardized error JSON response
 * @param {import('express').Response} res - HTTP Server Response
 * @param {number} statusCode - HTTP Status code (default 400)
 * @param {string} message - Human-readable error message
 * @param {*} errors - Optional array or object detailing validation errors
 */
function sendError(res, statusCode = 400, message = 'An error occurred', errors = null) {
  const payload = {
    success: false,
    statusCode,
    message,
  };

  if (errors !== undefined && errors !== null) {
    payload.errors = errors;
  }

  if (typeof res.status === 'function' && typeof res.json === 'function') {
    return res.status(statusCode).json(payload);
  }

  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
  });
  return res.end(JSON.stringify(payload));
}

module.exports = {
  sendSuccess,
  sendError,
};
