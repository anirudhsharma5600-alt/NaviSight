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

def draw_code_editor(draw, width, height):
    """Simulates a dark-mode code editor (like VS Code / PyCharm)."""
    # Background
    bg_color = random.choice([(30, 30, 30), (24, 24, 32), (13, 17, 23), (40, 44, 52)])
    draw.rectangle([0, 0, width, height], fill=bg_color)
    
    # Top tab bar
    draw.rectangle([0, 0, width, 18], fill=(20, 20, 25))
    draw.rectangle([10, 2, 80, 18], fill=(30, 30, 35))
    draw.text((15, 4), "index.ts", fill=(200, 200, 200))
    draw.rectangle([85, 2, 150, 18], fill=(25, 25, 30))
    draw.text((90, 4), "App.tsx", fill=(130, 130, 130))
    
    # Left sidebar / line numbers
    draw.rectangle([0, 18, 25, height], fill=(25, 25, 28))
    for line_num, y in enumerate(range(24, height - 10, 12), start=1):
        draw.text((4, y), f"{line_num:2d}", fill=(90, 90, 95))
        
    # Code syntax lines
    keywords = ["const", "let", "function", "import", "export", "async", "await", "return", "if", "for"]
    var_names = ["userToken", "banknoteId", "amount", "totalSum", "currencyState", "deviceOrientation"]
    syntax_colors = [
        (86, 156, 214),   # Blue keyword
        (206, 145, 120),  # Orange string
        (106, 153, 85),   # Green comment
        (220, 220, 170),  # Yellow function
        (156, 220, 254),  # Light blue variable
        (181, 206, 168),  # Numbers
    ]
    
    for y in range(24, height - 10, 12):
        indent = random.choice([30, 40, 50, 60])
        curr_x = indent
        num_tokens = random.randint(2, 6)
        for _ in range(num_tokens):
            if curr_x >= width - 20:
                break
            tok_color = random.choice(syntax_colors)
            tok_len = random.randint(15, 40)
            draw.rectangle([curr_x, y + 2, curr_x + tok_len, y + 8], fill=tok_color)
            curr_x += tok_len + random.randint(4, 10)

def draw_web_page(draw, width, height):
    """Simulates a browser displaying web text and ₹ prices."""
    draw.rectangle([0, 0, width, height], fill=(245, 247, 250))
    # Browser bar
    draw.rectangle([0, 0, width, 22], fill=(230, 233, 238))
    draw.rectangle([40, 3, width - 40, 19], fill=(255, 255, 255))
    draw.text((45, 5), "https://shop.example.in/products", fill=(100, 100, 100))
    
    # Heading & content
    draw.rectangle([15, 30, width - 30, 45], fill=(30, 41, 59))
    draw.text((20, 32), "E-Commerce Catalog", fill=(255, 255, 255))
    
    # Items with price tags (including Rupee symbol)
    for row, y in enumerate(range(55, height - 20, 35)):
        draw.rectangle([15, y, 40, y + 25], fill=(200, 210, 220)) # thumbnail
        draw.rectangle([48, y + 2, width - 70, y + 10], fill=(70, 80, 95)) # title
        # Price text
        price_val = random.choice(["199", "499", "1,200", "500", "100", "2,499"])
        draw.text((48, y + 12), f"Price: Rs. {price_val}", fill=(20, 150, 60))
        draw.rectangle([width - 55, y + 5, width - 15, y + 22], fill=(255, 120, 0)) # Buy button

