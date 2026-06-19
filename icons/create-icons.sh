#!/bin/bash
# This script creates placeholder PNG icons
# For production, replace with proper icons using the SVG file

# Create simple colored squares as placeholders
for size in 16 48 128; do
  # Using Python to create simple PNG (works on most systems)
  python3 << PYTHON
from PIL import Image, ImageDraw
import os

size = $size
img = Image.new('RGB', (size, size), color='#FF6B35')
draw = ImageDraw.Draw(img)

# Draw simple sync icon
white = '#FFFFFF'
# Draw layered lines
for i in range(3):
    y = size * (0.3 + i * 0.2)
    draw.line([(size*0.2, y), (size*0.8, y)], fill=white, width=max(2, size//32))

img.save(f'icon{size}.png')
print(f'Created icon{size}.png')
PYTHON
done
