/**
 * Express Enquiry Routes
 */

const express = require('express');
const router = express.Router();
const enquiryController = require('../controllers/enquiryController');
const { authenticateToken } = require('../middleware/authMiddleware');

// 3. Public Enquiry Submission (No Auth required)
router.post('/', enquiryController.createEnquiry);

// 4. Fetch Unclaimed Public Enquiries (Counselor Auth required)
router.get('/public', authenticateToken, enquiryController.getPublicEnquiries);

// 5. Claim an Enquiry (Counselor Auth required)
router.patch('/:id/claim', authenticateToken, enquiryController.claimEnquiry);

// 6. Fetch Enquiries Claimed by the Logged-In Counselor (Counselor Auth required)
router.get('/my', authenticateToken, enquiryController.getMyEnquiries);

module.exports = router;
