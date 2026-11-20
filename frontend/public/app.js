// Academic Blockchain Frontend Application
const API_BASE = window.location.hostname === 'localhost' ? 'http://localhost:4000/api' : '/api';

const STAGES = [
  'SUBMITTED',
  'FACULTY_APPROVED',
  'HOD_APPROVED',
  'DAC_APPROVED',
  'EXAM_LOCKED',
  'DEAN_APPROVED',
  'ADMIN_FINALIZED'
];

document.addEventListener('DOMContentLoaded', () => {
  initTabs();
  initNetworkHealth();
  initStudentRegistration();
  initWorkflow();
  initVerification();
  initRevocation();
  initLedgerExplorer();
  initTelemetryDashboard();
  initAgenticEngine();
  initKeysCenter();
  initZkPassportSuite();
  initChatbot();

  setInterval(initNetworkHealth, 10000);
});

// ==========================================
// Tabs Navigation
// ==========================================
function initTabs() {
  const buttons = document.querySelectorAll('.tab-btn');
  const contents = document.querySelectorAll('.tab-content');

  buttons.forEach(btn => {
    btn.addEventListener('click', () => {
      buttons.forEach(b => b.classList.remove('active'));
      contents.forEach(c => c.classList.remove('active'));

      btn.classList.add('active');
      const target = document.getElementById(btn.dataset.tab);
      if (target) target.classList.add('active');

      if (btn.dataset.tab === 'register-tab') loadStudents();
      if (btn.dataset.tab === 'ledger-tab') loadCertificates();
      if (btn.dataset.tab === 'keys-tab') loadKeysSummary();
      if (btn.dataset.tab === 'telemetry-tab') loadTelemetryData();
    });
  });
}

// ==========================================
// Network Health
// ==========================================
async function initNetworkHealth() {
  const badge = document.getElementById('netStatusBadge');
  const text = document.getElementById('networkStatusText');
  const dot = badge ? badge.querySelector('.status-dot') : null;

  try {
    const res = await fetch(`${API_BASE}/health`);
    const data = await res.json();

    if (data.status === 'UP' || data.network?.allHealthy) {
      if (dot) dot.className = 'status-dot online';
      if (text) text.textContent = '3-Org Network Online (Fabric 2.5 + IPFS)';
    } else {
      if (dot) dot.className = 'status-dot';
      if (text) text.textContent = 'Fabric Initializing / Partial';
    }
  } catch (e) {
    if (dot) dot.className = 'status-dot offline';
    if (text) text.textContent = 'Network Disconnected';
  }
}

// ==========================================
// Student Registration
// ==========================================
function initStudentRegistration() {
  const form = document.getElementById('studentForm');
  const refreshBtn = document.getElementById('refreshStudentsBtn');
  const genKeyBtn = document.getElementById('genStuKeyBtn');
  const stuPubKeyInput = document.getElementById('stuPubKey');

  if (genKeyBtn) {
    genKeyBtn.addEventListener('click', async () => {
      try {
        const res = await fetch(`${API_BASE}/students/generate-keypair`, { method: 'POST' });
        const data = await res.json();
        if (stuPubKeyInput) stuPubKeyInput.value = data.publicKeyPem;

        // Auto trigger download of student private key
        const blob = new Blob([data.privateKeyPem], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `student_private_key_${Date.now()}.pem`;
        a.click();
        URL.revokeObjectURL(url);

        alert(`🔑 New ECDSA P-256 Keypair generated!\n• Public Key loaded into form\n• Private Key downloaded to your computer\n• SHA-256 Fingerprint: ${data.sha256Fingerprint.substring(0, 16)}...`);
      } catch (e) {
        alert(`Failed to generate keypair: ${e.message}`);
      }
    });
  }

  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const payload = {
        studentId: document.getElementById('stuId').value.trim(),
        name: document.getElementById('stuName').value.trim(),
        email: document.getElementById('stuEmail').value.trim(),
        department: document.getElementById('stuDept').value.trim(),
        enrollmentYear: document.getElementById('stuYear').value.trim()
      };

      if (stuPubKeyInput && stuPubKeyInput.value.trim()) {
        payload.publicKeyPem = stuPubKeyInput.value.trim();
      }

      try {
        const res = await fetch(`${API_BASE}/students`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (res.ok) {
          alert(`✅ Student ${payload.studentId} successfully registered on Ledger (Org 1)!`);
          loadStudents();
        } else {
          alert(`❌ Registration failed: ${data.error}`);
        }
      } catch (err) {
        alert(`❌ Network error: ${err.message}`);
      }
    });
  }

  if (refreshBtn) {
    refreshBtn.addEventListener('click', loadStudents);
  }
}

async function loadStudents() {
  const tbody = document.getElementById('studentsTbody');
  const sisTbody = document.getElementById('sisTbody');

  try {
    if (tbody) {
      tbody.innerHTML = '<tr><td colspan="6" class="empty-hint">Fetching registered students...</td></tr>';
    }
    if (sisTbody) {
      sisTbody.innerHTML = '<tr><td colspan="10" class="empty-hint">Fetching SIS records...</td></tr>';
    }

    const [ledgerRes, sisRes] = await Promise.all([
      fetch(`${API_BASE}/students`).catch(() => ({ json: () => [] })),
      fetch(`${API_BASE}/sis/students`).catch(() => ({ json: () => [] }))
    ]);

    const students = await ledgerRes.json();
    const sisStudents = await sisRes.json();

    if (tbody) {
      if (!Array.isArray(students) || students.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="empty-hint">No students registered yet on ledger.</td></tr>';
      } else {
        tbody.innerHTML = students.map(s => {
          const rec = s.academicRecord || {};
          const honors = rec.honors && rec.honors !== 'NONE' ? rec.honors : (rec.academicStanding || 'GOOD_STANDING');
          const hasKey = Boolean(s.publicKeyPem);
          const badgeClass = honors.includes('SUMMA') || honors.includes('MAGNA') || honors.includes('DEAN') ? 'badge-info' : '';

          return `
            <tr>
              <td><code>${s.studentId}</code></td>
              <td><strong>${s.name}</strong></td>
              <td>${s.email}</td>
              <td>${s.department}</td>
              <td><span class="badge ${badgeClass}" style="background: #eff6ff; color: #1d4ed8; border: 1px solid #bfdbfe;">${honors}</span></td>
              <td>${hasKey ? '<span style="color: #16a34a; font-weight: 600; font-size: 0.8rem;">🔒 ECDSA P-256</span>' : '<span style="color: #94a3b8; font-size: 0.8rem;">None</span>'}</td>
            </tr>
          `;
        }).join('');
      }
    }

    if (sisTbody && Array.isArray(sisStudents)) {
      sisTbody.innerHTML = sisStudents.map(sis => {
        const isEligible = sis.attendance >= 75 && sis.cieMarks >= 20 && sis.backlogs === 0 && (sis.feeDues + sis.libraryDues === 0) && sis.capstoneScore >= 60;
        return `
          <tr style="background: ${isEligible ? 'transparent' : 'rgba(239,68,68,0.05)'};">
            <td><code>${sis.studentId}</code></td>
            <td>
              <strong>${sis.name}</strong>
              <div style="font-size:0.75rem; color:${isEligible ? '#34d399' : '#f87171'};">
                ${isEligible ? '✓ Eligible Graduate' : '⚠️ Has Deficit / Hold'}
              </div>
            </td>
            <td>${sis.department}</td>
            <td style="color:${sis.attendance >= 75 ? '#34d399' : '#f87171'}; font-weight:600;">${sis.attendance}%</td>
            <td style="color:${sis.cieMarks >= 20 ? '#34d399' : '#f87171'};">${sis.cieMarks}/50</td>
            <td><strong>${Number(sis.cgpa || 0).toFixed(2)}</strong></td>
            <td style="color:${sis.backlogs === 0 ? '#34d399' : '#f87171'}; font-weight:${sis.backlogs > 0 ? 700 : 400};">${sis.backlogs}</td>
            <td style="color:${sis.capstoneScore >= 60 ? '#34d399' : '#f87171'};">${sis.capstoneScore}/100</td>
            <td style="color:${(sis.feeDues + sis.libraryDues) === 0 ? '#34d399' : '#f87171'};">₹${sis.feeDues + sis.libraryDues}</td>
            <td>
              <button type="button" class="btn-secondary btn-sm" style="padding:4px 8px; font-size:0.75rem;" onclick="quickFillStudent('${sis.studentId}', '${(sis.name || '').replace(/'/g, "\\'")}', '${sis.email || ''}', '${sis.department || ''}', '${sis.enrollmentYear || ''}')">
                Quick-Fill
              </button>
            </td>
          </tr>
        `;
      }).join('');
    }
  } catch (err) {
    if (tbody) tbody.innerHTML = `<tr><td colspan="6" class="empty-hint">Error: ${err.message}</td></tr>`;
    if (sisTbody) sisTbody.innerHTML = `<tr><td colspan="10" class="empty-hint">Error: ${err.message}</td></tr>`;
  }
}

