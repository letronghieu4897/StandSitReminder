document.addEventListener('DOMContentLoaded', function () {
  const container = document.getElementById('container');
  const messageContainer = document.getElementById('messageContainer');

  // Get query parameters
  const urlParams = new URLSearchParams(window.location.search);
  const isStanding = urlParams.get('isStanding') === 'true';

  console.log('Notification popup loaded, isStanding:', isStanding);

  // Apply appropriate classes to container
  if (isStanding) {
    container.classList.add('standing-container');
  } else {
    container.classList.add('sitting-container');
  }

  // Create and insert action text
  const actionText = document.createElement('div');
  actionText.className = isStanding ? 'action-text standing-text' : 'action-text sitting-text';
  actionText.textContent = isStanding ? 'STAND UP!' : 'SIT DOWN';
  messageContainer.appendChild(actionText);

  // Add hint text
  const hintText = document.createElement('div');
  hintText.className = 'hint-text';
  hintText.textContent = 'Click anywhere to dismiss';
  messageContainer.appendChild(hintText);

  // Flag to prevent duplicate close messages
  let hasClosedNotification = false;

  // Make the whole container clickable to close
  container.addEventListener('click', function () {
    if (!hasClosedNotification) {
      hasClosedNotification = true;
      resumeTimer('userClick');
      window.close();
    }
  });

  // Handle closing via browser close button
  window.addEventListener('beforeunload', function () {
    if (!hasClosedNotification) {
      hasClosedNotification = true;
      resumeTimer('browserClose');
    }
  });

  // Function to send resume message to background script
  function resumeTimer(reason) {
    try {
      console.log('Sending message to resume timer');
      chrome.runtime.sendMessage(
        {
          action: 'notificationClosed',
          reason: reason,
        },
        function (response) {
          // Check for any errors in message sending
          if (chrome.runtime.lastError) {
            console.error('Error sending message:', chrome.runtime.lastError);
          } else {
            console.log('Resume message sent successfully, response:', response);
          }
        }
      );
    } catch (error) {
      console.error('Error sending resume message:', error);
    }
  }
});
