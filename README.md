# 🎓 Academic Blockchain Consortium — 3-Organization Architecture

> **Tamper-Evident Academic Certificate Issuance, Autonomous Multi-Agent Governance, ZK-Privacy Suite & Instant Verification System**  
> Built on **Hyperledger Fabric 2.5 (LTS)**, **IPFS Kubo**, **Cloudflare R2**, **W3C Decentralized Identifiers (DID)**, **Zero-Knowledge (ZK) Range Proofs**, and a **12-Agent Autonomous AI Ecosystem**.  
> Containerized with **Docker** for cross-platform portability across **macOS (Apple Silicon & Intel)**, **Ubuntu Linux**, **Windows (WSL 2)**, and **Cloud VMs**.

---

## 📑 Table of Contents
- [Architecture Overview](#-architecture-overview)
- [Complete Technology Stack](#-complete-technology-stack)
- [Core Modules & Group Allocations](#-core-modules--group-allocations)
- [Group 1: ZK-Passport & Zero-Knowledge Privacy Suite](#-group-1-zk-passport--zero-knowledge-privacy-suite)
- [Comprehensive Multi-Agent AI Ecosystem (All 12 Agents)](#-comprehensive-multi-agent-ai-ecosystem-all-12-agents)
- [Ledger-Aware Conversational AI Assistant (Chatbot Agent)](#-ledger-aware-conversational-ai-assistant-chatbot-agent)
- [Decentralized Identity (DID) & Cryptography](#-decentralized-identity-did--cryptography)
- [Database vs. Ledger Synergy](#-database-vs-ledger-synergy)
- [Dual-Storage Archival (IPFS + Cloudflare R2)](#-dual-storage-archival-ipfs--cloudflare-r2)
- [Two Ways to Run (Choose Your Mode)](#-two-ways-to-run)
  - [Option 1: Distributed 3-Org Network (`./start.sh`)](#option-1-distributed-3-org-network-standard)
  - [Option 2: All-in-One Sandbox Container (`./run-all-in-one.sh`)](#option-2-all-in-one-sandbox-container-run-anywhere)
- [Device-Specific Activation Guides](#-device-specific-activation-guides)
  - [macOS (Apple Silicon & Intel)](#-macos-apple-silicon-m1m2m3m4--intel)
  - [Ubuntu Linux & Debian](#-ubuntu-linux--debian)
  - [Windows 10 / 11 (WSL 2)](#-windows-10--11-via-wsl-2)
  - [Cloud VMs (AWS, GCP, Azure, DigitalOcean)](#-cloud-virtual-machines)
- [Automated Integration Testing](#-automated-integration-testing)
- [REST API Reference](#-rest-api-reference)
- [Repository Structure](#-repository-structure)

---

## 🏛️ Architecture Overview

The system operates as a **3-Organization Consortium** running on a shared Fabric channel (`academicchannel`) with **Raft** crash fault-tolerant ordering, decentralized **IPFS** document storage, and **Cloudflare R2** enterprise disaster recovery:

```
+-----------------------------------------------------------------------------------------------------------------------+
|                                           ACADEMIC BLOCKCHAIN CONSORTIUM                                              |
|                                                                                                                       |
|  +--------------------------------+  +--------------------------------+  +-----------------------------------------+  |
|  |             Org 1              |  |             Org 2              |  |                  Org 3                  |  |
|  |      University & Faculty      |  |       Examination Board        |  |          Administration & Senate        |  |
|  +--------------------------------+  +--------------------------------+  +-----------------------------------------+  |
|  | • peer0.org1:7051              |  | • peer0.org2:8051              |  | • peer0.org3:9051                       |  |
|  | • CouchDB0: 5984               |  | • CouchDB1: 6984               |  | • CouchDB2: 7984                        |  |
|  | • MSP: Org1MSP                 |  | • MSP: Org2MSP                 |  | • MSP: Org3MSP                          |  |
|  | • Academic Department Agent    |  | • Examination Board Agent      |  | • Central Admin & Senate Agent          |  |
|  | • ZK-Passport & Privacy Suite  |  | • Grade Lockdown & CGPA Audit  |  | • Dean Sign-Off & Revocation Notary     |  |
|  | • Faculty/FA/HOD/DAC Quorum    |  | • Backlog Verification Engine  |  | • Cloudflare R2 Archival Custodian      |  |
|  +--------------------------------+  +--------------------------------+  +-----------------------------------------+  |
|                 \                                     |                                     /                         |
|                  \                                    |                                    /                          |
|                   +-----------------------------------------------------------------------+                           |
|                   |                  Channel: academicchannel (Fabric 2.5)                |                           |
|                   +-----------------------------------------------------------------------+                           |
|                                                       |                                                               |
|                   +-----------------------------------------------------------------------+                           |
|                   | • Raft Consensus Ordering Service: orderer.academic.edu:7050          |                           |
|                   | • Decentralized Storage: IPFS Kubo (Port: 5001 / Gateway: 8080)       |                           |
|                   | • Secondary Cloud Storage: Cloudflare R2 (S3-Compatible Archival)     |                           |
|                   | • Off-Chain SIS Database: SQLite Engine (university_sis.db)           |                           |
|                   | • Multi-Provider LLM: Groq LLaMA-3.3 / Hugging Face Router / Local JS |                           |
|                   +-----------------------------------------------------------------------+                           |
+-----------------------------------------------------------------------------------------------------------------------+
```

---

## 💻 Complete Technology Stack

| Layer | Technology | Version / Spec | Purpose |
|---|---|---|---|
| **Distributed Ledger (DLT)** | **Hyperledger Fabric** | v2.5 (LTS) | Permissioned enterprise blockchain consortium infrastructure |
| **Consensus Mechanism** | **Raft (CFT)** | etcd/raft | Crash fault-tolerant distributed ordering service (`orderer:7050`) |
| **Smart Contracts (Chaincode)**| **Fabric Contract API** | Node.js v2.5.3 | Enforces the 7-stage state machine, DID registration & ZK proofs |
| **State Databases** | **CouchDB** | v3.3.3 | Rich JSON indexing, mango queries, and department analytics |
| **Block Store** | **GoLevelDB** | Native Fabric | Immutable sequential cryptographic ledger storage |
| **Decentralized Storage** | **IPFS Kubo** | v0.26.0 | Content-addressed, decentralized peer-to-peer certificate storage |
| **Enterprise Cloud Backup** | **Cloudflare R2** | AWS S3 SDK v3 | Synchronous dual-pinning enterprise backup with presigned download links |
| **Identity & Privacy** | **W3C DID Standard** | `did:academic:` | Decentralized Identifiers generated via SHA-256 + RIPEMD-160 |
| **Zero-Knowledge Proofs** | **Salted Hash Commitments**| Custom ZKP | Proves CGPA $\ge \text{threshold}$ without disclosing grades or GPA |
| **Digital Signatures** | **HMAC-SHA256 & PKI** | RFC 2104 | Vector digital authority signatures with actor signing secrets |
| **Off-Chain Relational DB** | **SQLite (`node:sqlite`)**| Native Node 22 | University Student Information System (SIS) relational engine |
| **AI LLM Inference (Fast)** | **Groq Cloud API** | LLaMA 3.3 70B / 3.1 8B | Sub-second generative reasoning for agent pipeline & chatbot |
| **AI LLM Inference (Router)**| **Hugging Face Router API** | Meta LLaMA 3.1 8B | Cloud LLM inference fallback for multi-agent reasoning |
| **Offline AI Fallback** | **Deterministic JS Heuristics**| Custom Rule Engine | Offline failsafe ensuring zero downtime if cloud APIs are unreachable |
| **Natural Language Engine** | **Conversational Intent NLP** | Custom Engine (75KB) | Intent classification, slot extraction, contextual memory & RBAC |
| **Backend Runtime** | **Node.js** | v22.x (LTS) | High-performance asynchronous microservice runtime |
| **REST API Framework** | **Express.js** | v4.19.2 | Unified API gateway for blockchain, IPFS, agents & SIS |
| **Document Cryptography** | **PDFKit & QRCode** | v0.15 / v1.5 | Tamper-evident vector PDF certificates with verifiable high-density QR |
| **Frontend Framework** | **React & Vite** | React 18.3 / Vite 5.2 | Modern responsive single-page application & interactive UI |
| **Containerization** | **Docker & Docker Compose** | Engine 26+ / Compose v2| Multi-architecture container orchestration (`amd64` / `arm64`) |
| **Sandbox Container** | **Docker-in-Docker (DinD)** | `docker:26-dind` | Self-contained Option 2 All-in-One sandbox container |

---

## 🧩 Core Modules & Group Allocations

| Module | Component | Team Allocation | Core Responsibilities |
|---|---|---|---|
| **Module 1** | **Registration, Identity & ZK-Passport** | **Group 1** | Student onboarding, SQLite SIS integration, W3C DID derivation, **Cryptographic Academic Passport**, **Zero-Knowledge (ZK) Range Proofs**, and CouchDB rich queries. |
| **Module 2** | **7-Stage Multi-Org State Machine** | **Group 2** | State transitions across Org 1, Org 2, and Org 3. Cross-organizational endorsement policy enforcement and **Master Multi-Agent Orchestrator**. |
| **Module 3** | **PDF Synthesis & Dual Storage** | **Group 4** | Tamper-evident vector PDF generation, high-density verifiable QR codes, IPFS Kubo pinning, and Cloudflare R2 backup. |
| **Module 4** | **Ledger Anchoring & Verification** | **Group 3 & 4** | Ledger state anchoring, Quad-Method Verification (ID, DID, Hash, QR), on-chain audit trails, and immutable revocation. |
| **Module 5** | **Multi-Agent AI Ecosystem** | **Groups 2, 3, 5, 6** | 12 specialized autonomous agents: Academic Agent, Exam Agent, Senate Agent, Fraud Sentinel, Chatbot Oracle, and Health Monitor. |

---

## 🛡️ Group 1: ZK-Passport & Zero-Knowledge Privacy Suite

Developed by **Group 1 (Academic Department Ecosystem & Decentralized Identity)**, this suite empowers students with self-sovereign verifiable credentials while guaranteeing complete privacy:

```
+─────────────────────────────────────────────────────────────────────────────────────────────────+
|                          GROUP 1: ZK-PASSPORT & PRIVACY PRESERVATION SUITE                      |
+─────────────────────────────────────────────────────────────────────────────────────────────────+
|                                                                                                 |
|   1. Cryptographic Academic Passport              2. Zero-Knowledge (ZK) Range Proofs          |
|      (Contributor 1.1)                               (Contributor 1.2)                          |
|      • Chaincode: IssueStudentPassport               • Chaincode: GenerateZKAcademicProof       |
|      • On-chain passport ID: PASS-<studentId>        • Proves: CGPA >= 8.5 (or any target)      |
|      • Embeds Latin Honors:                          • Cryptographic Salted Hash:               |
|        - Summa Cum Laude (CGPA >= 9.5)                 ProofHash = SHA256(CGPA || salt)         |
|        - Magna Cum Laude (CGPA >= 9.0)               • Zero disclosure of marks or transcript   |
|        - Cum Laude (CGPA >= 8.5)                     • Fail-closed: non-qualifying requests     |
|      • Dynamic Verifiable QR Data URL                  abort without disclosing GPA             |
|                                                                                                 |
|   3. Autonomous ZK Verifier Agent                 4. CouchDB Rich Queries & Department Analytics|
|      (Contributor 1.3)                               (Contributor 1.2)                          |
|      • Agent: Agent-ZK-Gatekeeper                    • Mango indexes: indexAcademicPassport     |
|      • Verifies proofs on ledger without             • Department filtering:                    |
|        disclosing student transcript to recruiters     - /api/department/students               |
|      • Returns: SATISFIED (VERIFIED)                   - /api/department/requests               |
|        or UNSATISFIED                                  - /api/department/honors                 |
|                                                        - /api/department/metrics                |
+─────────────────────────────────────────────────────────────────────────────────────────────────+
```

### Key Capabilities:
1. **Verifiable Academic Passport**:
   * Generates an official on-ledger passport record containing student DID, degree, Latin honors classification, status, and issuing authority MSP (`Org1MSP`).
   * Emits a dynamic QR code that verifiers can scan to immediately confirm the candidate's active academic credentials.
2. **Zero-Knowledge Range Proofs**:
   * A candidate applying for a job requiring $\text{CGPA} \ge 8.5$ can generate a cryptographic proof token without ever sharing their actual GPA or grades.
   * Uses a fresh random 16-byte nonce/salt per proof, rendering proofs of the same claim completely unlinkable.
3. **Autonomous ZK Gatekeeper Agent**:
   * Recruiters submit the `proofHash` and target threshold to `/api/zk/verify-proof`. The agent cross-references the on-chain cryptographic commitment and certifies that the student satisfies the requirement with 100% mathematical certainty.

---

## 🤖 Comprehensive Multi-Agent AI Ecosystem (All 12 Agents)

The consortium employs a collaborative network of **12 specialized autonomous agents** executing across organizations:

```
                                      [ Certificate Request ]
                                                 │
                                                 ▼
                            ┌──────────────────────────────────────────┐
                            │ 1. Master Multi-Agent Orchestrator Agent │
                            │           (Agent-Orchestrator)           │
                            └────────────────────┬─────────────────────┘
                                                 │
                     ┌───────────────────────────┼───────────────────────────┐
                     ▼                           ▼                           ▼
          ┌─────────────────────┐     ┌─────────────────────┐     ┌─────────────────────┐
          │ 2. Org 1 Academic   │     │ 3. Org 2 Exam Board │     │ 4. Org 3 Admin      │
          │    Department Agent │     │    Autonomous Agent │     │    & Senate Agent   │
          └──────────┬──────────┘     └──────────┬──────────┘     └──────────┬──────────┘
                     │                           │                           │
                     │ Attendance >= 75%         │ Backlogs = 0              │ Fee Dues = $0
                     │ Total Credits >= 160      │ CGPA Integrity Check      │ Library Dues = $0
                     │ CIE Marks >= 40           │ Grade Lockdown            │ Senate Quorum >= 2/3
                     └───────────────────────────┼───────────────────────────┘
                                                 │
                                                 ▼
                            ┌──────────────────────────────────────────┐
                            │ 5. Autonomous Fraud Sentinel Agent       │
                            │    (0–100 Unified Risk Scoring Engine)   │
                            └────────────────────┬─────────────────────┘
                                                 │ [ Risk < 25 / Approved ]
                                                 ▼
                            ┌──────────────────────────────────────────┐
                            │ 6. Autonomous ZK Verifier Gatekeeper     │
                            │    (Zero-Knowledge Proof Audit)          │
                            └────────────────────┬─────────────────────┘
                                                 │
                                                 ▼
        ┌──────────────────────────────────────────────────────────────────────────────┐
        │                 AUTONOMOUS CERTIFICATE MINTING ENGINE                        │
        │                                                                              │
        │  ┌───────────────────────┐ ┌───────────────────────┐ ┌────────────────────┐  │
        │  │ 7. Metadata Synthesizer│ │ 8. Cert Cryptographer │ │ 9. IPFS Custodian  │  │
        │  │    DID Normalization  │ │    Vector PDF & QR    │ │    Pinning & Dual R2│  │
        │  └───────────────────────┘ └───────────────────────┘ └────────────────────┘  │
        │                                      │                                       │
        │                                      ▼                                       │
        │                        ┌───────────────────────────┐                         │
        │                        │ 10. Ledger Anchor Notary  │                         │
        │                        │     Fabric Commit Sentinel│                         │
        │                        └───────────────────────────┘                         │
        └──────────────────────────────────────┬───────────────────────────────────────┘
                                               │
                     ┌─────────────────────────┴─────────────────────────┐
                     ▼                                                   ▼
          ┌─────────────────────┐                             ┌─────────────────────┐
          │ 11. Conversational  │                             │ 12. Consensus &     │
          │     Ledger AI Oracle│                             │     Health Sentinel │
          │     (Chatbot Agent) │                             │     (Telemetry QA)  │
          └─────────────────────┘                             └─────────────────────┘
```

### Detailed Agent Profiles:

1. **Master Multi-Agent Orchestrator Agent (`Agent-Orchestrator`)**:
   * **Location**: [backend/src/agents/orchestrator.js](file:///Users/divyanshu/Semester%205/Academic%20Blockchain/Academic%20Blockchain/backend/src/agents/orchestrator.js)
   * **Role**: Master coordinator managing the 7-stage multi-organization verification pipeline in both 1-Click Autonomous Mode and Step-by-Step Collaborative Mode.
2. **Org 1 Academic Department Agent (`Org1-Academic-Agent`)**:
   * **Location**: [backend/src/agents/orgAgents.js](file:///Users/divyanshu/Semester%205/Academic%20Blockchain/Academic%20Blockchain/backend/src/agents/orgAgents.js)
   * **Role**: Audits credits ($\ge 160$), attendance ($\ge 75\%$), CIE marks ($\ge 40$), and course prerequisites to authorize Stages 1–3 (`FACULTY` → `FA` → `HOD`).
3. **Org 2 Examination Board Agent (`Org2-Exam-Agent`)**:
   * **Location**: [backend/src/agents/orgAgents.js](file:///Users/divyanshu/Semester%205/Academic%20Blockchain/Academic%20Blockchain/backend/src/agents/orgAgents.js)
   * **Role**: Audits CGPA calculation integrity, verifies backlogs ($0$), and executes immutable grade lockdown to prevent post-examination record alteration.
4. **Org 3 Central Administration & Senate Agent (`Org3-Admin-Agent`)**:
   * **Location**: [backend/src/agents/orgAgents.js](file:///Users/divyanshu/Semester%205/Academic%20Blockchain/Academic%20Blockchain/backend/src/agents/orgAgents.js)
   * **Role**: Audits fee clearance, library clearance, and disciplinary status; validates Senate multi-sig quorum ($\ge 2/3$) before minting.
5. **Autonomous Fraud Sentinel Agent (`Agent-Fraud-Sentinel`)**:
   * **Location**: [backend/src/agents/fraudAgent.js](file:///Users/divyanshu/Semester%205/Academic%20Blockchain/Academic%20Blockchain/backend/src/agents/fraudAgent.js)
   * **Role**: Evaluates a unified **0–100 Fraud Risk Score** (`LOW`, `MEDIUM`, `HIGH`, `CRITICAL`) using heuristic anomaly models; freezes suspicious submissions via smart contract quarantine flags.
6. **Autonomous ZK Verifier Gatekeeper (`Agent-ZK-Gatekeeper`)**:
   * **Location**: [backend/src/agents/orgAgents.js](file:///Users/divyanshu/Semester%205/Academic%20Blockchain/Academic%20Blockchain/backend/src/agents/orgAgents.js)
   * **Role**: Evaluates zero-knowledge range proofs for recruiters and employers without exposing candidate marksheets or exact grades.
7. **Metadata & Digital Identity Synthesizer Agent (`Agent-Metadata-Synthesizer`)**:
   * **Location**: [backend/src/agents/certMintingAgents.js](file:///Users/divyanshu/Semester%205/Academic%20Blockchain/Academic%20Blockchain/backend/src/agents/certMintingAgents.js)
   * **Role**: Canonicalizes student credentials, validates W3C DID schema structure, and normalizes Latin honors classifications using Groq/HF LLM reasoning.
8. **Certificate Cryptographer Agent (`Agent-Cert-Cryptographer`)**:
   * **Location**: [backend/src/agents/certMintingAgents.js](file:///Users/divyanshu/Semester%205/Academic%20Blockchain/Academic%20Blockchain/backend/src/agents/certMintingAgents.js)
   * **Role**: Generates tamper-evident vector PDF certificates with anti-counterfeiting micro-borders, dynamic vector signatures, embedded high-density QR codes, and SHA-256 digests.
9. **IPFS Custodian & Storage Auditor Agent (`Agent-IPFS-Custodian`)**:
   * **Location**: [backend/src/agents/certMintingAgents.js](file:///Users/divyanshu/Semester%205/Academic%20Blockchain/Academic%20Blockchain/backend/src/agents/certMintingAgents.js)
   * **Role**: Pins PDF artifacts to decentralized IPFS Kubo cluster, synchronizes secondary Cloudflare R2 enterprise backup, and executes round-trip retrievability audits.
10. **Hyperledger Fabric Ledger Anchor Agent (`Agent-Ledger-Anchor`)**:
    * **Location**: [backend/src/agents/certMintingAgents.js](file:///Users/divyanshu/Semester%205/Academic%20Blockchain/Academic%20Blockchain/backend/src/agents/certMintingAgents.js)
    * **Role**: Gathers multi-organization endorsements across Org1, Org2, and Org3 peers and commits the immutable certificate anchor transaction to the Fabric ledger.
11. **Conversational Ledger AI Assistant (`Agent-Ledger-Oracle`)**:
    * **Location**: [backend/src/agents/chatAgent.js](file:///Users/divyanshu/Semester%205/Academic%20Blockchain/Academic%20Blockchain/backend/src/agents/chatAgent.js)
    * **Role**: Ledger-aware chatbot providing conversational natural language intelligence over blockchain history, approval stages, and Cloudflare R2 backup dossiers.
12. **Consensus & Health Sentinel Agent (`Agent-Consensus-Sentinel`)**:
    * **Location**: [backend/src/agents/healthAgent.js](file:///Users/divyanshu/Semester%205/Academic%20Blockchain/Academic%20Blockchain/backend/src/agents/healthAgent.js)
    * **Role**: Real-time diagnostic agent probing gRPC peer ports, verifying cross-peer block height synchronization parity, and emitting automated self-healing recommendations.

---

## 💬 Ledger-Aware Conversational AI Assistant (Chatbot Agent)

Built by **Group 5 (Ledger AI Assistant & Events)**, the Chatbot Agent (`Agent-Ledger-Oracle`) bridges complex cryptographic ledger records with human-friendly natural language intelligence:

```
+─────────────────────────────────────────────────────────────────────────────────────────────────+
|                      CONVERSATIONAL LEDGER AI ASSISTANT (CHATBOT AGENT)                         |
+─────────────────────────────────────────────────────────────────────────────────────────────────+
|                                                                                                 |
|   1. 75KB Custom Intent Engine                    2. Multi-Provider LLM Integration             |
|      • Slot filling, regex entity extraction,        • Groq Cloud: Ultra-Fast LLaMA 3.3 70B     |
|        and contextual session memory                 • Hugging Face: Meta LLaMA 3.1 8B Router   |
|      • Introspects live ledger history via           • Offline Failsafe: Deterministic local JS |
|        Fabric GetHistoryForKey & queryChaincode        guarantees answers even without internet  |
|                                                                                                 |
|   3. Role-Based Access Control (RBAC)             4. Cloudflare R2 Presigned Download Links     |
|      • Student: query own request & DID status       • Admins can request instant temporary S3  |
|      • Faculty: view course marks & pending queue      download links for any certificate PDF   |
|      • Admin: access R2 backup links & fraud stats     valid for 15 minutes                     |
|                                                                                                 |
|   5. Interactive UI Widget & Prompt Chips         6. Sample Queries:                            |
|      • "Check status of request REQ-2024-001"        • "Who approved student STU-2024-001?"     |
|      • "Verify certificate CERT-2024-001"            • "Show Fabric network block height"       |
|      • "Show fraud audit for REQ-2024-001"           • "Get Cloudflare R2 download link"        |
+─────────────────────────────────────────────────────────────────────────────────────────────────+
```

---

## 🔐 Decentralized Identity (DID) & Cryptography

Every student is assigned a W3C-standard compliant Decentralized Identifier:
$$\text{Input} = \text{lowercase}(\text{name}) \mathbin{\Vert} \text{":"} \mathbin{\Vert} \text{uppercase}(\text{rollNumber})$$
$$\text{Hash160} = \text{RIPEMD160}\Big(\text{SHA256}(\text{Input})\Big)$$
$$\text{DID} = \text{"did:academic:"} \mathbin{\Vert} \text{hex}(\text{Hash160})$$

* **Deterministic & Privacy-Preserving**: Generates identical DIDs from student credentials without exposing raw personal data on public ledgers.
* **Cryptographic Signatures**: Approval stages require HMAC-SHA256 vector signatures generated from organization-specific signing secrets.

---

## 🗄️ Database vs. Ledger Synergy

| Metric | SQLite SIS Database (`university_sis.db`) | Hyperledger Fabric Ledger (`academicchannel`) |
|---|---|---|
| **Role** | Off-chain operational store (Student records, course marks, attendance). | Immutable cryptographic record & truth anchor. |
| **Data Stored** | Names, marks, course enrollments, faculty logins, student dues. | Student DIDs, certificate IDs, IPFS CIDs, SHA-256 hashes, approval states. |
| **Modification** | Mutable (updated semester-to-semester by faculty/staff). | Append-only, tamper-proof state machine with Raft consensus. |
| **Access** | Internal university network / authenticated API. | Publicly verifiable by employers and institutions. |

---

## ☁️ Dual-Storage Archival (IPFS + Cloudflare R2)

To ensure enterprise-grade disaster recovery and permanent document retrievability:
1. **Primary Decentralized Storage**: Uploads certificate PDFs to an **IPFS Kubo cluster** (`5001`), anchoring the content-addressed CID onto the Fabric blockchain.
2. **Secondary Cloud Archive**: Synchronously mirrors the PDF to **Cloudflare R2** (S3-compatible object storage) under `certificates/{certId}.pdf`.
3. **Presigned Download Links**: Central Administrators (`Org3MSP`) can query the Conversational AI Assistant to generate temporary, secure presigned URLs (valid for 15 minutes) for direct PDF downloads.

---

## 🚀 Two Ways to Run

Choose the mode that best fits your environment:

### Option 1: Distributed 3-Org Network (Standard)
*Spawns 13 independent containers mirroring a real-world multi-organization consortium.*

```bash
git clone https://github.com/divyanshumohapatra/Academic-Blockchain.git "Academic Blockchain"
cd "Academic Blockchain"

# One-command startup (Generates crypto, boots 3-Org network, channel, chaincode, API & UI)
./start.sh
```

### Option 2: All-in-One Sandbox Container (Run Anywhere)
*Packages the entire consortium, IPFS node, backend, and frontend into a single turnkey Docker container.*

```bash
# Build and launch the self-contained sandbox image:
./run-all-in-one.sh
```
*Or directly via standard Docker CLI:*
```bash
docker build -f docker/Dockerfile.all-in-one -t academic-blockchain:all-in-one .
docker run -it --rm --privileged \
  -p 3000:3000 -p 4000:4000 -p 8080:8080 \
  --name academic-blockchain-sandbox \
  academic-blockchain:all-in-one
```

---

## 💻 Device-Specific Activation Guides

### 🍎 macOS (Apple Silicon M1/M2/M3/M4 & Intel)
1. **Prerequisites**: Install [Docker Desktop](https://www.docker.com/products/docker-desktop/) (v24.0+).
2. **Docker Desktop Settings**:
   * Open **Settings → Advanced** and ensure **"Allow the default Docker socket to be used"** is checked (`/var/run/docker.sock`).
   * In **Settings → Resources**, allocate at least **6 GB to 8 GB of RAM**.
3. **Run**:
   ```bash
   cd "Academic Blockchain"
   ./start.sh
   ```

---

### 🐧 Ubuntu Linux & Debian
1. **Prerequisites**: Install Docker and Docker Compose plugin:
   ```bash
   sudo apt-get update
   sudo apt-get install -y docker.io docker-compose-v2
   ```
2. **Enable Non-Root Docker Access**:
   ```bash
   sudo usermod -aG docker $USER
   newgrp docker
   ```
3. **Run**:
   ```bash
   cd "Academic Blockchain"
   ./start.sh
   ```

---

### 🪟 Windows 10 / 11 (via WSL 2)
> [!IMPORTANT]
> Running Hyperledger Fabric requires a Linux kernel. Use **Windows Subsystem for Linux (WSL 2)** rather than PowerShell or CMD.

1. **Install WSL 2 (Ubuntu)**:
   Open PowerShell as Administrator and run:
   ```powershell
   wsl --install -d Ubuntu
   ```
2. **Install Docker Desktop for Windows**:
   * During installation, select **"Use the WSL 2 based engine"**.
   * In Docker Desktop Settings → **Resources → WSL Integration**, toggle on your **Ubuntu** distribution.
3. **Clone Inside the WSL 2 Filesystem**:
   Open your Ubuntu terminal and clone inside your Linux home directory:
   ```bash
   cd ~
   git clone https://github.com/divyanshumohapatra/Academic-Blockchain.git
   cd Academic-Blockchain
   ./start.sh
   ```

---

### ☁️ Cloud Virtual Machines
*(Ubuntu 22.04 LTS on AWS EC2, GCP Compute Engine, Azure VM, or DigitalOcean)*

1. Launch an instance with at least **2 vCPUs and 8 GB RAM** (e.g. AWS `t3.large`).
2. Open inbound security group ports: `3000` (UI), `4000` (API), `8080` (IPFS).
3. Connect via SSH and run:
   ```bash
   # Install Docker
   curl -fsSL https://get.docker.com | sh
   sudo usermod -aG docker $USER
   newgrp docker

   # Clone & Run
   git clone https://github.com/divyanshumohapatra/Academic-Blockchain.git
   cd Academic-Blockchain
   ./start.sh
   ```

---

## 🧪 Automated Integration Testing

The repository includes comprehensive automated test suites validating all modules and agent workflows:

| Test Script | Description |
|---|---|
| `./test-flow.sh` | **End-to-End Master Test**: Student onboarding → 7-stage state machine → PDF generation → IPFS CID upload → Fabric commit → Multi-method verification → Revocation. |
| `./test-agents.sh` | **Autonomous Agent Test**: Security gate tests, SIS database enrollment, pre-flight fraud scanning, 1-click autonomous pipeline, chatbot queries against live ledger. |
| `./test-multisig-did.sh` | **DID & Multi-Sig Test**: W3C DID derivation, 5-course faculty marks submission, faculty advisor audit, HOD + DAC quorum, and senate multi-sig. |
| `node test-api-e2e.js` | Direct HTTP API integration test exercising all REST endpoints. |

---

## 🔌 REST API Reference

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/health` | Network status across Orderer, Org1, Org2, Org3, and IPFS |
| `POST` | `/api/passport/generate` | **Group 1**: Mint Academic Passport & Dynamic QR on ledger |
| `POST` | `/api/zk/generate-proof` | **Group 1**: Generate Zero-Knowledge CGPA Range Proof |
| `POST` | `/api/zk/verify-proof` | **Group 1**: Recruiter ZK Gatekeeper Verification Agent |
| `GET` | `/api/department/students` | **Group 1**: CouchDB rich query students by department |
| `GET` | `/api/department/honors` | **Group 1**: CouchDB query students by Latin honors |
| `GET` | `/api/department/metrics` | **Group 1**: Aggregated department CGPA & enrollment metrics |
| `POST` | `/api/students` | Register student profile and mint W3C DID on ledger |
| `GET` | `/api/students/:id` | Query student ledger profile and DID |
| `POST` | `/api/requests` | Submit new certificate issuance request |
| `GET` | `/api/requests/:id` | Fetch request status and stage progression |
| `POST` | `/api/workflow/faculty-approve` | Step 1: Faculty coursework verification (Org 1) |
| `POST` | `/api/workflow/faculty-advisor-approve` | Step 2: Comprehensive 5-course credit audit (Org 1) |
| `POST` | `/api/workflow/hod-approve` | Step 3: Department Head sign-off (Org 1) |
| `POST` | `/api/workflow/dac-approve` | Step 4: DAC committee quorum approval (Org 1) |
| `POST` | `/api/workflow/exam-lock` | Step 5: Examination Board grade lockdown (Org 2) |
| `POST` | `/api/workflow/dean-approve` | Step 6: Dean Academics approval (Org 3) |
| `POST` | `/api/workflow/admin-finalize` | Step 7: Senate Board finalization (Org 3) |
| `POST` | `/api/certificates/issue` | Mint certificate: generate PDF, pin to IPFS, commit to ledger |
| `GET` | `/api/verify/id/:certId` | Public verification by Certificate ID |
| `GET` | `/api/verify/did/:did` | Query all certificates linked to a Student DID |
| `GET` | `/api/verify/hash/:sha256` | Reverse verification by PDF document SHA-256 fingerprint |
| `POST` | `/api/verify/qr` | Decode & verify high-density QR payload |
| `POST` | `/api/certificates/revoke` | Revoke certificate on-chain with immutable reason audit |
| `POST` | `/api/agents/audit/:requestId` | Pre-flight multi-agent credit, attendance & fraud audit |
| `POST` | `/api/agents/orchestrate` | 1-Click Master Multi-Agent Autonomous Pipeline |
| `POST` | `/api/agents/chat` | Conversational Ledger AI Assistant (Chatbot query) |
| `GET` | `/api/agents/health` | Multi-agent telemetry and system health status |

---

## 📁 Repository Structure

```
Academic Blockchain/
├── start.sh                    # Master startup runner (distributed mode)
├── stop.sh                     # Graceful shutdown script
├── run-all-in-one.sh           # Master startup runner (Option 2 single-container mode)
├── test-flow.sh                # End-to-end integration test suite
├── test-agents.sh              # Multi-agent autonomous pipeline test
├── test-multisig-did.sh        # DID derivation and governance test
├── PROJECT_DIVISION_PLAN.md    # Consortium engineering group task matrix
├── README.md                   # System documentation and runbooks
├── docker/
│   ├── Dockerfile.all-in-one   # Option 2: Single-container sandbox build
│   ├── entrypoint-all-in-one.sh# Option 2: Container boot and lifecycle manager
│   ├── docker-compose-net.yaml # Orderer, Org1, Org2, Org3, CouchDBs, IPFS, CLI
│   ├── docker-compose-app.yaml # Express Backend API & Frontend React Portal
│   └── configtx/
│       └── configtx.yaml       # Channel, consortium & Raft ordering specification
├── network/
│   ├── crypto-config.yaml      # 3-Org cryptographic identities configuration
│   ├── network.sh              # Network manager (up, down, restart, status)
│   └── scripts/
│       ├── envVar.sh           # Organization CLI environment loader
│       ├── generate-crypto.sh  # Dockerized cryptogen & genesis block builder
│       ├── create-channel.sh   # Channel participation join script
│       └── deploy-chaincode.sh # Fabric 2.5 chaincode lifecycle script
├── chaincode/
│   └── academic-contract/      # Node.js smart contract implementing 7-stage state machine
│       ├── package.json
│       ├── index.js            # Chaincode contract with ZK proofs & passport issuance
│       └── META-INF/           # CouchDB rich indexes (indexAcademicPassport)
├── backend/                    # Express REST API, Multi-Agent AI & Cryptography
│   ├── Dockerfile
│   ├── package.json
│   ├── .env.example            # Environment variables template
│   └── src/
│       ├── fabric.js           # Hyperledger Fabric ledger client
│       ├── ipfs.js             # IPFS Kubo client & SHA-256 calculator
│       ├── r2.js               # Cloudflare R2 S3-compatible dual storage client
│       ├── pdf.js              # Vector Certificate PDF generator
│       ├── cryptoUtil.js       # Student DID (SHA-256 + RIPEMD-160) & signatures
│       ├── intentEngine.js     # Natural language intent engine & slot filler
│       ├── auth.js             # Role-based access control (RBAC)
│       ├── facultyAuth.js      # Faculty session management
│       ├── server.js           # Express REST API server
│       ├── db/                 # SQLite SIS database engine
│       │   └── sisDatabase.js
│       └── agents/             # Multi-Agent Autonomous AI Engine
│           ├── orchestrator.js # Master Agent Orchestrator
│           ├── orgAgents.js    # Org1 Academic, Org2 Exam, Org3 Admin & ZK Gatekeeper
│           ├── fraudAgent.js   # 0–100 Fraud Risk Scoring Agent
│           ├── certMintingAgents.js # Minting Agents (PDF, IPFS, Ledger Anchor)
│           ├── chatAgent.js    # Conversational Ledger AI Assistant
│           ├── healthAgent.js  # Consensus & Health Sentinel Agent
│           └── hfAgentClient.js# Multi-provider LLM Client (Groq/HF)
└── frontend/                   # React 18 + Vite Web Verification Portal
    ├── Dockerfile
    ├── package.json
    ├── server.js               # Web portal server & reverse proxy
    ├── src/                    # React components and dashboard
    └── public/                 # Static assets, ZK-Passport tab & QR scanner
```

---

## 👥 Consortium Team & Acknowledgments

Developed as an academic Problem-Based Learning (PBL) consortium project implementing decentralized identity, distributed ledger consensus, zero-knowledge privacy preservation, and autonomous agent orchestration.
