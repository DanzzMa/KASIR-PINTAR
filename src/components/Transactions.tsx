import { useState, useEffect } from 'react';
import { Transaction, Account } from '../types';
import { Search, ArrowUpRight, ArrowDownLeft, Gamepad2, ArrowRightCircle, Repeat, TrendingDown, Info, Trash2, AlertTriangle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import { clsx } from 'clsx';
import { formatCurrency, safeParseDate } from '../lib/format';

export default function Transactions({ user, accounts, onUpdate }: { user: any, accounts: Account[], onUpdate?: () => void }) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [filterAccount, setFilterAccount] = useState<string>('all');
  const [deletingTx, setDeletingTx] = useState<Transaction | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchTransactions = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const response = await fetch(`/api/transactions?userId=${user.id}`);
      const data = await response.json();
      // Sort by date (descending)
      const sorted = data.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setTransactions(sorted);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTransactions();
  }, [user?.id]);

  const handleDeleteTransaction = async () => {
    if (!deletingTx || isDeleting) return;
    
    setIsDeleting(true);
    try {
      // 1. Delete transaction
      const response = await fetch(`/api/transactions/${deletingTx.id}`, { method: 'DELETE' });
      if (!response.ok) throw new Error('Fail to delete');

      // 2. Update account balance (Local logic)
      const account = accounts.find(a => a.id === deletingTx.accountId);
      if (account) {
        const newBalance = (account.balance || 0) - deletingTx.netAmount;
        await fetch('/api/accounts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...account, balance: newBalance })
        });
      }

      setDeletingTx(null);
      fetchTransactions();
      if (onUpdate) onUpdate();
    } catch (err) {
      console.error(err);
    } finally {
      setIsDeleting(false);
    }
  };

  const filteredTransactions = transactions.filter(tx => {
    const matchesSearch = tx.note?.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          tx.customerName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          tx.referenceNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          tx.amount.toString().includes(searchTerm);
    const matchesType = filterType === 'all' || tx.type === filterType;
    const matchesAccount = filterAccount === 'all' || tx.accountId === filterAccount;
    return matchesSearch && matchesType && matchesAccount;
  });

  // Group transactions by date
  const groupedTransactions = filteredTransactions.reduce((groups, tx) => {
    const date = tx.timestamp ? format(safeParseDate(tx.timestamp), 'yyyy-MM-dd') : 'unknown';
    if (!groups[date]) {
      groups[date] = [];
    }
    groups[date].push(tx);
    return groups;
  }, {} as Record<string, Transaction[]>);

  const sortedDates = Object.keys(groupedTransactions).sort((a, b) => b.localeCompare(a));

  return (
    <div className="space-y-6 pb-20 md:pb-0">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight">Riwayat</h2>
          <p className="text-slate-500 text-xs font-medium">Monitoring arus kas harian Anda.</p>
        </div>
        <div className="relative flex-1 md:max-w-md">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input
            type="text"
            placeholder="Cari transaksi..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-11 pr-4 py-3 bg-white border border-slate-200 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none transition-all font-medium text-sm shadow-sm"
          />
        </div>
      </div>

      {/* Compact Filters */}
      <div className="space-y-3">
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          {['all', 'tarik_tunai', 'setor_tunai', 'topup', 'ppob', 'topup_game', 'transfer_bank', 'transfer', 'expense', 'adjustment'].map((t) => (
            <button
              key={t}
              onClick={() => setFilterType(t)}
              className={clsx(
                "px-4 py-2 rounded-xl font-bold text-[10px] whitespace-nowrap transition-all border",
                filterType === t 
                  ? "bg-blue-600 text-white border-blue-600 shadow-sm" 
                  : "bg-white text-slate-500 border-slate-200 hover:border-slate-300"
              )}
            >
              {t === 'all' ? 'SEMUA JENIS' : 
               t === 'transfer_bank' ? 'KIRIM UANG' :
               t.replace('_', ' ').toUpperCase()}
            </button>
          ))}
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
           <button
              onClick={() => setFilterAccount('all')}
              className={clsx(
                "px-4 py-2 rounded-xl font-bold text-[10px] whitespace-nowrap transition-all border",
                filterAccount === 'all' 
                  ? "bg-slate-800 text-white border-slate-800 shadow-sm" 
                  : "bg-white text-slate-500 border-slate-200 hover:border-slate-300"
              )}
           >
             SEMUA REKENING
           </button>
           {accounts.map(acc => (
             <button
              key={acc.id}
              onClick={() => setFilterAccount(acc.id)}
              className={clsx(
                "px-4 py-2 rounded-xl font-bold text-[10px] whitespace-nowrap transition-all border",
                filterAccount === acc.id 
                  ? "bg-slate-800 text-white border-slate-800 shadow-sm" 
                  : "bg-white text-slate-500 border-slate-200 hover:border-slate-300"
              )}
             >
               {acc.name.toUpperCase()}
             </button>
           ))}
        </div>
      </div>

      {/* Transaction List */}
      <div className="space-y-6">
        {loading ? (
          Array(3).fill(0).map((_, i) => (
            <div key={i} className="space-y-3">
              <div className="h-4 w-24 bg-slate-100 rounded-lg animate-pulse" />
              <div className="h-16 bg-slate-50 rounded-2xl animate-pulse" />
            </div>
          ))
        ) : sortedDates.length === 0 ? (
          <div className="bg-white rounded-[2rem] p-12 text-center border border-dashed border-slate-200">
             <Search size={32} className="mx-auto text-slate-300 mb-4" />
             <p className="text-slate-500 font-medium text-sm">Tidak ada transaksi ditemukan.</p>
          </div>
        ) : (
          sortedDates.map((date) => (
            <div key={date} className="space-y-2">
              <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-widest pl-4">
                {date === format(new Date(), 'yyyy-MM-dd') ? 'HARI INI' : 
                 date === format(new Date(Date.now() - 86400000), 'yyyy-MM-dd') ? 'KEMARIN' :
                 format(safeParseDate(date), 'EEEE, d MMM yyyy', { locale: idLocale })}
              </h3>
              
              <div className="bg-white rounded-[1.5rem] border border-slate-100 shadow-sm overflow-hidden divide-y divide-slate-50">
                {groupedTransactions[date].map((tx) => (
                  <motion.div
                    layout
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    key={tx.id}
                    className="p-4 hover:bg-slate-50 transition-all group flex items-center gap-4"
                  >
                    <div className={clsx(
                      "w-10 h-10 rounded-xl flex items-center justify-center shrink-0",
                      tx.type === 'tarik_tunai' ? "bg-green-50 text-green-600" :
                      tx.type === 'setor_tunai' ? "bg-blue-50 text-blue-600" :
                      tx.type === 'topup' ? "bg-purple-50 text-purple-600" : 
                      tx.type === 'transfer_bank' ? "bg-indigo-50 text-indigo-600" :
                      tx.type === 'transfer' ? "bg-slate-50 text-slate-600" :
                      tx.type === 'expense' ? "bg-red-50 text-red-600" :
                      tx.type === 'adjustment' ? "bg-slate-100 text-slate-700" :
                      tx.type === 'topup_game' ? "bg-pink-50 text-pink-600" : "bg-orange-50 text-orange-600"
                    )}>
                      {tx.type === 'tarik_tunai' ? <ArrowUpRight size={20} /> : 
                       tx.type === 'topup_game' ? <Gamepad2 size={20} /> : 
                       tx.type === 'expense' ? <TrendingDown size={20} /> :
                       tx.type === 'adjustment' ? <Info size={20} /> :
                       tx.type === 'transfer_bank' ? <ArrowRightCircle size={20} /> :
                       tx.type === 'transfer' ? <Repeat size={20} /> :
                       <ArrowDownLeft size={20} />}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900 text-sm truncate">
                          {tx.customerName || (tx.type === 'transfer_bank' ? 'Kirim Uang' : tx.type.replace('_', ' ').toUpperCase())}
                        </span>
                        {tx.paymentStatus && tx.paymentStatus !== 'success' && (
                          <span className={clsx(
                            "px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-tighter",
                            tx.paymentStatus === 'pending' ? "bg-orange-100 text-orange-700" : "bg-red-100 text-red-700"
                          )}>
                            {tx.paymentStatus}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-[10px] font-medium text-slate-400">
                        <span className="uppercase">{tx.type.replace('_', ' ')}</span>
                        <span>•</span>
                        <span>{tx.timestamp ? format(safeParseDate(tx.timestamp), 'HH:mm') : ''}</span>
                        <span>•</span>
                        <span className="text-slate-500 font-bold">{accounts.find(a => a.id === tx.accountId)?.name}</span>
                      </div>
                      {tx.note && <p className="text-[10px] text-slate-400 italic mt-0.5 truncate leading-tight">"{tx.note}"</p>}
                    </div>

                    <div className="text-right shrink-0">
                       <p className={clsx(
                          "font-black text-sm",
                          tx.netAmount > 0 ? "text-green-600" : (tx.netAmount < 0 ? "text-red-600" : "text-slate-900")
                        )}>
                          {tx.netAmount > 0 ? '+' : (tx.netAmount < 0 ? '-' : '')}{formatCurrency(tx.amount)}
                       </p>
                       <div className="flex items-center justify-end gap-1.5 mt-0.5">
                          <span className="text-[9px] font-bold text-slate-300 uppercase">Laba:</span>
                          <span className={clsx(
                            "text-[10px] font-black",
                            (tx.profit ?? 0) > 0 ? "text-blue-500" : "text-slate-400"
                          )}>
                            {formatCurrency(tx.profit ?? 0)}
                          </span>
                       </div>
                    </div>

                    <button
                       onClick={(e) => {
                         e.stopPropagation();
                         setDeletingTx(tx);
                       }}
                       className="p-2 text-slate-200 hover:text-red-500 transition-all opacity-0 group-hover:opacity-100"
                       title="Hapus"
                    >
                      <Trash2 size={14} />
                    </button>
                  </motion.div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {deletingTx && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden"
            >
              <div className="p-8 text-center">
                <div className="w-16 h-16 bg-red-50 text-red-600 rounded-full flex items-center justify-center mx-auto mb-6">
                  <AlertTriangle size={32} />
                </div>
                <h3 className="text-xl font-bold text-slate-800 mb-2">Hapus Transaksi?</h3>
                <p className="text-slate-500 text-sm mb-8">
                  Konfirmasi penghapusan transaksi senilai <span className="font-bold text-slate-800">{formatCurrency(deletingTx.amount)}</span>. 
                  Saldo rekening <span className="font-bold text-slate-800">{accounts.find(a => a.id === deletingTx.accountId)?.name}</span> akan disesuaikan kembali secara otomatis.
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={() => setDeletingTx(null)}
                    disabled={isDeleting}
                    className="flex-1 px-4 py-3 rounded-xl border border-slate-200 text-slate-600 font-bold hover:bg-slate-50 transition-all disabled:opacity-50"
                  >
                    Batal
                  </button>
                  <button
                    onClick={handleDeleteTransaction}
                    disabled={isDeleting}
                    className="flex-1 bg-red-600 hover:bg-red-700 text-white px-4 py-3 rounded-xl transition-all font-bold disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {isDeleting ? 'Menghapus...' : 'Ya, Hapus'}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
