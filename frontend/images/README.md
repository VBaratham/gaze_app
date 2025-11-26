# Image Directory

This directory contains the stimulus images for the gaze tracking experiment.

## Directory Structure

```
images/
├── erotica/          # High-attention category (~40 images)
├── violence/         # High-attention category (~40 images)
├── gore/             # High-attention category (~40 images)
├── office-supplies/  # Low-attention category (~30 images)
├── furniture/        # Low-attention category (~30 images)
├── textures/         # Low-attention category (~30 images)
└── noise/            # Low-attention category (~30 images)
```

## Image Specifications

- **Format**: JPEG (.jpg)
- **Resolution**: 800×600 pixels (4:3 aspect ratio)
- **File size**: <200KB each (for fast loading)
- **Naming**: Sequential numbers (1.jpg, 2.jpg, etc.)

## Adding Images

1. Place images in the appropriate category directory
2. Name them sequentially: 1.jpg, 2.jpg, 3.jpg, etc.
3. Ensure images meet the specifications above
4. Update manifest.json with the new image count

## For Local Testing

You can use placeholder images for testing:
- Generate solid color images
- Use sample images from placeholder services
- Create simple geometric patterns

## For Production

In production, images will be:
- Stored in Amazon S3
- Served via CloudFront CDN
- Referenced via manifest.json
- Not bundled with the frontend

## Important Notes

- **Ethics**: Ensure you have proper permissions/licenses for all images
- **Privacy**: Do not include images with identifiable people without consent
- **Content**: Be mindful of disturbing content - follow IRB guidelines
- **Copyright**: Only use images you have rights to use
