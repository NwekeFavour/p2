const crypto = require("crypto");

function generateCertificateId() {
  const year = new Date().getFullYear();
  const random = crypto.randomBytes(3).toString("hex").toUpperCase();
  return `KNOW-${year}-${random}`;
}

module.exports = generateCertificateId;