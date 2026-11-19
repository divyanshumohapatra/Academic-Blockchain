'use strict';

const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);
const http = require('http');

/**
 * Autonomous Health Monitoring Agent (Contributor 6.2)
 * Probes peer gRPC ports, Raft orderer, CouchDBs, IPFS, and checks
 * cross-peer block height synchronization parity with self-healing advice.
 */
class HealthMonitoringAgent {
  constructor() {
    this.agentId = 'AGENT-HEALTH-6.2';
    this.version = '1.0.0';
    this.channelName = process.env.CHANNEL_NAME || 'academicchannel';
  }

  /**
   * Query channel info and block height for a specific organization peer.
   * Uses the Fabric CLI container with org-specific environment variables.
   */
  async getPeerBlockHeight(orgNum) {
    try {
      const cmd = `docker exec cli bash -c ". scripts/envVar.sh && setGlobals ${orgNum} && peer channel getinfo -c ${this.channelName}"`;
      const { stdout, stderr } = await execPromise(cmd, { timeout: 8000 });
      const output = stdout + stderr;

      const match = output.match(/Blockchain info:\s*(\{.*?\})/);
      if (match && match[1]) {
        const info = JSON.parse(match[1]);
        return {
          org: `Org${orgNum}`,
          msp: `Org${orgNum}MSP`,
          peer: `peer0.org${orgNum}.academic.edu`,
          port: orgNum === 1 ? 7051 : (orgNum === 2 ? 8051 : 9051),
          height: parseInt(info.height, 10),
          currentBlockHash: info.currentBlockHash,
          previousBlockHash: info.previousBlockHash,
          status: 'ONLINE'
        };
      }

      return {
        org: `Org${orgNum}`,
        msp: `Org${orgNum}MSP`,
        peer: `peer0.org${orgNum}.academic.edu`,
        port: orgNum === 1 ? 7051 : (orgNum === 2 ? 8051 : 9051),
        height: null,
        status: 'UNAVAILABLE',
        error: 'Unable to parse Blockchain info'
      };
    } catch (err) {
      return {
        org: `Org${orgNum}`,
        msp: `Org${orgNum}MSP`,
        peer: `peer0.org${orgNum}.academic.edu`,
        port: orgNum === 1 ? 7051 : (orgNum === 2 ? 8051 : 9051),
        height: null,
        status: 'ERROR',
        error: err.message
      };
    }
  }

