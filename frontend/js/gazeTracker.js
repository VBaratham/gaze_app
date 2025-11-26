// Gaze Tracking Module using WebGazer.js
const GazeTracker = {
  // State
  isInitialized: false,
  isCalibrated: false,
  faceDetected: false,

  // Calibration data
  leftGazePoints: [],
  rightGazePoints: [],
  gazeThreshold: null, // X-coordinate threshold for left vs right

  // Real-time gaze tracking
  currentGazeData: [],
  smoothingBuffer: [],
  gazeCallback: null,

  // Statistics
  calibrationAccuracy: 0,

  /**
   * Initialize WebGazer and request camera access
   */
  async initialize() {
    Utils.log('Initializing WebGazer...');

    try {
      // Request camera permission first
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });

      // Show camera preview
      const videoElement = document.getElementById('webcam-preview');
      if (videoElement) {
        videoElement.srcObject = stream;
      }

      // Initialize WebGazer
      await webgazer
        .setGazeListener((data, clock) => {
          if (data) {
            this._handleGazeData(data, clock);
          }
        })
        .begin();

      // Configure WebGazer
      webgazer.params.showVideoPreview = false; // We'll handle video display ourselves
      webgazer.params.showFaceOverlay = false;
      webgazer.params.showFaceFeedbackBox = false;

      // Set up face detection monitoring
      this._setupFaceDetection();

      this.isInitialized = true;
      Utils.log('WebGazer initialized successfully');

      return true;

    } catch (error) {
      Utils.log('Error initializing WebGazer', error);
      throw new Error('Failed to access camera: ' + error.message);
    }
  },

  /**
   * Monitor face detection status
   */
  _setupFaceDetection() {
    setInterval(() => {
      const prediction = webgazer.getCurrentPrediction();
      this.faceDetected = prediction !== null;

      // Update UI indicator
      const indicator = document.getElementById('face-indicator');
      if (indicator) {
        if (this.faceDetected) {
          indicator.classList.add('active');
        } else {
          indicator.classList.remove('active');
        }
      }
    }, 100);
  },

  /**
   * Start calibration phase - collecting gaze points from left and right sides
   */
  startCalibration(side) {
    Utils.log(`Starting calibration for ${side} side`);

    this.leftGazePoints = [];
    this.rightGazePoints = [];
    this.isCalibrating = true;
    this.calibrationSide = side;

    // Clear any existing gaze listener
    this.gazeCallback = null;
  },

  /**
   * Collect calibration data point
   */
  _handleGazeData(data, clock) {
    if (!this.isInitialized) return;

    const gazePoint = {
      x: data.x,
      y: data.y,
      timestamp: clock
    };

    // During calibration
    if (this.isCalibrating) {
      if (this.calibrationSide === 'left') {
        this.leftGazePoints.push(gazePoint);
      } else if (this.calibrationSide === 'right') {
        this.rightGazePoints.push(gazePoint);
      }
    }

    // During trials - apply smoothing and call callback
    if (this.gazeCallback) {
      // Add to smoothing buffer
      this.smoothingBuffer.push(gazePoint);

      // Keep buffer size limited
      if (this.smoothingBuffer.length > CONFIG.gazeTracking.smoothing) {
        this.smoothingBuffer.shift();
      }

      // Calculate smoothed gaze point
      if (this.smoothingBuffer.length >= CONFIG.gazeTracking.smoothing) {
        const smoothedX = Utils.mean(this.smoothingBuffer.map(p => p.x));
        const smoothedY = Utils.mean(this.smoothingBuffer.map(p => p.y));

        const smoothedGaze = {
          x: smoothedX,
          y: smoothedY,
          timestamp: clock,
          side: this.classifyGaze(smoothedX)
        };

        this.gazeCallback(smoothedGaze);
      }
    }
  },

  /**
   * Stop calibration and calculate threshold
   */
  stopCalibration() {
    Utils.log('Stopping calibration');
    Utils.log(`Collected ${this.leftGazePoints.length} left points, ${this.rightGazePoints.length} right points`);

    this.isCalibrating = false;
    this.calibrationSide = null;

    // Calculate threshold (midpoint between mean left X and mean right X)
    if (this.leftGazePoints.length > 0 && this.rightGazePoints.length > 0) {
      const leftMeanX = Utils.mean(this.leftGazePoints.map(p => p.x));
      const rightMeanX = Utils.mean(this.rightGazePoints.map(p => p.x));

      this.gazeThreshold = (leftMeanX + rightMeanX) / 2;

      Utils.log(`Calibration threshold: ${this.gazeThreshold}`);
      Utils.log(`Left mean X: ${leftMeanX}, Right mean X: ${rightMeanX}`);

      this.isCalibrated = true;
      return {
        threshold: this.gazeThreshold,
        leftMeanX,
        rightMeanX,
        leftPoints: this.leftGazePoints.length,
        rightPoints: this.rightGazePoints.length
      };
    } else {
      throw new Error('Insufficient calibration data collected');
    }
  },

  /**
   * Validate calibration accuracy using target points
   */
  async validateCalibration(targetPositions) {
    Utils.log('Starting validation');

    if (!this.isCalibrated) {
      throw new Error('Must calibrate before validation');
    }

    const results = [];

    for (const target of targetPositions) {
      const samples = [];

      // Collect samples for this target (over ~1 second)
      const sampleDuration = 1000;
      const startTime = Date.now();

      while (Date.now() - startTime < sampleDuration) {
        const prediction = webgazer.getCurrentPrediction();
        if (prediction) {
          samples.push({
            x: prediction.x,
            y: prediction.y
          });
        }
        await Utils.sleep(33); // ~30Hz
      }

      if (samples.length > 0) {
        const meanX = Utils.mean(samples.map(p => p.x));
        const meanY = Utils.mean(samples.map(p => p.y));

        // Calculate distance from target
        const distance = Math.sqrt(
          Math.pow(meanX - target.x, 2) +
          Math.pow(meanY - target.y, 2)
        );

        results.push({
          target: target,
          predicted: { x: meanX, y: meanY },
          distance: distance,
          samples: samples.length
        });
      }
    }

    // Calculate overall accuracy (lower distance = better)
    const avgDistance = Utils.mean(results.map(r => r.distance));
    const screenDiagonal = Math.sqrt(
      Math.pow(window.innerWidth, 2) +
      Math.pow(window.innerHeight, 2)
    );

    // Normalize to 0-1 scale (1 = perfect, 0 = worst)
    this.calibrationAccuracy = Math.max(0, 1 - (avgDistance / (screenDiagonal * 0.3)));

    Utils.log(`Validation accuracy: ${(this.calibrationAccuracy * 100).toFixed(1)}%`);

    return {
      accuracy: this.calibrationAccuracy,
      avgDistance: avgDistance,
      results: results
    };
  },

  /**
   * Classify gaze point as 'left' or 'right'
   */
  classifyGaze(x) {
    if (!this.isCalibrated || this.gazeThreshold === null) {
      return null;
    }

    return x < this.gazeThreshold ? 'left' : 'right';
  },

  /**
   * Check if gaze point is within a rectangular region
   */
  isGazeInRegion(gazePoint, region) {
    return Utils.pointInRect(gazePoint.x, gazePoint.y, region);
  },

  /**
   * Start tracking gaze during a trial
   */
  startTracking(callback) {
    Utils.log('Starting gaze tracking');

    this.currentGazeData = [];
    this.smoothingBuffer = [];
    this.gazeCallback = callback;
  },

  /**
   * Stop tracking and return collected data
   */
  stopTracking() {
    Utils.log('Stopping gaze tracking');

    this.gazeCallback = null;
    const data = this.currentGazeData;
    this.currentGazeData = [];
    this.smoothingBuffer = [];

    return data;
  },

  /**
   * Store gaze point during tracking
   */
  recordGazePoint(gazePoint) {
    this.currentGazeData.push(gazePoint);
  },

  /**
   * Pause WebGazer (for breaks)
   */
  pause() {
    if (this.isInitialized) {
      webgazer.pause();
      Utils.log('WebGazer paused');
    }
  },

  /**
   * Resume WebGazer
   */
  resume() {
    if (this.isInitialized) {
      webgazer.resume();
      Utils.log('WebGazer resumed');
    }
  },

  /**
   * Clean up and stop WebGazer
   */
  cleanup() {
    if (this.isInitialized) {
      webgazer.end();
      this.isInitialized = false;
      this.isCalibrated = false;
      Utils.log('WebGazer cleaned up');
    }
  },

  /**
   * Get current gaze prediction (synchronous)
   */
  getCurrentGaze() {
    if (!this.isInitialized) return null;

    const prediction = webgazer.getCurrentPrediction();
    if (!prediction) return null;

    return {
      x: prediction.x,
      y: prediction.y,
      side: this.classifyGaze(prediction.x),
      timestamp: Date.now()
    };
  },

  /**
   * Calculate fixation statistics from gaze data
   */
  calculateFixationStats(gazeData, leftRegion, rightRegion) {
    let leftFixationTime = 0;
    let rightFixationTime = 0;
    let centerTime = 0;
    let switches = 0;
    let firstFixation = null;
    let previousSide = null;

    // Calculate fixation duration for each point (1/30 second per sample at 30Hz)
    const timePerSample = 1000 / CONFIG.gazeTracking.sampleRate;

    for (const point of gazeData) {
      let currentSide = null;

      if (this.isGazeInRegion(point, leftRegion)) {
        leftFixationTime += timePerSample;
        currentSide = 'left';
      } else if (this.isGazeInRegion(point, rightRegion)) {
        rightFixationTime += timePerSample;
        currentSide = 'right';
      } else {
        centerTime += timePerSample;
        currentSide = 'center';
      }

      // Track first fixation
      if (!firstFixation && currentSide !== 'center') {
        firstFixation = currentSide;
      }

      // Count switches between left and right
      if (previousSide && currentSide !== previousSide &&
          currentSide !== 'center' && previousSide !== 'center') {
        switches++;
      }

      previousSide = currentSide;
    }

    return {
      leftFixationTime,
      rightFixationTime,
      centerTime,
      switches,
      firstFixation,
      totalSamples: gazeData.length,
      leftPercentage: leftFixationTime / (leftFixationTime + rightFixationTime + centerTime) * 100,
      rightPercentage: rightFixationTime / (leftFixationTime + rightFixationTime + centerTime) * 100
    };
  },

  /**
   * Get calibration data summary for storage
   */
  getCalibrationSummary() {
    return {
      threshold: this.gazeThreshold,
      accuracy: this.calibrationAccuracy,
      leftPoints: this.leftGazePoints.length,
      rightPoints: this.rightGazePoints.length,
      leftMeanX: this.leftGazePoints.length > 0 ?
        Utils.mean(this.leftGazePoints.map(p => p.x)) : null,
      rightMeanX: this.rightGazePoints.length > 0 ?
        Utils.mean(this.rightGazePoints.map(p => p.x)) : null
    };
  }
};

// Make GazeTracker globally available
window.GazeTracker = GazeTracker;
