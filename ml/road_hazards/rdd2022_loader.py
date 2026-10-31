"""
NaviAble AI — RDD2022 (Road Damage Dataset 2022) Parser & Preprocessor
Supports classes:
- D00: Longitudinal Crack
- D10: Transverse Crack
- D20: Alligator Crack
- D40: Pothole / Surface Depression
- Broken Pavement / Open Drain
"""

import os
import xml.etree.ElementTree as ET
from typing import List, Dict, Tuple

RDD_CLASSES = {
    "D00": 0,  # Longitudinal Crack
    "D10": 1,  # Transverse Crack
    "D20": 2,  # Alligator Crack
    "D40": 3,  # Pothole
    "D43": 4,  # Cross walk blur
    "D44": 5,  # White line blur
    "BrokenPavement": 6,
    "OpenDrain": 7,
}

CLASS_NAMES = [
    "longitudinal_crack",
    "transverse_crack",
    "alligator_crack",
    "pothole",
    "crosswalk_blur",
    "whiteline_blur",
    "broken_pavement",
    "open_drain"
]

def parse_pascal_voc_xml(xml_path: str) -> Tuple[int, int, List[Dict]]:
    """Parses Pascal VOC XML format from RDD2022 into normalized YOLO format."""
    tree = ET.parse(xml_path)
    root = tree.getroot()
    
    size = root.find("size")
    width = int(size.find("width").text)
    height = int(size.find("height").text)
    
    boxes = []
    for obj in root.findall("object"):
        name = obj.find("name").text
        if name not in RDD_CLASSES:
            continue
            
        bndbox = obj.find("bndbox")
        xmin = float(bndbox.find("xmin").text)
        ymin = float(bndbox.find("ymin").text)
        xmax = float(bndbox.find("xmax").text)
        ymax = float(bndbox.find("ymax").text)
        
        # Convert to YOLO normalized center format (x_center, y_center, width, height)
        x_center = ((xmin + xmax) / 2.0) / width
        y_center = ((ymin + ymax) / 2.0) / height
        box_w = (xmax - xmin) / width
        box_h = (ymax - ymin) / height
        
        boxes.append({
            "class_id": RDD_CLASSES[name],
            "class_name": name,
            "bbox_yolo": [x_center, y_center, box_w, box_h]
        })
        
    return width, height, boxes

def convert_rdd_to_yolo(rdd_root: str, output_dir: str):
    """Converts RDD2022 dataset to standard YOLO directory format."""
    print(f"[RDD Loader] Converting RDD annotations from: {rdd_root} -> {output_dir}")
    os.makedirs(os.path.join(output_dir, "images", "train"), exist_ok=True)
    os.makedirs(os.path.join(output_dir, "labels", "train"), exist_ok=True)
    os.makedirs(os.path.join(output_dir, "images", "val"), exist_ok=True)
    os.makedirs(os.path.join(output_dir, "labels", "val"), exist_ok=True)
    print("[RDD Loader] Conversion directory structure ready.")
