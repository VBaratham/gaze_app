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
  calibrationIntervals: [],

  /**
   * Initialize the experiment flow
   */
  async initialize() {
    Utils.log('Initializing Experiment Flow');

    // Set up event listeners for all screens
    this._setupEventListeners();

    // Load image manifest
    await this._loadImageManifest();

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
      case 'calibration':
        this._handleCalibration();
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
   * Set up event listeners for buttons
   */
  _setupEventListeners() {
    // Welcome screen
    document.getElementById('consent-checkbox').addEventListener('change', (e) => {
      document.getElementById('begin-btn').disabled = !e.target.checked;
    });

    document.getElementById('begin-btn').addEventListener('click', () => {
      this.transitionTo('camera');
    });

    // Camera screen
    document.getElementById('camera-ready-btn').addEventListener('click', () => {
      this.transitionTo('calibration-instructions');
    });

    // Calibration instructions screen
    document.getElementById('start-calibration-btn').addEventListener('click', () => {
      this.transitionTo('calibration');
    });

    // Calibration screen - restart button
    document.getElementById('restart-calibration-btn').addEventListener('click', () => {
      this._restartCalibration();
    });

    // Experiment instructions
    document.getElementById('start-experiment-btn').addEventListener('click', () => {
      this._startExperiment();
    });

    // Break screen
    document.getElementById('continue-after-break-btn').addEventListener('click', () => {
      this.transitionTo('trial');
    });

    // Validation screen buttons (will be enabled dynamically)
    document.getElementById('recalibrate-btn')?.addEventListener('click', () => {
      this.transitionTo('calibration');
    });

    document.getElementById('continue-btn')?.addEventListener('click', () => {
      this.transitionTo('experiment-instructions');
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
    try {
      document.getElementById('camera-status').textContent = 'Initializing camera...';

      await GazeTracker.initialize();

      document.getElementById('camera-status').textContent = 'Camera ready!';
      document.getElementById('camera-ready-btn').classList.remove('hidden');

    } catch (error) {
      Utils.log('Camera initialization error', error);
      document.getElementById('camera-status').textContent = `Error: ${error.message}`;
    }
  },

  /**
   * Calibration handler
   */
  async _handleCalibration() {
    // Clear any existing intervals
    this._clearCalibrationIntervals();

    const leftText = document.getElementById('calibration-text-left');
    const rightText = document.getElementById('calibration-text-right');
    const progressFill = document.getElementById('calibration-progress-fill');
    const statusText = document.getElementById('calibration-status');

    const duration = CONFIG.calibration.duration;
    const halfDuration = duration / 2;

    // Show only left side first
    leftText.classList.remove('hidden');
    rightText.classList.add('hidden');
    leftText.style.background = '#e3f2fd';
    statusText.textContent = 'Please read the LEFT paragraph naturally';
    progressFill.style.width = '0%';

    // Start collecting left gaze data
    GazeTracker.startCalibration('left');

    // Progress animation for left side
    let startTime = Date.now();
    const leftInterval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min((elapsed / halfDuration) * 50, 50);
      progressFill.style.width = progress + '%';

      if (elapsed >= halfDuration) {
        clearInterval(leftInterval);

        // Switch to right side only
        leftText.classList.add('hidden');
        rightText.classList.remove('hidden');
        rightText.style.background = '#e3f2fd';
        statusText.textContent = 'Please read the RIGHT paragraph naturally';

        GazeTracker.calibrationSide = 'right';

        // Progress animation for right side
        startTime = Date.now();
        const rightInterval = setInterval(() => {
          const elapsed = Date.now() - startTime;
          const progress = Math.min(50 + (elapsed / halfDuration) * 50, 100);
          progressFill.style.width = progress + '%';

          if (elapsed >= halfDuration) {
            clearInterval(rightInterval);

            // Calibration complete
            statusText.textContent = 'Calibration complete!';
            const calibrationResult = GazeTracker.stopCalibration();

            Utils.log('Calibration result', calibrationResult);

            // Move to validation after brief delay
            setTimeout(() => {
              this.transitionTo('validation');
            }, 1000);
          }
        }, 100);
        this.calibrationIntervals.push(rightInterval);
      }
    }, 100);
    this.calibrationIntervals.push(leftInterval);
  },

  /**
   * Clear all calibration intervals
   */
  _clearCalibrationIntervals() {
    this.calibrationIntervals.forEach(interval => clearInterval(interval));
    this.calibrationIntervals = [];
  },

  /**
   * Restart calibration from the beginning
   */
  _restartCalibration() {
    Utils.log('Restarting calibration');

    // Clear existing intervals
    this._clearCalibrationIntervals();

    // Reset gaze tracker calibration state
    GazeTracker.leftGazePoints = [];
    GazeTracker.rightGazePoints = [];
    GazeTracker.isCalibrated = false;
    GazeTracker.gazeThreshold = null;

    // Restart the calibration process
    this._handleCalibration();
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
        await Utils.sleep(100);

        // Collect gaze samples using requestAnimationFrame for better performance
        const samples = await this._collectGazeSamples(1500);

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
    const avgDistance = Utils.mean(validationData.map(r => r.distance));
    const screenDiagonal = Math.sqrt(
      Math.pow(window.innerWidth, 2) +
      Math.pow(window.innerHeight, 2)
    );
    const accuracy = Math.max(0, 1 - (avgDistance / (screenDiagonal * 0.3)));

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
      continueBtn.classList.remove('hidden');
    } else {
      accuracyMessage.textContent = 'Calibration accuracy is low. Please recalibrate.';
      accuracyMessage.style.color = '#e74c3c';
      recalibrateBtn.classList.remove('hidden');
    }
  },

  /**
   * Collect gaze samples for a specified duration without blocking the event loop
   */
  async _collectGazeSamples(duration) {
    return new Promise((resolve) => {
      const samples = [];
      const startTime = Date.now();
      const sampleInterval = 33; // ~30Hz

      const collectSample = () => {
        const elapsed = Date.now() - startTime;

        if (elapsed < duration) {
          // Collect a sample
          try {
            const prediction = webgazer.getCurrentPrediction();
            if (prediction) {
              samples.push({
                x: prediction.x,
                y: prediction.y
              });
            }
          } catch (predError) {
            Utils.log('Error getting prediction:', predError);
          }

          // Schedule next sample collection
          setTimeout(collectSample, sampleInterval);
        } else {
          // Duration complete, resolve with collected samples
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
    document.getElementById('trial-counter').textContent =
      `Trial ${trial.trialNumber}/${CONFIG.experiment.numTrials}`;

    // Get canvas elements
    const leftCanvas = document.getElementById('left-image');
    const rightCanvas = document.getElementById('right-image');
    const fixationCross = document.getElementById('fixation-cross');
    const imageContainer = document.getElementById('image-container');
    const interTrial = document.getElementById('inter-trial');

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

  /**
   * Save trial data to backend
   */
  async _saveTrialData(trialData) {
    try {
      // Prepare data for backend (exclude raw gaze points from main payload)
      const { gazePoints, ...metadata } = trialData;

      await APIClient.saveTrial(this.sessionId, {
        ...metadata,
        gazePointCount: gazePoints.length
      });

      // TODO: In production, upload gazePoints to S3 separately

    } catch (error) {
      Utils.log('Error saving trial data', error);
      // Continue anyway - don't block experiment
    }
  },

  /**
   * Break handler
   */
  _handleBreak() {
    document.getElementById('trials-completed').textContent = this.currentTrialIndex;

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
      document.getElementById('participant-id').textContent = this.participantId;
      document.getElementById('total-trials').textContent = this.trials.length;
      document.getElementById('final-accuracy').textContent =
        (GazeTracker.calibrationAccuracy * 100).toFixed(0);

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
