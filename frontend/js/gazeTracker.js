// Gaze Tracking Module using WebGazer.js
const GazeTracker = {
  // State
  isInitialized: false,
  isCalibrated: false,
  faceDetected: false,

  // Calibration
  gazeThreshold: null, // X-coordinate threshold for left vs right (screen center after click calibration)

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

      // Initialize WebGazer with video preview disabled
      webgazer.params.showVideoPreview = false;
      webgazer.params.showFaceOverlay = false;
      webgazer.params.showFaceFeedbackBox = false;
      webgazer.params.showGazeDot = false;

      await webgazer
        .setGazeListener((data, clock) => {
          if (data) {
            this._handleGazeData(data, clock);
          }
        })
        .begin();

      // Hide WebGazer's auto-created video elements
      this._hideWebGazerElements();

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

  // Face detection tracking
  faceDetectionHistory: [],
  faceDetectionHistorySize: 10, // Track last 10 checks (1 second at 100ms intervals)
  onFaceStatusChange: null,

  /**
   * Hide WebGazer's auto-created video elements visually but keep them functional
   */
  _hideWebGazerElements() {
    // Elements to make invisible but keep processing
    const elementsToHide = [
      'webgazerFaceOverlay',
      'webgazerFaceFeedbackBox',
      'webgazerGazeDot'
    ];

    // These need to stay visible for processing, just make them tiny and transparent
    const videoElements = [
      'webgazerVideoFeed',
      'webgazerVideoCanvas',
      'webgazerVideoContainer'
    ];

    elementsToHide.forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        el.style.display = 'none';
        Utils.log(`Hidden WebGazer element: ${id}`);
      }
    });

    // Make video elements tiny but still visible to the browser
    videoElements.forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        el.style.position = 'fixed';
        el.style.width = '1px';
        el.style.height = '1px';
        el.style.top = '0';
        el.style.left = '0';
        el.style.opacity = '0.01'; // Nearly invisible but still rendered
        el.style.pointerEvents = 'none';
        el.style.zIndex = '-1';
        Utils.log(`Minimized WebGazer video element: ${id}`);
      }
    });

    // Also handle any unidentified video elements from WebGazer
    const allVideos = document.querySelectorAll('video');
    allVideos.forEach(video => {
      if (video.id !== 'webcam-preview' && !video.id.startsWith('webgazer')) {
        video.style.position = 'fixed';
        video.style.width = '1px';
        video.style.height = '1px';
        video.style.opacity = '0.01';
        video.style.pointerEvents = 'none';
        video.style.zIndex = '-1';
        Utils.log('Minimized additional video element');
      }
    });
  },

  /**
   * Monitor face detection status
   */
  _setupFaceDetection() {
    setInterval(async () => {
      const prediction = await webgazer.getCurrentPrediction();
      const wasDetected = this.faceDetected;
      this.faceDetected = prediction !== null && prediction.x !== undefined;

      // Track detection history for stability check
      this.faceDetectionHistory.push(this.faceDetected);
      if (this.faceDetectionHistory.length > this.faceDetectionHistorySize) {
        this.faceDetectionHistory.shift();
      }

      // Update UI indicator
      const indicator = document.getElementById('face-indicator');
      if (indicator) {
        if (this.faceDetected) {
          indicator.classList.add('active');
        } else {
          indicator.classList.remove('active');
        }
      }

      // Notify listeners of state change
      if (wasDetected !== this.faceDetected && this.onFaceStatusChange) {
        this.onFaceStatusChange(this.faceDetected);
      }
    }, 100);
  },

  /**
   * Check if face has been consistently detected
   * Returns true if face was detected in at least 80% of recent checks
   */
  isFaceStablyDetected() {
    if (this.faceDetectionHistory.length < this.faceDetectionHistorySize) {
      return false; // Not enough history yet
    }
    const detectedCount = this.faceDetectionHistory.filter(d => d).length;
    return detectedCount >= this.faceDetectionHistorySize * 0.8;
  },

  /**
   * Handle incoming gaze data from WebGazer
   */
  _handleGazeData(data, clock) {
    if (!this.isInitialized) return;

    const gazePoint = {
      x: data.x,
      y: data.y,
      timestamp: clock
    };

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

    // Normalize to 0-1 scale (1 = perfect, 0 = worst), clamped to [0, 1]
    this.calibrationAccuracy = Math.min(1, Math.max(0, 1 - (avgDistance / (screenDiagonal * 0.3))));

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
   * Get current gaze prediction (async)
   */
  async getCurrentGaze() {
    if (!this.isInitialized) return null;

    const prediction = await webgazer.getCurrentPrediction();
    if (!prediction || prediction.x === undefined) return null;

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

    // Guard against division by zero
    const totalTime = leftFixationTime + rightFixationTime + centerTime;

    return {
      leftFixationTime,
      rightFixationTime,
      centerTime,
      switches,
      firstFixation,
      totalSamples: gazeData.length,
      leftPercentage: totalTime > 0 ? (leftFixationTime / totalTime) * 100 : 0,
      rightPercentage: totalTime > 0 ? (rightFixationTime / totalTime) * 100 : 0
    };
  },

  /**
   * Get calibration data summary for storage
   */
  getCalibrationSummary() {
    return {
      threshold: this.gazeThreshold,
      accuracy: this.calibrationAccuracy,
      calibrationType: 'click-based'
    };
  }
};

// Make GazeTracker globally available
window.GazeTracker = GazeTracker;
