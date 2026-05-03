export type TransactionType = 'tarik_tunai' | 'setor_tunai' | 'topup' | 'ppob' | 'topup_game' | 'transfer' | 'transfer_bank' | 'expense' | 'adjustment';
export type AccountType = 'cash' | 'bank' | 'ewallet' | 'other';

export interface User {
  id: string;
  email: string;
  name?: string | null;
}

export interface UserProfile {
  email: string;
  displayName: string;
  createdAt: string;
}

export interface Account {
  id: string;
  userId: string;
  name: string;
  type: AccountType;
  balance: number;
  initialBalance: number;
  icon?: string;
}

export interface Transaction {
  id: string;
  userId: string;
  accountId: string;
  type: TransactionType;
  amount: number;
  fee: number;
  feeExternal?: number;
  feeMethod?: 'added' | 'deducted';
  netAmount: number;
  note?: string;
  customerName?: string;
  referenceNumber?: string;
  paymentStatus?: 'pending' | 'success' | 'failed';
  bankType?: 'same' | 'other';
  linkedTransactionId?: string;
  profit?: number;
  timestamp: string; // ISO string
}
