'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const BASE_DIR = path.resolve(__dirname, '..');
const CRYPTO_CONFIG_DIR = path.join(BASE_DIR, 'network', 'crypto-config');
const KEYS_OUT_DIR = path.join(BASE_DIR, 'keys');
const BACKEND_KEYS_DIR = path.join(BASE_DIR, 'backend', 'storage', 'keys');

[KEYS_OUT_DIR, BACKEND_KEYS_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

console.log('📦 Exporting and organizing consortium cryptographic keys...');

// Helper to copy file
function copyKey(src, dest) {
  if (fs.existsSync(src)) {
    const parent = path.dirname(dest);
    if (!fs.existsSync(parent)) fs.mkdirSync(parent, { recursive: true });
    fs.copyFileSync(src, dest);
    return true;
  }
  return false;
}

// 1. Org1 Academic Department Keys
const org1AdminSk = path.join(CRYPTO_CONFIG_DIR, 'peerOrganizations/org1.academic.edu/users/Admin@org1.academic.edu/msp/keystore/priv_sk');
const org1AdminCert = path.join(CRYPTO_CONFIG_DIR, 'peerOrganizations/org1.academic.edu/users/Admin@org1.academic.edu/msp/signcerts/Admin@org1.academic.edu-cert.pem');
const org1User1Sk = path.join(CRYPTO_CONFIG_DIR, 'peerOrganizations/org1.academic.edu/users/User1@org1.academic.edu/msp/keystore/priv_sk');
const org1User1Cert = path.join(CRYPTO_CONFIG_DIR, 'peerOrganizations/org1.academic.edu/users/User1@org1.academic.edu/msp/signcerts/User1@org1.academic.edu-cert.pem');
const org1CaCert = path.join(CRYPTO_CONFIG_DIR, 'peerOrganizations/org1.academic.edu/ca/ca.org1.academic.edu-cert.pem');

// 2. Org2 Examination Board Keys
const org2AdminSk = path.join(CRYPTO_CONFIG_DIR, 'peerOrganizations/org2.academic.edu/users/Admin@org2.academic.edu/msp/keystore/priv_sk');
const org2AdminCert = path.join(CRYPTO_CONFIG_DIR, 'peerOrganizations/org2.academic.edu/users/Admin@org2.academic.edu/msp/signcerts/Admin@org2.academic.edu-cert.pem');

// 3. Org3 Administration / Verifier Keys
const org3AdminSk = path.join(CRYPTO_CONFIG_DIR, 'peerOrganizations/org3.academic.edu/users/Admin@org3.academic.edu/msp/keystore/priv_sk');
const org3AdminCert = path.join(CRYPTO_CONFIG_DIR, 'peerOrganizations/org3.academic.edu/users/Admin@org3.academic.edu/msp/signcerts/Admin@org3.academic.edu-cert.pem');

// Targets
const keyMappings = [
  { src: org1AdminSk, name: 'org1_academic/org1_admin_private_key.pem' },
  { src: org1AdminCert, name: 'org1_academic/org1_admin_cert.pem' },
  { src: org1User1Sk, name: 'org1_academic/org1_user1_private_key.pem' },
  { src: org1User1Cert, name: 'org1_academic/org1_user1_cert.pem' },
  { src: org1CaCert, name: 'org1_academic/org1_ca_cert.pem' },

  { src: org2AdminSk, name: 'org2_examination/org2_admin_private_key.pem' },
  { src: org2AdminCert, name: 'org2_examination/org2_admin_cert.pem' },

  { src: org3AdminSk, name: 'org3_governance/org3_admin_private_key.pem' },
  { src: org3AdminCert, name: 'org3_governance/org3_admin_cert.pem' }
];

keyMappings.forEach(item => {
  const dest1 = path.join(KEYS_OUT_DIR, item.name);
  const dest2 = path.join(BACKEND_KEYS_DIR, item.name);
  copyKey(item.src, dest1);
  copyKey(item.src, dest2);
});

// 4. Generate Student Cryptographic Keypairs (ECDSA prime256v1 / secp256r1)
console.log('🔑 Generating Student Demo ECDSA P-256 Keypairs for Non-Repudiation...');
const { privateKey, publicKey } = crypto.generateKeyPairSync('ec', {
  namedCurve: 'prime256v1',
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
});

const studentDemoDir = path.join(KEYS_OUT_DIR, 'student_demo');
const studentDemoBackendDir = path.join(BACKEND_KEYS_DIR, 'student_demo');
[studentDemoDir, studentDemoBackendDir].forEach(d => {
  if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
});

fs.writeFileSync(path.join(studentDemoDir, 'student_demo_private_key.pem'), privateKey);
fs.writeFileSync(path.join(studentDemoDir, 'student_demo_public_key.pem'), publicKey);
fs.writeFileSync(path.join(studentDemoBackendDir, 'student_demo_private_key.pem'), privateKey);
fs.writeFileSync(path.join(studentDemoBackendDir, 'student_demo_public_key.pem'), publicKey);

// Export hex public key format
const pubKeyDer = crypto.createPublicKey(publicKey).export({ type: 'spki', format: 'der' });
const pubKeyHex = pubKeyDer.toString('hex');
fs.writeFileSync(path.join(studentDemoDir, 'student_demo_public_key_hex.txt'), pubKeyHex);
fs.writeFileSync(path.join(studentDemoBackendDir, 'student_demo_public_key_hex.txt'), pubKeyHex);

// Calculate Fingerprints
const keySummary = {
  generatedAt: new Date().toISOString(),
  consortium: 'Academic Blockchain (Org1, Org2, Org3)',
  curve: 'ECDSA prime256v1 / secp256r1',
  keys: {
    org1Academic: {
      organization: 'Org1 - University / Academic Department',
      mspId: 'Org1MSP',
      adminPrivateKey: 'keys/org1_academic/org1_admin_private_key.pem',
      adminCert: 'keys/org1_academic/org1_admin_cert.pem',
      user1PrivateKey: 'keys/org1_academic/org1_user1_private_key.pem',
      user1Cert: 'keys/org1_academic/org1_user1_cert.pem',
      caCert: 'keys/org1_academic/org1_ca_cert.pem',
      purpose: 'Endorsement of student registration, stage 1-3 academic approvals (Faculty, HOD, DAC)'
    },
    org2Examination: {
      organization: 'Org2 - Examination Board',
      mspId: 'Org2MSP',
      adminPrivateKey: 'keys/org2_examination/org2_admin_private_key.pem',
      adminCert: 'keys/org2_examination/org2_admin_cert.pem',
      purpose: 'Stage 4 Exam Grade Lockdown and Cryptographic Merkle Digest Endorsement'
    },
    org3Governance: {
      organization: 'Org3 - Administration & Governance',
      mspId: 'Org3MSP',
      adminPrivateKey: 'keys/org3_governance/org3_admin_private_key.pem',
      adminCert: 'keys/org3_governance/org3_admin_cert.pem',
      purpose: 'Stage 5-6 Dean Sanction, Clearance Authorization, Certificate Issuance and Revocation'
    },
    studentDemo: {
      entity: 'Student Identity (Decentralized PKI / Contributor 1.1)',
      studentId: 'STU-1001',
      privateKey: 'keys/student_demo/student_demo_private_key.pem',
      publicKey: 'keys/student_demo/student_demo_public_key.pem',
      publicKeyHex: pubKeyHex,
      sha256Fingerprint: crypto.createHash('sha256').update(pubKeyDer).digest('hex'),
      purpose: 'Client-side digital signing of RequestCertificate payloads to guarantee non-repudiation and prevent identity spoofing.'
    }
  }
};

fs.writeFileSync(path.join(KEYS_OUT_DIR, 'keys_summary.json'), JSON.stringify(keySummary, null, 2));
fs.writeFileSync(path.join(BACKEND_KEYS_DIR, 'keys_summary.json'), JSON.stringify(keySummary, null, 2));

console.log('✅ All cryptographic keys successfully exported to keys/ and backend/storage/keys/');
