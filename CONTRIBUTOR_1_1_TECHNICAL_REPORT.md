# 🎓 Academic Blockchain & Multi-Agent Consortium
## Contributor 1.1 Engineering Technical Report & Contribution Blueprint
**Designation**: Academic Chaincode & Student Decentralized Identity Lead  
**Organization**: `Org1MSP` (University / Academic Department)  
**Consortium Nodes**: `peer0.org1.academic.edu:7051` • `couchdb0:5984` • `orderer.academic.edu:7050`  
**Core Technologies**: Hyperledger Fabric 2.5 • CouchDB • Node.js • NIST P-256 / ECDSA Cryptography • Express REST API  

---

## Executive Summary

In traditional university accreditation systems, certificate fraud, diploma mills, and unauthorized transcript modifications threaten institutional integrity. The **Academic Blockchain & Agentic Consortium** solves this via a decentralized **3-Organization Hyperledger Fabric 2.5 consortium** (Org1: Academic Dept, Org2: Exam Board, Org3: Governance/Verifier) with IPFS distributed storage and autonomous multi-agent verification.

As **Contributor 1.1 (Academic Chaincode Lead)**, your primary responsibility governs **Module 1 (Student Identity Lifecycle & Onboarding)** and the statutory entry gateway of **Module 2 (Certificate Request Submission & Prerequisite Verification)**. Furthermore, to elevate this project beyond baseline academic requirements, key enhancements were designed and implemented:
1. **Student Cryptographic Decentralized Identity (DID/PKI)** with NIST P-256 (secp256r1) keypair generation and on-chain public key anchoring.
2. **Cryptographic Non-Repudiation Request Signing** (ECDSA with SHA-256), mathematically preventing identity theft, request spoofing, or unauthorized certificate requests by administrative staff.
3. **Automated Latin Academic Honors & Standing Engine** (`SUMMA_CUM_LAUDE`, `MAGNA_CUM_LAUDE`, `CUM_LAUDE`, `DEAN_HONOR_ROLL`, `ACADEMIC_PROBATION`) attested directly onto immutable ledger state.
4. **Course Prerequisite Dependency Directed Acyclic Graph (DAG) Engine**, enforcing foundational coursework sequences (e.g., `CS101 -> CS201 -> CS301`).
5. **Deterministic Transcript SHA-256 Digest Anchoring**, creating a tamper-evident cryptographic fingerprint of student transcripts directly in the request state.

---

## Architecture & Work Breakdown

```
+----------------------------------------------------------------------------------------------------+
|                                      CLIENT & GATEWAY LAYER                                        |
|  • Student Web Portal (Modern White/Light UI Theme)                                                |
|  • Express REST API Gateway (Port 4000)                                                            |
|  • Cryptographic Key Center & In-Browser Key Inspector                                             |
+----------------------------------------------------------------------------------------------------+
                                                  │
                                                  ▼
+----------------------------------------------------------------------------------------------------+
|                         ORG 1: UNIVERSITY / ACADEMIC DEPARTMENT (Org1MSP)                          |
|  • peer0.org1.academic.edu:7051 (Hyperledger Fabric 2.5)                                            |
|  • couchdb0:5984 (Rich query indexes for department data & enrollment)                             |
|  • Chaincode Functions: RegisterStudent, UpdateStudentAcademicRecord, RequestCertificate          |
|  • Enhancements: Digital Signature Validation, Latin Honors Engine, Prerequisite DAG Validator    |
|  • Org 1 Autonomous Agents: FacultyAgent -> HODAgent -> DACAgent (Stages 1–3 Approvals)            |
+----------------------------------------------------------------------------------------------------+
                                                  │
                                                  ▼
+----------------------------------------------------------------------------------------------------+
|                             CONSORTIUM CONSENSUS & DOWNSTREAM MODULES                              |
|  • Raft Ordering Service (orderer.academic.edu:7050)                                               |
|  • Org 2 (Exam Board): Exam Grade Lockdown (Stage 4)                                               |
|  • Org 3 (Governance): Dean Sanction (Stage 5), Admin Finalize (Stage 6), Issuance & Revocation    |
|  • IPFS Kubo Cluster (5001/8080): Verifiable High-Density QR PDF Storage & SHA-256 Hash Anchoring  |
+----------------------------------------------------------------------------------------------------+
```

---

## 🏛️ Group 1 Scope of Work & Contributor 1.1 Deliverables

