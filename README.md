# 🎓 Academic Blockchain Consortium — 3-Organization Architecture

> **Tamper-Evident Academic Certificate Issuance, Autonomous Multi-Agent Governance & Instant Verification System**  
> Built on **Hyperledger Fabric 2.5 (LTS)**, **IPFS Kubo**, **W3C Decentralized Identifiers (DID)**, and an **Autonomous Multi-Agent AI Ecosystem**.  
> Containerized with **Docker** for cross-platform portability across **macOS (Apple Silicon & Intel)**, **Ubuntu Linux**, **Windows (WSL 2)**, and **Cloud VMs**.

---

## 📑 Table of Contents
- [Architecture Overview](#-architecture-overview)
- [Core Features & Modules](#-core-features--modules)
- [Multi-Agent Autonomous AI Engine](#-multi-agent-autonomous-ai-engine)
- [Decentralized Identity (DID) & Cryptography](#-decentralized-identity-did--cryptography)
- [Database vs. Ledger Synergy](#-database-vs-ledger-synergy)
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

The system operates as a **3-Organization Consortium** running on a shared Fabric channel (`academicchannel`) with **Raft** crash fault-tolerant consensus and decentralized **IPFS** document storage:

```
+-------------------------------------------------------------------------------------------------------+
|                                  ACADEMIC BLOCKCHAIN CONSORTIUM                                       |
|                                                                                                       |
|  +-----------------------------+  +-----------------------------+  +-------------------------------+  |
|  |           Org 1             |  |           Org 2             |  |             Org 3             |  |
|  |   University & Faculty      |  |      Examination Board      |  |     Administration & Senate   |  |
|  +-----------------------------+  +-----------------------------+  +-------------------------------+  |
|  | • peer0.org1:7051           |  | • peer0.org2:8051           |  | • peer0.org3:9051             |  |
|  | • CouchDB0: 5984            |  | • CouchDB1: 6984            |  | • CouchDB2: 7984              |  |
|  | • MSP: Org1MSP              |  | • MSP: Org2MSP              |  | • MSP: Org3MSP                |  |
|  | • Academic Agent            |  | • Examination Agent         |  | • Admin & Senate Agent        |  |
|  | • Faculty/FA/HOD/DAC Gates  |  | • Grade Lockdown & CGPA     |  | • Dean Sign-Off & Revocation  |  |
|  +-----------------------------+  +-----------------------------+  +-------------------------------+  |
|                 \                                |                                 /                  |
|                  \                               |                                /                   |
|                   +--------------------------------------------------------------+                    |
|                   |             Channel: academicchannel (Fabric 2.5)            |                    |
|                   +--------------------------------------------------------------+                    |
|                                                  |                                                    |
|                   +--------------------------------------------------------------+                    |
|                   | • Raft Consensus Ordering: orderer.academic.edu:7050         |                    |
|                   | • Decentralized Storage: IPFS Kubo (Port: 5001 / Gateway:8080|                    |
|                   | • Off-Chain SIS Database: SQLite (university_sis.db)         |                    |
|                   +--------------------------------------------------------------+                    |
+-------------------------------------------------------------------------------------------------------+
```

---

## 🌟 Core Features & Modules

### Module 1: Student Onboarding, SIS Integration & Cryptographic DID
* **Identity Verification**: Cross-references onboarding requests against the university Student Information System (SIS) SQLite database.
* **W3C Decentralized Identifier**: Generates an immutable, collision-resistant student DID (`did:academic:<hash160>`) via SHA-256 and RIPEMD-160.
* **Department Filtering**: Rich CouchDB indexes enable instant filtering by department, branch, and enrollment cohort.

### Module 2: 7-Stage Multi-Organization Approval Workflow
State-machine smart contract (`academic-contract`) enforcing multi-organizational separation of duties:
1. `SUBMITTED`: Request entered by student or academic department.
2. `FACULTY_APPROVED`: Individual course instructors verify syllabus and marksheets.
3. `FACULTY_ADVISOR_APPROVED`: Faculty advisor conducts comprehensive 5-course credit audit.
4. `HOD_APPROVED`: Department Head signs off on departmental eligibility.
5. `DAC_APPROVED`: Department Academic Committee (DAC) completes multi-sig approval.
6. `EXAM_LOCKED`: Org 2 (Examination Board) verifies CGPA, backlogs, and locks grades.
7. `DEAN_APPROVED` → `ADMIN_FINALIZED`: Org 3 (Dean & Senate Board) validates institutional clearance and finalizes minting eligibility.

### Module 3: Vector PDF Generation & Decentralized IPFS Storage
* **Tamper-Evident Vector Certificates**: High-resolution PDFs created dynamically with `pdfkit` featuring vector borders, official crests, and dynamic signatures.
* **Verifiable High-Density QR**: Encodes Student ID, DID, Certificate ID, IPFS CID, SHA-256 digest, and Fabric Transaction ID directly into the certificate.
* **Decentralized Pinning**: Uploads PDF to IPFS Kubo daemon (`5001`), extracts immutable content identifier (CID), and exposes access via the IPFS gateway (`8080`).

### Module 4: Fabric Ledger Anchoring, Public Verification & Revocation
* **On-Chain Anchoring**: Permanently records certificate metadata, SHA-256 document fingerprint, and IPFS CID onto the Fabric state ledger.
* **Quad-Method Instant Verification**:
  1. *By Certificate ID*: Real-time query against the ledger.
  2. *By Student DID*: Full history of all degrees and diplomas issued to a student.
  3. *By Document SHA-256*: Reverse hash lookup to verify physical or uploaded PDFs.
  4. *By Verifiable QR Code*: In-browser camera scanning or image drag-and-drop.
* **Immutable Revocation**: Authorized Org 3 administrators can revoke certificates on-chain with reason logging; state updates to `REVOKED` permanently while preserving audit history.

---

## 🤖 Multi-Agent Autonomous AI Engine

The consortium is automated by a cooperative **Multi-Agent Ecosystem** operating across organizations:

```
                                  [ Certificate Request ]
                                             │
                                             ▼
                        ┌──────────────────────────────────────────┐
                        │       Master Multi-Agent Orchestrator     │
                        └────────────────────┬─────────────────────┘
                                             │
                 ┌───────────────────────────┼───────────────────────────┐
                 ▼                           ▼                           ▼
      ┌─────────────────────┐     ┌─────────────────────┐     ┌─────────────────────┐
      │ Org 1 Academic      │     │ Org 2 Exam Board    │     │ Org 3 Admin/Senate  │
      │ Autonomous Agent    │     │ Autonomous Agent    │     │ Autonomous Agent    │
      └──────────┬──────────┘     └──────────┬──────────┘     └──────────┬──────────┘
                 │                           │                           │
                 │ Attendance >= 75%         │ Backlogs = 0              │ Fee Dues = 0
                 │ Total Credits >= 160      │ CGPA Integrity Check      │ Library Dues = 0
                 │ CIE Marks >= 40           │ Grade Lockdown            │ Senate Clearance
                 └───────────────────────────┼───────────────────────────┘
                                             │
                                             ▼
                        ┌──────────────────────────────────────────┐
                        │      Intelligent Fraud Detection Agent   │
                        │    (0–100 Risk Score & Anomaly Heuristic)│
                        └────────────────────┬─────────────────────┘
                                             │ [ Risk < 25 / Approved ]
                                             ▼
                        ┌──────────────────────────────────────────┐
                        │   Autonomous Minting & IPFS Anchoring    │
                        └──────────────────────────────────────────┘
```

* **Org 1 Academic Agent**: Audits student credits, attendance, CIE marks, and course completion.
* **Org 2 Examination Agent**: Validates CGPA calculation integrity and executes immutable grade lockdown.
* **Org 3 Administration Agent**: Verifies institutional clearance, fee payment, and library dues.
* **Autonomous Fraud Detection Agent**: Evaluates 0–100 fraud risk using heuristic anomaly models, detecting request replay attacks, grade inflation spikes, and identity collisions.
* **Conversational Ledger AI Assistant (Chatbot)**: Multi-provider LLM integration (Groq Ultra-Fast LLaMA 3.3 / Hugging Face Router / Deterministic local fallback) answering natural language questions about ledger records and transaction histories.
* **1-Click Master Multi-Agent Pipeline**: Executes all 7 verification gates, fraud scans, PDF generation, IPFS pinning, and Fabric minting in under 10 seconds.

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
*Or directly via standard Docker:*
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
   Open your Ubuntu terminal and clone inside your Linux home directory (do not clone in `/mnt/c/` for maximum performance and socket compatibility):
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
│       └── index.js
├── backend/                    # Express REST API, Multi-Agent AI & Cryptography
│   ├── Dockerfile
│   ├── package.json
│   ├── .env.example            # Environment variables template
│   └── src/
│       ├── fabric.js           # Hyperledger Fabric ledger client
│       ├── ipfs.js             # IPFS Kubo client & SHA-256 calculator
│       ├── pdf.js              # Vector Certificate PDF generator
│       ├── cryptoUtil.js       # Student DID (SHA-256 + RIPEMD-160) & signatures
│       ├── facultyAuth.js      # Faculty session management
│       ├── server.js           # Express REST API server
│       ├── db/                 # SQLite SIS database engine
│       │   └── sisDatabase.js
│       └── agents/             # Multi-Agent Autonomous AI Engine
│           ├── orchestrator.js
│           ├── fraudAgent.js
│           ├── chatAgent.js
│           ├── hfAgentClient.js
│           └── certMintingAgents.js
└── frontend/                   # React 18 + Vite Web Verification Portal
    ├── Dockerfile
    ├── package.json
    ├── server.js               # Web portal server & reverse proxy
    ├── src/                    # React components and dashboard
    └── public/                 # Static assets and fallbacks
```

---

## 👥 Consortium Team & Acknowledgments

Developed as an academic Problem-Based Learning (PBL) consortium project implementing decentralized identity, distributed ledger consensus, and autonomous agent orchestration.
