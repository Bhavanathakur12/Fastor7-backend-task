/**
 * Enquiry Controller (Express)
 * Handles HTTP requests and responses for lead/enquiry operations.
 */

const { validateEnquiryInput, isValidId } = require('../utils/validator');
const { sendSuccess, sendError } = require('../utils/response');
const enquiryService = require('../services/enquiryService');

/**
 * Handle Public Enquiry Submission
 * POST /api/enquiries (No authentication required)
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
async function createEnquiry(req, res) {
  const body = req.body;

  const validation = validateEnquiryInput(body);
  if (!validation.isValid) {
    return sendError(res, 400, 'Validation failed', validation.errors);
  }

  try {
    const enquiry = await enquiryService.createEnquiry({
      name: body.name,
      email: body.email,
      courseInterest: body.courseInterest,
      phone: body.phone,
      message: body.message,
    });

    return sendSuccess(res, 201, 'Enquiry submitted successfully', enquiry);
  } catch (err) {
    const statusCode = err.statusCode || 500;
    const message = err.statusCode ? err.message : 'Internal server error while saving enquiry';
    return sendError(res, statusCode, message);
  }
}

/**
 * Retrieve all unclaimed enquiries
 * GET /api/enquiries/public (Counselor JWT authentication required)
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
async function getPublicEnquiries(req, res) {
  try {
    const enquiries = await enquiryService.getPublicUnclaimedEnquiries();
    return sendSuccess(res, 200, 'Public unclaimed enquiries retrieved successfully', {
      count: enquiries.length,
      enquiries,
    });
  } catch (err) {
    const statusCode = err.statusCode || 500;
    const message = err.statusCode ? err.message : 'Internal server error while retrieving enquiries';
    return sendError(res, statusCode, message);
  }
}

/**
 * Claim an unclaimed enquiry
 * PATCH /api/enquiries/:id/claim (Counselor JWT authentication required)
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
async function claimEnquiry(req, res) {
  const enquiryId = req.params?.id ? String(req.params.id).trim() : null;

  if (!enquiryId) {
    return sendError(res, 400, 'Enquiry ID parameter is required in the URL path');
  }

  if (!isValidId(enquiryId)) {
    return sendError(
      res,
      400,
      'Invalid enquiry ID format: ID must be a valid positive integer'
    );
  }

  // Identity is read strictly from verified token, never from untrusted request body
  const counselorId = req.user.id;
  const counselorEmail = req.user.email;

  try {
    const updatedEnquiry = await enquiryService.claimEnquiry({
      enquiryId,
      counselorId,
      counselorEmail,
    });

    return sendSuccess(res, 200, 'Enquiry successfully claimed', updatedEnquiry);
  } catch (err) {
    const statusCode = err.statusCode || 500;
    const message = err.statusCode ? err.message : 'Internal server error while claiming enquiry';
    return sendError(res, statusCode, message);
  }
}

/**
 * Retrieve enquiries claimed by currently authenticated counselor
 * GET /api/enquiries/my (Counselor JWT authentication required)
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
async function getMyEnquiries(req, res) {
  // Identity is read strictly from verified token
  const counselorId = req.user.id;

  try {
    const enquiries = await enquiryService.getCounselorClaimedEnquiries(counselorId);
    return sendSuccess(res, 200, 'Your claimed enquiries retrieved successfully', {
      count: enquiries.length,
      enquiries,
    });
  } catch (err) {
    const statusCode = err.statusCode || 500;
    const message = err.statusCode ? err.message : 'Internal server error while retrieving your enquiries';
    return sendError(res, statusCode, message);
  }
}

module.exports = {
  createEnquiry,
  getPublicEnquiries,
  claimEnquiry,
  getMyEnquiries,
};
