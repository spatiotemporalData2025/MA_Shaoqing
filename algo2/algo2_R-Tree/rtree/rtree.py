from .node import Node
from .rect import Rect


class RTree:
    def __init__(self, max_entries=32):
        self.M = max_entries
        self.root = Node(max_entries, leaf=True)

    # =====================================
    # 插入
    # =====================================
    def insert(self, rect, data):
        leaf = self._choose_leaf(self.root, rect)
        leaf.children.append((data, rect))

        if len(leaf.children) > self.M:
            self._split(leaf)

        self._adjust_tree(leaf)

    # =====================================
    # 选叶子
    # =====================================
    def _choose_leaf(self, node, rect):
        if node.leaf:
            return node

        best_child = None
        best_inc = float('inf')

        for child_node, child_rect in node.children:
            before = child_rect.area()
            new_rect = child_rect.copy()
            new_rect.enlarge(rect)
            inc = new_rect.area() - before
            if inc < best_inc:
                best_inc = inc
                best_child = child_node

        return self._choose_leaf(best_child, rect)

    # =====================================
    # 安全分裂（线性 split）
    # =====================================
    def _split(self, node):
        n = len(node.children)
        half = n // 2
        g1 = node.children[:half]
        g2 = node.children[half:]

        # 原 node 保留 g1
        node.children = g1

        # 新节点保存 g2
        new = Node(node.max_entries, leaf=node.leaf)
        new.children = g2

        # 父节点处理
        if node.parent is None:
            root = Node(node.max_entries, leaf=False)
            root.children = [
                (node, self._calc_rect(node)),
                (new, self._calc_rect(new))
            ]
            node.parent = root
            new.parent = root
            self.root = root
        else:
            p = node.parent
            # 更新旧的 node
            for i,(child,_) in enumerate(p.children):
                if child is node:
                    p.children[i] = (node, self._calc_rect(node))
                    break
            # 插入新的节点
            p.children.append((new, self._calc_rect(new)))
            new.parent = p

            if len(p.children) > self.M:
                self._split(p)

    # =====================================
    # 自底向上更新 MBR
    # =====================================
    def _adjust_tree(self, node):
        while node.parent:
            p = node.parent
            for i,(child,_) in enumerate(p.children):
                if child is node:
                    p.children[i] = (node, self._calc_rect(node))
            node = p

    # =====================================
    # 计算节点 MBR
    # =====================================
    def _calc_rect(self, node):
        xs, ys = [], []
        for data, rect in node.children:
            xs.extend([rect.xmin, rect.xmax])
            ys.extend([rect.ymin, rect.ymax])
        return Rect(min(xs), min(ys), max(xs), max(ys))

    # =====================================
    # 范围查询
    # =====================================
    def search(self, rect):
        return self._search(self.root, rect)

    def _search(self, node, rect):
        result = []
        for child_or_data, child_rect in node.children:
            if not child_rect.intersect(rect):
                continue
            if node.leaf:
                result.append(child_or_data)
            else:
                result.extend(self._search(child_or_data, rect))
        return result
    
    # =====================================
    # 采集所有 MBR（用于可视化）
    # =====================================
    def collect_mbrs(self, node=None):
        if node is None:
            node = self.root

        rects = [self._calc_rect(node)]

        if not node.leaf:
            for child_node, rect in node.children:
                rects.extend(self.collect_mbrs(child_node))

        return rects
    
     # ============================================================
    # ✅ R-Tree 范围查询（给 search_nearby 使用）
    #    输入：lat_min, lon_min, lat_max, lon_max
    #    输出：所有落在范围内的 POI（data 字典）
    # ============================================================
    def range_query(self, lat_min, lon_min, lat_max, lon_max):
        result = []
        stack = [self.root]

        while stack:
            node = stack.pop()

            # ==============================================
            # ✅ 动态计算当前节点的经纬度 MBR
            #    不依赖 node.bounds_latlon，安全稳定
            # ==============================================
            if node.leaf:
                lats = [data["lat"] for (data, _) in node.children]
                lons = [data["lon"] for (data, _) in node.children]
            else:
                lats = []
                lons = []
                for (child, _) in node.children:
                    # 叶子节点：直接从 POI 提取
                    if child.leaf:
                        lats.extend([d["lat"] for (d, _) in child.children])
                        lons.extend([d["lon"] for (d, _) in child.children])
                    else:
                        # 非叶：继续往下收集
                        for (cc, _) in child.children:
                            if cc.leaf:
                                lats.extend([d["lat"] for (d, _) in cc.children])
                                lons.extend([d["lon"] for (d, _) in cc.children])

            if not lats:  # 空节点
                continue

            ns, nw, nn, ne = min(lats), min(lons), max(lats), max(lons)

            # ==============================================
            # ✅ 若当前节点 MBR 与查询区域不相交 → 跳过
            # ==============================================
            if nn < lat_min or ns > lat_max or ne < lon_min or nw > lon_max:
                continue

            # ==============================================
            # ✅ 叶节点：检查每个 POI
            # ==============================================
            if node.leaf:
                for (data, _) in node.children:
                    if lat_min <= data["lat"] <= lat_max and lon_min <= data["lon"] <= lon_max:
                        result.append(data)
                continue

            # ==============================================
            # ✅ 非叶节点：继续下钻
            # ==============================================
            for (child, _) in node.children:
                stack.append(child)

        return result
