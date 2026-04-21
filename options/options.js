/**
 * Solveit — Options Page Script
 * Manages AI provider API keys, settings, and connection testing.
 */

document.addEventListener('DOMContentLoaded', () => {

  const svgs = {
    openai: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M22.28 9.82a8.82 8.82 0 00-.63-6.52c-.52-1.04-1.35-1.85-2.4-2.33a8.81 8.81 0 00-7.39.22 8.82 8.82 0 00-4.66-2.14 8.82 8.82 0 00-6.9 2.5 8.81 8.81 0 00-2.34 2.4 8.82 8.82 0 00-.22 7.39 8.82 8.82 0 002.14 4.66 8.81 8.81 0 00-2.5 6.9 8.81 8.81 0 002.39 2.41 8.81 8.81 0 007.4-.23 8.82 8.82 0 004.66 2.14 8.81 8.81 0 006.89-2.5 8.81 8.81 0 002.34-2.4 8.82 8.82 0 00.22-7.39zm-13.78 9.7a6.34 6.34 0 01-3.64-1 1.76 1.76 0 001.3-.87L9.9 11v6.95c0 .28-.15.54-.4.68-.24.15-.54.16-.8.02z"/></svg>',
    gemini: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.25c.677 4.918 4.407 8.648 9.325 9.325-4.918.677-8.648 4.407-9.325 9.325-.677-4.918-4.407-8.648-9.325-9.325 4.918-.677 8.648-4.407 9.325-9.325z"/></svg>',
    claude: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zM9 16.5a4.5 4.5 0 010-9v2a2.5 2.5 0 000 5v2zm6 0v-2a2.5 2.5 0 000-5v-2a4.5 4.5 0 010 9z"/></svg>',
    deepseek: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm0 18a8 8 0 0 1-5.66-2.34l1.42-1.42a6 6 0 1 0 0-8.48L6.34 6.34A8 8 0 0 1 12 4z"/></svg>',
    grok: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M18.2 3.5h3.2L14 11.8l8 10.7h-6.2l-4.9-6.4-5.6 6.4h-3.2l7.7-8.8L2 3.5h6.4l4.4 5.8 5.4-5.8zm-1.1 16.9h1.8L7.3 5.3H5.4l11.7 15.1z"/></svg>',
    groq: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M21 16v-2h-3v-3h-3v-2H9v-2H6V4H3v16h18v-4h-3zM9 9h6v3h3v3H9V9z"/></svg>',
    glm: '<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 6v12m-6-6h12" stroke="currentColor" stroke-width="2"/></svg>',
    openrouter: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2L2 12l10 10 10-10L12 2zm0 14a4 4 0 110-8 4 4 0 010 8z"/></svg>'
  };

  const PRESETS = [
    { key: 'openai',   displayName: 'ChatGPT (OpenAI)',   icon: svgs.openai, baseUrl: 'https://api.openai.com/v1',                        model: 'gpt-4o-mini',              type: 'openai-compat' },
    { key: 'gemini',   displayName: 'Gemini (Google)',     icon: svgs.gemini, baseUrl: 'https://generativelanguage.googleapis.com/v1beta',  model: 'gemini-2.0-flash',         type: 'gemini' },
    { key: 'claude',   displayName: 'Claude (Anthropic)',  icon: svgs.claude, baseUrl: 'https://api.anthropic.com',                        model: 'claude-sonnet-4-20250514', type: 'claude' },
    { key: 'deepseek', displayName: 'DeepSeek',            icon: svgs.deepseek, baseUrl: 'https://api.deepseek.com/v1',                      model: 'deepseek-chat',            type: 'openai-compat' },
    { key: 'grok',     displayName: 'Grok (xAI)',          icon: svgs.grok, baseUrl: 'https://api.x.ai/v1',                              model: 'grok-3-mini',              type: 'openai-compat' },
    { key: 'groq',     displayName: 'Groq',                icon: svgs.groq, baseUrl: 'https://api.groq.com/openai/v1',                   model: 'llama-3.3-70b-versatile',  type: 'openai-compat' },
    { key: 'glm',      displayName: 'GLM (ZhipuAI)',       icon: svgs.glm, baseUrl: 'https://open.bigmodel.cn/api/paas/v4',             model: 'glm-4-flash',              type: 'openai-compat' },
    { key: 'openrouter', displayName: 'OpenRouter (Free)', icon: svgs.openrouter, baseUrl: 'https://openrouter.ai/api/v1',                     model: 'mistralai/mistral-7b-instruct:free', type: 'openai-compat' }
  ];

  const providersGrid = document.getElementById('providersGrid');
  const addCustomBtn = document.getElementById('addCustomBtn');
  const saveAllBtn = document.getElementById('saveAllBtn');
  const toast = document.getElementById('toast');

  let customProviders = [];

  // ===== Load saved data =====
  loadAll();

  // ===== Event Listeners =====
  saveAllBtn.addEventListener('click', saveAll);
  addCustomBtn.addEventListener('click', addCustomProvider);
  
  const micBtn = document.getElementById('micBtn');
  if (micBtn) {
    micBtn.addEventListener('click', async () => {
      micBtn.classList.add('mic-active');
      micBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5-3c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/></svg> Requesting Mic...';

      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach(t => t.stop()); // Stop stream immediately; recognition handles its own.
      } catch (err) {
        micBtn.classList.remove('mic-active');
        micBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5-3c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/></svg> Dictate with AI';
        showToast('Microphone permission denied! Please allow access in Chrome settings.', 'error');
        return;
      }

      const recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
      recognition.continuous = false;
      recognition.interimResults = false;

      micBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5-3c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/></svg> Listening...';
      showToast('Recording... Speak your details now.', 'success');

      recognition.onresult = async (event) => {
        micBtn.classList.remove('mic-active');
        micBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5-3c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/></svg> Processing Voice...';
        
        const transcript = event.results[0][0].transcript;
        try {
          const result = await chrome.runtime.sendMessage({ action: 'parseVoice', text: transcript });
          if (result && result.success && result.data) {
            const d = result.data;
            if (d.name) document.getElementById('memName').value = d.name;
            if (d.email) document.getElementById('memEmail').value = d.email;
            if (d.phone) document.getElementById('memPhone').value = d.phone;
            if (d.id) document.getElementById('memId').value = d.id;
            if (d.org) document.getElementById('memOrg').value = d.org;
            if (d.notes) document.getElementById('memNotes').value = d.notes;
            showToast('Voice data mapped successfully! Make sure to Save.', 'success');
          } else {
            showToast('Voice parsing failed. Do you have an active API key?', 'error');
          }
        } catch (e) {
          showToast(`Error: ${e.message}`, 'error');
        }
        micBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5-3c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/></svg> Dictate with AI';
      };

      recognition.onerror = (e) => {
        micBtn.classList.remove('mic-active');
        micBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5-3c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/></svg> Dictate with AI';
        showToast(`Mic error: ${e.error}`, 'error');
      };

      recognition.start();
    });
  }

  // ===== Functions =====

  async function loadAll() {
    const data = await chrome.storage.local.get(['providers', 'settings', 'memoryContext']);
    const providers = data.providers || {};
    const settings = data.settings || {};

    // Render preset provider cards
    providersGrid.innerHTML = '';
    PRESETS.forEach(preset => {
      const saved = providers[preset.key] || {};
      renderProviderCard(preset, saved);
    });

    // Render custom providers
    customProviders = providers._custom || [];
    customProviders.forEach((cp, idx) => {
      renderCustomProviderCard(cp, idx);
    });

    // Load settings
    if (settings.timeout) document.getElementById('timeoutSetting').value = settings.timeout / 1000;
    if (settings.minModels) document.getElementById('minModelsSetting').value = settings.minModels;
    if (settings.confidenceThreshold !== undefined) document.getElementById('confidenceSetting').value = settings.confidenceThreshold;
    // Load bifurcated memory fields
    const mem = data.memoryContext || {};
    const isString = typeof mem === 'string';
    document.getElementById('memName').value = isString ? '' : (mem.name || '');
    document.getElementById('memEmail').value = isString ? '' : (mem.email || '');
    document.getElementById('memPhone').value = isString ? '' : (mem.phone || '');
    document.getElementById('memId').value = isString ? '' : (mem.id || '');
    document.getElementById('memOrg').value = isString ? '' : (mem.org || '');
    document.getElementById('memNotes').value = isString ? mem : (mem.notes || '');
  }

  function renderProviderCard(preset, saved) {
    const card = document.createElement('div');
    card.className = `provider-card${saved.apiKey ? ' configured' : ''}`;
    card.dataset.key = preset.key;

    const isEnabled = saved.enabled !== false;

    card.innerHTML = `
      <div class="card-header">
        <div class="card-title-group">
          <div class="card-icon">${preset.icon}</div>
          <span class="card-name">${preset.displayName}</span>
        </div>
        <span class="card-status ${saved.apiKey ? 'active' : 'inactive'}">${saved.apiKey ? '● Connected' : '○ Not Set'}</span>
      </div>

      <div class="card-fields">
        <div class="field-group">
          <label class="field-label">API Key</label>
          <div class="field-input-wrap">
            <input type="password" class="field-input api-key-input" placeholder="Enter your API key..."
                   value="${saved.apiKey || ''}" data-key="${preset.key}" autocomplete="off">
            <button class="eye-toggle" title="Show/Hide">👁</button>
          </div>
        </div>

        <div class="field-row">
          <div class="field-group">
            <label class="field-label">Model</label>
            <input type="text" class="field-input model-input" placeholder="${preset.model}"
                   value="${saved.model || preset.model}" data-key="${preset.key}">
          </div>
          <div class="field-group">
            <label class="field-label">Base URL</label>
            <input type="text" class="field-input url-input" placeholder="${preset.baseUrl}"
                   value="${saved.baseUrl || preset.baseUrl}" data-key="${preset.key}">
          </div>
        </div>
      </div>

      <div class="card-actions">
        <div class="toggle-group">
          <label class="toggle">
            <input type="checkbox" class="enabled-toggle" data-key="${preset.key}" ${isEnabled ? 'checked' : ''}>
            <span class="toggle-slider"></span>
          </label>
          <span class="toggle-label">${isEnabled ? 'Enabled' : 'Disabled'}</span>
        </div>
        <button class="btn btn-sm btn-test test-btn" data-key="${preset.key}">Test Connection</button>
      </div>
      <div class="test-result" data-key="${preset.key}"></div>
    `;

    // Eye toggle
    const eyeBtn = card.querySelector('.eye-toggle');
    const apiInput = card.querySelector('.api-key-input');
    eyeBtn.addEventListener('click', () => {
      apiInput.type = apiInput.type === 'password' ? 'text' : 'password';
      eyeBtn.textContent = apiInput.type === 'password' ? '👁' : '🔒';
    });

    // Toggle label update
    const toggle = card.querySelector('.enabled-toggle');
    const toggleLabel = card.querySelector('.toggle-label');
    toggle.addEventListener('change', () => {
      toggleLabel.textContent = toggle.checked ? 'Enabled' : 'Disabled';
    });

    // Test connection
    const testBtn = card.querySelector('.test-btn');
    testBtn.addEventListener('click', () => testConnection(preset, card));

    providersGrid.appendChild(card);
  }

  function renderCustomProviderCard(cp, index) {
    const card = document.createElement('div');
    card.className = 'provider-card custom-card';
    card.dataset.customIndex = index;

    card.innerHTML = `
      <div class="card-header">
        <div class="card-title-group">
          <div class="card-icon">🔧</div>
          <input type="text" class="field-input card-name-input" style="font-weight:700; font-size:14px; background:transparent; border:none; padding:0; color:var(--text-primary);"
                 placeholder="Custom Provider Name" value="${cp.displayName || ''}" data-idx="${index}">
        </div>
        <button class="remove-custom-btn" data-idx="${index}" title="Remove" style="background:transparent;border:none;color:var(--text-dim);cursor:pointer;font-size:16px;">✕</button>
      </div>

      <div class="card-fields">
        <div class="field-group">
          <label class="field-label">API Key</label>
          <div class="field-input-wrap">
            <input type="password" class="field-input custom-api-key" placeholder="Enter API key..." value="${cp.apiKey || ''}" data-idx="${index}" autocomplete="off">
            <button class="eye-toggle" title="Show/Hide">👁</button>
          </div>
        </div>
        <div class="field-row">
          <div class="field-group">
            <label class="field-label">Model Name</label>
            <input type="text" class="field-input custom-model" placeholder="e.g., my-model-v1" value="${cp.model || ''}" data-idx="${index}">
          </div>
          <div class="field-group">
            <label class="field-label">Base URL</label>
            <input type="text" class="field-input custom-url" placeholder="https://api.example.com/v1" value="${cp.baseUrl || ''}" data-idx="${index}">
          </div>
        </div>
      </div>

      <div class="card-actions">
        <div class="toggle-group">
          <label class="toggle">
            <input type="checkbox" class="custom-enabled" data-idx="${index}" ${cp.enabled !== false ? 'checked' : ''}>
            <span class="toggle-slider"></span>
          </label>
          <span class="toggle-label">${cp.enabled !== false ? 'Enabled' : 'Disabled'}</span>
        </div>
        <button class="btn btn-sm btn-test custom-test-btn" data-idx="${index}">Test</button>
      </div>
      <div class="test-result" data-idx="${index}"></div>
    `;

    // Wire up events
    const eyeBtn = card.querySelector('.eye-toggle');
    const apiInput = card.querySelector('.custom-api-key');
    eyeBtn.addEventListener('click', () => {
      apiInput.type = apiInput.type === 'password' ? 'text' : 'password';
      eyeBtn.textContent = apiInput.type === 'password' ? '👁' : '🔒';
    });

    const toggle = card.querySelector('.custom-enabled');
    const toggleLabel = card.querySelector('.toggle-label');
    toggle.addEventListener('change', () => {
      toggleLabel.textContent = toggle.checked ? 'Enabled' : 'Disabled';
    });

    const removeBtn = card.querySelector('.remove-custom-btn');
    removeBtn.addEventListener('click', () => {
      customProviders.splice(index, 1);
      loadAll(); // Re-render
      showToast('Custom provider removed', 'success');
    });

    const testBtn = card.querySelector('.custom-test-btn');
    testBtn.addEventListener('click', () => {
      const config = {
        name: `custom-${index}`,
        displayName: card.querySelector('.card-name-input').value || 'Custom',
        apiKey: card.querySelector('.custom-api-key').value,
        model: card.querySelector('.custom-model').value,
        baseUrl: card.querySelector('.custom-url').value,
        type: 'openai-compat'
      };
      testConnectionDirect(config, card.querySelector(`.test-result[data-idx="${index}"]`), testBtn);
    });

    providersGrid.appendChild(card);
  }

  async function addCustomProvider() {
    const data = await chrome.storage.local.get('providers');
    const providers = data.providers || {};
    providers._custom = providers._custom || [];
    providers._custom.push({
      displayName: '', apiKey: '', model: '', baseUrl: '', type: 'openai-compat', enabled: true
    });
    await chrome.storage.local.set({ providers });
    loadAll();
  }

  async function saveAll() {
    const providers = {};

    // Save preset providers
    PRESETS.forEach(preset => {
      const card = providersGrid.querySelector(`[data-key="${preset.key}"]`);
      if (!card) return;

      providers[preset.key] = {
        apiKey: card.querySelector('.api-key-input').value.trim(),
        model: card.querySelector('.model-input').value.trim() || preset.model,
        baseUrl: card.querySelector('.url-input').value.trim() || preset.baseUrl,
        enabled: card.querySelector('.enabled-toggle').checked,
        type: preset.type
      };
    });

    // Save custom providers
    const customCards = providersGrid.querySelectorAll('.custom-card');
    const customs = [];
    customCards.forEach(card => {
      customs.push({
        displayName: card.querySelector('.card-name-input')?.value.trim() || 'Custom',
        apiKey: card.querySelector('.custom-api-key')?.value.trim() || '',
        model: card.querySelector('.custom-model')?.value.trim() || '',
        baseUrl: card.querySelector('.custom-url')?.value.trim() || '',
        type: 'openai-compat',
        enabled: card.querySelector('.custom-enabled')?.checked !== false
      });
    });
    providers._custom = customs;

    // Save settings
    const settings = {
      timeout: (parseInt(document.getElementById('timeoutSetting').value, 10) || 15) * 1000,
      minModels: parseInt(document.getElementById('minModelsSetting').value, 10) || 2,
      confidenceThreshold: parseInt(document.getElementById('confidenceSetting').value, 10) || 50
    };

    const memoryContext = {
      name: document.getElementById('memName').value.trim(),
      email: document.getElementById('memEmail').value.trim(),
      phone: document.getElementById('memPhone').value.trim(),
      id: document.getElementById('memId').value.trim(),
      org: document.getElementById('memOrg').value.trim(),
      notes: document.getElementById('memNotes').value.trim()
    };

    await chrome.storage.local.set({ providers, settings, memoryContext });
    showToast('Settings saved successfully!', 'success');

    // Reload to update status indicators
    loadAll();
  }

  async function testConnection(preset, card) {
    const apiKey = card.querySelector('.api-key-input').value.trim();
    const model = card.querySelector('.model-input').value.trim() || preset.model;
    const baseUrl = card.querySelector('.url-input').value.trim() || preset.baseUrl;
    const testResult = card.querySelector(`.test-result[data-key="${preset.key}"]`);
    const testBtn = card.querySelector(`.test-btn[data-key="${preset.key}"]`);

    if (!apiKey) {
      testResult.textContent = '⚠ Enter an API key first';
      testResult.className = 'test-result error';
      return;
    }

    const config = {
      name: preset.key,
      displayName: preset.displayName,
      apiKey,
      model,
      baseUrl,
      type: preset.type
    };

    testConnectionDirect(config, testResult, testBtn);
  }

  async function testConnectionDirect(config, resultEl, testBtn) {
    testBtn.classList.add('testing');
    testBtn.textContent = 'Testing...';
    resultEl.textContent = '';

    try {
      const result = await chrome.runtime.sendMessage({
        action: 'testProvider',
        providerConfig: config
      });

      if (result.success) {
        resultEl.textContent = `✅ Connected (${result.latency}ms)`;
        resultEl.className = 'test-result success';
      } else {
        resultEl.textContent = `❌ ${result.message}`;
        resultEl.className = 'test-result error';
      }
    } catch (err) {
      resultEl.textContent = `❌ ${err.message}`;
      resultEl.className = 'test-result error';
    }

    testBtn.classList.remove('testing');
    testBtn.textContent = 'Test Connection';
  }

  function showToast(message, type = 'success') {
    toast.textContent = message;
    toast.className = `toast ${type} show`;
    setTimeout(() => {
      toast.classList.remove('show');
    }, 3000);
  }
});
