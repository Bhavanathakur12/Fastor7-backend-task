/**
 * Comprehensive Automated Test Suite (Express.js + MySQL)
 * Tests all 6 REST API endpoints, security, authentication, authorization,
 * atomic claim concurrency, and error handling against a real MySQL database.
 */

process.env.NODE_ENV = 'test';
process.env.PORT = '5055';

require('dotenv').config();

// Ensure test JWT secret exists
if (!process.env.JWT_SECRET) {
  process.env.JWT_SECRET = 'test_jwt_secret_key_12345678901234567890';
}
process.env.JWT_EXPIRES_IN = '1h';

const { connectDB, closeDB, query } = require('../config/db');
const { createServer } = require('../server');

const BASE_URL = 'http://127.0.0.1:5055';

let server;
let passedCount = 0;
let failedCount = 0;

// Test state variables
let counselor1Token = '';
let counselor1Id = null;
let counselor2Token = '';
let counselor2Id = null;
let testEnquiryId1 = null;
let testEnquiryId2 = null;

function logPass(title) {
  passedCount++;
  console.log(`  \x1b[32m✔ PASS\x1b[0m: ${title}`);
}

function logFail(title, err) {
  failedCount++;
  console.error(`  \x1b[31m✖ FAIL\x1b[0m: ${title}`);
  if (err) console.error(`    Details:`, err.message || err);
}

async function request(path, options = {}) {
  const url = `${BASE_URL}${path}`;
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };

  const response = await fetch(url, {
    method: options.method || 'GET',
    headers,
    body:
      options.body !== undefined
        ? typeof options.body === 'string'
          ? options.body
          : JSON.stringify(options.body)
        : undefined,
  });

  let data = null;
  const text = await response.text();
  try {
    data = JSON.parse(text);
  } catch (e) {
    data = text;
  }

  return {
    status: response.status,
    headers: response.headers,
    data,
  };
}

