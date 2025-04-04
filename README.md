# Stand/Sit Reminder Chrome Extension

A Chrome extension to help you maintain a healthy work routine by reminding you to alternate between sitting and
standing positions.

## Features

- ⏱️ Customizable sitting and standing durations
- 🔔 Desktop notifications when it's time to change position
- 🪟 Browser popup notifications with click-to-dismiss functionality
- 🔊 Optional sound alerts
- 📊 Visual progress tracking with timer
- 🔄 Continues running in the background even when Chrome is minimized
- 🏷️ Shows countdown timer directly on the extension icon

## Installation

### Step 1: Download the Files

1. Download all the extension files and store them in a folder on your computer.
2. The necessary files include:
   - `manifest.json`
   - `popup.html`, `popup.css`, `popup.js`
   - `background.js`
   - `notification-popup.html`, `notification-popup.css`, `notification-popup.js`
   - `/images` folder with icon files (icon16.png, icon48.png, icon128.png)

### Step 2: Load the Extension in Chrome

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable "Developer mode" by toggling the switch in the top-right corner
3. Click "Load unpacked"
4. Select the folder containing the extension files
5. The extension should now appear in your extensions list

### Step 3: Pin to Chrome Toolbar

1. Click the puzzle piece icon in Chrome's toolbar
2. Find "Stand/Sit Reminder" in the dropdown
3. Click the pin icon to keep it visible in your toolbar for easy access

## Using the Extension

### Basic Operation

1. **Start Timer**: Click the "Start" button to begin the timer cycle (default is 45 minutes sitting, 20 minutes
   standing)
2. **Pause/Resume**: Click the "Pause" button if you need to temporarily stop the timer
3. **Reset**: Click the "Reset" button to start a fresh cycle

### Notification System

When a timer cycle completes:

1. A browser popup notification appears that requires your acknowledgment
2. Click anywhere on the notification to dismiss it and continue to the next cycle
3. The timer pauses until you acknowledge the notification

### Customizing Settings

1. Click the gear icon (⚙️) in the upper right corner to access settings
2. Adjust the sitting and standing durations to your preference
3. Enable or disable different notification types:
   - Desktop notifications (system notifications)
   - Browser popup notifications (custom in-browser popups)
   - Sound alerts
4. Click "Save Settings" to apply your changes

## Troubleshooting

### Notifications Not Working

1. Make sure you've allowed notifications for this extension
2. Check Chrome's notification settings (Settings > Privacy and Security > Site Settings > Notifications)
3. Ensure you have at least one notification type enabled in the extension settings

### Timer Stops or Behaves Unexpectedly

1. Check the console for error messages (right-click the extension popup, select "Inspect", go to Console tab)
2. Make sure Chrome is not suspending the extension due to inactivity or power saving
3. Try reinstalling the extension

### Extension Not Visible

1. Check if the extension is enabled in chrome://extensions/
2. Pin it to your toolbar using the puzzle piece icon

## Development

### File Structure

- `manifest.json` - Extension configuration
- `popup.html/css/js` - Main interface and controls
- `background.js` - Background service worker for notifications and timer