| Deliverable Domain | Standard Specification | Contributor 1.1 Enhancement Implemented |
|---|---|---|
| **Blockchain Chaincode** | • Rich Schema validation for `RegisterStudent` and `RequestCertificate`<br>• Org1MSP client identity access control<br>• Student lifecycle state (`ACTIVE`, `SUSPENDED`, `GRADUATED`) | • **ECDSA P-256 Public Key On-Chain Registration** (`publicKeyPem`)<br>• **Digital Signature Verification** for non-repudiation<br>• **Latin Honors & Standing Engine** (`_computeAcademicStanding`)<br>• **Deterministic Transcript SHA-256 Digest Anchoring** (`transcriptDigest`)<br>• Chaincode methods `VerifyStudentSignature` and `GetStudentPublicKey` |
| **Business Logic & Rules Engine** | • Prerequisite rules (Attendance >= 75%, CGPA >= 5.0, Backlogs == 0, Credits >= 160)<br>• REST API input validation (`validateStudentInput`, `validateRequestInput`) | • **Course Dependency DAG Graph Evaluation** (detecting broken prerequisite course chains)<br>• **Administrative Dues Clearance Checker** (Tuition & Library)<br>• **Cryptographic Signing Service** (`/api/students/sign-payload`) |
| **Agentic / Orchestration Layer** | • Stage 1–3 transition handlers | • **Group 1 Autonomous Department Pipeline Endpoint** (`/api/agents/org1-department-audit`) executing Faculty -> HOD -> DAC in one sequence. |
| **Cryptographic Credential Inventory** | • Raw crypto-config files | • **Dedicated `keys/` directory** with Org1, Org2, Org3 MSP certificates and Student Demo ECDSA keypairs.<br>• **In-browser Key Inspector** with line-by-line viewer and one-click PEM download. |
| **Frontend User Interface** | • Dark theme | • **Clean, professional, modern White & Light Theme** (`#ffffff`, `#f8fafc`, `#e2e8f0`) with high contrast, accessible typography, status badges, and interactive key management. |

---

## 🔬 Core Code Enhancements

### 1. Smart Contract: Cryptographic Non-Repudiation & Honors (`chaincode/academic-contract/index.js`)

```javascript
// Contributor 1.1 Enhancement: Signature Verification for Non-Repudiation
_verifySignature(publicKeyPem, dataString, signatureBase64) {
  try {
    if (!publicKeyPem || !signatureBase64) return false;
    const verifier = crypto.createVerify('SHA256');
    verifier.update(dataString);
    verifier.end();
    return verifier.verify(publicKeyPem, Buffer.from(signatureBase64, 'base64'));
  } catch (e) {
    return false;
  }
}

// Contributor 1.1 Enhancement: Latin Academic Honors Classification
_computeAcademicStanding(cgpa, attendance, backlogs) {
  const numCgpa = Number(cgpa) || 0;
  const numAtt = Number(attendance) || 0;
  const numBacklogs = Number(backlogs) || 0;

  if (numBacklogs > 0 || numCgpa < 5.0) {
    return { standing: 'ACADEMIC_PROBATION', honors: 'NONE' };
  }

  let honors = 'NONE';
  if (numCgpa >= 9.5 && numAtt >= 85.0) {
    honors = 'SUMMA_CUM_LAUDE';
  } else if (numCgpa >= 9.0) {
    honors = 'MAGNA_CUM_LAUDE';
  } else if (numCgpa >= 8.5) {
    honors = numAtt >= 90.0 ? 'DEAN_HONOR_ROLL' : 'CUM_LAUDE';
  }

  return { standing: 'GOOD_STANDING', honors };
}
```

### 2. Departmental Prerequisite Rules Engine (`backend/src/rules/prerequisites.js`)

```javascript
// Contributor 1.1 Enhancement: Prerequisite Dependency Graph (DAG) Check
const dagViolations = [];
for (const course of completedCourses) {
  const requiredPrereqs = COURSE_DEPENDENCIES[course] || [];
  for (const prereq of requiredPrereqs) {
    if (!completedCourses.includes(prereq)) {
      dagViolations.push(`Prerequisite dependency broken: '${course}' requires prior completion of '${prereq}'`);
    }
  }
}
```

---

## 🧪 Comprehensive Test Suite (20/20 PASS)

The test suite in `test-contributor-1-1.js` runs directly on Node.js without requiring full Docker startup, simulating Fabric stub state transitions and client identity:

