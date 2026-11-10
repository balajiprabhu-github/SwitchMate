// SwitchMate - Background Service Worker (Manifest V3)

const DEFAULT_CATEGORIES = {
  goal_android: [
    'developer.android.com',
    'source.android.com',
    'kotlinlang.org',
    'leetcode.com',
    'github.com',
    'stackoverflow.com',
    'medium.com',
    'proandroiddev.com',
    'geeksforgeeks.org',
    'hackerrank.com',
    'neetcode.io',
    'droidcon.com',
    'developer.apple.com'
  ],
  goal_investments: [
    'zerodha.com',
    'kite.zerodha.com',
    'groww.in',
    'tradingview.com',
    'moneycontrol.com',
    'finance.yahoo.com',
    'valueresearchonline.com',
    'tickertape.in',
    'coindcx.com',
    'indmoney.com',
    'smallcase.com'
  ],
  goal_workout: [
    'strava.com',
    'myfitnesspal.com',
    'hevyapp.com'
  ],
  distraction: [
    'twitter.com',
    'x.com',
    'instagram.com',
    'facebook.com',
    'reddit.com',
    'tiktok.com',
    'netflix.com',
    'primevideo.com',
    'twitch.tv',
    'hotstar.com',
    '9gag.com',
    'youtube.com'
  ]
};

const DEFAULT_SETTINGS = {
  distractionLimitMinutes: 10, // Nudge after 10 mins on distracting sites
  sessionLimitMinutes: 5,      // Or after 5 continuous minutes in a single session
  linkedinFeedBlocked: true,
  enableNudges: true
};

const DEFAULT_GOALS = {
  workout: {
    id: 'workout',
    title: 'Workout & Mobility Exercise',
    desc: 'Stretch, mobility drill, or strength session',
    completed: false,
    notes: ''
  },
  investments: {
    id: 'investments',
    title: 'Track Investments & Portfolio',
    desc: 'Review allocations, market watch, no impulsive trading',
    completed: false,
    notes: ''
  },
  androidPrep: {
    id: 'androidPrep',
    title: 'Android Dev Interview Prep',
    desc: 'Kotlin, Coroutines, Flow, Jetpack, System Design, LeetCode',
    completed: false,
    targetHours: 3,
    questionsSolved: 0,
    currentTopic: 'Kotlin Coroutines & Flow'
  },
  linkedinMindful: {
    id: 'linkedinMindful',
    title: 'Mindful LinkedIn (No Doom Scrolling)',
    desc: 'Only check job postings, connect with recruiters, and reply to messages',
    shieldActive: true
  }
};

let activeTabId = null;
let activeDomain = null;
let activeUrl = null;
let activeStartTime = Date.now();
let isUserIdle = false;
let isWindowFocused = true;
let snoozedDomains = {}; // domain -> timestamp ms
let productiveUrls = new Set(); // specific URLs verified by Gemini Nano as educational/productive

function getTodayKey() {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Initialize on install or startup
chrome.runtime.onInstalled.addListener(async () => {
  const data = await chrome.storage.local.get(['categories', 'settings', 'goals', 'history']);
  const updates = {};
  if (!data.categories) updates.categories = DEFAULT_CATEGORIES;
  if (!data.settings) updates.settings = DEFAULT_SETTINGS;
  if (!data.goals) updates.goals = DEFAULT_GOALS;
  if (!data.history) updates.history = {};

  const today = getTodayKey();
  const todayData = await chrome.storage.local.get([today]);
  if (!todayData[today]) {
    updates[today] = {
      domainTime: {},
      goals: DEFAULT_GOALS,
      studyMinutes: 0
    };
  }

  if (Object.keys(updates).length > 0) {
    await chrome.storage.local.set(updates);
  }

  // Setup periodic ticker alarm
  chrome.alarms.create('switchmate_ticker', { periodInMinutes: 0.1 }); // Every 6s

  // Immediately inject shield into any already-open LinkedIn tabs
  await injectLinkedInShieldIntoOpenTabs();
});

chrome.runtime.onStartup.addListener(async () => {
  chrome.alarms.create('switchmate_ticker', { periodInMinutes: 0.1 });
  await injectLinkedInShieldIntoOpenTabs();
});

async function injectLinkedInShieldIntoOpenTabs() {
  try {
    const tabs = await chrome.tabs.query({ url: ['*://*.linkedin.com/*'] });
    for (const tab of tabs) {
      if (!tab.id) continue;
      try {
        await chrome.tabs.reload(tab.id);
      } catch (e) {
        // Ignore tabs that cannot be reloaded
      }
    }
  } catch (err) {
    console.warn('Could not query LinkedIn tabs:', err);
  }
}

// Periodic alarm to flush elapsed time and evaluate nudges
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'switchmate_ticker') {
    await commitElapsedTime();
    await checkNudgeConditions();
  }
});

