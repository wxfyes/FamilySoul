import json

with open("config.json", "r", encoding="utf-8") as f:
    cfg = json.load(f)

for k, v in cfg.items():
    if k == "family":
        print("family keys:", list(v.keys()))
        for fk, fv in v.items():
            print(" ", fk, {ik: iv for ik, iv in fv.items() if "token" not in ik.lower() and "key" not in ik.lower()})
    elif "key" in k.lower() or "token" in k.lower():
        print(k, ": ***")
    else:
        print(k, ":", type(v))

