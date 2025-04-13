// Timer variables
let SITTING_TIME = 45 * 60; // 45 minutes in seconds (default)
let STANDING_TIME = 20 * 60; // 20 minutes in seconds (default)
let currentTime = SITTING_TIME;
let isStanding = false;
let interval;
let isPaused = false;
let lastUpdateTime = Date.now();
let updateInterval;
let initialTime; // To track the current timer's initial value for progress bar

// DOM elements - declared as variables that will be initialized once DOM is loaded
let timerEl;
let actionEl;
let nextActionEl;
let startPauseBtn;
let resetBtn;
let progressBar;
let sitTimeDisplay;
let standTimeDisplay;
let cycleDisplay;
let settingsBtn;
let mainView;
let settingsView;
let saveSettingsBtn;
let cancelSettingsBtn;
let sitTimeInput;
let standTimeInput;
let desktopNotificationsEnabledCheckbox;
let browserPopupEnabledCheckbox;
let soundEnabledCheckbox;

let switchModeBtn;
let switchModeText;

let isRunning = false;

// Load saved state when popup opens
document.addEventListener('DOMContentLoaded', function () {
  // Initialize DOM elements
  timerEl = document.getElementById('timer');
  actionEl = document.getElementById('currentAction');
  startPauseBtn = document.getElementById('startPauseBtn');
  resetBtn = document.getElementById('resetBtn');
  progressBar = document.getElementById('progressBar');
  sitTimeDisplay = document.getElementById('sitTimeDisplay');
  standTimeDisplay = document.getElementById('standTimeDisplay');
  cycleDisplay = document.getElementById('cycleDisplay');
  settingsBtn = document.getElementById('settingsBtn');
  mainView = document.getElementById('mainView');
  settingsView = document.getElementById('settingsView');
  saveSettingsBtn = document.getElementById('saveSettingsBtn');
  cancelSettingsBtn = document.getElementById('cancelSettingsBtn');
  sitTimeInput = document.getElementById('sitTimeInput');
  standTimeInput = document.getElementById('standTimeInput');
  desktopNotificationsEnabledCheckbox = document.getElementById('desktopNotificationsEnabled');
  browserPopupEnabledCheckbox = document.getElementById('browserPopupEnabled');
  soundEnabledCheckbox = document.getElementById('soundEnabled');
  switchModeBtn = document.getElementById('switchModeBtn');
  switchModeText = document.getElementById('switchModeText');

  // Request notification permission right away
  requestNotificationPermission();

  // Set up the number input controls
  setupNumberInputs();

  // Load preferences
  loadPreferences();

  // Load saved timer state
  chrome.storage.local.get(
    ['currentTime', 'isStanding', 'isRunning', 'isPaused', 'lastUpdateTime'],
    function (result) {
      if (result.currentTime !== undefined) {
        currentTime = result.currentTime;
        isStanding = result.isStanding || false;
        isPaused = result.isPaused || false;
        isRunning = result.isRunning || false;

        // If timer is running but not paused, calculate elapsed time since last update
        if (result.isRunning && !result.isPaused && result.lastUpdateTime) {
          const now = Date.now();
          const elapsedSeconds = Math.floor((now - result.lastUpdateTime) / 1000);

          if (elapsedSeconds > 0 && elapsedSeconds < currentTime) {
            currentTime -= elapsedSeconds;
          } else if (elapsedSeconds >= currentTime) {
            // Time expired while popup was closed
            isStanding = !isStanding;
            currentTime = isStanding ? STANDING_TIME : SITTING_TIME;
          }
        }

        // Set initial time for progress bar
        initialTime = isStanding ? STANDING_TIME : SITTING_TIME;

        updateTimer();
        updateProgressBar();

        if (result.isRunning && !result.isPaused) {
          isRunning = true;
          isPaused = false;
          startPauseBtn.classList.add('paused');
          startPauseBtn.innerHTML = '<span class="button-icon">⏸</span>Pause';
          // Start interval for UI updates without starting a new timer
          interval = setInterval(timerTick, 1000);
        } else if (result.isRunning && result.isPaused) {
          // This is either a paused timer or a completed timer waiting for user action
          isRunning = false; // Set to false so the click handler will start it
          isPaused = true;
          startPauseBtn.classList.remove('paused');
          startPauseBtn.innerHTML = '<span class="button-icon">▶</span>Start';
          resetBtn.disabled = false;
        } else {
          isRunning = false;
          isPaused = false;
          resetBtn.disabled = true;
          startPauseBtn.classList.remove('paused');
          startPauseBtn.innerHTML = '<span class="button-icon">▶</span>Start';
        }
      } else {
        resetBtn.disabled = true;
      }
    }
  );

  // Set up event listeners
  startPauseBtn.addEventListener('click', () => {
    if (!isRunning || isPaused) {
      // Start or resume the timer
      isRunning = true;
      isPaused = false;
      startPauseBtn.classList.add('paused');
      startPauseBtn.innerHTML = '<span class="button-icon">⏸</span>Pause';
      startTimer();
    } else {
      // Pause the timer
      isRunning = false;
      isPaused = true;
      startPauseBtn.classList.remove('paused');
      startPauseBtn.innerHTML = '<span class="button-icon">▶</span>Start';
      pauseTimer();
    }
  });

  resetBtn.addEventListener('click', () => {
    isRunning = false;
    startPauseBtn.classList.remove('paused');
    startPauseBtn.innerHTML = '<span class="button-icon">▶</span>Start';
    resetTimer();
  });

  switchModeBtn.addEventListener('click', switchMode);

  // Settings button click
  settingsBtn.addEventListener('click', function () {
    mainView.classList.add('hidden');
    settingsView.classList.remove('hidden');
  });

  // Save settings button click
  saveSettingsBtn.addEventListener('click', function () {
    const newSitTime = parseInt(sitTimeInput.value);
    const newStandTime = parseInt(standTimeInput.value);

    // Validate inputs
    if (newSitTime < 1 || newSitTime > 120 || newStandTime < 1 || newStandTime > 60) {
      alert('Please enter valid times: Sitting (1-120 minutes) and Standing (1-60 minutes)');
      return;
    }

    // Get checkbox values
    const newDesktopNotificationsEnabled = desktopNotificationsEnabledCheckbox.checked;
    const newBrowserPopupEnabled = browserPopupEnabledCheckbox.checked;
    const newSoundEnabled = soundEnabledCheckbox.checked;

    // Save the new settings
    chrome.storage.local.set(
      {
        sittingTime: newSitTime,
        standingTime: newStandTime,
        desktopNotificationsEnabled: newDesktopNotificationsEnabled,
        browserPopupEnabled: newBrowserPopupEnabled,
        soundEnabled: newSoundEnabled,
      },
      function () {
        // Update the global variables
        SITTING_TIME = newSitTime * 60;
        STANDING_TIME = newStandTime * 60;

        // Update cycle display text
        updateCycleDisplay();

        // Close settings view
        settingsView.classList.add('hidden');
        mainView.classList.remove('hidden');
      }
    );
  });

  // Cancel settings button click
  cancelSettingsBtn.addEventListener('click', function () {
    // Reset input values to current settings
    chrome.storage.local.get(
      ['sittingTime', 'standingTime', 'desktopNotificationsEnabled', 'browserPopupEnabled', 'soundEnabled'],
      function (result) {
        sitTimeInput.value = result.sittingTime || 45;
        standTimeInput.value = result.standingTime || 20;
        desktopNotificationsEnabledCheckbox.checked = result.desktopNotificationsEnabled !== undefined ? 
          result.desktopNotificationsEnabled : true;
        browserPopupEnabledCheckbox.checked = result.browserPopupEnabled !== undefined ? 
          result.browserPopupEnabled : true;
        soundEnabledCheckbox.checked = result.soundEnabled !== undefined ? 
          result.soundEnabled : true;

        // Close settings view
        settingsView.classList.add('hidden');
        mainView.classList.remove('hidden');
      }
    );
  });

  // Set up polling to sync with background timer
  updateInterval = setInterval(syncWithBackground, 1000);

  // Listen for messages from notification popup
  chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
    if (request.action === 'playSound') {
      playAlertSound();
    }
    return true;
  });
});

