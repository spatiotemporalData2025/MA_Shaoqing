from app.build_index import build_rtree
from app.loader import load_pois
from app.visualize import visualize_all_mbrs_interactive
from app.search import search_nearby
import os

if __name__ == "__main__":

    print("========== Building R-Tree ==========")

    os.makedirs("output", exist_ok=True)

    # 1) Load convenience store POI data
    pois = load_pois("data/tokyo_convenience.csv")

    # 2) Build the R-tree (insertion progress will be printed automatically)
    tree = build_rtree("data/tokyo_convenience.csv")

    # 3) Generate an interactive HTML map (rectangle selection available)
    visualize_all_mbrs_interactive(tree, pois, "output/rtree_interactive.html")

    print("\n✅ Map generated: output/rtree_interactive.html")
    print("✅ You can draw a rectangle in the browser to filter convenience stores\n")

    # ---------------------------------------------------
    # ✅ Command-line search: Input lat/lon + radius
    # ---------------------------------------------------

    print("========== Nearby Convenience Store Search ==========")

    try:
        lat = float(input("👉 Enter latitude (e.g., 35.6895): "))
        lon = float(input("👉 Enter longitude (e.g., 139.6917): "))
        radius = float(input("👉 Enter search radius in meters (e.g., 500): "))
    except Exception:
        print("❌ Invalid input format")
        exit()

    # ✅ Call search_nearby()
    results = search_nearby(tree, lat, lon, radius)

    print(f"\n✅ Found {len(results)} convenience stores within {radius} meters")

    # Show the first 20 results
    for r in results[:20]:
        print(f"{r['name']:12s} | {r['distance_m']:.1f} m | ({r['lat']:.5f}, {r['lon']:.5f})")

    print("\n✅ Search completed")

