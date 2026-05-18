
export enum View {
  LOGIN = 'LOGIN',
  DASHBOARD = 'DASHBOARD',
  ASSET_REGISTRATION = 'ASSET_REGISTRATION',
  ASSET_LOOKUP = 'ASSET_LOOKUP',
  REPORTS = 'REPORTS',
  USER_MANAGEMENT = 'USER_MANAGEMENT',
  ASSET_MANAGEMENT = 'ASSET_MANAGEMENT',
  WIP_MANAGEMENT = 'WIP_MANAGEMENT',
  AUDIT = 'AUDIT',
  PROFILE = 'PROFILE',
  SETTINGS = 'SETTINGS',
}

export type UserRole = 'System Admin' | 'Asset Manager' | 'Custodian' | 'Auditor';

export type ConditionCode = 'A1' | 'A2' | 'A3' | 'A4' | 'F1' | 'F2' | 'F3' | 'F4';
export type DepreciationMethod = 'STRAIGHT_LINE' | 'REDUCING_BALANCE' | 'SUM_OF_YEARS';

export interface Asset {
  id: string;
  productId: string;
  name: string;
  category: string;
  acquisitionCost: number;
  acquisitionDate: string;
  netBookValue: number;
  location: string;
  subLocation?: string;
  custodian: string;
  assignedUser?: string;
  status: 'Active' | 'Disposed' | 'Maintenance' | 'Pending Transfer';
  conditionCode?: ConditionCode;
  image?: string;
  previousId?: string;
  registrationDate?: string;
  subCategory?: string; // For IT and Office Equipment "Asset Type"
  usefulLife?: number;
  salvageValue?: number;
  method?: DepreciationMethod;
  // Disposal fields
  disposalMode?: 'Sold' | 'Donated' | 'Scrapped' | 'Written Off';
  disposalDate?: string;
  // Improvements logic
  lastImprovementDate?: string;
  improvements?: AssetImprovement[];
  history?: AssetHistoryEvent[];
}

export interface AssetImprovement {
  id: string;
  date: string;
  type: 'Addition' | 'Reduction' | 'Revaluation';
  amount: number;
  description: string;
  newAcquisitionCost: number; // Snapshot of cost after this change
}

export interface CostLineItem {
  id: string;
  date: string;
  type: 'Materials' | 'External Labor' | 'Internal Labor' | 'Professional Fees' | 'Interest Capitalization' | 'Software Dev';
  vendor: string;
  amount: number;
  referenceDoc: string; // Invoice #
  description: string;
}

export interface WipAsset {
  id: string; // AUC-2025-001
  projectName: string;
  assetType: string; // Final category
  projectManager: string;
  budgetedCost: number;
  location?: string;
  inceptionDate: string;
  estimatedCompletionDate: string;
  status: 'Planning' | 'Design' | 'In Progress' | 'Testing' | 'Capitalization Ready' | 'Capitalized';
  costLedger: CostLineItem[];
  finalDepreciationMethod: string;
  finalUsefulLife: number;
  relatedAssetId?: string;
  relatedAssetProductId?: string; // Asset tag shown after transfer, e.g. QET/ABJ/GEN/1234
}

export interface AssetHistoryEvent {
  id: string;
  assetId: string;
  date: string;
  action: string;
  user: string;
  details: string;
  type: 'Registration' | 'Transfer' | 'Maintenance' | 'Audit' | 'Issue';
  fromLocation?: string;
  toLocation?: string;
  toCustodian?: string;
}

export interface AssetTransferRequest {
  assetId: string;
  fromLocation: string;
  toLocation: string;
  toCustodian: string;
  requestedBy: string;
  date: string;
  status: 'Pending' | 'Approved' | 'Rejected';
}

export interface User {
  id: string;
  name: string;
  email: string;
  department: string;
  role: UserRole;
  lastLogin: string;
  avatar?: string;
}

export interface ChartDataPoint {
  name: string;
  value: number;
  [key: string]: any;
}

export interface DepreciationPoint {
  period: string;
  value: number;
}

export interface AuditSession {
  id: string;
  auditor: string;
  auditorId: string;
  startDate: string;
  endDate?: string;
  status: 'In Progress' | 'Completed' | 'Cancelled';
  location?: string;
  totalAssets: number;
  verifiedAssets: number;
  notFoundAssets: number;
  notes?: string;
}

export interface AuditVerification {
  id: string;
  auditSessionId: string;
  assetId: string;
  assetProductId: string;
  assetName: string;
  status: 'Verified' | 'Not Found' | 'Damaged' | 'Pending';
  verifiedBy: string;
  verificationDate: string;
  notes?: string;
  locationMatch: boolean;
  conditionMatch: boolean;
}
