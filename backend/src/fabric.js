'use strict';

const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');
const EventEmitter = require('events');

const CHANNEL_NAME = process.env.CHANNEL_NAME || 'academicchannel';
const CHAINCODE_NAME = process.env.CHAINCODE_NAME || 'academic-contract';
const EVENT_NAME = 'AcademicCertificateLifecycle';

// Internal event bus for streaming ledger events
const ledgerEvents = new EventEmitter();
ledgerEvents.setMaxListeners(50);

let eventListenerStarted = false;
let eventListenerError = null;

// Organization Connection Configurations
const ORG_CONFIG = {
  1: {
    msp: 'Org1MSP',
    name: 'Org1 - University Academic Department',
    peer: 'peer0.org1.academic.edu',
    port: 7051,
    address: 'peer0.org1.academic.edu:7051',
    tlsCertPath: path.resolve(__dirname, '../../network/crypto-config/peerOrganizations/org1.academic.edu/peers/peer0.org1.academic.edu/tls/ca.crt'),
    rootCert: '/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/org1.academic.edu/peers/peer0.org1.academic.edu/tls/ca.crt',
    mspPath: '/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/org1.academic.edu/users/Admin@org1.academic.edu/msp'
  },
  2: {
    msp: 'Org2MSP',
    name: 'Org2 - Examination Board',
    peer: 'peer0.org2.academic.edu',
    port: 8051,
    address: 'peer0.org2.academic.edu:8051',
    tlsCertPath: path.resolve(__dirname, '../../network/crypto-config/peerOrganizations/org2.academic.edu/peers/peer0.org2.academic.edu/tls/ca.crt'),
    rootCert: '/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/org2.academic.edu/peers/peer0.org2.academic.edu/tls/ca.crt',
    mspPath: '/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/org2.academic.edu/users/Admin@org2.academic.edu/msp'
  },
  3: {
    msp: 'Org3MSP',
    name: 'Org3 - University Administration & Dean',
    peer: 'peer0.org3.academic.edu',
    port: 9051,
    address: 'peer0.org3.academic.edu:9051',
    tlsCertPath: path.resolve(__dirname, '../../network/crypto-config/peerOrganizations/org3.academic.edu/peers/peer0.org3.academic.edu/tls/ca.crt'),
    rootCert: '/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/org3.academic.edu/peers/peer0.org3.academic.edu/tls/ca.crt',
    mspPath: '/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/org3.academic.edu/users/Admin@org3.academic.edu/msp'
  }
};

const ORDERER_TLS_ROOTCERT = '/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/ordererOrganizations/academic.edu/orderers/orderer.academic.edu/msp/tlscacerts/tlsca.academic.edu-cert.pem';
const ORDERER_ADDRESS = 'orderer.academic.edu:7050';

function getOrgConfig(orgNum) {
  const num = parseInt(orgNum, 10) || 1;
  return ORG_CONFIG[num] || ORG_CONFIG[1];
}

function normalizeContractEvent(event) {
  let payload = event.payload;
  if (Buffer.isBuffer(payload)) {
    try {
      payload = JSON.parse(payload.toString('utf8'));
    } catch (e) {
      payload = payload.toString('utf8');
    }
  }
  return {
    type: 'LEDGER_UPDATE',
    eventName: event.eventName || EVENT_NAME,
    transactionId: event.transactionId || null,
    blockNumber: event.blockNumber !== undefined ? Number(event.blockNumber) : null,
    payload,
    receivedAt: new Date().toISOString()
  };
}

function onLedgerEvent(listener) {
  ledgerEvents.on('event', listener);
  return () => ledgerEvents.off('event', listener);
}

function emitLocalEvent(payload) {
  ledgerEvents.emit('event', normalizeContractEvent({ payload }));
}

function getEventStatus() {
  return {
    started: true,
    eventName: EVENT_NAME,
    error: eventListenerError
  };
}

/**
 * Decode the escaped payload string printed by `peer chaincode invoke`.
 */
function decodeCliPayload(escaped) {
  const bytes = [];
  for (let i = 0; i < escaped.length; i++) {
    const ch = escaped[i];
    if (ch !== '\\') {
      bytes.push(...Buffer.from(ch, 'utf8'));
      continue;
    }
    const next = escaped[++i];
    if (/[0-7]/.test(next)) {
      const oct = escaped.substr(i, 3).match(/^[0-7]{1,3}/)[0];
      bytes.push(parseInt(oct, 8));
      i += oct.length - 1;
    } else {
      const map = { n: 10, t: 9, r: 13, '"': 34, "'": 39, '\\': 92 };
      bytes.push(map[next] !== undefined ? map[next] : next.charCodeAt(0));
    }
  }
  return Buffer.from(bytes).toString('utf8');
}

/**
 * Execute peer chaincode invoke via CLI container with direct argv.
 * Endorses across all 3 Orgs to satisfy consortium endorsement policy.
 */