def draw_mobile_phone(draw, width, height):
    """Simulates a mobile phone screen with app interface."""
    # Outer dark phone bezel
    draw.rectangle([0, 0, width, height], fill=(15, 15, 20))
    screen_rect = [20, 15, width - 20, height - 15]
    draw.rectangle(screen_rect, fill=(240, 242, 245))
    
    # Top notch / camera punch hole
    draw.ellipse([width // 2 - 5, 18, width // 2 + 5, 28], fill=(15, 15, 20))
    
    # Chat app bubbles
    chat_y = 35
    for _ in range(3):
        # Left incoming bubble
        draw.rounded_rectangle([25, chat_y, width - 70, chat_y + 20], radius=5, fill=(255, 255, 255))
        draw.rectangle([30, chat_y + 6, width - 85, chat_y + 14], fill=(180, 185, 190))
        chat_y += 26
        # Right outgoing bubble
        draw.rounded_rectangle([60, chat_y, width - 25, chat_y + 20], radius=5, fill=(220, 248, 198))
        draw.rectangle([68, chat_y + 6, width - 40, chat_y + 14], fill=(100, 160, 110))
        chat_y += 28

def draw_receipt_or_document(draw, width, height):
    """Simulates receipts, invoices, book pages, white paper."""
    draw.rectangle([0, 0, width, height], fill=random.choice([(250, 250, 248), (255, 255, 255), (242, 240, 235)]))
    
    # Receipt header
    draw.rectangle([width // 4, 15, width * 3 // 4, 25], fill=(40, 40, 40))
    
    # Divider line
    draw.line([(15, 32), (width - 15, 32)], fill=(180, 180, 180), width=1)
    
    # Text lines
    for y in range(40, height - 35, 10):
        w1 = random.randint(40, 80)
        draw.rectangle([20, y, 20 + w1, y + 4], fill=(100, 100, 100))
        w2 = random.randint(20, 40)
        draw.rectangle([width - 20 - w2, y, width - 20, y + 4], fill=(70, 70, 70))
        
    # Total
    draw.line([(15, height - 30), (width - 15, height - 30)], fill=(120, 120, 120), width=2)
    draw.text((20, height - 25), "TOTAL: INR 350.00", fill=(20, 20, 20))

def draw_keyboard_and_desk(draw, width, height):
    """Simulates computer keyboard keys and desk surfaces."""
    # Desk wood / dark plastic
    desk_color = random.choice([(140, 90, 50), (45, 45, 50), (80, 80, 85), (200, 200, 205)])
    draw.rectangle([0, 0, width, height], fill=desk_color)
    
    # Keyboard area
    kb_y_start = 30
    draw.rectangle([10, kb_y_start, width - 10, height - 10], fill=(25, 25, 28))
    
    # Key grid
    key_size = 14
    for r, ky in enumerate(range(kb_y_start + 8, height - 18, 18)):
        for c, kx in enumerate(range(18, width - 20, 18)):
            draw.rectangle([kx, ky, kx + key_size, ky + key_size], fill=(50, 50, 55))
            draw.rectangle([kx + 2, ky + 2, kx + key_size - 2, ky + key_size - 2], fill=(65, 65, 70))

def draw_isolated_rupee_symbol(draw, width, height):
    """Simulates isolated ₹ symbols on plain paper or sign."""
    bg = random.choice([(255, 255, 255), (240, 240, 240), (20, 30, 45)])
    fg = (20, 20, 20) if bg[0] > 100 else (240, 240, 240)
    draw.rectangle([0, 0, width, height], fill=bg)
    
    # Draw stylized ₹ symbol using geometric lines
    cx, cy = width // 2, height // 2
    # Upper horizontal bar
    draw.rectangle([cx - 30, cy - 40, cx + 30, cy - 32], fill=fg)
    # Middle horizontal bar
    draw.rectangle([cx - 30, cy - 20, cx + 25, cy - 12], fill=fg)
    # Vertical stem & top arc
    draw.rectangle([cx - 20, cy - 40, cx - 12, cy + 10], fill=fg)
    draw.arc([cx - 20, cy - 35, cx + 20, cy + 5], start=270, end=90, fill=fg, width=8)
    # Diagonal leg
    draw.line([(cx - 10, cy + 5), (cx + 30, cy + 45)], fill=fg, width=8)

def draw_lcd_display_photo(draw, width, height):
    """Simulates a photo of a banknote shown on an LCD screen (Moiré pattern & pixels)."""
    # Laptop screen border
    draw.rectangle([0, 0, width, height], fill=(18, 18, 22))
    draw.rectangle([10, 10, width - 10, height - 10], fill=(220, 220, 235))
    
    # Moiré pattern lines (scanlines across screen)
    for y in range(10, height - 10, 3):
        draw.line([(10, y), (width - 10, y)], fill=(190, 190, 210), width=1)
        
    # Blue/purple glow common on laptop screens
    draw.rectangle([25, 25, width - 25, height - 25], fill=(100, 120, 180))
    draw.text((35, 35), "[Digital Photo on Screen]", fill=(255, 255, 255))

def generate_negative_sample(width=224, height=224):
    """Creates a realistic hard-negative PIL Image."""
    img = Image.new('RGB', (width, height))
    draw = ImageDraw.Draw(img)
    
    choice = random.choice([
        'code_editor',
        'code_editor',
        'web_page',
        'web_page',
        'mobile_phone',
        'receipt_document',
        'keyboard_desk',
        'isolated_rupee',
        'lcd_display',
    ])
    
    if choice == 'code_editor':
        draw_code_editor(draw, width, height)
    elif choice == 'web_page':
        draw_web_page(draw, width, height)
    elif choice == 'mobile_phone':
        draw_mobile_phone(draw, width, height)
    elif choice == 'receipt_document':
        draw_receipt_or_document(draw, width, height)
    elif choice == 'keyboard_desk':
        draw_keyboard_and_desk(draw, width, height)
    elif choice == 'isolated_rupee':
        draw_isolated_rupee_symbol(draw, width, height)
    elif choice == 'lcd_display':
        draw_lcd_display_photo(draw, width, height)
        
    # Random perspective transform / rotation / scale to simulate handheld phone pointing at it
    angle = random.uniform(-10, 10)
    img = img.rotate(angle, resample=Image.Resampling.BILINEAR)
    
    # Subtle brightness / contrast perturbation
    img = ImageEnhance.Brightness(img).enhance(random.uniform(0.80, 1.25))
    img = ImageEnhance.Contrast(img).enhance(random.uniform(0.85, 1.20))
    
    # Camera blur
    if random.random() < 0.20:
        img = img.filter(ImageFilter.GaussianBlur(radius=random.uniform(0.4, 0.9)))
        
    # Sensor noise
    arr = np.array(img, dtype=np.int16)
    noise = np.random.normal(0, random.uniform(1.5, 4.0), arr.shape)
    arr = np.clip(arr + noise, 0, 255).astype(np.uint8)
    return Image.fromarray(arr)

def main():
    splits = {
        'train': 220,
        'val': 30,
        'test': 30,
    }
    
    print("=" * 60)
    print("  NAVIABLE AI — HARD NEGATIVE DATASET GENERATOR")
    print("=" * 60)
    
    total_created = 0
    for split_name, count in splits.items():
        split_dir = os.path.join(DATASET_DIR, split_name, 'NEGATIVE')
        os.makedirs(split_dir, exist_ok=True)
        
        # Clean existing negatives if any
        for f in os.listdir(split_dir):
            os.remove(os.path.join(split_dir, f))
            
        print(f"Generating {count} hard negatives for {split_name}/NEGATIVE...")
        for i in range(count):
            img = generate_negative_sample(224, 224)
            img_path = os.path.join(split_dir, f"neg_{split_name}_{i:04d}.jpg")
            img.save(img_path, quality=92)
            total_created += 1
            
    print(f"\n[SUCCESS] Successfully generated {total_created} hard negative samples!")
    print(f"Classes will now be 8: 10, 20, 50, 100, 200, 500, 2000, NEGATIVE")

if __name__ == '__main__':
    main()