window.quickFillStudent = function(studentId, name, email, department, enrollmentYear) {
  const stuId = document.getElementById('stuId');
  const stuName = document.getElementById('stuName');
  const stuEmail = document.getElementById('stuEmail');
  const stuDept = document.getElementById('stuDept');
  const stuYear = document.getElementById('stuYear');
  if (stuId) stuId.value = studentId;
  if (stuName) stuName.value = name;
  if (stuEmail) stuEmail.value = email;
  if (stuDept) stuDept.value = department;
  if (stuYear) stuYear.value = enrollmentYear;

  const reqStudentId = document.getElementById('reqStudentId');
  if (reqStudentId) reqStudentId.value = studentId;

  window.scrollTo({ top: 0, behavior: 'smooth' });
};

// ==========================================
// Workflow & 7-Stage State Machine
// ==========================================
let currentTrackedRequest = null;

function initWorkflow() {
  const reqForm = document.getElementById('reqForm');
  const genReqBtn = document.getElementById('genReqIdBtn');
  const trackBtn = document.getElementById('trackReqBtn');
  const autoBtn = document.getElementById('autoAdvanceBtn');
  const issueBtn = document.getElementById('issueCertBtn');
  const signBtn = document.getElementById('signReqBtn');
  const reqSigInput = document.getElementById('reqStudentSig');

  if (signBtn) {
    signBtn.addEventListener('click', async () => {
      const studentId = document.getElementById('reqStudentId').value.trim();
      const requestId = document.getElementById('reqIdInput').value.trim();
      const certType = document.getElementById('reqCertType').value;
      if (!studentId || !requestId) {
        alert('Please enter Student ID and Request ID before signing.');
        return;
      }

      try {
        // Fetch student demo private key from backend storage
        const keyRes = await fetch(`${API_BASE}/keys/file/student_demo/student_demo_private_key.pem`);
        const privateKeyPem = await keyRes.text();

        const signRes = await fetch(`${API_BASE}/students/sign-payload`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            privateKeyPem,
            studentId,
            requestId,
            certType,
            timestamp: new Date().toISOString()
          })
        });
        const signData = await signRes.json();
        if (reqSigInput) reqSigInput.value = signData.signatureBase64;
        alert(`✍️ Cryptographic Digital Signature Generated!\nAlgorithm: SHA256withECDSA\nSignature: ${signData.signatureBase64.substring(0, 32)}...`);
      } catch (err) {
        alert(`Signing error: ${err.message}`);
      }
    });
  }

  if (genReqBtn) {
    genReqBtn.addEventListener('click', () => {
      const rand = Math.floor(1000 + Math.random() * 9000);
      document.getElementById('reqIdInput').value = `REQ-2024-${rand}`;
    });
  }

  if (reqForm) {
    reqForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const requestId = document.getElementById('reqIdInput').value.trim();
      const studentId = document.getElementById('reqStudentId').value.trim();
      const certType = document.getElementById('reqCertType').value;

      const bodyPayload = { requestId, studentId, certType };
      if (reqSigInput && reqSigInput.value.trim()) {
        bodyPayload.studentSignature = reqSigInput.value.trim();
        bodyPayload.signatureTimestamp = new Date().toISOString();
      }

      try {
        const res = await fetch(`${API_BASE}/requests`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(bodyPayload)
        });
        const data = await res.json();
        if (res.ok) {
          alert(`✅ Request ${requestId} submitted! Status: SUBMITTED`);
          document.getElementById('activeReqInput').value = requestId;
          trackRequest(requestId);
        } else {
          alert(`❌ Submission failed: ${data.error}`);
        }
      } catch (err) {
        alert(`❌ Network error: ${err.message}`);
      }
    });
  }

  if (trackBtn) {
    trackBtn.addEventListener('click', () => {
      const reqId = document.getElementById('activeReqInput').value.trim();
      if (reqId) trackRequest(reqId);
    });
  }

  if (autoBtn) {
    autoBtn.addEventListener('click', autoAdvanceStages);
  }

  if (issueBtn) {
    issueBtn.addEventListener('click', executeCertificateIssuance);
  }
}

async function trackRequest(requestId) {
  try {
    const res = await fetch(`${API_BASE}/requests/${requestId}`);
    if (!res.ok) {
      alert(`Request ${requestId} not found.`);
      return;
    }
    const request = await res.json();
    currentTrackedRequest = request;
    renderStepper(request.status);
    renderActionControls(request);
    renderHistory(request.history || []);

    if (request.status === 'ADMIN_FINALIZED') {
      document.getElementById('issueCertId').value = `CERT-${request.requestId.replace('REQ-', '')}`;
    }
  } catch (err) {
    alert(`Error tracking request: ${err.message}`);
  }
}

function renderStepper(currentStatus) {
  const currentIndex = STAGES.indexOf(currentStatus);

  STAGES.forEach((stage, idx) => {
    const el = document.getElementById(`step-${stage}`);
    if (!el) return;

    el.classList.remove('active', 'completed');
    if (idx < currentIndex) {
      el.classList.add('completed');
    } else if (idx === currentIndex) {
      el.classList.add('active');
    }
  });

  // Step lines
  const lines = document.querySelectorAll('.step-line');
  lines.forEach((line, idx) => {
    if (idx < currentIndex) {
      line.classList.add('completed');
    } else {
      line.classList.remove('completed');
    }
  });
}

