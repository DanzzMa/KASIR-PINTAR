import { useState, useEffect } from 'react';
import { Transaction, Account } from '../types';
import { Wallet, ArrowUpRight, ArrowDownLeft, Plus, TrendingUp, Landmark, Smartphone, CreditCard, TrendingDown, History } from 'lucide-react';
import { motion } from 'motion/react';
import { format, startOfDay } from 'date-fns';
import { id } from 'date-fns/locale';
import { clsx } from 'clsx';
import { formatCurrency, safeParseDate } from '../lib/format';
import { db } from '../lib/firebase';
import { collection, query, where, orderBy, limit, onSnapshot } from 'firebase/firestore';

interface DashboardProps {
  user: any;
  accounts: Account[];
  onNavigate: (tab: any) => void;
}

export default function Dashboard({ user, accounts, onNavigate }: DashboardProps) {
  const [recentTransactions, setRecentTransactions] = useState<Transaction[]>([]);
  const [transactionsToday, setTransactionsToday] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const today = startOfDay(new Date());

    const qRecent = query(
      collection(db, 'transactions'),
      where('userId', '==', user.uid),
      orderBy('timestamp', 'desc'),
      limit(5)
    );

    const qToday = query(
      collection(db, 'transactions'),
      where('userId', '==', user.uid),
      where('timestamp', '>=', today.toISOString())
    );

    const unsubRecent = onSnapshot(qRecent, (snapshot) => {
      const txs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Transaction));
      setRecentTransactions(txs);
      setLoading(false);
    });

    const unsubToday = onSnapshot(qToday, (snapshot) => {
      const txs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Transaction));
      setTransactionsToday(txs);
    });

    return () => {
      unsubRecent();
      unsubToday();
    };
  }, [user?.uid]);

  const totalBalance = accounts.reduce((acc, curr) => acc + curr.balance, 0);

  const getProfitToday = () => {
     return transactionsToday.reduce((acc, tx) => {
       const profit = tx.profit !== undefined ? tx.profit : ((tx.fee || 0) - (tx.feeExternal || 0));
       return acc + profit;
     }, 0);
  };

  const getAccountIcon = (type: string) => {
    switch (type) {
      case 'cash': return <Wallet size={18} />;
      case 'bank': return <Landmark size={18} />;
      case 'ewallet': return <Smartphone size={18} />;
      default: return <CreditCard size={18} />;
    }
  };

  return (
    <div className="space-y-6 pb-20 md:pb-0">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight">Halo, {user?.displayName || 'Pengguna'}!</h2>
          <p className="text-slate-500 text-xs font-medium">{format(new Date(), 'EEEE, d MMMM yyyy', { locale: id })}</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="bg-white px-4 py-2 rounded-2xl border border-slate-100 shadow-sm">
             <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Saldo Gabungan</p>
             <p className="text-lg font-black text-blue-600 leading-none">{formatCurrency(totalBalance)}</p>
          </div>
          <button 
            onClick={() => onNavigate('add')}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-3 rounded-2xl flex items-center gap-2 font-bold shadow-lg shadow-blue-100 transition-all active:scale-95"
          >
            <Plus size={18} />
            <span className="text-xs">TRANSAKSI</span>
          </button>
        </div>
      </div>

      {/* Bento Grid Layout */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
        {/* Main Stats Bento */}
        <div className="md:col-span-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="bg-white p-5 rounded-[2rem] border border-slate-100 shadow-sm">
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center mb-3">
              <TrendingUp size={20} />
            </div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Fee Hari Ini</p>
            <p className="text-xl font-black text-slate-900">{formatCurrency(getProfitToday())}</p>
          </div>

          <div className="bg-white p-5 rounded-[2rem] border border-slate-100 shadow-sm">
            <div className="w-10 h-10 rounded-xl bg-orange-50 text-orange-600 flex items-center justify-center mb-3">
              <History size={20} />
            </div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Aktivitas</p>
            <p className="text-xl font-black text-slate-900 font-mono">{recentTransactions.length} <span className="text-[10px] font-bold text-slate-400">TRX</span></p>
          </div>

          <div className="bg-slate-900 p-5 rounded-[2rem] text-white shadow-xl shadow-blue-900/10 sm:col-span-2 lg:col-span-1">
             <div className="flex items-center justify-between mb-3">
                <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center">
                  <Smartphone size={16} />
                </div>
                <span className="text-[8px] font-black uppercase text-slate-500">Live Status</span>
             </div>
             <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-1">Kesehatan Arus</p>
             <p className="text-xl font-black">OPTIMAL</p>
          </div>
        </div>

        {/* Account Quick Glance */}
        <div className="md:col-span-4 bg-white rounded-[2rem] border border-slate-100 shadow-sm p-5 space-y-3">
           <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Ringkasan Akun</h3>
           <div className="space-y-2 overflow-y-auto max-h-[160px] scrollbar-hide">
              {accounts.map(acc => (
                <div key={acc.id} className="flex items-center justify-between p-2 rounded-xl bg-slate-50 border border-slate-100">
                   <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded bg-white flex items-center justify-center text-slate-400">
                        {getAccountIcon(acc.type)}
                      </div>
                      <span className="text-[10px] font-bold text-slate-600 truncate max-w-[80px]">{acc.name}</span>
                   </div>
                   <span className="text-[11px] font-black text-slate-900 font-mono">{formatCurrency(acc.balance)}</span>
                </div>
              ))}
           </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Recent Activity List */}
        <div className="lg:col-span-12">
          <div className="flex items-center justify-between mb-4 px-2">
            <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Aktivitas Terakhir</h3>
            <button onClick={() => onNavigate('transactions')} className="text-[11px] font-black text-blue-600 hover:underline uppercase">Lihat Full</button>
          </div>
          
          <div className="bg-white rounded-[1.5rem] border border-slate-100 shadow-sm overflow-hidden divide-y divide-slate-50">
            {recentTransactions.map((tx) => (
              <div key={tx.id} className="p-4 hover:bg-slate-50 transition-all flex items-center gap-4">
                <div className={clsx(
                  "w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-sm",
                  tx.type === 'tarik_tunai' ? "bg-green-50 text-green-600" :
                  tx.type === 'setor_tunai' ? "bg-blue-50 text-blue-600" :
                  tx.type === 'expense' ? "bg-red-50 text-red-600" : "bg-slate-50 text-slate-600"
                )}>
                  {tx.type === 'tarik_tunai' ? <ArrowUpRight size={20} /> : 
                   tx.type === 'expense' ? <TrendingDown size={20} /> : <ArrowDownLeft size={20} />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p className="font-bold text-slate-900 text-sm truncate">{tx.customerName || (tx.type === 'transfer_bank' ? 'Kirim Uang' : tx.type.replace('_', ' ').toUpperCase())}</p>
                    <p className={clsx(
                      "font-black text-sm",
                      (tx.profit || 0) > 0 ? "text-blue-600" : ((tx.profit || 0) < 0 ? "text-red-600" : "text-slate-900")
                    )}>
                      {(tx.profit || 0) > 0 ? '+' : ''}{formatCurrency(tx.profit || 0)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 text-[10px] font-medium text-slate-400">
                    <span className="uppercase">{tx.type.replace('_', ' ')}</span>
                    <span>•</span>
                    <span>{tx.timestamp ? format(safeParseDate(tx.timestamp), 'HH:mm') : ''}</span>
                    <span>•</span>
                    <span className="text-slate-500 font-bold">{accounts.find(a => a.id === tx.accountId)?.name}</span>
                  </div>
                </div>
              </div>
            ))}
            {recentTransactions.length === 0 && (
              <div className="p-12 text-center">
                <p className="text-slate-400 font-medium text-sm">Belum ada aktivitas.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
