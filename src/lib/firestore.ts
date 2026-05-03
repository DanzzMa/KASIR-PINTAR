import { 
  collection, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  query, 
  where, 
  getDocs, 
  orderBy, 
  limit,
  Timestamp,
  type DocumentData,
  setDoc,
  serverTimestamp
} from 'firebase/firestore';
import { db } from './firebase';
import { Account, Transaction } from '../types';

export const accountService = {
  async getAccounts(userId: string) {
    const q = query(collection(db, 'accounts'), where('userId', '==', userId));
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Account));
  },

  async createAccount(userId: string, data: Partial<Account>) {
    return addDoc(collection(db, 'accounts'), {
      ...data,
      userId,
      createdAt: serverTimestamp(),
    });
  },

  async updateAccount(accountId: string, data: Partial<Account>) {
    const accountRef = doc(db, 'accounts', accountId);
    return updateDoc(accountRef, {
      ...data,
      updatedAt: serverTimestamp(),
    });
  }
};

export const transactionService = {
  async getTransactions(userId: string, accountId?: string) {
    let q = query(
      collection(db, 'transactions'), 
      where('userId', '==', userId),
      orderBy('timestamp', 'desc')
    );
    
    if (accountId) {
      q = query(q, where('accountId', '==', accountId));
    }

    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Transaction));
  },

  async createTransaction(userId: string, data: any) {
    // Add transaction to Firestore
    const docRef = await addDoc(collection(db, 'transactions'), {
      ...data,
      userId,
      timestamp: data.timestamp || new Date().toISOString()
    });

    // Update account balance
    const accountRef = doc(db, 'accounts', data.accountId);
    // Note: In real app we should use runTransaction for atomicity
    // But for this simple app, we can just fetch and update or use increments
    return docRef;
  },

  async deleteTransaction(transactionId: string) {
    return deleteDoc(doc(db, 'transactions', transactionId));
  }
};
