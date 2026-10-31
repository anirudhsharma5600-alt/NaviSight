"""
NaviAble AI — Crowd Density and Proximity Analyzer
Analyzes spatial distribution of bounding boxes to distinguish isolated pedestrians from crowds.
"""

from typing import List, Dict, Any
import numpy as np

def analyze_crowd_density(boxes: List[Dict[str, Any]], frame_w: int, frame_h: int) -> Dict[str, Any]:
    """Evaluates person cluster density, centroids, and proximity trends."""
    person_boxes = [b for b in boxes if b.get("class", "").lower() == "person"]
    count = len(person_boxes)
    
    if count == 0:
        return {"state": "CLEAR", "count": 0, "is_crowd": False, "recommended_narration": None}
        
    if count >= 4:
        # Spatial clustering
        centers = []
        for p in person_boxes:
            bbox = p["bbox"] # [x, y, w, h]
            centers.append([bbox[0] + bbox[2] / 2, bbox[1] + bbox[3] / 2])
        centers = np.array(centers)
        avg_x = np.mean(centers[:, 0]) / frame_w
        
        pos = "ahead"
        if avg_x < 0.33:
            pos = "on your left"
        elif avg_x > 0.66:
            pos = "on your right"
            
        return {
            "state": "CROWD_NEARBY",
            "count": count,
            "is_crowd": True,
            "cluster_center": pos,
            "recommended_narration": f"A group of {count} people is nearby {pos}."
        }
        
    return {
        "state": "INDIVIDUALS",
        "count": count,
        "is_crowd": False,
        "recommended_narration": None
    }

