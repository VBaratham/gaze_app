// Main Application Entry Point

/**
 * Initialize the application when DOM is ready
 */
document.addEventListener('DOMContentLoaded', async () => {
  Utils.log('='.repeat(60));
  Utils.log('Gaze Tracking Experiment');
  Utils.log('='.repeat(60));
  Utils.log('Initializing application...');

  try {
    // Check browser compatibility
    checkBrowserCompatibility();

    // Test API connection
    await testAPIConnection();

    // Initialize experiment flow
    await ExperimentFlow.initialize();

    Utils.log('Application initialized successfully');

  } catch (error) {
    Utils.log('Initialization error', error);
    showError('Failed to initialize application: ' + error.message);
  }
});

/**
 * Check if browser supports required features
 */
function checkBrowserCompatibility() {
  const requiredFeatures = {
    'getUserMedia': navigator.mediaDevices && navigator.mediaDevices.getUserMedia,
    'Canvas': !!document.createElement('canvas').getContext,
    'WebGL': !!document.createElement('canvas').getContext('webgl'),
    'Fetch API': typeof fetch !== 'undefined'
  };

  const unsupported = [];
  for (const [feature, supported] of Object.entries(requiredFeatures)) {
    if (!supported) {
      unsupported.push(feature);
    }
  }

  if (unsupported.length > 0) {
    throw new Error(`Browser missing required features: ${unsupported.join(', ')}`);
  }

  // Show mobile warning in UI
  if (Utils.isMobile()) {
    showMobileWarning();
  }

  Utils.log('Browser compatibility check passed');
}

/**
 * Show mobile device warning to user
 */
function showMobileWarning() {
  const warningDiv = document.createElement('div');
  warningDiv.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0,0,0,0.9);
    z-index: 10000;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 20px;
  `;
  warningDiv.innerHTML = `
    <div style="
      background: white;
      padding: 40px;
      border-radius: 8px;
      max-width: 500px;
      text-align: center;
    ">
      <h2 style="color: #e74c3c; margin-bottom: 20px;">Desktop Required</h2>
      <p style="margin-bottom: 15px;">
        This experiment requires a <strong>desktop or laptop computer</strong> with a webcam.
      </p>
      <p style="margin-bottom: 20px;">
        Eye tracking is not supported on mobile devices or tablets.
      </p>
      <p style="color: #666;">
        Please visit this page on a computer to participate.
      </p>
    </div>
  `;
  document.body.appendChild(warningDiv);

  // Prevent experiment from starting
  throw new Error('Mobile device detected - experiment requires desktop');
}

/**
 * Test connection to API
 */
async function testAPIConnection() {
  try {
    const health = await APIClient.healthCheck();
    Utils.log('API connection successful', health);
  } catch (error) {
    Utils.log('API connection failed (continuing anyway)', error);
    // Don't throw - allow offline testing
  }
}

/**
 * Show error message to user
 */
function showError(message) {
  const errorDiv = document.createElement('div');
  errorDiv.style.cssText = `
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background: #e74c3c;
    color: white;
    padding: 30px;
    border-radius: 8px;
    box-shadow: 0 4px 20px rgba(0,0,0,0.3);
    z-index: 10000;
    max-width: 500px;
    text-align: center;
  `;
  errorDiv.innerHTML = `
    <h2 style="margin-bottom: 15px;">Error</h2>
    <p>${message}</p>
    <button onclick="location.reload()" style="
      margin-top: 20px;
      padding: 10px 20px;
      background: white;
      color: #e74c3c;
      border: none;
      border-radius: 5px;
      cursor: pointer;
      font-size: 1rem;
      font-weight: 600;
    ">Reload Page</button>
  `;
  document.body.appendChild(errorDiv);
}

/**
 * Handle page unload - warn if experiment is in progress
 */
window.addEventListener('beforeunload', (e) => {
  if (ExperimentFlow.currentState === 'trial' ||
      ExperimentFlow.currentState === 'break') {
    e.preventDefault();
    e.returnValue = 'Experiment in progress. Are you sure you want to leave?';
    return e.returnValue;
  }
});

/**
 * Handle visibility change - pause/resume experiment
 */
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    Utils.log('Page hidden - pausing experiment');
    if (GazeTracker.isInitialized) {
      GazeTracker.pause();
    }
  } else {
    Utils.log('Page visible - resuming experiment');
    if (GazeTracker.isInitialized) {
      GazeTracker.resume();
    }
  }
});

/**
 * Global error handler
 */
window.addEventListener('error', (e) => {
  Utils.log('Global error caught', {
    message: e.message,
    filename: e.filename,
    lineno: e.lineno,
    colno: e.colno,
    error: e.error
  });
});

/**
 * Handle unhandled promise rejections
 */
window.addEventListener('unhandledrejection', (e) => {
  Utils.log('Unhandled promise rejection', e.reason);
});

Utils.log('Main script loaded');
