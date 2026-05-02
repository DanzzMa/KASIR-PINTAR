import { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { collection, query, where, orderBy, onSnapshot, limit } from 'firebase/firestore';
import { User } from 'firebase/auth';
import { Transaction, Account } from '../types';
import { Search, Filter, ArrowUpRight, ArrowDownLeft, Calendar, Wallet, Gamepad2, ArrowRightCircle, Repeat, TrendingDown } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import { clsx } from 'clsx';

export default function Transactions({ user, accounts }: { user: User, accounts: Account[] }) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [filterAccount, setFilterAccount] = useState<string>('all');

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

  const filteredTransactions = transactions.filter(tx => {
    const matchesSearch = tx.note?.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          tx.amount.toString().includes(searchTerm);
    const matchesType = filterType === 'all' || tx.type === filterType;
    const matchesAccount = filterAccount === 'all' || tx.accountId === filterAccount;
    return matchesSearch && matchesType && matchesAccount;
  });

  const formatCurrency = (val: number) => {
     return new Intl.NumberFormat('id-ID', {
       style: 'currency',
       currency: 'IDR',
       minimumFractionDigits: 0,
     }).format(val);
  };

  return (
    <div className="space-y-6 pb-20 md:pb-0">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold text-slate-800">Riwayat Transaksi</h2>
          <p className="text-slate-500 font-medium">Lacak semua mutasi di berbagai rekening Anda.</p>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="space-y-4">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
          <input
            type="text"
            placeholder="Cari nominal atau catatan..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-12 pr-4 py-4 bg-white border border-slate-200 rounded-3xl focus:ring-2 focus:ring-blue-500 outline-none transition-all font-medium shadow-sm"
          />
        </div>
        
        <div className="flex flex-col gap-4">
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
            {['all', 'tarik_tunai', 'setor_tunai', 'topup', 'ppob', 'topup_game', 'transfer_bank', 'transfer', 'expense'].map((t) => (
              <button
                key={t}
                onClick={() => setFilterType(t)}
                className={clsx(
                  "px-5 py-2.5 rounded-2xl font-bold text-xs whitespace-nowrap transition-all border-2",
                  filterType === t 
                    ? "bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-100" 
                    : "bg-white text-slate-500 border-slate-100 hover:border-slate-200"
                )}
              >
                {t === 'all' ? 'Semua Jenis' : 
                 t === 'transfer_bank' ? 'Kirim Uang' :
                 t === 'transfer' ? 'Pindah Saldo' :
                 t.replace('_', ' ').charAt(0).toUpperCase() + t.replace('_', ' ').slice(1)}
              </button>
            ))}
          </div>

          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
             <button
                onClick={() => setFilterAccount('all')}
                className={clsx(
                  "px-5 py-2.5 rounded-2xl font-bold text-xs whitespace-nowrap transition-all border-2",
                  filterAccount === 'all' 
                    ? "bg-slate-800 text-white border-slate-800 shadow-md shadow-slate-100" 
                    : "bg-white text-slate-500 border-slate-100 hover:border-slate-200"
                )}
             >
               Semua Rekening
             </button>
             {accounts.map(acc => (
               <button
                key={acc.id}
                onClick={() => setFilterAccount(acc.id)}
                className={clsx(
                  "px-5 py-2.5 rounded-2xl font-bold text-xs whitespace-nowrap transition-all border-2",
                  filterAccount === acc.id 
                    ? "bg-slate-800 text-white border-slate-800 shadow-md shadow-slate-100" 
                    : "bg-white text-slate-500 border-slate-100 hover:border-slate-200"
                )}
               >
                 {acc.name}
               </button>
             ))}
          </div>
        </div>
      </div>

      {/* Transaction List */}
      <div className="space-y-4">
        {loading ? (
          Array(5).fill(0).map((_, i) => (
            <div key={i} className="h-24 bg-slate-100 rounded-3xl animate-pulse" />
          ))
        ) : filteredTransactions.length === 0 ? (
          <div className="bg-white rounded-[2.5rem] p-16 text-center border border-slate-100 shadow-sm">
             <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto text-slate-300 mb-6">
                <Search size={40} />
             </div>
             <h3 className="text-xl font-bold text-slate-800 mb-2">Tidak ditemukan</h3>
             <p className="text-slate-500">Silakan sesuaikan filter atau cari kata kunci lain.</p>
          </div>
        ) : (
          filteredTransactions.map((tx) => (
            <motion.div
              layout
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              key={tx.id}
              className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:shadow-md transition-all group"
            >
              <div className="flex items-center gap-5">
                <div className={clsx(
                  "w-14 h-14 rounded-2xl flex items-center justify-center shadow-sm",
                  tx.type === 'tarik_tunai' ? "bg-green-50 text-green-600" :
                  tx.type === 'setor_tunai' ? "bg-blue-50 text-blue-600" :
                  tx.type === 'topup' ? "bg-purple-50 text-purple-600" : 
                  tx.type === 'transfer_bank' ? "bg-indigo-50 text-indigo-600" :
                  tx.type === 'transfer' ? "bg-slate-50 text-slate-600" :
                  tx.type === 'expense' ? "bg-red-50 text-red-600" :
                  tx.type === 'topup_game' ? "bg-pink-50 text-pink-600" : "bg-orange-50 text-orange-600"
                )}>
                  {tx.type === 'tarik_tunai' ? <ArrowUpRight size={28} /> : 
                   tx.type === 'topup_game' ? <Gamepad2 size={28} /> : 
                   tx.type === 'expense' ? <TrendingDown size={28} /> :
                   tx.type === 'transfer_bank' ? <ArrowRightCircle size={28} /> :
                   tx.type === 'transfer' ? <Repeat size={28} /> :
                   <ArrowDownLeft size={28} />}
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <h5 className="font-bold text-slate-800 text-lg capitalize">
                      {tx.type === 'transfer_bank' ? 'Kirim Uang' : tx.type.replace('_', ' ')}
                    </h5>
                    {tx.bankType && (
                      <span className={clsx(
                        "px-2 py-0.5 rounded text-[10px] font-bold uppercase",
                        tx.bankType === 'same' ? "bg-green-100 text-green-700" : "bg-orange-100 text-orange-700"
                      )}>
                        {tx.bankType === 'same' ? 'Sama Bank' : 'Beda Bank'}
                      </span>
                    )}
                    <span className="px-2 py-0.5 bg-slate-100 text-slate-500 rounded text-[9px] font-bold uppercase tracking-widest">
                      {accounts.find(a => a.id === tx.accountId)?.name || 'Account Deleted'}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-slate-400 font-medium text-[11px]">
                    <span className="flex items-center gap-1">
                      <Calendar size={12} />
                      {tx.timestamp ? format(tx.timestamp.toDate(), 'd MMM yyyy, HH:mm', { locale: idLocale }) : '...'}
                    </span>
                    {tx.note && <span className="bg-slate-50 px-2 py-0.5 rounded-lg italic">"{tx.note}"</span>}
                  </div>
                </div>
              </div>

              <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center border-t sm:border-t-0 pt-4 sm:pt-0 mt-4 sm:mt-0 border-slate-50">
                 <p className={clsx(
                    "font-extrabold text-xl",
                    tx.netAmount > 0 ? "text-green-600" : "text-slate-800"
                  )}>
                    {tx.netAmount > 0 ? '+' : ''}{formatCurrency(tx.amount)}
                 </p>
                 <div className="flex gap-2">
                    <p className="text-[10px] uppercase font-bold text-slate-400">Laba Bersih:</p>
                    <p className="text-[11px] font-bold text-blue-600">{formatCurrency((tx.fee || 0) - (tx.feeExternal || 0))}</p>
                 </div>
              </div>
            </motion.div>
          ))
        )}
      </div>
    </div>
  );
}