function renderActionControls(request) {
  const container = document.getElementById('actionControls');
  if (!container) return;

  const status = request.status;
  const reqId = request.requestId;

  let html = '';
  switch (status) {
    case 'SUBMITTED':
      html = `<button class="btn-primary" onclick="advanceStage('faculty-approve', '${reqId}', 'Faculty approval granted')">✍️ Org 1: Approve as Faculty</button>`;
      break;
    case 'FACULTY_APPROVED':
      html = `<button class="btn-primary" onclick="advanceStage('hod-approve', '${reqId}', 'HOD recommendation approved')">✍️ Org 1: Approve as HOD</button>`;
      break;
    case 'HOD_APPROVED':
      html = `<button class="btn-primary" onclick="advanceStage('dac-approve', '${reqId}', 'Department Academic Committee approval complete')">✍️ Org 1: Approve as DAC</button>`;
      break;
    case 'DAC_APPROVED':
      html = `<button class="btn-primary" style="background:#f59e0b;" onclick="advanceStage('exam-lock', '${reqId}', 'Grades locked by Controller of Examinations')">🔒 Org 2: Lock Exam Grades</button>`;
      break;
    case 'EXAM_LOCKED':
      html = `<button class="btn-primary" style="background:#10b981;" onclick="advanceStage('dean-approve', '${reqId}', 'Dean Academic clearance granted')">✍️ Org 3: Sanction as Dean</button>`;
      break;
    case 'DEAN_APPROVED':
      html = `<button class="btn-primary" style="background:#10b981;" onclick="advanceStage('admin-finalize', '${reqId}', 'Administrative clearance finalized')">🏛️ Org 3: Finalize by Administration</button>`;
      break;
    case 'ADMIN_FINALIZED':
      html = `<p style="color:#34d399; font-weight:600;">✅ Request is ADMIN_FINALIZED! Ready for PDF & IPFS Issuance below.</p>`;
      break;
    case 'CERTIFICATE_ISSUED':
      html = `<p style="color:#38bdf8; font-weight:600;">🎓 Certificate Issued on Ledger! Cert ID: <code>${request.certificateId || 'N/A'}</code></p>`;
      break;
    default:
      html = `<p class="placeholder-text">Status: ${status}</p>`;
  }

  container.innerHTML = html;
}

window.advanceStage = async function(endpoint, requestId, comments) {
  try {
    const res = await fetch(`${API_BASE}/workflow/${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ requestId, comments })
    });
    const data = await res.json();
    if (res.ok) {
      trackRequest(requestId);
    } else {
      alert(`Approval failed: ${data.error}`);
    }
  } catch (err) {
    alert(`Error: ${err.message}`);
  }
};

async function autoAdvanceStages() {
  if (!currentTrackedRequest) {
    alert('Please track a request first or submit a new one.');
    return;
  }

  const reqId = currentTrackedRequest.requestId;
  const flow = [
    { endpoint: 'faculty-approve', from: 'SUBMITTED' },
    { endpoint: 'hod-approve', from: 'FACULTY_APPROVED' },
    { endpoint: 'dac-approve', from: 'HOD_APPROVED' },
    { endpoint: 'exam-lock', from: 'DAC_APPROVED' },
    { endpoint: 'dean-approve', from: 'EXAM_LOCKED' },
    { endpoint: 'admin-finalize', from: 'DEAN_APPROVED' }
  ];

  for (const step of flow) {
    await trackRequest(reqId);
    if (currentTrackedRequest.status === step.from) {
      await fetch(`${API_BASE}/workflow/${step.endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestId: reqId })
      });
    }
  }

  await trackRequest(reqId);
  alert(`🎉 Auto-advanced request ${reqId} to ${currentTrackedRequest.status}!`);
}

function renderHistory(history) {
  const list = document.getElementById('historyList');
  if (!list) return;

  if (history.length === 0) {
    list.innerHTML = '<li class="empty-hint">No history records</li>';
    return;
  }

  list.innerHTML = history.map(h => `
    <li>
      <span><strong>${h.stage}</strong> by <code>${h.updatedBy || 'N/A'}</code></span>
      <span style="color:#94a3b8;">${h.timestamp ? new Date(h.timestamp).toLocaleTimeString() : ''} - ${h.comments || ''}</span>
    </li>
  `).join('');
}

// ==========================================
// Certificate Issuance (Module 3 & 4)
// ==========================================
async function executeCertificateIssuance() {
  const certId = document.getElementById('issueCertId').value.trim();
  const panel = document.getElementById('issueResultPanel');

  if (!certId) {
    alert('Please enter a Certificate ID.');
    return;
  }

  if (!currentTrackedRequest) {
    alert('Please select or track an ADMIN_FINALIZED request first.');
    return;
  }

  try {
    panel.innerHTML = '<div class="result-placeholder">⏳ Generating Certificate PDF, uploading to IPFS, and committing to Hyperledger Fabric...</div>';

    const res = await fetch(`${API_BASE}/certificates/issue`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        certId,
        requestId: currentTrackedRequest.requestId,
        studentId: currentTrackedRequest.studentId,
        certType: currentTrackedRequest.certType
      })
    });

    const data = await res.json();
    if (res.ok) {
      const agentList = Array.isArray(data.executionLogs) ? data.executionLogs.map(l => `
        <div style="display:flex; justify-content:space-between; align-items:center; background:#1e293b; padding:0.4rem 0.6rem; margin-top:0.35rem; border-radius:6px; font-size:0.8rem; border-left:3px solid #38bdf8;">
          <div>
            <strong style="color:#38bdf8;">${l.agent}</strong>
            <span style="color:#94a3b8; margin-left:0.4rem;">(${l.role})</span>
          </div>
          <span style="background:#0f172a; padding:2px 6px; border-radius:4px; color:#10b981; font-family:monospace;">
            ${l.aiSource ? `⚡ ${l.aiSource}` : 'CONF'}: ${(Number(l.confidence || 0.99) * 100).toFixed(0)}%
          </span>
        </div>
      `).join('') : '';

      panel.innerHTML = `
        <div style="border-left: 3px solid #10b981; padding-left: 1rem;">
          <h4 style="color:#10b981; margin-bottom: 0.5rem;">🎉 Certificate Successfully Issued & Anchored!</h4>
          <p><strong>Certificate ID:</strong> <code>${data.certId}</code></p>
          <p><strong>IPFS Content ID (CID):</strong> <code>${data.ipfsCid}</code></p>
          <p><strong>SHA-256 Digest:</strong> <code style="word-break:break-all;">${data.sha256Hash}</code></p>
          ${agentList ? `
            <div style="margin-top:0.75rem;">
              <p style="font-size:0.85rem; font-weight:600; color:#cbd5e1; margin-bottom:0.25rem;">🤖 Module 4 Multi-Agent Verification & Anchoring Team:</p>
              ${agentList}
            </div>
          ` : ''}
          <div style="margin-top: 1rem; display: flex; gap: 0.75rem; flex-wrap:wrap;">
            <a href="${API_BASE}/certificates/${data.certId}/pdf" target="_blank" class="btn-primary" style="text-decoration:none; display:inline-block;">📄 View Generated PDF</a>
            <a href="http://localhost:8080/ipfs/${data.ipfsCid}" target="_blank" class="btn-secondary" style="text-decoration:none; display:inline-block;">🌐 View on IPFS Gateway</a>
          </div>
        </div>
      `;
      trackRequest(currentTrackedRequest.requestId);
    } else {
      panel.innerHTML = `<div style="color:#ef4444;">❌ Issuance failed: ${data.error}</div>`;
    }
  } catch (err) {
    panel.innerHTML = `<div style="color:#ef4444;">❌ Error: ${err.message}</div>`;
  }
}

