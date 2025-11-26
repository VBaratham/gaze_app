# Testing Guide

This document provides instructions for testing the gaze tracking experiment locally.

## Prerequisites

Make sure you have completed the installation steps in README.md:
- Python 3.7+ installed
- Flask and dependencies installed (`pip install flask flask-cors pillow`)
- Placeholder images generated
- Modern web browser (Chrome, Firefox, or Edge)
- Webcam connected and working

## Starting the Application

### Quick Start

Use the provided startup script:

**Linux/Mac:**
```bash
cd gaze_app
./scripts/start_local.sh
```

**Windows:**
```bash
cd gaze_app
scripts\start_local.bat
```

The script will start both servers and provide the URLs.

### Manual Start

If you prefer to start servers manually:

**Terminal 1 - Mock API:**
```bash
cd gaze_app
python scripts/mock_api.py
```
You should see: "Starting server at http://localhost:3000"

**Terminal 2 - Frontend:**
```bash
cd gaze_app/frontend
python3 -m http.server 8000
```
You should see: "Serving HTTP on :: port 8000"

## Testing Flow

### 1. Welcome Screen
- Open http://localhost:8000
- Check that the page loads without errors (open browser console: F12)
- Check the consent checkbox
- Click "Begin Experiment"

### 2. Camera Setup
- Allow camera access when prompted
- Verify your webcam feed appears
- Check that face detection indicator works (green dot when face detected)
- Click "Camera Ready - Continue"

### 3. Calibration
- Read the LEFT paragraph naturally, moving your eyes across the text
- After ~15 seconds, the right side will be highlighted
- Read the RIGHT paragraph naturally
- Wait for calibration to complete

**What to check:**
- Progress bar fills smoothly
- Instructions change from left to right
- No JavaScript errors in console

### 4. Validation
- Look at each red circle as it appears
- Six targets will appear in sequence
- Wait for accuracy results

**Expected behavior:**
- Targets appear in different screen positions
- Accuracy score is displayed (aim for >70%)
- If accuracy is low, you can recalibrate
- If accuracy is good, continue to experiment

### 5. Experiment Instructions
- Review the instructions
- Click "Start Experiment"

### 6. Trial Phase
- A fixation cross (+) will appear briefly
- Two images will appear side-by-side for 3 seconds
- Images will be scrambled using various methods
- Simply look naturally at whatever interests you

**What to check:**
- Trial counter updates (Trial 1/50, Trial 2/50, etc.)
- Images load and display correctly
- Images are visibly scrambled (except at 0% level)
- No lag or freezing
- Face detection indicator stays green

### 7. Break Screens
- Every 20 trials, a break screen appears
- Rest your eyes but maintain your position
- Click "Continue" when ready

### 8. Completion
- After 50 trials, the experiment completes
- Review your stats:
  - Participant ID
  - Trials completed
  - Calibration accuracy

## Checking the Backend

You can verify data is being saved by checking the mock API logs:

1. Look at the terminal running `mock_api.py`
2. You should see log messages like:
   ```
   Created session: [session-id]
   Saved trial [trial-id] for session [session-id]
   Completed session: [session-id]
   ```

3. You can also access the API directly:
   - Health check: http://localhost:3000/health
   - Statistics: http://localhost:3000/statistics
   - Sessions: http://localhost:3000/sessions

## Common Issues and Solutions

### Camera not working
- **Check permissions:** Ensure browser has camera access
- **Check other apps:** Close any app that might be using the camera
- **Try another browser:** Some browsers have better WebRTC support
- **Check lighting:** Poor lighting can cause face detection to fail

### Images not loading
- **Verify images exist:** Check `frontend/images/` directories
- **Check console:** Look for 404 errors or CORS issues
- **Regenerate images:** Run `python scripts/generate_placeholder_images.py` again

### Calibration fails
- **Sit at proper distance:** About 60cm (2 feet) from screen
- **Good lighting:** Ensure your face is well-lit
- **Stay still:** Don't move during calibration
- **Read naturally:** Actually read the text, don't just stare

### JavaScript errors
- **Check console:** Open browser DevTools (F12) and look for errors
- **Verify all files loaded:** Check Network tab for 404 errors
- **Check WebGazer:** Ensure `lib/webgazer.min.js` exists and loaded

### API connection fails
- **Check API is running:** Terminal should show "Starting server at http://localhost:3000"
- **Check port 3000:** Ensure nothing else is using port 3000
- **Test directly:** Visit http://localhost:3000/health

## Browser Console Testing

Open the browser console (F12) and try these commands to test components:

```javascript
// Check if all modules loaded
console.log('Config:', CONFIG);
console.log('Utils:', Utils);
console.log('GazeTracker:', GazeTracker);
console.log('ImageScrambler:', ImageScrambler);
console.log('ExperimentFlow:', ExperimentFlow);
console.log('APIClient:', APIClient);

// Test API connection
APIClient.healthCheck().then(console.log);

// Check current experiment state
console.log('Current state:', ExperimentFlow.currentState);
console.log('Current trial:', ExperimentFlow.currentTrialIndex);
console.log('Total trials:', ExperimentFlow.trials.length);

// Check gaze tracker status
console.log('Gaze initialized:', GazeTracker.isInitialized);
console.log('Gaze calibrated:', GazeTracker.isCalibrated);
console.log('Face detected:', GazeTracker.faceDetected);
```

## Testing Checklist

Use this checklist to verify all functionality:

- [ ] Application loads without errors
- [ ] Camera access works
- [ ] Face detection indicator works
- [ ] Calibration collects data from both sides
- [ ] Validation targets appear and move correctly
- [ ] Accuracy score is calculated and displayed
- [ ] Trials generate and display correctly
- [ ] Images load and are scrambled appropriately
- [ ] Trial counter updates correctly
- [ ] Break screens appear every 20 trials
- [ ] Data is sent to backend (check API logs)
- [ ] Experiment completes successfully
- [ ] Completion stats are displayed
- [ ] No JavaScript errors throughout entire flow

## Performance Testing

For optimal performance:
- Close unnecessary browser tabs
- Close other applications
- Ensure good lighting conditions
- Use a wired connection if possible (reduces camera lag)
- Test on the target hardware (desktop/laptop, not mobile)

## Next Steps

Once local testing is successful:
1. Collect real stimulus images for each category
2. Update the image manifest with real image paths
3. Consider AWS deployment for production use
4. Set up the analytics dashboard
5. Run pilot studies with actual participants

## Getting Help

If you encounter issues:
1. Check the browser console for errors
2. Check the API server logs
3. Review README.md and this testing guide
4. Ensure all dependencies are installed
5. Try regenerating placeholder images
6. Try a different browser
