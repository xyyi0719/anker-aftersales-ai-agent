"""
seed_material_library.py - 用 captain 素材库替换 seed_demo
运行：docker exec -i anker-retrieval python3 < seed_material_library.py
策略：
1. Anker 737 spec + 12 FAQ F1-F12 → 1 个 spec 文档 + 12 个 FAQ chunks
2. Soundcore 5 FAQ S1-S5 → 1 个 spec 文档 + 5 个 FAQ chunks
3. 售后政策（US/CN/EU/退货/三包）→ 6 个 policy chunks
5. 差评语料 28 条口语映射 → 28 个综合 chunks（含 fallback 路径）
6. 故障树 JSON + 政策路由表 → 2 个配置 chunks
"""
import os
os.environ.setdefault("PYTHONIOENCODING", "utf-8")

import sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
import httpx

DOCS = []

# ============================================================
# 1. Anker 737 充电宝 spec
# ============================================================
DOCS.append({
    "type": "policy",
    "text": """Anker 737 充电宝（A1289）产品规格与保修政策

【产品卡】
- 容量 24000mAh（88.8Wh，可上飞机随身携带）
- USB-C1/C2 各 140W Max，USB-A 18W
- 自充 140W（PD 140W 头约 1 小时充满）
- 保修：24 个月（美国官方）/ 18 个月（中国三包）

【兼容性】
- 兼容：iPhone 8–14 系、三星 S22/S23、MacBook Air M2、iPad 等
- 不兼容：DJI Mini Pro、部分联想拯救者 140W 机型

【安全警告】
充电宝出现鼓包、漏液、起火、冒烟、异味、烫手等异常时，应立即停止使用、断开充电、勿挤压、自行拆解或丢入普通垃圾桶，并联系 Anker 客服走紧急保修流程，1 小时内有专员主动联系。""",
    "metadata": {"source": "anker-737-spec", "product": "Anker 737", "region": "GLOBAL"},
})

# ============================================================
# 2. Anker 737 FAQ F1-F12（每条一片，符合「一问一答一片」原则）
# ============================================================
FAQ_737 = [
    ("F1", "Anker 737 完全充不进电怎么办", "换墙插/换线/换充电头逐一排除。来源：service.anker.com Power-Banks-Charging-Issues"),
    ("F2", "Anker 737 不能给别的设备充电", "换一根确认完好的线、换一个设备交叉验证。来源：同上"),
    ("F3", "Anker 737 异常断电/指示灯异常/死机", "复位：用一根线同时插进输入口和输出口 3–5 秒 → 再充放一次；无效即判定硬件缺陷走售后。来源：service.anker.com Anker-737-Common-Problem-Troubleshooting"),
    ("F4", "Anker 737 发热", "换充电头+线自充试、换线充别的设备试；持续高温+异味→停用走售后。来源：同上"),
    ("F5", "Anker 737 使用中掉电快", "正常转化率约 60%（24000mAh 实际可输出 13000–14000mAh）；满电后再测、换线换设备。来源：service.anker.com Why-does-Anker-737-drain-quickly"),
    ("F6", "Anker 737 闲置时掉电快", "别插着 C-Lightning 线（芯片耗电）；开「自动关屏」（不关屏一天耗 15%）；满电静置 1–2 天复测。来源：同上"),
    ("F7", "Anker 737 充 iPhone 到 80% 停充/变慢", "不是故障：关掉 iPhone「优化电池充电」。来源：service.anker.com Anker-737-stop-charging-iPhone-80"),
    ("F8", "Anker 737 USB-A 口空载显示 0.1W", "正常现象：涓流模式开启（双击电源键关闭）或拔线后残留 2 分钟。来源：service.anker.com USB-A-0.1W-no-load"),
    ("F9", "Anker 737 屏幕出现 UVP 警告", "C1 口双向供电误识别 → 换 C2 口（纯输出）；DJI Mini 3 Pro 为已知兼容问题。来源：service.anker.com Anker-737-Special-Issues"),
    ("F10", "Anker 737 输出达不到 140W", "需线材+设备同时支持 140W；MacBook Pro 16 英寸建议 C 转 MagSafe。来源：同上"),
    ("F11", "Anker 737 多口插拔时另一口断连", "正常现象：智能功率分配重新协商 PDO。来源：同上"),
    ("F12", "Anker 737 充电慢/功率显示不准", "智能算法按温度动态调功；以「实际充满时间」为准判断，别看瞬时功率。来源：service.anker.com Anker-737-Common-Problem-Troubleshooting"),
]

