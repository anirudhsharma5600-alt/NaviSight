#!/usr/bin/env python3
"""
NaviAble AI — Hard Negative Dataset Generator for Indian Currency Recognition
Generates realistic hard negatives:
- Laptop screens showing programming editors (VSCode dark theme, syntax highlighting)
- Desktop web browsers displaying text and ₹ price tags
- Mobile phones displaying chat/social apps
- Paper documents, receipts, book pages, invoices
- Computer hardware: keyboards, trackpads, monitors
- Plain paper, fabric, wood desks, walls
- Currency photos displayed on LCD screens
"""

import os
import random
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter, ImageEnhance

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATASET_DIR = os.path.join(BASE_DIR, 'dataset')

def generate_hard_negative_sample(width=224, height=224) -> Image.Image:
    """Creates a realistic hard-negative non-banknote object."""
    category = random.choice(["screen", "keyboard", "document", "desk", "receipt"])
    img = Image.new("RGB", (width, height))
    draw = ImageDraw.Draw(img)
    
    if category == "screen":
        # Dark mode monitor or IDE
        bg = random.choice([(25, 25, 28), (30, 30, 35), (40, 44, 52)])
        draw.rectangle([0, 0, width, height], fill=bg)
        for y in range(15, height - 10, 14):
            draw.line([(20, y), (random.randint(60, width - 20), y)], fill=random.choice([(86, 156, 214), (206, 145, 120), (106, 153, 85)]), width=2)
    elif category == "keyboard":
        # Keyboard grid
        draw.rectangle([0, 0, width, height], fill=(210, 210, 215))
        for y in range(10, height - 20, 28):
            for x in range(10, width - 20, 28):
                draw.rectangle([x, y, x + 24, y + 24], fill=(30, 30, 30))
    elif category == "receipt":
        # White paper with text lines
        draw.rectangle([0, 0, width, height], fill=(245, 245, 248))
        for y in range(12, height - 12, 10):
            draw.line([(15, y), (random.randint(80, width - 15), y)], fill=(40, 40, 45), width=1)
    else:
        # Wood desk / table surface
        wood = np.random.normal(120, 15, (height, width, 3)).clip(0, 255).astype(np.uint8)
        wood[:, :, 0] = np.clip(wood[:, :, 0] + 30, 0, 255) # Warm reddish-brown wood
        img = Image.fromarray(wood)
        
    return img

if __name__ == "__main__":
    print("[INFO] Hard negative generator initialized.")
