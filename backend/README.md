# Fastor7 — Node.js Developer Assignment
## CRM Lead/Enquiry Management REST API (Express.js & MySQL)

A production-grade, secure REST API backend for a CRM lead and enquiry management system built using **Node.js**, **Express.js**, and **MySQL** (`mysql2` with connection pooling).

---

## Table of Contents
1. [Architectural Overview](#architectural-overview)
2. [Technology Stack](#technology-stack)
3. [Project Directory Structure](#project-directory-structure)
4. [Relational Database Schema](#relational-database-schema)
5. [Prerequisites](#prerequisites)
6. [Installation & Setup](#installation--setup)
7. [Environment Variables](#environment-variables)
8. [Running the Application](#running-the-application)
9. [Automated Testing & Verification](#automated-testing--verification)
10. [API Documentation & Specifications](#api-documentation--specifications)
   - [1. Register Counselor (`POST /api/auth/register`)](#1-register-counselor)
   - [2. Counselor Login (`POST /api/auth/login`)](#2-counselor-login)
   - [3. Submit Public Enquiry (`POST /api/enquiries`)](#3-submit-public-enquiry)
   - [4. Fetch Unclaimed Public Enquiries (`GET /api/enquiries/public`)](#4-fetch-unclaimed-public-enquiries)
   - [5. Claim an Enquiry (`PATCH /api/enquiries/:id/claim`)](#5-claim-an-enquiry)
   - [6. Fetch My Claimed Enquiries (`GET /api/enquiries/my`)](#6-fetch-my-claimed-enquiries)
   - [7. Health Check (`GET /api/health`)](#7-health-check)
11. [Atomic Concurrency Control](#atomic-concurrency-control)
12. [Postman Testing Guide](#postman-testing-guide)

---

## Architectural Overview

- **Express.js Web Framework:** Built with Express.js utilizing modular routers, application-level error handlers, and middleware.
- **MySQL Connection Pooling:** Scalable connection pooling using `mysql2/promise` with parameterized queries to eliminate SQL injection vulnerabilities.
- **Relational Data Integrity:** Normalized `employees` and `enquiries` tables featuring primary keys, foreign keys, unique email constraints, and compound indexes.
- **Secure Authentication & Password Hashing:** JWT token issuance and verification using `jsonwebtoken` paired with salted password hashing using `bcryptjs` (10 salt rounds). Strict environment checking halts the server if `JWT_SECRET` is unset.
- **Atomic Concurrency Protection:** Employs MySQL conditional updates (`WHERE id = ? AND claimed = 0`) taking advantage of InnoDB row-level locking to guarantee two counselors cannot claim the same enquiry simultaneously.
- **Robust Security & Data Isolation:**
  - Token identity extraction ensures counselors can view and claim leads only under their verified authenticated identity.
  - JSON body parsing with strict 1MB payload caps.
  - Malformed JSON interception returning standardized 400 Bad Request responses.
  - Standardized JSON responses with HTTP status codes (200, 201, 400, 401, 404, 409, 413, 500).

---

## Technology Stack

| Component | Technology | Purpose |
|---|---|---|
| **Runtime** | Node.js (v18+) | Core JavaScript runtime |
| **Framework** | Express.js (`express`) | HTTP web framework, routing & middleware |
| **Database** | MySQL (`mysql2/promise`) | Relational database with connection pooling |
| **Authentication** | `jsonwebtoken` (JWT) | Stateless bearer token authentication |
| **Password Hashing** | `bcryptjs` | Salted cryptographic password hashing |
| **Configuration** | `dotenv` | Environment variable management |

---

## Project Directory Structure

```text
├── config/
│   └── db.js                 # MySQL connection pool, health check & schema migration
├── controllers/
│   ├── authController.js     # Counselor register & login Express handlers
│   └── enquiryController.js  # Public submission, claim & retrieval Express handlers
├── middleware/
│   ├── authMiddleware.js     # Bearer JWT verification & req.user attachment
│   ├── bodyParser.js         # Body parser compatibility helper
│   └── corsMiddleware.js     # Express CORS headers & OPTIONS preflight handler
├── routes/
│   ├── authRoutes.js         # Express router for authentication
│   ├── enquiryRoutes.js      # Express router for enquiry operations
│   └── router.js             # Root router aggregating sub-routers
├── services/
│   ├── authService.js        # Parameterized MySQL employee registration & login
│   └── enquiryService.js     # Parameterized MySQL lead creation, atomic claim & retrieval
├── tests/
│   └── test-runner.js        # Comprehensive automated test suite (31 tests against real MySQL)
├── utils/
│   ├── response.js           # Standardized success/error JSON response helpers
│   └── validator.js          # Email, password, numeric ID & schema validators
├── schema.sql                # Complete standalone MySQL DDL schema
├── .env.example              # Environment variables template
├── .gitignore                # Git exclusion file (protects .env and node_modules)
├── package.json              # Project metadata, scripts & dependencies
├── postman_collection.json   # Ready-to-import Postman collection with test assertions
├── server.js                 # Express server bootstrap & graceful shutdown
└── README.md                 # Documentation
```

---

## Relational Database Schema

The standalone DDL is defined in [schema.sql](file:///c:/Users/Gourav%20Pal/Desktop/backend/schema.sql):

### 1. `employees` Table
```sql
CREATE TABLE IF NOT EXISTS `employees` (
  `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(100) NOT NULL,
  `email` VARCHAR(255) NOT NULL UNIQUE,
  `password` VARCHAR(255) NOT NULL,
  `role` VARCHAR(50) NOT NULL DEFAULT 'counselor',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_employees_email` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

### 2. `enquiries` Table
```sql
CREATE TABLE IF NOT EXISTS `enquiries` (
  `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(100) NOT NULL,
  `email` VARCHAR(255) NOT NULL,
  `course_interest` VARCHAR(150) NOT NULL,
  `phone` VARCHAR(20) DEFAULT NULL,
  `message` TEXT DEFAULT NULL,
  `claimed` TINYINT(1) NOT NULL DEFAULT 0,
  `claimed_by` INT UNSIGNED DEFAULT NULL,
  `claimed_by_email` VARCHAR(255) DEFAULT NULL,
  `claimed_at` DATETIME DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_enquiries_claimed_created` (`claimed`, `created_at`),
  INDEX `idx_enquiries_claimed_by` (`claimed_by`, `claimed_at`),
  CONSTRAINT `fk_enquiries_claimed_by` FOREIGN KEY (`claimed_by`)
    REFERENCES `employees` (`id`)
    ON DELETE SET NULL
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

---

## Prerequisites

- **Node.js**: v18.0.0 or higher
- **npm**: v9.0.0 or higher
- **MySQL**: MySQL 8.0+ or MariaDB 10.4+ (e.g., via WampServer, XAMPP, or local MySQL service).

---

## Installation & Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Configure environment variables:**
   Copy `.env.example` to create your local `.env`:
   ```bash
   cp .env.example .env
   ```
   Configure `DB_USER` and `DB_PASSWORD` in `.env` to match your local MySQL configuration.

3. **Database Initialization:**
   The application automatically checks for and creates the database `crm_lead_db` and all required tables upon starting. Alternatively, you can run [schema.sql](file:///c:/Users/Gourav%20Pal/Desktop/backend/schema.sql) in MySQL Workbench or the MySQL CLI.

---

## Environment Variables

| Variable | Default Value | Description |
|---|---|---|
| `PORT` | `5000` | HTTP port the server listens on |
| `NODE_ENV` | `development` | Environment mode (`development`, `production`, `test`) |
| `DB_HOST` | `127.0.0.1` | MySQL server host |
| `DB_PORT` | `3306` | MySQL server port |
| `DB_USER` | `root` | MySQL user |
| `DB_PASSWORD` | `""` | MySQL password |
| `DB_NAME` | `crm_lead_db` | MySQL database name |
| `DB_CONNECTION_LIMIT` | `10` | Maximum connections in the pool |
| `JWT_SECRET` | *(Required secret key)* | Secret key used to sign and verify JWT tokens |
| `JWT_EXPIRES_IN` | `24h` | Token expiration duration |
| `MAX_BODY_SIZE` | `1048576` | Maximum allowed request body size in bytes (1MB) |

---

## Running the Application

### Development Mode (with automatic restart)
```bash
npm run dev
```

### Production Mode
```bash
npm start
```

---

## Automated Testing & Verification

The automated test runner in `tests/test-runner.js` connects to the real MySQL database, clears test tables, starts an Express server instance, and verifies all 6 endpoints, security controls, and race conditions:

```bash
npm test
```

### Test Suite Coverage (31 Passed Tests):
1. **Health Checks:** `GET /api/health` and root API info.
2. **Registration:**
   - Registers counselor securely without exposing password hash.
   - Prevents duplicate registration with HTTP `409 Conflict`.
   - Validates missing fields, invalid email, and short password (< 6 chars) with `400 Bad Request`.
3. **Login:**
   - Authenticates counselor and returns valid signed JWT token.
   - Rejects invalid password with HTTP `401 Unauthorized`.
   - Rejects non-existent email with HTTP `401 Unauthorized`.
4. **Public Enquiry Submission:**
   - Allows anonymous enquiry creation with status `201 Created`.
   - Sets `claimed: false`, `claimedBy: null`, and timestamps.
   - Enforces field validations with `400 Bad Request`.
5. **Security & Authorization:**
   - Rejects unauthenticated requests to protected endpoints with `401 Unauthorized`.
   - Rejects malformed or tampered Bearer tokens with `401 Unauthorized`.
6. **Fetch Unclaimed Enquiries:**
   - Returns public pool leads (`claimed: false`).
7. **Atomic Claiming:**
   - Counselor claims enquiry successfully.
   - Claimed enquiry is immediately removed from `GET /api/enquiries/public`.
8. **Concurrency & Duplicate Claims:**
   - Rejects attempt by another counselor to claim an already claimed lead with `409 Conflict`.
   - Rejects re-claiming already claimed leads with `409 Conflict`.
   - **True Parallel Race Condition Test (`Promise.all`):** When two counselors claim the same lead simultaneously, exactly one receives `200 OK` and the second receives `409 Conflict`.
9. **Counselor Data Isolation:**
   - `GET /api/enquiries/my` returns only enquiries claimed by the authenticated counselor.
   - Counselor 2 sees zero leads when only Counselor 1 has claimed leads.
10. **Edge Cases & Error Handling:**
   - Invalid numeric ID returns `400 Bad Request`.
   - Non-existent ID returns `404 Not Found`.
   - Malformed JSON body returns `400 Bad Request`.
   - Unrecognized routes return `404 Not Found`.

---

## API Documentation & Specifications

### 1. Register Counselor
- **Route:** `POST /api/auth/register`
- **Auth:** Public
- **Request Body:**
  ```json
  {
    "name": "Counselor Alice",
    "email": "alice@crm.example.com",
    "password": "Password123!"
  }
  ```
- **Success Response (201 Created):**
  ```json
  {
    "success": true,
    "statusCode": 201,
    "message": "Counselor registered successfully",
    "data": {
      "id": 1,
      "name": "Counselor Alice",
      "email": "alice@crm.example.com",
      "role": "counselor",
      "createdAt": "2026-10-13T..."
    }
  }
  ```

### 2. Counselor Login
- **Route:** `POST /api/auth/login`
- **Auth:** Public
- **Request Body:**
  ```json
  {
    "email": "alice@crm.example.com",
    "password": "Password123!"
  }
  ```
- **Success Response (200 OK):**
  ```json
  {
    "success": true,
    "statusCode": 200,
    "message": "Login successful",
    "data": {
      "token": "eyJhbGciOi...",
      "counselor": {
        "id": 1,
        "name": "Counselor Alice",
        "email": "alice@crm.example.com",
        "role": "counselor"
      }
    }
  }
  ```

### 3. Submit Public Enquiry
- **Route:** `POST /api/enquiries`
- **Auth:** Public
- **Request Body:**
  ```json
  {
    "name": "John Doe",
    "email": "john.doe@gmail.com",
    "courseInterest": "Full Stack Web Development",
    "phone": "+1-555-0199",
    "message": "Interested in evening batches."
  }
  ```
- **Success Response (201 Created):**
  ```json
  {
    "success": true,
    "statusCode": 201,
    "message": "Enquiry submitted successfully",
    "data": {
      "id": 1,
      "name": "John Doe",
      "email": "john.doe@gmail.com",
      "courseInterest": "Full Stack Web Development",
      "phone": "+1-555-0199",
      "message": "Interested in evening batches.",
      "claimed": false,
      "claimedBy": null,
      "claimedByEmail": null,
      "claimedAt": null,
      "createdAt": "2026-10-13T...",
      "updatedAt": "2026-10-13T..."
    }
  }
  ```

### 4. Fetch Unclaimed Public Enquiries
- **Route:** `GET /api/enquiries/public`
- **Auth:** Bearer Token
- **Success Response (200 OK):**
  ```json
  {
    "success": true,
    "statusCode": 200,
    "message": "Public unclaimed enquiries retrieved successfully",
    "data": {
      "count": 1,
      "enquiries": [
        {
          "id": 1,
          "name": "John Doe",
          "email": "john.doe@gmail.com",
          "courseInterest": "Full Stack Web Development",
          "claimed": false
        }
      ]
    }
  }
  ```

### 5. Claim an Enquiry
- **Route:** `PATCH /api/enquiries/:id/claim`
- **Auth:** Bearer Token
- **Success Response (200 OK):**
  ```json
  {
    "success": true,
    "statusCode": 200,
    "message": "Enquiry successfully claimed",
    "data": {
      "id": 1,
      "claimed": true,
      "claimedBy": 1,
      "claimedByEmail": "alice@crm.example.com",
      "claimedAt": "2026-10-13T..."
    }
  }
  ```
- **Conflict Response (409 Conflict):**
  ```json
  {
    "success": false,
    "statusCode": 409,
    "message": "This enquiry has already been claimed by another counselor"
  }
  ```

### 6. Fetch My Claimed Enquiries
- **Route:** `GET /api/enquiries/my`
- **Auth:** Bearer Token
- **Success Response (200 OK):**
  ```json
  {
    "success": true,
    "statusCode": 200,
    "message": "Your claimed enquiries retrieved successfully",
    "data": {
      "count": 1,
      "enquiries": [
        {
          "id": 1,
          "claimed": true,
          "claimedBy": 1,
          "claimedByEmail": "alice@crm.example.com"
        }
      ]
    }
  }
  ```

### 7. Health Check
- **Route:** `GET /api/health`
- **Auth:** Public
- **Success Response (200 OK):**
  ```json
  {
    "success": true,
    "statusCode": 200,
    "message": "API Health Check OK",
    "data": {
      "uptime": 12.34,
      "timestamp": "2026-10-13T...",
      "framework": "Express.js",
      "database": "MySQL"
    }
  }
  ```

---

## Atomic Concurrency Control

In MySQL InnoDB, `UPDATE` statements acquire exclusive row-level locks on candidate rows. The claim operation executes:

```sql
UPDATE enquiries
SET claimed = 1,
    claimed_by = ?,
    claimed_by_email = ?,
    claimed_at = NOW(),
    updated_at = NOW()
WHERE id = ? AND claimed = 0;
```

1. **First transaction:** Finds `claimed = 0`, acquires the lock, sets `claimed = 1`. `affectedRows` is `1`.
2. **Concurrent transaction:** Evaluates `claimed = 0`, which is now `false`. `affectedRows` is `0`.
3. The application checks the row status and returns **HTTP 409 Conflict**, preventing double-claims without requiring distributed locks.

---

## Postman Testing Guide

1. Open Postman and import `postman_collection.json`.
2. The collection variables (`baseUrl`, `token`, `counselor2Token`, `enquiryId`) automatically populate as requests execute.
3. Run the requests in order:
   - `0. Health Check`
   - `1. Register Counselor (Alice)`
   - `2. Login Counselor (Alice - Sets Token)`
   - `3. Register Counselor 2 (Bob)`
   - `4. Login Counselor 2 (Bob - Sets Counselor 2 Token)`
   - `5. Submit Public Enquiry (No Auth - Sets enquiryId)`
   - `6. Fetch Public Unclaimed Enquiries (Alice Auth)`
   - `7. Claim Enquiry (Alice Claims enquiryId)`
   - `8. Duplicate Claim Attempt (Bob tries claiming enquiryId - Expects 409)`
   - `9. Fetch My Claimed Enquiries (Alice - Expects 1 Lead)`
   - `10. Fetch My Claimed Enquiries (Bob - Expects 0 Leads - Isolation)`
