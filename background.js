// Background timer variables
let isRunning = false;
let isPaused = false;
let isStanding = false;
let currentTime = 0;
let lastUpdateTime = null;

// Set up alarm listener
chrome.alarms.onAlarm.addListener(function(alarm) {
  if (alarm.name === 'standsitTimer') {
    backgroundTimerTick();
  }
});

// Handle messages from popup
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  switch(request.action) {
    case 'timerStarted':
      // Start the background timer
      currentTime = request.currentTime;
      isStanding = request.isStanding;
      isRunning = true;
      isPaused = false;
      startBackgroundTimer();
      break;

    case 'timerPaused':
      // Pause the background timer
      isPaused = true;
      chrome.alarms.clear('standsitTimer');
      break;

    case 'timerResumed':
      // Resume the background timer
      currentTime = request.currentTime;
      isStanding = request.isStanding;
      isPaused = false;
      startBackgroundTimer();
      break;

    case 'timerReset':
      // Clear the background timer
      stopBackgroundTimer();
      break;

    case 'showNotification':
      // Show notification
      try {
        chrome.notifications.create('standSitReminder_' + Date.now(), {
          type: 'basic',
          iconUrl: 'images/icon128.png',
          title: request.title,
          message: request.message,
          priority: 2,
          requireInteraction: true
        }, function(notificationId) {
          console.log('Background notification created with ID:', notificationId);
          if (chrome.runtime.lastError) {
            console.error('Background notification error:', chrome.runtime.lastError);
          }
        });
      } catch (error) {
        console.error('Error showing background notification:', error);
      }
      break;
  }

  // Return true for async response
  return true;
});

// Start background timer using alarms
function startBackgroundTimer() {
  // Clear any existing alarms
  chrome.alarms.clear('standsitTimer');

  // Set last tick time
  lastUpdateTime = Date.now();

  // Create a new alarm that fires every 3 seconds (0.05 minutes)
  chrome.alarms.create('standsitTimer', { periodInMinutes: 0.05 });

  // Update state in storage
  chrome.storage.local.set({
    isRunning: true,
    isPaused: false,
    lastUpdateTime: Date.now()
  });
}

// Stop background timer
function stopBackgroundTimer() {
  chrome.alarms.clear('standsitTimer');

  // Get default times from storage
  chrome.storage.local.get(['sittingTime'], function(result) {
    let sittingTime = result.sittingTime || 45;

    // Reset state in storage
    chrome.storage.local.set({
      currentTime: sittingTime * 60,
      isStanding: false,
      isRunning: false,
      isPaused: false,
      lastUpdateTime: null
    });

    // Reset local variables
    isRunning = false;
    isPaused = false;
    currentTime = sittingTime * 60;
    isStanding = false;
  });
}

// Background timer tick function
function backgroundTimerTick() {
  if (!isRunning || isPaused) return;

  // Load current state from storage for accurate sync
  chrome.storage.local.get(
      ['currentTime', 'isStanding', 'isRunning', 'isPaused', 'lastUpdateTime', 'sittingTime', 'standingTime'],
      function(result) {
        if (result.isRunning && !result.isPaused) {
          const now = Date.now();
          const lastUpdate = result.lastUpdateTime || now;
          const elapsedSeconds = Math.floor((now - lastUpdate) / 1000);

          if (elapsedSeconds <= 0) return;

          // Get timer settings
          const sittingTime = (result.sittingTime || 45) * 60;
          const standingTime = (result.standingTime || 20) * 60;

          // Update current values from storage
          currentTime = result.currentTime;
          isStanding = result.isStanding;

          // Calculate new time
          if (currentTime <= elapsedSeconds) {
            // Time's up, switch modes
            isStanding = !isStanding;
            currentTime = isStanding ? standingTime : sittingTime;

            // Get notification preferences
            chrome.storage.local.get(['notificationsEnabled'], function(prefs) {
              // Only show notification if enabled
              if (prefs.notificationsEnabled !== false) {
                // Show notification
                chrome.notifications.create({
                  type: 'basic',
                  iconUrl: 'images/icon128.png',
                  title: isStanding ? 'Time to STAND UP!' : 'Time to SIT DOWN',
                  message: isStanding ?
                      `Stand for ${standingTime/60} minutes` :
                      `Sit for ${sittingTime/60} minutes`,
                  priority: 2,
                  requireInteraction: true
                });
              }
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
      }
  );
}

// Initialize extension when installed
chrome.runtime.onInstalled.addListener(function() {
  // Set default state
  chrome.storage.local.set({
    sittingTime: 45,
    standingTime: 20,
    currentTime: 45 * 60,
    isStanding: false,
    isRunning: false,
    isPaused: false,
    lastUpdateTime: null,
    notificationsEnabled: true,
    soundEnabled: true
  });
});

// Listen for Chrome starting up
chrome.runtime.onStartup.addListener(function() {
  // Check if timer was running when Chrome was closed
  chrome.storage.local.get(
      ['isRunning', 'isPaused', 'currentTime', 'isStanding'],
      function(result) {
        if (result.isRunning && !result.isPaused) {
          // Restore variables
          currentTime = result.currentTime;
          isStanding = result.isStanding;
          isRunning = true;

          // Restart the timer
          startBackgroundTimer();
        }
      }
  );
});