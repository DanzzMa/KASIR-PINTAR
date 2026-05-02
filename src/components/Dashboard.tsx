import { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { collection, query, where, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { User } from 'firebase/auth';
import { UserProfile, Transaction, Account } from '../types';
import { Wallet, ArrowUpRight, ArrowDownLeft, Clock, Plus, ChevronRight, TrendingUp, Landmark, Smartphone, CreditCard, Gamepad2, ArrowRightCircle, Repeat, TrendingDown } from 'lucide-react';
import { motion } from 'motion/react';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import { clsx } from 'clsx';

interface DashboardProps {
  profile: UserProfile;
  user: User;
  accounts: Account[];
  onNavigate: (tab: any) => void;
}

export default function Dashboard({ profile, user, accounts, onNavigate }: DashboardProps) {
  const [recentTransactions, setRecentTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(
      collection(db, 'transactions'),
      where('userId', '==', user.uid),
      orderBy('timestamp', 'desc'),
      limit(5)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const txs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Transaction));
      setRecentTransactions(txs);
      setLoading(false);
    });

    return unsubscribe;
  }, [user.uid]);

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(val);
  };

  const totalBalance = accounts.reduce((acc, curr) => acc + curr.balance, 0);

  const getProfitToday = () => {
     return recentTransactions.reduce((acc, tx) => acc + ((tx.fee || 0) - (tx.feeExternal || 0)), 0);
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
    <div className="space-y-8">
      {/* Welcome Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold text-slate-800">Halo, {profile.displayName}!</h2>
          <p className="text-slate-500 font-medium">{format(new Date(), 'EEEE, d MMMM yyyy', { locale: id })}</p>
        </div>
        <button 
          onClick={() => onNavigate('add')}
          className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-2xl flex items-center gap-2 font-bold shadow-lg shadow-blue-100 transition-all active:scale-95"
        >
          <Plus size={20} />
          <span>Transaksi Baru</span>
        </button>
      </div>

      {/* Main Stats Card */}
      <motion.div 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-blue-600 rounded-[2.5rem] p-8 md:p-12 text-white shadow-2xl shadow-blue-200 relative overflow-hidden"
      >
        <div className="relative z-10 grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
          <div>
            <div className="flex items-center gap-2 text-blue-100 mb-2 font-medium">
              <Wallet size={18} />
              <span>Total Saldo Digital Semua Rekening</span>
            </div>
            <h3 className="text-4xl md:text-5xl font-extrabold mb-4">{formatCurrency(totalBalance)}</h3>
            <div className="inline-flex items-center gap-2 bg-blue-500/30 px-4 py-2 rounded-full text-blue-100 text-sm font-bold">
               <TrendingUp size={16} />
               <span>Tumbuh 4.2% dari kemarin</span>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
             <div className="bg-white/10 backdrop-blur-md rounded-3xl p-6 border border-white/10">
                <p className="text-blue-100 text-xs font-bold uppercase tracking-wider mb-1">Fee Hari Ini</p>
                <p className="text-xl font-black">{formatCurrency(getProfitToday())}</p>
             </div>
             <div className="bg-white/10 backdrop-blur-md rounded-3xl p-6 border border-white/10">
                <p className="text-blue-100 text-xs font-bold uppercase tracking-wider mb-1">Transaksi</p>
                <p className="text-xl font-black">{recentTransactions.length}</p>
             </div>
          </div>
        </div>
        <div className="absolute -right-20 -top-20 w-80 h-80 bg-white/10 rounded-full blur-3xl" />
        <div className="absolute -left-20 -bottom-20 w-60 h-60 bg-blue-400/20 rounded-full blur-3xl" />
      </motion.div>

      {/* Accounts List */}
      <div className="space-y-4">
        <div className="flex items-center justify-between px-2">
          <h3 className="text-xl font-bold text-slate-800">Rincian Rekening</h3>
          <button onClick={() => onNavigate('settings')} className="text-blue-600 font-bold text-sm hover:underline">Kelola Rekening</button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
           {accounts.map((acc) => (
             <motion.div 
              key={acc.id}
              whileHover={{ y: -4 }}
              className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm flex flex-col gap-4"
             >
               <div className="flex items-center justify-between">
                  <div className="w-10 h-10 bg-slate-50 text-slate-500 rounded-xl flex items-center justify-center">
                    {getAccountIcon(acc.type)}
                  </div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{acc.type}</span>
               </div>
               <div>
                  <h4 className="font-bold text-slate-800 truncate">{acc.name}</h4>
                  <p className="text-lg font-black text-slate-900 mt-1">{formatCurrency(acc.balance)}</p>
               </div>
             </motion.div>
           ))}
        </div>
      </div>

      {/* Recent Transactions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between px-2">
            <h3 className="text-xl font-bold text-slate-800">Transaksi Terakhir</h3>
            <button onClick={() => onNavigate('transactions')} className="text-blue-600 font-bold text-sm hover:underline">Lihat Semua</button>
          </div>

          <div className="space-y-3">
            {loading ? (
              Array(3).fill(0).map((_, i) => (
                <div key={i} className="h-20 bg-slate-100 rounded-2xl animate-pulse" />
              ))
            ) : recentTransactions.length === 0 ? (
              <div className="bg-white rounded-3xl p-10 border border-slate-100 text-center">
                 <p className="text-slate-400 font-medium">Belum ada transaksi.</p>
              </div>
            ) : (
              recentTransactions.map((tx) => (
                <motion.div 
                  key={tx.id}
                  className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm flex items-center justify-between gap-4 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-center gap-4">
                    <div className={clsx(
                      "w-12 h-12 rounded-2xl flex items-center justify-center",
                      tx.type === 'tarik_tunai' ? "bg-green-50 text-green-600" :
                      tx.type === 'setor_tunai' ? "bg-blue-50 text-blue-600" :
                      tx.type === 'topup' ? "bg-purple-50 text-purple-600" : 
                      tx.type === 'transfer_bank' ? "bg-indigo-50 text-indigo-600" :
                      tx.type === 'transfer' ? "bg-slate-50 text-slate-600" :
                      tx.type === 'expense' ? "bg-red-50 text-red-600" :
                      tx.type === 'topup_game' ? "bg-pink-50 text-pink-600" : "bg-orange-50 text-orange-600"
                    )}>
                      {tx.type === 'tarik_tunai' ? <ArrowUpRight size={24} /> : 
                       tx.type === 'topup_game' ? <Gamepad2 size={24} /> : 
                       tx.type === 'expense' ? <TrendingDown size={24} /> :
                       tx.type === 'transfer_bank' ? <ArrowRightCircle size={24} /> :
                       tx.type === 'transfer' ? <Repeat size={24} /> :
                       <ArrowDownLeft size={24} />}
                    </div>
                    <div>
                      <h5 className="font-bold text-slate-800 capitalize leading-none mb-1">
                        {tx.type === 'transfer_bank' ? 'Kirim Uang' : tx.type.replace('_', ' ')}
                      </h5>
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter">
                        {accounts.find(a => a.id === tx.accountId)?.name || 'Unknown Account'}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={clsx(
                      "font-bold",
                      tx.netAmount > 0 ? "text-green-600" : "text-slate-800"
                    )}>
                      {tx.netAmount > 0 ? '+' : ''}{formatCurrency(tx.amount)}
                    </p>
                    <p className="border-t border-slate-100 pt-2 mt-2 text-[10px] text-slate-400 font-medium">Laba: {formatCurrency((tx.fee || 0) - (tx.feeExternal || 0))}</p>
                  </div>
                </motion.div>
              ))
            )}
          </div>
        </div>

        {/* Quick Tips */}
        <div className="space-y-4">
          <h3 className="text-xl font-bold text-slate-800 px-2">Tips Profit</h3>
          <div className="bg-slate-800 rounded-[2.5rem] p-8 text-white shadow-2xl relative overflow-hidden group">
            <h4 className="font-bold mb-4 flex items-center gap-2">
              <Clock size={18} className="text-yellow-400" />
              Lacak Modal & Sisa
            </h4>
            <p className="text-slate-400 text-sm leading-relaxed mb-6">
              Sekarang Anda bisa memantau sisa saldo di BRI, DANA, dan Laci Cash secara terpisah. Pastikan saldo akhir di sistem sama dengan saldo asli di rekening/dompet Anda.
            </p>
            <button className="w-full bg-slate-700 hover:bg-slate-600 transition-colors py-3 rounded-2xl font-bold text-sm">Pelajari Rincian</button>
          </div>
        </div>
      </div>
    </div>
  );
}
