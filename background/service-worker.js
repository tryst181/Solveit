/**
 * Solveit — Service Worker v5
 * VISION + TEXT + DEBATE CONSENSUS
 * Supports: screenshots, inline images, diagrams, JEE-level questions
 */

// ============================================================
// PROVIDERS — All support VISION (text + images)
// ============================================================
class OpenAICompatProvider {
  constructor(config) {
    this.name = config.name || 'unknown';
    this.displayName = config.displayName || this.name;
    this.apiKey = config.apiKey || '';
    this.model = config.model || '';
    this.baseUrl = (config.baseUrl || 'https://api.openai.com/v1').replace(/\/+$/, '');
    this.enabled = config.enabled !== false;
    this.timeout = config.timeout || 90000;
    this.vision = config.vision !== false;
  }
  isConfigured() { return !!(this.apiKey && this.model && this.enabled); }

  async query(systemPrompt, userContent) {
    // userContent can be string or array of {type:"text"/"image_url"} blocks
    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userContent }
    ];
    const data = await this._fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${this.apiKey}` },
      body: JSON.stringify({ model: this.model, messages, temperature: 0.1 })
    });
    return data.choices?.[0]?.message?.content || '';
  }

  buildVisionContent(textPrompt, images) {
    if (!this.vision || !images || images.length === 0) return textPrompt;
    const parts = [{ type: 'text', text: textPrompt }];
    images.forEach(img => {
      parts.push({ type: 'image_url', image_url: { url: img.dataUrl, detail: 'high' } });
    });
    return parts;
  }

  async testConnection() {
    const s = Date.now();
    try { await this.query('Say ok.', 'ok'); return { success: true, message: 'Connected', latency: Date.now() - s };
    } catch (e) { return { success: false, message: e.message, latency: Date.now() - s }; }
  }

  async _fetch(url, options) {
    const c = new AbortController(); const t = setTimeout(() => c.abort(), this.timeout);
    try {
      const r = await fetch(url, { ...options, signal: c.signal }); clearTimeout(t);
      if (!r.ok) { const b = await r.text().catch(() => ''); throw new Error(`${this.displayName}: ${r.status} — ${b.slice(0, 200)}`); }
      return await r.json();
    } catch (e) { clearTimeout(t); if (e.name === 'AbortError') throw new Error(`${this.displayName}: Timed out`); throw e; }
  }
}

class GeminiProvider {
  constructor(config) {
    this.name = config.name || 'gemini';
    this.displayName = config.displayName || 'Gemini';
    this.apiKey = config.apiKey || '';
    this.model = config.model || 'gemini-2.0-flash';
    this.baseUrl = (config.baseUrl || 'https://generativelanguage.googleapis.com/v1beta').replace(/\/+$/, '');
    this.enabled = config.enabled !== false;
    this.timeout = config.timeout || 90000;
    this.vision = config.vision !== false;
  }
  isConfigured() { return !!(this.apiKey && this.model && this.enabled); }

  async query(systemPrompt, userContent) {
    const url = `${this.baseUrl}/models/${this.model}:generateContent?key=${this.apiKey}`;
    let parts;
    if (typeof userContent === 'string') {
      parts = [{ text: userContent }];
    } else {
      // Array of content blocks — convert to Gemini format
      parts = userContent.map(block => {
        if (block.type === 'text') return { text: block.text };
        if (block.type === 'image_url') {
          const dataUrl = block.image_url?.url || '';
          const match = dataUrl.match(/^data:(image\/\w+);base64,(.+)$/);
          if (match) return { inlineData: { mimeType: match[1], data: match[2] } };
        }
        return { text: '[image not supported]' };
      });
    }

    const data = await this._fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents: [{ role: 'user', parts }],
        generationConfig: { temperature: 0.1, maxOutputTokens: 4096 }
      })
    });
    return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  }

  buildVisionContent(textPrompt, images) {
    if (!this.vision || !images || images.length === 0) return textPrompt;
    const parts = [{ type: 'text', text: textPrompt }];
    images.forEach(img => {
      parts.push({ type: 'image_url', image_url: { url: img.dataUrl } });
    });
    return parts;
  }

  async testConnection() {
    const s = Date.now();
    try { await this.query('Say ok.', 'ok'); return { success: true, message: 'Connected', latency: Date.now() - s };
    } catch (e) { return { success: false, message: e.message, latency: Date.now() - s }; }
  }

  async _fetch(url, options) {
    const c = new AbortController(); const t = setTimeout(() => c.abort(), this.timeout);
    try {
      const r = await fetch(url, { ...options, signal: c.signal }); clearTimeout(t);
      if (!r.ok) { const b = await r.text().catch(() => ''); throw new Error(`${this.displayName}: ${r.status} — ${b.slice(0, 200)}`); }
      return await r.json();
    } catch (e) { clearTimeout(t); if (e.name === 'AbortError') throw new Error(`${this.displayName}: Timed out`); throw e; }
  }
}

class ClaudeProvider {
  constructor(config) {
    this.name = config.name || 'claude';
    this.displayName = config.displayName || 'Claude';
    this.apiKey = config.apiKey || '';
    this.model = config.model || 'claude-sonnet-4-20250514';
    this.baseUrl = (config.baseUrl || 'https://api.anthropic.com').replace(/\/+$/, '');
    this.enabled = config.enabled !== false;
    this.timeout = config.timeout || 90000;
    this.vision = config.vision !== false;
  }
  isConfigured() { return !!(this.apiKey && this.model && this.enabled); }

  async query(systemPrompt, userContent) {
    let content;
    if (typeof userContent === 'string') {
      content = userContent;
    } else {
      // Convert to Claude format
      content = userContent.map(block => {
        if (block.type === 'text') return { type: 'text', text: block.text };
        if (block.type === 'image_url') {
          const dataUrl = block.image_url?.url || '';
          const match = dataUrl.match(/^data:(image\/\w+);base64,(.+)$/);
          if (match) return { type: 'image', source: { type: 'base64', media_type: match[1], data: match[2] } };
        }
        return { type: 'text', text: '[image]' };
      });
    }
    const data = await this._fetch(`${this.baseUrl}/v1/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': this.apiKey, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' },
      body: JSON.stringify({ model: this.model, max_tokens: 4096, system: systemPrompt, messages: [{ role: 'user', content }], temperature: 0.1 })
    });
    return data.content?.[0]?.text || '';
  }

  buildVisionContent(textPrompt, images) {
    if (!this.vision || !images || images.length === 0) return textPrompt;
    const parts = [{ type: 'text', text: textPrompt }];
    images.forEach(img => {
      parts.push({ type: 'image_url', image_url: { url: img.dataUrl } });
    });
    return parts;
  }

  async testConnection() {
    const s = Date.now();
    try { await this.query('Say ok.', 'ok'); return { success: true, message: 'Connected', latency: Date.now() - s };
    } catch (e) { return { success: false, message: e.message, latency: Date.now() - s }; }
  }

  async _fetch(url, options, retries = 1) {
    const c = new AbortController(); const t = setTimeout(() => c.abort(), this.timeout);
    try {
      const r = await fetch(url, { ...options, signal: c.signal }); clearTimeout(t);
      if (!r.ok) { 
        if (r.status === 429 && retries > 0) {
          console.warn(`[Solveit] ${this.displayName} hit rate limit (429). Retrying...`);
          await new Promise(resolve => setTimeout(resolve, 3500));
          return await this._fetch(url, options, retries - 1);
        }
        const b = await r.text().catch(() => ''); 
        throw new Error(`${this.displayName}: ${r.status} — ${b.slice(0, 150)}`); 
      }
      return await r.json();
    } catch (e) { clearTimeout(t); if (e.name === 'AbortError') throw new Error(`${this.displayName}: Timed out`); throw e; }
  }
}


