/**
 * Body Parser Helper for Express
 */

async function parseJsonBody(req, res) {
  return req.body || {};
}

module.exports = {
  parseJsonBody,
};
