import { Asset, User, ChartDataPoint, DepreciationPoint } from './types';

export const MOCK_ASSETS: Asset[] = [
  {
    id: '1',
    productId: 'PTDF-0042',
    name: 'HP EliteBook G8',
    category: 'IT Equipment',
    acquisitionCost: 850000,
    acquisitionDate: '2023-01-15',
    netBookValue: 620000,
    location: 'Abuja HQ',
    custodian: 'Emeka Okafor',
    status: 'Active',
    image: 'https://picsum.photos/200/200'
  },
  {
    id: '2',
    productId: 'PTDF-1023',
    name: 'Toyota Hilux 2022',
    category: 'Vehicles',
    acquisitionCost: 25000000,
    acquisitionDate: '2022-06-10',
    netBookValue: 18500000,
    location: 'Lagos Office',
    custodian: 'Transport Pool',
    status: 'Active',
    image: 'https://picsum.photos/201/201'
  },
  {
    id: '3',
    productId: 'PTDF-3099',
    name: 'Conference Table (Mahogany)',
    category: 'Furniture',
    acquisitionCost: 450000,
    acquisitionDate: '2021-11-05',
    netBookValue: 210000,
    location: 'Abuja HQ - Room 3B',
    custodian: 'Facilities Mgr',
    status: 'Maintenance',
    image: 'https://picsum.photos/202/202'
  },
  {
    id: '4',
    productId: 'PTDF-0055',
    name: 'Dell PowerEdge Server',
    category: 'IT Equipment',
    acquisitionCost: 4500000,
    acquisitionDate: '2023-08-20',
    netBookValue: 4100000,
    location: 'Abuja Server Room',
    custodian: 'IT Director',
    status: 'Active',
    image: 'https://picsum.photos/203/203'
  }
];

export const MOCK_USERS: User[] = [
  { id: '1', name: 'Amina Yusuf', email: 'a.yusuf@ptdf.gov.ng', department: 'IT', role: 'System Admin', lastLogin: '2024-05-20 08:30' },
  { id: '2', name: 'Tunde Bakare', email: 't.bakare@ptdf.gov.ng', department: 'Finance', role: 'Asset Manager', lastLogin: '2024-05-19 14:15' },
  { id: '3', name: 'Chioma Obi', email: 'c.obi@ptdf.gov.ng', department: 'Audit', role: 'Auditor', lastLogin: '2024-05-18 09:45' },
];

export const ASSET_DISTRIBUTION: ChartDataPoint[] = [
  { name: 'IT Equipment', value: 40 },
  { name: 'Vehicles', value: 20 },
  { name: 'Furniture', value: 15 },
  { name: 'Machinery', value: 15 },
  { name: 'Land/Buildings', value: 10 },
];

export const DEPRECIATION_DATA: DepreciationPoint[] = [
  { period: 'Q1 2023', value: 50 },
  { period: 'Q2 2023', value: 120 },
  { period: 'Q3 2023', value: 180 },
  { period: 'Q4 2023', value: 240 },
  { period: 'Q1 2024', value: 310 },
];

export const CATEGORIES = ['IT Equipment', 'Vehicles', 'Furniture', 'Machinery', 'Land & Buildings', 'Software Licenses'];
export const LOCATIONS = ['Abuja HQ', 'Lagos Office', 'Port Harcourt', 'Kaduna Training Center'];