// Request notification permission
function requestNotificationPermission() {
  if (chrome.notifications) {
    console.log('Notifications API available');
  } else {
    console.log('Notifications API not available');
    try {
      // Fallback to Web Notifications API
      if (Notification && Notification.permission !== 'granted') {
        Notification.requestPermission();
      }
    } catch (error) {
      console.error('Error requesting notification permission:', error);
    }
  }
}

// Load preferences
function loadPreferences() {
  chrome.storage.local.get(
    [
      'sittingTime',
      'standingTime',
      'desktopNotificationsEnabled',
      'browserPopupEnabled',
      'soundEnabled',
    ],
    function (result) {
      // Load timer durations
      if (result.sittingTime) {
        SITTING_TIME = result.sittingTime * 60; // Convert minutes to seconds
        sitTimeInput.value = result.sittingTime;
      } else {
        // Set default values if not found
        SITTING_TIME = 45 * 60;
        sitTimeInput.value = 45;
      }

      if (result.standingTime) {
        STANDING_TIME = result.standingTime * 60; // Convert minutes to seconds
        standTimeInput.value = result.standingTime;
      } else {
        // Set default values if not found
        STANDING_TIME = 20 * 60;
        standTimeInput.value = 20;
      }

      // Load notification preferences
      desktopNotificationsEnabledCheckbox.checked = result.desktopNotificationsEnabled !== undefined ? 
        result.desktopNotificationsEnabled : true;
      browserPopupEnabledCheckbox.checked = result.browserPopupEnabled !== undefined ? 
        result.browserPopupEnabled : true;
      soundEnabledCheckbox.checked = result.soundEnabled !== undefined ? 
        result.soundEnabled : true;

      // Update cycle display
      updateCycleDisplay();
    }
  );
}

