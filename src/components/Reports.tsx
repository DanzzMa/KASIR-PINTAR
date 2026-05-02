import { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { collection, query, where, orderBy, onSnapshot } from 'firebase/firestore';
import { User } from 'firebase/auth';
import { Transaction, Account } from '../types';
import { FileBarChart, PieChart, TrendingUp, Download, Calendar, Gamepad2, TrendingDown, ArrowRightCircle, Repeat } from 'lucide-react';
import { motion } from 'motion/react';
import { format, startOfDay, startOfMonth, endOfDay } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import { clsx } from 'clsx';

export default function Reports({ user, accounts }: { user: User, accounts: Account[] }) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<'today' | 'month' | 'all'>('today');

  useEffect(() => {
    const q = query(
      collection(db, 'transactions'),
      where('userId', '==', user.uid),
      orderBy('timestamp', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const txs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Transaction));
      setTransactions(txs);
      setLoading(false);
    });

    return unsubscribe;
  }, [user.uid]);

  const filteredTxs = transactions.filter(tx => {
    if (!tx.timestamp) return false;
    const date = tx.timestamp.toDate();
    if (period === 'today') {
      return date >= startOfDay(new Date()) && date <= endOfDay(new Date());
    }
    if (period === 'month') {
      return date >= startOfMonth(new Date());
    }
    return true;
  });

  const stats = filteredTxs.reduce((acc, tx) => {
    const profit = (tx.fee || 0) - (tx.feeExternal || 0);
    acc.totalVolume += tx.amount;
    
    // Expense reduces total profit (Net Profit)
    if (tx.type === 'expense') {
      acc.totalFees -= tx.amount;
      acc.feeByType[tx.type] = (acc.feeByType[tx.type] || 0) - tx.amount;
    } else {
      acc.totalFees += profit;
      acc.feeByType[tx.type] = (acc.feeByType[tx.type] || 0) + profit;
    }
    
    acc.count += 1;
    acc.byType[tx.type] = (acc.byType[tx.type] || 0) + tx.amount;
    acc.byAccount[tx.accountId] = (acc.byAccount[tx.accountId] || 0) + tx.amount;
    return acc;
  }, { totalVolume: 0, totalFees: 0, count: 0, byType: {} as any, feeByType: {} as any, byAccount: {} as any });

  const formatCurrency = (val: number) => {
     return new Intl.NumberFormat('id-ID', {
       style: 'currency',
       currency: 'IDR',
       minimumFractionDigits: 0,
     }).format(val);
  };

  const transactionTypes = ['tarik_tunai', 'setor_tunai', 'topup', 'ppob', 'topup_game', 'transfer_bank', 'transfer', 'expense', 'adjustment'];

  return (
    <div className="space-y-8 pb-10">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold text-slate-800">Laporan Bisnis</h2>
          <p className="text-slate-500 font-medium">Analisis arus kas dari berbagai rekening Anda.</p>
        </div>
        <div className="flex p-1 bg-slate-100 rounded-3xl">
          {(['today', 'month', 'all'] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={clsx(
                "px-8 py-2.5 rounded-2xl text-sm font-bold transition-all",
                period === p ? "bg-white text-blue-600 shadow-md" : "text-slate-500 hover:text-slate-700"
              )}
            >
              {p === 'today' ? 'Hari Ini' : p === 'month' ? 'Bulan Ini' : 'Semua'}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
           <div className="h-64 bg-slate-100 rounded-[2.5rem] animate-pulse" />
           <div className="h-64 bg-slate-100 rounded-[2.5rem] animate-pulse" />
        </div>
      ) : (
        <>
          {/* Main Summary */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <SummaryCard 
              label="Jumlah Transaksi" 
              value={stats.count.toString()} 
              icon={TrendingUp} 
              color="text-blue-600" 
              bg="bg-blue-50"
            />
            <SummaryCard 
              label="Volume Perputaran" 
              value={formatCurrency(stats.totalVolume)} 
              icon={FileBarChart} 
              color="text-purple-600" 
              bg="bg-purple-50"
            />
            <SummaryCard 
              label="Keuntungan (Fee)" 
              value={formatCurrency(stats.totalFees)} 
              icon={PieChart} 
              color="text-green-600" 
              bg="bg-green-50"
            />
          </div>

          {/* Detailed Breakdown */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* By Account */}
            <div className="bg-white rounded-[2.5rem] p-8 border border-slate-100 shadow-sm">
               <h3 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2">
                 <Calendar className="text-blue-500" />
                 Volume per Rekening
               </h3>
               <div className="space-y-6">
                 {accounts.map(acc => {
                   const volume = stats.byAccount[acc.id] || 0;
                   const percentage = stats.totalVolume > 0 ? (volume / stats.totalVolume) * 100 : 0;
                   return (
                     <div key={acc.id} className="space-y-2">
                        <div className="flex justify-between text-sm font-bold">
                           <span className="text-slate-600 font-bold">{acc.name}</span>
                           <span className="text-slate-800 font-black">{formatCurrency(volume)}</span>
                        </div>
                        <div className="h-3 w-full bg-slate-50 rounded-full overflow-hidden">
                           <motion.div 
                            initial={{ width: 0 }}
                            animate={{ width: `${percentage}%` }}
                            className="h-full bg-blue-500 rounded-full shadow-inner"
                           />
                        </div>
                     </div>
                   );
                 })}
               </div>
            </div>

            {/* By Layanan Fees */}
            <div className="bg-white rounded-[2.5rem] p-8 border border-slate-100 shadow-sm">
               <h3 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2">
                 <PieChart className="text-green-500" />
                 Laba per Layanan
               </h3>
               <div className="space-y-4">
                 {transactionTypes.map(type => (
                   <div key={type} className="flex items-center justify-between p-5 bg-slate-50 rounded-2xl border border-slate-100 hover:bg-white hover:shadow-sm transition-all group">
                      <div className="flex items-center gap-3">
                         <div className={clsx(
                            "w-12 h-12 rounded-2xl flex items-center justify-center transition-colors shadow-sm",
                            type === 'tarik_tunai' ? "bg-green-50 text-green-600" :
                            type === 'setor_tunai' ? "bg-blue-50 text-blue-600" :
                            type === 'topup' ? "bg-purple-50 text-purple-600" : 
                            type === 'topup_game' ? "bg-pink-50 text-pink-600" :
                             type === 'transfer_bank' ? "bg-indigo-50 text-indigo-600" :
                             type === 'transfer' ? "bg-slate-50 text-slate-600" :
                             type === 'expense' ? "bg-red-50 text-red-600" :
                             "bg-orange-50 text-orange-600"
                         )}>
                            {type === 'topup_game' ? <Gamepad2 size={24} /> : 
                              type === 'expense' ? <TrendingDown size={24} /> :
                              type === 'transfer_bank' ? <ArrowRightCircle size={24} /> :
                              type === 'transfer' ? <Repeat size={24} /> :
                              <FileBarChart size={24} />}
                         </div>
                         <div>
                            <span className="font-bold text-slate-700 capitalize block leading-tight">{type.replace('_', ' ')}</span>
                            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{Math.round((stats.feeByType[type] || 0) / (stats.totalFees || 1) * 100)}% Kontribusi</span>
                         </div>
                      </div>
                      <span className="font-black text-slate-900 text-lg">{formatCurrency(stats.feeByType[type] || 0)}</span>
                   </div>
                 ))}
               </div>
            </div>
          </div>

          {/* Call to Action */}
          <div className="bg-slate-900 rounded-[2.5rem] p-8 md:p-12 text-white flex flex-col md:flex-row items-center justify-between gap-8 shadow-2xl shadow-slate-200">
             <div className="space-y-3 text-center md:text-left pt-2">
                <h4 className="text-3xl font-extrabold">Ingin Analisis Lebih Dalam?</h4>
                <p className="text-slate-400 font-medium text-lg leading-relaxed max-w-md">
                  Gunakan fitur filter per rekening di tab transaksi untuk melihat aliran dana secara spesifik di setiap bank atau e-wallet.
                </p>
             </div>
             <div className="flex flex-col sm:flex-row gap-4 w-full md:w-auto">
                <button className="bg-blue-600 text-white px-8 py-5 rounded-2xl font-bold shadow-xl shadow-blue-900 flex items-center justify-center gap-2 hover:scale-105 transition-all">
                  <Download size={20} />
                  <span>Ekspor CSV</span>
                </button>
             </div>
          </div>
        </>
      )}
    </div>
  );
}

function SummaryCard({ label, value, icon: Icon, color, bg }: { label: string, value: string, icon: any, color: string, bg: string }) {
  return (
    <motion.div 
      whileHover={{ y: -5 }}
      className="bg-white rounded-[2.5rem] p-8 border border-slate-100 shadow-sm space-y-6 relative overflow-hidden group"
    >
      <div className={clsx("w-14 h-14 rounded-2xl flex items-center justify-center transition-transform group-hover:scale-110", bg, color)}>
         <Icon size={28} />
      </div>
      <div>
         <p className="text-xs font-black text-slate-400 uppercase tracking-[2px] mb-2">{label}</p>
         <p className={clsx("text-2xl font-black truncate leading-none", color === 'text-slate-800' ? "text-slate-800" : color)}>{value}</p>
      </div>
      <div className="absolute top-0 right-0 p-4 opacity-5">
         <Icon size={80} />
      </div>
    </motion.div>
  );
}