```
===============================================================
🧪 RUNNING CONTRIBUTOR 1.1 UNIT & INTEGRATION TEST SUITE
===============================================================

--- Phase 1: REST API Schema Validators ---
  ✅ PASS: validateStudentInput accepts valid student schema
  ✅ PASS: validateStudentInput rejects invalid email and negative credits
  ✅ PASS: validateRequestInput validates required fields and IDs

--- Phase 2: Departmental Prerequisite Rules Engine ---
  ✅ PASS: evaluatePrerequisites approves compliant student for B.Tech
  ✅ PASS: evaluatePrerequisites detects low attendance violation (<75%)
  ✅ PASS: evaluatePrerequisites detects unresolved backlogs violation
  ✅ PASS: evaluatePrerequisites detects outstanding fee dues

--- Phase 3: Smart Contract & Chaincode Logic ---
  ✅ PASS: RegisterStudent registers student with rich schema & Org1MSP
  ✅ PASS: RegisterStudent rejects non-Org1MSP invoking client
  ✅ PASS: UpdateStudentAcademicRecord updates metrics under Org1MSP
  ✅ PASS: UpdateStudentStatus updates lifecycle status and audits history
  ✅ PASS: RequestCertificate rejects suspended student
  ✅ PASS: RequestCertificate enforces prerequisite attendance check
  ✅ PASS: RequestCertificate creates request with academicSnapshot & prerequisitesValidation
  ✅ PASS: VerifyStudentEligibility queries prerequisite eligibility

--- Phase 4: Contributor 1.1 Enhancements ---
  ✅ PASS: Course Dependency DAG detects broken prerequisite chain
  ✅ PASS: RegisterStudent records Latin Honors (Summa Cum Laude & Dean Honor Roll)
  ✅ PASS: RegisterStudent stores ECDSA public key & RequestCertificate verifies valid signature
  ✅ PASS: RequestCertificate rejects forged / tampered digital signature
  ✅ PASS: VerifyStudentSignature query helper confirms valid signature on-chain

===============================================================
📊 TEST RESULTS: 20/20 Tests Passed (100% SUCCESS)
===============================================================
```

---

## 🏃 Step-by-Step Execution Guide

### Mode 1: Automated Unit & Verification Testing (No Docker required)
To test all chaincode logic, cryptographic verification, prerequisite rules, and schema validators:
```bash
node test-contributor-1-1.js
```

### Mode 2: Full Consortium Startup (with Docker)
1. Ensure Docker Desktop is running.
2. In PowerShell or Git Bash, run:
```bash
# Export and organize cryptographic keys
node scripts/export_and_generate_keys.js

# Bring up 3-Org Fabric 2.5 network + IPFS
./start.sh
```
3. Open the web portals in your browser:
   - **Consortium Management Portal**: [http://localhost:3000](http://localhost:3000)
   - **Employer Verification Portal**: [http://localhost:3000/verify](http://localhost:3000/verify)
   - **Backend REST API Health**: [http://localhost:4000/api/health](http://localhost:4000/api/health)
   - **Cryptographic Key Summary**: [http://localhost:4000/api/keys/summary](http://localhost:4000/api/keys/summary)

---

## 🎓 How to Explain This to Your Professor

### 1. The Opening Pitch (30 seconds)
> *"Professor, our project implements an enterprise-grade academic credentialing consortium using Hyperledger Fabric 2.5, IPFS decentralized storage, and autonomous verification agents. I am **Contributor 1.1**, the **Academic Chaincode Lead** for **Org 1 (University & Academic Department)**. My primary engineering deliverable was building the student onboarding identity lifecycle, the rich schema validation, and the certificate request gateway with prerequisite rule compliance."*

### 2. The Technical Deep Dive (2 minutes)
> *"Rather than treating student records as static database entries, I architected a full **Decentralized PKI Identity System** for students:*
> 1. *When a student is matriculated into Org 1, an asymmetric **ECDSA NIST P-256 keypair** is generated. The student's public key is anchored immutably onto the Fabric ledger in CouchDB.*
> 2. *When the student applies for their degree certificate, they **cryptographically sign** the request payload with their private key. The chaincode strictly validates the signature on `peer0.org1`. This gives us **mathematical non-repudiation**—neither unauthorized staff nor external actors can spoof a student's degree request.*
> 3. *I implemented an automated **Latin Honors & Academic Standing Engine** that computes classifications like `SUMMA_CUM_LAUDE` or `DEAN_HONOR_ROLL` from statutory attendance, CGPA, and backlog metrics.*
> 4. *I enhanced prerequisite checking with a **Course Dependency DAG**, ensuring students satisfy sequential foundational courses (e.g., CS101 before CS201, CS201 before CS301) before entering the approval pipeline."*

### 3. Demonstrating the Deliverables
> *"To make this verifiable, I have:
> - Written 20 automated unit and integration tests with **100% pass rate** in `test-contributor-1-1.js`.
> - Structured and exported all cryptographic credentials into a dedicated `keys/` directory with SHA-256 fingerprints.
> - Redesigned the entire portal into a modern, clean, accessible **white theme** with a dedicated Cryptographic Key Center where you can inspect public certificates and test student digital signatures in real time."*