// Idle detection
chrome.idle.setDetectionInterval(60); // 1 minute
chrome.idle.onStateChanged.addListener((state) => {
  if (state === 'idle' || state === 'locked') {
    commitElapsedTime();
    isUserIdle = true;
  } else if (state === 'active') {
    isUserIdle = false;
    activeStartTime = Date.now();
  }
});

// Window focus changed
chrome.windows.onFocusChanged.addListener((windowId) => {
  commitElapsedTime();
  if (windowId === chrome.windows.WINDOW_ID_NONE) {
    isWindowFocused = false;
  } else {
    isWindowFocused = true;
    activeStartTime = Date.now();
    updateActiveTab();
  }
});

// Tab activated
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  await commitElapsedTime();
  activeTabId = activeInfo.tabId;
  await updateActiveTab();
});

// Tab updated
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (tabId === activeTabId && changeInfo.url) {
    await commitElapsedTime();
    extractDomain(changeInfo.url);
    activeStartTime = Date.now();
  }
});

async function updateActiveTab() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    if (tab && tab.url) {
      activeTabId = tab.id;
      extractDomain(tab.url);
      activeStartTime = Date.now();
    } else {
      activeDomain = null;
    }
  } catch (e) {
    console.error('Error updating active tab:', e);
  }
}

function extractDomain(url) {
  try {
    if (!url || !url.startsWith('http')) {
      activeDomain = null;
      activeUrl = null;
      return;
    }
    activeUrl = url;
    const parsed = new URL(url);
    activeDomain = parsed.hostname.replace(/^www\./, '').toLowerCase();
  } catch {
    activeDomain = null;
    activeUrl = null;
  }
}

async function getCategoryForDomain(domain, categories, url = null) {
  // If local Gemini Nano verified this specific URL as productive
  if (url && productiveUrls.has(url)) {
    return 'goal_android';
  }
  if (!domain) return 'neutral';
  for (const cat of ['goal_android', 'goal_investments', 'goal_workout', 'distraction']) {
    const list = categories[cat] || [];
    if (list.some(d => domain === d || domain.endsWith('.' + d))) {
      return cat;
    }
  }
  return 'neutral';
}

async function commitElapsedTime() {
  if (!activeDomain || isUserIdle || !isWindowFocused) {
    activeStartTime = Date.now();
    return;
  }

  const now = Date.now();
  const elapsedSeconds = Math.floor((now - activeStartTime) / 1000);
  if (elapsedSeconds <= 0) return;

  activeStartTime = now;
  const today = getTodayKey();
  const stored = await chrome.storage.local.get([today, 'categories']);
  const categories = stored.categories || DEFAULT_CATEGORIES;
  const dayRecord = stored[today] || { domainTime: {}, goals: DEFAULT_GOALS, studyMinutes: 0 };

  dayRecord.domainTime = dayRecord.domainTime || {};
  dayRecord.domainTime[activeDomain] = (dayRecord.domainTime[activeDomain] || 0) + elapsedSeconds;

  // If this belongs to android prep, increment study minutes
  const category = await getCategoryForDomain(activeDomain, categories, activeUrl);
  if (category === 'goal_android') {
    const totalAndroidSeconds = Object.entries(dayRecord.domainTime).reduce((acc, [dom, sec]) => {
      const isAndroid = (categories.goal_android || []).some(d => dom === d || dom.endsWith('.' + d));
      return isAndroid ? acc + sec : acc;
    }, 0);
    dayRecord.studyMinutes = Math.floor(totalAndroidSeconds / 60);
  }

  await chrome.storage.local.set({ [today]: dayRecord });
}

