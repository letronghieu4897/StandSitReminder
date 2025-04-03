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
let notificationsEnabled = true;
let soundEnabled = true;

// DOM elements - declared as variables that will be initialized once DOM is loaded
let timerEl;
let actionEl;
let nextActionEl;
let startBtn;
let pauseBtn;
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
let notificationsEnabledCheckbox;
let soundEnabledCheckbox;

// Load saved state when popup opens
document.addEventListener('DOMContentLoaded', function () {
    // Initialize DOM elements
    timerEl = document.getElementById('timer');
    actionEl = document.getElementById('currentAction');
    nextActionEl = document.getElementById('nextAction');
    startBtn = document.getElementById('startBtn');
    pauseBtn = document.getElementById('pauseBtn');
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
    notificationsEnabledCheckbox = document.getElementById('notificationsEnabled');
    soundEnabledCheckbox = document.getElementById('soundEnabled');

    // Request notification permission right away
    requestNotificationPermission();

    // Set up the number input controls
    setupNumberInputs();

    // Load preferences
    loadPreferences();

    // Load saved timer state
    chrome.storage.local.get(['currentTime', 'isStanding', 'isRunning', 'isPaused', 'lastUpdateTime'], function (result) {
        if (result.currentTime !== undefined) {
            currentTime = result.currentTime;
            isStanding = result.isStanding || false;
            isPaused = result.isPaused || false;

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
                resetBtn.disabled = true;
            }
        } else {
            pauseBtn.disabled = true;
            resetBtn.disabled = true;
        }
    });

    // Set up event listeners
    startBtn.addEventListener('click', startTimer);
    pauseBtn.addEventListener('click', pauseTimer);
    resetBtn.addEventListener('click', resetTimer);

    // Settings button click
    settingsBtn.addEventListener('click', function () {
        mainView.classList.add('hidden');
        settingsView.classList.remove('hidden');
    });

    // Save settings button click
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
        const newNotificationsEnabled = notificationsEnabledCheckbox.checked;
        const newSoundEnabled = soundEnabledCheckbox.checked;

        // Save the new settings
        chrome.storage.local.set({
            sittingTime: newSitTime,
            standingTime: newStandTime,
            notificationsEnabled: newNotificationsEnabled,
            soundEnabled: newSoundEnabled
        }, function () {
            // Update the global variables
            SITTING_TIME = newSitTime * 60;
            STANDING_TIME = newStandTime * 60;
            notificationsEnabled = newNotificationsEnabled;
            soundEnabled = newSoundEnabled;

            // Update the display
            sitTimeDisplay.textContent = `${newSitTime} min`;
            standTimeDisplay.textContent = `${newStandTime} min`;

            // If timer isn't running, also update the current time to match the new sitting time
            if (!startBtn.disabled) {
                currentTime = SITTING_TIME;
                initialTime = SITTING_TIME;
                updateTimer();
                updateProgressBar();
            }

            // Update cycle display text
            updateCycleDisplay();

            // Close settings view
            settingsView.classList.add('hidden');
            mainView.classList.remove('hidden');
        });
    });

    // Cancel settings button click
    cancelSettingsBtn.addEventListener('click', function () {
        // Reset input values to current settings
        sitTimeInput.value = SITTING_TIME / 60;
        standTimeInput.value = STANDING_TIME / 60;
        notificationsEnabledCheckbox.checked = notificationsEnabled;
        soundEnabledCheckbox.checked = soundEnabled;

        // Close settings view
        settingsView.classList.add('hidden');
        mainView.classList.remove('hidden');
    });

    // Set up polling to sync with background timer
    updateInterval = setInterval(syncWithBackground, 1000);
});

// Request notification permission
function requestNotificationPermission() {
    if (chrome.notifications) {
        console.log("Notifications API available");
    } else {
        console.log("Notifications API not available");
        try {
            // Fallback to Web Notifications API
            if (Notification && Notification.permission !== "granted") {
                Notification.requestPermission();
            }
        } catch (error) {
            console.error("Error requesting notification permission:", error);
        }
    }
}

// Load preferences
function loadPreferences() {
    chrome.storage.local.get(
        ['sittingTime', 'standingTime', 'notificationsEnabled', 'soundEnabled'],
        function (result) {
            // Load timer durations
            if (result.sittingTime) {
                SITTING_TIME = result.sittingTime * 60; // Convert minutes to seconds
                sitTimeInput.value = result.sittingTime;
                sitTimeDisplay.textContent = `${result.sittingTime} min`;
            }

            if (result.standingTime) {
                STANDING_TIME = result.standingTime * 60; // Convert minutes to seconds
                standTimeInput.value = result.standingTime;
                standTimeDisplay.textContent = `${result.standingTime} min`;
            }

            // Load notification preferences
            if (result.notificationsEnabled !== undefined) {
                notificationsEnabled = result.notificationsEnabled;
                notificationsEnabledCheckbox.checked = notificationsEnabled;
            }

            // Load sound preferences
            if (result.soundEnabled !== undefined) {
                soundEnabled = result.soundEnabled;
                soundEnabledCheckbox.checked = soundEnabled;
            }

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
            lastUpdateTime: Date.now()
        });
    }
});

