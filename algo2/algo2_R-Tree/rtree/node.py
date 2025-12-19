class Node:
    def __init__(self, max_entries=8, leaf=False):
        self.children = []       # child Node 或 POI 数据
        self.rects = []          # 每个 child 对应的 MBR
        self.leaf = leaf
        self.max_entries = max_entries
        self.parent = None
