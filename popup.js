const SITTING_TIME = 45 * 60; // 45 minutes in seconds
const STANDING_TIME = 20 * 60; // 20 minutes in seconds
let currentTime = SITTING_TIME;
let isStanding = false;
let interval;
let isPaused = false;
let lastUpdateTime = Date.now();
let updateInterval;
let initialTime; // To track the current timer's initial value for progress bar

// DOM elements
const timerEl = document.getElementById('timer');
const actionEl = document.getElementById('currentAction');
const nextActionEl = document.getElementById('nextAction');
const startBtn = document.getElementById('startBtn');
const pauseBtn = document.getElementById('pauseBtn');
const resetBtn = document.getElementById('resetBtn');
const progressBar = document.getElementById('progressBar');

// Load saved state when popup opens
document.addEventListener('DOMContentLoaded', function() {
  chrome.storage.local.get(['currentTime', 'isStanding', 'isRunning', 'isPaused', 'lastUpdateTime'], function(result) {
    if (result.currentTime !== undefined) {
      currentTime = result.currentTime;
      isStanding = result.isStanding || false;
      isPaused = result.isPaused || false;

// If timer is running but not paused, calculate elapsed time since last update
      if (result.isRunning && !isPaused && result.lastUpdateTime) {
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

      if (result.isRunning && !isPaused) {
        startTimer();
        startBtn.disabled = true;
      } else if (result.isRunning && isPaused) {
        pauseBtn.innerHTML = `
<svg class="button-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
<path d="M8 5v14l11-7z"/>
</svg>
Resume
`;
        pauseBtn.classList.add('paused');
        startBtn.disabled = true;
      } else {
        pauseBtn.disabled = true;
      }
    } else {
      pauseBtn.disabled = true;
    }
  });

// Set up polling to sync with background timer
  updateInterval = setInterval(syncWithBackground, 1000);
});

// Clean up when popup closes
window.addEventListener('unload', function() {
  clearInterval(interval);
  clearInterval(updateInterval);

// Update the last update time when popup closes
  if (!isPaused) {
    chrome.storage.local.set({
      lastUpdateTime: Date.now()
    });
  }
});

// Sync with background timer
function syncWithBackground() {
  chrome.storage.local.get(['currentTime', 'isStanding', 'isRunning', 'isPaused'], function(result) {
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
  });
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
    actionEl.textContent = 'STAND UP!';
    actionEl.className = 'action standing';
    nextActionEl.textContent = `Next: Sit down in ${formatTime(currentTime)}`;
  } else {
    actionEl.textContent = 'SIT DOWN';
    actionEl.className = 'action sitting';
    nextActionEl.textContent = `Next: Stand up in ${formatTime(currentTime)}`;
  }
}

// Update progress bar
function updateProgressBar() {
  const totalTime = isStanding ? STANDING_TIME : SITTING_TIME;
  const percentage = (currentTime / totalTime) * 100;
  progressBar.style.width = `${percentage}%`;
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

// Show notification
    chrome.runtime.sendMessage({
      action: 'showNotification',
      title: isStanding ? 'Time to STAND UP!' : 'Time to SIT DOWN',
      message: isStanding ? 'Stand for 20 minutes' : 'Sit for 45 minutes'
    });
  }
}

// Start timer
function startTimer() {
  clearInterval(interval);
  interval = setInterval(timerTick, 1000);
  startBtn.disabled = true;
  pauseBtn.disabled = false;
  pauseBtn.innerHTML = `
<svg class="button-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
<path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>
</svg>
Pause
`;
  pauseBtn.classList.remove('paused');
  isPaused = false;
  lastUpdateTime = Date.now();
  initialTime = isStanding ? STANDING_TIME : SITTING_TIME;

// Inform background script that timer is running
  chrome.runtime.sendMessage({
    action: 'timerStarted',
    currentTime: currentTime,
    isStanding: isStanding
  });

  saveState(true, false);
}

// Pause timer
function pauseTimer() {
  if (isPaused) {
    interval = setInterval(timerTick, 1000);
    pauseBtn.innerHTML = `
<svg class="button-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
<path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>
</svg>
Pause
`;
    pauseBtn.classList.remove('paused');
    isPaused = false;
    lastUpdateTime = Date.now();

// Inform background script to resume
    chrome.runtime.sendMessage({
      action: 'timerResumed',
      currentTime: currentTime,
      isStanding: isStanding
    });
  } else {
    clearInterval(interval);
    pauseBtn.innerHTML = `
<svg class="button-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
<path d="M8 5v14l11-7z"/>
</svg>
Resume
`;
    pauseBtn.classList.add('paused');
    isPaused = true;

// Inform background script to pause
    chrome.runtime.sendMessage({
      action: 'timerPaused'
    });
  }

  saveState(true, isPaused);
}

// Reset timer
function resetTimer() {
  clearInterval(interval);
  isStanding = false;
  currentTime = SITTING_TIME;
  initialTime = SITTING_TIME;
  updateTimer();
  updateProgressBar();
  startBtn.disabled = false;
  pauseBtn.disabled = true;
  pauseBtn.innerHTML = `
<svg class="button-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
<path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>
</svg>
Pause
`;
  pauseBtn.classList.remove('paused');
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
    lastUpdateTime: isPaused ? null : Date.now()
  });
}

// Event listeners
startBtn.addEventListener('click', startTimer);
pauseBtn.addEventListener('click', pauseTimer);
resetBtn.addEventListener('click', resetTimer);