  /**
   * Probe cross-peer block height sync parity across Org 1, Org 2, and Org 3.
   */
  async checkSyncParity() {
    const orgs = [1, 2, 3];
    const peerResults = await Promise.all(orgs.map(org => this.getPeerBlockHeight(org)));

    const validHeights = peerResults
      .filter(p => p.status === 'ONLINE' && p.height !== null)
      .map(p => p.height);

    const allOnline = peerResults.every(p => p.status === 'ONLINE');
    const inSync = allOnline && validHeights.length === 3 &&
      validHeights[0] === validHeights[1] && validHeights[1] === validHeights[2];

    const maxHeight = validHeights.length > 0 ? Math.max(...validHeights) : 0;

    return {
      channel: this.channelName,
      inSync,
      consensusType: 'etcdraft (Raft CFT)',
      maxBlockHeight: maxHeight,
      peers: peerResults.map(p => ({
        ...p,
        parityDrift: p.height !== null ? (maxHeight - p.height) : -1,
        syncStatus: p.height === maxHeight && p.status === 'ONLINE' ? 'SYNCHRONIZED' : 'DESYNCHRONIZED'
      })),
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Inspect container status via Docker engine.
   */
  async checkContainers() {
    try {
      const { stdout } = await execPromise('docker ps --format "{{.Names}}\t{{.Status}}\t{{.Ports}}"');
      const lines = stdout.split('\n').filter(Boolean);
      const containerMap = {};

      lines.forEach(line => {
        const [name, status, ports] = line.split('\t');
        containerMap[name] = { status, ports: ports || '' };
      });

      const targets = [
        { name: 'orderer.academic.edu', role: 'Raft Consensus Orderer', port: 7050 },
        { name: 'peer0.org1.academic.edu', role: 'Org 1 Peer Node', port: 7051 },
        { name: 'peer0.org2.academic.edu', role: 'Org 2 Peer Node', port: 8051 },
        { name: 'peer0.org3.academic.edu', role: 'Org 3 Peer Node', port: 9051 },
        { name: 'couchdb0', role: 'Org 1 State Database', port: 5984 },
        { name: 'couchdb1', role: 'Org 2 State Database', port: 6984 },
        { name: 'couchdb2', role: 'Org 3 State Database', port: 7984 },
        { name: 'ipfs-node', role: 'IPFS Kubo Storage Node', port: 5001 },
        { name: 'cli', role: 'Fabric Operations CLI', port: null }
      ];

      return targets.map(t => {
        const found = containerMap[t.name];
        const isUp = found && found.status.startsWith('Up');
        return {
          name: t.name,
          role: t.role,
          port: t.port,
          status: isUp ? 'HEALTHY' : 'DOWN',
          detail: found ? found.status : 'Container not running'
        };
      });
    } catch (err) {
      return [{ error: err.message }];
    }
  }

  /**
   * Generate intelligent self-healing recommendations.
   */
  generateSelfHealingAdvice(containerReport, parityReport) {
    const recommendations = [];

    // Check containers
    const downContainers = containerReport.filter(c => c.status === 'DOWN');
    if (downContainers.length > 0) {
      downContainers.forEach(c => {
        recommendations.push({
          severity: 'HIGH',
          component: c.name,
          issue: `${c.role} is currently offline (${c.detail}).`,
          action: `Self-Healing Command: docker compose -f docker/docker-compose-net.yaml up -d ${c.name}`
        });
      });
    }

    // Check parity
    if (!parityReport.inSync) {
      const desynced = parityReport.peers.filter(p => p.syncStatus !== 'SYNCHRONIZED');
      if (desynced.length > 0) {
        recommendations.push({
          severity: 'CRITICAL',
          component: 'Ledger Consensus',
          issue: `Block height drift detected! Node(s) [${desynced.map(p => p.peer).join(', ')}] are out of sync with max height ${parityReport.maxBlockHeight}.`,
          action: 'Self-Healing Action: Verify Raft consensus leader at orderer.academic.edu:7050, check peer gossip connectivity, or restart desynced peer.'
        });
      }
    }

    // All clean
    if (recommendations.length === 0) {
      recommendations.push({
        severity: 'OPTIMAL',
        component: 'Consortium Network',
        issue: 'All 3 organizations, Raft orderer, CouchDBs, and IPFS node are healthy with 100% block sync parity.',
        action: 'System is fully operational. Zero maintenance required.'
      });
    }

    return recommendations;
  }

  /**
   * Assemble full real-time telemetry dashboard payload.
   */
  async getTelemetryReport() {
    const startTime = Date.now();
    const [containers, parity] = await Promise.all([
      this.checkContainers(),
      this.checkSyncParity()
    ]);

    const advice = this.generateSelfHealingAdvice(containers, parity);
    const latencyMs = Date.now() - startTime;

    const healthyCount = containers.filter(c => c.status === 'HEALTHY').length;
    const overallHealthy = healthyCount === containers.length && parity.inSync;

    return {
      agent: {
        id: this.agentId,
        version: this.version,
        role: 'Autonomous Health & Parity Sentinel (Contributor 6.2)'
      },
      status: overallHealthy ? 'OPTIMAL' : (healthyCount > 5 ? 'DEGRADED' : 'CRITICAL'),
      summary: {
        healthyContainers: `${healthyCount}/${containers.length}`,
        blockHeight: parity.maxBlockHeight,
        inSync: parity.inSync,
        consensusProtocol: parity.consensusType,
        diagnosticLatencyMs: latencyMs
      },
      syncParity: parity,
      nodes: containers,
      selfHealingAdvice: advice,
      timestamp: new Date().toISOString()
    };
  }
}

module.exports = new HealthMonitoringAgent();
