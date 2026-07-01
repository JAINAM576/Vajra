/**
 * Vajra Lock App — Utility Helpers
 * Shared generators for activation keys, ticket IDs, and device IDs.
 */

const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O/1/I for readability

/**
 * Generate a random string of given length from the allowed character set.
 * @param {number} len
 * @returns {string}
 */
const randomChars = (len) => {
  let result = '';
  for (let i = 0; i < len; i++) {
    result += CHARS[Math.floor(Math.random() * CHARS.length)];
  }
  return result;
};

/**
 * Generate an activation key in format VAJRA-XXXX-XXXXXX
 * @returns {string} e.g. "VAJRA-A3K9-HJP4TN"
 */
const generateActivationKey = () => {
  return `VAJRA-${randomChars(4)}-${randomChars(6)}`;
};

/**
 * Generate a ticket ID with zero-padded counter.
 * @param {number} lastTicketNumber — the most recent ticket number (0 if none exist)
 * @returns {string} e.g. "TKT-001", "TKT-042"
 */
const generateTicketId = (lastTicketNumber) => {
  const next = (lastTicketNumber || 0) + 1;
  return `TKT-${String(next).padStart(3, '0')}`;
};

/**
 * Generate a unique device ID using base-36 timestamp.
 * @returns {string} e.g. "dev-lz1abc2d"
 */
const generateDeviceId = () => {
  return `dev-${Date.now().toString(36)}`;
};

module.exports = {
  generateActivationKey,
  generateTicketId,
  generateDeviceId,
};
