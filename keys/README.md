# 🔐 Cryptographic Key Architecture & Consortium Identities

> **Academic Blockchain & Agentic Consortium — Hyperledger Fabric 2.5 & Decentralized Identity**

This directory stores and documents all cryptographic credentials across the consortium organizations, certificate authorities, and student decentralized keypairs.

---

## 🏛️ Directory Structure & Key Inventory

```
keys/
├── keys_summary.json                      # Machine-readable JSON metadata & SHA-256 fingerprints
├── org1_academic/                         # Org1 (University / Academic Department) MSP Keys
│   ├── org1_admin_private_key.pem         # Org1 Admin ECDSA Private Key
│   ├── org1_admin_cert.pem                # Org1 Admin X.509 Certificate
│   ├── org1_user1_private_key.pem         # Org1 Client User1 Private Key
│   ├── org1_user1_cert.pem                # Org1 Client User1 X.509 Certificate
│   └── org1_ca_cert.pem                   # Org1 Root Certificate Authority (CA) Cert
├── org2_examination/                      # Org2 (Examination Board) MSP Keys
│   ├── org2_admin_private_key.pem         # Org2 Admin ECDSA Private Key
│   └── org2_admin_cert.pem                # Org2 Admin X.509 Certificate
├── org3_governance/                       # Org3 (Administration & Governance) MSP Keys
│   ├── org3_admin_private_key.pem         # Org3 Admin ECDSA Private Key
│   └── org3_admin_cert.pem                # Org3 Admin X.509 Certificate
└── student_demo/                          # Decentralized Student Cryptographic Keypair (Contributor 1.1)
    ├── student_demo_private_key.pem       # Student ECDSA P-256 Private Key (Kept secret by student)
    ├── student_demo_public_key.pem        # Student Public Key (Registered on Fabric ledger)
    └── student_demo_public_key_hex.txt    # SPKI DER Hex representation
```

---

## 🔑 Key Specification Details

### 1. Org 1: University / Academic Department (`Org1MSP`)
- **Role**: Endorses student onboarding, updates academic transcripts, and signs Stages 1–3 (`FACULTY_APPROVED` → `HOD_APPROVED` → `DAC_APPROVED`).
- **Signature Algorithm**: ECDSA with `prime256v1` curve (`secp256r1`) + SHA-256 digest.
- **Admin Certificate CN**: `Admin@org1.academic.edu`
- **CA Authority**: `ca.org1.academic.edu`

### 2. Org 2: Examination Board (`Org2MSP`)
- **Role**: Audits graduation grades, freezes records, and generates Stage 4 `EXAM_LOCKED` Merkle state hashes.
- **Admin Certificate CN**: `Admin@org2.academic.edu`

### 3. Org 3: Administration & Governance (`Org3MSP`)
- **Role**: Institutional executive compliance sanction (Stage 5 `DEAN_APPROVED`), institutional final clearance (Stage 6 `ADMIN_FINALIZED`), and Certificate Issuance & Revocation.
- **Admin Certificate CN**: `Admin@org3.academic.edu`

### 4. Student Decentralized Identity (Contributor 1.1 Enhancement)
- **Role**: Cryptographic student request signing and non-repudiation.
- **Curve**: `prime256v1` (NIST P-256).
- **Public Key Registration**: Stored on-chain during `RegisterStudent` inside `student.publicKeyPem`.
- **Digital Signing**: When a student calls `RequestCertificate`, the client signs the canonical payload `studentId:requestId:certType:timestamp`. The chaincode verifies the signature using the registered public key, preventing any impersonation or unauthorized tampering.
