// Popup.js - Handles the extension popup UI and settings

document.addEventListener('DOMContentLoaded', async () => {
  // DOM Elements
  const elements = {
    hubspotKey: document.getElementById('hubspotKey'),
    dealPipeline: document.getElementById('dealPipeline'),
    dealStage: document.getElementById('dealStage'),
    refreshPipelines: document.getElementById('refreshPipelines'),
    autoSync: document.getElementById('autoSync'),
    notificationsEnabled: document.getElementById('notificationsEnabled'),
    useAiFormatting: document.getElementById('useAiFormatting'),
    openaiKey: document.getElementById('openaiKey'),
    openaiModel: document.getElementById('openaiModel'),
    aiSettingsGroup: document.getElementById('aiSettingsGroup'),
    modelSelectGroup: document.getElementById('modelSelectGroup'),
    costEstimate: document.getElementById('costEstimate'),
    saveSettings: document.getElementById('saveSettings'),
    testConnection: document.getElementById('testConnection'),
    clearData: document.getElementById('clearData'),
    clearLog: document.getElementById('clearLog'),
    toggleHubspotVisibility: document.getElementById('toggleHubspotVisibility'),
    toggleOpenaiVisibility: document.getElementById('toggleOpenaiVisibility'),
    statusDot: document.getElementById('statusDot'),
    statusText: document.getElementById('statusText'),
    statusDescription: document.getElementById('statusDescription'),
    syncCount: document.getElementById('syncCount'),
    lastSync: document.getElementById('lastSync'),
    activityLog: document.getElementById('activityLog'),
    toast: document.getElementById('toast'),
    toastMessage: document.getElementById('toastMessage')
  };

  // Store pipelines data globally
  let pipelinesData = [];

  // Load saved settings
  await loadSettings();

  // Load statistics
  await loadStatistics();

  // Load activity log
  await loadActivityLog();

  // Check connection status
  await checkConnectionStatus();

  // Event Listeners
  elements.saveSettings.addEventListener('click', handleSaveSettings);
  elements.testConnection.addEventListener('click', handleTestConnection);
  elements.clearData.addEventListener('click', handleClearData);
  elements.clearLog.addEventListener('click', handleClearLog);
  elements.toggleHubspotVisibility.addEventListener('click', () => toggleKeyVisibility('hubspotKey'));
  elements.toggleOpenaiVisibility.addEventListener('click', () => toggleKeyVisibility('openaiKey'));
  elements.refreshPipelines.addEventListener('click', loadPipelines);

  // AI formatting toggle
  elements.useAiFormatting.addEventListener('change', handleAiFormattingToggle);

  // Model selection change
  elements.openaiModel.addEventListener('change', updateCostEstimate);

  // Pipeline change - populate stages
  elements.dealPipeline.addEventListener('change', handlePipelineChange);

  // Auto-save on checkbox change
  elements.autoSync.addEventListener('change', handleSaveSettings);
  elements.notificationsEnabled.addEventListener('change', handleSaveSettings);

  // Functions
  async function loadSettings() {
    try {
      const settings = await chrome.storage.sync.get({
        hubspotKey: '',
        dealPipeline: '',
        dealStage: '',
        autoSync: true,
        notificationsEnabled: true,
        useAiFormatting: false,
        openaiKey: '',
        openaiModel: 'gpt-4o-mini'
      });

      elements.hubspotKey.value = settings.hubspotKey;
      elements.autoSync.checked = settings.autoSync;
      elements.notificationsEnabled.checked = settings.notificationsEnabled;
      elements.useAiFormatting.checked = settings.useAiFormatting;
      elements.openaiKey.value = settings.openaiKey;
      elements.openaiModel.value = settings.openaiModel;

      // Show/hide AI settings based on checkbox
      toggleAiSettingsVisibility(settings.useAiFormatting);

      // Update cost estimate
      updateCostEstimate();

      // Load pipelines and then set saved values
      await loadPipelines();

      // Set saved pipeline and stage after pipelines are loaded
      if (settings.dealPipeline) {
        elements.dealPipeline.value = settings.dealPipeline;
        // Trigger pipeline change to populate stages
        await handlePipelineChange();
        if (settings.dealStage) {
          elements.dealStage.value = settings.dealStage;
        }
      }
    } catch (error) {
      console.error('Error loading settings:', error);
      showToast('Failed to load settings', 'error');
    }
  }

  async function loadPipelines() {
    const settings = await chrome.storage.sync.get('hubspotKey');

    if (!settings.hubspotKey) {
      elements.dealPipeline.innerHTML = '<option value="">Enter API key and save first</option>';
      elements.dealStage.innerHTML = '<option value="">Enter API key and save first</option>';
      showToast('Please enter your HubSpot API key and click Save Settings', 'warning');
      return;
    }

    try {
      elements.refreshPipelines.textContent = 'Loading...';
      elements.refreshPipelines.disabled = true;
      elements.dealPipeline.innerHTML = '<option value="">Loading pipelines...</option>';
      elements.dealStage.innerHTML = '<option value="">Select a pipeline first</option>';

      const response = await chrome.runtime.sendMessage({
        action: 'fetchPipelines',
        apiKey: settings.hubspotKey
      });

      if (response.success) {
        pipelinesData = response.pipelines;
        populatePipelineDropdown();

        // Automatically populate stages for the first pipeline (or saved pipeline)
        if (pipelinesData.length > 0 && elements.dealPipeline.value) {
          await handlePipelineChange();
        }

        showToast(`Loaded ${pipelinesData.length} pipeline(s)`, 'success');
      } else {
        showToast(`Failed to load pipelines: ${response.error}`, 'error');
        elements.dealPipeline.innerHTML = '<option value="">Failed to load - check API key</option>';
      }
    } catch (error) {
      console.error('Error loading pipelines:', error);
      showToast('Failed to load pipelines', 'error');
      elements.dealPipeline.innerHTML = '<option value="">Error loading pipelines</option>';
    } finally {
      elements.refreshPipelines.textContent = 'Refresh Pipelines';
      elements.refreshPipelines.disabled = false;
    }
  }

  function populatePipelineDropdown() {
    elements.dealPipeline.innerHTML = '';

    if (pipelinesData.length === 0) {
      elements.dealPipeline.innerHTML = '<option value="">No pipelines found</option>';
      return;
    }

    pipelinesData.forEach(pipeline => {
      const option = document.createElement('option');
      option.value = pipeline.id;
      option.textContent = pipeline.label;
      elements.dealPipeline.appendChild(option);
    });
  }

  async function handlePipelineChange() {
    const selectedPipelineId = elements.dealPipeline.value;

    console.log('[Popup] Pipeline changed to:', selectedPipelineId);
    console.log('[Popup] Available pipelines:', pipelinesData);

    if (!selectedPipelineId) {
      elements.dealStage.innerHTML = '<option value="">Select a pipeline first</option>';
      return;
    }

    // Convert both to strings for comparison since select values are always strings
    const selectedPipeline = pipelinesData.find(p => String(p.id) === String(selectedPipelineId));

    console.log('[Popup] Found pipeline:', selectedPipeline);

    if (!selectedPipeline) {
      elements.dealStage.innerHTML = '<option value="">Pipeline not found</option>';
      console.error('[Popup] Pipeline not found with ID:', selectedPipelineId);
      return;
    }

    if (!selectedPipeline.stages || selectedPipeline.stages.length === 0) {
      elements.dealStage.innerHTML = '<option value="">No stages found</option>';
      console.warn('[Popup] No stages in pipeline:', selectedPipeline.label);
      return;
    }

    elements.dealStage.innerHTML = '';

    console.log('[Popup] Populating', selectedPipeline.stages.length, 'stages');

    selectedPipeline.stages.forEach(stage => {
      const option = document.createElement('option');
      option.value = stage.id;
      option.textContent = stage.label;
      elements.dealStage.appendChild(option);
    });

    console.log('[Popup] Stages populated successfully');
  }

  async function loadStatistics() {
    try {
      const stats = await chrome.storage.local.get({
        syncCount: 0,
        lastSyncTime: null
      });

      elements.syncCount.textContent = stats.syncCount;

      if (stats.lastSyncTime) {
        const date = new Date(stats.lastSyncTime);
        elements.lastSync.textContent = formatRelativeTime(date);
      } else {
        elements.lastSync.textContent = 'Never';
      }
    } catch (error) {
      console.error('Error loading statistics:', error);
    }
  }

  async function checkConnectionStatus() {
    try {
      const settings = await chrome.storage.sync.get('hubspotKey');

      if (!settings.hubspotKey) {
        updateStatus('inactive', 'Not Configured', 'Please add your HubSpot API key');
        return;
      }

      updateStatus('active', 'Ready', 'Extension is active and monitoring');
    } catch (error) {
      console.error('Error checking status:', error);
      updateStatus('error', 'Error', 'Failed to check connection');
    }
  }

  async function handleSaveSettings() {
    const saveBtn = elements.saveSettings;
    const originalText = saveBtn.textContent;

    try {
      saveBtn.classList.add('loading');
      saveBtn.disabled = true;

      // Get the old API key to detect if it's a new one
      const oldSettings = await chrome.storage.sync.get('hubspotKey');
      const oldApiKey = oldSettings.hubspotKey || '';

      const settings = {
        hubspotKey: elements.hubspotKey.value.trim(),
        dealPipeline: elements.dealPipeline.value,
        dealStage: elements.dealStage.value,
        autoSync: elements.autoSync.checked,
        notificationsEnabled: elements.notificationsEnabled.checked,
        useAiFormatting: elements.useAiFormatting.checked,
        openaiKey: elements.openaiKey.value.trim(),
        openaiModel: elements.openaiModel.value
      };

      // Validate HubSpot API key format
      if (settings.hubspotKey && !isValidHubSpotKey(settings.hubspotKey)) {
        showToast('Invalid HubSpot API key format', 'error');
        return;
      }

      // Check if API key was just added or changed
      const apiKeyChanged = oldApiKey !== settings.hubspotKey && settings.hubspotKey;

      // If API key was just added/changed, skip pipeline/stage validation and load pipelines
      if (apiKeyChanged) {
        console.log('[Popup] API key added/changed, loading pipelines...');

        // Save the API key first
        await chrome.storage.sync.set({
          hubspotKey: settings.hubspotKey,
          autoSync: settings.autoSync,
          notificationsEnabled: settings.notificationsEnabled,
          useAiFormatting: settings.useAiFormatting,
          openaiKey: settings.openaiKey,
          openaiModel: settings.openaiModel
        });

        showToast('API key saved! Loading pipelines...', 'success');

        // Load pipelines with the new API key
        await loadPipelines();

        showToast('Pipelines loaded! Now select your pipeline and stage, then save again.', 'success');
        await checkConnectionStatus();
        return; // Exit early, user needs to select pipeline/stage and save again
      }

      // Normal save flow - validate pipeline and stage
      if (!settings.dealPipeline) {
        showToast('Please select a deal pipeline', 'error');
        return;
      }

      if (!settings.dealStage) {
        showToast('Please select a deal stage', 'error');
        return;
      }

      // Validate OpenAI settings if AI formatting is enabled
      if (settings.useAiFormatting) {
        if (!settings.openaiKey) {
          showToast('OpenAI API key is required when AI formatting is enabled', 'error');
          return;
        }
        if (!isValidOpenAIKey(settings.openaiKey)) {
          showToast('Invalid OpenAI API key format', 'error');
          return;
        }
      }

      await chrome.storage.sync.set(settings);

      showToast('Settings saved successfully', 'success');
      await checkConnectionStatus();
    } catch (error) {
      console.error('Error saving settings:', error);
      showToast('Failed to save settings', 'error');
    } finally {
      saveBtn.classList.remove('loading');
      saveBtn.disabled = false;
    }
  }

  async function handleTestConnection(e) {
    e.preventDefault();

    const testBtn = elements.testConnection;
    const originalText = testBtn.textContent;

    try {
      testBtn.textContent = 'Testing...';
      testBtn.style.pointerEvents = 'none';

      const settings = await chrome.storage.sync.get('hubspotKey');

      if (!settings.hubspotKey) {
        showToast('Please add your HubSpot API key first', 'warning');
        return;
      }

      // Send message to background script to test connection
      const response = await chrome.runtime.sendMessage({
        action: 'testConnection',
        apiKey: settings.hubspotKey
      });

      if (response.success) {
        showToast('Connection successful!', 'success');
        updateStatus('active', 'Connected', 'HubSpot API connection verified');
      } else {
        showToast(`Connection failed: ${response.error}`, 'error');
        updateStatus('error', 'Connection Failed', response.error);
      }
    } catch (error) {
      console.error('Error testing connection:', error);
      showToast('Failed to test connection', 'error');
    } finally {
      testBtn.textContent = originalText;
      testBtn.style.pointerEvents = 'auto';
    }
  }

  async function handleClearData(e) {
    e.preventDefault();

    if (!confirm('Are you sure you want to clear all statistics? This cannot be undone.')) {
      return;
    }

    try {
      await chrome.storage.local.set({
        syncCount: 0,
        lastSyncTime: null,
        syncHistory: []
      });

      await loadStatistics();
      showToast('Statistics cleared', 'success');
    } catch (error) {
      console.error('Error clearing data:', error);
      showToast('Failed to clear data', 'error');
    }
  }

  async function handleClearLog(e) {
    e.preventDefault();

    if (!confirm('Clear all activity logs?')) {
      return;
    }

    try {
      await chrome.storage.local.set({ activityLog: [] });
      await loadActivityLog();
      showToast('Activity log cleared', 'success');
    } catch (error) {
      console.error('Error clearing log:', error);
      showToast('Failed to clear log', 'error');
    }
  }

  async function loadActivityLog() {
    try {
      const data = await chrome.storage.local.get({ activityLog: [] });
      const log = data.activityLog || [];

      if (log.length === 0) {
        elements.activityLog.innerHTML = `
          <div class="activity-empty">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/>
              <path d="M12 6v6l4 2" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
            </svg>
            <p>No activity yet</p>
            <span>Sync logs will appear here when leads are synced</span>
          </div>
        `;
        return;
      }

      // Show most recent first
      const sortedLog = log.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

      elements.activityLog.innerHTML = sortedLog.map(item => createActivityItem(item)).join('');
    } catch (error) {
      console.error('Error loading activity log:', error);
    }
  }

  function createActivityItem(item) {
    const statusClass = item.success ? 'success' : 'error';
    const statusText = item.success ? 'Synced successfully' : `Failed: ${item.error || 'Unknown error'}`;
    const time = formatRelativeTime(new Date(item.timestamp));

    const hubspotLink = item.contactId
      ? `<a href="https://app.hubspot.com/contacts/${item.portalId || ''}/contact/${item.contactId}" target="_blank" class="activity-hubspot-link">
           View in HubSpot →
         </a>`
      : '';

    return `
      <div class="activity-item ${statusClass}">
        <div class="activity-header-row">
          <div class="activity-email">${item.email}</div>
          <div class="activity-time">${time}</div>
        </div>
        <div class="activity-status ${statusClass}">
          <span class="activity-status-icon"></span>
          <span>${statusText}</span>
        </div>
        ${item.details ? `<div class="activity-details">${item.details}</div>` : ''}
        ${hubspotLink}
      </div>
    `;
  }

  async function addActivityLogEntry(entry) {
    try {
      const data = await chrome.storage.local.get({ activityLog: [] });
      const log = data.activityLog || [];

      log.unshift(entry);

      // Keep only last 50 entries
      if (log.length > 50) {
        log.splice(50);
      }

      await chrome.storage.local.set({ activityLog: log });
      await loadActivityLog();
    } catch (error) {
      console.error('Error adding activity log entry:', error);
    }
  }

  function toggleKeyVisibility(inputId) {
    const input = document.getElementById(inputId);
    const isPassword = input.type === 'password';
    input.type = isPassword ? 'text' : 'password';
  }

  function handleAiFormattingToggle() {
    const isEnabled = elements.useAiFormatting.checked;
    toggleAiSettingsVisibility(isEnabled);
  }

  function toggleAiSettingsVisibility(show) {
    elements.aiSettingsGroup.style.display = show ? 'block' : 'none';
    elements.modelSelectGroup.style.display = show ? 'block' : 'none';
  }

  function updateCostEstimate() {
    const model = elements.openaiModel.value;
    const costData = {
      'gpt-4o-mini': { cost: '$0.0006', desc: 'Recommended - Best balance of cost and quality' },
      'gpt-4o': { cost: '$0.0100', desc: 'Highest quality - 16x more expensive' },
      'gpt-3.5-turbo': { cost: '$0.0010', desc: 'Cheaper option - Good quality' }
    };

    const data = costData[model] || costData['gpt-4o-mini'];
    elements.costEstimate.innerHTML = `
      Estimated cost: <strong>~${data.cost} per contact</strong><br>
      <span style="font-size: 11px; color: var(--text-tertiary);">${data.desc}</span>
    `;
  }

  function updateStatus(type, text, description) {
    elements.statusDot.className = 'status-dot';
    if (type === 'active') {
      elements.statusDot.classList.add('active');
    } else if (type === 'error') {
      elements.statusDot.classList.add('error');
    }

    elements.statusText.textContent = text;
    elements.statusDescription.textContent = description;
  }

  function showToast(message, type = 'info') {
    elements.toastMessage.textContent = message;
    elements.toast.className = 'toast show';

    if (type !== 'info') {
      elements.toast.classList.add(type);
    }

    setTimeout(() => {
      elements.toast.classList.remove('show');
      setTimeout(() => {
        elements.toast.className = 'toast';
      }, 300);
    }, 3000);
  }

  function isValidHubSpotKey(key) {
    // HubSpot private app tokens start with "pat-na1-" or "pat-eu1-"
    return key.startsWith('pat-') && key.length > 20;
  }

  function isValidOpenAIKey(key) {
    // OpenAI API keys start with "sk-" or "sk-proj-"
    return (key.startsWith('sk-') || key.startsWith('sk-proj-')) && key.length > 20;
  }

  function formatRelativeTime(date) {
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;

    return date.toLocaleDateString();
  }

  // Expose functions for message listener
  window.addActivityLogEntry = addActivityLogEntry;
  window.loadStatistics = loadStatistics;
  window.loadActivityLog = loadActivityLog;
});

// Listen for messages from background script
chrome.runtime.onMessage.addListener(async (request, sender, sendResponse) => {
  if (request.action === 'syncComplete') {
    // Add entry to activity log
    if (window.addActivityLogEntry) {
      await window.addActivityLogEntry(request.data);
    }

    // Reload statistics
    if (window.loadStatistics) {
      await window.loadStatistics();
    }

    // Reload activity log
    if (window.loadActivityLog) {
      await window.loadActivityLog();
    }
  }
});