// Update the cycle display text
function updateCycleDisplay() {
  const sitMinutes = SITTING_TIME / 60;
  const standMinutes = STANDING_TIME / 60;
  cycleDisplay.textContent = `Cycle: Sit for ${sitMinutes} minutes → Stand for ${standMinutes} minutes → Repeat`;
}

// Set up number input controls
function setupNumberInputs() {
  // Set up increment/decrement buttons for all number inputs
  document.querySelectorAll('.number-input').forEach(input => {
    const incrementBtn = input.querySelector('.increment');
    const decrementBtn = input.querySelector('.decrement');
    const numberInput = input.querySelector('input');

    incrementBtn.addEventListener('click', () => {
      const currentValue = parseInt(numberInput.value);
      const maxValue = parseInt(numberInput.getAttribute('max'));
      if (currentValue < maxValue) {
        numberInput.value = currentValue + 1;
      }
    });

    decrementBtn.addEventListener('click', () => {
      const currentValue = parseInt(numberInput.value);
      const minValue = parseInt(numberInput.getAttribute('min'));
      if (currentValue > minValue) {
        numberInput.value = currentValue - 1;
      }
    });
  });
}

// Clean up when popup closes
window.addEventListener('unload', function () {
  clearInterval(interval);
  clearInterval(updateInterval);

  // Update the last update time when popup closes
  if (!isPaused) {
    chrome.storage.local.set({
      lastUpdateTime: Date.now(),
    });
  }
});

// Sync with background timer
function syncWithBackground() {
  if (!isRunning || isPaused) {
    chrome.storage.local.get(
      ['currentTime', 'isStanding', 'isRunning', 'isPaused'],
      function (result) {
        if (result.isRunning && !result.isPaused) {
          // Only update the UI if values are different
          if (result.currentTime !== currentTime || result.isStanding !== isStanding) {
            currentTime = result.currentTime;
            isStanding = result.isStanding;
            // Update initialTime when mode changes
            if (isStanding && initialTime === SITTING_TIME) {
              initialTime = STANDING_TIME;
            } else if (!isStanding && initialTime === STANDING_TIME) {
              initialTime = SITTING_TIME;
            }
            updateTimer();
            updateProgressBar();
          }
        }
      }
    );
  }
}

