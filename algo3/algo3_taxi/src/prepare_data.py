# -*- coding: utf-8 -*-
"""
prepare_data.py
NYC Taxi DBSCAN 项目 - 数据预处理模块
-------------------------------------
功能：
1. 读取原始 NYC Taxi CSV 数据（只读上车经纬度列）
2. 经纬度过滤（保留纽约市合理范围内数据）
3. 随机抽样 50,000 点
4. 经纬度转换为近似米单位的平面坐标
5. 保存为 .npy 格式，便于后续聚类快速加载

输出文件：
data/processed/pickups_sample.npy    # ndarray, shape (N,2)
"""

import pandas as pd
import numpy as np
from pathlib import Path


# ==============================
# 配置
# ==============================
RAW_CSV_PATH = Path("../data/raw/yellow_tripdata_2015-01.csv")
OUTPUT_PATH = Path("../data/processed/pickups_sample.npy")

# 抽样数量
N_SAMPLES = 50000


def load_and_process():
    print("📥 正在加载原始数据...")

    # 只读取经纬度列，加快速度、减少内存
    usecols = ["pickup_longitude", "pickup_latitude"]
    df = pd.read_csv(RAW_CSV_PATH, usecols=usecols)

    print(f"原始数据总行数: {len(df)}")

    # 经纬度过滤：只保留纽约市附近范围
    df = df[
        (df["pickup_longitude"] > -75) & (df["pickup_longitude"] < -72) &
        (df["pickup_latitude"]  >  40) & (df["pickup_latitude"]  <  42)
    ]

    print(f"经纬度清洗后剩余: {len(df)} 行")

    # 抽样
    df_sample = df.sample(
        n=min(N_SAMPLES, len(df)),
        random_state=42
    )

    # 经纬度 numpy
    lonlat = df_sample.to_numpy()  # shape: (N, 2)

    # 保存原始经纬度数据
    lonlat_path = OUTPUT_PATH.parent / "pickups_lonlat.npy"
    np.save(lonlat_path, lonlat)

    print(f"📌 已保存经纬度文件： {lonlat_path}")

    # 提取经纬度
    lon = lonlat[:, 0]
    lat = lonlat[:, 1]

    # 转换为米单位平面坐标
    X = lonlat_to_xy(lon, lat)

    # 保存平面坐标结果
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    np.save(OUTPUT_PATH, X)

    print(f"🎯 已保存平面坐标文件： {OUTPUT_PATH}")
    print(f"最终点数: {len(X)}，shape: {X.shape}")

    return X, lonlat



def lonlat_to_xy(lon, lat):
    """
    将经纬度转为平面近似坐标系 (单位: 米)
    参考点选纽约曼哈顿附近：
        经纬度(-74.0, 40.75)
    """

    # 基准点
    lon0 = -74.0
    lat0 = 40.75

    # 经纬度到米的换算
    meter_per_deg_lat = 110574   # 每1度纬度约110km
    meter_per_deg_lon = 111320 * np.cos(np.deg2rad(lat0))  # 随纬度变化

    x = (lon - lon0) * meter_per_deg_lon
    y = (lat - lat0) * meter_per_deg_lat

    return np.vstack([x, y]).T  # shape: (N,2)


if __name__ == "__main__":
    load_and_process()
