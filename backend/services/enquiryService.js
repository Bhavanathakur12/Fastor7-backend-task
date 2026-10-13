/**
 * Enquiry Service (MySQL)
 * Business logic for CRM lead/enquiry lifecycle: creation, retrieval, and atomic claiming.
 */

const { query } = require('../config/db');
const { isValidId } = require('../utils/validator');

/**
 * Format raw MySQL enquiry row into standardized camelCase API response
 * @param {object} row
 * @returns {object|null}
 */
function formatEnquiry(row) {
  if (!row) return null;
  return {
    id: row.id,
    _id: row.id, // Backwards compatibility alias for MongoDB ID reference
    name: row.name,
    email: row.email,
    courseInterest: row.course_interest,
    phone: row.phone || null,
    message: row.message || null,
    claimed: Boolean(row.claimed),
    claimedBy: row.claimed_by || null,
    claimedByEmail: row.claimed_by_email || null,
    claimedAt: row.claimed_at ? new Date(row.claimed_at).toISOString() : null,
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : null,
    updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : null,
  };
}

/**
 * Create a new public enquiry
 * @param {object} params
 * @param {string} params.name
 * @param {string} params.email
 * @param {string} params.courseInterest
 * @param {string} [params.phone]
 * @param {string} [params.message]
 * @returns {Promise<object>} Created enquiry document
 */
async function createEnquiry({ name, email, courseInterest, phone, message }) {
  const trimmedName = name.trim();
  const normalizedEmail = email.trim().toLowerCase();
  const trimmedCourse = courseInterest.trim();
  const cleanPhone = phone && typeof phone === 'string' ? phone.trim() : null;
  const cleanMessage = message && typeof message === 'string' ? message.trim() : null;
  const now = new Date();

  const [result] = await query(
    `INSERT INTO enquiries (name, email, course_interest, phone, message, claimed, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, 0, ?, ?)`,
    [trimmedName, normalizedEmail, trimmedCourse, cleanPhone, cleanMessage, now, now]
  );

  return {
    id: result.insertId,
    _id: result.insertId,
    name: trimmedName,
    email: normalizedEmail,
    courseInterest: trimmedCourse,
    phone: cleanPhone,
    message: cleanMessage,
    claimed: false,
    claimedBy: null,
    claimedByEmail: null,
    claimedAt: null,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  };
}

/**
 * Fetch all unclaimed public enquiries
 * Only returns enquiries where claimed === 0 (false)
 * @returns {Promise<Array<object>>}
 */
async function getPublicUnclaimedEnquiries() {
  const [rows] = await query(
    'SELECT * FROM enquiries WHERE claimed = 0 ORDER BY created_at DESC'
  );

  return rows.map(formatEnquiry);
}

/**
 * Claim an unclaimed enquiry atomically
 * Ensures an enquiry cannot be claimed by multiple counselors simultaneously
 * @param {object} params
 * @param {string|number} params.enquiryId - Numeric integer ID
 * @param {string|number} params.counselorId - Authenticated counselor's ID
 * @param {string} params.counselorEmail - Authenticated counselor's email
 * @returns {Promise<object>} Updated enquiry document
 */
async function claimEnquiry({ enquiryId, counselorId, counselorEmail }) {
  if (!isValidId(enquiryId)) {
    const error = new Error('Invalid enquiry ID format. Must be a valid positive integer.');
    error.statusCode = 400;
    throw error;
  }

  if (!isValidId(counselorId)) {
    const error = new Error('Invalid counselor ID format');
    error.statusCode = 400;
    throw error;
  }

  const numericEnquiryId = parseInt(enquiryId, 10);
  const numericCounselorId = parseInt(counselorId, 10);
  const now = new Date();

  // Atomic conditional update: updates ONLY if claimed === 0
  const [updateResult] = await query(
    `UPDATE enquiries
     SET claimed = 1,
         claimed_by = ?,
         claimed_by_email = ?,
         claimed_at = ?,
         updated_at = ?
     WHERE id = ? AND claimed = 0`,
    [numericCounselorId, counselorEmail, now, now, numericEnquiryId]
  );

  // If matched and updated (affectedRows === 1), return updated enquiry
  if (updateResult.affectedRows === 1) {
    const [rows] = await query('SELECT * FROM enquiries WHERE id = ? LIMIT 1', [
      numericEnquiryId,
    ]);
    return formatEnquiry(rows[0]);
  }

  // If not updated, investigate why to return precise error code
  const [existingRows] = await query(
    'SELECT id, claimed, claimed_by FROM enquiries WHERE id = ? LIMIT 1',
    [numericEnquiryId]
  );

  if (existingRows.length === 0) {
    const error = new Error(`Enquiry with ID ${enquiryId} not found`);
    error.statusCode = 404;
    throw error;
  }

  if (existingRows[0].claimed) {
    if (Number(existingRows[0].claimed_by) === numericCounselorId) {
      const error = new Error('You have already claimed this enquiry');
      error.statusCode = 409;
      throw error;
    }

    const error = new Error('This enquiry has already been claimed by another counselor');
    error.statusCode = 409;
    throw error;
  }

  const error = new Error(
    'Failed to claim enquiry due to a concurrency conflict. Please try again.'
  );
  error.statusCode = 409;
  throw error;
}

/**
 * Fetch all enquiries claimed by a specific counselor
 * Only returns enquiries assigned to the requesting counselor
 * @param {string|number} counselorId
 * @returns {Promise<Array<object>>}
 */
async function getCounselorClaimedEnquiries(counselorId) {
  if (!isValidId(counselorId)) {
    const error = new Error('Invalid counselor ID format');
    error.statusCode = 400;
    throw error;
  }

  const numericCounselorId = parseInt(counselorId, 10);

  const [rows] = await query(
    'SELECT * FROM enquiries WHERE claimed = 1 AND claimed_by = ? ORDER BY claimed_at DESC, created_at DESC',
    [numericCounselorId]
  );

  return rows.map(formatEnquiry);
}

module.exports = {
  createEnquiry,
  getPublicUnclaimedEnquiries,
  claimEnquiry,
  getCounselorClaimedEnquiries,
};
