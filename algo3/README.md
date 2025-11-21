# DBSCAN とその発展に関する調査レポート
**Ester, M., Kriegel, H.-P., Sander, J., & Xu, X. (1996).**  
**“A Density-Based Algorithm for Discovering Clusters in Large Spatial Databases with Noise.” KDD'96.**

---

## 1. はじめに

本レポートでは，DBSCAN（Density-Based Spatial Clustering of Applications with Noise）を提案した **1996 年 KDD の原論文**を精読し，その内容を詳細に解説する。さらに DBSCAN の後続研究を調査し，それぞれの改良点，DBSCAN からの発展関係，文献情報を体系的にまとめる。

---

## 2. DBSCAN 原論文の概要

### 2.1 背景

1990 年代の主流クラスタリング手法（K-means など）は以下の課題を抱えていた：

- クラスタ数を事前に指定する必要  
- ノイズに弱い  
- 球状クラスタしか発見できない  

DBSCAN はこれを克服するため，

> **「高密度領域をクラスタ，低密度領域をノイズとみなす」**

という密度ベースの新概念を導入した。

---

### 2.2 基本概念

DBSCAN は **ε（半径）** と **MinPts（最小点数）** の 2 つを用いる。

点は以下の 3 種類に分類される：

```
● Core point（コア点）
　ε 近傍に MinPts 以上の点が存在

○ Border point（境界点）
　自分は MinPts を満たさないが，コア点の ε 内に存在

× Noise point（ノイズ点）
　どのクラスタにも属さない孤立点
```

---

### 2.3 密度到達可能性（Density-Reachability）

- **Density-Reachable**  
  コア点を鎖状にたどって到達できる点の関係

- **Density-Connected**  
  共通点を介して互いに density-reachable なら同一クラスタ

これにより**任意形状のクラスタ**を自然に検出可能となる。

---

### 2.4 アルゴリズムの流れと擬似コード

```
[未訪問の点を選択]
         |
         v
[ε 内の点数 ≥ MinPts ?]
     |            |
   Yes          No
     |            |
     v            v
[クラスタ拡張]   [Noise と仮定]
     |
     v
[密度到達可能点を探索し追加]
     |
     v
[クラスタ完成 → 次の点へ]
```

---

~~~python
procedure DBSCAN(points, eps, MinPts):

    cluster_id ← 0

    for each point p in points do

        if p is visited then
            continue
        end if

        mark p as visited
        neighbors ← regionQuery(points, p, eps)

        if |neighbors| < MinPts then
            label p as NOISE     // コア点ではない
            continue
        end if

        cluster_id ← cluster_id + 1
        expandCluster(points, p, neighbors, cluster_id, eps, MinPts)

    end for

end procedure

procedure expandCluster(points, p, neighbors, cluster_id, eps, MinPts):

    label p as cluster_id
    queue ← neighbors

    while queue is not empty do

        q ← queue.pop()

        // まだ訪問されていない点の場合
        if q is not visited then
            mark q as visited

            q_neighbors ← regionQuery(points, q, eps)

            // q がコア点 → さらに拡張可能
            if |q_neighbors| ≥ MinPts then
                queue.extend(q_neighbors)
            end if
        end if

        // クラスタ未割当の点は現在のクラスタに追加
        if q has no cluster label then
            label q as cluster_id
        end if

    end while

end procedure

function regionQuery(points, p, eps):

    neighbors ← empty list

    for each point q in points do
        if distance(p, q) ≤ eps then
            neighbors.append(q)
        end if
    end for

    return neighbors

end function

~~~

### 2.5 DBSCAN の貢献

- クラスタ数を自動決定  
- 任意形状・異形クラスタを検出  
- ノイズ点を明確に扱う  
- R*-tree による高速近傍探索を導入  

### 2.6 DBSCANとK-meansの比較

![DBSCAN](C:\Users\Lenovo\spatio_temporal\algo3\DBSCAN.png)

![K-means](C:\Users\Lenovo\spatio_temporal\algo3\K-means.png)

---

## 3. DBSCAN の限界