for fid, q, a in FAQ_737:
    DOCS.append({
        "type": "faq",
        "text": f"Q：{q}\nA：{a}",
        "metadata": {"source": "anker-faq-737", "product": "Anker 737", "region": "GLOBAL", "faq_id": fid},
    })

# ============================================================
# 3. Soundcore FAQ S1-S5
# ============================================================
FAQ_SOUND = [
    ("S1", "Soundcore 耳机单边无声/声音小", "①调整佩戴或换大号耳塞；②酒精棉签清洁出声孔金属网；③检查手机「音频平衡」设置；④重置。来源：service.soundcore.com one-earbud-no-sound"),
    ("S2", "Soundcore 耳机单边不开机/不配对", "撕掉触点保护膜→充电 1 小时→重置（入盒开盖长按盒键 10 秒）→换设备交叉验证。来源：service.soundcore.com V30i-One-Sided-Issues"),
    ("S3", "Soundcore 耳机配对失败/断连", "重启手机蓝牙、删除配对记录 → 重置耳机 → 重新配对 → 换设备试。来源：service.soundcore.com Liberty-5-Pro-connection-issues"),
    ("S4", "Soundcore 耳机配对后无声", "放回充电盒→合盖再开盖→重置→重新配对→再测。来源：service.soundcore.com No-Sound-After-Pairing"),
    ("S5", "Soundcore 耳机左右耳音量不一致", "清洁金属网（播放最大音量时清洁）→ 重置 → 检查手机平衡设置。来源：service.soundcore.com One-Earbud-Quieter"),
]

for fid, q, a in FAQ_SOUND:
    DOCS.append({
        "type": "faq",
        "text": f"Q：{q}\nA：{a}",
        "metadata": {"source": "soundcore-faq", "product": "Soundcore", "region": "GLOBAL", "faq_id": fid},
    })

# ============================================================
# 4. 售后政策 - 全球保修期表
# ============================================================
DOCS.append({
    "type": "policy",
    "text": """Anker 全球保修期表（按品类）

【充电宝 / 充电器 / AC 电源类】18 或 24 个月（按产品页/发票为准）
【数据线 Cables】18 个月或终身（以产品页/发票为准）
【Hub/转接器】18 个月
【贴膜/保护壳】18 个月或终身
【键鼠】18 个月
【Anker & Soundcore 音箱】18 个月
【Anker & Soundcore 耳机】18 个月
【Zolo 耳机】12 个月
【Roav / Nebula / Security】12 个月
【户外电源 SOLIX】36–60 个月（分型号）

【30 天无理由退货规则】
- 未损坏产品自购买之日起 30 天内可全额退款（任何理由）
- 退货要求：包含全部配件 + 原包装，不满足可拒收
- 非质量原因退货：买家承担运费，Anker 只退产品本身费用
- 退款时效：退货到仓验收后 3–5 个工作日原路退回
- 退货流程：联系客服说明原因 + 提供发票或订单截图 → 客服 24 个工作小时内给退货地址 → 寄回后需告知快递公司和单号
- 非 Anker 官网购买（如亚马逊等第三方渠道）：退款需联系购买渠道的零售商

【美国联系方式】+1 (800) 988 7973；邮箱 support@anker.com""",
    "metadata": {"source": "anker-global-policy", "product": "Anker 通用", "region": "GLOBAL"},
})

