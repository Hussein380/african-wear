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
  /** Selling price per bale, typed when the receipt is made (receipts only, never stored on stock). */
  unitPrice?: number;
  subtotal?: number;
  /** The sold history row this line was made from. */
  activityId?: string;
}

export interface Invoice {
  _id?: string;
  invoiceNumber: string;
  customerName?: string;
  customerPhone?: string;
  items: InvoiceItem[];
  totalAmount?: number;
  /** 'sales' = made later from already-sold stock (no stock change); otherwise made by the sale basket. */
  source?: 'sales' | 'basket';
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
