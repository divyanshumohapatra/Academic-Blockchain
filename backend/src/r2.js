'use strict';

require('dotenv').config();
const crypto = require('crypto');
let S3Client = null;
let PutObjectCommand = null;
let GetObjectCommand = null;
let HeadBucketCommand = null;
let getSignedUrl = null;

try {
  const s3Sdk = require('@aws-sdk/client-s3');
  S3Client = s3Sdk.S3Client;
  PutObjectCommand = s3Sdk.PutObjectCommand;
  GetObjectCommand = s3Sdk.GetObjectCommand;
  HeadBucketCommand = s3Sdk.HeadBucketCommand;
  getSignedUrl = require('@aws-sdk/s3-request-presigner').getSignedUrl;
} catch (err) {
  console.warn('[R2] AWS S3 SDK package not loaded in environment:', err.message);
}

const BUCKET = process.env.R2_BUCKET_NAME || 'academic-certificates';

let s3 = null;
if (S3Client) {
  try {
    s3 = new S3Client({
      region: 'auto',
      endpoint: process.env.R2_S3_ENDPOINT || `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || ''
      }
    });
  } catch (err) {
    console.warn('[R2] S3Client initialization warning:', err.message);
  }
}

// SHA-256 hash of the file
function sha256(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

/**
 * Upload: PDF buffer → Cloudflare R2
 * Acts as secondary cloud backup along with IPFS.
 */
async function uploadToR2(buffer, key) {
  const cleanKey = key.replace(/^r2:\/\/[^/]+\//, '');
  const hash = sha256(buffer);
  
  if (!s3 || !process.env.R2_ACCESS_KEY_ID) {
    console.warn('[R2] Credentials missing, using simulated R2 storage URI.');
    return {
      storageUri: `r2://${BUCKET}/${cleanKey}`,
      sha256: hash,
      key: cleanKey,
      simulated: true,
      size: buffer.length
    };
  }

  try {
    await s3.send(new PutObjectCommand({
      Bucket: BUCKET,
      Key: cleanKey,
      Body: buffer,
      ContentType: 'application/pdf',
      Metadata: {
        'x-academic-sha256': hash,
        'x-uploaded-at': new Date().toISOString()
      }
    }));

    return {
      success: true,
      storageUri: `r2://${BUCKET}/${cleanKey}`,
      sha256: hash,
      key: cleanKey,
      size: buffer.length,
      simulated: false
    };
  } catch (err) {
    console.warn(`[R2] Upload failed for ${cleanKey} (${err.message}). Using fallback URI.`);
    return {
      success: false,
      storageUri: `r2://${BUCKET}/${cleanKey}`,
      sha256: hash,
      key: cleanKey,
      simulated: true,
      size: buffer.length,
      error: err.message
    };
  }
}

/**
 * Download: R2 → buffer
 */
async function fetchFromR2(key) {
  const cleanKey = key.replace(/^r2:\/\/[^/]+\//, '');
  if (!s3) {
    throw new Error('R2 client not initialized');
  }

  const res = await s3.send(new GetObjectCommand({
    Bucket: BUCKET,
    Key: cleanKey
  }));

  const chunks = [];
  for await (const c of res.Body) {
    chunks.push(c);
  }
  return Buffer.concat(chunks);
}

/**
 * Temporary download link (default 15 minutes / 900 seconds)
 */
async function getDownloadLink(key, seconds = 900) {
  const cleanKey = key.replace(/^r2:\/\/[^/]+\//, '');
  if (!s3 || !process.env.R2_ACCESS_KEY_ID) {
    return `https://${BUCKET}.r2.cloudflarestorage.com/${cleanKey}?simulated=true`;
  }

  try {
    return await getSignedUrl(s3, new GetObjectCommand({
      Bucket: BUCKET,
      Key: cleanKey
    }), { expiresIn: seconds });
  } catch (err) {
    console.warn(`[R2] Failed to generate signed URL for ${cleanKey}:`, err.message);
    return `https://${BUCKET}.r2.cloudflarestorage.com/${cleanKey}?fallback=true`;
  }
}

/**
 * Quick status / health check for Cloudflare R2
 */
async function checkR2Health() {
  const configured = Boolean(
    process.env.R2_ACCOUNT_ID &&
    process.env.R2_ACCESS_KEY_ID &&
    process.env.R2_SECRET_ACCESS_KEY &&
    process.env.R2_BUCKET_NAME
  );

  if (!configured || !s3) {
    return {
      configured: false,
      healthy: false,
      bucket: BUCKET,
      note: 'R2 environment credentials not fully configured'
    };
  }

  try {
    await s3.send(new HeadBucketCommand({ Bucket: BUCKET }));
    return {
      configured: true,
      healthy: true,
      bucket: BUCKET,
      endpoint: process.env.R2_S3_ENDPOINT
    };
  } catch (err) {
    return {
      configured: true,
      healthy: false,
      bucket: BUCKET,
      endpoint: process.env.R2_S3_ENDPOINT,
      note: err.message
    };
  }
}

module.exports = {
  uploadToR2,
  fetchFromR2,
  getDownloadLink,
  checkR2Health,
  sha256,
  BUCKET
};
