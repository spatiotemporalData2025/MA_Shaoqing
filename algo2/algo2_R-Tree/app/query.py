from rtree.rect import Rect
from .utils import latlon_to_xy
from app.utils import latlon_to_xy, haversine_distance

def search_nearby(tree, lat0, lon0, radius_m=500):
    """
    1) 先用矩形 R-tree 搜索（粗筛）
    2) 再用 haversine 精确筛选真实距离
    """

    # 把中心点变成 R-tree 的坐标系
    x0, y0 = latlon_to_xy(lat0, lon0)

    # 创建“方形搜索框”，长度 radius_m
    rect = Rect(x0 - radius_m, y0 - radius_m, x0 + radius_m, y0 + radius_m)

    # 用 R-tree 粗筛出所有可能的点
    candidates = tree.search(rect)

    results = []

    for p in candidates:
        d = haversine_distance(lat0, lon0, p["lat"], p["lon"])
        if d <= radius_m:
            results.append((p, d))

    # 按距离排序
    results.sort(key=lambda x: x[1])
    return results
def range_query(tree, lat_min, lon_min, lat_max, lon_max):
    x1, y1 = latlon_to_xy(lat_min, lon_min)
    x2, y2 = latlon_to_xy(lat_max, lon_max)
    rect = Rect(min(x1,x2), min(y1,y2), max(x1,x2), max(y1,y2))
    return tree.search(rect)

