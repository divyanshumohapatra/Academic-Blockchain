'use strict';

/**
 * ============================================================================
 * Academic Blockchain PBL — Group 5 (Contributor 5.2)
 * Automated Intent Engine & Chatbot Test Suite
 * ============================================================================
 */

const {
  detectIntent,
  extractEntities,
  handleChatMessage,
  INTENTS
} = require('./intentEngine');

const TEST_CASES = [
  // 1. STATUS_CHECK Intent Examples
  { query: "What's the status of CERT-101?", expectedIntent: INTENTS.STATUS_CHECK, expectedId: "CERT-101" },
  { query: "Check status for cert-101", expectedIntent: INTENTS.STATUS_CHECK, expectedId: "CERT-101" },
  { query: "Where is certificate CERT-102 currently at?", expectedIntent: INTENTS.STATUS_CHECK, expectedId: "CERT-102" },
  { query: "What stage is CERT-103 in right now?", expectedIntent: INTENTS.STATUS_CHECK, expectedId: "CERT-103" },
  { query: "Track cert CERT-101 progress", expectedIntent: INTENTS.STATUS_CHECK, expectedId: "CERT-101" },
  { query: "Has CERT-102 been approved yet?", expectedIntent: INTENTS.STATUS_CHECK, expectedId: "CERT-102" },
  { query: "Current state of REQ-101", expectedIntent: INTENTS.STATUS_CHECK, expectedId: "REQ-101" },

  // 2. HISTORY_LOOKUP Intent Examples
  { query: "Show me the history of CERT-101", expectedIntent: INTENTS.HISTORY_LOOKUP, expectedId: "CERT-101" },
  { query: "Give me the full audit trail for CERT-102", expectedIntent: INTENTS.HISTORY_LOOKUP, expectedId: "CERT-102" },
  { query: "What stages did CERT-101 pass through?", expectedIntent: INTENTS.HISTORY_LOOKUP, expectedId: "CERT-101" },
  { query: "Display blockchain timeline of CERT-103", expectedIntent: INTENTS.HISTORY_LOOKUP, expectedId: "CERT-103" },
  { query: "Show lifecycle progression for cert-101", expectedIntent: INTENTS.HISTORY_LOOKUP, expectedId: "CERT-101" },
  { query: "Provenance log for CERT-102", expectedIntent: INTENTS.HISTORY_LOOKUP, expectedId: "CERT-102" },

  // 3. WHO_APPROVED Intent Examples
  { query: "Who approved CERT-101?", expectedIntent: INTENTS.WHO_APPROVED, expectedId: "CERT-101" },
  { query: "Who signed off on CERT-102?", expectedIntent: INTENTS.WHO_APPROVED, expectedId: "CERT-102" },
  { query: "Which actor authorized CERT-103?", expectedIntent: INTENTS.WHO_APPROVED, expectedId: "CERT-103" },
  { query: "Who was the approver for cert-101?", expectedIntent: INTENTS.WHO_APPROVED, expectedId: "CERT-101" },
  { query: "Which department finalized CERT-102?", expectedIntent: INTENTS.WHO_APPROVED, expectedId: "CERT-102" },
  { query: "Who locked exam grades for CERT-103?", expectedIntent: INTENTS.WHO_APPROVED, expectedId: "CERT-103" },

  // 4. GENERAL_HELP Intent Examples
  { query: "What can you do?", expectedIntent: INTENTS.GENERAL_HELP, expectedId: null },
  { query: "Help", expectedIntent: INTENTS.GENERAL_HELP, expectedId: null },
  { query: "Hi, how do I use this assistant?", expectedIntent: INTENTS.GENERAL_HELP, expectedId: null },
  { query: "List supported commands and questions", expectedIntent: INTENTS.GENERAL_HELP, expectedId: null },
  { query: "Hello", expectedIntent: INTENTS.GENERAL_HELP, expectedId: null },

  // 5. Missing / Unknown Certificate ID cases
  { query: "What is the status of CERT-999?", expectedIntent: INTENTS.STATUS_CHECK, expectedId: "CERT-999" },
  { query: "Who approved without an ID?", expectedIntent: INTENTS.WHO_APPROVED, expectedId: null }
];

async function runTests() {
  console.log("===============================================================================");
  console.log(" 🧪 Contributor 5.2 — NLP Intent Engine & Chatbot Validation Suite");
  console.log("===============================================================================\n");

  let passed = 0;
  let failed = 0;

  for (let i = 0; i < TEST_CASES.length; i++) {
    const tc = TEST_CASES[i];
    const detectedIntent = detectIntent(tc.query);
    const entities = extractEntities(tc.query);
    const result = await handleChatMessage(tc.query);

    const intentMatch = detectedIntent === tc.expectedIntent;
    const idMatch = entities.certId === tc.expectedId;

    if (intentMatch && idMatch) {
      passed++;
      console.log(`✅ [Test ${i + 1}/${TEST_CASES.length}] PASS`);
    } else {
      failed++;
      console.log(`❌ [Test ${i + 1}/${TEST_CASES.length}] FAIL`);
      console.log(`   Query: "${tc.query}"`);
      console.log(`   Expected Intent: ${tc.expectedIntent}, Got: ${detectedIntent}`);
      console.log(`   Expected ID: ${tc.expectedId}, Got: ${entities.certId}`);
    }

    console.log(`   💬 Input: "${tc.query}"`);
    console.log(`   🏷️  Intent: ${result.intent}`);
    console.log(`   🤖 Reply:`);
    console.log(result.reply.split('\n').map(l => `      ${l}`).join('\n'));
    console.log(`   📦 Data Attached: ${result.data ? `Yes (${result.data.certId})` : 'No'}`);
    console.log("-------------------------------------------------------------------------------");
  }

  console.log(`\n===============================================================================`);
  console.log(` 📊 Test Results: ${passed} Passed, ${failed} Failed out of ${TEST_CASES.length} Tests`);
  console.log(`===============================================================================\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