// ============================================================
// JSON PARSER
// ============================================================
function safeJsonParse(str) {
  if (!str) return null;
  try { return JSON.parse(str); } catch {}
  const cb = str.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/);
  if (cb) { try { return JSON.parse(cb[1].trim()); } catch {} }
  const as = str.indexOf('['), ae = str.lastIndexOf(']');
  if (as !== -1 && ae > as) { try { return JSON.parse(str.substring(as, ae + 1)); } catch {} }
  const os = str.indexOf('{'), oe = str.lastIndexOf('}');
  if (os !== -1 && oe > os) { try { return JSON.parse(str.substring(os, oe + 1)); } catch {} }
  return null;
}
function parseAIResponse(raw) {
  const p = safeJsonParse(raw);
  if (Array.isArray(p)) return p;
  if (p?.answers && Array.isArray(p.answers)) return p.answers;
  return [];
}


// ============================================================
// PROMPTS
// ============================================================
const SYSTEM_PROMPT = `You are Solveit, a world-class exam solver with PhD-level expertise in ALL subjects including Physics, Chemistry, Mathematics, Biology, Computer Science, History, English, and more.

You can see BOTH text AND images/diagrams. If images are provided, analyze them carefully — they may contain circuit diagrams, graphs, geometric figures, chemical structures, data tables, or hand-drawn problems.

You will receive questions in one of two formats:
FORMAT 1 — STRUCTURED: Questions labeled "=== QUESTION 1 ===" with options A), B), C), D).
FORMAT 2 — RAW TEXT + IMAGES: Full page content. Identify questions yourself.

YOUR PROCESS:
1. Read ALL instructions (precision, units, decimal places, "round to", etc.)
2. Look at ALL images — they may contain the actual question or crucial data
3. For each question, SOLVE step by step:
   - Calculations: show work mentally, use correct formulas, carry precision
   - MCQ: evaluate each option, eliminate wrong ones
   - Physics/Engineering: use proper formulas (F=ma, V=IR, etc.)
   - Chemistry: balance equations, use periodic table values
4. VERIFY before answering

RESPONSE — JSON array IN ORDER, one per question:
[{"questionText":"first 50 chars","type":"mcq|integer|decimal|text|true-false","answer":"EXACT option text or number","explanation":"reasoning","confidence":95,"options":["A","B","C","D"]}]

RULES:
- MCQ answer = EXACT FULL TEXT of correct option (not letter A/B/C/D)
- Numerical = just the number, follow precision instructions
- Calculations: -48+(-24)=-72. √(144)=12. sin(30°)=0.5.
- JEE-level: use JEE difficulty reasoning. Be precise.
- NEVER skip. NEVER refuse. Answer ALL.
- Output ONLY JSON array. No markdown. No code blocks.`;

