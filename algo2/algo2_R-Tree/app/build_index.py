from .loader import load_pois
from .utils import latlon_to_xy
from rtree.rect import Rect
from rtree.rtree import RTree

def build_rtree(csv_path):
    pois = load_pois(csv_path)
    tree = RTree(max_entries=32)   # 建议 32 或 64
    # 批量插入（见下）
    for i, p in enumerate(pois):
        x, y = latlon_to_xy(p["lat"], p["lon"])
        rect = Rect(x, y, x, y)
        tree.insert(rect, p)
        if (i+1) % 1000 == 0:
            print(f"Inserted {i+1}/{len(pois)}")
    return tree