# ============================================================
# 5. 中国三包政策
# ============================================================
DOCS.append({
    "type": "policy",
    "text": """Anker 中国三包政策

【总体口径】
- 大多数产品享有 18 个月硬件质保（按品类略有差异）
- 客服热线：+86 400 0550 036；客服邮箱：ced-cn@anker.com
- 官方线上渠道：天猫 ANKER安克官方旗舰店、声阔影音旗舰店、Anker京东自营旗舰店、ANKER影音京东自营旗舰店、抖音官方旗舰店等

【三包规则（性能故障，需发票 + 三包凭证，缺一不可）】
- 购机 7 日内：可选择退货或换货（退货按实付价退款，换货给同型号同规格新品）
- 8–15 日内：可免费换货（同型号同规格新品）
- 16 日–1 年内：免费修理，不可要求退换；同一故障两次修不好凭修理记录和三包凭证可再要求换货

【不保修情形】
- 超过三包有效期；无凭证或凭证涂改/与型号不符
- 人为损坏：未按说明书使用、非原厂配件致损、私自拆修改装、碰撞跌落进液腐蚀
- 撕毁/涂改 SN 码或封标
- 不可抗力（水灾、火灾、雷击）
- 正常磨损老化
- 非中国大陆销售的产品（区域隔离条款）
- 不符合保修条件的可提供有偿维修（报价同意后维修）""",
    "metadata": {"source": "anker-cn-three-guarantees", "product": "Anker 通用", "region": "CN"},
})

# ============================================================
# 6. 欧盟法定保修
# ============================================================
DOCS.append({
    "type": "policy",
    "text": """Anker 欧盟法定 2 年保修

【EU 法定保修规则】
- 欧盟消费者法定保修期为 2 年
- 该法定保修优先于品牌承诺
- 适用于欧盟成员国境内销售的所有 Anker / Soundcore / eufy 产品
- 故障产品可享受免费维修或更换（同型号同规格）

【EU vs CN 关键差异】
- 欧盟：2 年保修，强制法定
- 中国：18 个月保修，三包规则（7 日退 / 15 日换 / 1 年修）
- 美国：18-24 个月保修，30 天无理由退货

【区域隔离条款】
- 非中国大陆销售的产品不享受中国大陆三包服务
- 中国大陆三包不覆盖海外购买的产品
- 区域不明时禁止推测政策，固定话术升级人工""",
    "metadata": {"source": "anker-eu-policy", "product": "Anker 通用", "region": "EU"},
})

# ============================================================
# 7. 召回政策与安全警告
# ============================================================
DOCS.append({
    "type": "policy",
    "text": """Anker 2025 召回事件与安全处理口径

【召回背景】
- 安克 2025 年确有真实召回（供应商电芯原材料变更导致隔膜失效风险，涉及部分批次）
- 涉及型号清单以官方召回公告为准（公开信息）
- 召回批次内的产品可享受免费更换

【召回问题处理口径 - 强制规则】
1. 用户询问「XX 型号是否在召回列表」→ 必须先调用 policy_retrieve 检索召回清单
2. 若该型号在召回清单内 → 告知召回批次查询方式（凭序列号）+ 立即停用提示
3. 若该型号不在召回清单内 → 固定话术：「该型号未在召回列表中，如您有安全疑虑我可为您升级专员确认」
4. **绝不能让 Agent 对召回问题自由发挥**——这条用例就是 forced_retrieve 动作的存在意义

【安全隐患关键词】（任意一个出现 → IMMEDIATE_STOP_AND_ESCALATE）
- 鼓包 / 漏液 / 起火 / 冒烟 / 异味 / 烫手 / 烧焦 / 焦味 / 发热 / 爆炸 / 自燃
- 必须立即：1 停止使用、2 断开充电、3 勿挤压/拆解、4 立即联系专员""",
    "metadata": {"source": "anker-recall-policy", "product": "Anker 通用", "region": "GLOBAL", "priority": "critical"},
})

