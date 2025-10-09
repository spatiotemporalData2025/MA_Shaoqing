def misra_gries_v3_3(stream, k):
    """
    Misra-Gries アルゴリズム（バージョン 3.3）の実装。
    頻出要素を推定するために、最小カウントの要素を置き換える戦略を使用する。

    パラメータ:
        stream (list): データストリーム（数値など）
        k (int): 出現頻度が N/k を超える可能性のある要素数の上限

    戻り値:
        counter (dict): 頻出候補の要素とその推定カウント
    """
    counter = {}  # 要素とその出現回数の辞書
    n = 0         # 処理された要素数（参考用）

    for elem in stream:
        n += 1

        if elem in counter:
            # すでに候補であればカウントを増加
            counter[elem] += 1
        elif len(counter) < k:
            # 候補数がk未満なら新規に追加
            counter[elem] = 1
        else:
            # 最小のカウントを持つ要素を削除し、置き換える
            min_elem = min(counter, key=counter.get)
            min_count = counter[min_elem]
            del counter[min_elem]
            counter[elem] = min_count + 1

    return counter


data = [1, 2, 1, 3, 1, 2, 1, 4, 5, 1]
k = 3

result = misra_gries_v3_3(data, k)
print(result)  # 例えば: {1: 5, 5: 3, 4: 3} など