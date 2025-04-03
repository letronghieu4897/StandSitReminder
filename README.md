# Stand/Sit Reminder Chrome Extension

A Chrome extension to help you maintain a healthy work routine by reminding you to alternate between sitting and standing positions.

## Features

- ⏱️ Customizable sitting and standing durations
- 🔔 Desktop notifications when it's time to change position
- 🔊 Optional sound alerts
- 📊 Visual progress tracking with timer
- 🔄 Continues running in the background even when Chrome is minimized
- 🏷️ Shows countdown timer directly on the extension icon

## Installation Guide

### Step 1: Download the Extension Files

1. Download all the extension files and store them in a folder on your computer.
2. The necessary files include:
   - `manifest.json`
   - `popup.html`
   - `popup.css`
   - `popup.js`
   - `background.js`
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

1. **Start Timer**: Click the "Start" button to begin the timer cycle (default is 45 minutes sitting, 20 minutes standing)
2. **Pause/Resume**: Click the "Pause" button if you need to temporarily stop the timer
3. **Reset**: Click the "Reset" button to start a fresh cycle

### Customizing Settings

1. Click the gear icon (⚙️) in the upper right corner to access settings
2. Adjust the sitting and standing durations to your preference
3. Enable or disable notifications and sound alerts
4. Click "Save Settings" to apply your changes

### Timer Badge

The extension displays the remaining time directly on the extension icon, making it easy to see at a glance without opening the popup.

## Troubleshooting

### Notifications Not Working

1. Make sure you've allowed notifications for this extension
2. Check Chrome's notification settings (Settings > Privacy and Security > Site Settings > Notifications)
3. Ensure you have "Enable notifications" checked in the extension settings

### Timer Stops Unexpectedly

1. Check if Chrome's battery saver or power management features are limiting background activities
2. Make sure the extension is not being suspended by the browser
3. Try reinstalling the extension

### Extension Not Visible

1. Check if the extension is enabled in chrome://extensions/
2. Pin it to your toolbar using the puzzle piece icon

## Customization and Development

The extension is built with standard web technologies:

- HTML/CSS for the interface
- JavaScript for the functionality
- Chrome Extension APIs for notifications and background processes

Developers can modify the code to add features or customize the appearance as needed.

## Privacy

This extension:

- Does not collect any personal data
- Does not communicate with external servers
- Stores settings and timer state only locally in your browser

## License

This extension is provided as open source software. Feel free to modify and distribute according to your needs.

---

Enjoy your healthier work routine!
