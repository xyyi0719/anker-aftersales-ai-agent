# 官方 FAQ 整理 V1.0（知识库原料 + 故障树依据）

> 来源：service.anker.com / service.soundcore.com 官方支持站（A/B 级权威源），2026-09-16 抓取整理。每条附原文链接，知识库切片时按「一问一答一片」切。

---

## 一、Anker 737 充电宝（A1289）

### 产品规格（知识库「产品卡」用）
- 容量 24000mAh（88.8Wh，可上飞机随身携带）；USB-C1/C2 各 140W Max，USB-A 18W；自充 140W（PD 140W 头约 1 小时充满）；
- 保修：**24 个月**；
- 兼容：iPhone 8–14 系、三星 S22/S23、MacBook Air M2、iPad 等；**不兼容 DJI Mini Pro、部分联想拯救者 140W 机型**。

### 排障 FAQ（故障树直接依据）

| # | 问题 | 官方解法 | 来源 |
|---|---|---|---|
| F1 | 完全充不进电 | 换墙插/换线/换充电头逐一排除 | [链接](https://service.anker.com/article-description/Power-Banks-Charging-Issues) |
| F2 | 不能给别的设备充电 | 换确认完好的线、换设备试 | 同上 |
| F3 | 异常断电/指示灯异常/死机 | **复位**：用一根线同时插进输入口和输出口 3–5 秒 → 再充放一次；无效即判定硬件缺陷，走售后 | [链接](https://service.anker.com/article-description/Anker-737-Powerbank-Common-Problem-Troubleshooting) |
| F4 | 发热 | 换充电头+线自充试、换线充别的设备试；持续高温+异味→停用走售后 | 同上 |
| F5 | 掉电快（使用中） | 正常转化率约 60%（24000mAh 实际可输出 13000–14000mAh）；满电后再测、换线换设备 | [链接](https://service.anker.com/article-description/Why-does-Anker-737-PowerBank-drain-so-quickly) |
| F6 | 掉电快（闲置） | 别插着 C-Lightning 线（芯片耗电）；开「自动关屏」（不关屏一天耗 15%）；满电静置 1–2 天复测 | 同上 |
| F7 | 充 iPhone 到 80% 停充/变慢 | 不是故障：关掉 iPhone「优化电池充电」 | [链接](https://service.anker.com/article-description/Why-does-Anker-737-PowerBank-stop-charging-when-an-iPhone-is-charged-to-80) |
| F8 | USB-A 口空载显示 0.1W | 正常现象：涓流模式开启（双击电源键关闭）或拔线后残留 2 分钟 | [链接](https://service.anker.com/article-description/Why-is-there-a-0-1W-output-shown-for-the-Anker-737-PowerBank-s-USB-A-port-when-nothing-is-connected) |
| F9 | 屏幕出现 UVP 警告（充笔记本/DJI 时） | C1 口双向供电误识别 → 换 C2 口（纯输出）；DJI Mini 3 Pro 为已知兼容问题 | [链接](https://service.anker.com/article-description/Anker-737-Power-Bank-Special-Issues-Troubleshooting-FAQs) |
| F10 | 输出达不到 140W | 需线材+设备同时支持 140W；MacBook Pro 16" 建议 C 转 MagSafe | 同 F9 |
| F11 | 多口插拔时另一口断连 | 正常现象：智能功率分配重新协商 PDO | 同 F9 |
| F12 | 充电慢/功率显示不准 | 智能算法按温度动态调功；以「实际充满时间」为准判断，别看瞬时功率 | [链接](https://service.anker.com/article-description/Anker-737-Powerbank-Common-Problem-Troubleshooting) |

## 二、Soundcore 耳机

| # | 问题 | 官方解法 | 来源 |
|---|---|---|---|
| S1 | 单边无声/声音小 | ①调整佩戴或换大号耳塞；②酒精棉签清洁出声孔金属网；③检查手机「音频平衡」设置；④重置 | [链接](https://service.soundcore.com/article-description/What-if-there-is-little-or-no-sound-coming-from-one-of-the-earbuds) |
| S2 | 单边不开机/不配对 | 撕掉触点保护膜→充电 1 小时→重置（入盒开盖长按盒键 10 秒）→换设备交叉验证 | [链接](https://service.soundcore.com/article-description/How-to-Fix-soundcore-V30i-Earbuds-One-Sided-Issues) |
| S3 | 配对失败/断连 | 重启手机蓝牙、删除配对记录 → 重置耳机 → 重新配对 → 换设备试 | [链接](https://service.soundcore.com/article-description/How-can-I-troubleshoot-the-following-connection-issues-with-soundcore-Liberty-5-Pro) |
| S4 | 配对后无声 | 放回充电盒→合盖再开盖→重置→重新配对→再测 | [链接](https://service.soundcore.com/article-description/What-Should-I-Do-if-There-Is-No-Sound-After-Pairing-or-Only-One-Side-Has-a-Sound) |
| S5 | 左右耳音量不一致 | 清洁金属网（播放最大音量时清洁）→ 重置 → 检查手机平衡设置 | [链接](https://service.soundcore.com/article-description/How-to-fix-the-Volume-issue-of-One-Earbud-Is-Quieter-Than-the-Other) |

### 客服话术要点（官方 FAQ 末尾的共性表达，写提示词可用）
- 官方 FAQ 统一收尾：「如果以上步骤未解决，请联系客服进一步协助」——**我们的「诚实升级」话术与之对齐**；
- Soundcore 官方会提醒用户「联系客服时说明已尝试的步骤」——**我们的转人工摘要正是这个的产品化**。

---

## 修订记录

| 版本 | 日期 | 内容 |
|---|---|---|
| V1.0 | 2026-09-16 | 初版：737 规格+12 条排障 FAQ、Soundcore 5 条排障 FAQ，均附官方来源 |