const SYSTEM_PROMPT_DEBATE = `You verify quiz answers from multiple AI models.
For each question: review all answers, identify correct one, verify math/facts step by step.
Return verified JSON array: [{"questionText":"...","type":"...","answer":"correct","explanation":"why","confidence":N,"options":[...]}]
Only JSON. No extra text.`;


// ============================================================
// PROVIDER REGISTRY
// ============================================================
const PROVIDER_PRESETS = {
  openai:   { name: 'openai',   displayName: 'ChatGPT (OpenAI)',   baseUrl: 'https://api.openai.com/v1',              model: 'gpt-4o-mini',               type: 'openai-compat', icon: '🟢', vision: true },
  gemini:   { name: 'gemini',   displayName: 'Gemini (Google)',     baseUrl: 'https://generativelanguage.googleapis.com/v1beta', model: 'gemini-2.0-flash', type: 'gemini',        icon: '🔷', vision: true },
  claude:   { name: 'claude',   displayName: 'Claude (Anthropic)', baseUrl: 'https://api.anthropic.com',               model: 'claude-sonnet-4-20250514',         type: 'claude',        icon: '🟠', vision: true },
  deepseek: { name: 'deepseek', displayName: 'DeepSeek',           baseUrl: 'https://api.deepseek.com/v1',             model: 'deepseek-chat',             type: 'openai-compat', icon: '🔵', vision: false },
  grok:     { name: 'grok',     displayName: 'Grok (xAI)',         icon: '⚡', baseUrl: 'https://api.x.ai/v1',                              model: 'grok-3-mini',              type: 'openai-compat', vision: true },
  groq:     { name: 'groq',     displayName: 'Groq',               icon: '🟤', baseUrl: 'https://api.groq.com/openai/v1',                   model: 'llama-3.3-70b-versatile',  type: 'openai-compat', vision: false },
  glm:      { name: 'glm',      displayName: 'GLM (ZhipuAI)',      icon: '🟣', baseUrl: 'https://open.bigmodel.cn/api/paas/v4',             model: 'glm-4-flash',              type: 'openai-compat', vision: false },
  openrouter: { name: 'openrouter', displayName: 'OpenRouter (Free)',  icon: '🌌', baseUrl: 'https://openrouter.ai/api/v1',                     model: 'google/gemini-2.0-flash:free', type: 'openai-compat', vision: true }
};

function createProvider(config) {
  switch (config.type || 'openai-compat') {
    case 'gemini': return new GeminiProvider(config);
    case 'claude': return new ClaudeProvider(config);
    default: return new OpenAICompatProvider(config);
  }
}

async function loadProviders() {
  const data = await chrome.storage.local.get('providers');
  const configs = data.providers || {};
  const providers = [];
  for (const [key, preset] of Object.entries(PROVIDER_PRESETS)) {
    const merged = { ...preset, ...(configs[key] || {}), name: key };
    if (merged.apiKey && merged.enabled !== false) providers.push(createProvider(merged));
  }
  (configs._custom || []).forEach((c, i) => {
    if (c.apiKey && c.enabled !== false) providers.push(createProvider({ ...c, name: `custom-${i}` }));
  });
  return providers;
}


