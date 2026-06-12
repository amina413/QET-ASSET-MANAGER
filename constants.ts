
import { ChartDataPoint, DepreciationPoint, ConditionCode } from './types';

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