// Format time function
function formatTime(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

// Update timer display
function updateTimer() {
  timerEl.textContent = formatTime(currentTime);
  if (isStanding) {
    timerEl.className = 'timer standing';
  } else {
    timerEl.className = 'timer sitting';
  }

  // Update switch button
  updateSwitchButton();
}

// Update progress bar
function updateProgressBar() {
  const totalTime = isStanding ? STANDING_TIME : SITTING_TIME;
  const percentage = (currentTime / totalTime) * 100;
  const circumference = 2 * Math.PI * 45; // 2πr where r = 45
  const offset = circumference - (percentage / 100) * circumference;
  
  const progressCircle = document.querySelector('.timer-progress');
  const progressPoint = document.querySelector('.progress-point');
  
  progressCircle.style.strokeDasharray = `${circumference} ${circumference}`;
  progressCircle.style.strokeDashoffset = offset;
  
  // Calculate rotation angle for the progress point
  const angle = (percentage / 100) * 360;
  progressPoint.style.transform = `rotate(${angle}deg)`;
}

// Show local notification
function showNotification(title, message) {
  if (!desktopNotificationsEnabledCheckbox.checked) return;

  // Try to use chrome.notifications API
  if (chrome.notifications) {
    try {
      chrome.notifications.create(
        'standSitReminder_' + Date.now(),
        {
          type: 'basic',
          iconUrl: 'images/icon128.png',
          title: title,
          message: message,
          priority: 2,
          requireInteraction: true,
        },
        function (notificationId) {
          console.log('Notification created with ID:', notificationId);
          if (chrome.runtime.lastError) {
            console.error('Notification error:', chrome.runtime.lastError);
          }
        }
      );
    } catch (error) {
      console.error('Error showing notification:', error);
    }
  } else {
    // Fallback to regular Web Notifications
    if (Notification && Notification.permission === 'granted') {
      new Notification(title, {
        body: message,
        icon: 'images/icon128.png',
      });
    }
  }
}

// Play alert sound
function playAlertSound() {
  if (!soundEnabledCheckbox.checked) return;

  try {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.type = 'sine';
    oscillator.frequency.value = 800; // frequency in hertz
    gainNode.gain.value = 0.3; // volume control

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    oscillator.start();

    // Stop after 500ms
    setTimeout(function () {
      oscillator.stop();
      // Optional: close the audio context to free resources
      if (audioContext.state !== 'closed') {
        audioContext.close();
      }
    }, 500);

    console.log('Sound alert played successfully');
  } catch (error) {
    console.error('Error playing alert sound:', error);
  }
}

// Timer tick function
function timerTick() {
  if (currentTime > 0) {
    currentTime--;
    updateTimer();
    updateProgressBar();
    saveState();
  } else {
    // Switch between sitting and standing
    isStanding = !isStanding;
    currentTime = isStanding ? STANDING_TIME : SITTING_TIME;
    initialTime = currentTime; // Update initial time for new cycle
    updateTimer();
    updateProgressBar();
    saveState();

    // Show notification and play sound
    const title = isStanding ? 'Time to STAND UP!' : 'Time to SIT DOWN';
    const message = isStanding
      ? `Stand for ${STANDING_TIME / 60} minutes`
      : `Sit for ${SITTING_TIME / 60} minutes`;

    showNotification(title, message);
    playAlertSound();

    // Also send message to background script
    chrome.runtime.sendMessage({
      action: 'timerEnded',
      isStanding: isStanding,
      standingTime: STANDING_TIME,
      sittingTime: SITTING_TIME,
    });
  }
}

// Start timer
function startTimer() {
  clearInterval(interval);
  interval = setInterval(timerTick, 1000);
  resetBtn.disabled = false;
  isPaused = false;
  lastUpdateTime = Date.now();
  initialTime = isStanding ? STANDING_TIME : SITTING_TIME;

  // Check if this is a resume after a timer completion
  if (currentTime === initialTime) {
    // This is a new timer or a resumption after completion
    chrome.runtime.sendMessage({
      action: 'timerStarted',
      currentTime: currentTime,
      isStanding: isStanding,
    });
  } else {
    // This is resuming a paused timer
    chrome.runtime.sendMessage({
      action: 'timerResumed',
      currentTime: currentTime,
      isStanding: isStanding,
    });
  }

  saveState(true, false);
}

// Pause timer
function pauseTimer() {
  clearInterval(interval);
  startPauseBtn.classList.remove('paused');
  startPauseBtn.innerHTML = '<span class="button-icon">▶</span>Start';
  isPaused = true;
  lastUpdateTime = Date.now();

  // Inform background script to pause
  chrome.runtime.sendMessage({
    action: 'timerPaused',
  });

  saveState(true, true);
}

// Reset timer
function resetTimer() {
  clearInterval(interval);
  // Keep the current mode (standing or sitting)
  currentTime = isStanding ? STANDING_TIME : SITTING_TIME;
  initialTime = currentTime;
  updateTimer();
  updateProgressBar();
  startPauseBtn.disabled = false;
  resetBtn.disabled = true;
  startPauseBtn.classList.remove('paused');
  startPauseBtn.innerHTML = '<span class="button-icon">▶</span>Start';
  isPaused = false;

  // Inform background script that timer is reset
  chrome.runtime.sendMessage({ action: 'timerReset' });

  saveState(false, false);
}

// Save state to storage
function saveState(isRunning = true, isPaused = false) {
  chrome.storage.local.set({
    currentTime: currentTime,
    isStanding: isStanding,
    isRunning: isRunning,
    isPaused: isPaused,
    lastUpdateTime: isPaused ? null : Date.now(),
  });
}

function switchMode() {
  console.log('Switching mode from:', isStanding ? 'Standing' : 'Sitting');

  // Toggle standing/sitting mode
  isStanding = !isStanding;

  // Update the current time to the appropriate duration for the new mode
  currentTime = isStanding ? STANDING_TIME : SITTING_TIME;
  initialTime = currentTime;

  console.log('Mode switched to:', isStanding ? 'Standing' : 'Sitting');

  // Update UI
  updateTimer();
  updateProgressBar();
  updateSwitchButton();

  // Save state
  saveState(true, isPaused);

  // Inform background script
  chrome.runtime.sendMessage({
    action: 'modeSwitched',
    isStanding: isStanding,
    currentTime: currentTime,
  });
}

function updateSwitchButton() {
  if (!switchModeText) return; // Safety check

  // Show the opposite action of the current state
  switchModeText.textContent = isStanding ? ' SIT DOWN' : ' STAND UP';

  // Update button styling based on the next mode
  if (isStanding) {
    // Next mode would be sitting
    switchModeBtn.className = 'btn-switch btn-sitting';
  } else {
    // Next mode would be standing
    switchModeBtn.className = 'btn-switch btn-standing';
  }
}