async function checkNudgeConditions() {
  if (!activeDomain || isUserIdle || !isWindowFocused || !activeTabId) return;

  // Check if domain is currently snoozed
  const snoozeUntil = snoozedDomains[activeDomain] || 0;
  if (Date.now() < snoozeUntil) {
    return;
  }

  const today = getTodayKey();
  const stored = await chrome.storage.local.get([today, 'categories', 'settings', 'goals']);
  const settings = stored.settings || DEFAULT_SETTINGS;
  if (!settings.enableNudges) return;

  const categories = stored.categories || DEFAULT_CATEGORIES;
  const category = await getCategoryForDomain(activeDomain, categories, activeUrl);

  // If it's a known distraction
  if (category === 'distraction') {
    const dayRecord = stored[today] || { domainTime: {} };
    const secondsToday = dayRecord.domainTime[activeDomain] || 0;
    const minutesToday = Math.floor(secondsToday / 60);

    const limitMinutes = settings.distractionLimitMinutes || 10;
    if (minutesToday >= limitMinutes) {
      // Send nudge message to active tab
      try {
        await chrome.tabs.sendMessage(activeTabId, {
          action: 'SHOW_NUDGE',
          payload: {
            domain: activeDomain,
            minutesSpent: minutesToday,
            limitMinutes: limitMinutes,
            currentTopic: (stored.goals && stored.goals.androidPrep) ? stored.goals.androidPrep.currentTopic : 'Android Dev Prep'
          }
        });
      } catch (err) {
        // Tab might not have content script ready or be an internal chrome page
      }
    }
  }
}

