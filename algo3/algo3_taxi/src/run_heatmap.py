# -*- coding: utf-8 -*-
import numpy as np
import folium
from folium.plugins import HeatMap
from pathlib import Path

DATA_LL = Path("../data/processed/pickups_lonlat.npy")

def main():
    print("📥 Loading geolocation data...")
    LL = np.load(DATA_LL)  # shape: (N,2) → (lon, lat)

    print("🔥 Creating HeatMap...")
    m = folium.Map(location=[40.75, -74.0], zoom_start=11)

    # Convert lon,lat → lat,lon order for folium
    heat_data = [[lat, lon] for lon, lat in LL]

    HeatMap(
        heat_data,
        radius=8,         # 点影响范围（可调）
        blur=10,          # 模糊度（可调）
        max_zoom=1,
        min_opacity=0.3
    ).add_to(m)

    out_path = "../output/taxi_heatmap.html"
    m.save(out_path)
    print(f"🎯 Heatmap saved → {out_path}")

if __name__ == "__main__":
    main()