// Sync with background timer
function syncWithBackground() {
    chrome.storage.local.get(['currentTime', 'isStanding', 'isRunning', 'isPaused'], function (result) {
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

// Show local notification
function showNotification(title, message) {
    if (!notificationsEnabled) return;

    // First try the chrome.notifications API
    if (chrome.notifications) {
        try {
            chrome.notifications.create('standSitReminder_' + Date.now(), {
                type: 'basic',
                iconUrl: 'images/icon128.png',
                title: title,
                message: message,
                priority: 2,
                requireInteraction: true
            }, function(notificationId) {
                console.log('Notification created with ID:', notificationId);
                // If there was an error creating the notification, the callback might not run
                if (chrome.runtime.lastError) {
                    console.error('Notification error:', chrome.runtime.lastError);
                    fallbackNotification(title, message);
                }
            });
        } catch (error) {
            console.error('Error showing Chrome notification:', error);
            fallbackNotification(title, message);
        }
    } else {
        fallbackNotification(title, message);
    }
}

// Fallback to Web Notifications API
function fallbackNotification(title, message) {
    if (!window.Notification) {
        console.error('Notifications not supported in this browser');
        return;
    }

    if (Notification.permission === 'granted') {
        try {
            const notification = new Notification(title, {
                body: message,
                icon: 'images/icon128.png'
            });
            notification.onclick = function() {
                window.focus();
            };
        } catch (error) {
            console.error('Error showing fallback notification:', error);
        }
    } else if (Notification.permission !== 'denied') {
        Notification.requestPermission().then(function(permission) {
            if (permission === 'granted') {
                fallbackNotification(title, message);
            }
        });
    }
}

// Play alert sound
function playAlertSound() {
    if (!soundEnabled) return;

    try {
        const audio = new Audio('sounds/alert.mp3'); // Add this file to your extension
        audio.volume = 0.5;
        audio.play()
            .catch(error => {
                console.error('Error playing audio file:', error);
            });
    } catch (error) {
        console.error('Error setting up audio:', error);
    }
}

// Timer tick function
function timerTick() {
    if (currentTime > 0) {
        currentTime--;
        updateTimer();
        updateProgressBar();
        updateBadge(); // Add this line
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
        const message = isStanding ?
            `Stand for ${STANDING_TIME/60} minutes` :
            `Sit for ${SITTING_TIME/60} minutes`;

        // 1. Try our own notification function
        showNotification(title, message);

        // 2. Play sound (this often helps alert users even if notifications fail)
        playAlertSound();

        // 3. Send message to background script as backup notification method
        chrome.runtime.sendMessage({
            action: 'showNotification',
            title: title,
            message: message
        }, function(response) {
            // Check if message was received
            if (chrome.runtime.lastError) {
                console.error('Error sending message to background:', chrome.runtime.lastError);
                // Try one more notification approach as final fallback
                try {
                    alert(title + "\n" + message);
                } catch (e) {
                    console.error('Alert fallback failed:', e);
                }
            }
        });

        // 4. Log to console for debugging
        console.log('TIMER ENDED: ' + title + ' - ' + message);
    }
}

// Start timer
function startTimer() {
    clearInterval(interval);
    interval = setInterval(timerTick, 1000);
    startBtn.disabled = true;
    pauseBtn.disabled = false;
    resetBtn.disabled = false;
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
    updateBadge(); // Add this line
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
    updateBadge(); // Add this line
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
    resetBtn.disabled = true;
    pauseBtn.innerHTML = `
    <svg class="button-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
      <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>
    </svg>
    Pause
  `;
    pauseBtn.classList.remove('paused');
    isPaused = false;

    // Inform background script that timer is reset
    chrome.runtime.sendMessage({action: 'timerReset'});

    saveState(false, false);
    updateBadge(); // Add this line
    chrome.action.setBadgeText({
        text: ""
    });
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

function updateBadge() {
    const minutes = Math.floor(currentTime / 60);
    const seconds = Math.floor(currentTime % 60);

    chrome.action.setBadgeText({
        text: minutes.toString() + ':' + (seconds < 10 ? '0' : '') + seconds
    });

    // Set different badge colors based on sitting/standing
    chrome.action.setBadgeBackgroundColor({
        color: isStanding ? '#28ed50' : '#2563eb'
    });
}