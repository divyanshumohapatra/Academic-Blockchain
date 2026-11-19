'use strict';

const { execFile, exec } = require('child_process');
const util = require('util');
const execFilePromise = util.promisify(execFile);
const execPromise = util.promisify(exec);

const CHANNEL_NAME = process.env.CHANNEL_NAME || 'academicchannel';
const CHAINCODE_NAME = process.env.CHAINCODE_NAME || 'academic-contract';

const ORDERER_CA = '/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/ordererOrganizations/academic.edu/orderers/orderer.academic.edu/msp/tlscacerts/tlsca.academic.edu-cert.pem';
const PEER1_CA = '/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/org1.academic.edu/peers/peer0.org1.academic.edu/tls/ca.crt';
const PEER2_CA = '/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/org2.academic.edu/peers/peer0.org2.academic.edu/tls/ca.crt';
const PEER3_CA = '/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/org3.academic.edu/peers/peer0.org3.academic.edu/tls/ca.crt';

function getOrgConfig(orgNum = 1) {
  const num = parseInt(orgNum, 10) || 1;
  const port = num === 1 ? 7051 : (num === 2 ? 8051 : 9051);
  return {
    msp: `Org${num}MSP`,
    address: `peer0.org${num}.academic.edu:${port}`,
    rootCert: `/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/org${num}.academic.edu/peers/peer0.org${num}.academic.edu/tls/ca.crt`,
    mspPath: `/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/org${num}.academic.edu/users/Admin@org${num}.academic.edu/msp`
  };
}

/**
 * Execute peer chaincode invoke via CLI container with direct argv (no shell escaping issues).
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
    '-o', 'orderer.academic.edu:7050',
    '--ordererTLSHostnameOverride', 'orderer.academic.edu',
    '--tls',
    '--cafile', ORDERER_CA,
    '-C', CHANNEL_NAME,
    '-n', CHAINCODE_NAME,
    '--peerAddresses', 'peer0.org1.academic.edu:7051', '--tlsRootCertFiles', PEER1_CA,
    '--peerAddresses', 'peer0.org2.academic.edu:8051', '--tlsRootCertFiles', PEER2_CA,
    '--peerAddresses', 'peer0.org3.academic.edu:9051', '--tlsRootCertFiles', PEER3_CA,
    '-c', ctorJson,
    '--waitForEvent'
  ];

  try {
    const { stdout, stderr } = await execFilePromise('docker', cmdArgs);
    const combined = stdout + '\n' + stderr;

    const match = combined.match(/payload:"([^"]+)"/);
    if (match && match[1]) {
      try {
        const decoded = Buffer.from(match[1], 'utf8').toString();
        return JSON.parse(decoded);
      } catch (e) {
        return match[1];
      }
    }

    if (combined.includes('status:200') || combined.includes('SUCCESS') || combined.includes('VALID')) {
      return { status: 200, message: 'Transaction successfully submitted and committed to ledger' };
    }

    return { stdout, stderr };
  } catch (error) {
    console.error(`Error invoking chaincode ${functionName}:`, error.message);
    throw new Error(`Chaincode invocation failed: ${error.message}`);
  }
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

  try {
    const { stdout } = await execFilePromise('docker', cmdArgs);
    const trimmed = stdout.trim();
    if (!trimmed) {
      return null;
    }
    try {
      return JSON.parse(trimmed);
    } catch (e) {
      return trimmed;
    }
  } catch (error) {
    console.error(`Error querying chaincode ${functionName}:`, error.message);
    throw new Error(`Chaincode query failed: ${error.message}`);
  }
}

/**
 * Check Fabric Network Health across all 3 Orgs and Orderer.
 */
async function checkNetworkHealth() {
  try {
    const { stdout } = await execPromise('docker ps --format "{{.Names}}\t{{.Status}}"');
    const lines = stdout.split('\n').filter(Boolean);
    const containers = {};

    lines.forEach(line => {
      const [name, status] = line.split('\t');
      containers[name] = status;
    });

    const expected = [
      'orderer.academic.edu',
      'peer0.org1.academic.edu',
      'peer0.org2.academic.edu',
      'peer0.org3.academic.edu',
      'couchdb0',
      'couchdb1',
      'couchdb2',
      'ipfs-node',
      'cli'
    ];

    const health = {};
    let allUp = true;
    for (const name of expected) {
      const isUp = containers[name] && containers[name].startsWith('Up');
      health[name] = {
        name,
        status: isUp ? 'UP' : 'DOWN',
        detail: containers[name] || 'Not running'
      };
      if (!isUp) allUp = false;
    }

    return {
      allHealthy: allUp,
      containers: health
    };
  } catch (error) {
    return {
      allHealthy: false,
      error: error.message
    };
  }
}

module.exports = {
  invokeChaincode,
  queryChaincode,
  checkNetworkHealth
};
