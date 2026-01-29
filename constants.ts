
import { Asset, User, ChartDataPoint, DepreciationPoint, AssetHistoryEvent, ConditionCode, WipAsset, AuditSession, AuditVerification } from './types';

export const CONDITION_DESCRIPTIONS: Record<ConditionCode, string> = {
  'A1': 'New - Perfect Condition',
  'A2': 'Used - Good Condition',
  'A3': 'Used - Fair Condition',
  'A4': 'Used - Poor Condition',
  'F1': 'Damaged - Minor Repairs Needed',
  'F2': 'Damaged - Major Repairs Needed',
  'F3': 'Unsalvageable / Scrap',
  'F4': 'Disposed / Written Off'
};

export const MOCK_ASSETS: Asset[] = [
  {
    id: '1',
    productId: 'ABDC/ABJ/ITE/0042',
    name: 'HP EliteBook G8',
    category: 'IT Equipment',
    acquisitionCost: 850000,
    acquisitionDate: '2023-01-15',
    netBookValue: 620000,
    location: 'Abuja',
    subLocation: 'IT Server Room',
    custodian: 'Emeka Okafor',
    assignedUser: 'John Doe',
    status: 'Active',
    conditionCode: 'A2',
    image: 'https://picsum.photos/200/200',
    usefulLife: 4,
    salvageValue: 50000
  },
  {
    id: '2',
    productId: 'ABDC/LAG/VH/1023',
    name: 'Toyota Hilux 2022',
    category: 'Vehicles',
    acquisitionCost: 25000000,
    acquisitionDate: '2022-06-10',
    netBookValue: 18500000,
    location: 'Abuja',
    subLocation: 'Parking Lot B',
    custodian: 'Transport Pool',
    status: 'Active',
    conditionCode: 'A3',
    image: 'https://picsum.photos/201/201',
    usefulLife: 8,
    salvageValue: 2000000
  },
  {
    id: '3',
    productId: 'ABDC/ABJ/FAF/3099',
    name: 'Conference Table (Mahogany)',
    category: 'Furniture and Fittings',
    acquisitionCost: 450000,
    acquisitionDate: '2021-11-05',
    netBookValue: 210000,
    location: 'Abuja',
    subLocation: 'Conference Room 3B',
    custodian: 'Facilities Mgr',
    status: 'Maintenance',
    conditionCode: 'F1',
    image: 'https://picsum.photos/202/202',
    usefulLife: 10,
    salvageValue: 20000
  },
  {
    id: '4',
    productId: 'ABDC/ABJ/ITE/0055',
    name: 'Dell PowerEdge Server',
    category: 'IT Equipment',
    acquisitionCost: 4500000,
    acquisitionDate: '2023-08-20',
    netBookValue: 4100000,
    location: 'Abuja',
    subLocation: 'Server Room',
    custodian: 'IT Director',
    status: 'Active',
    conditionCode: 'A1',
    image: 'https://picsum.photos/203/203',
    usefulLife: 5,
    salvageValue: 250000
  },
  // Disposed Asset 1
  {
    id: '5',
    productId: 'ABDC/PHC/OE/0991',
    name: 'Canon Photocopier (Old)',
    category: 'Office Equipment',
    acquisitionCost: 650000,
    acquisitionDate: '2019-03-10',
    netBookValue: 0,
    location: 'Kaduna',
    subLocation: 'Admin Block',
    custodian: 'Office Manager',
    status: 'Disposed',
    conditionCode: 'F4',
    image: 'https://picsum.photos/204/204',
    usefulLife: 4,
    salvageValue: 10000,
    disposalMode: 'Scrapped',
    disposalDate: '2024-01-15'
  },
  // Disposed Asset 2
  {
    id: '6',
    productId: 'ABDC/KAD/VH/0882',
    name: 'Honda Accord 2015',
    category: 'Vehicles',
    acquisitionCost: 8000000,
    acquisitionDate: '2015-05-20',
    netBookValue: 500000,
    location: 'Kaduna',
    subLocation: 'Main Garage',
    custodian: 'Logistics Officer',
    status: 'Disposed',
    conditionCode: 'F4',
    image: 'https://picsum.photos/205/205',
    usefulLife: 8,
    salvageValue: 500000,
    disposalMode: 'Sold',
    disposalDate: '2024-02-28'
  }
];

