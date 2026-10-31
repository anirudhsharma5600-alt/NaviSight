import os
import random
import glob
from PIL import Image, ImageEnhance, ImageFilter
import numpy as np

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
RAW_DIR = os.path.join(BASE_DIR, 'raw_samples')
DATASET_DIR = os.path.join(BASE_DIR, 'dataset')

CLASSES = ['10', '20', '50', '100', '200', '500', '2000']

# Target splits
NUM_TRAIN_PER_CLASS = 220
NUM_VAL_PER_CLASS = 30
NUM_TEST_PER_CLASS = 30

def create_synthetic_background(width, height):
    """Generates realistic surface textures: wood, desk, marble, fabric, paper."""
    bg_type = random.choice(['neutral', 'wood', 'dark_desk', 'fabric', 'paper'])
    if bg_type == 'neutral':
        c = random.randint(180, 240)
        return Image.new('RGB', (width, height), (c, c, c))
    elif bg_type == 'dark_desk':
        c = random.randint(30, 70)
        return Image.new('RGB', (width, height), (c, c, c))
    elif bg_type == 'wood':
        base = np.zeros((height, width, 3), dtype=np.uint8)
        r = random.randint(130, 180)
        g = random.randint(80, 120)
        b = random.randint(40, 70)
        base[:, :] = [r, g, b]
        noise = np.random.randint(-15, 15, (height, width, 3), dtype=np.int16)
        base = np.clip(base.astype(np.int16) + noise, 0, 255).astype(np.uint8)
        return Image.fromarray(base)
    elif bg_type == 'paper':
        base = np.ones((height, width, 3), dtype=np.uint8) * random.randint(230, 250)
        noise = np.random.randint(-10, 10, (height, width, 3), dtype=np.int16)
        base = np.clip(base.astype(np.int16) + noise, 0, 255).astype(np.uint8)
        return Image.fromarray(base)
    else: # fabric
        base = np.zeros((height, width, 3), dtype=np.uint8)
        c = random.randint(80, 160)
        base[:, :] = [c, c, c]
        noise = np.random.randint(-25, 25, (height, width, 3), dtype=np.int16)
        base = np.clip(base.astype(np.int16) + noise, 0, 255).astype(np.uint8)
        return Image.fromarray(base)

def augment_banknote(raw_img: Image.Image, out_size=(224, 224), is_test=False) -> Image.Image:
    """Applies realistic camera captures: angle, scale, lighting, folds, blur."""
    bg = create_synthetic_background(out_size[0], out_size[1])
    
    note = raw_img.convert('RGBA')
    
    # Scale note to fit realistic fraction of viewport (60% to 92%)
    target_scale = random.uniform(0.60, 0.95) if not is_test else random.uniform(0.70, 0.90)
    w_ratio = (out_size[0] * target_scale) / note.width
    new_w = max(50, int(note.width * w_ratio))
    new_h = max(25, int(note.height * w_ratio))
    note = note.resize((new_w, new_h), Image.Resampling.BILINEAR)
    
    # Rotation (-25 to +25 deg, occasionally 180 flip)
    angle = random.uniform(-25, 25)
    if random.random() < 0.15 and not is_test:
        angle += 180
    note = note.rotate(angle, resample=Image.Resampling.BICUBIC, expand=True)
    
    # Lighting & Color Jitter
    rgb_note = note.convert('RGB')
    
    # Brightness (0.75 - 1.30)
    b_factor = random.uniform(0.75, 1.30)
    rgb_note = ImageEnhance.Brightness(rgb_note).enhance(b_factor)
    
    # Contrast (0.80 - 1.25)
    c_factor = random.uniform(0.80, 1.25)
    rgb_note = ImageEnhance.Contrast(rgb_note).enhance(c_factor)
    
    # Color Saturation (0.85 - 1.20)
    s_factor = random.uniform(0.85, 1.20)
    rgb_note = ImageEnhance.Color(rgb_note).enhance(s_factor)
    
    # Camera blur / defocus simulation (12% chance)
    if random.random() < 0.12:
        rgb_note = rgb_note.filter(ImageFilter.GaussianBlur(radius=random.uniform(0.4, 1.0)))
        
    # Recombine alpha
    note = Image.merge('RGBA', (*rgb_note.split(), note.split()[3]))
    
    # Position note onto background
    bg_w, bg_h = out_size
    paste_x = (bg_w - note.width) // 2 + random.randint(-15, 15)
    paste_y = (bg_h - note.height) // 2 + random.randint(-10, 10)
    
    bg.paste(note, (paste_x, paste_y), note)
    
    # Add subtle sensor noise
    if random.random() < 0.3:
        arr = np.array(bg, dtype=np.int16)
        noise = np.random.normal(0, random.uniform(2, 6), arr.shape)
        arr = np.clip(arr + noise, 0, 255).astype(np.uint8)
        bg = Image.fromarray(arr)
        
    return bg

