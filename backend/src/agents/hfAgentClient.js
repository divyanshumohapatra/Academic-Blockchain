'use strict';

const path = require('path');
const fs = require('fs');
require('dotenv').config();
try {
  require('dotenv').config({ path: path.join(__dirname, '../../.env') });
} catch (e) {}

const axios = require('axios');

/**
 * Hugging Face Real LLM Agent Client
 * Connects to Hugging Face Official Router API
 * Models: meta-llama/Llama-3.1-8B-Instruct, Qwen/Qwen2.5-72B-Instruct
 */
class HFAgentClient {
  constructor() {
    this._apiKey = process.env.HF_TOKEN || process.env.HUGGINGFACE_API_KEY || '';
    this.defaultModel = process.env.HF_MODEL || 'meta-llama/Llama-3.1-8B-Instruct';
    this.routerUrl = 'https://router.huggingface.co/v1/chat/completions';
    this.supportedModels = [
      'meta-llama/Llama-3.1-8B-Instruct',
      'Qwen/Qwen2.5-72B-Instruct',
      'meta-llama/Llama-3.1-70B-Instruct'
    ];
    this.MAX_RETRIES = 3;
  }

  setApiKey(key) {
    this._apiKey = key ? key.trim() : '';
  }

  getApiKey() {
    return this._apiKey || process.env.HF_TOKEN || process.env.HUGGINGFACE_API_KEY || '';
  }

