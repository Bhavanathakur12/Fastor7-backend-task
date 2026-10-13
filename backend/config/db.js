/**
 * MySQL Connection Pool and Database Manager
 * Uses official mysql2/promise driver with connection pooling.
 */

const mysql = require('mysql2/promise');

let pool = null;

/**
 * Get active MySQL connection pool
 * @returns {import('mysql2/promise').Pool}
 */
function getPool() {
  if (!pool) {
    throw new Error('Database connection pool is not initialized. Call connectDB() first.');
  }
  return pool;
}

/**
 * Execute a SQL query using connection pool
 * @param {string} sql
 * @param {Array} [params]
 * @returns {Promise<[any, import('mysql2').FieldPacket[]]>}
 */
async function query(sql, params = []) {
  return getPool().query(sql, params);
}

/**
 * Execute a prepared SQL statement using connection pool
 * @param {string} sql
 * @param {Array} [params]
 * @returns {Promise<[any, import('mysql2').FieldPacket[]]>}
 */
async function execute(sql, params = []) {
  return getPool().execute(sql, params);
}

/**
 * Ensure database and required tables exist
 * @param {import('mysql2/promise').Pool} activePool
 */
async function initTables(activePool) {
  // 1. Employees / Counselors Table
  await activePool.query(`
    CREATE TABLE IF NOT EXISTS \`employees\` (
      \`id\` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      \`name\` VARCHAR(100) NOT NULL,
      \`email\` VARCHAR(255) NOT NULL UNIQUE,
      \`password\` VARCHAR(255) NOT NULL,
      \`role\` VARCHAR(50) NOT NULL DEFAULT 'counselor',
      \`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      \`updated_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX \`idx_employees_email\` (\`email\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  // 2. Leads / Enquiries Table
  await activePool.query(`
    CREATE TABLE IF NOT EXISTS \`enquiries\` (
      \`id\` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      \`name\` VARCHAR(100) NOT NULL,
      \`email\` VARCHAR(255) NOT NULL,
      \`course_interest\` VARCHAR(150) NOT NULL,
      \`phone\` VARCHAR(20) DEFAULT NULL,
      \`message\` TEXT DEFAULT NULL,
      \`claimed\` TINYINT(1) NOT NULL DEFAULT 0,
      \`claimed_by\` INT UNSIGNED DEFAULT NULL,
      \`claimed_by_email\` VARCHAR(255) DEFAULT NULL,
      \`claimed_at\` DATETIME DEFAULT NULL,
      \`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      \`updated_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX \`idx_enquiries_claimed_created\` (\`claimed\`, \`created_at\`),
      INDEX \`idx_enquiries_claimed_by\` (\`claimed_by\`, \`claimed_at\`),
      CONSTRAINT \`fk_enquiries_claimed_by\` FOREIGN KEY (\`claimed_by\`)
        REFERENCES \`employees\` (\`id\`)
        ON DELETE SET NULL
        ON UPDATE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);
}

/**
 * Initialize MySQL Connection Pool and ensure schema exists
 * @param {object} [customConfig]
 * @returns {Promise<import('mysql2/promise').Pool>}
 */
async function connectDB(customConfig = null) {
  if (pool) return pool;

  const host = customConfig?.host || process.env.DB_HOST || '127.0.0.1';
  const port = customConfig?.port || parseInt(process.env.DB_PORT, 10) || 3306;
  const user = customConfig?.user || process.env.DB_USER || 'root';
  const password =
    customConfig?.password !== undefined
      ? customConfig.password
      : process.env.DB_PASSWORD !== undefined
      ? process.env.DB_PASSWORD
      : '';
  const database = customConfig?.database || process.env.DB_NAME || 'crm_lead_db';
  const connectionLimit =
    customConfig?.connectionLimit || parseInt(process.env.DB_CONNECTION_LIMIT, 10) || 10;

  // Step 1: Ensure database exists by connecting with administrative credentials
  const adminConnection = await mysql.createConnection({
    host,
    port,
    user,
    password,
  });

  try {
    await adminConnection.query(
      `CREATE DATABASE IF NOT EXISTS \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`
    );
  } finally {
    await adminConnection.end();
  }

  // Step 2: Create connection pool targeting the application database
  pool = mysql.createPool({
    host,
    port,
    user,
    password,
    database,
    waitForConnections: true,
    connectionLimit,
    queueLimit: 0,
    decimalNumbers: true,
  });

  // Verify connection by pinging
  const testConn = await pool.getConnection();
  testConn.release();

  // Step 3: Run table migrations
  await initTables(pool);

  return pool;
}

/**
 * Close MySQL Connection Pool gracefully
 */
async function closeDB() {
  if (pool) {
    await pool.end();
    pool = null;
  }
}

module.exports = {
  connectDB,
  getPool,
  query,
  execute,
  closeDB,
};