// ============================================================
// SCREENSHOT CAPTURE
// ============================================================
async function captureScreenshot() {
  try {
    const dataUrl = await chrome.tabs.captureVisibleTab(null, { format: 'jpeg', quality: 85 });
    return dataUrl;
  } catch (err) {
    console.warn('[Solveit] Screenshot failed:', err.message);
    return null;
  }
}


// ============================================================
// MAIN: Process page (text + images)
// ============================================================
async function processPage(pageText, pageUrl, pageTitle, pageImages) {
  const providers = await loadProviders();
  if (providers.length === 0) throw new Error('No AI providers configured. Go to Settings to add API keys.');
  providers.forEach(p => p.timeout = 90000);

  const memData = await chrome.storage.local.get('memoryContext');
  let memoryContextStr = '';
  if (memData.memoryContext) {
    if (typeof memData.memoryContext === 'object') {
      const m = memData.memoryContext;
      const arr = [];
      if (m.name) arr.push(`Full Name: ${m.name}`);
      if (m.email) arr.push(`Email: ${m.email}`);
      if (m.phone) arr.push(`Phone: ${m.phone}`);
      if (m.id) arr.push(`ID/Org Number: ${m.id}`);
      if (m.org) arr.push(`Organization: ${m.org}`);
      if (m.notes) arr.push(`Additional Notes: ${m.notes}`);
      memoryContextStr = arr.join('\\n');
    } else {
      memoryContextStr = String(memData.memoryContext).trim();
    }
  }

  let localSystemPrompt = SYSTEM_PROMPT;
  if (memoryContextStr) {
    localSystemPrompt += `\n\nMEMORY RESERVOIR:\nYou have access to the user's personal details. If the page asks for personal/academic info, confidently auto-fill it from these details instead of treating it as a quiz.\nUserDetails:\n${memoryContextStr}`;
  }

  console.log(`[Solveit] "${pageTitle}" | ${pageText.length} chars | ${(pageImages || []).length} images | ${providers.length} providers`);
  broadcastProgress('solving', 0, 1, 'Capturing screenshot...');

  // Capture screenshot of visible area
  const screenshot = await captureScreenshot();
  const allImages = [...(pageImages || [])];
  if (screenshot) allImages.unshift({ dataUrl: screenshot, desc: 'Full page screenshot' });
  console.log(`[Solveit] Total images for AI: ${allImages.length}`);

  // Build the user prompt
  const textPrompt = `PAGE: ${pageTitle}\nURL: ${pageUrl}\n\n${pageText}\n\nAnswer ALL questions above. If there are images/diagrams, analyze them to answer image-based questions.`;

  broadcastProgress('solving', 0, 1, 'AI solving...');

  // Query providers using a Waterfall Strategy to minimize token utilization
  let finalAnswers = null;
  const uniqueErrors = [];

  for (let i = 0; i < providers.length; i++) {
    const provider = providers[i];
    broadcastProgress('solving', i + 1, providers.length, `AI solving with ${provider.displayName}...`);
    console.log(`[Solveit Waterfall] Attempting ${provider.displayName}...`);
    
    try {
      const content = provider.buildVisionContent(textPrompt, allImages.slice(0, 5));
      const raw = await provider.query(localSystemPrompt, content);
      const answers = parseAIResponse(raw);
      
      if (answers && answers.length > 0) {
        console.log(`[Solveit Waterfall] SUCCESS with ${provider.displayName}: ${answers.length} answers`);
        finalAnswers = answers;
        break; // Waterfall success! We stop here to save API limits.
      } else {
        uniqueErrors.push(`${provider.displayName}: Returned empty answer set.`);
      }
    } catch (err) {
      console.warn(`[Solveit Waterfall] ${provider.displayName} FAILED:`, err.message);
      uniqueErrors.push(`${provider.displayName}: ${err.message}`);
      // Wait briefly before falling back to next provider if it was rate limited
      if (err.message.includes('429')) await new Promise(r => setTimeout(r, 2000));
    }
  }

  if (!finalAnswers) {
    throw new Error(uniqueErrors.join(' | ') || 'All AI models failed. Check API keys and Rate Limits.');
  }

  broadcastProgress('done', 1, 1, 'Done');
  return normalize(finalAnswers);
}

function findDisagreements(results) {
  const base = results[0].answers;
  const disag = [];
  base.forEach((q, i) => {
    const a = (q.answer || '').trim().toLowerCase();
    for (let j = 1; j < results.length; j++) {
      if (!results[j].answers[i] || (results[j].answers[i].answer || '').trim().toLowerCase() !== a) {
        disag.push(i); break;
      }
    }
  });
  return disag;
}

