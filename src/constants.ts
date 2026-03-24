export const GPU_MODELS = [
  { id: 'h100', name: 'NVIDIA H100 (SXM)', power: 10.2, price: 2800000, network: 'IB', cloudPricePerMonth: 80000 },
  { id: 'h20', name: 'NVIDIA H20 (SXM)', power: 6.5, price: 1100000, network: 'IB', cloudPricePerMonth: 35000 },
  { id: 'a100', name: 'NVIDIA A100 (SXM)', power: 6.5, price: 900000, network: 'IB', cloudPricePerMonth: 30000 },
  { id: 'l20', name: 'NVIDIA L20 (PCIe)', power: 4.0, price: 500000, network: 'RoCE', cloudPricePerMonth: 15000 },
  { id: 'rtx5090', name: 'NVIDIA RTX 5090', power: 7.0, price: 350000, network: 'RoCE', cloudPricePerMonth: 10000 },
  { id: 'rtx4090', name: 'NVIDIA RTX 4090', power: 5.5, price: 200000, network: 'RoCE', cloudPricePerMonth: 6000 },
  { id: 'ascend910b4', name: '华为昇腾 910B4', power: 6.5, price: 1200000, network: 'RoCE', cloudPricePerMonth: 35000 },
  { id: 'muxic500', name: '沐曦 C500', power: 5.0, price: 800000, network: 'RoCE', cloudPricePerMonth: 20000 },
  { id: 'muxin260', name: '沐曦 N260', power: 2.5, price: 300000, network: 'RoCE', cloudPricePerMonth: 8000 },
];

export interface GpuConfig {
  id: string;
  model: string;
  count: number;
  cloudPricePerCard: number;
  hardwarePricePerCard: number;
}

export const DEFAULT_PARAMS = {
  gpuConfigs: [
    {
      id: 'cluster-1',
      model: 'h20',
      count: 8,
      cloudPricePerCard: 35000,
      hardwarePricePerCard: 1100000 / 8,
    }
  ] as GpuConfig[],
  projectLifespan: 36,
  needNetwork: true,
  networkCostTotal: 8 * 1100000 * 0.2, // 8 * 1100000 * 0.2 (IB default)
  needStorage: false,
  storageCostTotal: 0,
  electricityPrice: 0.8,
  pue: 1.4,
  cabinetTransformationCost: 100000,
  personnelCost: 600000,
  wacc: 5
};
