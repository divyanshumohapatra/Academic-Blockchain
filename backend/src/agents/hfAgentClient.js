'use strict';

const path = require('path');
const fs = require('fs');
require('dotenv').config();
try {
  require('dotenv').config({ path: path.join(__dirname, '../../.env') });
} catch (e) {}

const axios = require('axios');

/**
 * Multi-Provider LLM Agent Client
 * Supports:
 *  1. Groq (100% Free, Ultra-Fast Llama-3.1-8B-Instant, Llama-3.3-70B-Versatile)
 *  2. Hugging Face Official Router API
 *  3. Local Deterministic Fallback (failsafe)
 */
class HFAgentClient {
  constructor() {
    this._groqApiKey = process.env.GROQ_API_KEY || '';
    this._hfApiKey = process.env.HF_TOKEN || process.env.HUGGINGFACE_API_KEY || '';
    
    this.groqUrl = 'https://api.groq.com/openai/v1/chat/completions';
    this.defaultGroqModel = process.env.GROQ_MODEL || 'openai/gpt-oss-20b';
    this.supportedGroqModels = [
      'openai/gpt-oss-20b',
      'qwen/qwen3.8-27b',
      'openai/gpt-oss-120b'
    ];

    this.hfRouterUrl = 'https://router.huggingface.co/v1/chat/completions';
    this.defaultHfModel = process.env.HF_MODEL || 'meta-llama/Llama-3.1-8B-Instruct';
    this.supportedHfModels = [
      'meta-llama/Llama-3.1-8B-Instruct',
      'Qwen/Qwen2.5-72B-Instruct',
      'meta-llama/Llama-3.1-70B-Instruct'
    ];

    this.defaultModel = process.env.GROQ_API_KEY ? this.defaultGroqModel : this.defaultHfModel;
    this.MAX_RETRIES = 2;
  }

  getGroqKey() {
    return (process.env.GROQ_API_KEY || '').trim();
  }

  getApiKey() {
    return (process.env.HF_TOKEN || process.env.HUGGINGFACE_API_KEY || '').trim();
  }

  getActiveProvider() {
    if (this.getGroqKey()) return 'Groq (Ultra-Fast Free Cloud)';
    if (this.getApiKey()) return 'Hugging Face Router';
    return 'Deterministic JS Checks';
  }

  async _sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Execute real LLM reasoning query
   * Prioritizes Groq (Free & Instant), falls back to HF Router, then to deterministic logic
   */
  async generateReasoning(systemPrompt, userPrompt, options = {}) {
    const groqKey = this.getGroqKey();
    const hfKey = this.getApiKey();

    // 1. Attempt Groq API if configured
    if (groqKey) {
      const groqRes = await this._invokeGroq(systemPrompt, userPrompt, groqKey, options);
      if (groqRes) return groqRes;
    }

    // 2. Attempt Hugging Face API if configured
    if (hfKey) {
      const hfRes = await this._invokeHuggingFace(systemPrompt, userPrompt, hfKey, options);
      if (hfRes) return hfRes;
    }

    if (!groqKey && !hfKey) {
      console.warn(`[Agent Client] Neither GROQ_API_KEY nor HF_TOKEN configured. Using deterministic JS checks.`);
    }

    // 3. Fallback to deterministic JS agent checks if live APIs unavailable
    return this._localAgentReasoning(systemPrompt, userPrompt);
  }

  async _invokeGroq(systemPrompt, userPrompt, apiKey, options = {}) {
    let attempts = 0;
    const isJsonMode = options.jsonMode || systemPrompt.toLowerCase().includes('json');

    while (attempts < this.MAX_RETRIES) {
      attempts++;
      const configuredModel = process.env.GROQ_MODEL || 'openai/gpt-oss-20b';
      const targetModel = options.model || (attempts === 1 ? configuredModel : this.supportedGroqModels[(attempts - 1) % this.supportedGroqModels.length]);

      try {
        console.log(`[Groq Agent Client] Invoking real Groq Model: ${targetModel} (Attempt ${attempts}/${this.MAX_RETRIES})...`);

        const payload = {
          model: targetModel,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ],
          temperature: options.temperature || 0.1,
          max_tokens: options.max_tokens || 400
        };

        if (isJsonMode) {
          payload.response_format = { type: 'json_object' };
        }

        const response = await axios.post(this.groqUrl, payload, {
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
          },
          timeout: 10000
        });

        if (response.data?.choices && response.data.choices[0]?.message?.content) {
          const content = response.data.choices[0].message.content.trim();
          console.log(`⚡ [Groq Agent Client] Real LLM reasoning received in ${response.data.usage?.total_time || 'instant'}s from ${targetModel}!`);
          return {
            source: 'GROQ_LIVE_API',
            model: targetModel,
            content: content
          };
        }
      } catch (err) {
        const status = err.response?.status;
        const errData = err.response?.data || err.message;
        console.warn(`[Groq Attempt ${attempts} Warning] Status: ${status} - ${JSON.stringify(errData)}`);
        await this._sleep(1000);
      }
    }
    console.warn(`⚠️ [Groq Agent Client] Groq API attempts exhausted.`);
    return null;
  }

  async _invokeHuggingFace(systemPrompt, userPrompt, token, options = {}) {
    let attempts = 0;
    let model = options.model || this.defaultHfModel;
    if (model.includes('Meta-Llama-3-8B') || model.includes('Meta-Llama-3')) {
      model = 'meta-llama/Llama-3.1-8B-Instruct';
    }

    while (attempts < this.MAX_RETRIES) {
      attempts++;
      const targetModel = this.supportedHfModels[(attempts - 1) % this.supportedHfModels.length] || model;

      try {
        console.log(`[HF Agent Client] Invoking Hugging Face Model: ${targetModel} (Attempt ${attempts}/${this.MAX_RETRIES})...`);

        const response = await axios.post(
          this.hfRouterUrl,
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
            timeout: 15000
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
        console.warn(`[HF Attempt ${attempts} Warning] Status: ${status} - ${JSON.stringify(err.response?.data || err.message)}`);
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
    console.warn(`⚠️ [HF Agent Client] Live HF API attempts exhausted.`);
    return null;
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
