import numpy as np
import folium
import matplotlib.cm as cm
import matplotlib.colors as colors
from pathlib import Path

from dbscan import dbscan

DATA_XY = Path("../data/processed/pickups_sample.npy")
DATA_LL = Path("../data/processed/pickups_lonlat.npy")

eps = 300
min_pts = 20


def main():
    print("📥 Loading data...")
    X = np.load(DATA_XY)
    LL = np.load(DATA_LL)

    print("🚀 Running DBSCAN...")
    labels = dbscan(X, eps, min_pts)

    print("🎨 Drawing map...")
    m = folium.Map(location=[40.75, -74.0], zoom_start=11)

    unique_labels = sorted(set(labels))
    cluster_labels = [c for c in unique_labels if c != -1]

    # Assign colors to clusters
    colormap = cm.get_cmap("tab20", len(cluster_labels))
    norm = colors.Normalize(vmin=0, vmax=len(cluster_labels)-1)
    cluster_colors = {}

    for idx, c in enumerate(cluster_labels):
        cluster_colors[c] = colors.to_hex(colormap(norm(idx)))

    # Draw points
    for (lon, lat), label in zip(LL, labels):
        if label == -1:  # Noise
            color = "gray"
            radius = 1.5
            op = 0.25
        else:
            color = cluster_colors[label]
            radius = 3.2
            op = 0.85

        folium.CircleMarker(
            location=[lat, lon],
            radius=radius,
            color=color,
            opacity=op,
            fill=True,
            fill_color=color,
            fill_opacity=op,
        ).add_to(m)

    # Build HTML legend (English)
    legend_html = """
    <div style="
        position: fixed; 
        bottom: 30px; left: 30px; width: 220px; height: auto; 
        background-color: white; opacity: 0.9; z-index:9999;
        padding: 10px; font-size: 14px;
        border: 1px solid #555;">
        <b>Legend</b><br>
        <span style="color: gray;">●</span> Noise (Outliers)<br>
    """

    # Append cluster legends
    for c in cluster_labels:
        legend_html += f"""<span style="color:{cluster_colors[c]};">●</span> Cluster {c}<br>"""

    legend_html += "</div>"
    m.get_root().html.add_child(folium.Element(legend_html))

    m.save("../output/dbscan_map_full_legend.html")
    print("🎯 Map saved → output/dbscan_map_full_legend.html")


if __name__ == "__main__":
    main()

