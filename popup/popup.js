/**
 * Solveit — Popup Script v3
 * Updated for the new agentic page-processing flow.
 */

document.addEventListener('DOMContentLoaded', () => {
  const solveBtn = document.getElementById('solveBtn');
  const settingsBtn = document.getElementById('settingsBtn');
  const clearBtn = document.getElementById('clearBtn');
  const retryBtn = document.getElementById('retryBtn');
  const detailsLink = document.getElementById('detailsLink');

  const statusText = document.getElementById('statusText');
  const questionCount = document.getElementById('questionCount');
  const confidenceValue = document.getElementById('confidenceValue');
  const timeValue = document.getElementById('timeValue');
  const providerDots = document.getElementById('providerDots');

  const progressContainer = document.getElementById('progressContainer');
  const progressFill = document.getElementById('progressFill');
  const progressText = document.getElementById('progressText');

  const resultsPanel = document.getElementById('resultsPanel');
  const resultsList = document.getElementById('resultsList');
  const errorPanel = document.getElementById('errorPanel');
  const errorText = document.getElementById('errorText');

  let solveStartTime = 0;
  let lastAnswers = [];

  // ===== Initialize =====
  loadProviderStatus();
  checkCurrentPageStatus();

  // ===== Event Listeners =====
  solveBtn.addEventListener('click', startSolve);

  settingsBtn.addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
  });

  clearBtn.addEventListener('click', () => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        chrome.tabs.sendMessage(tabs[0].id, { action: 'clear' }, () => {
          resetUI();
        });
      }
    });
  });

  retryBtn.addEventListener('click', () => {
    errorPanel.style.display = 'none';
    startSolve();
  });

  detailsLink.addEventListener('click', (e) => {
    e.preventDefault();
    copyDetails();
  });

  // Listen for progress updates
  chrome.runtime.onMessage.addListener((message) => {
    if (message.action === 'progressUpdate') {
      updateProgress(message.phase, message.current, message.total, message.detail);
    }
  });

  // ===== Functions =====

  function startSolve() {
    solveStartTime = Date.now();
    setLoading(true);
    hideError();
    resultsPanel.style.display = 'none';
    showProgress('Capturing page content...', 0);

    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (!tabs[0]) {
        showError('No active tab found. Open a quiz page first.');
        setLoading(false);
        return;
      }

      // Send solve command to content script
      chrome.tabs.sendMessage(tabs[0].id, { action: 'solve' }, (response) => {
        if (chrome.runtime.lastError) {
          showError('Could not connect to page. Refresh the page and try again.');
          setLoading(false);
          return;
        }

        if (!response) {
          showError('No response from page. Refresh and try again.');
          setLoading(false);
          return;
        }

        if (!response.success) {
          showError(response.error || 'Something went wrong.');
          setLoading(false);
          return;
        }

        // Success!
        const elapsed = Date.now() - solveStartTime;
        setLoading(false);
        showResults(response);
        if (timeValue) timeValue.textContent = formatTime(elapsed);
        progressContainer.style.display = 'none';
      });
    });
  }

  function setLoading(loading) {
    if (loading) {
      solveBtn.disabled = true;
      solveBtn.classList.add('loading');
      solveBtn.querySelector('.solve-text').textContent = 'SOLVING...';
      solveBtn.querySelector('.solve-icon').classList.add('spinning');
      statusText.textContent = 'Processing...';
      statusText.classList.add('active');
      statusText.classList.remove('success');
    } else {
      solveBtn.disabled = false;
      solveBtn.classList.remove('loading');
      solveBtn.querySelector('.solve-text').textContent = 'SOLVE THIS PAGE';
      solveBtn.querySelector('.solve-icon').classList.remove('spinning');
    }
  }

  function showProgress(text, percent) {
    progressContainer.style.display = 'block';
    progressText.textContent = text;
    if (percent === 0) {
      progressFill.classList.add('indeterminate');
      progressFill.style.width = '';
    } else {
      progressFill.classList.remove('indeterminate');
      progressFill.style.width = `${percent}%`;
    }
  }

  function updateProgress(phase, current, total, detail) {
    switch (phase) {
      case 'scanning':
        showProgress('Capturing page content...', 5);
        break;
      case 'solving':
        showProgress(detail || 'AI is reading the page...', 40);
        break;
      case 'filling':
        showProgress('Filling answers...', 90);
        break;
      case 'done':
        showProgress('Complete!', 100);
        break;
    }
  }

  function showResults(response) {
    statusText.textContent = 'Complete';
    statusText.classList.remove('active');
    statusText.classList.add('success');
    questionCount.textContent = `${response.filledCount}/${response.totalQuestions}`;

    const answers = response.answers || [];
    lastAnswers = answers;

    if (answers.length > 0) {
      if (confidenceValue) {
        const avgConf = Math.round(
          answers.reduce((sum, a) => sum + (a.confidence || 0), 0) / answers.length
        );
        confidenceValue.textContent = `${avgConf}%`;
      }

      // Show results list
      resultsPanel.style.display = 'block';
      resultsList.innerHTML = '';

      answers.forEach((a, idx) => {
        const item = document.createElement('div');
        item.className = 'q-item';

        const conf = a.confidence || 0;
        const qText = a.questionText || `Question ${idx + 1}`;
        const aText = a.answer || '—';

        item.innerHTML = `
          <div class="q-text" title="${escapeHtml(qText)}">${escapeHtml(qText)}</div>
          <div class="q-answer-row">
            <span class="q-answer" title="${escapeHtml(aText)}">${escapeHtml(aText)}</span>
            <span class="q-conf">${conf}% Conf</span>
          </div>
        `;
        resultsList.appendChild(item);
      });
    } else {
      if (confidenceValue) confidenceValue.textContent = '—';
    }
  }

  function showError(message) {
    errorPanel.style.display = 'block';
    errorText.textContent = message;
    statusText.textContent = 'Error';
    statusText.classList.remove('active', 'success');
    progressContainer.style.display = 'none';
  }

  function hideError() {
    errorPanel.style.display = 'none';
  }

  function resetUI() {
    statusText.textContent = 'Ready';
    statusText.classList.remove('active', 'success');
    questionCount.textContent = '—';
    if (confidenceValue) confidenceValue.textContent = '—';
    if (timeValue) timeValue.textContent = '—';
    resultsPanel.style.display = 'none';
    progressContainer.style.display = 'none';
    errorPanel.style.display = 'none';
    lastAnswers = [];
  }

  function copyDetails() {
    if (lastAnswers.length === 0) return;

    const text = lastAnswers.map((a, i) =>
      `Q${i+1}: ${a.questionText || '?'}\nAnswer: ${a.answer}\nConfidence: ${a.confidence}%\nExplanation: ${a.explanation || 'N/A'}`
    ).join('\n\n---\n\n');

    navigator.clipboard.writeText(text).then(() => {
      detailsLink.textContent = '✓ Copied!';
      setTimeout(() => { detailsLink.textContent = 'View Details'; }, 1500);
    });
  }

  async function loadProviderStatus() {
    try {
      const response = await chrome.runtime.sendMessage({ action: 'getProviderStatus' });
      if (response?.success) {
        renderProviderDots(response.statuses);
      } else {
        providerDots.innerHTML = '<span class="dot-loading">No models configured</span>';
      }
    } catch {
      providerDots.innerHTML = '<span class="dot-loading">Loading...</span>';
    }
  }

  function renderProviderDots(statuses) {
    providerDots.innerHTML = '';
    let activeCount = 0;

    Object.entries(statuses).forEach(([key, s]) => {
      if (!s.configured) return;
      const dot = document.createElement('span');
      dot.className = `provider-dot${s.enabled ? '' : ' inactive'}`;
      dot.innerHTML = `<span class="dot-indicator"></span>${s.icon || '●'} ${key}`;
      providerDots.appendChild(dot);
      if (s.configured && s.enabled) activeCount++;
    });

    if (activeCount === 0) {
      providerDots.innerHTML = '<span class="dot-loading">No models — <a href="#" style="color:#818cf8" id="goSettings">Add Keys</a></span>';
      document.getElementById('goSettings')?.addEventListener('click', (e) => {
        e.preventDefault();
        chrome.runtime.openOptionsPage();
      });
    }
  }

  function checkCurrentPageStatus() {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        chrome.storage.local.get(`lastSolved_${tabs[0].id}`, (data) => {
          const answers = data[`lastSolved_${tabs[0].id}`];
          if (answers && answers.length > 0) {
            showResults({
              filledCount: answers.length,
              totalQuestions: answers.length,
              answers: answers
            });
          }
        });
        
        chrome.tabs.sendMessage(tabs[0].id, { action: 'getStatus' }, (response) => {
          if (chrome.runtime.lastError) return;
          if (response?.hasFilled) {
            statusText.textContent = 'Filled';
            statusText.classList.add('success');
          }
        });
      }
    });
  }

  function formatTime(ms) {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  }

  function escapeHtml(str) {
    const d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
  }
});
