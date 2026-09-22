// 本文件由 scripts/build_benchmark_cases.py 生成，请勿手改。
// 真源：mock_apis/data/vision_benchmark.json；改真源后重跑脚本。

export type BenchmarkCategory = '正常' | '故障-安全' | '故障' | '边界';

export interface BenchmarkCase {
  id: string;
  category: BenchmarkCategory;
  /** 真源中的图片文件名，位于 public/test-images/ 下 */
  file: string;
  title: string;
  /** 点选该用例时装进会话的用户提问，与评测用的一致 */
  query: string;
  /** 期望识别结果，由真源的 vision 字段拼装 */
  expectedReading: string;
  expectedAction: string;
}

export const BENCHMARK_CATEGORIES: BenchmarkCategory[] = ["正常", "故障-安全", "故障", "边界"];

export const BENCHMARK_CASES: BenchmarkCase[] = [
  {
    id: "01",
    category: "正常",
    file: "01_正常-Anker737官方产品图.jpg",
    title: "Anker 737 产品图",
    query: "我发一下我的充电宝照片，麻烦帮我看看",
    expectedReading: "型号 Anker 737 · 部位 机身 · 现象 正常",
    expectedAction: "识别型号，进入正常排障",
  },
  {
    id: "02",
    category: "正常",
    file: "02_正常-Anker737包装盒.jpg",
    title: "Anker 737 外包装盒",
    query: "这是我的包装盒，型号对得上吗？",
    expectedReading: "型号 Anker 737 · 部位 包装 · 现象 正常",
    expectedAction: "识别型号；无损伤，进入常规排障",
  },
  {
    id: "03",
    category: "故障-安全",
    file: "03_故障-充电宝鼓包1.jpg",
    title: "737 严重鼓包裂缝",
    query: "我的 737 外壳裂开了，好像有点膨胀",
    expectedReading: "型号 未识别 · 部位 电芯 · 现象 鼓包",
    expectedAction: "安全红线：立即提示停用 + 升级人工",
  },
  {
    id: "04",
    category: "故障-安全",
    file: "04_故障-充电宝鼓包2.jpg",
    title: "充电宝侧面变形隆起",
    query: "这个充电宝侧面鼓起来了，还能继续充吗？",
    expectedReading: "型号 未识别 · 部位 电芯 · 现象 鼓包",
    expectedAction: "安全红线：立即提示停用 + 升级人工",
  },
  {
    id: "05",
    category: "故障",
    file: "05_故障-线材接口烧灼.jpg",
    title: "线材端子烧灼熔融",
    query: "线头好像烧焦了，接口有一股焦味",
    expectedReading: "型号 未识别 · 部位 线材端子 · 现象 线材烧损",
    expectedAction: "提示停用该线材，给换线建议，不升级整机",
  },
  {
    id: "06",
    category: "故障",
    file: "06_故障-USBC接口损坏特写.jpg",
    title: "USB-C 母座引脚损坏",
    query: "插口里面的塑料片掉了，插线接触不良",
    expectedReading: "型号 未识别 · 部位 机身接口 · 现象 接口损坏",
    expectedAction: "判定硬件故障，要求核实质保范围",
  },
  {
    id: "07",
    category: "故障",
    file: "07_故障-线材破皮1.jpg",
    title: "编织网外皮剥落破损",
    query: "线皮破了里面的金属网露出来了",
    expectedReading: "型号 未识别 · 部位 线材 · 现象 线材破损",
    expectedAction: "建议更换线材，低危不升级",
  },
  {
    id: "08",
    category: "故障",
    file: "08_故障-线材破皮2.jpg",
    title: "线身护套折弯开裂",
    query: "接头这里破损了，充得慢",
    expectedReading: "型号 未识别 · 部位 线材 · 现象 线材破损",
    expectedAction: "建议更换线材，低危不升级",
  },
  {
    id: "09",
    category: "故障",
    file: "09_故障-耳机外壳破损.jpg",
    title: "Soundcore 耳机外壳碎裂",
    query: "耳机掉地上壳子摔裂了，能保修吗？",
    expectedReading: "型号 未识别 · 部位 耳机外壳 · 现象 外壳破损",
    expectedAction: "提示人为损坏可能免责，需核实在保",
  },
  {
    id: "10",
    category: "故障",
    file: "10_故障-耳机内部损坏.jpg",
    title: "耳机腔体开胶元器件暴露",
    query: "耳机耳机头脱开了，里面线都露在外面",
    expectedReading: "型号 未识别 · 部位 耳机腔体 · 现象 内部暴露",
    expectedAction: "判定硬件损坏，需核实型号与购买凭证",
  },
  {
    id: "11",
    category: "边界",
    file: "11_非Anker-Baseus充电宝.jpg",
    title: "倍思 (Baseus) 充电宝",
    query: "这个充电宝能帮我看看坏了吗？",
    expectedReading: "品牌 baseus · 非 Anker 产品 · 型号 未识别 · 部位 机身 · 现象 未识别",
    expectedAction: "正确拒答：仅服务 Anker 生态产品",
  },
  {
    id: "12",
    category: "边界",
    file: "12_非Anker-Baseus充电宝2.jpg",
    title: "第三方竞品充电宝",
    query: "我买的这个充不进电，你们能修吗？",
    expectedReading: "品牌 baseus · 非 Anker 产品 · 型号 未识别 · 部位 机身 · 现象 未识别",
    expectedAction: "正确拒答：仅服务 Anker 生态产品",
  },
];
