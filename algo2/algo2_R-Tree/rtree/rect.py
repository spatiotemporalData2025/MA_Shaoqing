class Rect:
    def __init__(self, xmin, ymin, xmax, ymax):
        self.xmin = xmin
        self.ymin = ymin
        self.xmax = xmax
        self.ymax = ymax

    # 拷贝（用于 choose_leaf 时不修改原矩形）
    def copy(self):
        return Rect(self.xmin, self.ymin, self.xmax, self.ymax)

    # 扩张到能包含另一个矩形
    def enlarge(self, other):
        self.xmin = min(self.xmin, other.xmin)
        self.ymin = min(self.ymin, other.ymin)
        self.xmax = max(self.xmax, other.xmax)
        self.ymax = max(self.ymax, other.ymax)

    # 面积
    def area(self):
        return (self.xmax - self.xmin) * (self.ymax - self.ymin)

    # 相交测试（范围查询用）
    def intersect(self, other):
        return not (
            self.xmax < other.xmin or
            self.xmin > other.xmax or
            self.ymax < other.ymin or
            self.ymin > other.ymax
        )

    # 打印
    def __repr__(self):
        return f"Rect({self.xmin}, {self.ymin}, {self.xmax}, {self.ymax})"