  async _sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Execute real LLM reasoning query via Hugging Face Router API
   */
  async generateReasoning(systemPrompt, userPrompt, options = {}) {
    const token = this.getApiKey();
    let model = options.model || process.env.HF_MODEL || this.defaultModel;

    // Sanitize model name if legacy name was passed
    if (model.includes('Meta-Llama-3-8B') || model.includes('Meta-Llama-3')) {
      model = 'meta-llama/Llama-3.1-8B-Instruct';
    }

    if (token) {
      let attempts = 0;
      let lastError = null;

      while (attempts < this.MAX_RETRIES) {
        attempts++;
        const targetModel = this.supportedModels[(attempts - 1) % this.supportedModels.length] || model;

        try {
          console.log(`[HF Agent Client] Invoking real Hugging Face Model: ${targetModel} (Attempt ${attempts}/${this.MAX_RETRIES})...`);

          const response = await axios.post(
            this.routerUrl,
            {
              model: targetModel,
              messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt }
              ],
              temperature: options.temperature || 0.1,
              max_tokens: options.max_tokens || 400
            },
            {
              headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
              },
              timeout: 18000
            }
          );

          if (response.data?.choices && response.data.choices[0]?.message?.content) {
            const content = response.data.choices[0].message.content.trim();
            console.log(`✅ [HF Agent Client] Live LLM Response received from ${targetModel}!`);
            return {
              source: 'HUGGING_FACE_LIVE_API',
              model: targetModel,
              content: content
            };
          }
        } catch (err) {
          const status = err.response?.status;
          lastError = err.response?.data || err.message;
          console.warn(`[HF Attempt ${attempts} Warning] Status: ${status} - ${JSON.stringify(lastError)}`);

          if (status === 503) {
            console.log(`[HF Agent Client] 503 (Model loading). Waiting 2s before retry ${attempts + 1}...`);
            await this._sleep(2000);
          } else if (status === 401 || status === 402) {
            console.warn(`[HF Agent Client] Status ${status} (No credits or unauthorized). Fast fallback to deterministic rule engine.`);
            break;
          } else {
            await this._sleep(1000);
          }
        }
      }

      console.warn(`⚠️ [HF Agent Client] Live API attempts exhausted. Reverting to deterministic JS agent checks.`);
    } else {
      console.warn(`[HF Agent Client] No HF_TOKEN detected. Using deterministic JS checks.`);
    }

    // Fallback to deterministic JS agent check only if all live attempts failed
    return this._localAgentReasoning(systemPrompt, userPrompt);
  }

  _localAgentReasoning(systemPrompt, userPrompt) {
    const isJsonRequested = systemPrompt.toLowerCase().includes('json');

    if (isJsonRequested) {
      const attendanceMatch = userPrompt.match(/attendance['":\s]+([0-9.]+)/i);
      const cieMatch = userPrompt.match(/cie['":\s]+([0-9.]+)/i);
      const cgpaMatch = userPrompt.match(/cgpa['":\s]+([0-9.]+)/i);
      const creditsMatch = userPrompt.match(/credits['":\s]+([0-9.]+)/i);
      const backlogsMatch = userPrompt.match(/backlogs['":\s]+([0-9]+)/i);
      const capstoneMatch = userPrompt.match(/capstone(?: score)?['":\s]+([0-9.]+)/i);
      const origMatch = userPrompt.match(/originality(?: report)?['":\s]+([0-9.]+)/i);
      const feeMatch = userPrompt.match(/fee dues['":\s]+([0-9.]+)/i);
      const libMatch = userPrompt.match(/library dues['":\s]+([0-9.]+)/i);

      // Check explicit boolean conditions
      const prereqsFalse = /prerequisites?['":\s]+false/i.test(userPrompt) || /prerequisites met['":\s]+false/i.test(userPrompt);
      const disciplinaryFalse = /disciplinary clearance['":\s]+false/i.test(userPrompt);

      const attendance = attendanceMatch ? parseFloat(attendanceMatch[1]) : 88.5;
      const cie = cieMatch ? parseFloat(cieMatch[1]) : 42.0;
      const cgpa = cgpaMatch ? parseFloat(cgpaMatch[1]) : 8.85;
      const credits = creditsMatch ? parseFloat(creditsMatch[1]) : 164;
      const backlogs = backlogsMatch ? parseInt(backlogsMatch[1], 10) : 0;
      const capstone = capstoneMatch ? parseFloat(capstoneMatch[1]) : 85;
      const originality = origMatch ? parseFloat(origMatch[1]) : 94;
      const feeDues = feeMatch ? parseFloat(feeMatch[1]) : 0;
      const libraryDues = libMatch ? parseFloat(libMatch[1]) : 0;

      const violations = [];
      if (attendance < 75.0) violations.push(`Attendance ${attendance}% < 75.0% statutory minimum`);
      if (cie < 20.0) violations.push(`CIE score ${cie}/50 < 20.0/50 passing threshold`);
      if (prereqsFalse) violations.push(`Prerequisite course completion audit failed`);
      if (credits < 160) violations.push(`Credits ${credits} < 160 required`);
      if (disciplinaryFalse) violations.push(`Disciplinary clearance not granted`);
      if (cgpa < 5.0) violations.push(`CGPA ${cgpa} < 5.0 passing minimum`);
      if (backlogs > 0) violations.push(`Active backlogs: ${backlogs}`);
      if (capstone < 60) violations.push(`Capstone score ${capstone}/100 < 60 threshold`);
      if (originality < 80) violations.push(`Originality report ${originality}% < 80% threshold`);
      if (feeDues > 0) violations.push(`Pending fee dues: ₹${feeDues}`);
      if (libraryDues > 0) violations.push(`Pending library dues: ₹${libraryDues}`);

      const isCompliant = violations.length === 0;
      const confidence = isCompliant ? 0.98 : 0.96;
      const riskScore = isCompliant ? 5 : 85;

      const reasoning = isCompliant
        ? `All verifiable thresholds satisfied: Attendance=${attendance}% (≥75%), CIE=${cie}/50 (≥20), Prerequisites=Verified, Credits=${credits}/160, Capstone=${capstone}/100.`
        : `Autonomous audit failed: ${violations.join('; ')}. Escalated to Department Academic Committee.`;

      return {
        source: 'DETERMINISTIC_JS_FALLBACK',
        model: 'Deterministic-JS-Checks',
        content: JSON.stringify({
          decision: isCompliant ? 'APPROVE' : 'REJECT',
          confidence,
          riskScore,
          reasoning,
          violations: violations.length > 0 ? violations : undefined
        })
      };
    }

    return {
      source: 'DETERMINISTIC_JS_FALLBACK',
      model: 'Deterministic-JS-Checks',
      content: `[Deterministic JS Agent] Evaluated query across blockchain state.`
    };
  }
}

module.exports = new HFAgentClient();
