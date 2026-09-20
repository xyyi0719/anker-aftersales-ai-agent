"""
seed_demo.py - 灌 demo 用的政策 + FAQ 文档
运行：PYTHONIOENCODING=utf-8 python retrieval/scripts/seed_demo.py
"""
import os
os.environ.setdefault("PYTHONIOENCODING", "utf-8")

import sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
import httpx

POLICY_DOCS = [
    {
        "type": "policy",
        "text": """第1条 本政策适用于通过 Anker 官方渠道（官网/京东自营/天猫旗舰店）购买的 Anker 充电类产品。

第2条 充电类产品保修期为自购买之日起 18 个月内。期间出现非人为损坏的性能故障，可免费维修或更换同型号产品。

第3条 充电宝出现鼓包、漏液、起火、冒烟、异味、烫手等异常时，应立即停止使用并断开充电。请勿自行拆解、挤压或继续充电，以免引发安全事故。

第4条 以下情况不属于保修范围：
（1）人为损坏，包括跌落、挤压、进水、私自拆机等；
（2）超过保修期限的故障；
（3）非官方渠道购买的二手产品。

第5条 过保后解决方案：
（1）付费维修，按官方配件价 + 人工费报价；
（2）以旧换新，老产品折抵 30%–50% 购买新款；
（3）指导用户自助处理简单故障。

第6条 退换货政策：自收到货 7 天内（含 7 天），产品无损坏、配件齐全、外包装完整，可无理由退货。15 天内出现性能故障可换货。
""",
        "metadata": {"source": "anker-charger-policy", "product": "Anker 充电类", "region": "CN"},
    },
    {
        "type": "policy",
        "text": """第1条 本政策适用于 Anker 737 充电宝（PowerCore 24K）。

第2条 18 个月内非人为损坏免费维修或更换。鼓包/漏液/起火等安全问题立即触发 P0 升级，1 小时内专员主动联系。

第3条 鼓包处理流程：
（1）用户上传鼓包照片 → 视觉识别（vision_skip）→ 直接跳到 P0 紧急工单；
（2）同时停用提示：立即停止使用、断开充电、勿挤压；
（3）专员联系用户安排以旧换新或上门取件。

第4条 召回政策：Anker 737 在 2024 年部分批次因电芯问题主动召回。用户可凭序列号查询是否在召回批次内，并享受免费更换。
""",
        "metadata": {"source": "anker-737-policy", "product": "Anker 737", "region": "CN"},
    },
    {
        "type": "policy",
        "text": """第1条 Soundcore 耳机保修期为 12 个月。

第2条 蓝牙连接问题：用户可先自助重置耳机（长按电源键 10 秒），重置无效再走保修。

第3条 充电盒损坏属于保修范围，但电池损耗属于正常老化不在保修范围。

第4条 7 天无理由退货，15 天内出现性能故障可换货。
""",
        "metadata": {"source": "soundcore-policy", "product": "Soundcore", "region": "CN"},
    },
    {
        "type": "faq",
        "text": """Q：Anker 737 充电宝保修期多久？
A：18 个月内非人为损坏免费维修或更换。

Q：充电宝鼓包了怎么办？
A：立即停止使用并断开充电，请勿挤压、自行拆解或丢入普通垃圾桶。我会帮您走紧急保修流程，1 小时内有专员联系。

Q：Anker 737 召回批次怎么查？
A：请提供产品序列号（S/N 在机身底部），我可以为您查询是否在召回批次内。

Q：过保了还能修吗？
A：可以付费维修，也可以参加以旧换新活动。

Q：怎么申请退货？
A：7 天内无理由退货，配件齐全、外包装完整即可。
""",
        "metadata": {"source": "anker-faq", "product": "Anker 通用", "region": "CN"},
    },
]


def main():
    print(f"Seeding {len(POLICY_DOCS)} documents...")
    r = httpx.post("http://localhost:8001/index", json={"documents": POLICY_DOCS}, timeout=60.0)
    r.raise_for_status()
    print("Result:", r.json())

    print("\nTesting /retrieve...")
    test_queries = [
        "Anker 737 充电宝保修期多久",
        "充电宝鼓包了怎么办",
        "Anker 737 召回批次查询",
        "Soundcore 耳机充不进电",
    ]
    for q in test_queries:
        r = httpx.post("http://localhost:8001/retrieve", json={"query": q, "top_k": 3}, timeout=10.0)
        r.raise_for_status()
        d = r.json()
        print(f"\n  Q: {q}")
        print(f"  confidence={d['confidence']:.2f} answerable={d['answerable']}")
        for r in d.get("results", [])[:2]:
            print(f"    - {r['chunk_id']}: {r['text'][:60]}...")


if __name__ == "__main__":
    main()