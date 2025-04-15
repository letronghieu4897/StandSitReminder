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
      chrome.action.setBadgeBackgroundColor({ color: 'rgba(0, 0, 0, 0)' });
      chrome.action.setBadgeTextColor({ color: '#000000' });
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

    case 'modeSwitched':
      console.log(
        'Background received mode switch, new mode:',
        request.isStanding ? 'Standing' : 'Sitting'
      );

      // Update background state
      isStanding = request.isStanding;
      currentTime = request.currentTime;
      isRunning = request.isRunning || false;
      isPaused = request.isPaused || false;

      // If timer is not running, clear any existing alarm
      if (!isRunning || isPaused) {
        chrome.alarms.clear('standsitTimer');
      }

      // Update storage
      chrome.storage.local.set({
        isStanding: isStanding,
        currentTime: currentTime,
        isRunning: isRunning,
        isPaused: isPaused,
        lastUpdateTime: isRunning && !isPaused ? Date.now() : null,
      });

      // Update badge
      updateBadgeInBackground(currentTime, isStanding);
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

  // Get the current timer state from storage
  chrome.storage.local.get(['currentTime', 'isStanding', 'isPaused'], function (result) {
    if (result.isPaused) {
      console.log('Timer is paused in storage, skipping tick');
      return;
    }

    let newTime = result.currentTime - 1;
    const isStanding = result.isStanding || false;

    console.log(`Timer tick: ${newTime} seconds left, mode: ${isStanding ? 'STANDING' : 'SITTING'}`);

    if (newTime <= 0) {
      // Timer ended, don't restart automatically
      console.log('Timer reached zero, ending timer');
      chrome.storage.local.get(['standingTime', 'sittingTime'], function (timeResult) {
        const standingTime = timeResult.standingTime || 20;
        const sittingTime = timeResult.sittingTime || 45;
        
        // Handle timer completion
        handleTimerEnd(isStanding, standingTime, sittingTime);
      });
    } else {
      // Update remaining time
      chrome.storage.local.set({
        currentTime: newTime,
        lastUpdateTime: Date.now()
      });

      // Update badge
      updateBadgeInBackground(newTime, isStanding);
    }
  });
}

// Handle timer end
function handleTimerEnd(isStanding, standingTime, sittingTime) {
  console.log('Timer ended for state:', isStanding ? 'STANDING' : 'SITTING');

  // Stop the timer completely when it ends
  isRunning = false;
  isPaused = false;
  chrome.alarms.clear('standsitTimer');

  // The isStanding parameter contains the state that just completed
  // Calculate next mode values - opposite of what just completed
  let nextTime = isStanding ? sittingTime * 60 : standingTime * 60;
  let nextMode = !isStanding;

  // Update storage to reflect stopped state with next mode values ready
  chrome.storage.local.set({
    currentTime: nextTime,
    isStanding: nextMode,
    isRunning: false,
    isPaused: false,
    lastUpdateTime: null
  }, function() {
    // After storage update completes, prepare notifications
    console.log('Storage updated, showing notifications for state change');
    
    // Get notification preferences
    chrome.storage.local.get(
      [
        'desktopNotificationsEnabled',
        'browserPopupEnabled',
        'soundEnabled'
      ],
      function (result) {
        // Determine notification content based on which timer just ended
        let title, message;
        
        if (isStanding) {
          // Standing timer just ended - tell user to sit down
          title = 'Time to Sit Down!';
          message = `You've been standing for ${standingTime} minutes. Time to sit down!`;
        } else {
          // Sitting timer just ended - tell user to stand up
          title = 'Time to Stand Up!';
          message = `You've been sitting for ${sittingTime} minutes. Time to stand up!`;
        }

        console.log('Showing notification:', title, message);

        // Desktop notification
        if (result.desktopNotificationsEnabled) {
          showDesktopNotification(title, message);
        }

        // Browser popup
        if (result.browserPopupEnabled) {
          showBrowserPopup(title, message);
        }

        // Sound alert
        if (result.soundEnabled) {
          playAlertSound();
        }
        
        // Update the badge with a notification indicator
        chrome.action.setBadgeText({
          text: nextMode ? 'STND' : 'SIT',
        });

        chrome.action.setBadgeBackgroundColor({
          color: nextMode ? '#1ee869' : '#ff0000',
        });

        chrome.action.setBadgeTextColor({
          color: nextMode ? '#000000' : '#ffffff'
        });
      }
    );
  });
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
    color: standing ? '#1ee869' : '#ff0000',
  });
  
  chrome.action.setBadgeTextColor({
    color: standing ? '#000000' : '#ffffff'
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
    soundEnabled: true
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

// Helper function for desktop notifications
function showDesktopNotification(title, message) {
  try {
    chrome.notifications.create('standSitReminder_' + Date.now(), {
      type: 'basic',
      iconUrl: 'images/icon128.png',
      title: title,
      message: message,
      priority: 2,
      requireInteraction: true,
    });
  } catch (error) {
    console.error('Error creating desktop notification:', error);
  }
}

// Helper function for browser popup
function showBrowserPopup(title, message) {
  try {
    // Determine which action to prompt based on the notification title
    const shouldStand = title.includes('Stand Up');
    
    // Create the popup with correct parameters
    chrome.windows.create(
      {
        url: `notification-popup.html?shouldStand=${shouldStand}`,
        type: 'popup',
        width: 340,
        height: 200,
        focused: true,
      },
      function (window) {
        console.log('Browser popup created with ID:', window.id, 'shouldStand=', shouldStand);
      }
    );
  } catch (error) {
    console.error('Error creating browser popup:', error);
  }
}

// Helper function for sound alerts
function playAlertSound() {
  try {
    const audio = new Audio('sounds/alert.mp3');
    audio.play().catch(e => console.error('Error playing sound:', e));
  } catch (error) {
    console.error('Error playing sound alert:', error);
  }
}