# ============================================================
# 8. 差评语料映射 - 充电宝类（13 条）
# ============================================================
CHARGE_MAPPING = [
    ("充不进电了、充不上电、插着没反应", "charge_failure", "F1", "换墙插/线/头逐一排除"),
    ("充不进去电灯都不亮", "charge_failure+indicator_abnormal", "F1/F3", "先换排除 + 复位"),
    ("给手机充不了、输出没反应", "output_failure", "F2", "换线+换设备交叉验证"),
    ("死机了、屏幕黑了、自己关机", "abnormal_behavior", "F3", "先复位（线短接 3-5 秒）"),
    ("烫手、又烫又慢、发热严重", "overheating", "F4", "换头线 + 持续高温异味→停用"),
    ("掉电飞快、24000毫安虚标、不耐用", "drain_fast", "F5/F6", "先讲 60% 转化率"),
    ("放着不用就没电了", "idle_drain", "F6", "查涓流线/自动关屏"),
    ("充到80%就停了", "ios_80_limit", "F7", "引导关 iPhone 优化电池充电"),
    ("显示0.1W是不是漏电", "trickle_display", "F8", "非故障，涓流模式"),
    ("屏幕跳UVP、充笔记本报警", "uvp_warning", "F9", "换 C2 口（纯输出）"),
    ("跑不满140W、功率虚标", "wattage_mismatch", "F10/F12", "查线材+设备"),
    ("插第二个设备就断一下", "pdo_renegotiation", "F11", "正常现象"),
    ("你们这个型号是不是召回的那批、会不会爆炸", "recall_inquiry", "RECALL", "强制检索，禁止直接回答"),
]

for i, (oral, std, faq, action) in enumerate(CHARGE_MAPPING, 1):
    DOCS.append({
        "type": "mapping",
        "text": f"口语映射 [{i}]：用户说「{oral}」→ 标准类型 {std} → 对应 FAQ {faq} → 处理：{action}",
        "metadata": {"source": "complaint-mapping", "product": "Anker 737", "region": "GLOBAL", "category": "power_bank"},
    })

# ============================================================
# 9. 差评语料映射 - 耳机类（6 条）
# ============================================================
EARBUD_MAPPING = [
    ("左边没声了、一个响一个不响", "one_side_silent", "S1/S2", "清洁 + 撕膜 + 重置"),
    ("连不上蓝牙、搜不到耳机", "pairing_failure", "S3", "重启蓝牙+删除配对+重置"),
    ("老断连、听一会就断", "connection_drop", "S3", "重启蓝牙+删除配对+重置"),
    ("连上了但没声音", "paired_no_sound", "S4", "放回盒+合盖+重置"),
    ("两边声音不一样大", "volume_imbalance", "S5", "清洁金属网+重置+查手机平衡"),
    ("续航崩了、听一小时就没电", "battery_drain", "S2", "先入盒满充 1 小时再测"),
]

for i, (oral, std, faq, action) in enumerate(EARBUD_MAPPING, 1):
    DOCS.append({
        "type": "mapping",
        "text": f"口语映射 [E{i}]：用户说「{oral}」→ 标准类型 {std} → 对应 FAQ {faq} → 处理：{action}",
        "metadata": {"source": "complaint-mapping", "product": "Soundcore", "region": "GLOBAL", "category": "earbuds"},
    })

