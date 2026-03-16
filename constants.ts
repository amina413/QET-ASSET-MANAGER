
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

// Fresh start: no seed data. Assets come from the database; WIP list starts empty.
export const MOCK_ASSETS: Asset[] = [];

export const MOCK_WIP_ASSETS: WipAsset[] = [];

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
  { name: 'Motor Vehicles', value: 20 },
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
  'Motor Vehicles',
  'Furniture and Fittings',
  'Plant and Machinery',
  'Land & Buildings',
  'Software Licenses'
];

export const LOCATIONS = [
  'Abuja',
  'Kaduna',
  'Adamawa',
  'Lagos',
  'Port Harcourt',
  'Kano',
  'Enugu',
  'Ibadan'
];

// Department/Unit names per location (used when DB has none or as fallback)
export const LOCATION_BRANCHES: Record<string, string[]> = {
  'Abuja': [
    'Advisory',
    'Audit and Assurance',
    'Project and Tax',
    'Shared Services',
    'Training Room',
    'Server room 1',
    'Server room 2',
    'Server room 3',
    'Server room 4',
    'Kitchenette 1',
    'Kitchenette 2',
    'Kitchenette 3',
    'Canteen',
    'Cafe',
    'Main security post'
  ],
  'Kaduna': [
    'Advisory',
    'Audit and Assurance',
    'Project and Tax',
    'Shared Services',
    'Training Room',
    'Server room 1',
    'Server room 2',
    'Server room 3',
    'Server room 4',
    'Kitchenette 1',
    'Kitchenette 2',
    'Kitchenette 3',
    'Canteen',
    'Cafe',
    'Main security post'
  ]
};

export const LOCATION_CODES: Record<string, string> = {
  'Abuja': 'ABJ',
  'Kaduna': 'KAD'
};

export const CATEGORY_CODES: Record<string, string> = {
  'IT Equipment': 'ITE',
  'Office Equipment': 'OE',
  'Motor Vehicles': 'VH',
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
    'Television Sets',
    'Intercom'
  ],
  'Motor Vehicles': [
    'Car',
    'Sedan (Saloon)',
    'SUV / Jeep',
    'Pickup Truck',
    'Bus (Coaster/Hiace)',
    'Motorcycle',
    'Truck/Lorry',
    'Van/Ambulance'
  ],
  'Furniture and Fittings': [
    'Office Desk/Table',
    'Office Chair (Swivel)',
    'Visitor Chair',
    'File Cabinet/Shelf',
    'Sofa/Lounge Seating',
    'Conference Table',
    'Workstation/Partition',
    'Safe/Vault'
  ],
  'Plant and Machinery': [
    'Elevator/Lifts',
    'Power Generator',
    'Water Pump',
    'Drilling Rig',
    'Manufacturing Machine',
    'Forklift',
    'Transformer',
    'Inverter/Solar System (Industrial)'
  ],
  'Land & Buildings': [
    'Office Building',
    'Residential Building',
    'Warehouse/Store',
    'Land (Undeveloped)',
    'Clinic/Factory'
  ],
  'Software Licenses': [
    'Operating System',
    'Office Suite',
    'Antivirus/Security',
    'Design/Engineering',
    'Accounting/ERP',
    'Other License'
  ]
};

export const DEPARTMENT_CODES: Record<string, string> = {
  'Advisory': '2.104',
  'Audit and Assurance': '2.03',
  'Project and Tax': '2.01',
  'Shared Services': '2.02',
  'Training Room': '0.01',
  'Server room 1': 'SR1',
  'Server room 2': 'SR2',
  'Server room 3': 'SR3',
  'Server room 4': 'SR4',
  'Kitchenette 1': 'K1',
  'Kitchenette 2': 'K2',
  'Kitchenette 3': 'K3',
  'Canteen': 'CAN',
  'Cafe': 'CAF',
  'Main security post': 'MSP',
  'Tax': 'TAX'
};

export const MOCK_AUDIT_SESSIONS: AuditSession[] = [];

export const MOCK_AUDIT_VERIFICATIONS: AuditVerification[] = [];

