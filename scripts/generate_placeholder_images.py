#!/usr/bin/env python3
"""
Generate placeholder images for testing the gaze tracking experiment.
Creates simple colored images with text labels.
"""

from PIL import Image, ImageDraw, ImageFont
import os
import random

# Configuration
IMAGE_WIDTH = 800
IMAGE_HEIGHT = 600
OUTPUT_DIR = '../frontend/images'

# Category configurations
CATEGORIES = {
    'erotica': {'count': 5, 'color': (255, 100, 150), 'type': 'high'},
    'violence': {'count': 5, 'color': (200, 50, 50), 'type': 'high'},
    'gore': {'count': 5, 'color': (150, 0, 0), 'type': 'high'},
    'office-supplies': {'count': 5, 'color': (150, 150, 150), 'type': 'low'},
    'furniture': {'count': 5, 'color': (139, 90, 60), 'type': 'low'},
    'textures': {'count': 5, 'color': (200, 200, 180), 'type': 'low'},
    'noise': {'count': 5, 'color': (128, 128, 128), 'type': 'low'}
}


def generate_gradient_image(base_color, width, height, image_num):
    """Generate a gradient image with some variation"""
    img = Image.new('RGB', (width, height))
    draw = ImageDraw.Draw(img)

    # Add gradient
    for y in range(height):
        factor = y / height
        r = int(base_color[0] * (0.7 + 0.3 * factor))
        g = int(base_color[1] * (0.7 + 0.3 * factor))
        b = int(base_color[2] * (0.7 + 0.3 * factor))
        draw.line([(0, y), (width, y)], fill=(r, g, b))

    # Add some geometric shapes for variety
    shape_color = tuple(max(0, c - 50) for c in base_color)

    if image_num % 3 == 0:
        # Circle
        draw.ellipse([width//4, height//4, 3*width//4, 3*height//4],
                     outline=shape_color, width=5)
    elif image_num % 3 == 1:
        # Rectangle
        draw.rectangle([width//4, height//4, 3*width//4, 3*height//4],
                       outline=shape_color, width=5)
    else:
        # Line pattern
        for i in range(0, width, 50):
            draw.line([(i, 0), (i + height//2, height)],
                     fill=shape_color, width=3)

    return img


def add_text_label(img, text, category_type):
    """Add text label to image"""
    draw = ImageDraw.Draw(img)

    # Try to use a default font
    try:
        font = ImageFont.truetype("Arial.ttf", 36)
    except:
        font = ImageFont.load_default()

    # Add text with background
    text_bbox = draw.textbbox((0, 0), text, font=font)
    text_width = text_bbox[2] - text_bbox[0]
    text_height = text_bbox[3] - text_bbox[1]

    x = (img.width - text_width) // 2
    y = img.height - text_height - 40

    # Background rectangle
    padding = 10
    draw.rectangle([x - padding, y - padding,
                   x + text_width + padding, y + text_height + padding],
                  fill=(0, 0, 0, 180))

    # Text
    draw.text((x, y), text, fill=(255, 255, 255), font=font)

    return img


def generate_noise_image(width, height, image_num):
    """Generate random noise image"""
    img = Image.new('RGB', (width, height))
    pixels = img.load()

    # Create random noise
    random.seed(image_num)  # Consistent noise per image
    for y in range(height):
        for x in range(width):
            gray = random.randint(0, 255)
            pixels[x, y] = (gray, gray, gray)

    return img


def main():
    script_dir = os.path.dirname(os.path.abspath(__file__))
    base_output_dir = os.path.join(script_dir, OUTPUT_DIR)

    print("=" * 60)
    print("Generating Placeholder Images")
    print("=" * 60)

    for category, config in CATEGORIES.items():
        category_dir = os.path.join(base_output_dir, category)

        # Create directory if it doesn't exist
        os.makedirs(category_dir, exist_ok=True)

        print(f"\nGenerating {config['count']} images for '{category}'...")

        for i in range(1, config['count'] + 1):
            # Generate image
            if category == 'noise':
                img = generate_noise_image(IMAGE_WIDTH, IMAGE_HEIGHT, i)
            else:
                img = generate_gradient_image(config['color'], IMAGE_WIDTH, IMAGE_HEIGHT, i)

            # Add label
            label = f"{category.replace('-', ' ').title()} #{i}"
            img = add_text_label(img, label, config['type'])

            # Save
            output_path = os.path.join(category_dir, f"{i}.jpg")
            img.save(output_path, 'JPEG', quality=85)

            print(f"  Created: {output_path}")

    print("\n" + "=" * 60)
    print("Done! Placeholder images generated successfully.")
    print("=" * 60)
    print("\nNote: These are just placeholder images for testing.")
    print("Replace them with actual experimental stimuli before running the study.")


if __name__ == '__main__':
    try:
        main()
    except Exception as e:
        print(f"Error: {e}")
        print("\nMake sure you have Pillow installed:")
        print("  pip install Pillow")
