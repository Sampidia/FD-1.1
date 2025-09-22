// User types
export interface User {
  id: string;
  email: string;
  name?: string;
  image?: string;
  pointsBalance: number;
  dailyPointsLastGiven: string;
  createdAt: Date;
  updatedAt: Date;
}

// Product check types
export interface ProductCheck {
  id: string;
  userId: string;
  productName: string;
  productDescription: string;
  images: string[];
  result?: CheckResult;
  pointsUsed: number;
  createdAt: Date;
}

export interface CheckResult {
  id: string;
  isCounterfeit: boolean;
  summary: string;
  sourceUrl: string;
  source: string;
  batchNumber?: string;
  issueDate?: string;
  alertType: string;
  images?: string[];
  confidence?: number;
}

// Payment types
export interface Payment {
  id: string;
  userId: string;
  amount: number;
  pointsPurchased: number;
  status: "pending" | "completed" | "failed";
  paymentGateway: "paystack" | "flutterwave";
  transactionId: string;
  createdAt: Date;
}

export interface PaymentInitiation {
  paymentId: string;
  amount: number;
  paymentUrl: string;
  gateway: string;
}

// NAFDAC alert types
export interface NafdacAlert {
  title: string;
  url: string;
  excerpt: string;
  date: string;
  image?: string;
  batchNumber?: string;
  alertType: string;
}

// UI types
export interface UploadState {
  files: File[];
  previewImages: string[];
  isUploading: boolean;
  progress: number;
}

export interface SearchForm {
  productName: string;
  productDescription: string;
}

export interface DashboardStats {
  totalScans: number;
  pointsBalance: number;
  counterfeitDetected: number;
  genuineProducts: number;
}

// API response types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface BalanceResponse {
  userId: string;
  pointsBalance: number;
  canGetDailyPoints: boolean;
  lastGiven: string;
}

// Form validation types
export interface ValidationResult {
  isValid: boolean;
  errors: Record<string, string>;
}

export interface FileValidationResult {
  valid: boolean;
  error?: string;
  file?: File;
}