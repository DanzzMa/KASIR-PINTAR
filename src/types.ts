export type TransactionType = 'tarik_tunai' | 'setor_tunai' | 'topup' | 'ppob' | 'topup_game' | 'transfer' | 'transfer_bank' | 'expense';
export type AccountType = 'cash' | 'bank' | 'ewallet' | 'other';

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
}

export interface Transaction {
  id: string;
  userId: string;
  accountId: string;
  toAccountId?: string;
  cashAccountId?: string;
  type: TransactionType;
  bankType?: 'same' | 'other';
  amount: number;
  fee: number;
  feeExternal?: number;
  feeMethod?: 'added' | 'deducted';
  netAmount: number;
  note: string;
  timestamp: any; // Firestore Timestamp
}
