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
  timestamp: string;
}

export interface AppSettings {
  _id: string;
  pinHash: string;
  shopName: string;
}

export type Category = 'PrintedC' | 'PrintedP' | 'PrintTC';
