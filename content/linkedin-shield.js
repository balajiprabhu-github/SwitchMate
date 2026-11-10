// SwitchMate - LinkedIn Feed Shield Content Script
(function () {
  // Clean up previous instance if extension was reloaded
  if (window.__switchMateCleanup) {
    try {
      window.__switchMateCleanup();
    } catch (e) {
      // Ignore cleanup errors
    }
  }

  let isShieldEnabled = true;
  let tempUnlockUntil = 0;
  let cachedGoals = null;
  let lastHref = window.location.href;

  // Match all LinkedIn feed URLs including /feed/foryou/ and /feed/network/
  function isFeedPage() {
    const cleanPath = window.location.pathname.toLowerCase().replace(/\/+$/, '');
    return (
      cleanPath === '' ||
      cleanPath === '/feed' ||
      cleanPath === '/feed/foryou' ||
      cleanPath === '/feed/network' ||
      cleanPath.startsWith('/feed/') ||
      cleanPath === '/nhome'
    );
  }

  function isCurrentlyBlocked() {
    return isShieldEnabled && Date.now() >= tempUnlockUntil && isFeedPage();
  }

  function cleanLegacyAttributes() {
    const hosts = document.querySelectorAll('[data-switchmate-feed-host]');
    hosts.forEach((el) => el.removeAttribute('data-switchmate-feed-host'));

    const hiddenNodes = document.querySelectorAll('[data-switchmate-hidden]');
    hiddenNodes.forEach((el) => {
      el.style.removeProperty('display');
      el.removeAttribute('data-switchmate-hidden');
    });
  }

  function updateHeaderOffset() {
    const navEl =
      document.querySelector('header#global-nav') ||
      document.querySelector('#global-nav') ||
      document.querySelector('header.global-nav') ||
      document.querySelector('header') ||
      document.querySelector('nav');

    if (navEl) {
      const rect = navEl.getBoundingClientRect();
      if (rect.height >= 40 && rect.height <= 90) {
        document.documentElement.style.setProperty('--sm-header-offset', `${Math.round(rect.height)}px`);
        return;
      }
    }
    document.documentElement.style.setProperty('--sm-header-offset', '56px');
  }

  function pauseAnyFeedVideos() {
    const videos = document.querySelectorAll('video, audio');
    videos.forEach((v) => {
      try {
        if (!v.paused) v.pause();
        v.muted = true;
      } catch (e) {
        // Ignore
      }
    });
  }

  function checkAndApplyShield() {
    const htmlEl = document.documentElement;
    if (!htmlEl) return;

    cleanLegacyAttributes();

    const shouldBlock = isCurrentlyBlocked();

    if (!shouldBlock) {
      htmlEl.classList.remove('switchmate-feed-blocked');
      if (document.body) {
        document.body.classList.remove('switchmate-feed-blocked');
      }
      removeShieldCard();
      return;
    }

    htmlEl.classList.add('switchmate-feed-blocked');
    if (document.body) {
      document.body.classList.add('switchmate-feed-blocked');
    }

    if (window.scrollY > 0) {
      window.scrollTo(0, 0);
    }

    updateHeaderOffset();
    pauseAnyFeedVideos();
    injectShieldCard();
  }

  function removeShieldCard() {
    const existing = document.getElementById('switchmate-linkedin-shield-container');
    if (existing) existing.remove();
  }

  function buildShieldHTML() {
    const workout = cachedGoals?.workout;
    const investments = cachedGoals?.investments;
    const androidPrep = cachedGoals?.androidPrep;

    return `
      <div class="sm-card">
        <div class="sm-card-header">
          <div>
            <h2 class="sm-shield-title">🎯 LinkedIn Feed Blocked</h2>
            <p class="sm-shield-subtitle"><code>${window.location.pathname}</code> is blocked to prevent doom-scrolling. Use the top bar or quick links below!</p>
          </div>
          <div class="sm-badge">
            <span class="sm-badge-icon">🛡️</span> Shield Active
          </div>
        </div>

        <div class="sm-goals-section">
          <div class="sm-goals-title">📋 Today's Accountability Checklist</div>
          <div class="sm-goal-item">
            <div class="sm-goal-left">
              <span>🤖</span>
              <span><strong>Android Interview Prep:</strong> ${androidPrep?.currentTopic || 'Kotlin, Coroutines, System Design'}</span>
            </div>
            <span class="sm-status-tag ${androidPrep?.completed ? 'completed' : 'pending'}">
              ${androidPrep?.completed ? '✅ Done' : (androidPrep?.questionsSolved ? `${androidPrep.questionsSolved} Solved` : '⏳ In Progress')}
            </span>
          </div>
          <div class="sm-goal-item">
            <div class="sm-goal-left">
              <span>📈</span>
              <span><strong>Track Investments:</strong> Portfolio review & research</span>
            </div>
            <span class="sm-status-tag ${investments?.completed ? 'completed' : 'pending'}">
              ${investments?.completed ? '✅ Done' : '⏳ Pending'}
            </span>
          </div>
          <div class="sm-goal-item">
            <div class="sm-goal-left">
              <span>🏃</span>
              <span><strong>Workout & Mobility:</strong> Movement & health</span>
            </div>
            <span class="sm-status-tag ${workout?.completed ? 'completed' : 'pending'}">
              ${workout?.completed ? '✅ Done' : '⏳ Pending'}
            </span>
          </div>
        </div>

        <div class="sm-quick-actions">
          <div class="sm-quick-actions-title">Access other LinkedIn sections directly:</div>
          <div class="sm-buttons-grid">
            <a href="/jobs/" class="sm-nav-btn primary">
              <span>💼</span> Browse Android Jobs
            </a>
            <a href="/messaging/" class="sm-nav-btn">
              <span>💬</span> Recruiter Messages
            </a>
            <a href="/mynetwork/" class="sm-nav-btn">
              <span>👥</span> Expand Network
            </a>
            <a href="/notifications/" class="sm-nav-btn">
              <span>🔔</span> Check Notifications
            </a>
          </div>
        </div>

        <div class="sm-footer-controls">
          <span>SwitchMate Interview Companion</span>
          <button id="sm-temp-unlock-btn" class="sm-temp-unlock-btn">Allow feed for 5 minutes</button>
        </div>
      </div>
    `;
  }

  function attachUnlockListener(container) {
    const unlockBtn = container.querySelector('#sm-temp-unlock-btn');
    if (unlockBtn) {
      unlockBtn.addEventListener('click', () => {
        tempUnlockUntil = Date.now() + 5 * 60 * 1000;
        checkAndApplyShield();
        setTimeout(checkAndApplyShield, 5 * 60 * 1000 + 500);
      });
    }
  }

  function injectShieldCard() {
    const mountTarget = document.body || document.documentElement;
    if (!mountTarget) return;

    let container = document.getElementById('switchmate-linkedin-shield-container');
    if (container) {
      if (document.body && container.parentElement !== document.body) {
        document.body.appendChild(container);
      }
      return;
    }

    container = document.createElement('div');
    container.id = 'switchmate-linkedin-shield-container';
    container.innerHTML = buildShieldHTML();

    mountTarget.appendChild(container);
    attachUnlockListener(container);
  }

  function refreshShieldCardContent() {
    const container = document.getElementById('switchmate-linkedin-shield-container');
    if (container) {
      container.innerHTML = buildShieldHTML();
      attachUnlockListener(container);
    }
  }

  // Block wheel / touchscroll on the underlying feed when shield is active
  function blockScrollEvent(e) {
    if (!isCurrentlyBlocked()) return;
    const shield = document.getElementById('switchmate-linkedin-shield-container');
    if (shield && shield.contains(e.target)) {
      return;
    }
    e.preventDefault();
    e.stopPropagation();
  }

  window.addEventListener('wheel', blockScrollEvent, { passive: false, capture: true });
  window.addEventListener('touchmove', blockScrollEvent, { passive: false, capture: true });

  // Fetch status from background
  function fetchStatus() {
    try {
      chrome.runtime.sendMessage({ action: 'GET_LINKEDIN_STATUS' }, (res) => {
        if (chrome.runtime.lastError || !res) return;
        isShieldEnabled = res.shieldActive !== false;
        cachedGoals = res.goals || null;
        checkAndApplyShield();
        refreshShieldCardContent();
      });
    } catch (e) {
      // Ignore
    }
  }

  function onStorageChanged(changes, area) {
    if (area === 'local') {
      if (changes.settings) {
        const newSettings = changes.settings.newValue;
        if (newSettings) {
          isShieldEnabled = newSettings.linkedinFeedBlocked !== false;
          checkAndApplyShield();
        }
      }
      fetchStatus();
    }
  }

  try {
    chrome.storage.onChanged.addListener(onStorageChanged);
  } catch (e) {
    // Ignore
  }

  const onNavigate = () => {
    setTimeout(checkAndApplyShield, 20);
    setTimeout(checkAndApplyShield, 200);
  };

  if (window.navigation && typeof window.navigation.addEventListener === 'function') {
    window.navigation.addEventListener('navigate', onNavigate);
  }

  window.addEventListener('popstate', onNavigate);

  const observer = new MutationObserver(() => {
    if (window.location.href !== lastHref) {
      lastHref = window.location.href;
      checkAndApplyShield();
      refreshShieldCardContent();
    } else if (isCurrentlyBlocked()) {
      if (!document.getElementById('switchmate-linkedin-shield-container')) {
        checkAndApplyShield();
      }
    }
  });

  if (document.documentElement) {
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true
    });
  }

  const intervalId = setInterval(() => {
    checkAndApplyShield();
    fetchStatus();
  }, 1500);

  window.__switchMateCleanup = () => {
    observer.disconnect();
    clearInterval(intervalId);
    window.removeEventListener('popstate', onNavigate);
    window.removeEventListener('wheel', blockScrollEvent, { capture: true });
    window.removeEventListener('touchmove', blockScrollEvent, { capture: true });
    if (window.navigation && typeof window.navigation.removeEventListener === 'function') {
      window.navigation.removeEventListener('navigate', onNavigate);
    }
    try {
      chrome.storage.onChanged.removeListener(onStorageChanged);
    } catch (e) {
      // Ignore
    }
  };

  checkAndApplyShield();
  fetchStatus();
})();
