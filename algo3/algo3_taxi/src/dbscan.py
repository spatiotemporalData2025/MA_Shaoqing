# -*- coding: utf-8 -*-
"""
dbscan.py
手写 DBSCAN 聚类算法
-------------------------------------
输入：二维点集 X（平面坐标，单位：米）
输出：每个点的簇标签 labels（-1 表示噪声）

注意：为便于理解，本版为 O(N^2) 的朴素实现
"""

import numpy as np
from collections import deque


def region_query(X, point_idx, eps):
    """
    查找 eps 半径内的邻居
    X: (N,2) 点集
    point_idx: 当前点索引
    eps: 距离阈值（米）
    """
    diff = X - X[point_idx]  # shape: (N,2)
    dist_sq = np.einsum('ij,ij->i', diff, diff)  # L2 距离的平方
    return np.where(dist_sq <= eps * eps)[0]     # 返回索引列表


def dbscan(X, eps, min_pts):
    """
    执行 DBSCAN 聚类
    X: 数据点集 (N,2)
    eps: 邻域半径（米）
    min_pts: 最少核心点数量
    返回：
        labels: (N,) 每个点所在簇的编号 (-1=噪声)
    """
    n = X.shape[0]
    labels = np.full(n, -1)  # 初始化全部为噪声
    visited = np.zeros(n, dtype=bool)
    cluster_id = 0

    for i in range(n):
        if visited[i]:
            continue
        
        visited[i] = True
        neighbors = region_query(X, i, eps)

        # 小于 min_pts，暂定噪声
        if neighbors.size < min_pts:
            continue

        # 否则创建新簇
        labels[i] = cluster_id
        queue = deque(neighbors.tolist())

        while queue:
            j = queue.popleft()

            if not visited[j]:
                visited[j] = True
                neighbors_j = region_query(X, j, eps)
                if neighbors_j.size >= min_pts:
                    # 核心点扩展
                    queue.extend(neighbors_j.tolist())

            # 未分配簇的点加入当前簇
            if labels[j] == -1:
                labels[j] = cluster_id

        cluster_id += 1

    return labels
