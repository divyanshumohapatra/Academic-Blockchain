'use strict';

const crypto = require('crypto');

/**
 * Generate a Decentralized Identifier (DID) for a student using SHA-256 + RIPEMD-160.
 * Method:
 * 1. Normalize name and roll number: `${name.trim().toLowerCase()}:${rollNumber.trim().toUpperCase()}`
 * 2. Compute SHA-256 hash of the normalized string.
 * 3. Compute RIPEMD-160 hash of the SHA-256 digest (classic crypto Hash160).
 * 4. Return as `did:academic:<40-hex-characters>`.
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
 * Validate format of a student DID.
 */
function isValidStudentDID(did) {
  if (typeof did !== 'string') return false;
  return /^did:academic:[0-9a-f]{40}$/i.test(did.trim());
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

module.exports = {
  generateStudentDID,
  isValidStudentDID,
  signPayload,
  verifySignature,
  getActorSigningSecret
};
