import sys
import json
import urllib.request

TOKEN = "wxf_husband_exclusive_token_2026"
BASE_URL = "http://192.168.1.254:3088"

def trigger_wine_hook():
    url = f"{BASE_URL}/api/admin/proactive/trigger?token={TOKEN}"
    payload = {
        "speaker": "运河大酒楼·账房",
        "place": "运河码头三层大酒楼",
        "isLetter": True,
        "text": "【运河大酒楼·账房】：东家，扬州盐帮汪总商派人送来五十两定金，要包下明儿整座天字阁办寿宴，大厨特遣小的来请示东家意下如何？"
    }
    data = json.dumps(payload).encode('utf-8')
    req = urllib.request.Request(url, data=data, headers={"Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            res = json.loads(resp.read().decode('utf-8'))
            print("✅ 成功触发主动递信！手机端将立刻收到消息，并展示【动身前往「运河码头三层大酒楼」】按钮：")
            print(json.dumps(res, ensure_ascii=False, indent=2))
    except Exception as e:
        print(f"❌ 触发失败: {e}")

if __name__ == "__main__":
    trigger_wine_hook()
