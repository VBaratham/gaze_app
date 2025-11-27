// Experiment Flow State Machine
const ExperimentFlow = {
  // State
  currentState: 'welcome',
  sessionId: null,
  participantId: null,

  // Trial management
  trials: [],
  currentTrialIndex: 0,
  trialData: [],

  // Image manifest
  imageManifest: null,

  // Timing
  trialStartTime: null,
  fixationTimeout: null,
  imageTimeout: null,
  interTrialTimeout: null,

  // Click calibration tracking
  clickCalibrationData: {},
  clicksRequired: 10, // Increased from 5 to 10 for better calibration

  /**
   * Initialize the experiment flow
   */
  async initialize() {
    Utils.log('Initializing Experiment Flow');

    // Set up event listeners for all screens
    this._setupEventListeners();

    // Load image manifest
    await this._loadImageManifest();

    // Try to retry any previously failed trials
    await this._retryFailedTrials();

    // Start at welcome screen
    this.transitionTo('welcome');
  },

  /**
   * Transition to a new state
   */
  transitionTo(newState) {
    Utils.log(`State transition: ${this.currentState} -> ${newState}`);

    this.currentState = newState;

    // Show appropriate screen
    Utils.showScreen(`${newState}-screen`);

    // Execute state-specific logic
    switch (newState) {
      case 'welcome':
        this._handleWelcome();
        break;
      case 'camera':
        this._handleCamera();
        break;
      case 'click-calibration':
        this._handleClickCalibration();
        break;
      case 'validation-instructions':
        this._handleValidationInstructions();
        break;
      case 'validation':
        this._handleValidation();
        break;
      case 'experiment-instructions':
        this._handleInstructions();
        break;
      case 'trial':
        this._handleTrial();
        break;
      case 'break':
        this._handleBreak();
        break;
      case 'completion':
        this._handleCompletion();
        break;
    }
  },

  /**
   * Safely add event listener to element
   */
  _safeAddListener(elementId, event, handler) {
    const element = document.getElementById(elementId);
    if (element) {
      element.addEventListener(event, handler);
    } else {
      Utils.log(`Warning: Element '${elementId}' not found`);
    }
    return element;
  },

  /**
   * Set up event listeners for buttons
   */
  _setupEventListeners() {
    // Welcome screen
    this._safeAddListener('consent-checkbox', 'change', (e) => {
      const beginBtn = document.getElementById('begin-btn');
      if (beginBtn) {
        beginBtn.disabled = !e.target.checked;
      }
    });

    this._safeAddListener('begin-btn', 'click', () => {
      this.transitionTo('camera');
    });

    // Camera screen
    this._safeAddListener('camera-ready-btn', 'click', () => {
      this.transitionTo('calibration-instructions');
    });

    // Calibration instructions screen - start with click calibration
    this._safeAddListener('start-calibration-btn', 'click', () => {
      this.transitionTo('click-calibration');
    });

    // Experiment instructions
    this._safeAddListener('start-experiment-btn', 'click', () => {
      this._startExperiment();
    });

    // Break screen
    this._safeAddListener('continue-after-break-btn', 'click', () => {
      this.transitionTo('trial');
    });

    // Validation screen buttons (will be enabled dynamically)
    this._safeAddListener('recalibrate-btn', 'click', () => {
      this._restartCalibration();
    });

    this._safeAddListener('continue-btn', 'click', () => {
      this.transitionTo('experiment-instructions');
    });

    // Validation instructions screen
    this._safeAddListener('start-validation-btn', 'click', () => {
      this.transitionTo('validation');
    });
  },

  /**
   * Load image manifest
   */
  async _loadImageManifest() {
    try {
      const response = await fetch(CONFIG.images.manifestUrl);
      const manifest = await response.json();

      // Normalize manifest format - extract image arrays from categories
      if (manifest.categories) {
        this.imageManifest = {};
        for (const [category, data] of Object.entries(manifest.categories)) {
          this.imageManifest[category] = data.images || [];
        }
      } else {
        // Already in flat format
        this.imageManifest = manifest;
      }

      Utils.log('Image manifest loaded', this.imageManifest);
    } catch (error) {
      Utils.log('Error loading image manifest', error);
      // For testing, create dummy manifest
      this.imageManifest = this._createDummyManifest();
    }
  },

  /**
   * Create dummy manifest for testing
   */
  _createDummyManifest() {
    const manifest = {};

    // High attention categories
    CONFIG.categories.highAttention.forEach(cat => {
      manifest[cat] = Array(40).fill(0).map((_, i) => `images/${cat}/${i + 1}.jpg`);
    });

    // Low attention categories
    CONFIG.categories.lowAttention.forEach(cat => {
      manifest[cat] = Array(30).fill(0).map((_, i) => `images/${cat}/${i + 1}.jpg`);
    });

    return manifest;
  },

  /**
   * Welcome screen handler
   */
  _handleWelcome() {
    // Nothing special needed
  },

  /**
   * Camera setup handler
   */
  async _handleCamera() {
    const cameraStatus = document.getElementById('camera-status');
    const cameraReadyBtn = document.getElementById('camera-ready-btn');

    try {
      if (cameraStatus) cameraStatus.textContent = 'Initializing camera...';

      await GazeTracker.initialize();

      if (cameraStatus) cameraStatus.textContent = 'Waiting for face detection...';

      // Wait for stable face detection before enabling button
      const checkFaceInterval = setInterval(() => {
        if (GazeTracker.isFaceStablyDetected()) {
          clearInterval(checkFaceInterval);
          if (cameraStatus) cameraStatus.textContent = 'Face detected! Camera ready.';
          if (cameraReadyBtn) cameraReadyBtn.classList.remove('hidden');
        } else if (GazeTracker.faceDetected) {
          if (cameraStatus) cameraStatus.textContent = 'Face detected - please hold still...';
        } else {
          if (cameraStatus) cameraStatus.textContent = 'Position your face in the camera view';
        }
      }, 200);

      // Set up face status change listener for when button is already visible
      GazeTracker.onFaceStatusChange = (isDetected) => {
        if (!isDetected && cameraReadyBtn && !cameraReadyBtn.classList.contains('hidden')) {
          if (cameraStatus) cameraStatus.textContent = 'Face lost - please reposition';
        } else if (isDetected && cameraReadyBtn && !cameraReadyBtn.classList.contains('hidden')) {
          if (cameraStatus) cameraStatus.textContent = 'Face detected! Camera ready.';
        }
      };

    } catch (error) {
      Utils.log('Camera initialization error', error);
      if (cameraStatus) cameraStatus.textContent = `Error: ${error.message}`;
    }
  },

  /**
   * Click calibration handler - WebGazer.js recommended approach
   */
  _handleClickCalibration() {
    Utils.log('Starting click calibration');

    // Reset click tracking data
    this.clickCalibrationData = {};

    // Get all calibration points
    const points = document.querySelectorAll('.calibration-point');

    // Reset all points
    points.forEach(point => {
      point.className = 'calibration-point';
      const pointId = point.getAttribute('data-point');
      this.clickCalibrationData[pointId] = 0;
    });

    // Count remaining points
    const getRemainingCount = () => {
      return Object.values(this.clickCalibrationData).filter(c => c < this.clicksRequired).length;
    };

    // Add click handlers to each point
    points.forEach(point => {
      const pointId = point.getAttribute('data-point');

      const clickHandler = (e) => {
        // Don't prevent default - let WebGazer see the click too

        // Increment click count
        this.clickCalibrationData[pointId]++;
        const clicks = this.clickCalibrationData[pointId];

        Utils.log(`Point ${pointId} clicked ${clicks}/${this.clicksRequired} times`);

        // Get the actual position of the calibration point on screen
        const rect = point.getBoundingClientRect();
        const pointX = rect.left + rect.width / 2;
        const pointY = rect.top + rect.height / 2;

        // Explicitly record this position for WebGazer training
        // This tells WebGazer: "the user is looking at (pointX, pointY) right now"
        try {
          webgazer.recordScreenPosition(pointX, pointY, 'click');
          Utils.log(`Recorded calibration point at (${pointX.toFixed(0)}, ${pointY.toFixed(0)})`);
        } catch (err) {
          Utils.log('Error recording screen position:', err);
        }

        // Update visual state
        point.classList.remove('clicked-1', 'clicked-2', 'clicked-3', 'clicked-4', 'complete');
        if (clicks >= this.clicksRequired) {
          point.classList.add('complete');
          point.removeEventListener('click', clickHandler);
        } else {
          point.classList.add(`clicked-${clicks}`);
        }

        // Check if all points are complete
        const remaining = getRemainingCount();
        if (remaining === 0) {
          Utils.log('Click calibration complete, proceeding to validation instructions');
          // Mark as calibrated and go to validation instructions
          GazeTracker.isCalibrated = true;
          // Set threshold to screen center (click calibration gives us actual coordinates)
          GazeTracker.gazeThreshold = window.innerWidth / 2;
          setTimeout(() => {
            this.transitionTo('validation-instructions');
          }, 500);
        }
      };

      point.addEventListener('click', clickHandler);
    });
  },

  /**
   * Validation instructions handler
   */
  _handleValidationInstructions() {
    // Nothing special needed - just display the instructions
  },

  /**
   * Restart calibration from the beginning
   */
  _restartCalibration() {
    Utils.log('Restarting calibration');

    // Hide the validation results box
    const resultsDiv = document.getElementById('validation-results');
    const recalibrateBtn = document.getElementById('recalibrate-btn');
    const continueBtn = document.getElementById('continue-btn');
    if (resultsDiv) resultsDiv.classList.add('hidden');
    if (recalibrateBtn) recalibrateBtn.classList.add('hidden');
    if (continueBtn) continueBtn.classList.add('hidden');

    // Reset gaze tracker calibration state
    GazeTracker.isCalibrated = false;
    GazeTracker.gazeThreshold = null;

    // Reset click calibration data
    this.clickCalibrationData = {};

    // Start from click calibration again
    this.transitionTo('click-calibration');
  },

  /**
   * Validation handler
   */
  async _handleValidation() {
    const targetDiv = document.getElementById('validation-target');
    const resultsDiv = document.getElementById('validation-results');
    const accuracyScore = document.getElementById('accuracy-score');
    const accuracyMessage = document.getElementById('accuracy-message');
    const recalibrateBtn = document.getElementById('recalibrate-btn');
    const continueBtn = document.getElementById('continue-btn');

    // Validate all required elements exist
    if (!targetDiv || !resultsDiv || !accuracyScore || !accuracyMessage) {
      Utils.log('Error: Missing validation DOM elements');
      return;
    }

    Utils.log('Starting validation');

    // Generate target positions
    const targets = [
      { x: window.innerWidth * 0.2, y: window.innerHeight * 0.3 },
      { x: window.innerWidth * 0.8, y: window.innerHeight * 0.3 },
      { x: window.innerWidth * 0.5, y: window.innerHeight * 0.5 },
      { x: window.innerWidth * 0.2, y: window.innerHeight * 0.7 },
      { x: window.innerWidth * 0.8, y: window.innerHeight * 0.7 },
      { x: window.innerWidth * 0.5, y: window.innerHeight * 0.2 }
    ];

    // Show targets one by one and collect gaze data
    targetDiv.classList.remove('hidden');
    const validationData = [];

    try {
      for (let i = 0; i < targets.length; i++) {
        const target = targets[i];
        Utils.log(`Showing target ${i + 1}/${targets.length} at (${target.x}, ${target.y})`);

        // Position the target
        targetDiv.style.left = (target.x - 30) + 'px';
        targetDiv.style.top = (target.y - 30) + 'px';
        targetDiv.style.display = 'block';

        // Wait a brief moment for the DOM to update and user to focus
        await Utils.sleep(200);

        // Collect gaze samples for longer to get more data (increased from 1500ms to 2500ms)
        const samples = await this._collectGazeSamples(2500);

        Utils.log(`Target ${i + 1} complete. Collected ${samples.length} samples`);

        if (samples.length > 0) {
          const meanX = Utils.mean(samples.map(p => p.x));
          const meanY = Utils.mean(samples.map(p => p.y));
          const distance = Math.sqrt(
            Math.pow(meanX - target.x, 2) +
            Math.pow(meanY - target.y, 2)
          );

          validationData.push({
            target: target,
            predicted: { x: meanX, y: meanY },
            distance: distance,
            samples: samples.length
          });
        } else {
          Utils.log(`Warning: No samples collected for target ${i + 1}`);
        }

        // Brief pause before next target
        await Utils.sleep(200);
      }
    } catch (error) {
      Utils.log('Error during validation loop:', error);
      throw error;
    }

    Utils.log('All targets shown, hiding');
    targetDiv.classList.add('hidden');

    // Calculate accuracy from collected data
    Utils.log('Calculating validation accuracy');
    Utils.log(`Collected validation data for ${validationData.length} targets`);

    let accuracy = 0;
    let avgDistance = 0;

    if (validationData.length > 0) {
      avgDistance = Utils.mean(validationData.map(r => r.distance));
      const screenDiagonal = Math.sqrt(
        Math.pow(window.innerWidth, 2) +
        Math.pow(window.innerHeight, 2)
      );
      // Clamp accuracy to [0, 1]
      accuracy = Math.min(1, Math.max(0, 1 - (avgDistance / (screenDiagonal * 0.3))));
    }

    const validationResult = {
      accuracy: accuracy,
      avgDistance: avgDistance,
      results: validationData
    };

    // Store accuracy in GazeTracker
    GazeTracker.calibrationAccuracy = accuracy;

    Utils.log('Validation result', validationResult);

    // Show results
    resultsDiv.classList.remove('hidden');
    accuracyScore.textContent = (validationResult.accuracy * 100).toFixed(0);

    if (validationResult.accuracy >= CONFIG.calibration.minAccuracy) {
      accuracyMessage.textContent = 'Great! Calibration is accurate enough to proceed.';
      accuracyMessage.style.color = '#27ae60';
      if (continueBtn) continueBtn.classList.remove('hidden');
    } else {
      accuracyMessage.textContent = 'Calibration accuracy is low. Please recalibrate.';
      accuracyMessage.style.color = '#e74c3c';
      if (recalibrateBtn) recalibrateBtn.classList.remove('hidden');
    }
  },

  /**
   * Collect gaze samples for a specified duration without blocking the event loop
   */
  async _collectGazeSamples(duration) {
    return new Promise((resolve) => {
      const samples = [];
      const startTime = Date.now();
      const sampleInterval = 20; // Increased frequency: ~50Hz (was 33ms/30Hz)

      let validCount = 0;
      let nullCount = 0;
      let invalidCount = 0;
      let loggedOnce = false;

      const collectSample = async () => {
        const elapsed = Date.now() - startTime;

        if (elapsed < duration) {
          // Collect a sample
          try {
            // getCurrentPrediction returns a Promise in newer WebGazer versions
            const prediction = await webgazer.getCurrentPrediction();
            if (!prediction) {
              nullCount++;
            } else if (typeof prediction.x === 'number' && !isNaN(prediction.x) &&
                       typeof prediction.y === 'number' && !isNaN(prediction.y)) {
              validCount++;
              samples.push({
                x: prediction.x,
                y: prediction.y
              });
            } else {
              invalidCount++;
              // Log first invalid prediction to debug
              if (!loggedOnce) {
                Utils.log('Invalid prediction sample:', {
                  prediction: prediction,
                  xType: typeof prediction.x,
                  yType: typeof prediction.y,
                  xIsNaN: isNaN(prediction.x),
                  yIsNaN: isNaN(prediction.y)
                });
                loggedOnce = true;
              }
            }
          } catch (predError) {
            Utils.log('Error getting prediction:', predError);
          }

          // Schedule next sample collection
          setTimeout(collectSample, sampleInterval);
        } else {
          // Duration complete, resolve with collected samples
          Utils.log(`Sample collection complete: ${validCount} valid, ${nullCount} null, ${invalidCount} invalid`);
          resolve(samples);
        }
      };

      // Start collecting
      collectSample();
    });
  },

  /**
   * Experiment instructions handler
   */
  _handleInstructions() {
    // Generate trials
    this.trials = this._generateTrials();
    this.currentTrialIndex = 0;
    this.trialData = [];

    Utils.log(`Generated ${this.trials.length} trials`);
  },

  /**
   * Generate trial configurations
   */
  _generateTrials() {
    const trials = [];
    const numTrials = CONFIG.experiment.numTrials;

    const highAttentionCategories = CONFIG.categories.highAttention;
    const lowAttentionCategories = CONFIG.categories.lowAttention;
    const scrambleMethods = CONFIG.scrambling.methods;
    const scrambleLevels = CONFIG.scrambling.levels;

    for (let i = 0; i < numTrials; i++) {
      // Randomly select categories
      const highCat = Utils.randomChoice(highAttentionCategories);
      const lowCat = Utils.randomChoice(lowAttentionCategories);

      // Randomly select images from categories
      const highImg = Utils.randomChoice(this.imageManifest[highCat] || [`images/${highCat}/1.jpg`]);
      const lowImg = Utils.randomChoice(this.imageManifest[lowCat] || [`images/${lowCat}/1.jpg`]);

      // Randomly select scramble method and level
      const method = Utils.randomChoice(scrambleMethods);
      const level = Utils.randomChoice(scrambleLevels);

      // Randomly assign left/right
      const highOnLeft = Math.random() < 0.5;

      trials.push({
        trialNumber: i + 1,
        leftImage: {
          path: highOnLeft ? highImg : lowImg,
          category: highOnLeft ? highCat : lowCat,
          attentionType: highOnLeft ? 'high' : 'low'
        },
        rightImage: {
          path: highOnLeft ? lowImg : highImg,
          category: highOnLeft ? lowCat : highCat,
          attentionType: highOnLeft ? 'low' : 'high'
        },
        scrambleMethod: method,
        scrambleLevel: level
      });
    }

    return trials;
  },

  /**
   * Start the experiment and create session
   */
  async _startExperiment() {
    try {
      // Create session via API
      const sessionData = {
        participantId: Utils.generateUUID(),
        calibrationAccuracy: GazeTracker.calibrationAccuracy,
        browserInfo: Utils.getBrowserInfo()
      };

      const session = await APIClient.createSession(sessionData);
      this.sessionId = session.sessionId;
      this.participantId = sessionData.participantId;

      Utils.log('Session created', this.sessionId);

      // Start first trial
      this.transitionTo('trial');

    } catch (error) {
      Utils.log('Error starting experiment', error);
      alert('Failed to start experiment. Please check your connection.');
    }
  },

  /**
   * Trial handler - runs a single trial
   */
  async _handleTrial() {
    const trial = this.trials[this.currentTrialIndex];

    if (!trial) {
      // All trials complete
      this.transitionTo('completion');
      return;
    }

    // Update trial counter
    const trialCounter = document.getElementById('trial-counter');
    if (trialCounter) {
      trialCounter.textContent = `Trial ${trial.trialNumber}/${CONFIG.experiment.numTrials}`;
    }

    // Get canvas elements
    const leftCanvas = document.getElementById('left-image');
    const rightCanvas = document.getElementById('right-image');
    const fixationCross = document.getElementById('fixation-cross');
    const imageContainer = document.getElementById('image-container');
    const interTrial = document.getElementById('inter-trial');

    // Validate all required elements exist
    if (!leftCanvas || !rightCanvas || !fixationCross || !imageContainer || !interTrial) {
      Utils.log('Error: Missing trial DOM elements');
      return;
    }

    // Hide everything initially
    fixationCross.classList.add('hidden');
    imageContainer.classList.add('hidden');
    interTrial.classList.remove('hidden');

    // Wait for inter-trial interval
    await Utils.sleep(CONFIG.experiment.interTrialInterval);

    // Show fixation cross
    interTrial.classList.add('hidden');
    fixationCross.classList.remove('hidden');

    // Wait for fixation duration
    await Utils.sleep(CONFIG.experiment.fixationDuration);

    // Hide fixation, load and show images
    fixationCross.classList.add('hidden');

    // Load and scramble images
    await Promise.all([
      ImageScrambler.loadAndScrambleImage(
        trial.leftImage.path,
        trial.scrambleMethod,
        trial.scrambleLevel,
        leftCanvas
      ),
      ImageScrambler.loadAndScrambleImage(
        trial.rightImage.path,
        trial.scrambleMethod,
        trial.scrambleLevel,
        rightCanvas
      )
    ]);

    // Show images and start tracking
    imageContainer.classList.remove('hidden');
    this.trialStartTime = Date.now();

    const gazeData = [];
    GazeTracker.startTracking((gazePoint) => {
      gazeData.push(gazePoint);
    });

    // Wait for trial duration
    await Utils.sleep(CONFIG.experiment.trialDuration);

    // Stop tracking
    GazeTracker.stopTracking();

    // Hide images
    imageContainer.classList.add('hidden');

    // Calculate fixation statistics
    const leftRegion = leftCanvas.getBoundingClientRect();
    const rightRegion = rightCanvas.getBoundingClientRect();

    const stats = GazeTracker.calculateFixationStats(gazeData, leftRegion, rightRegion);

    // Store trial data
    const trialResult = {
      ...trial,
      ...stats,
      gazePoints: gazeData,
      duration: CONFIG.experiment.trialDuration,
      timestamp: this.trialStartTime
    };

    this.trialData.push(trialResult);

    Utils.log('Trial complete', trialResult);

    // Save trial to backend
    await this._saveTrialData(trialResult);

    // Move to next trial
    this.currentTrialIndex++;

    // Check if break is needed
    if (this.currentTrialIndex % CONFIG.experiment.breakEvery === 0 &&
        this.currentTrialIndex < this.trials.length) {
      this.transitionTo('break');
    } else {
      // Continue to next trial
      this.transitionTo('trial');
    }
  },

  // Failed trial data queue for retry
  failedTrials: [],

  /**
   * Save trial data to backend with retry logic
   */
  async _saveTrialData(trialData) {
    const maxRetries = 3;
    const retryDelay = 1000;

    // Prepare data for backend (exclude raw gaze points from main payload)
    const { gazePoints, ...metadata } = trialData;
    const payload = {
      ...metadata,
      gazePointCount: gazePoints.length
    };

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        await APIClient.saveTrial(this.sessionId, payload);
        Utils.log(`Trial ${trialData.trialNumber} saved successfully`);
        return; // Success
      } catch (error) {
        Utils.log(`Error saving trial data (attempt ${attempt}/${maxRetries})`, error);

        if (attempt < maxRetries) {
          await Utils.sleep(retryDelay * attempt); // Exponential backoff
        } else {
          // All retries failed - store locally
          Utils.log('All retries failed, storing trial locally');
          this.failedTrials.push({
            sessionId: this.sessionId,
            trialData: payload,
            timestamp: Date.now()
          });

          // Store in localStorage as backup
          try {
            const storedTrials = JSON.parse(localStorage.getItem('failedTrials') || '[]');
            storedTrials.push({
              sessionId: this.sessionId,
              trialData: payload,
              timestamp: Date.now()
            });
            localStorage.setItem('failedTrials', JSON.stringify(storedTrials));
            Utils.log('Trial data backed up to localStorage');
          } catch (storageError) {
            Utils.log('Failed to backup to localStorage', storageError);
          }
        }
      }
    }
  },

  /**
   * Retry sending failed trials
   */
  async _retryFailedTrials() {
    const storedTrials = JSON.parse(localStorage.getItem('failedTrials') || '[]');
    if (storedTrials.length === 0) return;

    Utils.log(`Retrying ${storedTrials.length} failed trials`);
    const successfulRetries = [];

    for (let i = 0; i < storedTrials.length; i++) {
      const trial = storedTrials[i];
      try {
        await APIClient.saveTrial(trial.sessionId, trial.trialData);
        successfulRetries.push(i);
        Utils.log(`Successfully retried trial from session ${trial.sessionId}`);
      } catch (error) {
        Utils.log(`Retry failed for trial from session ${trial.sessionId}`, error);
      }
    }

    // Remove successful retries from storage
    if (successfulRetries.length > 0) {
      const remaining = storedTrials.filter((_, i) => !successfulRetries.includes(i));
      localStorage.setItem('failedTrials', JSON.stringify(remaining));
      Utils.log(`${successfulRetries.length} trials successfully retried, ${remaining.length} remaining`);
    }
  },

  /**
   * Break handler
   */
  _handleBreak() {
    const trialsCompleted = document.getElementById('trials-completed');
    if (trialsCompleted) {
      trialsCompleted.textContent = this.currentTrialIndex;
    }

    // Pause gaze tracking
    GazeTracker.pause();
  },

  /**
   * Completion handler
   */
  async _handleCompletion() {
    try {
      // Mark session as complete
      await APIClient.completeSession(this.sessionId);

      // Display completion stats
      const participantIdEl = document.getElementById('participant-id');
      const totalTrialsEl = document.getElementById('total-trials');
      const finalAccuracyEl = document.getElementById('final-accuracy');

      if (participantIdEl) participantIdEl.textContent = this.participantId;
      if (totalTrialsEl) totalTrialsEl.textContent = this.trials.length;
      if (finalAccuracyEl) {
        finalAccuracyEl.textContent = (GazeTracker.calibrationAccuracy * 100).toFixed(0);
      }

      // Check for failed trials and show warning
      const storedTrials = JSON.parse(localStorage.getItem('failedTrials') || '[]');
      if (storedTrials.length > 0 || this.failedTrials.length > 0) {
        const failedCount = storedTrials.length + this.failedTrials.length;
        Utils.log(`Warning: ${failedCount} trial(s) could not be saved to server`);

        // Add warning message to completion screen
        const completionContainer = document.querySelector('#completion-screen .container');
        if (completionContainer) {
          const warningDiv = document.createElement('div');
          warningDiv.style.cssText = 'background: #fff3cd; border: 1px solid #ffc107; padding: 15px; border-radius: 5px; margin: 20px 0;';
          warningDiv.innerHTML = `<strong>Note:</strong> ${failedCount} trial(s) could not be saved due to network issues. The data has been stored locally and will be uploaded on your next visit.`;
          completionContainer.insertBefore(warningDiv, completionContainer.querySelector('.thank-you'));
        }
      }

      Utils.log('Experiment complete!');

      // Clean up
      GazeTracker.cleanup();

    } catch (error) {
      Utils.log('Error completing session', error);
    }
  }
};

// Make ExperimentFlow globally available
window.ExperimentFlow = ExperimentFlow;
