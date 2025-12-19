import csv

def load_pois(path):
    pois = []

    with open(path, encoding="utf-8") as f:
        reader = csv.DictReader(f)

        for row in reader:
            pois.append({
                "id": row.get("@id"),
                "type": row.get("@type"),
                "name": row.get("name"),
                "lat": float(row.get("@lat")),
                "lon": float(row.get("@lon"))
            })

    return pois
