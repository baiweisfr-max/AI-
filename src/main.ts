import './index.css';
import { 
  createIcons, 
  Calculator, Server, ChevronUp, ChevronDown, Settings, DollarSign, 
  History, Cloud, Zap, Activity, ArrowRight, Info, Wrench, X, 
  CircleDollarSign, Rocket 
} from 'lucide';
import Chart from 'chart.js/auto';

const icons = {
  Calculator, Server, ChevronUp, ChevronDown, Settings, DollarSign, 
  History, Cloud, Zap, Activity, ArrowRight, Info, Wrench, X, 
  CircleDollarSign, Rocket
};

// State
let params = {
  serverCount: 10,
  serverUnitCost: 150000,
  networkCostPerServer: 20000,
  projectLifespan: 36,
  electricityPrice: 0.8,
  pue: 1.3,
  powerPerServerKW: 4,
  cabinetTransformationCost: 30000,
  personnelCost: 300000,
  wacc: 5,
  cloudCardMonthly: 3000,
  cardsPerServer: 8,
  needStorage: true,
  storageCostTotal: 1000000,
  timeToMarketAdvantage: 2,
  monthlyProfit: 500000
};

// Load from localStorage
let saved = null;
try {
  saved = localStorage.getItem('tco_params');
} catch (e) {
  console.warn('localStorage not available', e);
}

if (saved) {
  try {
    params = { ...params, ...JSON.parse(saved) };
  } catch (e) {
    console.error('Failed to parse saved params', e);
  }
}

