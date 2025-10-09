def misra_gries_v3_1(stream, k):
    """
    Algorithm 3.1（Misra-Gries 原始算法）を実装する。
    頻度が N/k を超える可能性のある要素を推定する。

    引数:
        stream (list): データストリーム
        k (int): パラメータ。最大 k-1 個の候補を保持する

    戻り値:
        counter (dict): 候補要素とそのカウント
    """
    counter = {}  # T：候補集合
    n = 0         # データ処理数

    for elem in stream:
        n += 1

        if elem in counter:
            # すでに候補にある → カウントを+1
            counter[elem] += 1

        elif len(counter) < k - 1:
            # 候補が k-1 未満 → 新規追加
            counter[elem] = 1

        else:
            # 候補が k-1 に達している → 全部のカウントを-1
            for key in list(counter.keys()):
                counter[key] -= 1
                if counter[key] == 0:
                    counter.pop(key)

    return counter


# 動作確認
data = [1, 2, 1, 3, 1, 2, 1, 4, 5, 1]
k = 3
result = misra_gries_v3_1(data, k)
print(result)  # 出力例: {1: 3, 5: 1}