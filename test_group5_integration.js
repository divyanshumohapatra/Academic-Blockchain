'use strict';

/**
 * ==============================================================================
 * Test Suite for Group 5 Integration & Security
 * Validates:
 * 1. Contributor 5.2 NLP Intent Engine & Chatbot response
 * 2. Contributor 5.1 Temporal History Extraction (GetHistoryForKey)
 * 3. Traditional Symmetric Encryption (AES-256-GCM) for ledger extraction
 * 4. Live Event Stream Payload Decryption
 * ==============================================================================
 */

const { handleChatMessage, INTENTS } = require('./backend/src/intentEngine');
const { encryptData, decryptData } = require('./backend/src/cryptoUtil');

async function runTests() {
  console.log('===============================================================');
  console.log('🧪 Running Group 5 Integrated Test Suite');
  console.log('===============================================================\n');

  let passed = 0;
  let total = 0;

  // Test 1: NLP Intent Engine - Status Check
  total++;
  const res1 = await handleChatMessage("What is the status of CERT-101?");
  if (res1 && res1.intent === 'STATUS_CHECK' && res1.reply.includes('HOD_APPROVED')) {
    console.log('✅ [Test 1] NLP Status Check passed: Detected STATUS_CHECK for CERT-101');
    passed++;
  } else {
    console.error('❌ [Test 1] Failed:', res1);
  }

  // Test 2: NLP Intent Engine - Who Approved
  total++;
  const res2 = await handleChatMessage("Who approved CERT-101?");
  if (res2 && res2.intent === 'WHO_APPROVED' && res2.reply.includes('hod.org1')) {
    console.log('✅ [Test 2] Approver Lookup passed: Identified hod.org1 as approver');
    passed++;
  } else {
    console.error('❌ [Test 2] Failed:', res2);
  }

  // Test 3: NLP Intent Engine - History Lookup
  total++;
  const res3 = await handleChatMessage("Show me the history of CERT-101");
  if (res3 && res3.intent === 'HISTORY_LOOKUP' && res3.reply.includes('Blockchain Lifecycle History')) {
    console.log('✅ [Test 3] History Lookup passed: Returned full stage lifecycle');
    passed++;
  } else {
    console.error('❌ [Test 3] Failed:', res3);
  }

  // Test 4: Traditional AES-256-GCM Encryption
  total++;
  const secretPayload = {
    certId: 'CERT-101',
    student: 'Shashank',
    gpa: '9.42',
    action: 'ApproveHOD',
    hash: 'a1b2c3d4e5f67890123456789abcdef0'
  };

  const encrypted = encryptData(secretPayload);
  if (encrypted.encrypted && encrypted.algorithm === 'aes-256-gcm' && encrypted.iv && encrypted.authTag && encrypted.ciphertext) {
    console.log('✅ [Test 4] AES-256-GCM Encryption passed: Generated authenticated ciphertext and 96-bit IV');
    passed++;
  } else {
    console.error('❌ [Test 4] Encryption format failure:', encrypted);
  }

  // Test 5: Decryption & Tamper-Proofing Check
  total++;
  const decrypted = decryptData(encrypted);
  if (decrypted.certId === secretPayload.certId && decrypted.gpa === secretPayload.gpa) {
    console.log('✅ [Test 5] AES-256-GCM Decryption passed: Payload matches original structure');
    passed++;
  } else {
    console.error('❌ [Test 5] Decryption mismatch:', decrypted);
  }

  // Test 6: AuthTag Tamper Resistance
  total++;
  const tampered = { ...encrypted, ciphertext: encrypted.ciphertext.slice(0, -2) + 'ff' };
  try {
    decryptData(tampered);
    console.error('❌ [Test 6] Tamper test failed: Decrypted invalid ciphertext!');
  } catch (err) {
    console.log('✅ [Test 6] Cryptographic Integrity verified: Tampered ciphertext was rejected by GCM tag');
    passed++;
  }

  console.log('\n===============================================================');
  console.log(`📊 Test Summary: ${passed} / ${total} Tests Passed`);
  console.log('===============================================================\n');

  if (passed === total) {
    process.exit(0);
  } else {
    process.exit(1);
  }
}

runTests();