const formatCurrency = (value: number) => {
  if (value >= 10000) {
    return `¥ ${(value / 10000).toLocaleString('zh-CN', { minimumFractionDigits: 0, maximumFractionDigits: 1 })} 万`;
  }
  return `¥ ${value.toLocaleString('zh-CN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
};

let lineChart: Chart | null = null;
let pieChart: Chart | null = null;
let radarChart: Chart | null = null;

function calculate() {
  const {
    serverCount, serverUnitCost, networkCostPerServer, projectLifespan,
    electricityPrice, pue, powerPerServerKW, cabinetTransformationCost,
    personnelCost, wacc, cloudCardMonthly, cardsPerServer,
    needStorage, storageCostTotal, timeToMarketAdvantage, monthlyProfit
  } = params;

  // On-Premise Capex
  const hardwareCost = serverCount * serverUnitCost;
  const networkCost = serverCount * networkCostPerServer;
  const storageCost = needStorage ? storageCostTotal : 0;
  const cabinetCount = Math.ceil(serverCount / 4);
  const infrastructureCost = cabinetCount * cabinetTransformationCost;
  const capex = hardwareCost + networkCost + storageCost + infrastructureCost;

  // On-Premise Opex (Monthly)
  const totalPowerKW = serverCount * powerPerServerKW;
  const electricityMonthly = totalPowerKW * 24 * 30 * pue * electricityPrice;
  const personnelMonthly = personnelCost / 12;
  const waccMonthly = (capex * (wacc / 100)) / 12;
  const opexMonthly = electricityMonthly + personnelMonthly + waccMonthly;

  // On-Premise Maintenance
  const maintenanceAnnual = (hardwareCost + networkCost) * 0.10;
  const maintenanceTotal = Math.max(0, (projectLifespan / 12) - 1) * maintenanceAnnual;

  const totalOnPremise = capex + (opexMonthly * projectLifespan) + maintenanceTotal;

  // Cloud Cost
  const totalCards = serverCount * cardsPerServer;
  const cloudComputeMonthly = totalCards * cloudCardMonthly;
  const cloudStorageMonthly = needStorage ? 50000 : 0;
  const cloudMonthly = cloudComputeMonthly + cloudStorageMonthly;
  const totalCloud = cloudMonthly * projectLifespan;

  // Timeline
  const timeline = [];
  let crossingPoint = null;
  for (let month = 0; month <= projectLifespan; month++) {
    let currentOnPremise = capex + (opexMonthly * month);
    if (month > 12) currentOnPremise += maintenanceAnnual * Math.floor((month - 1) / 12);
    const currentCloud = cloudMonthly * month;
    timeline.push({ month, onPremise: currentOnPremise, cloud: currentCloud });
    if (crossingPoint === null && currentCloud > currentOnPremise && month > 0) {
      crossingPoint = month;
    }
  }

  // Breakdown
  const breakdown = [
    { name: '硬件与网络 (Capex)', value: hardwareCost + networkCost, fill: '#ef4444' },
    { name: '存储设备 (Capex)', value: storageCost, fill: '#f97316' },
    { name: '机房改造 (Capex)', value: infrastructureCost, fill: '#f59e0b' },
    { name: '电费支出 (Opex)', value: electricityMonthly * projectLifespan, fill: '#3b82f6' },
    { name: '人员运维 (Opex)', value: personnelMonthly * projectLifespan, fill: '#8b5cf6' },
    { name: '资金成本 (Opex)', value: waccMonthly * projectLifespan, fill: '#64748b' },
    { name: '硬件维保', value: maintenanceTotal, fill: '#10b981' }
  ];

  // Radar
  const radarData = {
    labels: ['TCO总成本', '资金利用率', '业务敏捷度', '运维省心度', '技术迭代风险'],
    datasets: [
      {
        label: 'AI安全算力',
        data: [
          totalCloud < totalOnPremise ? 90 : 70,
          95,
          95,
          90,
          95
        ],
        backgroundColor: 'rgba(59, 130, 246, 0.4)',
        borderColor: '#3b82f6',
        borderWidth: 2
      },
      {
        label: '自建方案',
        data: [
          totalOnPremise < totalCloud ? 90 : 70,
          40,
          30,
          40,
          30
        ],
        backgroundColor: 'rgba(239, 68, 68, 0.4)',
        borderColor: '#ef4444',
        borderWidth: 2
      }
    ]
  };

  const timeToMarketValue = timeToMarketAdvantage * monthlyProfit;

  return {
    totalOnPremise, totalCloud, capex, electricityMonthly, totalPowerKW,
    timeline, crossingPoint, breakdown, radarData, timeToMarketValue, totalCards
  };
}

function updateUI() {
  const calc = calculate();
  
  // Update text elements
  setText('val-onpremise-total', formatCurrency(calc.totalOnPremise));
  setText('val-cloud-total', formatCurrency(calc.totalCloud));
  setText('val-electricity', formatCurrency(calc.electricityMonthly));
  setText('val-capex', formatCurrency(calc.capex));
  setText('val-power', `${calc.totalPowerKW.toFixed(0)} kW`);
  
  // Update dynamic labels
  setText('lbl-lifespan-1', `${params.projectLifespan/12}`);
  setText('lbl-lifespan-2', `${params.projectLifespan/12}`);
  setText('lbl-lifespan-3', `${params.projectLifespan/12}`);
  setText('lbl-cards', `${calc.totalCards}`);
  setText('lbl-storage-monthly', params.needStorage ? '50,000元/月 (高性能全闪)' : '0元');
  setText('lbl-lifespan-months', `${params.projectLifespan}`);
  
  // Update conclusion
  const conclusionEl = document.getElementById('conclusion-banner');
  const conclusionIcon = document.getElementById('conclusion-icon');
  const conclusionTitle = document.getElementById('conclusion-title');
  const conclusionText = document.getElementById('conclusion-text');
  
  if (conclusionEl && conclusionIcon && conclusionTitle && conclusionText) {
    if (calc.crossingPoint) {
      conclusionEl.className = "rounded-xl p-4 flex items-start space-x-4 border bg-emerald-50 border-emerald-200";
      conclusionIcon.className = "p-2 rounded-full mt-0.5 bg-emerald-100 text-emerald-600";
      conclusionTitle.className = "text-lg font-bold text-emerald-800";
      conclusionTitle.innerText = "核心结论";
      
      let text = `AI安全算力方案更优，盈亏平衡点在 <strong>第 ${calc.crossingPoint} 个月</strong>。<br/>在 ${params.projectLifespan} 个月生命周期内，AI安全算力方案可为您节省 <strong>${formatCurrency(calc.totalOnPremise - calc.totalCloud)}</strong>。`;
      if (calc.timeToMarketValue > 0) {
        text += `<br/><span class="block mt-1">此外，AI安全算力敏捷上线（提前 ${params.timeToMarketAdvantage} 个月）预计可带来 <strong>${formatCurrency(calc.timeToMarketValue)}</strong> 的额外业务利润。</span>`;
      }
      conclusionText.innerHTML = text;
      conclusionText.className = "text-sm mt-1 text-emerald-700";
    } else {
      conclusionEl.className = "rounded-xl p-4 flex items-start space-x-4 border bg-amber-50 border-amber-200";
      conclusionIcon.className = "p-2 rounded-full mt-0.5 bg-amber-100 text-amber-600";
      conclusionTitle.className = "text-lg font-bold text-amber-800";
      conclusionTitle.innerText = "核心结论";
      conclusionText.innerHTML = `在 ${params.projectLifespan} 个月生命周期内，自建方案总成本更低。<br/>但请注意自建方案需要一次性投入 <strong>${formatCurrency(calc.capex)}</strong> 的巨额资金，且面临硬件迭代贬值风险。`;
      conclusionText.className = "text-sm mt-1 text-amber-700";
    }
  }

  // Update Charts
  updateCharts(calc);
  
  // Save params
  try {
    localStorage.setItem('tco_params', JSON.stringify(params));
  } catch (e) {
    // ignore
  }
}

function setText(id: string, text: string) {
  const el = document.getElementById(id);
  if (el) el.innerText = text;
}

function updateCharts(calc: any) {
  // Line Chart
  const lineCtx = (document.getElementById('lineChart') as HTMLCanvasElement)?.getContext('2d');
  if (lineCtx) {
    if (lineChart) lineChart.destroy();
    lineChart = new Chart(lineCtx, {
      type: 'line',
      data: {
        labels: calc.timeline.map((t: any) => `第${t.month}个月`),
        datasets: [
          {
            label: '自建成本曲线 (高Capex起点)',
            data: calc.timeline.map((t: any) => t.onPremise),
            borderColor: '#ef4444',
            backgroundColor: '#ef4444',
            borderWidth: 3,
            pointRadius: 0,
            pointHoverRadius: 6
          },
          {
            label: 'AI安全算力成本曲线 (零启动成本)',
            data: calc.timeline.map((t: any) => t.cloud),
            borderColor: '#3b82f6',
            backgroundColor: '#3b82f6',
            borderWidth: 3,
            pointRadius: 0,
            pointHoverRadius: 6
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          mode: 'index',
          intersect: false,
        },
        plugins: {
          tooltip: {
            callbacks: {
              label: (context) => `${context.dataset.label}: ${formatCurrency(context.raw as number)}`
            }
          }
        },
        scales: {
          y: {
            ticks: {
              callback: (value) => `${(Number(value) / 10000).toFixed(0)}万`
            }
          }
        }
      }
    });
  }

  // Pie Chart
  const pieCtx = (document.getElementById('pieChart') as HTMLCanvasElement)?.getContext('2d');
  if (pieCtx) {
    if (pieChart) pieChart.destroy();
    pieChart = new Chart(pieCtx, {
      type: 'doughnut',
      data: {
        labels: calc.breakdown.map((b: any) => b.name),
        datasets: [{
          data: calc.breakdown.map((b: any) => b.value),
          backgroundColor: calc.breakdown.map((b: any) => b.fill),
          borderWidth: 1
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          tooltip: {
            callbacks: {
              label: (context) => `${context.label}: ${formatCurrency(context.raw as number)}`
            }
          },
          legend: {
            position: 'bottom'
          }
        }
      }
    });
  }

  // Radar Chart
  const radarCtx = (document.getElementById('radarChart') as HTMLCanvasElement)?.getContext('2d');
  if (radarCtx) {
    if (radarChart) radarChart.destroy();
    radarChart = new Chart(radarCtx, {
      type: 'radar',
      data: calc.radarData,
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          r: {
            min: 0,
            max: 100,
            ticks: { display: false }
          }
        }
      }
    });
  }
}

// Setup Event Listeners
function setupListeners() {
  const inputs = document.querySelectorAll('input[type="range"], input[type="checkbox"]');
  inputs.forEach(input => {
    input.addEventListener('input', (e) => {
      const target = e.target as HTMLInputElement;
      const id = target.id;
      
      if (target.type === 'checkbox') {
        (params as any)[id] = target.checked;
        if (id === 'needStorage') {
          const container = document.getElementById('storageCostContainer');
          if (container) {
            container.style.opacity = target.checked ? '1' : '0.5';
            container.style.pointerEvents = target.checked ? 'auto' : 'none';
          }
        }
      } else {
        (params as any)[id] = Number(target.value);
        // Update corresponding label
        const label = document.getElementById(`val-${id}`);
        if (label) {
          let valStr = target.value;
          if (['serverUnitCost', 'networkCostPerServer', 'cabinetTransformationCost', 'personnelCost', 'storageCostTotal', 'monthlyProfit'].includes(id)) {
            valStr = (Number(valStr) / 10000).toString();
          }
          label.innerText = valStr;
        }
      }
      updateUI();
    });
  });

  // Accordions
  document.querySelectorAll('.accordion-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const target = e.currentTarget as HTMLElement;
      const content = target.nextElementSibling as HTMLElement;
      const icon = target.querySelector('.accordion-icon');
      
      if (content.classList.contains('hidden')) {
        content.classList.remove('hidden');
        if (icon) icon.innerHTML = '<polyline points="18 15 12 9 6 15"></polyline>'; // ChevronUp
      } else {
        content.classList.add('hidden');
        if (icon) icon.innerHTML = '<polyline points="6 9 12 15 18 9"></polyline>'; // ChevronDown
      }
      createIcons({ icons });
    });
  });

  // Modal
  const modal = document.getElementById('omModal');
  document.getElementById('openModalBtn')?.addEventListener('click', () => {
    modal?.classList.remove('hidden');
  });
  document.getElementById('closeModalBtn')?.addEventListener('click', () => {
    modal?.classList.add('hidden');
  });
  document.getElementById('closeModalBg')?.addEventListener('click', () => {
    modal?.classList.add('hidden');
  });

  // Reset
  document.getElementById('resetBtn')?.addEventListener('click', () => {
    try {
      localStorage.removeItem('tco_params');
    } catch (e) {}
    location.reload();
  });
}

// Initialize
function init() {
  try {
    createIcons({ icons });
  } catch (e) {
    console.warn('Failed to create icons', e);
  }
  
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').catch(err => {
        console.log('SW registration failed: ', err);
      });
    });
  }

  // Set initial input values
  Object.keys(params).forEach(key => {
    const input = document.getElementById(key) as HTMLInputElement;
    if (input) {
      if (input.type === 'checkbox') {
        input.checked = (params as any)[key];
        if (key === 'needStorage') {
          const container = document.getElementById('storageCostContainer');
          if (container) {
            container.style.opacity = input.checked ? '1' : '0.5';
            container.style.pointerEvents = input.checked ? 'auto' : 'none';
          }
        }
      } else {
        input.value = (params as any)[key];
        // Update label
        const label = document.getElementById(`val-${key}`);
        if (label) {
          let valStr = input.value;
          if (['serverUnitCost', 'networkCostPerServer', 'cabinetTransformationCost', 'personnelCost', 'storageCostTotal', 'monthlyProfit'].includes(key)) {
            valStr = (Number(valStr) / 10000).toString();
          }
          label.innerText = valStr;
        }
      }
    }
  });

  setupListeners();
  updateUI();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
