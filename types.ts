
export enum View {
  LOGIN = 'LOGIN',
  DASHBOARD = 'DASHBOARD',
  ASSET_REGISTRATION = 'ASSET_REGISTRATION',
  ASSET_LOOKUP = 'ASSET_LOOKUP',
  REPORTS = 'REPORTS',
  USER_MANAGEMENT = 'USER_MANAGEMENT',
  REPORT_ISSUE = 'REPORT_ISSUE',
}

export type UserRole = 'System Admin' | 'Asset Manager' | 'Custodian' | 'Auditor';

export interface Asset {
  id: string;
  productId: string;
  name: string;
  category: string;
  acquisitionCost: number;
  acquisitionDate: string;
  netBookValue: number;
  location: string;
  custodian: string;
  status: 'Active' | 'Disposed' | 'Maintenance' | 'Pending Transfer';
  image?: string;
}

export interface AssetHistoryEvent {
  id: string;
  assetId: string;
  date: string;
  action: string;
  user: string;
  details: string;
  type: 'Registration' | 'Transfer' | 'Maintenance' | 'Audit' | 'Issue';
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
}

export interface DepreciationPoint {
  period: string;
  value: number;
}