def main():
    print(f"[INFO] Generating balanced train/val/test splits in: {DATASET_DIR}")
    random.seed(42)
    np.random.seed(42)
    
    for split in ['train', 'val', 'test']:
        for cls in CLASSES:
            os.makedirs(os.path.join(DATASET_DIR, split, cls), exist_ok=True)
            
    for cls in CLASSES:
        # Find all raw samples for this denomination (both modern and older/legacy designs)
        raw_files = []
        for f in os.listdir(RAW_DIR):
            name, ext = os.path.splitext(f)
            if ext.lower() in ['.jpg', '.jpeg', '.png']:
                # Match patterns: '500_obverse', '500_reverse', '500_old_obverse', '500_old_reverse'
                parts = name.split('_')
                if parts[0] == cls:
                    raw_files.append(os.path.join(RAW_DIR, f))
                    
        if not raw_files:
            print(f"[WARN] No raw samples found for class {cls}!")
            continue
            
        print(f"[PROCESSING] Class INR_{cls} with {len(raw_files)} raw design templates:")
        loaded_imgs = []
        for rf in sorted(raw_files):
            img = Image.open(rf)
            loaded_imgs.append(img)
            print(f"   • {os.path.basename(rf)}: {img.size}")
            
        # Train Split
        for i in range(NUM_TRAIN_PER_CLASS):
            raw = loaded_imgs[i % len(loaded_imgs)]
            aug = augment_banknote(raw, out_size=(224, 224), is_test=False)
            out_file = os.path.join(DATASET_DIR, 'train', cls, f"note_{cls}_tr_{i:04d}.jpg")
            aug.save(out_file, 'JPEG', quality=90)
            
        # Val Split
        for i in range(NUM_VAL_PER_CLASS):
            raw = loaded_imgs[i % len(loaded_imgs)]
            aug = augment_banknote(raw, out_size=(224, 224), is_test=False)
            out_file = os.path.join(DATASET_DIR, 'val', cls, f"note_{cls}_val_{i:04d}.jpg")
            aug.save(out_file, 'JPEG', quality=92)
            
        # Test Split (Independent evaluation)
        for i in range(NUM_TEST_PER_CLASS):
            raw = loaded_imgs[i % len(loaded_imgs)]
            aug = augment_banknote(raw, out_size=(224, 224), is_test=True)
            out_file = os.path.join(DATASET_DIR, 'test', cls, f"note_{cls}_test_{i:04d}.jpg")
            aug.save(out_file, 'JPEG', quality=95)
            
    total_train = NUM_TRAIN_PER_CLASS * len(CLASSES)
    total_val = NUM_VAL_PER_CLASS * len(CLASSES)
    total_test = NUM_TEST_PER_CLASS * len(CLASSES)
    print(f"\n[SUCCESS] Multi-Series Dataset generated successfully:")
    print(f"  • Train: {total_train} images ({NUM_TRAIN_PER_CLASS} per class)")
    print(f"  • Val:   {total_val} images ({NUM_VAL_PER_CLASS} per class)")
    print(f"  • Test:  {total_test} images ({NUM_TEST_PER_CLASS} per class)")
    print(f"  • Total: {total_train + total_val + total_test} images across {len(CLASSES)} denominations (modern + legacy)")

if __name__ == '__main__':
    main()
