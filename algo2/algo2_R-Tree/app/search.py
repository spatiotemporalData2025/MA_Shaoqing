import math


# ✅ Haversine 球面距离（米）
def haversine(lat1, lon1, lat2, lon2):
    R = 6371000.0
    toRad = math.radians
    dlat = toRad(lat2 - lat1)
    dlon = toRad(lon2 - lon1)

    a = (math.sin(dlat/2)**2 +
         math.cos(toRad(lat1)) * math.cos(toRad(lat2)) * math.sin(dlon/2)**2)

    return 2 * R * math.atan2(math.sqrt(a), math.sqrt(1 - a))


# ✅ 半径查询函数
def search_nearby(tree, lat, lon, radius):
    """
    输入：树、中心点经纬度、半径（米）
    输出：[{name, lat, lon, distance_m}, ...]
    """

    # -------------- 1) 先做一个粗略的“经纬度范围”框 --------------
    # 1度纬度 ≈ 111km
    delta_lat = radius / 111000.0
    # 1度经度 ≈ 111km * cos(lat)
    delta_lon = radius / (111000.0 * math.cos(math.radians(lat)))

    lat_min = lat - delta_lat
    lat_max = lat + delta_lat
    lon_min = lon - delta_lon
    lon_max = lon + delta_lon

    # -------------- 2) 用 R-Tree 做范围查询 --------------
    candidates = tree.range_query(lat_min, lon_min, lat_max, lon_max)

    # -------------- 3) 精确判断“是否在半径范围内” --------------
    results = []
    for p in candidates:
        d = haversine(lat, lon, p["lat"], p["lon"])
        if d <= radius:
            results.append({
                "name": p["name"],
                "lat": p["lat"],
                "lon": p["lon"],
                "distance_m": d
            })

    # -------------- 4) 按距离排序 --------------
    results.sort(key=lambda x: x["distance_m"])
    return results