// ==========================================
// Verification Portal
// ==========================================
function initVerification() {
  const idBtn = document.getElementById('verifyByIdBtn');
  const hashBtn = document.getElementById('verifyByHashBtn');
  const fileBtn = document.getElementById('verifyByFileBtn');

  if (idBtn) {
    idBtn.addEventListener('click', async () => {
      const certId = document.getElementById('verifyCertIdInput').value.trim();
      if (!certId) return alert('Enter Certificate ID');
      verifyEndpoint(`/verify/id/${certId}`);
    });
  }

  if (hashBtn) {
    hashBtn.addEventListener('click', async () => {
      const hash = document.getElementById('verifyHashInput').value.trim();
      if (!hash) return alert('Enter SHA-256 Hash');
      verifyEndpoint(`/verify/hash/${hash}`);
    });
  }

  if (fileBtn) {
    fileBtn.addEventListener('click', async () => {
      const fileInput = document.getElementById('verifyFileInput');
      if (!fileInput.files || fileInput.files.length === 0) {
        return alert('Please select a certificate PDF file.');
      }

      const formData = new FormData();
      formData.append('certificate', fileInput.files[0]);

      try {
        const display = document.getElementById('verifyResultDisplay');
        display.style.display = 'flex';
        document.getElementById('badgeStatus').textContent = 'CHECKING...';
        document.getElementById('badgeDetails').innerHTML = 'Hashing file and checking blockchain ledger...';

        const res = await fetch(`${API_BASE}/verify/file`, {
          method: 'POST',
          body: formData
        });
        const data = await res.json();
        renderVerificationBadge(data.verification, data.calculatedHash);
      } catch (err) {
        alert(`Error verifying file: ${err.message}`);
      }
    });
  }
}

async function verifyEndpoint(url) {
  const display = document.getElementById('verifyResultDisplay');
  display.style.display = 'flex';
  document.getElementById('badgeStatus').textContent = 'CHECKING...';
  document.getElementById('badgeDetails').innerHTML = 'Connecting to Fabric Ledger...';

  try {
    const res = await fetch(`${API_BASE}${url}`);
    const data = await res.json();
    renderVerificationBadge(data);
  } catch (err) {
    alert(`Verification call failed: ${err.message}`);
  }
}

function renderVerificationBadge(data, computedHash) {
  const statusEl = document.getElementById('badgeStatus');
  const detailsEl = document.getElementById('badgeDetails');

  const status = data.verificationStatus || (data.verified ? 'VERIFIED' : 'INVALID');
  statusEl.className = `badge-status ${status}`;
  statusEl.textContent = status;

  if (status === 'VERIFIED') {
    const c = data.certificate || {};
    detailsEl.innerHTML = `
      <h4 style="color:#34d399; margin-bottom: 0.25rem;">Authentic Blockchain Record Confirmed</h4>
      <p><strong>Student:</strong> ${c.studentName || c.studentId} | <strong>Degree:</strong> ${c.certType}</p>
      <p><strong>Cert ID:</strong> <code>${c.certId}</code> | <strong>Issue Date:</strong> ${c.issueDate}</p>
      <p><strong>IPFS CID:</strong> <code>${c.ipfsHash}</code></p>
      <p><strong>Fabric Anchor MSP:</strong> <code>${c.issuerMSP || 'Org3MSP'}</code></p>
      ${computedHash ? `<p style="font-size:0.8rem; color:#94a3b8;">Uploaded File SHA-256: <code>${computedHash}</code></p>` : ''}
    `;
  } else if (status === 'REVOKED') {
    const c = data.certificate || {};
    detailsEl.innerHTML = `
      <h4 style="color:#f87171; margin-bottom: 0.25rem;">Warning: Certificate Has Been Revoked</h4>
      <p><strong>Cert ID:</strong> <code>${c.certId}</code></p>
      <p><strong>Revocation Reason:</strong> ${c.revocation?.reason || 'Administrative revocation'}</p>
      <p><strong>Revoked By:</strong> ${c.revocation?.revokedBy || 'Authority'}</p>
      <p><strong>Revoked At:</strong> ${c.revocation?.revokedAt || 'Recorded on ledger'}</p>
    `;
  } else {
    detailsEl.innerHTML = `
      <h4 style="color:#fbbf24; margin-bottom: 0.25rem;">Invalid Certificate</h4>
      <p>${data.message || 'No matching record exists on the Hyperledger Fabric ledger.'}</p>
    `;
  }
}

// ==========================================
// Revocation Manager
// ==========================================
function initRevocation() {
  const form = document.getElementById('revokeForm');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const certId = document.getElementById('revokeCertId').value.trim();
    const reason = document.getElementById('revokeReason').value.trim();
    const revokedBy = document.getElementById('revokeOfficer').value.trim();

    if (!confirm(`Are you sure you want to permanently revoke certificate ${certId} on the blockchain?`)) {
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/certificates/revoke`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ certId, reason, revokedBy })
      });
      const data = await res.json();
      if (res.ok) {
        alert(`⚠️ Certificate ${certId} has been REVOKED on Hyperledger Fabric!`);
        form.reset();
      } else {
        alert(`Revocation failed: ${data.error}`);
      }
    } catch (err) {
      alert(`Error: ${err.message}`);
    }
  });
}

// ==========================================
// Ledger Explorer
// ==========================================
function initLedgerExplorer() {
  const refreshBtn = document.getElementById('refreshCertsBtn');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', loadCertificates);
  }
}

async function loadCertificates() {
  const tbody = document.getElementById('certsTbody');
  if (!tbody) return;

  try {
    tbody.innerHTML = '<tr><td colspan="7" class="empty-hint">Querying ledger...</td></tr>';
    const res = await fetch(`${API_BASE}/certificates`);
    const certs = await res.json();

    if (!Array.isArray(certs) || certs.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" class="empty-hint">No certificates on ledger yet.</td></tr>';
      return;
    }

    tbody.innerHTML = certs.map(c => {
      const ipfsVal = c.ipfsHash || c.ipfsCid || '';
      const docVal = c.docHash || c.sha256Hash || '';
      return `
      <tr>
        <td><code>${c.certId}</code></td>
        <td>${c.studentId}</td>
        <td>${c.certType}</td>
        <td><span class="step-tag" style="background:${c.status === 'ISSUED' ? '#065f46' : '#991b1b'}; padding:2px 6px; border-radius:4px;">${c.status}</span></td>
        <td>${ipfsVal ? `<a href="http://localhost:8080/ipfs/${ipfsVal}" target="_blank" style="color:#38bdf8;" title="${ipfsVal}">${ipfsVal.substring(0, 10)}...</a>` : '—'}</td>
        <td style="font-family:monospace; font-size:0.75rem;" title="${docVal}">${docVal ? `${docVal.substring(0, 16)}...` : '—'}</td>
        <td>
          <a href="${API_BASE}/certificates/${c.certId}/pdf" target="_blank" class="btn-secondary btn-sm" style="text-decoration:none;">PDF</a>
        </td>
      </tr>
    `;}).join('');
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="7" class="empty-hint">Error: ${err.message}</td></tr>`;
  }
}