async function invokeChaincode(functionName, args = [], orgNum = 1) {
  const org = getOrgConfig(orgNum);
  const ctorJson = JSON.stringify({
    function: functionName,
    Args: args.map(a => (typeof a === 'object' ? JSON.stringify(a) : String(a)))
  });

  const cmdArgs = [
    'exec',
    '-e', `CORE_PEER_LOCALMSPID=${org.msp}`,
    '-e', `CORE_PEER_TLS_ROOTCERT_FILE=${org.rootCert}`,
    '-e', `CORE_PEER_MSPCONFIGPATH=${org.mspPath}`,
    '-e', `CORE_PEER_ADDRESS=${org.address}`,
    'cli',
    'peer', 'chaincode', 'invoke',
    '-o', ORDERER_ADDRESS,
    '--ordererTLSHostnameOverride', 'orderer.academic.edu',
    '--tls',
    '--cafile', ORDERER_TLS_ROOTCERT,
    '-C', CHANNEL_NAME,
    '-n', CHAINCODE_NAME,
    '--peerAddresses', 'peer0.org1.academic.edu:7051',
    '--tlsRootCertFiles', ORG_CONFIG[1].rootCert,
    '--peerAddresses', 'peer0.org2.academic.edu:8051',
    '--tlsRootCertFiles', ORG_CONFIG[2].rootCert,
    '--peerAddresses', 'peer0.org3.academic.edu:9051',
    '--tlsRootCertFiles', ORG_CONFIG[3].rootCert,
    '-c', ctorJson,
    '--waitForEvent'
  ];

  return new Promise((resolve, reject) => {
    const { spawn } = require('child_process');
    const child = spawn('docker', cmdArgs);
    let stdout = '';
    let stderr = '';

    child.stdout.on('data', d => { stdout += d.toString(); });
    child.stderr.on('data', d => { stderr += d.toString(); });

    child.on('close', code => {
      const output = (stdout + '\n' + stderr).trim();
      if (code !== 0) {
        return reject(new Error(`Chaincode invoke failed (exit ${code}): ${stderr || stdout}`));
      }
      try {
        // Fabric prints the payload as an escaped string (\" \\ \n and octal \NNN bytes);
        // match up to the closing unescaped quote and decode it back to UTF-8.
        const payloadMatch = output.match(/payload:"((?:[^"\\]|\\.)*)"/);
        if (payloadMatch) {
          const raw = decodeCliPayload(payloadMatch[1]);
          try {
            return resolve(JSON.parse(raw));
          } catch (_) {
            return resolve(raw);
          }
        }
        resolve({ success: true, result: output });
      } catch (e) {
        resolve({ success: true, result: output });
      }
    });

    child.on('error', err => reject(new Error(`Failed to spawn docker CLI: ${err.message}`)));
  });
}

/**
 * Execute peer chaincode query via CLI container.
 */
async function queryChaincode(functionName, args = [], orgNum = 1) {
  const org = getOrgConfig(orgNum);
  const ctorJson = JSON.stringify({
    function: functionName,
    Args: args.map(a => (typeof a === 'object' ? JSON.stringify(a) : String(a)))
  });

  const cmdArgs = [
    'exec',
    '-e', `CORE_PEER_LOCALMSPID=${org.msp}`,
    '-e', `CORE_PEER_TLS_ROOTCERT_FILE=${org.rootCert}`,
    '-e', `CORE_PEER_MSPCONFIGPATH=${org.mspPath}`,
    '-e', `CORE_PEER_ADDRESS=${org.address}`,
    'cli',
    'peer', 'chaincode', 'query',
    '-C', CHANNEL_NAME,
    '-n', CHAINCODE_NAME,
    '-c', ctorJson
  ];

  return new Promise((resolve, reject) => {
    const { spawn } = require('child_process');
    const child = spawn('docker', cmdArgs);
    let stdout = '';
    let stderr = '';

    child.stdout.on('data', d => { stdout += d.toString(); });
    child.stderr.on('data', d => { stderr += d.toString(); });

    child.on('close', code => {
      if (code !== 0) {
        return reject(new Error(`Chaincode query failed (exit ${code}): ${stderr || stdout}`));
      }
      const raw = stdout.trim();
      if (!raw) return resolve(null);
      try {
        resolve(JSON.parse(raw));
      } catch (_) {
        resolve(raw);
      }
    });

    child.on('error', err => reject(new Error(`Failed to spawn docker CLI: ${err.message}`)));
  });
}

/**
 * Query chronological history of a key using chaincode GetHistoryForKey (Contributor 5.1).
 */
async function getCertificateHistory(key, orgNum = 1) {
  try {
    const raw = await queryChaincode('GetHistoryForKey', [key], orgNum);
    if (!raw) return [];
    const list = Array.isArray(raw) ? raw : (typeof raw === 'string' ? JSON.parse(raw) : [raw]);
    return list;
  } catch (err) {
    return [];
  }
}

/**
 * Check network health across all 3 peer containers and orderer.
 */
async function checkNetworkHealth() {
  const containers = [
    'peer0.org1.academic.edu',
    'peer0.org2.academic.edu',
    'peer0.org3.academic.edu',
    'orderer.academic.edu'
  ];

  return new Promise(resolve => {
    exec('docker ps --format "{{.Names}}"', (err, stdout) => {
      if (err) {
        return resolve({ allHealthy: false, error: err.message, containers: {} });
      }
      const running = stdout.split('\n').map(s => s.trim());
      const health = {};
      let allUp = true;
      for (const c of containers) {
        const isUp = running.includes(c);
        health[c] = isUp ? 'UP' : 'DOWN';
        if (!isUp) allUp = false;
      }
      resolve({ allHealthy: allUp, containers: health });
    });
  });
}

module.exports = {
  invokeChaincode,
  queryChaincode,
  getCertificateHistory,
  onLedgerEvent,
  emitLocalEvent,
  getEventStatus,
  checkNetworkHealth,
  ORG_CONFIG
};
