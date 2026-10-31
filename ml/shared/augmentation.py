"""
NaviAble AI — Shared Computer Vision Augmentation Pipeline
Provides realistic augmentations specifically designed for assistive mobility:
- Realistic brightness and contrast shifts (outdoor sunlight to indoor low-light)
- Cast shadows (trees, poles, buildings across roads/banknotes)
- Handheld camera motion blur
- Sensor noise (low-light camera CMOS noise)
- Perspective and rotation (handheld angle variance)
"""

import random
import numpy as np
from PIL import Image, ImageEnhance, ImageFilter, ImageDraw

def apply_brightness_contrast(img: Image.Image, brightness_range=(0.75, 1.25), contrast_range=(0.75, 1.25)) -> Image.Image:
    """Applies realistic ambient lighting and exposure variations."""
    b_factor = random.uniform(*brightness_range)
    c_factor = random.uniform(*contrast_range)
    
    enhancer = ImageEnhance.Brightness(img)
    img = enhancer.enhance(b_factor)
    
    enhancer = ImageEnhance.Contrast(img)
    img = enhancer.enhance(c_factor)
    return img

def apply_simulated_shadow(img: Image.Image, max_shadow_opacity=0.45) -> Image.Image:
    """Simulates realistic cast shadows across roads or handheld objects."""
    if random.random() > 0.5:
        return img
    
    w, h = img.size
    shadow_mask = Image.new('L', (w, h), 255)
    draw = ImageDraw.Draw(shadow_mask)
    
    # Random diagonal shadow band
    x1 = random.randint(0, w // 2)
    x2 = random.randint(w // 2, w)
    shadow_opacity = int(255 * (1.0 - random.uniform(0.25, max_shadow_opacity)))
    
    polygon = [(0, 0), (x1, 0), (x2, h), (0, h)]
    draw.polygon(polygon, fill=shadow_opacity)
    shadow_mask = shadow_mask.filter(ImageFilter.GaussianBlur(radius=random.randint(4, 12)))
    
    img_np = np.array(img).astype(np.float32)
    mask_np = np.array(shadow_mask).astype(np.float32) / 255.0
    
    for c in range(3):
        img_np[:, :, c] *= mask_np
        
    return Image.fromarray(np.clip(img_np, 0, 255).astype(np.uint8))

def apply_motion_blur(img: Image.Image, severity=(3, 7)) -> Image.Image:
    """Simulates walking or handheld camera jitter motion blur."""
    if random.random() > 0.6:
        return img
    radius = random.randint(*severity)
    return img.filter(ImageFilter.BoxBlur(radius))

def apply_sensor_noise(img: Image.Image, std_range=(5, 15)) -> Image.Image:
    """Simulates smartphone CMOS low-light sensor noise."""
    if random.random() > 0.5:
        return img
    img_np = np.array(img).astype(np.float32)
    std = random.uniform(*std_range)
    noise = np.random.normal(0, std, img_np.shape)
    noisy_img = np.clip(img_np + noise, 0, 255).astype(np.uint8)
    return Image.fromarray(noisy_img)

def realistic_assistive_augmentation(img: Image.Image) -> Image.Image:
    """Complete realistic augmentation chain for robust assistive model training."""
    img = apply_brightness_contrast(img)
    img = apply_simulated_shadow(img)
    img = apply_motion_blur(img)
    img = apply_sensor_noise(img)
    return img
