// Configuration for Gaze Tracking Experiment
const CONFIG = {
  // API Configuration - switches between local and production
  api: {
    endpoint: window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
      ? 'http://localhost:3000'  // Local mock API
      : 'https://YOUR-API-ID.execute-api.us-east-1.amazonaws.com/prod',  // Production AWS API
    timeout: 30000
  },

  // Image Configuration
  images: {
    manifestUrl: window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
      ? '/images/manifest.json'  // Local images
      : 'https://YOUR-CLOUDFRONT-ID.cloudfront.net/image-manifest.json',  // S3 via CloudFront
    width: 800,
    height: 600,
    format: 'jpg'
  },

  // Experiment Configuration
  experiment: {
    name: "Gaze Tracking Scrambled Images",
    version: "1.0",
    numTrials: 50,
    trialDuration: 3000, // ms
    fixationDuration: 500, // ms
    interTrialInterval: 500, // ms
    breakEvery: 20 // trials
  },

  // Calibration Configuration
  calibration: {
    duration: 30000, // ms (30 seconds)
    validationTargets: 6,
    minAccuracy: 0.70,
    samplesPerSide: 100
  },

  // Scrambling Configuration
  scrambling: {
    methods: [
      'phase',      // Fourier phase scrambling
      'block',      // Block shuffling
      'pixel',      // Complete pixel scrambling
      'rotation',   // Segment rotation
      'mosaic',     // Blur/mosaic
      'edge',       // Edge-preserved scrambling
      'color',      // Color randomization
      'wavelet'     // Wavelet scrambling
    ],
    levels: [0, 0.20, 0.40, 0.60, 0.80, 1.00], // 0% to 100%
    blockSizes: {
      0.20: 64,   // Larger blocks at low scramble
      0.40: 32,
      0.60: 16,
      0.80: 8,
      1.00: 4     // Smaller blocks at high scramble
    }
  },

  // Gaze Tracking Configuration
  gazeTracking: {
    sampleRate: 30, // Hz (30 FPS - samples per second)
    smoothing: 3,   // samples to average for smoothing
    saveToBackend: true,
    batchSize: 5    // Send trial data every N trials
  },

  // Category Configuration
  categories: {
    highAttention: ['erotica', 'violence', 'gore'],
    lowAttention: ['office-supplies', 'furniture', 'textures', 'noise']
  },

  // Export Configuration
  export: {
    formats: ['csv', 'json'],
    includeRawGaze: true,
    compressGaze: true  // Gzip before S3 upload (for production)
  }
};

// Make config globally available
window.CONFIG = CONFIG;