# ============================================================
# 10. 通用/边界类（6 条）
# ============================================================
GENERAL_MAPPING = [
    ("我要退货、不想要了", "return_request", "查路由表（30天/三包7日）", "走政策路由表"),
    ("保修多久、在保吗", "warranty_inquiry", "调保修 API", "工具调用 check_warranty"),
    ("我要投诉、找你们领导、12315 见", "complaint_risk", "情绪三级 → 立即升级+摘要", "P0 escalate"),
    ("@#￥%……（纯辱骂无诉求）", "abuse", "安抚一次→询问诉求→仍无诉求则礼貌结束", "安抚路径"),
    ("我充电宝和耳机都有问题", "multi_intent", "拆两个任务", "多意图拆分"),
    ("我在亚马逊买的，能找你们退吗", "channel_routing", "亚马逊→平台退，保修→Anker", "渠道分流"),
]

for i, (oral, std, action, _) in enumerate(GENERAL_MAPPING, 1):
    DOCS.append({
        "type": "mapping",
        "text": f"通用映射 [G{i}]：用户说「{oral}」→ 标准类型 {std} → 处理：{action}",
        "metadata": {"source": "complaint-mapping-general", "product": "通用", "region": "GLOBAL"},
    })

# ============================================================
# 11. 真实投诉案例 C1/C2/C3（情绪 + 复合诉求测试用例）
# ============================================================
DOCS.append({
    "type": "case",
    "text": """真实投诉 C1（刁难/情绪类）：
用户原话：「90 天内充不进电，客服让我寄回去，说没这个型号了，直接给我寄了个一万毫安的，强盗强买强卖」
型号：A1681
诉求拆解：故障报修 + 对处理结果不满（要同型号换新）+ 强烈情绪
处理路径：
1. 共情安抚：理解用户的失望和被「强制换货」的不满
2. 询问订单：调取原始订单确认购买时间、型号、保修状态
3. 若在保 → 安抚升级专员协调同型号换新或退款
4. 若过保 → 引导付费维修/以旧换新，承认用户合理诉求""",
    "metadata": {"source": "complaint-case", "product": "Anker", "region": "CN", "case_id": "C1"},
})

DOCS.append({
    "type": "case",
    "text": """真实投诉 C2（混淆/情绪类）：
用户原话：「召回退回来的充电宝充不进电，才返回 2 个月，售后不给退回地址，地址说明客服就是不回」
描述：故障报修 + 召回相关咨询 + 投诉客服响应
处理路径：
1. 召回相关 → 强制 policy_retrieve 召回批次
2. 召回品内退过检测并同件 → 升级至召回专项专员
3. 客服不响应 → P0 升级 + 记录投诉承诺时限回复""",
    "metadata": {"source": "complaint-case", "product": "Anker", "region": "CN", "case_id": "C2"},
})

DOCS.append({
    "type": "case",
    "text": """真实投诉 C3（刁难/安全类 - 金子用例）：
用户原话：「45W 充电器标 45 瓦实际只有 7-10 瓦，充 20 分钟接口焦黑有异味，实测 51.6℃」
描述：功率虚标投诉 + 安全隐患（发热焦黑）
【安全关键词命中】发热/焦黑/异味
处理路径：
1. 立即停用提示：接口焦黑异味是安全问题，请立即停止使用
2. 安全升级 P0：1 小时内专员主动联系
3. 同件处理：免费上门取件检测 + 同型号换新或全额退款""",
    "metadata": {"source": "complaint-case", "product": "Anker", "region": "CN", "case_id": "C3"},
})

# ============================================================
# 12. 故障树配置（Anker 737）
# ============================================================
DOCS.append({
    "type": "config",
    "text": """Anker 737 (A1289) charge_failure 故障树配置

入口节点：n1
- n1 询问「充电宝自己充不进电 vs 无法给设备充电」分支
- n2 自充问题：换墙插/线/头 (vision_skip 视觉跳过重复询问)
- n3 屏幕指示灯反应 (vision_skip)
- n4 复位恢复（线短接 3-5 秒）
- n6 输出问题：换线+换设备
- n7 端口判断（单口 vs 所有口）

结论节点：
- c_cable_charger：先排除线材/充电头/墙插（FAQ F1）
- c_wattage：功率由智能算法动态调整（FAQ F12）
- c_error_check：forced_retrieve 检索错误代码/召回
- c_battery_hw：复位无效判定硬件缺陷 → check_warranty
- c_port_hw：单口异常 → check_warranty
- c_resolved：已解决""",
    "metadata": {"source": "fault-tree-737", "product": "Anker 737", "region": "GLOBAL"},
})

