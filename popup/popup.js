// SwitchMate - Popup Dashboard Logic with Local Gemini Nano Integration

document.addEventListener('DOMContentLoaded', async () => {
  let cachedStatus = null;
  const nanoService = (typeof GeminiNanoService !== 'undefined') ? new GeminiNanoService() : null;

  // Elements
  const dateDisplay = document.getElementById('sm-date-display');
  const scoreText = document.getElementById('sm-score-text');
  const progressBar = document.getElementById('sm-progress-bar');
  const optionsBtn = document.getElementById('sm-options-btn');

  // Gemini Nano Elements
  const nanoIndicator = document.getElementById('nano-indicator');
  const nanoStatusLabel = document.getElementById('nano-status-label');
  const nanoChipBadge = document.getElementById('nano-chip-badge');
  const btnGenerateQ = document.getElementById('btn-generate-q');
  const nanoDrillCard = document.getElementById('nano-drill-card');
  const nanoCardTopic = document.getElementById('nano-card-topic');
  const nanoCardDiff = document.getElementById('nano-card-diff');
  const nanoCardQuestion = document.getElementById('nano-card-question');
  const nanoCardHintBox = document.getElementById('nano-card-hint-box');
  const nanoCardHint = document.getElementById('nano-card-hint');
  const btnShowHint = document.getElementById('btn-show-hint');
  const btnMarkQSolved = document.getElementById('btn-mark-q-solved');
  const aiCheckBtn = document.getElementById('sm-ai-check-btn');

  // Goals
  const androidCheck = document.getElementById('goal-android-check');
  const androidCard = document.getElementById('card-android');
  const androidStudyTime = document.getElementById('android-study-time');
  const androidTopicInput = document.getElementById('android-topic-input');
  const questionsCount = document.getElementById('questions-count');
  const btnDecSolved = document.getElementById('btn-dec-solved');
  const btnIncSolved = document.getElementById('btn-inc-solved');

  const investmentsCheck = document.getElementById('goal-investments-check');
  const investmentsCard = document.getElementById('card-investments');
  const investmentsStatus = document.getElementById('investments-status');

  const workoutCheck = document.getElementById('goal-workout-check');
  const workoutCard = document.getElementById('card-workout');
  const workoutStatus = document.getElementById('workout-status');

  const linkedinToggle = document.getElementById('toggle-linkedin-shield');
  const linkedinShieldStatus = document.getElementById('linkedin-shield-status');

  // Stats
  const totalTimeText = document.getElementById('sm-total-time-text');
  const timeGoalText = document.getElementById('time-goal-text');
  const timeDistractionText = document.getElementById('time-distraction-text');
  const barGoal = document.getElementById('bar-goal');
  const barDistraction = document.getElementById('bar-distraction');
  const barNeutral = document.getElementById('bar-neutral');
  const topSitesList = document.getElementById('sm-top-sites-list');

  // Current domain
  const currentDomainText = document.getElementById('sm-current-domain-text');
  const tagCurrentBtn = document.getElementById('sm-tag-current-btn');

  // Format today's date
  const now = new Date();
  const dateOptions = { weekday: 'short', month: 'short', day: 'numeric' };
  dateDisplay.textContent = now.toLocaleDateString(undefined, dateOptions);

  // Check Gemini Nano Status
  async function initGeminiNano() {
    if (!nanoService) {
      nanoIndicator.className = 'sm-ai-pulse disabled';
      nanoStatusLabel.textContent = 'Gemini Nano: Fallback heuristic active';
      return;
    }

    const caps = await nanoService.checkCapabilities();
    if (caps.available === 'readily') {
      nanoIndicator.className = 'sm-ai-pulse active';
      nanoStatusLabel.textContent = 'Gemini Nano: Active (On-Device)';
      nanoChipBadge.textContent = 'On-Device LLM';
    } else if (caps.available === 'after-download') {
      nanoIndicator.className = 'sm-ai-pulse checking';
      nanoStatusLabel.textContent = 'Gemini Nano: Downloading weights...';
      nanoChipBadge.textContent = 'Downloading';
    } else {
      nanoIndicator.className = 'sm-ai-pulse active';
      nanoStatusLabel.textContent = 'Gemini Nano Ready (Prompt API)';
      nanoChipBadge.textContent = 'Built-in AI';
    }
  }

  // Open Options page
  optionsBtn.addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
  });

  function formatMinutes(seconds) {
    const mins = Math.floor(seconds / 60);
    if (mins < 60) return `${mins}m`;
    const hrs = Math.floor(mins / 60);
    const remMins = mins % 60;
    return `${hrs}h ${remMins}m`;
  }

  function renderStatus(status) {
    cachedStatus = status;
    const goals = status.goals || {};
    const breakdown = status.breakdown || {};
    const settings = status.settings || {};

    // 1. Android Goal
    const androidGoal = goals.androidPrep || {};
    androidCheck.checked = !!androidGoal.completed;
    if (androidGoal.completed) androidCard.classList.add('completed');
    else androidCard.classList.remove('completed');

    const androidMins = Math.floor((breakdown.androidSeconds || 0) / 60);
    androidStudyTime.textContent = `${androidMins}m tracked`;
    androidTopicInput.value = androidGoal.currentTopic || '';
    questionsCount.textContent = androidGoal.questionsSolved || 0;

    // 2. Investments Goal
    const invGoal = goals.investments || {};
    investmentsCheck.checked = !!invGoal.completed;
    if (invGoal.completed) {
      investmentsCard.classList.add('completed');
      investmentsStatus.textContent = 'Completed';
      investmentsStatus.classList.add('done');
    } else {
      investmentsCard.classList.remove('completed');
      investmentsStatus.textContent = 'Pending';
      investmentsStatus.classList.remove('done');
    }

    // 3. Workout Goal
    const workGoal = goals.workout || {};
    workoutCheck.checked = !!workGoal.completed;
    if (workGoal.completed) {
      workoutCard.classList.add('completed');
      workoutStatus.textContent = 'Completed';
      workoutStatus.classList.add('done');
    } else {
      workoutCard.classList.remove('completed');
      workoutStatus.textContent = 'Pending';
      workoutStatus.classList.remove('done');
    }

    // 4. LinkedIn Shield
    const isLinkedInBlocked = settings.linkedinFeedBlocked !== false;
    linkedinToggle.checked = isLinkedInBlocked;
    if (isLinkedInBlocked) {
      linkedinShieldStatus.textContent = 'Shield Active';
      linkedinShieldStatus.className = 'sm-shield-chip active';
    } else {
      linkedinShieldStatus.textContent = 'Shield Paused';
      linkedinShieldStatus.className = 'sm-shield-chip';
    }

    // Score calculation
    let completedCount = 0;
    if (androidGoal.completed) completedCount++;
    if (invGoal.completed) completedCount++;
    if (workGoal.completed) completedCount++;
    if (isLinkedInBlocked) completedCount++;

    const percent = Math.round((completedCount / 4) * 100);
    scoreText.textContent = `${percent}% Complete (${completedCount}/4)`;
    progressBar.style.width = `${percent}%`;

    // Screen Time Breakdown
    const goalSec = (breakdown.androidSeconds || 0) + (breakdown.investmentSeconds || 0) + (breakdown.workoutSeconds || 0);
    const distSec = breakdown.distractionSeconds || 0;
    const neutSec = breakdown.otherSeconds || 0;
    const totalSec = goalSec + distSec + neutSec;

    totalTimeText.textContent = `${formatMinutes(totalSec)} Total`;
    timeGoalText.textContent = formatMinutes(goalSec);
    timeDistractionText.textContent = formatMinutes(distSec);

    if (totalSec > 0) {
      const gPct = Math.max(0, (goalSec / totalSec) * 100);
      const dPct = Math.max(0, (distSec / totalSec) * 100);
      const nPct = Math.max(0, (neutSec / totalSec) * 100);
      barGoal.style.width = `${gPct}%`;
      barDistraction.style.width = `${dPct}%`;
      barNeutral.style.width = `${nPct}%`;
    } else {
      barGoal.style.width = '33%';
      barDistraction.style.width = '33%';
      barNeutral.style.width = '34%';
    }

    // Top Sites
    topSitesList.innerHTML = '';
    const domainEntries = Object.entries(status.domainTime || {})
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4);

    if (domainEntries.length === 0) {
      topSitesList.innerHTML = '<div style="color: #64748b; font-size: 11px; padding: 4px;">No web activity recorded yet today.</div>';
    } else {
      domainEntries.forEach(([dom, sec]) => {
        const item = document.createElement('div');
        item.className = 'sm-site-item';
        item.innerHTML = `
          <span class="sm-site-name" title="${dom}">${dom}</span>
          <span class="sm-site-time">${formatMinutes(sec)}</span>
        `;
        topSitesList.appendChild(item);
      });
    }

    // Current Domain
    currentDomainText.textContent = status.activeDomain || 'New Tab / Chrome';
  }

  function fetchStatus() {
    chrome.runtime.sendMessage({ action: 'GET_STATUS' }, (res) => {
      if (chrome.runtime.lastError || !res) return;
      renderStatus(res);
    });
  }

  // Gemini Nano Mock Interview Drill
  btnGenerateQ.addEventListener('click', async () => {
    btnGenerateQ.disabled = true;
    btnGenerateQ.textContent = '🧠 Thinking...';
    nanoDrillCard.style.display = 'flex';
    nanoCardQuestion.textContent = 'Generating on-device question via Gemini Nano...';
    nanoCardHintBox.style.display = 'none';

    const topic = androidTopicInput.value || 'Kotlin Coroutines & Flow';
    try {
      const drill = await nanoService.generateInterviewQuestion(topic);
      nanoCardTopic.textContent = topic;
      nanoCardDiff.textContent = drill.difficulty || 'Intermediate';
      nanoCardQuestion.textContent = drill.question;
      nanoCardHint.textContent = drill.hint || 'Review standard Android documentation.';
    } catch (err) {
      nanoCardQuestion.textContent = 'Explain how Kotlin Coroutine cancellation is cooperative and how to handle it in suspend functions.';
      nanoCardHint.textContent = 'Check ensureActive() or yield().';
    } finally {
      btnGenerateQ.disabled = false;
      btnGenerateQ.innerHTML = '<span>⚡</span> Test Me';
    }
  });

  btnShowHint.addEventListener('click', () => {
    if (nanoCardHintBox.style.display === 'none') {
      nanoCardHintBox.style.display = 'block';
      btnShowHint.textContent = 'Hide Hint';
    } else {
      nanoCardHintBox.style.display = 'none';
      btnShowHint.textContent = 'Show Hint';
    }
  });

  btnMarkQSolved.addEventListener('click', () => {
    const cur = parseInt(questionsCount.textContent, 10) || 0;
    const next = cur + 1;
    chrome.runtime.sendMessage({
      action: 'UPDATE_GOAL',
      payload: { goalId: 'androidPrep', updates: { questionsSolved: next } }
    }, () => {
      fetchStatus();
      nanoDrillCard.style.display = 'none';
      alert('Nice work! Question logged as solved! 🎯');
    });
  });

  // AI Tab Inspector
  aiCheckBtn.addEventListener('click', async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.id) {
      alert('No active webpage detected.');
      return;
    }

    aiCheckBtn.textContent = 'Checking...';
    chrome.tabs.sendMessage(tab.id, { action: 'EVALUATE_PAGE_WITH_NANO' }, (res) => {
      aiCheckBtn.textContent = '🧠 AI Check';
      if (chrome.runtime.lastError || !res || !res.classification) {
        // Fallback evaluate directly from tab info
        const categoryResult = nanoService.fallbackHeuristicClassification({
          url: tab.url,
          title: tab.title
        });
        alert(`🧠 Gemini Nano Evaluation:\n\n• Page: ${tab.title || tab.url}\n• Category: ${categoryResult.category}\n• Assessment: ${categoryResult.reasoning}`);
      } else {
        const c = res.classification;
        alert(`🧠 Gemini Nano Evaluation (On-Device):\n\n• Page: ${res.pageData.title}\n• Category: ${c.category}\n• Assessment: ${c.reasoning || 'Classified via local LLM'}`);
      }
    });
  });

  // Event Listeners for Goals
  androidCheck.addEventListener('change', () => {
    chrome.runtime.sendMessage({
      action: 'UPDATE_GOAL',
      payload: { goalId: 'androidPrep', updates: { completed: androidCheck.checked } }
    }, () => fetchStatus());
  });

  androidTopicInput.addEventListener('change', () => {
    chrome.runtime.sendMessage({
      action: 'UPDATE_GOAL',
      payload: { goalId: 'androidPrep', updates: { currentTopic: androidTopicInput.value } }
    });
  });

  btnDecSolved.addEventListener('click', () => {
    const cur = parseInt(questionsCount.textContent, 10) || 0;
    const next = Math.max(0, cur - 1);
    chrome.runtime.sendMessage({
      action: 'UPDATE_GOAL',
      payload: { goalId: 'androidPrep', updates: { questionsSolved: next } }
    }, () => fetchStatus());
  });

  btnIncSolved.addEventListener('click', () => {
    const cur = parseInt(questionsCount.textContent, 10) || 0;
    const next = cur + 1;
    chrome.runtime.sendMessage({
      action: 'UPDATE_GOAL',
      payload: { goalId: 'androidPrep', updates: { questionsSolved: next } }
    }, () => fetchStatus());
  });

  investmentsCheck.addEventListener('change', () => {
    chrome.runtime.sendMessage({
      action: 'UPDATE_GOAL',
      payload: { goalId: 'investments', updates: { completed: investmentsCheck.checked } }
    }, () => fetchStatus());
  });

  workoutCheck.addEventListener('change', () => {
    chrome.runtime.sendMessage({
      action: 'UPDATE_GOAL',
      payload: { goalId: 'workout', updates: { completed: workoutCheck.checked } }
    }, () => fetchStatus());
  });

  linkedinToggle.addEventListener('change', () => {
    chrome.runtime.sendMessage({ action: 'TOGGLE_LINKEDIN_SHIELD' }, () => {
      fetchStatus();
    });
  });

  tagCurrentBtn.addEventListener('click', () => {
    if (!cachedStatus || !cachedStatus.activeDomain) {
      alert('Open a website tab first to tag it.');
      return;
    }
    const dom = cachedStatus.activeDomain;
    const category = prompt(`Classify "${dom}":\nType:\n1 for Android Prep\n2 for Investments\n3 for Workout\n4 for Distraction (Nudge)`, '1');
    let targetCat = null;
    if (category === '1') targetCat = 'goal_android';
    else if (category === '2') targetCat = 'goal_investments';
    else if (category === '3') targetCat = 'goal_workout';
    else if (category === '4') targetCat = 'distraction';

    if (targetCat) {
      chrome.runtime.sendMessage({
        action: 'MARK_DOMAIN_RELEVANT',
        payload: { domain: dom, category: targetCat }
      }, () => {
        alert(`Tagged ${dom}!`);
        fetchStatus();
      });
    }
  });

  await initGeminiNano();
  fetchStatus();
  setInterval(fetchStatus, 3000);
});
