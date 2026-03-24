import React, { useState, useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine, PieChart, Pie, Cell, Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis } from 'recharts';
import { Settings, Server, Zap, HardDrive, Clock, Download, Save, History, TrendingUp, ChevronDown, ChevronUp, Info, Plus, X, Cloud, Wrench, ShieldCheck, Activity, Cpu, CircleDollarSign, Rocket, RefreshCw, AlertTriangle, CheckCircle2, XCircle, BrainCircuit } from 'lucide-react';
import { GPU_MODELS, DEFAULT_PARAMS } from './constants';
import { formatCurrency, cn } from './utils';

export default function App() {
  const [params, setParams] = useState(() => {
    const saved = localStorage.getItem('tco_params');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (!parsed.gpuConfigs || parsed.gpuConfigs.length === 0) {
          parsed.gpuConfigs = DEFAULT_PARAMS.gpuConfigs;
        } else {
          parsed.gpuConfigs = parsed.gpuConfigs.map((config: any) => {
            const model = config.model || GPU_MODELS[0].id;
            const gpu = GPU_MODELS.find(g => g.id === model) || GPU_MODELS[0];
            return {
              ...config,
              model,
              count: Number(config.count) || 8,
              cloudPricePerCard: config.cloudPricePerCard ?? gpu.cloudPricePerMonth,
              hardwarePricePerCard: config.hardwarePricePerCard ?? (gpu.price / 8)
            };
          });
        }
        const merged = { ...DEFAULT_PARAMS, ...parsed };
        
        // Ensure numeric values are valid numbers
        const numericKeys: (keyof typeof DEFAULT_PARAMS)[] = [
          'projectLifespan', 'networkCostTotal', 
          'storageCostTotal', 'electricityPrice', 'pue', 
          'cabinetTransformationCost', 'personnelCost', 'wacc'
        ];
        
        numericKeys.forEach(key => {
          if (typeof merged[key] !== 'number' || isNaN(merged[key] as number)) {
            (merged as any)[key] = DEFAULT_PARAMS[key];
          }
        });

        const booleanKeys: (keyof typeof DEFAULT_PARAMS)[] = ['needNetwork', 'needStorage'];
        booleanKeys.forEach(key => {
          if (typeof merged[key] !== 'boolean') {
            (merged as any)[key] = DEFAULT_PARAMS[key];
          }
        });
        
        return merged;
      } catch (e) {
        return DEFAULT_PARAMS;
      }
    }
    return DEFAULT_PARAMS;
  });

  React.useEffect(() => {
    localStorage.setItem('tco_params', JSON.stringify(params));
  }, [params]);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    baseline: true,
    onpremise: true
  });
  const [isOMModalOpen, setIsOMModalOpen] = useState(false);

  const handleParamChange = (key: keyof typeof DEFAULT_PARAMS, value: any) => {
    setParams(prev => ({ ...prev, [key]: value }));
  };

  const handleGpuConfigChange = (id: string, key: string, value: any) => {
    setParams(prev => {
      const nextConfigs = prev.gpuConfigs.map(config => {
        if (config.id !== id) return config;
        
        const nextConfig = { ...config, [key]: value };
        
        if (key === 'model') {
          const gpu = GPU_MODELS.find(g => g.id === value);
          if (gpu) {
            nextConfig.cloudPricePerCard = gpu.cloudPricePerMonth;
            nextConfig.hardwarePricePerCard = gpu.price / 8;
          }
        }
        return nextConfig;
      });

      // Recalculate default network cost if count or model changes
      let newNetworkCost = prev.networkCostTotal;
      if (key === 'model' || key === 'count' || key === 'hardwarePricePerCard') {
        newNetworkCost = nextConfigs.reduce((sum, config) => {
          const gpu = GPU_MODELS.find(g => g.id === config.model);
          if (!gpu) return sum;
          const factor = gpu.network === 'IB' ? 0.2 : 0.1;
          return sum + (config.count * config.hardwarePricePerCard * factor);
        }, 0);
      }

      return { ...prev, gpuConfigs: nextConfigs, networkCostTotal: newNetworkCost };
    });
  };

  const addGpuConfig = () => {
    setParams(prev => {
      const gpu = GPU_MODELS[0];
      const newConfig = {
        id: `cluster-${Date.now()}`,
        model: gpu.id,
        count: 4,
        cloudPricePerCard: gpu.cloudPricePerMonth,
        hardwarePricePerCard: gpu.price / 8,
      };
      
      const nextConfigs = [...prev.gpuConfigs, newConfig];
      const newNetworkCost = nextConfigs.reduce((sum, config) => {
        const g = GPU_MODELS.find(x => x.id === config.model);
        if (!g) return sum;
        const factor = g.network === 'IB' ? 0.2 : 0.1;
        return sum + (config.count * config.hardwarePricePerCard * factor);
      }, 0);

      return { ...prev, gpuConfigs: nextConfigs, networkCostTotal: newNetworkCost };
    });
  };

  const removeGpuConfig = (id: string) => {
    setParams(prev => {
      if (prev.gpuConfigs.length <= 1) return prev;
      const nextConfigs = prev.gpuConfigs.filter(c => c.id !== id);
      
      const newNetworkCost = nextConfigs.reduce((sum, config) => {
        const g = GPU_MODELS.find(x => x.id === config.model);
        if (!g) return sum;
        const factor = g.network === 'IB' ? 0.2 : 0.1;
        return sum + (config.count * config.hardwarePricePerCard * factor);
      }, 0);

      return { ...prev, gpuConfigs: nextConfigs, networkCostTotal: newNetworkCost };
    });
  };

  const calculation = useMemo(() => {
    let totalServers = 0;
    let hardwareCost = 0;
    let totalPowerKW = 0;
    let totalCards = 0;
    let cloudMonthlyBase = 0;

    params.gpuConfigs.forEach(config => {
      const gpu = GPU_MODELS.find(g => g.id === config.model);
      if (!gpu) return;
      
      const servers = Math.ceil(config.count / 8);
      totalServers += servers;
      hardwareCost += config.count * config.hardwarePricePerCard;
      totalPowerKW += servers * gpu.power;
      totalCards += config.count;
      cloudMonthlyBase += config.count * config.cloudPricePerCard;
    });

    const networkCost = params.needNetwork ? params.networkCostTotal : 0;
    const storageCost = params.needStorage ? params.storageCostTotal : 0;
    
    const cabinets = Math.ceil(totalPowerKW / 10); // 10kW per cabinet
    const transformationCost = cabinets * params.cabinetTransformationCost;
    
    const capex = hardwareCost + networkCost + storageCost + transformationCost;

    // Monthly Opex
    const electricityMonthly = totalPowerKW * 24 * 30 * params.pue * params.electricityPrice;
    const rentMonthly = cabinets * 8000;
    const personnelMonthly = Math.ceil(totalServers / 50) * params.personnelCost / 12;
    const waccMonthly = capex * (params.wacc / 100) / 12;
    
    // Maintenance starts after year 1
    const maintenanceAnnual = (hardwareCost + networkCost) * 0.1;
    
    // Cloud
    const cloudStorageMonthly = params.needStorage ? 50000 : 0;
    // No discount for AI secure compute, pay according to card count
    const cloudMonthlyCompute = cloudMonthlyBase;
    const cloudMonthly = cloudMonthlyCompute + cloudStorageMonthly;

    const timeline = [];
    let crossingPoint = null;
    
    let cumulativeOnPremise = capex;
    let cumulativeCloud = 0;

    for (let month = 0; month <= params.projectLifespan; month++) {
      if (month > 0) {
        cumulativeOnPremise += electricityMonthly + rentMonthly + personnelMonthly + waccMonthly;
        if (month > 12) {
          cumulativeOnPremise += maintenanceAnnual / 12;
        }
        cumulativeCloud += cloudMonthly;
      }

      if (crossingPoint === null && cumulativeCloud > cumulativeOnPremise && month > 0) {
        crossingPoint = month;
      }

      timeline.push({
        month,
        onPremise: Math.round(cumulativeOnPremise),
        cloud: Math.round(cumulativeCloud),
      });
    }

    return {
      totalCards,
      capex,
      monthlyOpex: electricityMonthly + rentMonthly + personnelMonthly + waccMonthly,
      totalOnPremise: cumulativeOnPremise,
      totalCloud: cumulativeCloud,
      crossingPoint,
      timeline,
      electricityMonthly,
      totalPowerKW,
      breakdown: [
        { name: '硬件采购', value: hardwareCost, fill: '#ef4444' },
        { name: '网络设备', value: networkCost, fill: '#f97316' },
        { name: '存储设备', value: storageCost, fill: '#f59e0b' },
        { name: '机房改造', value: transformationCost, fill: '#84cc16' },
        { name: '电费支出', value: electricityMonthly * params.projectLifespan, fill: '#10b981' },
        { name: '机房租赁', value: rentMonthly * params.projectLifespan, fill: '#06b6d4' },
        { name: '人员运维', value: personnelMonthly * params.projectLifespan, fill: '#3b82f6' },
        { name: '维保费用', value: maintenanceAnnual * Math.max(0, (params.projectLifespan - 12) / 12), fill: '#6366f1' },
      ].filter(item => item.value > 0)
    };
  }, [params]);

  const radarData = useMemo(() => {
    if (!calculation) return [];
    
    const minTco = Math.min(calculation.totalOnPremise, calculation.totalCloud);
    
    const safeOnPremise = calculation.totalOnPremise > 0 ? calculation.totalOnPremise : 1;
    const safeCloud = calculation.totalCloud > 0 ? calculation.totalCloud : 1;

    const onPremiseTcoScore = Math.round((minTco / safeOnPremise) * 90) + 10;
    const cloudTcoScore = Math.round((minTco / safeCloud) * 90) + 10;

    const cloudElasticity = 95;
    const onPremiseElasticity = 30;

    const cloudOM = 90;
    const onPremiseOM = 40;

    const cloudTime = 95;
    const onPremiseTime = 40;

    const cloudAsset = 40;
    const onPremiseAsset = 95;

    return [
      { subject: 'TCO成本', AI安全算力: cloudTcoScore, 自建: onPremiseTcoScore, fullMark: 100 },
      { subject: '弹性扩展', AI安全算力: cloudElasticity, 自建: onPremiseElasticity, fullMark: 100 },
      { subject: '运维便捷', AI安全算力: cloudOM, 自建: onPremiseOM, fullMark: 100 },
      { subject: '上线时间', AI安全算力: cloudTime, 自建: onPremiseTime, fullMark: 100 },
      { subject: '资产控制', AI安全算力: cloudAsset, 自建: onPremiseAsset, fullMark: 100 },
    ];
  }, [calculation]);

  if (!calculation) return <div>Loading...</div>;

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between sticky top-0 z-10 shadow-sm">
        <div className="flex items-center space-x-3">
          <div className="bg-indigo-600 p-2 rounded-lg">
            <TrendingUp className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-xl font-bold text-slate-800">智算引擎：AI算力 TCO 动态评估系统</h1>
        </div>
        <div className="flex items-center space-x-4">
          <button className="flex items-center space-x-2 text-slate-600 hover:text-indigo-600 transition-colors px-3 py-2 rounded-md hover:bg-slate-100">
            <History className="w-4 h-4" />
            <span className="text-sm font-medium">历史记录</span>
          </button>
          <button className="flex items-center space-x-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-md transition-colors shadow-sm">
            <Download className="w-4 h-4" />
            <span className="text-sm font-medium">导出报告 (PDF/Excel)</span>
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        
        {/* Left Panel: Controls */}
        <aside className="w-full lg:w-[400px] bg-white border-r border-slate-200 flex flex-col h-full overflow-y-auto shadow-[4px_0_24px_rgba(0,0,0,0.02)] z-1">
          <div className="p-6 space-y-6">
            
            {/* Section 1: Baseline */}
            <section className="border border-slate-200 rounded-xl overflow-hidden shadow-sm">
              <button 
                onClick={() => toggleSection('baseline')}
                className="w-full flex items-center justify-between p-4 bg-slate-50 hover:bg-slate-100 transition-colors"
              >
                <div className="flex items-center space-x-2">
                  <Server className="w-5 h-5 text-indigo-600" />
                  <span className="font-semibold text-slate-800">1. 核心算力需求配置</span>
                </div>
                {expandedSections['baseline'] ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
              </button>
              
              {expandedSections['baseline'] && (
                <div className="p-4 space-y-5 bg-white">
                  {/* GPU Configs */}
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <h3 className="text-sm font-bold text-slate-800">算力集群配置</h3>
                      <button 
                        onClick={addGpuConfig}
                        className="text-xs flex items-center space-x-1 text-indigo-600 hover:text-indigo-700 font-medium"
                      >
                        <Plus className="w-4 h-4" />
                        <span>添加机型</span>
                      </button>
                    </div>

                    {params.gpuConfigs.map((config, index) => (
                      <div key={config.id} className="p-4 border border-slate-200 rounded-xl space-y-4 relative bg-slate-50">
                        {params.gpuConfigs.length > 1 && (
                          <button 
                            onClick={() => removeGpuConfig(config.id)} 
                            className="absolute top-3 right-3 text-slate-400 hover:text-red-500"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        )}
                        
                        <div className="space-y-2 pr-6">
                          <label className="text-xs font-medium text-slate-500">GPU 机型</label>
                          <select 
                            value={config.model}
                            onChange={(e) => handleGpuConfigChange(config.id, 'model', e.target.value)}
                            className="w-full p-2 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                          >
                            {GPU_MODELS.map(gpu => (
                              <option key={gpu.id} value={gpu.id}>{gpu.name}</option>
                            ))}
                          </select>
                        </div>

                        <div className="space-y-2">
                          <div className="flex justify-between items-center">
                            <label className="text-xs font-medium text-slate-500">数量 (卡)</label>
                            <span className="text-sm font-bold text-indigo-600">{config.count}</span>
                          </div>
                          <input 
                            type="range" 
                            min="4" max="4096" step="4"
                            value={config.count}
                            onChange={(e) => handleGpuConfigChange(config.id, 'count', Number(e.target.value))}
                            className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-4 pt-2 border-t border-slate-200">
                          <div className="space-y-1">
                            <label className="text-[10px] font-medium text-slate-500">自建单卡采购价</label>
                            <div className="flex items-center space-x-1">
                              <input 
                                type="number" 
                                value={config.hardwarePricePerCard}
                                onChange={(e) => handleGpuConfigChange(config.id, 'hardwarePricePerCard', Number(e.target.value))}
                                className="w-full p-1.5 bg-white border border-slate-200 rounded text-xs focus:ring-1 focus:ring-indigo-500 outline-none"
                              />
                            </div>
                          </div>
                          <div className="space-y-1">
                            <label className="text-[10px] font-medium text-slate-500">AI安全算力单卡月租金</label>
                            <div className="flex items-center space-x-1">
                              <input 
                                type="number" 
                                value={config.cloudPricePerCard}
                                onChange={(e) => handleGpuConfigChange(config.id, 'cloudPricePerCard', Number(e.target.value))}
                                className="w-full p-1.5 bg-white border border-slate-200 rounded text-xs focus:ring-1 focus:ring-indigo-500 outline-none"
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <label className="text-sm font-medium text-slate-700">项目生命周期</label>
                      <span className="text-sm font-bold text-indigo-600">{params.projectLifespan} 个月</span>
                    </div>
                    <input 
                      type="range" 
                      min="12" max="60" step="12"
                      value={params.projectLifespan}
                      onChange={(e) => handleParamChange('projectLifespan', Number(e.target.value))}
                      className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                    />
                  </div>

                  <div className="space-y-3 p-3 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">
                    <label className="flex items-center space-x-3 cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={params.needNetwork}
                        onChange={(e) => handleParamChange('needNetwork', e.target.checked)}
                        className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
                      />
                      <div className="flex flex-col">
                        <span className="text-sm font-medium text-slate-800">附加高性能网络交换机</span>
                        <span className="text-xs text-slate-500">IB/RoCE 组网设备及线缆</span>
                      </div>
                    </label>
                    
                    {params.needNetwork && (
                      <div className="pl-7 space-y-2 pt-2 border-t border-slate-100">
                        <div className="flex justify-between items-center">
                          <label className="text-xs font-medium text-slate-600">网络总成本预估</label>
                          <span className="text-xs font-bold text-indigo-600">{(params.networkCostTotal / 10000).toLocaleString()} 万</span>
                        </div>
                        <input 
                          type="range" 
                          min="100000" max="100000000" step="100000"
                          value={params.networkCostTotal}
                          onChange={(e) => handleParamChange('networkCostTotal', Number(e.target.value))}
                          className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                        />
                        <div className="flex justify-between text-[10px] text-slate-400">
                          <span>10万</span>
                          <span>1亿</span>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="space-y-3 p-3 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">
                    <label className="flex items-center space-x-3 cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={params.needStorage}
                        onChange={(e) => handleParamChange('needStorage', e.target.checked)}
                        className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
                      />
                      <div className="flex flex-col">
                        <span className="text-sm font-medium text-slate-800">附加高性能全闪存储</span>
                        <span className="text-xs text-slate-500">用于大规模训练的数据吞吐</span>
                      </div>
                    </label>

                    {params.needStorage && (
                      <div className="pl-7 space-y-2 pt-2 border-t border-slate-100">
                        <div className="flex justify-between items-center">
                          <label className="text-xs font-medium text-slate-600">存储总成本预估</label>
                          <span className="text-xs font-bold text-indigo-600">{(params.storageCostTotal / 10000).toLocaleString()} 万</span>
                        </div>
                        <input 
                          type="range" 
                          min="100000" max="50000000" step="100000"
                          value={params.storageCostTotal}
                          onChange={(e) => handleParamChange('storageCostTotal', Number(e.target.value))}
                          className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                        />
                        <div className="flex justify-between text-[10px] text-slate-400">
                          <span>10万</span>
                          <span>5000万</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </section>

            {/* Section 2: On-Premise Details */}
            <section className="border border-slate-200 rounded-xl overflow-hidden shadow-sm">
              <button 
                onClick={() => toggleSection('onpremise')}
                className="w-full flex items-center justify-between p-4 bg-slate-50 hover:bg-slate-100 transition-colors"
              >
                <div className="flex items-center space-x-2">
                  <Settings className="w-5 h-5 text-slate-600" />
                  <span className="font-semibold text-slate-800">2. 自建隐藏成本深度微调</span>
                </div>
                {expandedSections['onpremise'] ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
              </button>
              
              {expandedSections['onpremise'] && (
                <div className="p-4 space-y-5 bg-white">
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <label className="text-sm font-medium text-slate-700">机柜供配电改造</label>
                      <span className="text-sm font-bold text-slate-700">{params.cabinetTransformationCost / 10000} 万/柜</span>
                    </div>
                    <input 
                      type="range" 
                      min="0" max="300000" step="10000"
                      value={params.cabinetTransformationCost}
                      onChange={(e) => handleParamChange('cabinetTransformationCost', Number(e.target.value))}
                      className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-slate-600"
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <label className="text-sm font-medium text-slate-700">资深运维年薪</label>
                      <span className="text-sm font-bold text-slate-700">{params.personnelCost / 10000} 万/年</span>
                    </div>
                    <input 
                      type="range" 
                      min="200000" max="1500000" step="50000"
                      value={params.personnelCost}
                      onChange={(e) => handleParamChange('personnelCost', Number(e.target.value))}
                      className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-slate-600"
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <label className="text-sm font-medium text-slate-700">资金占用利息 (WACC)</label>
                      <span className="text-sm font-bold text-slate-700">{params.wacc}%</span>
                    </div>
                    <input 
                      type="range" 
                      min="0" max="15" step="1"
                      value={params.wacc}
                      onChange={(e) => handleParamChange('wacc', Number(e.target.value))}
                      className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-slate-600"
                    />
                  </div>
                </div>
              )}
            </section>

            <div className="flex space-x-3 pt-4">
              <button className="flex-1 bg-white border border-slate-300 text-slate-700 py-2 rounded-lg font-medium hover:bg-slate-50 transition-colors flex items-center justify-center space-x-2">
                <Save className="w-4 h-4" />
                <span>存为新方案</span>
              </button>
              <button 
                onClick={() => setParams(DEFAULT_PARAMS)}
                className="flex-1 bg-white border border-slate-300 text-slate-700 py-2 rounded-lg font-medium hover:bg-slate-50 transition-colors flex items-center justify-center space-x-2"
              >
                <History className="w-4 h-4" />
                <span>恢复默认值</span>
              </button>
            </div>

          </div>
        </aside>

        {/* Right Panel: Dashboard */}
        <section className="flex-1 bg-slate-50 p-6 lg:p-8 overflow-y-auto">
          <div className="max-w-6xl mx-auto space-y-8">
            
            {/* Top Summary Cards */}
            <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 relative flex flex-col justify-between">
                <div className="absolute top-0 right-0 w-32 h-32 bg-red-50 rounded-bl-full -mr-10 -mt-10 opacity-50 pointer-events-none"></div>
                <div>
                  <div className="flex items-center space-x-3 mb-4">
                    <div className="p-2 bg-red-100 rounded-lg">
                      <Server className="w-6 h-6 text-red-600" />
                    </div>
                    <div className="flex items-center space-x-2 relative group">
                      <h2 className="text-lg font-semibold text-slate-700">自建 {params.projectLifespan/12} 年 TCO总预估</h2>
                      <button className="text-slate-400 hover:text-slate-600 focus:outline-none focus:text-slate-600 transition-colors">
                        <Info className="w-4 h-4" />
                      </button>
                      <div className="absolute top-full left-0 mt-2 w-80 bg-slate-800 text-white text-sm rounded-lg p-4 shadow-xl z-50 hidden group-hover:block group-focus-within:block pointer-events-none">
                        <p className="font-semibold mb-2 text-slate-100">自建TCO计算逻辑：</p>
                        <ul className="space-y-1 text-slate-300">
                          <li><span className="text-slate-400">初期 Capex：</span>硬件采购 + 网络设备 + 存储设备 + 机房改造</li>
                          <li><span className="text-slate-400">每月 Opex：</span>电费支出 + 机房租赁 + 人员运维 + 资金利息(WACC)</li>
                          <li><span className="text-slate-400">维保费用：</span>硬件与网络总价的10% (首年免费，第2年起计)</li>
                          <li className="pt-2 mt-2 border-t border-slate-700 text-emerald-400 font-medium">
                            总计 = Capex + (Opex × {params.projectLifespan}个月) + 维保费
                          </li>
                        </ul>
                      </div>
                    </div>
                  </div>
                  <div className="text-4xl font-bold text-slate-900 mb-2">
                    {formatCurrency(calculation.totalOnPremise)}
                  </div>
                </div>
                <div className="text-sm text-slate-500 flex items-center space-x-1 mt-4">
                  <span>初期 Capex:</span>
                  <span className="font-medium text-slate-700">{formatCurrency(calculation.capex)}</span>
                </div>
              </div>

              <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 relative flex flex-col justify-between">
                <div className="absolute top-0 right-0 w-32 h-32 bg-blue-50 rounded-bl-full -mr-10 -mt-10 opacity-50 pointer-events-none"></div>
                <div>
                  <div className="flex items-center space-x-3 mb-4">
                    <div className="p-2 bg-blue-100 rounded-lg">
                      <Cloud className="w-6 h-6 text-blue-600" />
                    </div>
                    <div className="flex items-center space-x-2 relative group">
                      <h2 className="text-lg font-semibold text-slate-700">AI安全算力 {params.projectLifespan/12} 年 TCO总预估</h2>
                      <button className="text-slate-400 hover:text-slate-600 focus:outline-none focus:text-slate-600 transition-colors">
                        <Info className="w-4 h-4" />
                      </button>
                      <div className="absolute top-full left-0 mt-2 w-80 bg-slate-800 text-white text-sm rounded-lg p-4 shadow-xl z-50 hidden group-hover:block group-focus-within:block pointer-events-none">
                        <p className="font-semibold mb-2 text-slate-100">AI安全算力TCO计算逻辑：</p>
                        <ul className="space-y-1 text-slate-300">
                          <li><span className="text-slate-400">算力月租：</span>单卡月租 × {calculation.totalCards}卡</li>
                          <li><span className="text-slate-400">计费策略：</span>无长租绑定折扣，按卡数量计费</li>
                          <li><span className="text-slate-400">存储月租：</span>{params.needStorage ? '50,000元/月 (高性能全闪)' : '0元'}</li>
                          <li className="pt-2 mt-2 border-t border-slate-700 text-blue-400 font-medium">
                            总计 = (算力月租 + 存储月租) × {params.projectLifespan}个月
                          </li>
                        </ul>
                      </div>
                    </div>
                  </div>
                  <div className="text-4xl font-bold text-slate-900 mb-2">
                    {formatCurrency(calculation.totalCloud)}
                  </div>
                </div>
                <div className="text-sm text-slate-500 flex items-center space-x-1 mt-4">
                  <span>零启动成本，纯 Opex 模式</span>
                </div>
              </div>

              <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 relative flex flex-col justify-between">
                <div className="absolute top-0 right-0 w-32 h-32 bg-amber-50 rounded-bl-full -mr-10 -mt-10 opacity-50 pointer-events-none"></div>
                <div>
                  <div className="flex items-center space-x-3 mb-4">
                    <div className="p-2 bg-amber-100 rounded-lg">
                      <Zap className="w-6 h-6 text-amber-600" />
                    </div>
                    <div className="flex items-center space-x-2 relative group">
                      <h2 className="text-lg font-semibold text-slate-700">月度电力成本</h2>
                      <button className="text-slate-400 hover:text-slate-600 focus:outline-none focus:text-slate-600 transition-colors">
                        <Info className="w-4 h-4" />
                      </button>
                      <div className="absolute top-full left-0 mt-2 w-80 bg-slate-800 text-white text-sm rounded-lg p-4 shadow-xl z-50 hidden group-hover:block group-focus-within:block pointer-events-none">
                        <p className="font-semibold mb-2 text-slate-100">电力成本计算逻辑：</p>
                        <ul className="space-y-1 text-slate-300">
                          <li><span className="text-slate-400">总功耗：</span>服务器数量 × 单机功耗</li>
                          <li><span className="text-slate-400">月耗电量：</span>总功耗 × 24小时 × 30天 × PUE</li>
                          <li><span className="text-slate-400">月电费：</span>月耗电量 × 电价</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                  <div className="text-4xl font-bold text-slate-900 mb-2">
                    {formatCurrency(calculation.electricityMonthly)}
                  </div>
                  <div className="text-sm text-slate-500 flex items-center space-x-1 mb-6">
                    <span>总功耗:</span>
                    <span className="font-medium text-slate-700">{calculation.totalPowerKW.toFixed(0)} kW</span>
                  </div>
                </div>
                
                <div className="space-y-4 pt-4 border-t border-slate-100">
                  <div className="space-y-1">
                    <div className="flex justify-between items-center">
                      <label className="text-xs font-medium text-slate-500">工业/商业电价</label>
                      <span className="text-xs font-bold text-amber-600">{params.electricityPrice.toFixed(2)} 元/度</span>
                    </div>
                    <input 
                      type="range" 
                      min="0.3" max="1.5" step="0.1"
                      value={params.electricityPrice}
                      onChange={(e) => handleParamChange('electricityPrice', Number(e.target.value))}
                      className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-amber-500"
                    />
                  </div>
                  <div className="space-y-1">
                    <div className="flex justify-between items-center">
                      <label className="text-xs font-medium text-slate-500">数据中心 PUE</label>
                      <span className="text-xs font-bold text-amber-600">{params.pue.toFixed(2)}</span>
                    </div>
                    <input 
                      type="range" 
                      min="1.1" max="1.8" step="0.05"
                      value={params.pue}
                      onChange={(e) => handleParamChange('pue', Number(e.target.value))}
                      className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-amber-500"
                    />
                  </div>
                </div>
              </div>
            </section>

            {/* O&M Comparison Banner */}
            <button 
              onClick={() => setIsOMModalOpen(true)}
              className="w-full relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#4338ca] to-[#312e81] p-6 text-left transition-transform hover:scale-[1.01] hover:shadow-lg group border border-indigo-500/30"
            >
              <div className="absolute top-0 right-0 -mt-4 -mr-4 w-32 h-32 bg-white opacity-5 rounded-full blur-2xl"></div>
              <div className="absolute bottom-0 left-1/2 w-48 h-48 bg-indigo-500 opacity-20 rounded-full blur-3xl"></div>
              
              <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center space-x-5">
                  <div className="bg-white/10 p-3 rounded-xl backdrop-blur-sm border border-white/10 shrink-0">
                    <Activity className="w-7 h-7 text-indigo-100" />
                  </div>
                  <div>
                    <div className="flex items-center space-x-3 mb-1">
                      <h3 className="text-xl font-bold text-white tracking-wide">本地自建 vs AI安全算力：差异深度对比</h3>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/40 text-indigo-100 border border-indigo-400/30">INSIGHT</span>
                    </div>
                    <p className="text-indigo-200 text-sm">点击查看为什么本地自建与AI安全算力在 <span className="text-white font-semibold">财务风险、业务敏捷度、技术迭代、运维保障、AI效能</span> 等维度存在巨大的隐性成本鸿沟。</p>
                  </div>
                </div>
                <div className="flex items-center space-x-2 text-indigo-100 group-hover:text-white transition-colors shrink-0">
                  <span className="text-sm font-medium">查看详情</span>
                  <svg className="w-4 h-4 transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H18V14M18 6L6 18" />
                  </svg>
                </div>
              </div>
            </button>

            {/* Conclusion Banner */}
            <section className={cn(
              "rounded-xl p-4 flex items-start space-x-4 border",
              calculation.crossingPoint 
                ? "bg-emerald-50 border-emerald-200" 
                : "bg-amber-50 border-amber-200"
            )}>
              <div className={cn(
                "p-2 rounded-full mt-0.5",
                calculation.crossingPoint ? "bg-emerald-100" : "bg-amber-100"
              )}>
                <Info className={cn(
                  "w-5 h-5",
                  calculation.crossingPoint ? "text-emerald-600" : "text-amber-600"
                )} />
              </div>
              <div>
                <h3 className={cn(
                  "text-lg font-bold",
                  calculation.crossingPoint ? "text-emerald-800" : "text-amber-800"
                )}>核心结论</h3>
                <p className={cn(
                  "text-sm mt-1",
                  calculation.crossingPoint ? "text-emerald-700" : "text-amber-700"
                )}>
                  {calculation.crossingPoint ? (
                    <>
                      AI安全算力方案更优，盈亏平衡点在 <strong>第 {calculation.crossingPoint} 个月</strong>。
                      在 {params.projectLifespan} 个月生命周期内，AI安全算力方案可为您节省 <strong>{formatCurrency(calculation.totalOnPremise - calculation.totalCloud)}</strong>。
                    </>
                  ) : (
                    <>
                      在 {params.projectLifespan} 个月生命周期内，自建方案总成本更低。
                      但请注意自建方案需要一次性投入 <strong>{formatCurrency(calculation.capex)}</strong> 的巨额资金，且面临硬件迭代贬值风险。
                    </>
                  )}
                </p>
              </div>
            </section>

            {/* Main Chart */}
            <section className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
              <h3 className="text-lg font-bold text-slate-800 mb-6">TCO 累计成本走势与盈亏平衡点</h3>
              <div className="h-[280px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={calculation.timeline}
                    margin={{ top: 20, right: 30, left: 40, bottom: 20 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis 
                      dataKey="month" 
                      tickFormatter={(val) => `第${val}个月`}
                      tick={{ fill: '#64748b', fontSize: 12 }}
                      axisLine={{ stroke: '#cbd5e1' }}
                      tickLine={false}
                      dy={10}
                    />
                    <YAxis 
                      tickFormatter={(val) => `${(val / 10000).toFixed(0)}万`}
                      tick={{ fill: '#64748b', fontSize: 12 }}
                      axisLine={false}
                      tickLine={false}
                      dx={-10}
                    />
                    <Tooltip 
                      formatter={(value: number) => formatCurrency(value)}
                      labelFormatter={(label) => `第 ${label} 个月`}
                      contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                    />
                    <Legend verticalAlign="top" height={36} iconType="circle" />
                    <Line 
                      type="monotone" 
                      dataKey="onPremise" 
                      name="自建成本曲线 (高Capex起点)" 
                      stroke="#ef4444" 
                      strokeWidth={3}
                      dot={false}
                      activeDot={{ r: 6, fill: '#ef4444', stroke: '#fff', strokeWidth: 2 }}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="cloud" 
                      name="AI安全算力成本曲线 (零启动成本)" 
                      stroke="#3b82f6" 
                      strokeWidth={3}
                      dot={false}
                      activeDot={{ r: 6, fill: '#3b82f6', stroke: '#fff', strokeWidth: 2 }}
                    />
                    {calculation.crossingPoint && (
                      <ReferenceLine 
                        x={calculation.crossingPoint} 
                        stroke="#10b981" 
                        strokeDasharray="3 3" 
                        label={{ position: 'top', value: `盈亏平衡点 (第${calculation.crossingPoint}个月)`, fill: '#10b981', fontSize: 12, fontWeight: 'bold' }} 
                      />
                    )}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </section>

            {/* Breakdown and Radar Charts */}
            <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Breakdown Chart */}
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
                <h3 className="text-lg font-bold text-slate-800 mb-6">自建方案成本拆解 ({params.projectLifespan / 12}年总额)</h3>
                <div className="h-[350px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={calculation.breakdown}
                        cx="50%"
                        cy="50%"
                        innerRadius={80}
                        outerRadius={120}
                        paddingAngle={2}
                        dataKey="value"
                        nameKey="name"
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                        labelLine={true}
                      >
                        {calculation.breakdown.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.fill} />
                        ))}
                      </Pie>
                      <Tooltip 
                        formatter={(value: number) => formatCurrency(value)}
                        contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                      />
                      <Legend verticalAlign="bottom" height={36} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Radar Chart */}
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
                <h3 className="text-lg font-bold text-slate-800 mb-6">综合效能对比 (TCO/弹性/运维/时间)</h3>
                <div className="h-[350px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <RadarChart cx="50%" cy="50%" outerRadius="70%" data={radarData}>
                      <PolarGrid stroke="#e2e8f0" />
                      <PolarAngleAxis dataKey="subject" tick={{ fill: '#475569', fontSize: 12, fontWeight: 500 }} />
                      <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                      <Radar name="AI安全算力方案" dataKey="AI安全算力" stroke="#3b82f6" strokeWidth={2} fill="#3b82f6" fillOpacity={0.4} />
                      <Radar name="自建方案" dataKey="自建" stroke="#ef4444" strokeWidth={2} fill="#ef4444" fillOpacity={0.4} />
                      <Legend verticalAlign="bottom" height={36} iconType="circle" />
                      <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                    </RadarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </section>


          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 px-6 py-4 text-center text-slate-500 text-xs">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between space-y-2 md:space-y-0">
          <p>© 2026 智算引擎评估系统. 基于 HTML5 & React 构建.</p>
          <div className="flex items-center space-x-4">
            <a href="#" className="hover:text-indigo-600 transition-colors">使用条款</a>
            <a href="#" className="hover:text-indigo-600 transition-colors">隐私政策</a>
            <a href="#" className="hover:text-indigo-600 transition-colors">技术支持</a>
          </div>
        </div>
      </footer>

      {/* O&M Modal */}
      {isOMModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity" onClick={() => setIsOMModalOpen(false)}></div>
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-indigo-100 rounded-lg">
                  <Wrench className="w-5 h-5 text-indigo-600" />
                </div>
                <h3 className="text-lg font-bold text-slate-800">本地自建 vs AI安全算力：差异深度对比</h3>
              </div>
              <button 
                onClick={() => setIsOMModalOpen(false)}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto">
              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="w-full text-left border-collapse min-w-[800px]">
                  <thead>
                    <tr>
                      <th className="py-4 px-6 bg-slate-50 font-semibold text-slate-700 border-b border-slate-200 w-1/5 rounded-tl-lg">商业关注点</th>
                      <th className="py-4 px-6 bg-slate-50 font-semibold text-slate-700 border-b border-slate-200 w-1/6">评估维度</th>
                      <th className="py-4 px-6 bg-red-50/60 font-semibold text-red-800 border-b border-red-100 w-1/3">本地自建 (重资产/高门槛)</th>
                      <th className="py-4 px-6 bg-emerald-50/60 font-semibold text-emerald-800 border-b border-emerald-100 w-1/3 rounded-tr-lg">AI安全算力 (轻资产/开箱即用)</th>
                    </tr>
                  </thead>
                  <tbody className="text-sm">
                    <tr className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                      <td className="py-4 px-6 text-slate-800">
                        <div className="font-medium flex items-center space-x-2">
                          <CircleDollarSign className="w-5 h-5 text-emerald-600" />
                          <span>财务与风险</span>
                        </div>
                        <div className="text-slate-500 text-xs mt-1 italic">(降本避险)</div>
                      </td>
                      <td className="py-4 px-6 text-slate-600">成本结构与资金利用率</td>
                      <td className="py-4 px-6 text-slate-600 bg-red-50/30">
                        <div className="flex items-start space-x-2">
                          <XCircle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
                          <div>
                            <span className="font-semibold text-slate-800 block mb-1">前期巨额沉没成本 (CAPEX)</span>
                            <p className="text-slate-600 leading-relaxed">需一次性投入大量现金采购硬件和机房供电、制冷改造。同时需自备备件库 (GPU、内存、硬盘等)，造成资产浪费。</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-6 text-slate-600 bg-emerald-50/30">
                        <div className="flex items-start space-x-2">
                          <CheckCircle2 className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" />
                          <div>
                            <span className="font-semibold text-slate-800 block mb-1">按需订阅的轻资产模式 (OPEX)</span>
                            <p className="text-slate-600 leading-relaxed">资金利用率最大化，无硬件折旧与备件库囤积成本，大幅缩短项目整体回报周期。</p>
                          </div>
                        </div>
                      </td>
                    </tr>
                    <tr className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                      <td className="py-4 px-6 text-slate-800">
                        <div className="font-medium flex items-center space-x-2">
                          <Rocket className="w-5 h-5 text-blue-600" />
                          <span>业务敏捷度</span>
                        </div>
                        <div className="text-slate-500 text-xs mt-1 italic">(天下武功唯快不破)</div>
                      </td>
                      <td className="py-4 px-6 text-slate-600">上线与部署周期</td>
                      <td className="py-4 px-6 text-slate-600 bg-red-50/30">
                        <div className="flex items-start space-x-2">
                          <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
                          <div>
                            <span className="font-semibold text-slate-800 block mb-1">按月计的漫长等待</span>
                            <p className="text-slate-600 leading-relaxed">需经历繁琐的招投标、机房基建改造（高密算力机柜改造难度极大）和复杂的网络联调，严重拖慢业务上线节奏。</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-6 text-slate-600 bg-emerald-50/30">
                        <div className="flex items-start space-x-2">
                          <CheckCircle2 className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" />
                          <div>
                            <span className="font-semibold text-slate-800 block mb-1">最快 1 天的即开即用</span>
                            <p className="text-slate-600 leading-relaxed">跳过底层采购与基建环节，算力环境开箱即用，让业务构想能够立刻落地验证。</p>
                          </div>
                        </div>
                      </td>
                    </tr>
                    <tr className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                      <td className="py-4 px-6 text-slate-800">
                        <div className="font-medium flex items-center space-x-2">
                          <RefreshCw className="w-5 h-5 text-amber-600" />
                          <span>技术迭代风险</span>
                        </div>
                      </td>
                      <td className="py-4 px-6 text-slate-600">技术迭代与淘汰风险</td>
                      <td className="py-4 px-6 text-slate-600 bg-red-50/30">
                        <div className="flex items-start space-x-2">
                          <XCircle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
                          <div>
                            <span className="font-semibold text-slate-800 block mb-1">沉重的技术包袱</span>
                            <p className="text-slate-600 leading-relaxed">硬件架构一旦定型极难更改。面对几个月就迭代一次的 AI 模型，算力极易落伍，客户需完全承担设备快速过时的风险。</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-6 text-slate-600 bg-emerald-50/30">
                        <div className="flex items-start space-x-2">
                          <CheckCircle2 className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" />
                          <div>
                            <span className="font-semibold text-slate-800 block mb-1">技术风险云端转移</span>
                            <p className="text-slate-600 leading-relaxed">将技术迭代的压力交给云厂商，客户可随时按业务需求灵活切换至最新代际的计算实例，始终保持算力领先。</p>
                          </div>
                        </div>
                      </td>
                    </tr>
                    <tr className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                      <td className="py-4 px-6 text-slate-800">
                        <div className="font-medium flex items-center space-x-2">
                          <Wrench className="w-5 h-5 text-slate-600" />
                          <span>运维精力分配</span>
                        </div>
                        <div className="text-slate-500 text-xs mt-1 italic">(让专业的人做专业的事)</div>
                      </td>
                      <td className="py-4 px-6 text-slate-600">连续性保障与底层运维</td>
                      <td className="py-4 px-6 text-slate-600 bg-red-50/30">
                        <div className="flex items-start space-x-2">
                          <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
                          <div>
                            <span className="font-semibold text-slate-800 block mb-1">极其沉重且风险自担</span>
                            <p className="text-slate-600 leading-relaxed">客户需分心管理复杂的动环（市电/制冷/PUE）与 IB/RoCE 高性能网络。硬件一旦故障，需停机人工排查，极易导致算力长时间停摆。</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-6 text-slate-600 bg-emerald-50/30">
                        <div className="flex items-start space-x-2">
                          <CheckCircle2 className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" />
                          <div>
                            <span className="font-semibold text-slate-800 block mb-1">零底层运维，SLA 兜底</span>
                            <p className="text-slate-600 leading-relaxed">完全屏蔽物理机房与底层网络复杂性。云厂商提供多可用区容灾、故障自动热迁移，享受 99.9%+ 的企业级业务连续性保障。</p>
                          </div>
                        </div>
                      </td>
                    </tr>
                    <tr className="hover:bg-slate-50 transition-colors">
                      <td className="py-4 px-6 text-slate-800">
                        <div className="font-medium flex items-center space-x-2">
                          <BrainCircuit className="w-5 h-5 text-indigo-600" />
                          <span>AI效能与安全</span>
                        </div>
                        <div className="text-slate-500 text-xs mt-1 italic">(聚焦核心业务)</div>
                      </td>
                      <td className="py-4 px-6 text-slate-600">开发门槛与数据资产保护</td>
                      <td className="py-4 px-6 text-slate-600 bg-red-50/30">
                        <div className="flex items-start space-x-2">
                          <XCircle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
                          <div>
                            <span className="font-semibold text-slate-800 block mb-1">造轮子成本高</span>
                            <p className="text-slate-600 leading-relaxed">需高薪聘请技术团队自行折腾 OS、CUDA 驱动及 K8s/Slurm 调度系统，环境极易产生冲突。或者需要承担昂贵的算力服务管理平台买断成本。</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-6 text-slate-600 bg-emerald-50/30">
                        <div className="flex items-start space-x-2">
                          <ShieldCheck className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" />
                          <div>
                            <span className="font-semibold text-slate-800 block mb-1">专注业务创新与核心合规</span>
                            <p className="text-slate-600 leading-relaxed">提供托管级 AI 服务平台，模型开箱即部署；内置联邦隐私等前沿技术，确保核心数据与模型资产不出域、绝对安全。</p>
                          </div>
                        </div>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