export const MOCK_WIP_ASSETS: WipAsset[] = [
  {
    id: 'AUC-2024-001',
    projectName: 'ABDC HQ Annex Construction',
    assetType: 'Land & Buildings',
    projectManager: 'Engr. Tunde Bakare',
    budgetedCost: 450000000,
    inceptionDate: '2024-01-10',
    estimatedCompletionDate: '2025-06-30',
    status: 'In Progress',
    finalDepreciationMethod: 'Straight-Line',
    finalUsefulLife: 50,
    costLedger: [
      { id: '1', date: '2024-01-15', type: 'Professional Fees', vendor: 'Design Arch Ltd', amount: 15000000, referenceDoc: 'INV-ARCH-01', description: 'Initial Architectural Drawings' },
      { id: '2', date: '2024-02-20', type: 'Materials', vendor: 'Dangote Cement', amount: 45000000, referenceDoc: 'PO-CEM-88', description: 'Foundation Materials' },
      { id: '3', date: '2024-03-10', type: 'External Labor', vendor: 'BuildRight Construction', amount: 12000000, referenceDoc: 'INV-LAB-01', description: 'Foundation Laying Labor' }
    ]
  },
  {
    id: 'AUD-2024-005',
    projectName: 'Internal HR Portal v2.0',
    assetType: 'Software Licenses',
    projectManager: 'Amina Yusuf',
    budgetedCost: 25000000,
    inceptionDate: '2024-03-01',
    estimatedCompletionDate: '2024-09-15',
    status: 'Testing',
    finalDepreciationMethod: 'Straight-Line',
    finalUsefulLife: 5,
    costLedger: [
      { id: '1', date: '2024-04-10', type: 'Software Dev', vendor: 'TechSolutions Ltd', amount: 5000000, referenceDoc: 'INV-TS-01', description: 'Module 1 Development' },
      { id: '2', date: '2024-05-15', type: 'Internal Labor', vendor: 'Internal IT', amount: 2500000, referenceDoc: 'TS-MAY-24', description: 'Capitalized Dev Hours (May)' }
    ]
  }
];

export const MOCK_ASSET_HISTORY: AssetHistoryEvent[] = [
  // History for HP EliteBook (ID 1)
  { id: '1', assetId: '1', date: '2023-01-15 09:30', action: 'Asset Registered', user: 'System Admin', details: 'Initial system entry via Bulk Import from PO-2023-001.', type: 'Registration' },
  { id: '2', assetId: '1', date: '2023-01-20 14:15', action: 'Custodian Assigned', user: 'Tunde Bakare', details: 'Assigned to Emeka Okafor (IT Dept). Handover form signed.', type: 'Transfer', fromLocation: 'Central Stores', toLocation: 'Abuja HQ', toCustodian: 'Emeka Okafor' },
  { id: '3', assetId: '1', date: '2023-06-15 10:00', action: 'Maintenance Scheduled', user: 'System', details: 'Routine 6-month checkup alert generated automatically.', type: 'Maintenance' },
  { id: '4', assetId: '1', date: '2023-06-18 11:30', action: 'Maintenance Completed', user: 'Ext. Vendor (TechFix)', details: 'Fan cleaning and thermal paste replacement. System performance verified.', type: 'Maintenance' },
  { id: '5', assetId: '1', date: '2023-11-05 09:45', action: 'Audit Verification', user: 'Chioma Obi', details: 'Asset physically verified during Q3 Audit. Condition: Good. Label intact.', type: 'Audit' },

  // History for Toyota Hilux (ID 2)
  { id: '6', assetId: '2', date: '2022-06-10 10:00', action: 'Asset Registered', user: 'System Admin', details: 'Direct Purchase entry from Toyota Nigeria.', type: 'Registration' },
  { id: '7', assetId: '2', date: '2022-06-12 15:00', action: 'Custodian Assigned', user: 'Transport Manager', details: 'Assigned to Transport Pool for general logistics.', type: 'Transfer', fromLocation: 'Dealer Yard', toLocation: 'Lagos Office', toCustodian: 'Transport Pool' },
  { id: '8', assetId: '2', date: '2023-02-14 08:30', action: 'Maintenance Completed', user: 'Workshop Supervisor', details: '10,000km Service. Oil change and filter replacement.', type: 'Maintenance' },
  { id: '9', assetId: '2', date: '2023-12-01 11:00', action: 'Audit Verification', user: 'Chioma Obi', details: 'Verified at Lagos Office. Odometer: 15,400km.', type: 'Audit' },

  // History for Conference Table (ID 3)
  { id: '10', assetId: '3', date: '2021-11-05 13:00', action: 'Asset Registered', user: 'Procurement Officer', details: 'Delivered to Abuja HQ.', type: 'Registration' },
  { id: '11', assetId: '3', date: '2024-01-10 09:00', action: 'Condition Issue Reported', user: 'Facilities Mgr', details: 'Deep scratch observed on surface. Requesting refinishing.', type: 'Issue' },
  { id: '12', assetId: '3', date: '2024-01-12 10:00', action: 'Status Changed', user: 'Asset Manager', details: 'Status updated to Maintenance pending repairs.', type: 'Maintenance' },

  // Additional mock transfer for ID 1 to show history depth
  { id: '13', assetId: '1', date: '2023-05-10 11:00', action: 'Temporary Transfer', user: 'System Admin', details: 'Loaned to Kaduna Training Center for 2 weeks.', type: 'Transfer', fromLocation: 'Abuja HQ', toLocation: 'Kaduna Training Center', toCustodian: 'Training Lead' },
  { id: '14', assetId: '1', date: '2023-05-25 09:00', action: 'Return Transfer', user: 'System Admin', details: 'Returned from Training Center.', type: 'Transfer', fromLocation: 'Kaduna Training Center', toLocation: 'Abuja HQ', toCustodian: 'Emeka Okafor' },
];