// ==========================================
// Autonomous Agentic AI Engine
// ==========================================
function initAgenticEngine() {
  const loadLatestBtn = document.getElementById('loadLatestReqBtn');
  const reqInput = document.getElementById('agentRequestId');
  const preFlightBtn = document.getElementById('runPreFlightAuditBtn');
  const fraudScanBtn = document.getElementById('runFraudScanBtn');
  const form = document.getElementById('agentOrchestrateForm');
  const org1Btn = document.getElementById('runOrg1PipelineBtn');
  const terminal = document.getElementById('agentLogTerminal');
  const statusBadge = document.getElementById('agentExecutionStatus');
  const riskContainer = document.getElementById('riskGaugeContainer');
  const riskBadge = document.getElementById('riskScoreBadge');
  const riskFindings = document.getElementById('riskFindingsList');

  // Group 1: Academic Department Autonomous Pipeline (Stages 1-3)
  if (org1Btn) {
    org1Btn.addEventListener('click', async () => {
      const requestId = reqInput.value.trim();
      if (!requestId) {
        alert('Please enter or select a Request ID');
        return;
      }
      terminal.innerHTML = '';
      appendTerminalLog(`======================================================`);
      appendTerminalLog(`🏛️ [Academic Department Autonomous Pipeline Triggered]`);
      appendTerminalLog(`Target Request: ${requestId} | Organization: Org1MSP`);
      appendTerminalLog(`Autonomous Agents: FacultyAgent -> HODAgent -> DACAgent`);
      appendTerminalLog(`======================================================`);

      statusBadge.textContent = 'ORG1 RUNNING';
      statusBadge.style.background = '#0284c7';

      try {
        const res = await fetch(`${API_BASE}/agents/org1-department-audit`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ requestId })
        });
        const data = await res.json();
        if (res.ok && data.success) {
          if (data.auditLogs) {
            data.auditLogs.forEach(log => {
              appendTerminalLog(`\n[${log.agent}] Stage: ${log.stage}`);
              if (log.confidence) appendTerminalLog(`  • Confidence: ${(log.confidence * 100).toFixed(1)}%`);
              if (log.rationale) appendTerminalLog(`  • Rationale: ${log.rationale}`);
            });
          }
          statusBadge.textContent = 'ORG1 COMPLETE';
          statusBadge.style.background = '#10b981';
          appendTerminalLog(`\n✅ [Org1 Pipeline Complete] Stages 1–3 successfully verified and endorsed on peer0.org1:7051! Status is now DAC_APPROVED.`);
        } else {
          statusBadge.textContent = 'ORG1 HALTED';
          statusBadge.style.background = '#ef4444';
          appendTerminalLog(`\n❌ [Org1 Halted] ${data.error || 'Department audit failed'}`);
        }
      } catch (err) {
        statusBadge.textContent = 'ERROR';
        statusBadge.style.background = '#ef4444';
        appendTerminalLog(`\n❌ [Network Error] ${err.message}`);
      }
    });
  }

  // Load latest request
  if (loadLatestBtn) {
    loadLatestBtn.addEventListener('click', async () => {
      try {
        const res = await fetch(`${API_BASE}/requests`);
        const reqs = await res.json();
        if (Array.isArray(reqs) && reqs.length > 0) {
          const latest = reqs[reqs.length - 1];
          reqInput.value = latest.requestId;
          appendTerminalLog(`[Orchestrator] Selected latest request: ${latest.requestId} (Status: ${latest.status})`);
        } else {
          alert('No requests found on ledger. Submit one in the Lifecycle tab first.');
        }
      } catch (e) {
        alert(`Error: ${e.message}`);
      }
    });
  }

  // Pre-Flight Audit
  if (preFlightBtn) {
    preFlightBtn.addEventListener('click', async () => {
      const requestId = reqInput.value.trim();
      if (!requestId) {
        alert('Please enter or select a Request ID');
        return;
      }

      appendTerminalLog(`\n[🔍 Pre-Flight Audit Initiated] Auditing ${requestId}...`);
      statusBadge.textContent = 'AUDITING';
      statusBadge.style.background = '#4f46e5';

      try {
        const res = await fetch(`${API_BASE}/agents/audit/${requestId}`);
        const data = await res.json();

        if (res.ok) {
          appendTerminalLog(`[Audit Complete] Current Stage: ${data.currentStatus}`);
          appendTerminalLog(`  • Fraud Risk: ${data.fraudAssessment.riskScore}/100 (${data.fraudAssessment.riskLevel})`);
          appendTerminalLog(`  • Recommendation: ${data.fraudAssessment.recommendation}`);

          renderRiskGauge(data.fraudAssessment);
          statusBadge.textContent = 'AUDITED';
        } else {
          appendTerminalLog(`❌ [Audit Error] ${data.error}`);
          statusBadge.textContent = 'ERROR';
        }
      } catch (err) {
        appendTerminalLog(`❌ [Network Error] ${err.message}`);
      }
    });
  }

  // Fraud & Anomaly Risk Scan
  if (fraudScanBtn) {
    fraudScanBtn.addEventListener('click', async () => {
      const requestId = reqInput.value.trim();
      if (!requestId) {
        alert('Please enter or select a Request ID');
        return;
      }

      appendTerminalLog(`\n[🛡️ Fraud Sentinel Scanner] Inspecting ${requestId}...`);
      try {
        const reqRes = await fetch(`${API_BASE}/requests/${requestId}`);
        const reqData = await reqRes.json();

        const scanRes = await fetch(`${API_BASE}/agents/fraud-scan`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(reqData)
        });
        const scanData = await scanRes.json();

        renderRiskGauge(scanData);
        appendTerminalLog(`[Fraud Scan Result] Score: ${scanData.riskScore}/100, Tier: ${scanData.riskLevel}`);
        if (scanData.findings && scanData.findings.length > 0) {
          scanData.findings.forEach(f => {
            appendTerminalLog(`  ⚠️ [${f.severity}] ${f.type}: ${f.detail}`);
          });
        } else {
          appendTerminalLog(`  ✅ Zero anomalies or velocity collisions detected.`);
        }
      } catch (err) {
        appendTerminalLog(`❌ [Fraud Scan Error] ${err.message}`);
      }
    });
  }

  // 1-Click Multi-Agent Pipeline
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const requestId = reqInput.value.trim();
      if (!requestId) return;

      terminal.innerHTML = '';
      appendTerminalLog(`======================================================`);
      appendTerminalLog(`⚡ [1-Click Autonomous Multi-Agent Pipeline Triggered]`);
      appendTerminalLog(`Target Request: ${requestId}`);
      appendTerminalLog(`Consortium: Org 1 (Academic), Org 2 (Exam), Org 3 (Admin)`);
      appendTerminalLog(`======================================================`);

      statusBadge.textContent = 'RUNNING';
      statusBadge.style.background = '#f59e0b';

      try {
        const res = await fetch(`${API_BASE}/agents/orchestrate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ requestId, autoIssue: true })
        });
        const data = await res.json();

        if (res.ok && data.success) {
          if (data.executionLogs) {
            data.executionLogs.forEach(log => {
              const agentTag = log.agent ? `[${log.agent}]` : `[${log.step}]`;
              appendTerminalLog(`\n${agentTag} Step: ${log.step}`);
              if (log.confidence) appendTerminalLog(`  • Confidence: ${(log.confidence * 100).toFixed(1)}%`);
              if (log.rationale) appendTerminalLog(`  • Rationale: ${log.rationale}`);
              if (log.gradesHash) appendTerminalLog(`  • Merkle Digest: ${log.gradesHash}`);
              if (log.issuanceResult) {
                appendTerminalLog(`  🎉 Certificate Minted: ${log.issuanceResult.certId}`);
                appendTerminalLog(`  • IPFS CID: ${log.issuanceResult.ipfsCid}`);
                appendTerminalLog(`  • SHA-256 Digest: ${log.issuanceResult.sha256Hash}`);
              }
            });
          }

          statusBadge.textContent = 'SUCCESS (ISSUED)';
          statusBadge.style.background = '#10b981';
          appendTerminalLog(`\n✅ [Pipeline Complete in ${data.durationMs}ms] Certificate successfully issued and anchored on Fabric & IPFS!`);
        } else {
          statusBadge.textContent = 'HALTED / FAILED';
          statusBadge.style.background = '#ef4444';
          appendTerminalLog(`\n❌ [Pipeline Halted] ${data.error || data.message || 'Execution error'}`);
          if (data.executionLogs) {
            data.executionLogs.forEach(log => {
              appendTerminalLog(`  [${log.agent || log.step}] ${log.rationale || log.status || ''}`);
            });
          }
        }
      } catch (err) {
        statusBadge.textContent = 'ERROR';
        statusBadge.style.background = '#ef4444';
        appendTerminalLog(`\n❌ [Connection Error] ${err.message}`);
      }
    });
  }

  function appendTerminalLog(msg) {
    if (!terminal) return;
    const p = document.createElement('p');
    p.style.margin = '3px 0';
    p.textContent = msg;
    terminal.appendChild(p);
    terminal.scrollTop = terminal.scrollHeight;
  }

  function renderRiskGauge(fraudData) {
    if (!riskContainer || !riskBadge) return;
    riskContainer.style.display = 'block';
    const score = fraudData.riskScore || 0;
    const level = fraudData.riskLevel || 'LOW';

    riskBadge.textContent = `${score} / 100 (${level})`;
    if (score < 25) {
      riskBadge.style.background = '#22c55e';
    } else if (score < 60) {
      riskBadge.style.background = '#f59e0b';
    } else {
      riskBadge.style.background = '#ef4444';
    }

    if (riskFindings) {
      if (!fraudData.findings || fraudData.findings.length === 0) {
        riskFindings.innerHTML = '<span style="color:#22c55e;">✅ All safety invariants and transcript checks passed.</span>';
      } else {
        riskFindings.innerHTML = fraudData.findings.map(f =>
          `<div>• <strong>[${f.severity}]</strong> ${f.detail}</div>`
        ).join('');
      }
    }
  }
}

// ==========================================
// Conversational AI Assistant (Chatbot Widget)
// ==========================================
function initChatbot() {
  const toggleBtn = document.getElementById('chatbotToggleBtn');
  const closeBtn = document.getElementById('chatbotCloseBtn');
  const modal = document.getElementById('chatbotModal');
  const form = document.getElementById('chatbotForm');
  const input = document.getElementById('chatbotInput');
  const messages = document.getElementById('chatbotMessages');
  const quickChips = document.querySelectorAll('.chip-btn');

  if (toggleBtn && modal) {
    toggleBtn.addEventListener('click', () => {
      modal.style.display = modal.style.display === 'none' ? 'flex' : 'none';
      if (modal.style.display === 'flex') input.focus();
    });
  }

  if (closeBtn && modal) {
    closeBtn.addEventListener('click', () => {
      modal.style.display = 'none';
    });
  }

  quickChips.forEach(chip => {
    chip.addEventListener('click', () => {
      const query = chip.dataset.query;
      if (query) {
        sendChatbotQuery(query);
      }
    });
  });

  if (form) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const text = input.value.trim();
      if (!text) return;
      input.value = '';
      sendChatbotQuery(text);
    });
  }

  async function sendChatbotQuery(text) {
    appendUserMsg(text);
    const typingIndicator = appendBotMsg('⏳ _Querying Hyperledger Fabric ledger & agents..._');

    try {
      const res = await fetch(`${API_BASE}/agents/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text })
      });
      const data = await res.json();

      typingIndicator.remove();
      if (res.ok) {
        appendBotMsg(formatMarkdownText(data.reply));
      } else {
        appendBotMsg(`⚠️ Error: ${data.error}`);
      }
    } catch (err) {
      typingIndicator.remove();
      appendBotMsg(`❌ Connection error: ${err.message}`);
    }
  }

  function appendUserMsg(text) {
    const div = document.createElement('div');
    div.className = 'chat-msg user-msg';
    div.textContent = text;
    messages.appendChild(div);
    messages.scrollTop = messages.scrollHeight;
  }

  function appendBotMsg(html) {
    const div = document.createElement('div');
    div.className = 'chat-msg bot-msg';
    div.innerHTML = html;
    messages.appendChild(div);
    messages.scrollTop = messages.scrollHeight;
    return div;
  }

  function formatMarkdownText(md) {
    if (!md) return '';
    return md
      .replace(/\n\n/g, '<br><br>')
      .replace(/\n/g, '<br>')
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/• /g, '• ');
  }
}