# ============================================================
# 13. 故障树配置（Soundcore）
# ============================================================
DOCS.append({
    "type": "config",
    "text": """Soundcore 耳机 one_side_silent 故障树配置

入口节点：n1
- n1 询问「单边没声 vs 两边都没声 vs 配对问题」分支
- n2 撕膜+充电 (vision_skip)
- n3 清洁+换耳帽
- n4 手机平衡检查
- n5 充电 1 小时后重试
- n6 蓝牙配对重置
- n7 换设备交叉验证

结论节点：
- c_film_charge：撕膜+充电（S2）
- c_resolved：已解决
- c_device_issue：问题出在设备端
- c_hw_fault：交叉验证后仍异常 → check_warranty""",
    "metadata": {"source": "fault-tree-soundcore", "product": "Soundcore", "region": "GLOBAL"},
})

# ============================================================
# 14. 政策路由表
# ============================================================
DOCS.append({
    "type": "config",
    "text": """售后政策路由表规则

R1 官网 US 充电宝：24月保修 + 30天无理由退（US_OFFICIAL_RMA）
R2 亚马逊 US：退款找亚马逊，保修找 Anker（US_AMAZON_SPLIT - 渠道分流演示点）
R3 天猫/京东 CN：7 日退 / 15 日换 / 1 年修（三包）（CN_THREE_GUARANTEES）
R4 官网 EU 耳机：法定 2 年保修（EU_STATUTORY）
Fallback REGION_LOCKED：非 CN 销售不享受 CN 三包
Fallback ESCALATE：查不到匹配规则时禁止推测政策，升级人工""",
    "metadata": {"source": "policy-routing", "product": "Anker 通用", "region": "GLOBAL"},
})


def main():
    print(f"📦 共 {len(DOCS)} 个 chunks 待灌入")
    print(f"   - 政策/规格: {sum(1 for d in DOCS if d['type'] in ('policy',))}")
    print(f"   - FAQ: {sum(1 for d in DOCS if d['type'] == 'faq')}")
    print(f"   - 口语映射: {sum(1 for d in DOCS if d['type'] == 'mapping')}")
    print(f"   - 投诉案例: {sum(1 for d in DOCS if d['type'] == 'case')}")
    print(f"   - 配置: {sum(1 for d in DOCS if d['type'] == 'config')}")

    # 直接灌（容器已重启清空）
    print("\n[1/1] 灌库...")
    r = httpx.post("http://localhost:8001/index", json={"documents": DOCS}, timeout=180.0)
    r.raise_for_status()
    result = r.json()
    print(f"  灌入完成: {result}")

    # 验证
    print("\n[验证] 测试查询...")
    test_queries = [
        "Anker 737 充电宝保修期多久",
        "充电宝鼓包了怎么办",
        "Anker 737 召回批次怎么查",
        "Soundcore 耳机单边没声音",
        "Anker 737 完全充不进电",
        "45W充电器接口焦黑发热",
        "我在亚马逊买的能找你们退吗",
        "我要投诉12315",
        "今天深圳天气",
        "你们的型号是不是召回的那批",
    ]
    for q in test_queries:
        r = httpx.post("http://localhost:8001/retrieve", json={"query": q, "top_k": 3}, timeout=10.0)
        d = r.json()
        ans = d['answerable']
        conf = d['confidence']
        n = len(d.get('results', []))
        top = d['results'][0].get('chunk_id', '?')[:35] if n > 0 else 'NONE'
        print(f"  Q: {q[:30]:30s} conf={conf:.3f} ans={ans} n={n} top={top}")


if __name__ == "__main__":
    main()