- ε の適切な選択が難しい  
- 異なる密度のクラスタに弱い  
- 高次元データでは距離の意味が薄れ性能が低下  

これらを解決するため多くの後続研究が生まれた。

## 4. DBSCAN の主要な後続研究と発展

### 4.1 OPTICS（1999）

**文献：**  
Ankerst, M., Breunig, M., Kriegel, H.-P., & Sander, J. (1999).  
*OPTICS: Ordering Points To Identify the Clustering Structure.* SIGMOD.

**改善点：**  
- ε の決定問題を解消  
- Reachability Plot によって**複数の密度レベルのクラスタ**を同時に可視化  
- DBSCAN を一般化した手法

### 4.2 HDBSCAN（2017）

**文献：**  
Campello, R. J., Moulavi, D., & Sander, J. (2013; 2017).  
*Hierarchical Density Estimates and HDBSCAN.* JMLR.

**改善点：**
- 異なる密度のクラスタを扱える  
- ε を不要化  
- 階層的密度クラスタリングを導入  
- 安定性（cluster stability）による最適クラスタ自動抽出  

### 4.3 DBSCAN++（高速化）

**文献：**  
Schubert, E., Zimek, A., & Kriegel, H.-P. (2017).  
*Fast and Robust DBSCAN using Approximate kNN Graphs.*

**改善点：**
- 近似 kNN による高速近傍探索  
- 大規模データセットへの適用性向上  

### 4.4 ST-DBSCAN（Spatio-Temporal DBSCAN）

**文献：**  
Birant, D., & Kut, A. (2007).  
*ST-DBSCAN: An Algorithm for Clustering Spatial–Temporal Data.*

**改善点：**
- 時間軸を含むデータのために距離定義を拡張  
- 空間 + 時間の複合的密度でクラスタリング  

### 4.5 DenStream（Streaming DBSCAN）

**文献：**  
Cao, F., et al. (2006).  
*Density-Based Clustering over an Evolving Data Stream.*

**改善点：**
- ストリーミングデータ（継続入力）に対応  
- Micro-Cluster を利用した増分密度推定  
- オンライン学習を実現  



## 5. DBSCAN から後続手法への進化関係まとめ

```
DBSCAN (1996)
     |
     |-- OPTICS (1999) …… ε 依存の克服・密度構造の可視化
     |
     |-- HDBSCAN (2017) …… 階層化・異密度クラスタの解決
     |
     |-- DBSCAN++ …… 高速化・大規模対応
     |
     |-- ST-DBSCAN …… 時空間データへの拡張
     |
     |-- DenStream …… ストリーミングデータ対応
```

DBSCAN の最大の遺産は **「密度に基づいてクラスタを定義する」という概念**であり，  
後続研究はこの概念を**より柔軟に・より高速に・より多様なデータへ**発展させたと言える。

## 6. まとめ

本レポートでは，以下を明らかにした：

1. **DBSCAN 原論文の詳細な内容と貢献**  
2. **その限界（ε の難しさ・異密度問題・高次元問題）**  
3. **後続研究（OPTICS, HDBSCAN, DBSCAN++, ST-DBSCAN, DenStream など）の文献と発展関係**  
4. **DBSCAN の発想が後続研究全体の基盤となっていること**

DBSCAN は 1996 年から現在まで 25年以上にわたり発展を続ける，クラスタリング分野で最も重要な手法のひとつである。

---

# 参考文献

- Ester, M., Kriegel, H.-P., Sander, J., & Xu, X. (1996). *A Density-Based Algorithm for Discovering Clusters in Large Spatial Databases with Noise.* KDD.  
- Ankerst, M., Breunig, M., Kriegel, H.-P., & Sander, J. (1999). *OPTICS.* SIGMOD.  
- Campello, R. J., Moulavi, D., & Sander, J. (2013/2017). *HDBSCAN.* JMLR.  
- Schubert, E., Zimek, A., & Kriegel, H.-P. (2017). *Fast and Robust DBSCAN.*  
- Birant, D., & Kut, A. (2007). *ST-DBSCAN.*  
- Cao, F., et al. (2006). *DenStream.*