// ==========================================
// Cryptographic Keys & MSP Identity Center
// ==========================================
function initKeysCenter() {
  const genBtn = document.getElementById('genNewStudentKeyBtn');
  const refreshBtn = document.getElementById('refreshKeysBtn');

  if (genBtn) {
    genBtn.addEventListener('click', async () => {
      try {
        const res = await fetch(`${API_BASE}/students/generate-keypair`, { method: 'POST' });
        const data = await res.json();

        // Download private key file
        const blob = new Blob([data.privateKeyPem], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `student_private_key_${Date.now()}.pem`;
        a.click();
        URL.revokeObjectURL(url);

        // Display in viewer
        const viewer = document.getElementById('keyViewerCard');
        const title = document.getElementById('keyViewerTitle');
        const content = document.getElementById('keyViewerContent');
        if (viewer && content) {
          title.textContent = `Generated Student Keypair (SHA-256 Fingerprint: ${data.sha256Fingerprint.substring(0, 16)}...)`;
          content.textContent = `--- PUBLIC KEY (ECDSA P-256) ---\n${data.publicKeyPem}\n--- PRIVATE KEY (DOWNLOADED) ---\n${data.privateKeyPem}\nHex Public Key:\n${data.publicKeyHex}`;
          viewer.style.display = 'block';
        }
      } catch (err) {
        alert(`Failed to generate student keypair: ${err.message}`);
      }
    });
  }

  if (refreshBtn) {
    refreshBtn.addEventListener('click', loadKeysSummary);
  }
}

async function loadKeysSummary() {
  try {
    const res = await fetch(`${API_BASE}/keys/summary`);
    if (!res.ok) return;
    const summary = await res.json();
    console.log('[Keys Center] Loaded cryptographic keys summary:', summary);
  } catch (e) {
    console.warn('[Keys Center] Key summary note:', e.message);
  }
}

window.viewKeyFile = async function(folder, filename) {
  const viewer = document.getElementById('keyViewerCard');
  const title = document.getElementById('keyViewerTitle');
  const content = document.getElementById('keyViewerContent');

  if (!viewer || !content) return;

  try {
    content.textContent = 'Loading cryptographic key...';
    viewer.style.display = 'block';
    title.textContent = `File: ${folder}/${filename}`;

    const res = await fetch(`${API_BASE}/keys/file/${folder}/${filename}`);
    if (!res.ok) {
      content.textContent = `Unable to fetch key file (${res.status}): ${await res.text()}`;
      return;
    }
    const text = await res.text();
    content.textContent = text;
    viewer.scrollIntoView({ behavior: 'smooth' });
  } catch (err) {
    content.textContent = `Error reading key file: ${err.message}`;
  }
};

// ==========================================
// Contributor 6.2: Health & Telemetry Sentinel
// ==========================================
function initTelemetryDashboard() {
  const probeBtn = document.getElementById('probeTelemetryBtn');
  if (probeBtn) {
    probeBtn.addEventListener('click', loadTelemetryData);
  }
}

async function loadTelemetryData() {
  const statusEl = document.getElementById('tmSystemStatus');
  const countEl = document.getElementById('tmHealthyContainers');
  const heightEl = document.getElementById('tmBlockHeight');
  const parityEl = document.getElementById('tmSyncParity');
  const latencyEl = document.getElementById('tmProbeLatency');
  const peersTbody = document.getElementById('tmPeersTbody');
  const nodesTbody = document.getElementById('tmNodesTbody');
  const adviceList = document.getElementById('tmAdviceList');

  if (statusEl) statusEl.textContent = 'PROBING...';
  if (peersTbody) peersTbody.innerHTML = '<tr><td colspan="7" class="empty-hint">Sending gRPC probes across 3 Orgs...</td></tr>';
  if (nodesTbody) nodesTbody.innerHTML = '<tr><td colspan="5" class="empty-hint">Probing Docker engine and daemon ports...</td></tr>';

  try {
    const res = await fetch(`${API_BASE}/agent/health/telemetry`);
    const data = await res.json();

    if (!res.ok) {
      if (statusEl) statusEl.textContent = 'ERROR';
      return;
    }

    // Top metrics
    if (statusEl) {
      statusEl.textContent = data.status;
      statusEl.style.color = data.status === 'OPTIMAL' ? '#10b981' : (data.status === 'DEGRADED' ? '#f59e0b' : '#ef4444');
    }
    if (countEl) countEl.textContent = `${data.summary?.healthyContainers || 'N/A'} Active`;
    if (heightEl) heightEl.textContent = `Block #${data.summary?.blockHeight ?? 0}`;
    if (parityEl) {
      const inSync = data.summary?.inSync;
      parityEl.textContent = inSync ? '100% IN SYNC' : 'DRIFT DETECTED';
      parityEl.style.color = inSync ? '#10b981' : '#ef4444';
    }
    if (latencyEl) latencyEl.textContent = `${data.summary?.diagnosticLatencyMs || 0} ms`;

    // Section 1: Peers Sync Parity Table
    if (peersTbody && data.syncParity?.peers) {
      peersTbody.innerHTML = data.syncParity.peers.map(p => `
        <tr>
          <td><strong>${p.org}</strong></td>
          <td><code>${p.peer}:${p.port}</code></td>
          <td><code>${p.msp}</code></td>
          <td><span style="font-weight:700; color:#38bdf8;">#${p.height !== null ? p.height : 'N/A'}</span></td>
          <td style="font-family:monospace; font-size:0.75rem; word-break:break-all;">${p.currentBlockHash || 'N/A'}</td>
          <td><span style="color:${p.parityDrift === 0 ? '#10b981' : '#f59e0b'}; font-weight:600;">${p.parityDrift === 0 ? '0 blocks (0.00%)' : `+${p.parityDrift} blocks`}</span></td>
          <td>
            <span class="step-tag" style="background:${p.syncStatus === 'SYNCHRONIZED' ? '#065f46' : '#991b1b'}; color:#fff; padding:3px 8px; border-radius:4px; font-weight:600;">
              ${p.syncStatus}
            </span>
          </td>
        </tr>
      `).join('');
    }

    // Section 2: Consortium Nodes Table
    if (nodesTbody && data.nodes) {
      nodesTbody.innerHTML = data.nodes.map(n => `
        <tr>
          <td><code>${n.name}</code></td>
          <td>${n.role}</td>
          <td><code>${n.port || 'Internal'}</code></td>
          <td>
            <span class="step-tag" style="background:${n.status === 'HEALTHY' ? '#065f46' : '#991b1b'}; color:#fff; padding:3px 8px; border-radius:4px; font-weight:600;">
              ${n.status}
            </span>
          </td>
          <td style="color:#94a3b8; font-size:0.85rem;">${n.detail}</td>
        </tr>
      `).join('');
    }

    // Section 3: Self-Healing Advice
    if (adviceList && data.selfHealingAdvice) {
      adviceList.innerHTML = data.selfHealingAdvice.map(a => {
        const isOptimal = a.severity === 'OPTIMAL';
        const color = isOptimal ? '#10b981' : (a.severity === 'HIGH' ? '#f59e0b' : '#ef4444');
        const bg = isOptimal ? 'rgba(16, 185, 129, 0.08)' : 'rgba(239, 68, 68, 0.08)';

        return `
          <div class="advice-item" style="border-left: 4px solid ${color}; background: ${bg}; padding: 0.85rem; border-radius: 6px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.25rem;">
              <span style="background: ${color}; color: #fff; padding: 2px 8px; border-radius: 4px; font-size: 0.75rem; font-weight: 700;">
                ${a.severity}
              </span>
              <span style="color: #94a3b8; font-size: 0.8rem;">Component: <code>${a.component}</code></span>
            </div>
            <div style="color: #f8fafc; font-weight: 500; margin: 0.4rem 0;">${a.issue}</div>
            <div style="font-size: 0.85rem; color: #cbd5e1; font-family: monospace; background: rgba(0,0,0,0.35); padding: 0.4rem 0.6rem; border-radius: 4px;">
              💡 ${a.action}
            </div>
          </div>
        `;
      }).join('');
    }

  } catch (err) {
    if (statusEl) statusEl.textContent = 'PROBE FAILED';
    if (peersTbody) peersTbody.innerHTML = `<tr><td colspan="7" class="empty-hint" style="color:#ef4444;">Error probing peers: ${err.message}</td></tr>`;
    if (nodesTbody) nodesTbody.innerHTML = `<tr><td colspan="5" class="empty-hint" style="color:#ef4444;">Error probing infrastructure: ${err.message}</td></tr>`;
  }
}

// ==========================================
// Group 1: ZK-Passport & Privacy Suite
// ==========================================
function initZkPassportSuite() {
  const genPassportBtn = document.getElementById('generatePassportBtn');
  const genZkProofBtn = document.getElementById('generateZkProofBtn');
  const runZkVerifierBtn = document.getElementById('runZkVerifierBtn');
  const passportStuInput = document.getElementById('passportStuId');
  const zkThresholdSelect = document.getElementById('zkThresholdSelect');
  const zkVerifyTokenInput = document.getElementById('zkVerifyTokenInput');

  // 1. Contributor 1.1: Academic Passport & Dynamic QR
  if (genPassportBtn) {
    genPassportBtn.addEventListener('click', async () => {
      const studentId = (passportStuInput ? passportStuInput.value : 'STU-2024-001').trim();
      genPassportBtn.disabled = true;
      genPassportBtn.textContent = 'Generating...';

      try {
        const res = await fetch(`${API_BASE}/passport/generate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ studentId })
        });
        const data = await res.json();
        if (!data.success) throw new Error(data.error || 'Failed to issue passport');

        const p = data.passport;
        document.getElementById('ppStudentName').textContent = p.fullName || 'Alice Johnson';
        document.getElementById('ppStudentDid').textContent = p.did || `did:fabric:org1:${studentId}`;
        document.getElementById('ppHonorsBadge').textContent = p.latinHonors || 'Summa Cum Laude';
        document.getElementById('ppDegree').textContent = p.degree || 'MCA';
        document.getElementById('ppDept').textContent = p.department || 'Computer Science';
        document.getElementById('ppFingerprint').textContent = p.publicKeyFingerprint ? `${p.publicKeyFingerprint}...` : 'f48c2b9a710e...';

        const qrImg = document.getElementById('ppQrImg');
        const qrPlc = document.getElementById('ppQrPlaceholder');
        if (data.qrDataUrl && qrImg) {
          qrImg.src = data.qrDataUrl;
          qrImg.style.display = 'block';
          if (qrPlc) qrPlc.style.display = 'none';
        }

        const outBox = document.getElementById('passportCardOutput');
        if (outBox) outBox.style.display = 'block';
      } catch (err) {
        alert(`Passport Generation Error: ${err.message}`);
      } finally {
        genPassportBtn.disabled = false;
        genPassportBtn.textContent = 'Generate Passport & QR';
      }
    });
  }

  // 2. Contributor 1.2: ZK Range Proof Generation
  if (genZkProofBtn) {
    genZkProofBtn.addEventListener('click', async () => {
      const studentId = (passportStuInput ? passportStuInput.value : 'STU-2024-001').trim();
      const minThreshold = parseFloat(zkThresholdSelect ? zkThresholdSelect.value : 8.5);
      genZkProofBtn.disabled = true;
      genZkProofBtn.textContent = 'Computing Proof...';

      try {
        const res = await fetch(`${API_BASE}/zk/generate-proof`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ studentId, minCgpaThreshold: minThreshold })
        });
        const data = await res.json();
        if (!data.success) throw new Error(data.error || 'Failed to generate ZK proof');

        const tokenPill = document.getElementById('zkProofTokenPill');
        const hashText = document.getElementById('zkProofHashText');
        const resultBox = document.getElementById('zkProofResultBox');

        if (tokenPill) tokenPill.textContent = data.proofToken;
        if (hashText) hashText.textContent = `Proof Hash: ${data.proofHash}`;
        if (zkVerifyTokenInput) zkVerifyTokenInput.value = data.proofHash;
        if (resultBox) resultBox.style.display = 'block';
      } catch (err) {
        alert(`ZK Proof Error: ${err.message}`);
      } finally {
        genZkProofBtn.disabled = false;
        genZkProofBtn.textContent = '⚡ Generate Zero-Knowledge Merkle Proof';
      }
    });
  }

  // 3. Contributor 1.3: Autonomous ZK Verifier Agent
  if (runZkVerifierBtn) {
    runZkVerifierBtn.addEventListener('click', async () => {
      let proofHash = zkVerifyTokenInput ? zkVerifyTokenInput.value.trim() : '';
      if (!proofHash) {
        alert('Please generate a ZK proof above first or enter a proof hash.');
        return;
      }
      const claimedThreshold = parseFloat(zkThresholdSelect ? zkThresholdSelect.value : 8.5);
      runZkVerifierBtn.disabled = true;
      runZkVerifierBtn.textContent = 'Auditing with AI Agent...';

      try {
        const res = await fetch(`${API_BASE}/zk/verify-proof`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ proofHash, claimedThreshold })
        });
        const data = await res.json();

        const agentBox = document.getElementById('zkAgentOutputBox');
        const stepsContainer = document.getElementById('zkAgentSteps');
        const badge = document.getElementById('zkAgentBadge');

        if (badge) {
          badge.textContent = data.decision === 'HIRE_CLEARANCE_GRANTED' ? 'HIRE APPROVED' : 'FLAGGED';
          badge.style.background = data.decision === 'HIRE_CLEARANCE_GRANTED' ? '#10b981' : '#ef4444';
        }

        if (stepsContainer && data.steps) {
          stepsContainer.innerHTML = data.steps.map(s => `
            <div style="background: rgba(255,255,255,0.05); padding: 0.4rem 0.6rem; border-radius: 4px; border-left: 3px solid ${s.status === 'CLEARED' || s.status === 'VALID' || s.status === 'ENDORSED' ? '#10b981' : '#f59e0b'};">
              <div style="font-weight: 600; color: #38bdf8;">${s.step} [${s.status}]</div>
              <div style="color: #94a3b8; font-size: 0.72rem; margin-top: 0.15rem;">${s.detail}</div>
            </div>
          `).join('') + `
            <div style="margin-top: 0.4rem; padding: 0.4rem; background: rgba(16, 185, 129, 0.1); border: 1px solid #10b981; border-radius: 4px; text-align: center; color: #10b981; font-weight: bold;">
              🎉 Zero-Knowledge Verification Successful • Confidential Transcripts Undisclosed
            </div>
          `;
        }

        if (agentBox) agentBox.style.display = 'block';
      } catch (err) {
        alert(`Agent Verification Error: ${err.message}`);
      } finally {
        runZkVerifierBtn.disabled = false;
        runZkVerifierBtn.textContent = '🚀 Run Autonomous Verifier Agent';
      }
    });
  }
}