export const MOCK_USERS: User[] = [
  { id: '1', name: 'Amina Yusuf', email: 'a.yusuf@abdc.com', department: 'IT', role: 'System Admin', lastLogin: '2024-05-20 08:30' },
  { id: '2', name: 'Tunde Bakare', email: 't.bakare@abdc.com', department: 'Finance', role: 'Asset Manager', lastLogin: '2024-05-19 14:15' },
  { id: '3', name: 'Emeka Okafor', email: 'e.okafor@abdc.com', department: 'Operations', role: 'Custodian', lastLogin: '2024-05-21 11:15' },
  { id: '4', name: 'Chioma Obi', email: 'c.obi@abdc.com', department: 'Audit', role: 'Auditor', lastLogin: '2024-05-18 09:45' },
];

export const ASSET_DISTRIBUTION: ChartDataPoint[] = [
  { name: 'IT Equipment', value: 25 },
  { name: 'Office Equipment', value: 15 },
  { name: 'Vehicles', value: 20 },
  { name: 'Furniture and Fittings', value: 15 },
  { name: 'Plant and Machinery', value: 15 },
  { name: 'Land & Buildings', value: 10 },
];

export const DEPRECIATION_DATA: DepreciationPoint[] = [
  { period: 'Q1 2023', value: 50 },
  { period: 'Q2 2023', value: 120 },
  { period: 'Q3 2023', value: 180 },
  { period: 'Q4 2023', value: 240 },
  { period: 'Q1 2024', value: 310 },
];

export const CATEGORIES = [
  'IT Equipment',
  'Office Equipment',
  'Vehicles',
  'Furniture and Fittings',
  'Plant and Machinery',
  'Land & Buildings',
  'Software Licenses'
];

export const LOCATIONS = ['Abuja', 'Kaduna'];

// New constant for mapping locations to their specific branches/offices
export const LOCATION_BRANCHES: Record<string, string[]> = {
  'Abuja': [
    'Tax',
    'Advisory',
    'Audit and Assurance',
    'Shared Services'
  ],
  'Kaduna': [
    'Tax',
    'Advisory',
    'Audit and Assurance',
    'Shared Services'
  ]
};

export const LOCATION_CODES: Record<string, string> = {
  'Abuja': 'ABJ',
  'Kaduna': 'KAD'
};

export const CATEGORY_CODES: Record<string, string> = {
  'IT Equipment': 'ITE',
  'Office Equipment': 'OE',
  'Vehicles': 'VH',
  'Furniture and Fittings': 'FAF',
  'Plant and Machinery': 'PM',
  'Land & Buildings': 'LB',
  'Software Licenses': 'SL'
};

export const SUB_CATEGORIES: Record<string, string[]> = {
  'IT Equipment': [
    'Laptops',
    'Desktop Computers',
    'Monitors',
    'Printers & Scanners',
    'Servers',
    'Networking Gear',
    'UPS & Inverters',
    'External Storage',
    'Tablets/IPads',
    'Projectors'
  ],
  'Office Equipment': [
    'Photocopiers',
    'Water Dispensers',
    'Refrigerators/Freezers',
    'Air Conditioning Units',
    'Paper Shredders',
    'Binding Machines',
    'Microwaves',
    'Industrial Fans',
    'Television Sets'
  ]
};

export const DEPARTMENT_CODES: Record<string, string> = {
  'Audit and Assurance': 'AA',
  'Advisory': 'ADV',
  'Tax': 'TAX',
  'Shared Services': 'SS'
};

export const MOCK_AUDIT_SESSIONS: AuditSession[] = [];

export const MOCK_AUDIT_VERIFICATIONS: AuditVerification[] = [];

