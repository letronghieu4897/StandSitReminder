const SITTING_TIME = 45 * 60; // 45 minutes in seconds
const STANDING_TIME = 20 * 60; // 20 minutes in seconds

// Initialize variables
let currentTime = SITTING_TIME;
let isStanding = false;
let isRunning = false;
let isPaused = false;
let timerInterval = null;
let lastTickTime = null;

// Set up alarm listener
chrome.alarms.onAlarm.addListener(function(alarm) {
  if (alarm.name === 'standsitTimer') {
    backgroundTimerTick();
  }
});

// Handle messages from popup
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  if (request.action === 'timerStarted') {
// Start the background timer
    currentTime = request.currentTime;
    isStanding = request.isStanding;
    isRunning = true;
    isPaused = false;
    startBackgroundTimer();
  }
  else if (request.action === 'timerPaused') {
// Pause the background timer
    isPaused = true;
    chrome.alarms.clear('standsitTimer');
  }
  else if (request.action === 'timerResumed') {
// Resume the background timer
    currentTime = request.currentTime;
    isStanding = request.isStanding;
    isPaused = false;
    startBackgroundTimer();
  }
  else if (request.action === 'timerReset') {
// Clear the background timer
    stopBackgroundTimer();
  }
  else if (request.action === 'showNotification') {
// Show notification
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'images/icon128.png',
      title: request.title,
      message: request.message,
      priority: 2
    });
  }

// Always return true for async response
  return true;
});

// Start background timer using alarms
function startBackgroundTimer() {
// Clear any existing alarms
  chrome.alarms.clear('standsitTimer');

// Set last tick time
  lastTickTime = Date.now();

// Create a new alarm that fires every second
  chrome.alarms.create('standsitTimer', { periodInMinutes: 0.05 }); // Fire every 3 seconds

// Update state
  chrome.storage.local.set({
    isRunning: true,
    isPaused: false,
    lastUpdateTime: Date.now()
  });
}

// Stop background timer
function stopBackgroundTimer() {
  chrome.alarms.clear('standsitTimer');

// Reset state
  chrome.storage.local.set({
    currentTime: SITTING_TIME,
    isStanding: false,
    isRunning: false,
    isPaused: false,
    lastUpdateTime: null
  });

  isRunning = false;
  isPaused = false;
  currentTime = SITTING_TIME;
  isStanding = false;
}

// Background timer tick function
function backgroundTimerTick() {
  if (!isRunning || isPaused) return;

// Load current state from storage
  chrome.storage.local.get(['currentTime', 'isStanding', 'isRunning', 'isPaused', 'lastUpdateTime'], function(result) {
    if (result.isRunning && !result.isPaused) {
      const now = Date.now();
      const lastUpdate = result.lastUpdateTime || now;
      const elapsedSeconds = Math.floor((now - lastUpdate) / 1000);

      if (elapsedSeconds <= 0) return;

// Update current values from storage
      currentTime = result.currentTime;
      isStanding = result.isStanding;

// Calculate new time
      if (currentTime <= elapsedSeconds) {
// Time's up, switch modes
        isStanding = !isStanding;
        currentTime = isStanding ? STANDING_TIME : SITTING_TIME;

// Show notification
        chrome.notifications.create({
          type: 'basic',
          iconUrl: 'images/icon128.png',
          title: isStanding ? 'Time to STAND UP!' : 'Time to SIT DOWN',
          message: isStanding ? 'Stand for 20 minutes' : 'Sit for 45 minutes',
          priority: 2
        });
      } else {
// Just update the time
        currentTime -= elapsedSeconds;
      }

// Update storage
      chrome.storage.local.set({
        currentTime: currentTime,
        isStanding: isStanding,
        lastUpdateTime: now
      });
    }
  });
}

// Initialize extension when installed
chrome.runtime.onInstalled.addListener(function() {
// Set default state
  chrome.storage.local.set({
    currentTime: SITTING_TIME,
    isStanding: false,
    isRunning: false,
    isPaused: false,
    lastUpdateTime: null
  });
});

// Listen for Chrome starting up
chrome.runtime.onStartup.addListener(function() {
// Check if timer was running when Chrome was closed
  chrome.storage.local.get(['isRunning', 'isPaused', 'currentTime', 'isStanding'], function(result) {
    if (result.isRunning && !result.isPaused) {
// Restore variables
      currentTime = result.currentTime;
      isStanding = result.isStanding;
      isRunning = true;

// Restart the timer
      startBackgroundTimer();
    }
  });
});