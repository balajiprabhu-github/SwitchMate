// SwitchMate - In-Page Smart Nudge & Local Gemini Nano Intent Classifier
(function () {
  let activeModal = null;
  const nanoService = (typeof window.GeminiNanoService !== 'undefined') 
    ? new window.GeminiNanoService() 
    : null;

  // Extract page metadata for Gemini Nano evaluation
  function getPageMetadata() {
    const metaDesc = document.querySelector('meta[name="description"]')?.content || '';
    const h1 = document.querySelector('h1')?.innerText || '';
    const h2 = document.querySelector('h2')?.innerText || '';
    return {
      url: window.location.href,
      domain: window.location.hostname.replace(/^www\./, '').toLowerCase(),
      title: document.title || '',
      metaDescription: metaDesc,
      headings: `${h1} ${h2}`.trim()
    };
  }

  // Smart page classification using local Gemini Nano on page load
  async function performSmartAnalysis() {
    const pageData = getPageMetadata();
    
    // Only analyze if on ambiguous sites like youtube, medium, reddit, or general web pages
    const domain = pageData.domain;
    if (domain.includes('youtube.com') || domain.includes('reddit.com') || domain.includes('medium.com') || domain.includes('x.com')) {
      chrome.runtime.sendMessage({ action: 'GET_STATUS' }, async (status) => {
        if (!status || !nanoService) return;
        const currentGoals = status.goals;
        
        // Ask local Gemini Nano to classify
        const result = await nanoService.classifyPageIntent(pageData, currentGoals);
        
        if (result && (result.category === 'goal_android' || result.category === 'goal_investments' || result.category === 'goal_workout')) {
          // Tell background that this specific session is productive educational content
          chrome.runtime.sendMessage({
            action: 'MARK_SESSION_PRODUCTIVE',
            payload: {
              url: pageData.url,
              category: result.category,
              reasoning: result.reasoning
            }
          });
        }
      });
    }
  }

  // Listen for messages from background & popup
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'SHOW_NUDGE') {
      showSmartNudge(message.payload);
      sendResponse({ received: true });
    } else if (message.action === 'EVALUATE_PAGE_WITH_NANO') {
      const pageData = getPageMetadata();
      chrome.runtime.sendMessage({ action: 'GET_STATUS' }, async (status) => {
        if (!nanoService) {
          sendResponse({ error: 'Gemini Nano service unavailable' });
          return;
        }
        const classification = await nanoService.classifyPageIntent(pageData, status?.goals);
        sendResponse({ pageData, classification });
      });
      return true; // async response
    }
  });

  async function showSmartNudge(data) {
    if (activeModal) {
      const highlight = activeModal.querySelector('.sm-nudge-highlight');
      if (highlight) highlight.textContent = `${data.minutesSpent} minutes`;
      return;
    }

    const pageData = getPageMetadata();
    let smartMessage = `You've spent ${data.minutesSpent} minutes on ${data.domain} today.`;

    // Try generating a contextual nudge with local Gemini Nano
    if (nanoService) {
      try {
        smartMessage = await nanoService.generateContextualNudge(pageData, {
          androidPrep: { currentTopic: data.currentTopic }
        });
      } catch (e) {
        console.log('[SwitchMate] Nano fallback to default message');
      }
    }

    const modal = document.createElement('div');
    modal.id = 'switchmate-nudge-modal';

    modal.innerHTML = `
      <div class="sm-nudge-header">
        <div class="sm-nudge-brand">
          <span class="logo-icon">🧠</span>
          <span>SwitchMate AI Focus Nudge</span>
        </div>
        <button class="sm-nudge-close-btn" id="sm-close-nudge" title="Dismiss">&times;</button>
      </div>

      <div class="sm-nudge-body">
        <h3 class="sm-nudge-title">Mindful Check-in ⏱️</h3>
        <p class="sm-nudge-text" id="sm-nudge-dynamic-text">
          ${smartMessage}
        </p>

        <div class="sm-nudge-goal-pill">
          <span>🤖</span>
          <span>Today's Target: <strong>${data.currentTopic || 'Android Dev Interview Prep'}</strong></span>
        </div>

        <div class="sm-nudge-actions">
          <button class="sm-btn-primary" id="sm-back-to-study">
            <span>🚀</span> Back to Interview Prep
          </button>
          <div class="sm-btn-row">
            <button class="sm-btn-secondary" id="sm-snooze-5">
              ⏱️ Snooze 5 min
            </button>
            <button class="sm-btn-secondary" id="sm-close-tab">
              ❌ Close Tab
            </button>
          </div>
          <button class="sm-btn-link" id="sm-mark-relevant">
            Is this relevant to your prep or investments? Mark as relevant
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);
    activeModal = modal;

    modal.querySelector('#sm-close-nudge').addEventListener('click', () => {
      dismissNudge();
    });

    modal.querySelector('#sm-back-to-study').addEventListener('click', () => {
      chrome.runtime.sendMessage({ action: 'NAVIGATE_TO_STUDY' });
      dismissNudge();
    });

    modal.querySelector('#sm-close-tab').addEventListener('click', () => {
      chrome.runtime.sendMessage({ action: 'CLOSE_CURRENT_TAB' });
      dismissNudge();
    });

    modal.querySelector('#sm-snooze-5').addEventListener('click', () => {
      chrome.runtime.sendMessage({
        action: 'SNOOZE_NUDGE',
        payload: { domain: data.domain, durationMinutes: 5 }
      });
      dismissNudge();
    });

    modal.querySelector('#sm-mark-relevant').addEventListener('click', () => {
      const choice = confirm(`Mark "${data.domain}" as relevant to your goals (Android Prep or Investment)?`);
      if (choice) {
        chrome.runtime.sendMessage({
          action: 'MARK_DOMAIN_RELEVANT',
          payload: { domain: data.domain, category: 'goal_android' }
        }, () => {
          dismissNudge();
          alert(`"${data.domain}" has been marked as goal-aligned!`);
        });
      }
    });
  }

  function dismissNudge() {
    if (activeModal) {
      activeModal.remove();
      activeModal = null;
    }
  }

  // Run initial smart analysis after slight delay for DOM to settle
  setTimeout(performSmartAnalysis, 1500);
})();
