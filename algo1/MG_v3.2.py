def misra_gries_v3_2(stream, k):
    """
    改良版 Misra-Gries（Algorithm 3.2 に準拠）:
    ストリーム中で N/k を超える可能性のある要素を推定する。

    パラメータ:
        stream (list): データストリーム
        k (int): 閾値パラメータ（N/k を超える要素を検出）

    戻り値:
        counter (dict): 候補要素とその推定カウント
    """
    counter = {}     # 要素と出現頻度の辞書
    n = 0            # 処理したデータ数
    delta = 0        # 現在の delta（n // k）

    for elem in stream:
        n += 1

        if elem in counter:
            # 既に候補なら、カウントを1増やす
            counter[elem] += 1
        else:
            # 新規要素は delta + 1 で初期化（Algorithm 3.2 のルール）
            counter[elem] = delta + 1

        # delta の更新
        new_delta = n // k
        if new_delta != delta:
            delta = new_delta
            # 候補の中で delta 未満の要素を削除
            for key in list(counter.keys()):
                if counter[key] < delta:
                    counter.pop(key)

    return counter


# 動作確認
data = [1, 2, 1, 3, 1, 2, 1, 4, 5, 1, 6, 2, 7, 1, 8, 9, 1, 1, 1, 1]
k = 5

result = misra_gries_v3_2(data, k)
print(result)