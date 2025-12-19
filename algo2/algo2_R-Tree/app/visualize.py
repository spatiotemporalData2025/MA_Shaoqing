import json
import folium
from folium.plugins import MarkerCluster, Draw


# ============================================================
# ✅ 递归收集 R-Tree 每一层的 MBR（用真实经纬度计算）
# ============================================================
def _collect_mbrs_latlon(node):
    """
    输入：R-Tree 的一个节点
    输出：
        rects: 当前节点子树的所有层级 MBR 列表（南、西、北、东）
        bounds: 当前节点整个子树的经纬度边界（南、西、北、东）
    """

    # -------- ✅ 叶子节点：从里面的 POI 获取经纬度矩形 --------
    if node.leaf:
        if not node.children:
            return [], None

        lats = [data["lat"] for (data, _) in node.children]
        lons = [data["lon"] for (data, _) in node.children]

        south, north = min(lats), max(lats)
        west,  east  = min(lons), max(lons)

        bounds = (south, west, north, east)
        return [bounds], bounds

    # -------- ✅ 内部节点：递归聚合子节点边界 --------
    all_rects = []
    lat_s = lon_w = lat_n = lon_e = None

    for (child_node, _) in node.children:
        child_rects, child_bounds = _collect_mbrs_latlon(child_node)
        if child_bounds is None:
            continue

        # 子节点矩形加入总列表
        all_rects.extend(child_rects)

        cs, cw, cn, ce = child_bounds
        lat_s = cs if lat_s is None else min(lat_s, cs)
        lon_w = cw if lon_w is None else min(lon_w, cw)
        lat_n = cn if lat_n is None else max(lat_n, cn)
        lon_e = ce if lon_e is None else max(lon_e, ce)

    if lat_s is None:
        return [], None

    bounds = (lat_s, lon_w, lat_n, lon_e)

    # 当前层的 MBR 也加入
    all_rects.append(bounds)
    return all_rects, bounds



# ============================================================
# ✅ 主函数：绘制 R-Tree MBR + POI + 鼠标框选查询
# ============================================================
def visualize_all_mbrs_interactive(tree, pois, html_path="output/rtree_interactive.html"):
    """
    功能：
    ✅ 显示 OSM 地图
    ✅ 显示所有 POI（带聚类）
    ✅ 显示 R-Tree 所有层级 MBR（蜘蛛网）
    ✅ 提供矩形绘图工具 → 实时筛选便利店
    ✅ 显示距离（使用 Haversine）
    """

    # --------------------- ✅ 创建基础地图 ---------------------
    m = folium.Map(location=[35.68, 139.70], zoom_start=11, control_scale=True)

    # --------------------- ✅ 添加 POI 聚类 ---------------------
    cluster = MarkerCluster().add_to(m)

    for p in pois:
        folium.Marker(
            location=[p["lat"], p["lon"]],
            popup=p["name"] or "POI"
        ).add_to(cluster)

    # --------------------- ✅ 获取所有层的 MBR ---------------------
    rects, _ = _collect_mbrs_latlon(tree.root)

    # --------------------- ✅ 绘制所有 MBR（红色矩形） ---------------------
    for (south, west, north, east) in rects:
        folium.Rectangle(
            bounds=[(south, west), (north, east)],
            color="#FF0000",
            weight=1,
            opacity=0.30,
            fill=False
        ).add_to(m)

    # --------------------- ✅ 把 POI 数据塞进 HTML 用于 JS 查询 ---------------------
    pois_json = json.dumps(
        [{"name": p["name"], "lat": p["lat"], "lon": p["lon"]} for p in pois],
        ensure_ascii=False
    )

    # ============================================================
    # ✅ 注：f-string + {{ }} → 避免 Python、JS 格式化冲突
    # ============================================================
    highlight_js = f"""
    <script>

    // ================================
    // ✅ 1. 加载 POI（由 Python 注入）
    // ================================
    const POIS = {pois_json};

    // ================================
    // ✅ 2. Haversine 距离（米）
    // ================================
    function haversine(lat1, lon1, lat2, lon2) {{
      const R = 6371000.0;
      const toRad = d => d * Math.PI / 180.0;

      const dphi = toRad(lat2 - lat1);
      const dlmb = toRad(lon2 - lon1);

      const a = Math.sin(dphi/2)**2 +
                Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dlmb/2)**2;

      return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    }}

    // ================================
    // ✅ 3. 高亮命中的 POI 的图层
    // ================================
    var resultLayer = L.layerGroup().addTo(window._leaflet_map);

    function clearResults() {{
        resultLayer.clearLayers();
    }}

    // ================================
    // ✅ 4. 显示查询结果的右上角面板
    // ================================
    var Info = L.control({{position: 'topright'}});
    Info.onAdd = function() {{
      this._div = L.DomUtil.create('div', 'leaflet-bar');
      this.update();
      return this._div;
    }};
    Info.update = function(html) {{
      this._div.innerHTML = html || '<div style="padding:8px;max-width:320px">点击左侧矩形工具，在地图上拖拽。</div>';
    }};
    Info.addTo(window._leaflet_map);

    // ================================
    // ✅ 5. 监听绘制矩形事件
    // ================================
    window._leaflet_map.on(L.Draw.Event.CREATED, function (e) {{

      clearResults();

      var layer = e.layer;
      var bounds = layer.getBounds();
      layer.addTo(resultLayer);

      var south = bounds.getSouth(),
          west  = bounds.getWest(),
          north = bounds.getNorth(),
          east  = bounds.getEast();

      var center = bounds.getCenter();

      var hits = [];

      // ✅ 过滤矩形内的 POI
      for (const p of POIS) {{
        if (p.lat >= south && p.lat <= north && p.lon >= west && p.lon <= east) {{
          const d = haversine(center.lat, center.lng, p.lat, p.lon);
          hits.push({{name:p.name, lat:p.lat, lon:p.lon, dist:d}});
        }}
      }}

      // ✅ 按距离排序
      hits.sort((a,b)=>a.dist-b.dist);

      // ✅ 在地图上标红点击 POI
      for (const h of hits) {{
        L.circleMarker([h.lat, h.lon], {{
            radius: 5,
            color:'#E60026',
            weight: 2,
            fillOpacity: 0.8
        }}).bindPopup(`${{h.name}}<br/>${{h.dist.toFixed(1)}} m`).addTo(resultLayer);
      }}

      // ✅ 构建右上角列表
      const list = hits.slice(0,30).map(
        h => `<li>${{h.name}} — ${{h.dist.toFixed(1)}} m</li>`
      ).join('');

      Info.update(`
        <div style="padding:8px;max-width:330px">
          <b>选区内共 ${{hits.length}} 家便利店</b><br/>
          <button onclick="clearResults()" style="margin-top:6px">清除结果</button>
          <ol style="max-height:320px;overflow:auto;margin-left:15px">
            ${list}
          </ol>
        </div>
      `);
    }});

    </script>
    """

    # ✅ 把当前地图对象暴露给 JS
    expose_map = """
    <script>
      window._leaflet_map = {{this._parent.get_name()}};
    </script>
    """

    # 注入 HTML
    m.get_root().html.add_child(folium.Element(expose_map))
    m.get_root().html.add_child(folium.Element(highlight_js))

    # 保存
    m.save(html_path)
    print(f"✅ 已输出交互地图：{html_path}")