function buildDebatePrompt(results) {
  let p = 'Multiple AI models answered. Verify each:\n\n';
  results[0].answers.forEach((q, i) => {
    p += `Q${i + 1}: ${q.questionText || 'Unknown'}\n`;
    if (q.options?.length) p += `Options: ${q.options.join(' | ')}\n`;
    results.forEach(r => {
      const a = r.answers[i];
      p += `  ${r.provider}: "${a?.answer || '?'}" (${a?.confidence || '?'}%) — ${a?.explanation || ''}\n`;
    });
    p += '\n';
  });
  return p;
}

function buildConsensus(results) {
  return results[0].answers.map((q, i) => {
    const all = results.map(r => r.answers[i]).filter(Boolean);
    if (all.length <= 1) return norm(q);
    const votes = {};
    all.forEach(a => {
      const k = (a.answer || '').trim().toLowerCase();
      if (!votes[k]) votes[k] = { answer: a.answer, count: 0, conf: 0, explanation: a.explanation };
      votes[k].count++; votes[k].conf += (a.confidence || 70);
    });
    const w = Object.values(votes).sort((a, b) => b.count - a.count || b.conf - a.conf)[0];
    const r = w.count / all.length;
    return { ...norm(q), answer: w.answer, explanation: w.explanation, confidence: r >= 1 ? 98 : r >= 0.5 ? 88 : 65 };
  });
}

function normalize(answers) { return answers.map(norm); }
function norm(a) {
  return {
    questionText: a.questionText || a.question || '',
    type: a.type || 'text',
    answer: String(a.answer ?? ''),
    explanation: a.explanation || '',
    confidence: typeof a.confidence === 'number' ? a.confidence : 75,
    options: a.options || []
  };
}


// ============================================================
// MESSAGE HANDLERS
// ============================================================
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.action) {
    case 'processPage':
      processPage(message.pageText, message.pageUrl, message.pageTitle, message.images)
        .then(answers => {
          if (sender.tab && sender.tab.id) {
            chrome.storage.local.set({ [`lastSolved_${sender.tab.id}`]: answers });
          }
          sendResponse({ success: true, answers });
        })
        .catch(err => { console.error('[Solveit]', err); sendResponse({ success: false, error: err.message }); });
      return true;

    case 'parseVoice':
      loadProviders().then(async providers => {
        if (providers.length === 0) return sendResponse({ success: false, error: 'No providers loaded' });
        const p = providers[0];
        try {
          const prompt = `Convert the following dictated transcript into a strict JSON object with exact keys: "name", "email", "phone", "id", "org", "notes". If a field isn't mentioned, leave it empty string. Transcript: "${message.text}"`;
          const res = await p.query(prompt, "JSON output:");
          const json = safeJsonParse(res) || safeJsonParse(res.answers?.[0]?.answer || '');
          sendResponse({ success: true, data: json });
        } catch (e) {
          sendResponse({ success: false, error: e.message });
        }
      });
      return true;

    case 'testProvider':
      createProvider(message.providerConfig).testConnection().then(r => sendResponse(r)).catch(e => sendResponse({ success: false, message: e.message }));
      return true;

    case 'getProviderStatus':
      getProviderStatuses().then(s => sendResponse({ success: true, statuses: s })).catch(e => sendResponse({ success: false, error: e.message }));
      return true;

    case 'triggerSolve':
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]) chrome.tabs.sendMessage(tabs[0].id, { action: 'solve' }, r => sendResponse(r));
        else sendResponse({ success: false, error: 'No active tab' });
      });
      return true;

    case 'progress':
      broadcastProgress(message.phase, message.current, message.total, message.detail);
      return false;
  }
});

chrome.commands.onCommand.addListener((cmd) => {
  if (cmd === 'solve-page') {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) chrome.tabs.sendMessage(tabs[0].id, { action: 'solve' }, () => { if (chrome.runtime.lastError) {} });
    });
  }
});

async function getProviderStatuses() {
  const data = await chrome.storage.local.get('providers');
  const configs = data.providers || {};
  const statuses = {};
  for (const [key, preset] of Object.entries(PROVIDER_PRESETS)) {
    const uc = configs[key] || {};
    statuses[key] = { ...preset, configured: !!uc.apiKey, enabled: uc.enabled !== false, apiKey: uc.apiKey ? '••••' + uc.apiKey.slice(-4) : '' };
  }
  return statuses;
}

function broadcastProgress(phase, current, total, detail) {
  chrome.runtime.sendMessage({ action: 'progressUpdate', phase, current: current || 0, total: total || 0, detail: detail || '' }).catch(() => {});
}

console.log('[Solveit] SW v5 — vision + debate engine.');
