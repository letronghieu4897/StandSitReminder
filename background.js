// Background timer variables
let isRunning = false;
let isPaused = false;
let isStanding = false;
let currentTime = 0;
let lastUpdateTime = null;

// Set up alarm listener
chrome.alarms.onAlarm.addListener(function (alarm) {
  if (alarm.name === 'standsitTimer') {
    backgroundTimerTick();
  }
});

// Handle messages from popup
chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
  console.log('Background received message:', request);

  switch (request.action) {
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

      // Update badge to show paused state
      chrome.action.setBadgeText({ text: '⏸' });
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

    case 'timerEnded':
      // Handle timer completion in the background
      handleTimerEnd(request.isStanding, request.standingTime, request.sittingTime);
      break;

    case 'notificationClosed':
      // Resume the timer after notification is closed
      console.log('Notification closed, resuming timer:', request.reason);

      // Set isPaused to false
      isPaused = false;

      // Update storage
      chrome.storage.local.set(
        {
          isPaused: false,
          lastUpdateTime: Date.now(),
        },
        function () {
          console.log('Storage updated, isPaused:', false);

          // Restart the timer
          startBackgroundTimer();
        }
      );

      // Send response back to confirm receipt
      sendResponse({ success: true });
      break;
  }

  // Return true for async response
  return true;
});

// Start background timer using alarms
function startBackgroundTimer() {
  console.log('Starting background timer');

  // Clear any existing alarms
  chrome.alarms.clear('standsitTimer', function (wasCleared) {
    console.log('Existing alarm cleared:', wasCleared);

    // Set last tick time
    lastUpdateTime = Date.now();

    // Create a new alarm
    chrome.alarms.create('standsitTimer', { periodInMinutes: 0.01 }); // Fires every 0.6 seconds
    console.log('New alarm created');

    // Update state in storage
    chrome.storage.local.set(
      {
        isRunning: true,
        isPaused: false,
        lastUpdateTime: Date.now(),
      },
      function () {
        console.log('Storage updated for timer start');
      }
    );

    // Update badge
    updateBadgeInBackground(currentTime, isStanding);
  });
}

// Stop background timer
function stopBackgroundTimer() {
  chrome.alarms.clear('standsitTimer');

  // Get default times from storage
  chrome.storage.local.get(['sittingTime'], function (result) {
    let sittingTime = result.sittingTime || 45;

    // Reset state in storage
    chrome.storage.local.set({
      currentTime: sittingTime * 60,
      isStanding: false,
      isRunning: false,
      isPaused: false,
      lastUpdateTime: null,
    });

    // Reset local variables
    isRunning = false;
    isPaused = false;
    currentTime = sittingTime * 60;
    isStanding = false;
  });

  // Clear badge
  chrome.action.setBadgeText({ text: '' });
}

// Background timer tick function
function backgroundTimerTick() {
  console.log('Timer tick - isRunning:', isRunning, 'isPaused:', isPaused);

  if (!isRunning || isPaused) {
    console.log('Timer not running or is paused, skipping tick');
    return;
  }

  // Load current state from storage for accurate sync
  chrome.storage.local.get(
    [
      'currentTime',
      'isStanding',
      'isRunning',
      'isPaused',
      'lastUpdateTime',
      'sittingTime',
      'standingTime',
    ],
    function (result) {
      if (result.isRunning && !result.isPaused) {
        const now = Date.now();
        const lastUpdate = result.lastUpdateTime || now;
        const elapsedSeconds = Math.floor((now - lastUpdate) / 1000);

        if (elapsedSeconds <= 0) return;

        // Get timer settings with proper default values if missing
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

          // Handle timer end
          handleTimerEnd(isStanding, standingTime, sittingTime);
        } else {
          // Just update the time
          currentTime -= elapsedSeconds;

          // Update badge and storage
          updateBadgeInBackground(currentTime, isStanding);

          // Update storage
          chrome.storage.local.set({
            currentTime: currentTime,
            isStanding: isStanding,
            lastUpdateTime: now,
          });
        }
      }
    }
  );
}

// Handle timer end
function handleTimerEnd(isStanding, standingTime, sittingTime) {
  console.log('Timer ended, creating notification');

  // Pause the timer while notification is showing
  isPaused = true;
  chrome.alarms.clear('standsitTimer');

  // Update storage to reflect paused state
  chrome.storage.local.set({
    currentTime: isStanding ? standingTime : sittingTime,
    isStanding: isStanding,
    isPaused: true,
    lastUpdateTime: null,
  });

  // Update the badge to indicate the current state
  chrome.action.setBadgeText({
    text: isStanding ? 'UP!' : 'SIT',
  });

  chrome.action.setBadgeBackgroundColor({
    color: isStanding ? '#1ee869' : '#2563eb',
  });

  // Get notification preferences
  chrome.storage.local.get(
    ['desktopNotificationsEnabled', 'browserPopupEnabled', 'soundEnabled'],
    function (prefs) {
      const title = isStanding ? 'Time to STAND UP!' : 'Time to SIT DOWN';
      const message = isStanding
        ? `Stand for ${Math.floor(standingTime / 60)} minutes`
        : `Sit for ${Math.floor(sittingTime / 60)} minutes`;

      try {
        // Only show one type of notification - prioritize popup over desktop notification
        if (prefs.browserPopupEnabled !== false) {
          // Create browser popup notification
          chrome.windows.create(
            {
              url: `notification-popup.html?isStanding=${isStanding}`,
              type: 'popup',
              width: 340,
              height: 200,
              focused: true,
            },
            function (window) {
              console.log('Browser popup created with ID:', window.id);
            }
          );
        } else if (prefs.desktopNotificationsEnabled !== false) {
          // Only show desktop notification if browser popup is disabled
          chrome.notifications.create('standSitReminder_' + Date.now(), {
            type: 'basic',
            iconUrl: 'images/icon128.png',
            title: title,
            message: message,
            priority: 2,
            requireInteraction: true,
          });
        }
      } catch (error) {
        console.error('Error creating notifications:', error);
      }
    }
  );
}

// Update badge on extension icon
function updateBadgeInBackground(time, standing) {
  const minutes = Math.floor(time / 60);
  const seconds = time % 60;

  // Show minutes:seconds
  chrome.action.setBadgeText({
    text: minutes.toString() + ':' + (seconds < 10 ? '0' : '') + seconds,
  });

  chrome.action.setBadgeBackgroundColor({
    color: standing ? '#1ee869' : '#2563eb',
  });
}

// Initialize extension when installed
chrome.runtime.onInstalled.addListener(function () {
  console.log('Extension installed');

  // Check notification permission
  if (chrome.notifications) {
    console.log('Notifications API is available');
  } else {
    console.error('Notifications API is NOT available');
  }

  // Set default state
  chrome.storage.local.set({
    sittingTime: 45,
    standingTime: 20,
    currentTime: 45 * 60,
    isStanding: false,
    isRunning: false,
    isPaused: false,
    lastUpdateTime: null,
    desktopNotificationsEnabled: true,
    browserPopupEnabled: true,
    soundEnabled: true,
  });
});

// Listen for Chrome starting up
chrome.runtime.onStartup.addListener(function () {
  // Check if timer was running when Chrome was closed
  chrome.storage.local.get(
    ['isRunning', 'isPaused', 'currentTime', 'isStanding'],
    function (result) {
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
