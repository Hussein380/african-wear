// Types for the Mandera African Wear stock management app

export interface DesignCode {
  _id: string;
  category: 'PrintedC' | 'PrintedP' | 'PrintTC';
  code: string;
  thumbnailUrl: string;
  thumbnailPublicId: string;
  createdAt: string;
  updatedAt: string;
  colorwayCount?: number; // aggregated field
  totalStock?: number; // aggregated total pieces in stock
}

export interface Photo {
  url: string;
  publicId: string;
}

export interface Colorway {
  _id: string;
  designCodeId: string;
  fullCode: string;
  photos: Photo[];
  quantityAvailable: number;
  breakdown?: { id: string; label: string; quantity: number }[];
  location?: string;
  buyingPrice?: number;
  sellingPrice?: number;
  createdAt: string;
  updatedAt: string;
}

export interface ActivityLog {
  _id?: string;
  type: 'IN' | 'OUT' | 'NEW';
  quantityChange: number;
  colorwayId: string;
  designCodeId: string;
  fullCode: string;
  previousQuantity: number;
  newQuantity: number;
  subVariantLabel?: string;
  kind?: 'sold' | 'own_use' | 'arrived' | 'returned' | 'count_diff' | 'deleted' | 'new';
  soldPrice?: number;
  costPrice?: number;
  invoiceId?: string;
  edited?: boolean;
  timestamp: string;
}

export interface InvoiceItem {
  colorwayId: string;
  designCodeId?: string;
  fullCode: string;
  subVariantLabel?: string;
  quantity: number;
  unitPrice: number;
  costPrice?: number;
  subtotal: number;
  skipDeduction?: boolean;
  recentSaleActivityId?: string;
}

export interface Invoice {
  _id?: string;
  invoiceNumber: string;
  customerName?: string;
  customerPhone?: string;
  paymentMethod: 'cash' | 'mpesa' | 'credit' | 'other';
  settledAt?: string;
  settledMethod?: 'cash' | 'mpesa';
  items: InvoiceItem[];
  totalAmount: number;
  totalCost?: number;
  estimatedProfit?: number;
  notes?: string;
  status: 'completed' | 'cancelled';
  createdAt: string;
  updatedAt?: string;
}

export interface AppSettings {
  _id: string;
  pinHash: string;
  shopName: string;
}

export type Category = 'PrintedC' | 'PrintedP' | 'PrintTC';

export type ExpenseCategory =
  | 'rent'
  | 'utilities'
  | 'wages'
  | 'transport'
  | 'packaging'
  | 'food'
  | 'maintenance'
  | 'other';

export interface Expense {
  _id?: string;
  title: string;
  amount: number;
  category: ExpenseCategory;
  paymentMethod: 'cash' | 'mpesa' | 'other';
  notes?: string;
  date: string;
  createdAt: string;
  updatedAt?: string;
}

