import { useState } from 'react';
import { IconCameraVision, IconAlertTriangle, IconCheckCircle } from './SvgIcons';

export interface BenchmarkCase {
  id: string;
  filename: string;
  category: '正常' | '故障-安全' | '故障' | '边界';
  title: string;
  expectedTuple: string;
  expectedAction: string;
  query: string;
}

export const BENCHMARK_CASES: BenchmarkCase[] = [
  {
    id: '01',
    filename: '01_正常-Anker737官方产品图.jpg',
    category: '正常',
    title: 'Anker 737 官方正品图',
    expectedTuple: '型号 Anker 737 · 无外观损伤',
    expectedAction: '识别型号，进入标准排障流程',
    query: '我发一下我的充电宝照片，麻烦帮我看看',
  },
  {
    id: '02',
    filename: '02_正常-Anker737包装盒.jpg',
    category: '正常',
    title: 'Anker 737 外包装盒',
    expectedTuple: '型号 Anker 737 (从包装文字提取)',
    expectedAction: '识别型号；无损伤不跳级',
    query: '这是我的包装盒，型号对得上吗？',
  },
  {
    id: '03',
    filename: '03_故障-充电宝鼓包1.jpg',
    category: '故障-安全',
    title: '737 严重鼓包裂缝',
    expectedTuple: '位置=电芯外壳 · 现象=鼓包开裂',
    expectedAction: '安全红线：立即提示停用 + 升级人工专员',
    query: '我的 737 外壳裂开了，好像有点膨胀',
  },
  {
    id: '04',
    filename: '04_故障-充电宝鼓包2.jpg',
    category: '故障-安全',
    title: '充电宝侧面变形隆起',
    expectedTuple: '位置=内部电池组 · 现象=严重鼓包',
    expectedAction: '拦截常规测试，直升 P0 人工工单',
    query: '这个充电宝侧面鼓起来了，还能继续充吗？',
  },
  {
    id: '05',
    filename: '05_故障-线材接口烧灼.jpg',
    category: '故障',
    title: '线材端子烧灼熔融',
    expectedTuple: '位置=Type-C 端子 · 现象=烧灼炭化',
    expectedAction: '提示停用损坏线材，跳级至换线核验',
    query: '线头好像烧焦了，接口有一股焦味',
  },
  {
    id: '06',
    filename: '06_故障-USBC接口损坏特写.jpg',
    category: '故障',
    title: 'USB-C 母座引脚损坏',
    expectedTuple: '位置=机身接口 · 现象=舌片受损',
    expectedAction: '判定机身硬件故障，跳级至质保查询',
    query: '插口里面的塑料片掉了，插线接触不良',
  },
  {
    id: '07',
    filename: '07_故障-线材破皮1.jpg',
    category: '故障',
    title: '编织网外皮剥落破损',
    expectedTuple: '位置=线材中段 · 现象=破皮露芯',
    expectedAction: '建议更换线材，避免短路风险',
    query: '线皮破了里面的金属网露出来了',
  },
  {
    id: '08',
    filename: '08_故障-线材破皮2.jpg',
    category: '故障',
    title: '线身护套折弯开裂',
    expectedTuple: '位置=网尾减震区 · 现象=破损开裂',
    expectedAction: '常规耗材建议，低危不升级',
    query: '接头这里破损了，充得慢',
  },
  {
    id: '09',
    filename: '09_故障-耳机外壳破损.jpg',
    category: '故障',
    title: 'Soundcore 耳机外壳碎裂',
    expectedTuple: '产品=Soundcore 耳机 · 现象=物理碎裂',
    expectedAction: '提示人为外伤可能免责，查有偿售后',
    query: '耳机掉地上壳子摔裂了，能保修吗？',
  },
  {
    id: '10',
    filename: '10_故障-耳机内部损坏.jpg',
    category: '故障',
    title: '耳机腔体开胶元器件暴露',
    expectedTuple: '位置=单元腔体 · 现象=内部破损',
    expectedAction: '疑似外力破坏，核实三包范围',
    query: '耳机耳机头脱开了，里面线都露在外面',
  },
  {
    id: '11',
    filename: '11_非Anker-Baseus充电宝.jpg',
    category: '边界',
    title: '倍思 (Baseus) 充电宝',
    expectedTuple: '非 Anker 旗下品牌设备',
    expectedAction: '正确拒答：说明仅服务 Anker 系列',
    query: '这个充电宝能帮我看看坏了吗？',
  },
  {
    id: '12',
    filename: '12_非Anker-Baseus充电宝2.jpg',
    category: '边界',
    title: '第三方竞品充电宝',
    expectedTuple: '非安克授权生产型号',
    expectedAction: '礼貌拒答 + 引导联系对应品牌',
    query: '我买的这个充不进电，你们能修吗？',
  },
];

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSelectCase: (testCase: BenchmarkCase, imageUrl: string) => void;
}

export default function BenchmarkDrawer({ isOpen, onClose, onSelectCase }: Props) {
  const [filter, setFilter] = useState<string>('全部');

  if (!isOpen) return null;

  const filteredCases = filter === '全部'
    ? BENCHMARK_CASES
    : BENCHMARK_CASES.filter(c => c.category === filter);

  return (
    <div className="benchmark-drawer-overlay" onClick={onClose}>
      <div className="benchmark-drawer-panel" onClick={e => e.stopPropagation()}>
        <div className="benchmark-drawer-header">
          <div className="benchmark-header-info">
            <IconCameraVision size={22} color="#0084ff" />
            <div>
              <h3>12 张官方视觉基准测试集</h3>
              <p>针对 Anker 黑客松「看图」难点设计的真机验证图库，点击任意用例可一键装入会话</p>
            </div>
          </div>
          <button className="benchmark-close-btn" onClick={onClose}>×</button>
        </div>

        <div className="benchmark-filter-tabs">
          {['全部', '正常', '故障-安全', '故障', '边界'].map(tab => (
            <button
              key={tab}
              className={`benchmark-tab ${filter === tab ? 'active' : ''}`}
              onClick={() => setFilter(tab)}
            >
              {tab}
            </button>
          ))}
        </div>

        <div className="benchmark-cards-grid">
          {filteredCases.map(item => {
            const imageUrl = `/test-images/${encodeURIComponent(item.filename)}`;
            const isSafety = item.category === '故障-安全';
            const isBoundary = item.category === '边界';

            return (
              <div
                key={item.id}
                className={`benchmark-card ${isSafety ? 'danger-edge' : ''}`}
                onClick={() => onSelectCase(item, imageUrl)}
                title="点击装入该测试图片并注入提问"
              >
                <div className="benchmark-thumb-wrapper">
                  <img
                    src={imageUrl}
                    alt={item.title}
                    className="benchmark-thumb"
                    loading="lazy"
                    onError={e => {
                      // Fallback if image fails to load
                      (e.target as HTMLElement).style.display = 'none';
                    }}
                  />
                  <span className={`benchmark-category-tag ${item.category}`}>
                    {item.category}
                  </span>
                </div>
                <div className="benchmark-card-content">
                  <div className="benchmark-card-title">{item.title}</div>
                  <div className="benchmark-card-desc">
                    <strong>期望四元组：</strong>{item.expectedTuple}
                  </div>
                  <div className={`benchmark-expected-action ${isSafety ? 'safety' : isBoundary ? 'boundary' : ''}`}>
                    {isSafety ? <IconAlertTriangle size={14} /> : <IconCheckCircle size={14} />}
                    <span>{item.expectedAction}</span>
                  </div>
                  <button className="benchmark-use-btn">一键测试此案例 →</button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
