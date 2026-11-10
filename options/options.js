// SwitchMate - Options Page Logic

document.addEventListener('DOMContentLoaded', () => {
  let categories = {
    goal_android: [],
    goal_investments: [],
    goal_workout: [],
    distraction: []
  };

  let settings = {
    distractionLimitMinutes: 10,
    enableNudges: true,
    linkedinFeedBlocked: true
  };

  const inputDistractionLimit = document.getElementById('input-distraction-limit');
  const checkEnableNudges = document.getElementById('check-enable-nudges');
  const checkLinkedinShield = document.getElementById('check-linkedin-shield');

  const chipsAndroid = document.getElementById('chips-android');
  const chipsInvestments = document.getElementById('chips-investments');
  const chipsDistraction = document.getElementById('chips-distraction');

  const inputNewAndroid = document.getElementById('input-new-android');
  const btnAddAndroid = document.getElementById('btn-add-android');

  const inputNewInvestments = document.getElementById('input-new-investments');
  const btnAddInvestments = document.getElementById('btn-add-investments');

  const inputNewDistraction = document.getElementById('input-new-distraction');
  const btnAddDistraction = document.getElementById('btn-add-distraction');

  const btnSaveAll = document.getElementById('sm-save-all-btn');
  const btnResetDefaults = document.getElementById('btn-reset-defaults');
  const saveToast = document.getElementById('save-status-toast');

  function showToast(msg) {
    saveToast.textContent = msg;
    saveToast.classList.add('visible');
    setTimeout(() => {
      saveToast.classList.remove('visible');
    }, 2500);
  }

  function cleanDomain(input) {
    return input.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0];
  }

  function renderChips(container, list, onRemove) {
    container.innerHTML = '';
    list.forEach(domain => {
      const chip = document.createElement('span');
      chip.className = 'sm-chip';
      chip.innerHTML = `
        <span>${domain}</span>
        <button class="sm-chip-remove" title="Remove">&times;</button>
      `;
      chip.querySelector('.sm-chip-remove').addEventListener('click', () => {
        onRemove(domain);
      });
      container.appendChild(chip);
    });
  }

  function renderAll() {
    inputDistractionLimit.value = settings.distractionLimitMinutes || 10;
    checkEnableNudges.checked = settings.enableNudges !== false;
    checkLinkedinShield.checked = settings.linkedinFeedBlocked !== false;

    renderChips(chipsAndroid, categories.goal_android, (dom) => {
      categories.goal_android = categories.goal_android.filter(d => d !== dom);
      renderAll();
    });

    renderChips(chipsInvestments, categories.goal_investments, (dom) => {
      categories.goal_investments = categories.goal_investments.filter(d => d !== dom);
      renderAll();
    });

    renderChips(chipsDistraction, categories.distraction, (dom) => {
      categories.distraction = categories.distraction.filter(d => d !== dom);
      renderAll();
    });
  }

  function loadData() {
    chrome.runtime.sendMessage({ action: 'GET_CATEGORIES_AND_SETTINGS' }, (res) => {
      if (chrome.runtime.lastError || !res) return;
      categories = res.categories || categories;
      settings = res.settings || settings;
      renderAll();
    });
  }

  function addDomain(inputElem, categoryKey) {
    const raw = inputElem.value;
    const cleaned = cleanDomain(raw);
    if (!cleaned) return;

    if (!categories[categoryKey].includes(cleaned)) {
      categories[categoryKey].push(cleaned);
      inputElem.value = '';
      renderAll();
    }
  }

  btnAddAndroid.addEventListener('click', () => addDomain(inputNewAndroid, 'goal_android'));
  inputNewAndroid.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') addDomain(inputNewAndroid, 'goal_android');
  });

  btnAddInvestments.addEventListener('click', () => addDomain(inputNewInvestments, 'goal_investments'));
  inputNewInvestments.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') addDomain(inputNewInvestments, 'goal_investments');
  });

  btnAddDistraction.addEventListener('click', () => addDomain(inputNewDistraction, 'distraction'));
  inputNewDistraction.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') addDomain(inputNewDistraction, 'distraction');
  });

  btnSaveAll.addEventListener('click', () => {
    settings.distractionLimitMinutes = parseInt(inputDistractionLimit.value, 10) || 10;
    settings.enableNudges = checkEnableNudges.checked;
    settings.linkedinFeedBlocked = checkLinkedinShield.checked;

    chrome.runtime.sendMessage({
      action: 'SAVE_CATEGORIES_AND_SETTINGS',
      payload: { categories, settings }
    }, () => {
      showToast('Settings saved successfully!');
    });
  });

  btnResetDefaults.addEventListener('click', () => {
    if (confirm('Reset all categories and rules to default values?')) {
      chrome.storage.local.remove(['categories', 'settings'], () => {
        loadData();
        showToast('Reset to defaults.');
      });
    }
  });

  loadData();
});
