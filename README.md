# Gaze Tracking Experiment

A web-based eye-tracking experiment to study gaze patterns on scrambled images across different categories and scramble levels.

## Quick Start (Local Testing)

### Prerequisites
- Python 3.7+ (for mock API server)
- Modern web browser (Chrome, Firefox, or Edge recommended)

### Installation

1. Install Python dependencies:
```bash
pip install flask flask-cors pillow
```

2. Generate placeholder test images:
```bash
cd gaze_app
python scripts/generate_placeholder_images.py
```

Note: WebGazer.js has already been downloaded to `frontend/lib/webgazer.min.js`

### Running Locally

**Option 1: Use the startup script (easiest)**

Linux/Mac:
```bash
cd gaze_app
./scripts/start_local.sh
```

Windows:
```bash
cd gaze_app
scripts\start_local.bat
```

**Option 2: Manual setup**

Terminal 1 - Start the mock API server:
```bash
cd gaze_app
python scripts/mock_api.py
```

Terminal 2 - Serve the frontend:
```bash
cd gaze_app/frontend
python3 -m http.server 8000
```

**Access the application:**
- Open http://localhost:8000 in your browser
- Allow camera access when prompted
- Follow the on-screen instructions

## Project Structure

```
gaze_app/
├── frontend/              # Client-side web application
│   ├── index.html        # Main HTML file
│   ├── css/              # Stylesheets
│   ├── js/               # JavaScript files
│   ├── lib/              # External libraries (WebGazer.js)
│   └── images/           # Local test images
├── backend/              # AWS Lambda functions (for production)
│   └── functions/        # Individual Lambda functions
├── dashboard/            # Analytics dashboard (React)
├── infrastructure/       # AWS CDK infrastructure code
├── scripts/              # Utility scripts
│   └── mock_api.py      # Local development API server
└── README.md
```

## Development Workflow

### Local Development
1. Use the mock API server for backend (scripts/mock_api.py)
2. Place test images in `frontend/images/` directory
3. Test all functionality locally before deploying to AWS

### Testing Checklist
- [ ] Camera access works
- [ ] Calibration completes successfully
- [ ] Images display correctly
- [ ] Gaze tracking appears functional
- [ ] Data is saved to mock API
- [ ] Experiment completes without errors

## Configuration

Edit `frontend/js/config.js` to customize:
- Number of trials
- Trial duration
- Scramble methods and levels
- Image categories
- API endpoints (local vs production)

## Image Categories

### High-Attention (3 categories):
- Erotica
- Violence
- Gore

### Low-Attention (4 categories):
- Office Supplies
- Furniture
- Textures
- Noise (programmatically generated)

### Image Specifications:
- Format: JPEG
- Resolution: 800×600 pixels
- File size: <200KB each
- ~40 images per high-attention category
- ~30 images per low-attention category

## Scrambling Methods

The experiment tests 8 different scrambling methods:
1. **Phase** - Fourier phase scrambling
2. **Block** - Block shuffling
3. **Pixel** - Complete pixel scrambling
4. **Rotation** - Segment rotation
5. **Mosaic** - Blur/pixelation
6. **Edge** - Edge-preserved scrambling
7. **Color** - Color randomization
8. **Wavelet** - Wavelet scrambling

Each method is tested at 6 levels: 0%, 20%, 40%, 60%, 80%, 100%

## AWS Deployment

(Coming soon - requires AWS CDK setup)

### Prerequisites
- AWS Account
- AWS CDK installed
- AWS credentials configured

### Deploy Steps
```bash
cd infrastructure
npm install
cdk bootstrap
cdk deploy GazeTrackingBackend
cdk deploy GazeTrackingFrontend
cdk deploy GazeTrackingDashboard
```

## Research Questions

The experiment is designed to answer:
1. Do high-attention categories attract more fixation even when scrambled?
2. How does scramble level affect fixation preference?
3. Which scrambling methods best preserve attention-grabbing properties?
4. Do different scramble methods affect different image categories differently?
5. Is there a difference in first fixation vs sustained attention?
6. At what scramble level do images lose their attention-grabbing properties?

## Data Collection

### Per Trial:
- Trial metadata (images, scramble settings)
- ~90 gaze points (30Hz × 3 seconds)
- Aggregates (fixation times, first fixation, switches)

### Storage:
- **DynamoDB**: Session and trial metadata + aggregates
- **S3**: Detailed gaze points (cheaper, no size limits)

## Ethics & Privacy

- No personally identifiable information collected
- No webcam images stored (only gaze coordinates)
- Anonymous participant IDs
- Informed consent required
- IRB approval recommended for research use

## Troubleshooting

### Camera not working?
- Check browser permissions
- Ensure good lighting
- Try a different browser
- Check if another app is using the camera

### Calibration failing?
- Sit ~60cm from screen
- Keep head still during calibration
- Ensure face is well-lit
- Look naturally at the text

### Images not loading?
- Check console for errors
- Verify images exist in expected directories
- Check network tab for failed requests

## License

[Your license here]

## Contact

[Your contact information]
