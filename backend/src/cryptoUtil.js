'use strict';

const crypto = require('crypto');

/**
 * ============================================================================
 * Cryptographic Utility for Academic Blockchain Consortium & Group 5 Security
 * 
 * Includes:
 * 1. Student Decentralized Identifier (DID) Generation & Validation
 * 2. Traditional HMAC-SHA256 Digital Signatures
 * 3. Traditional Symmetric Encryption (AES-256-GCM) for Ledger Data & Events
 *    - Professor's requirement: Secure payload extraction with authenticated encryption
 * ============================================================================
 */

// AES-256-GCM Configuration
const AES_ALGORITHM = 'aes-256-gcm';
const DEFAULT_ENCRYPTION_KEY = crypto.scryptSync(
  process.env.LEDGER_ENCRYPTION_SECRET || 'NITW-Academic-Blockchain-Ledger-Secret-2026',
  'salt-academic-consortium',
  32
);

/**
 * Generate a Decentralized Identifier (DID) for a student using SHA-256 + RIPEMD-160.
 */
function generateStudentDID(name, rollNumber) {
  if (!name || !rollNumber) {
    throw new Error('Both name and rollNumber are required to generate student DID');
  }

  const rawInput = `${name.trim().toLowerCase()}:${rollNumber.trim().toUpperCase()}`;
  const sha256Hash = crypto.createHash('sha256').update(rawInput, 'utf8').digest();
  const ripemd160Hex = crypto.createHash('ripemd160').update(sha256Hash).digest('hex');

  return `did:academic:${ripemd160Hex}`;
}

/**
 * Validate format of an academic DID.
 */
function isValidStudentDID(did) {
  if (typeof did !== 'string') return false;
  return /^did:academic:[a-f0-9]{40}$/i.test(did);
}

/**
 * Generate an HMAC digital signature for an actor signing an academic document or approval.
 */
function signPayload(payload, secretKey) {
  const serialized = typeof payload === 'object' ? JSON.stringify(payload) : String(payload);
  const secret = secretKey || 'academic-consortium-signing-key-secret-2024';
  return crypto.createHmac('sha256', secret).update(serialized).digest('hex');
}

/**
 * Verify a digital signature.
 */
function verifySignature(payload, signature, secretKey) {
  const expected = signPayload(payload, secretKey);
  return crypto.timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(signature, 'hex'));
}

/**
 * Generate a deterministic actor keypair / secret for demonstration entities.
 */
function getActorSigningSecret(actorId) {
  return crypto.createHash('sha256').update(`NITW_ACTOR_KEY_${actorId}`).digest('hex');
}

/**
 * Traditional AES-256-GCM authenticated symmetric encryption for ledger data.
 * Used for secure transmission of raw blockchain history and event stream payloads.
 * 
 * @param {any} data Object or string to encrypt
 * @param {Buffer} [customKey] Optional 32-byte Buffer key
 * @returns {object} { encrypted: true, algorithm, iv, authTag, ciphertext, timestamp }
 */
function encryptData(data, customKey = DEFAULT_ENCRYPTION_KEY) {
  const iv = crypto.randomBytes(12); // Standard 96-bit IV for GCM
  const cipher = crypto.createCipheriv(AES_ALGORITHM, customKey, iv);
  const payloadStr = typeof data === 'object' ? JSON.stringify(data) : String(data);
  let ciphertext = cipher.update(payloadStr, 'utf8', 'hex');
  ciphertext += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');

  return {
    encrypted: true,
    algorithm: AES_ALGORITHM,
    iv: iv.toString('hex'),
    authTag,
    ciphertext,
    timestamp: new Date().toISOString()
  };
}

/**
 * Traditional AES-256-GCM decryption for ledger data.
 * 
 * @param {object} encryptedObj The encrypted payload containing iv, authTag, ciphertext
 * @param {Buffer} [customKey] Optional 32-byte Buffer key
 * @returns {any} Decrypted object or string
 */
function decryptData(encryptedObj, customKey = DEFAULT_ENCRYPTION_KEY) {
  if (!encryptedObj || !encryptedObj.ciphertext || !encryptedObj.iv || !encryptedObj.authTag) {
    return encryptedObj;
  }

  const iv = Buffer.from(encryptedObj.iv, 'hex');
  const authTag = Buffer.from(encryptedObj.authTag, 'hex');
  const decipher = crypto.createDecipheriv(AES_ALGORITHM, customKey, iv);
  decipher.setAuthTag(authTag);
  
  let decrypted = decipher.update(encryptedObj.ciphertext, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  try {
    return JSON.parse(decrypted);
  } catch (err) {
    return decrypted;
  }
}

module.exports = {
  generateStudentDID,
  isValidStudentDID,
  signPayload,
  verifySignature,
  getActorSigningSecret,
  encryptData,
  decryptData,
  DEFAULT_ENCRYPTION_KEY
};