async function runTests() {
  console.log('\n======================================================');
  console.log(' Fastor7 CRM Lead Management API - Test Suite (MySQL)');
  console.log('======================================================\n');

  try {
    // 1. Connect to MySQL Database
    console.log('Connecting to MySQL test database...');
    await connectDB();
    console.log('MySQL connected successfully.');

    // 2. Clean previous test runner records in MySQL without touching user data
    console.log('Cleaning test runner records in MySQL...');
    await query("DELETE FROM enquiries WHERE email IN ('john.doe@gmail.com', 'jane.smith@gmail.com', 'concurrent@example.com');");
    await query("DELETE FROM employees WHERE email IN ('alice@crm.example.com', 'bob@crm.example.com');");

    // 3. Start Express Test Server
    server = createServer();
    await new Promise((resolve) => server.listen(5055, resolve));
    console.log('Express test server started on port 5055.\n');

    // ----------------------------------------------------
    console.log('1. Sanity & Health Checks:');
    // ----------------------------------------------------
    {
      const res = await request('/api/health');
      if (res.status === 200 && res.data.success === true && res.data.data.framework === 'Express.js') {
        logPass('GET /api/health returns 200 and Express/MySQL status');
      } else {
        logFail('GET /api/health', new Error(JSON.stringify(res.data)));
      }
    }

    {
      const res = await request('/');
      if (res.status === 200 && res.data.success === true) {
        logPass('GET / returns 200 API information');
      } else {
        logFail('GET /', new Error(JSON.stringify(res.data)));
      }
    }

    // ----------------------------------------------------
    console.log('\n2. Counselor Registration (POST /api/auth/register):');
    // ----------------------------------------------------
    {
      // Valid registration for Counselor 1
      const res = await request('/api/auth/register', {
        method: 'POST',
        body: {
          name: 'Counselor Alice',
          email: 'alice@crm.example.com',
          password: 'Password123!',
        },
      });

      if (
        res.status === 201 &&
        res.data.success === true &&
        res.data.data.email === 'alice@crm.example.com' &&
        res.data.data.password === undefined // Crucial: password hash must NEVER be exposed
      ) {
        counselor1Id = res.data.data.id;
        logPass('POST /api/auth/register registers Counselor 1 in MySQL without exposing password');
      } else {
        logFail('POST /api/auth/register valid registration', new Error(JSON.stringify(res.data)));
      }
    }

    {
      // Duplicate registration attempt for Counselor 1
      const res = await request('/api/auth/register', {
        method: 'POST',
        body: {
          name: 'Alice Duplicate',
          email: 'alice@crm.example.com',
          password: 'AnotherPassword456',
        },
      });

      if (res.status === 409 && res.data.success === false) {
        logPass('POST /api/auth/register prevents duplicate email with 409 Conflict');
      } else {
        logFail('POST /api/auth/register duplicate email prevention', new Error(JSON.stringify(res.data)));
      }
    }

    {
      // Validation failure: missing password and invalid email
      const res = await request('/api/auth/register', {
        method: 'POST',
        body: {
          name: 'Invalid User',
          email: 'not-an-email',
          password: '123', // < 6 chars
        },
      });

      if (res.status === 400 && res.data.success === false && Array.isArray(res.data.errors)) {
        logPass('POST /api/auth/register rejects invalid email and short password with 400');
      } else {
        logFail('POST /api/auth/register validation', new Error(JSON.stringify(res.data)));
      }
    }

    {
      // Register Counselor 2 for multi-counselor isolation tests
      const res = await request('/api/auth/register', {
        method: 'POST',
        body: {
          name: 'Counselor Bob',
          email: 'bob@crm.example.com',
          password: 'Password123!',
        },
      });

      if (res.status === 201 && res.data.success === true) {
        counselor2Id = res.data.data.id;
        logPass('POST /api/auth/register registers Counselor 2 successfully in MySQL');
      } else {
        logFail('POST /api/auth/register Counselor 2', new Error(JSON.stringify(res.data)));
      }
    }

    // ----------------------------------------------------
    console.log('\n3. Counselor Login (POST /api/auth/login):');
    // ----------------------------------------------------
    {
      // Successful login for Counselor 1
      const res = await request('/api/auth/login', {
        method: 'POST',
        body: {
          email: 'alice@crm.example.com',
          password: 'Password123!',
        },
      });

      if (
        res.status === 200 &&
        res.data.success === true &&
        res.data.data.token &&
        res.data.data.counselor.email === 'alice@crm.example.com'
      ) {
        counselor1Token = res.data.data.token;
        logPass('POST /api/auth/login returns valid JWT token for Counselor 1');
      } else {
        logFail('POST /api/auth/login Counselor 1', new Error(JSON.stringify(res.data)));
      }
    }

    {
      // Successful login for Counselor 2
      const res = await request('/api/auth/login', {
        method: 'POST',
        body: {
          email: 'bob@crm.example.com',
          password: 'Password123!',
        },
      });

      if (res.status === 200 && res.data.data.token) {
        counselor2Token = res.data.data.token;
        logPass('POST /api/auth/login returns valid JWT token for Counselor 2');
      } else {
        logFail('POST /api/auth/login Counselor 2', new Error(JSON.stringify(res.data)));
      }
    }

    {
      // Login attempt with incorrect password
      const res = await request('/api/auth/login', {
        method: 'POST',
        body: {
          email: 'alice@crm.example.com',
          password: 'WrongPassword!',
        },
      });

      if (res.status === 401 && res.data.success === false) {
        logPass('POST /api/auth/login rejects incorrect password with 401 Unauthorized');
      } else {
        logFail('POST /api/auth/login wrong password', new Error(JSON.stringify(res.data)));
      }
    }

    {
      // Login attempt with non-existent email
      const res = await request('/api/auth/login', {
        method: 'POST',
        body: {
          email: 'unknown@crm.example.com',
          password: 'Password123!',
        },
      });

      if (res.status === 401 && res.data.success === false) {
        logPass('POST /api/auth/login rejects non-existent email with 401 Unauthorized');
      } else {
        logFail('POST /api/auth/login non-existent email', new Error(JSON.stringify(res.data)));
      }
    }

    // ----------------------------------------------------
    console.log('\n4. Public Enquiry Submission (POST /api/enquiries):');
    // ----------------------------------------------------
    {
      // Submit Enquiry 1 without authentication
      const res = await request('/api/enquiries', {
        method: 'POST',
        body: {
          name: 'John Doe',
          email: 'john.doe@gmail.com',
          courseInterest: 'Full Stack Web Development',
          phone: '+1-555-0199',
          message: 'Interested in the evening batch starting next month.',
        },
      });

      if (
        res.status === 201 &&
        res.data.success === true &&
        res.data.data.claimed === false &&
        res.data.data.claimedBy === null &&
        res.data.data.courseInterest === 'Full Stack Web Development'
      ) {
        testEnquiryId1 = res.data.data.id;
        logPass('POST /api/enquiries creates unclaimed public enquiry 1 in MySQL (Status: 201, claimed: false)');
      } else {
        logFail('POST /api/enquiries Enquiry 1', new Error(JSON.stringify(res.data)));
      }
    }

    {
      // Submit Enquiry 2 without authentication
      const res = await request('/api/enquiries', {
        method: 'POST',
        body: {
          name: 'Jane Smith',
          email: 'jane.smith@gmail.com',
          courseInterest: 'Data Science & AI',
          phone: '+1-555-0288',
          message: 'Looking for syllabus details and placement stats.',
        },
      });

      if (res.status === 201 && res.data.data.claimed === false) {
        testEnquiryId2 = res.data.data.id;
        logPass('POST /api/enquiries creates unclaimed public enquiry 2 in MySQL');
      } else {
        logFail('POST /api/enquiries Enquiry 2', new Error(JSON.stringify(res.data)));
      }
    }

    {
      // Enquiry submission validation: missing courseInterest and invalid email
      const res = await request('/api/enquiries', {
        method: 'POST',
        body: {
          name: 'Incomplete Lead',
          email: 'bad-email-format',
        },
      });

      if (res.status === 400 && res.data.success === false && Array.isArray(res.data.errors)) {
        logPass('POST /api/enquiries validates required fields with 400 Bad Request');
      } else {
        logFail('POST /api/enquiries validation', new Error(JSON.stringify(res.data)));
      }
    }

    // ----------------------------------------------------
    console.log('\n5. Authorization Security on Protected Endpoints:');
    // ----------------------------------------------------
    {
      const res = await request('/api/enquiries/public');
      if (res.status === 401 && res.data.success === false) {
        logPass('GET /api/enquiries/public rejects unauthenticated request with 401');
      } else {
        logFail('GET /api/enquiries/public without auth', new Error(JSON.stringify(res.data)));
      }
    }

    {
      const res = await request('/api/enquiries/public', {
        headers: { Authorization: 'Bearer this_is_an_invalid_tampered_token' },
      });
      if (res.status === 401 && res.data.success === false) {
        logPass('GET /api/enquiries/public rejects invalid Bearer token with 401');
      } else {
        logFail('GET /api/enquiries/public with invalid token', new Error(JSON.stringify(res.data)));
      }
    }

    {
      const res = await request(`/api/enquiries/${testEnquiryId1}/claim`, {
        method: 'PATCH',
      });
      if (res.status === 401 && res.data.success === false) {
        logPass('PATCH /api/enquiries/:id/claim rejects unauthenticated request with 401');
      } else {
        logFail('PATCH /api/enquiries/:id/claim without auth', new Error(JSON.stringify(res.data)));
      }
    }

    {
      const res = await request('/api/enquiries/my');
      if (res.status === 401 && res.data.success === false) {
        logPass('GET /api/enquiries/my rejects unauthenticated request with 401');
      } else {
        logFail('GET /api/enquiries/my without auth', new Error(JSON.stringify(res.data)));
      }
    }

    // ----------------------------------------------------
    console.log('\n6. Fetch Unclaimed Public Enquiries (GET /api/enquiries/public):');
    // ----------------------------------------------------
    {
      const res = await request('/api/enquiries/public', {
        headers: { Authorization: `Bearer ${counselor1Token}` },
      });

      const allUnclaimed = res.data.data.enquiries.every((e) => e.claimed === false);
      const hasLead1 = res.data.data.enquiries.some((e) => Number(e.id) === Number(testEnquiryId1));
      const hasLead2 = res.data.data.enquiries.some((e) => Number(e.id) === Number(testEnquiryId2));

      if (
        res.status === 200 &&
        res.data.success === true &&
        allUnclaimed &&
        hasLead1 &&
        hasLead2
      ) {
        logPass('GET /api/enquiries/public returns unclaimed enquiries to Counselor 1');
      } else {
        logFail('GET /api/enquiries/public count check', new Error(JSON.stringify(res.data)));
      }
    }

    // ----------------------------------------------------
    console.log('\n7. Claim Enquiry Lifecycle (PATCH /api/enquiries/:id/claim):');
    // ----------------------------------------------------
    {
      // Counselor 1 claims Enquiry 1
      const res = await request(`/api/enquiries/${testEnquiryId1}/claim`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${counselor1Token}` },
      });

      if (
        res.status === 200 &&
        res.data.success === true &&
        res.data.data.claimed === true &&
        Number(res.data.data.claimedBy) === Number(counselor1Id) &&
        res.data.data.claimedByEmail === 'alice@crm.example.com' &&
        res.data.data.claimedAt !== null
      ) {
        logPass('PATCH /api/enquiries/:id/claim allows Counselor 1 to claim Enquiry 1 via MySQL atomic update');
      } else {
        logFail('PATCH /api/enquiries/:id/claim Counselor 1', new Error(JSON.stringify(res.data)));
      }
    }

    {
      // Verify Enquiry 1 is REMOVED from the public unclaimed list
      const res = await request('/api/enquiries/public', {
        headers: { Authorization: `Bearer ${counselor1Token}` },
      });

      const foundEnquiry1 = res.data.data.enquiries.some((e) => Number(e.id) === Number(testEnquiryId1));
      const foundEnquiry2 = res.data.data.enquiries.some((e) => Number(e.id) === Number(testEnquiryId2));

      if (res.status === 200 && !foundEnquiry1 && foundEnquiry2 && res.data.data.count === 1) {
        logPass('Claimed enquiry is successfully removed from public unclaimed pool');
      } else {
        logFail('Public pool removal verification', new Error(JSON.stringify(res.data)));
      }
    }

    // ----------------------------------------------------
    console.log('\n8. Concurrency & Duplicate Claim Prevention:');
    // ----------------------------------------------------
    {
      // Counselor 2 attempts to claim the ALREADY CLAIMED Enquiry 1
      const res = await request(`/api/enquiries/${testEnquiryId1}/claim`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${counselor2Token}` },
      });

      if (res.status === 409 && res.data.success === false) {
        logPass('PATCH /api/enquiries/:id/claim prevents Counselor 2 from claiming already claimed enquiry (409 Conflict)');
      } else {
        logFail('Duplicate claim by Counselor 2', new Error(JSON.stringify(res.data)));
      }
    }

    {
      // Counselor 1 attempts to re-claim their already claimed Enquiry 1
      const res = await request(`/api/enquiries/${testEnquiryId1}/claim`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${counselor1Token}` },
      });

      if (
        res.status === 409 &&
        res.data.success === false &&
        res.data.message === 'You have already claimed this enquiry'
      ) {
        logPass('PATCH /api/enquiries/:id/claim prevents re-claiming own enquiry with exact message (409 Conflict)');
      } else {
        logFail('Re-claim by Counselor 1', new Error(JSON.stringify(res.data)));
      }
    }

    // ----------------------------------------------------
    console.log('\n9. Counselor Isolation (GET /api/enquiries/my):');
    // ----------------------------------------------------
    {
      // Counselor 1 checks their claimed enquiries -> Must contain Enquiry 1
      const res = await request('/api/enquiries/my', {
        headers: { Authorization: `Bearer ${counselor1Token}` },
      });

      const hasEnquiry1 = res.data.data.enquiries.some((e) => Number(e.id) === Number(testEnquiryId1));
      if (res.status === 200 && res.data.data.count === 1 && hasEnquiry1) {
        logPass('GET /api/enquiries/my returns Enquiry 1 to Counselor 1');
      } else {
        logFail('GET /api/enquiries/my Counselor 1', new Error(JSON.stringify(res.data)));
      }
    }

    {
      // Counselor 2 checks their claimed enquiries -> Must NOT contain Enquiry 1 (0 claimed)
      const res = await request('/api/enquiries/my', {
        headers: { Authorization: `Bearer ${counselor2Token}` },
      });

      if (res.status === 200 && res.data.data.count === 0 && res.data.data.enquiries.length === 0) {
        logPass('GET /api/enquiries/my isolates Counselor 2 from Counselor 1’s claimed enquiries');
      } else {
        logFail('GET /api/enquiries/my Counselor 2 isolation', new Error(JSON.stringify(res.data)));
      }
    }

    {
      // Counselor 2 claims Enquiry 2
      const res = await request(`/api/enquiries/${testEnquiryId2}/claim`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${counselor2Token}` },
      });

      if (res.status === 200 && Number(res.data.data.claimedBy) === Number(counselor2Id)) {
        logPass('Counselor 2 successfully claims Enquiry 2');
      } else {
        logFail('Counselor 2 claiming Enquiry 2', new Error(JSON.stringify(res.data)));
      }
    }

    {
      // Verify claimed test enquiries are removed from public pool
      const res = await request('/api/enquiries/public', {
        headers: { Authorization: `Bearer ${counselor1Token}` },
      });

      const hasLead1 = res.data.data.enquiries.some((e) => Number(e.id) === Number(testEnquiryId1));
      const hasLead2 = res.data.data.enquiries.some((e) => Number(e.id) === Number(testEnquiryId2));

      if (res.status === 200 && !hasLead1 && !hasLead2) {
        logPass('Claimed test enquiries are successfully removed from public pool');
      } else {
        logFail('Public pool check', new Error(JSON.stringify(res.data)));
      }
    }

    {
      // TRUE PARALLEL RACE CONDITION TEST:
      // Submit a fresh Enquiry 3 and have both counselors race to claim it simultaneously
      const leadRes = await request('/api/enquiries', {
        method: 'POST',
        body: {
          name: 'Concurrent Lead',
          email: 'concurrent@example.com',
          courseInterest: 'DevOps & Cloud Engineering',
        },
      });
      const raceEnquiryId = leadRes.data.data.id;

      // Fire both claim requests concurrently at the exact same millisecond
      const [raceRes1, raceRes2] = await Promise.all([
        request(`/api/enquiries/${raceEnquiryId}/claim`, {
          method: 'PATCH',
          headers: { Authorization: `Bearer ${counselor1Token}` },
        }),
        request(`/api/enquiries/${raceEnquiryId}/claim`, {
          method: 'PATCH',
          headers: { Authorization: `Bearer ${counselor2Token}` },
        }),
      ]);

      const statuses = [raceRes1.status, raceRes2.status].sort();
      if (statuses[0] === 200 && statuses[1] === 409) {
        logPass('Simultaneous Promise.all race condition test: exactly 1 wins (200 OK) and 1 loses (409 Conflict)');
      } else {
        logFail('Race condition test', new Error(`Statuses: ${raceRes1.status}, ${raceRes2.status}`));
      }
    }

    // ----------------------------------------------------
    console.log('\n10. Edge Cases, Routing & Error Handling:');
    // ----------------------------------------------------
    {
      // Claim with invalid ID format
      const res = await request('/api/enquiries/invalid-id-format/claim', {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${counselor1Token}` },
      });

      if (res.status === 400 && res.data.success === false) {
        logPass('PATCH /api/enquiries/:id/claim returns 400 for invalid numeric ID format');
      } else {
        logFail('Invalid numeric ID test', new Error(JSON.stringify(res.data)));
      }
    }

    {
      // Claim with non-existent valid numeric ID
      const nonExistentId = 999999;
      const res = await request(`/api/enquiries/${nonExistentId}/claim`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${counselor1Token}` },
      });

      if (res.status === 404 && res.data.success === false) {
        logPass('PATCH /api/enquiries/:id/claim returns 404 for non-existent enquiry in MySQL');
      } else {
        logFail('Non-existent enquiry test', new Error(JSON.stringify(res.data)));
      }
    }

    {
      // Malformed JSON body in request
      const res = await request('/api/auth/login', {
        method: 'POST',
        body: '{"email": "alice@crm.example.com", "password": ', // malformed JSON
      });

      if (res.status === 400 && res.data.success === false) {
        logPass('Express handles malformed JSON with 400 Bad Request');
      } else {
        logFail('Malformed JSON test', new Error(JSON.stringify(res.data)));
      }
    }

    {
      // Unrecognized route -> 404
      const res = await request('/api/non-existent-route');
      if (res.status === 404 && res.data.success === false) {
        logPass('Unrecognized route returns 404 Not Found');
      } else {
        logFail('404 Route Not Found test', new Error(JSON.stringify(res.data)));
      }
    }
  } catch (err) {
    console.error('\nFatal test execution error:', err);
    failedCount++;
  } finally {
    // Teardown
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
    try {
      await query("DELETE FROM enquiries WHERE email IN ('john.doe@gmail.com', 'jane.smith@gmail.com', 'concurrent@example.com');");
      await query("DELETE FROM employees WHERE email IN ('alice@crm.example.com', 'bob@crm.example.com');");
    } catch (e) {}
    await closeDB();

    console.log('\n======================================================');
    console.log(` Test Summary: ${passedCount} Passed | ${failedCount} Failed`);
    console.log('======================================================\n');

    if (failedCount > 0) {
      process.exit(1);
    } else {
      process.exit(0);
    }
  }
}

runTests();