// Message handler for Popup and Content Scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  (async () => {
    const today = getTodayKey();

    if (message.action === 'GET_STATUS') {
      await commitElapsedTime();
      const stored = await chrome.storage.local.get([today, 'categories', 'settings', 'goals']);
      const dayRecord = stored[today] || { domainTime: {}, goals: stored.goals || DEFAULT_GOALS, studyMinutes: 0 };
      const categories = stored.categories || DEFAULT_CATEGORIES;
      const settings = stored.settings || DEFAULT_SETTINGS;
      const goals = dayRecord.goals || stored.goals || DEFAULT_GOALS;

      // Calculate time breakdown
      let androidSeconds = 0;
      let investmentSeconds = 0;
      let workoutSeconds = 0;
      let distractionSeconds = 0;
      let otherSeconds = 0;

      for (const [dom, sec] of Object.entries(dayRecord.domainTime || {})) {
        if ((categories.goal_android || []).some(d => dom === d || dom.endsWith('.' + d))) {
          androidSeconds += sec;
        } else if ((categories.goal_investments || []).some(d => dom === d || dom.endsWith('.' + d))) {
          investmentSeconds += sec;
        } else if ((categories.goal_workout || []).some(d => dom === d || dom.endsWith('.' + d))) {
          workoutSeconds += sec;
        } else if ((categories.distraction || []).some(d => dom === d || dom.endsWith('.' + d))) {
          distractionSeconds += sec;
        } else {
          otherSeconds += sec;
        }
      }

      sendResponse({
        today,
        activeDomain,
        goals,
        settings,
        domainTime: dayRecord.domainTime || {},
        breakdown: {
          androidSeconds,
          investmentSeconds,
          workoutSeconds,
          distractionSeconds,
          otherSeconds
        }
      });
    }

    else if (message.action === 'UPDATE_GOAL') {
      const { goalId, updates } = message.payload;
      const stored = await chrome.storage.local.get([today, 'goals']);
      const dayRecord = stored[today] || { domainTime: {}, goals: stored.goals || DEFAULT_GOALS, studyMinutes: 0 };
      const goals = dayRecord.goals || stored.goals || DEFAULT_GOALS;

      if (goals[goalId]) {
        goals[goalId] = { ...goals[goalId], ...updates };
        dayRecord.goals = goals;
        await chrome.storage.local.set({ [today]: dayRecord, goals });
      }
      sendResponse({ success: true, goals });
    }

    else if (message.action === 'MARK_SESSION_PRODUCTIVE') {
      const { url, category, reasoning } = message.payload;
      if (url) productiveUrls.add(url);
      console.log(`[SwitchMate] Local Gemini Nano identified ${url} as ${category} (${reasoning})`);
      sendResponse({ success: true });
    }

    else if (message.action === 'SNOOZE_NUDGE') {
      const { domain, durationMinutes } = message.payload;
      const minutes = durationMinutes || 5;
      snoozedDomains[domain] = Date.now() + minutes * 60 * 1000;
      sendResponse({ success: true, snoozedUntil: snoozedDomains[domain] });
    }

    else if (message.action === 'MARK_DOMAIN_RELEVANT') {
      const { domain, category } = message.payload; // e.g., 'goal_android' or 'goal_investments'
      const targetCategory = category || 'goal_android';
      const stored = await chrome.storage.local.get(['categories']);
      const categories = stored.categories || DEFAULT_CATEGORIES;

      // Remove from distraction if present
      categories.distraction = (categories.distraction || []).filter(d => d !== domain);
      if (!categories[targetCategory].includes(domain)) {
        categories[targetCategory].push(domain);
      }
      await chrome.storage.local.set({ categories });
      sendResponse({ success: true, categories });
    }

    else if (message.action === 'CLOSE_CURRENT_TAB') {
      if (sender.tab && sender.tab.id) {
        chrome.tabs.remove(sender.tab.id);
      }
      sendResponse({ success: true });
    }

    else if (message.action === 'NAVIGATE_TO_STUDY') {
      chrome.tabs.create({ url: 'https://leetcode.com' });
      if (sender.tab && sender.tab.id) {
        chrome.tabs.remove(sender.tab.id);
      }
      sendResponse({ success: true });
    }

    else if (message.action === 'GET_LINKEDIN_STATUS') {
      const stored = await chrome.storage.local.get(['settings', 'goals', today]);
      const settings = stored.settings || DEFAULT_SETTINGS;
      const dayRecord = stored[today] || {};
      const goals = dayRecord.goals || stored.goals || DEFAULT_GOALS;
      sendResponse({
        shieldActive: settings.linkedinFeedBlocked !== false,
        goals: goals
      });
    }

    else if (message.action === 'TOGGLE_LINKEDIN_SHIELD') {
      const stored = await chrome.storage.local.get(['settings']);
      const settings = stored.settings || DEFAULT_SETTINGS;
      settings.linkedinFeedBlocked = !settings.linkedinFeedBlocked;
      await chrome.storage.local.set({ settings });
      sendResponse({ success: true, shieldActive: settings.linkedinFeedBlocked });
    }

    else if (message.action === 'GET_CATEGORIES_AND_SETTINGS') {
      const stored = await chrome.storage.local.get(['categories', 'settings']);
      sendResponse({
        categories: stored.categories || DEFAULT_CATEGORIES,
        settings: stored.settings || DEFAULT_SETTINGS
      });
    }

    else if (message.action === 'SAVE_CATEGORIES_AND_SETTINGS') {
      const { categories, settings } = message.payload;
      await chrome.storage.local.set({ categories, settings });
      sendResponse({ success: true });
    }
  })();

  return true; // Keep channel open for async response
});
