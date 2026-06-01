import React, { useState, useEffect } from 'react';
import { Transaction, Account } from '../types';
import { Wallet, ArrowUpRight, ArrowDownLeft, Plus, TrendingUp, Landmark, Smartphone, CreditCard, TrendingDown, History, Clock, Calendar, Eye, EyeOff, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format, startOfDay, isAfter } from 'date-fns';
import { id } from 'date-fns/locale';
import { clsx } from 'clsx';
import { formatCurrency, safeParseDate } from '../lib/format';

interface DashboardProps {
  user: any;
  accounts: Account[];
  onNavigate: (tab: any) => void;
}

export default function Dashboard({ user, accounts, onNavigate }: DashboardProps) {
  const [recentTransactions, setRecentTransactions] = useState<Transaction[]>([]);
  const [transactionsToday, setTransactionsToday] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [totalDebts, setTotalDebts] = useState(0);
  const [showBalances, setShowBalances] = useState(true);
  const [totalVolume, setTotalVolume] = useState(0);

  // Daily Bookkeeping States
  const [bookkeepingRecords, setBookkeepingRecords] = useState<any[]>([]);
  const [showBookkeepingModal, setShowBookkeepingModal] = useState(false);
  const [bookkeepingDate, setBookkeepingDate] = useState('');
  const [bookkeepingSession, setBookkeepingSession] = useState<'pagi' | 'sore'>('pagi');
  const [bookkeepingTotalBalance, setBookkeepingTotalBalance] = useState('');
  const [bookkeepingNote, setBookkeepingNote] = useState('');
  const [bookkeepingSaving, setBookkeepingSaving] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const totalBalance = accounts.reduce((acc, curr) => acc + curr.balance, 0);

  const fetchBookkeeping = async () => {
    if (!user) return;
    try {
      const response = await fetch(`/api/bookkeeping?userId=${user.id}`);
      const data = await response.json();
      setBookkeepingRecords(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Gagal memuat catatan pembukuan:", err);
    }
  };

  const fetchData = async () => {
    if (!user) return;
    try {
      const response = await fetch(`/api/transactions?userId=${user.id}`);
      const data = await response.json();
      
      const sorted = data.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setRecentTransactions(sorted.slice(0, 5));

      const today = startOfDay(new Date());
      const todayTxs = data.filter((t: any) => isAfter(new Date(t.createdAt), today));
      setTransactionsToday(todayTxs);

      const volume = todayTxs.reduce((acc: number, t: any) => acc + (t.amount || 0), 0);
      setTotalVolume(volume);

      // Fetch Debts
      const debtResponse = await fetch(`/api/debts?userId=${user.id}`);
      const debtData = await debtResponse.json();
      const unpaid = debtData.reduce((acc: number, d: any) => acc + (d.remainingAmount || 0), 0);
      setTotalDebts(unpaid);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    fetchBookkeeping();
  }, [user?.id]);

  const handleOpenBookkeeping = (sessionType: 'pagi' | 'sore') => {
    const today = format(new Date(), 'yyyy-MM-dd');
    setBookkeepingDate(today);
    setBookkeepingSession(sessionType);
    setBookkeepingTotalBalance(String(totalBalance));
    setBookkeepingNote('');
    setShowBookkeepingModal(true);
  };

  const handleSaveBookkeeping = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setBookkeepingSaving(true);
    try {
      // Remove any non-numeric formatting if edited
      const cleanVal = bookkeepingTotalBalance.replace(/[^0-9.-]+/g, "");
      const parsedBalance = parseFloat(cleanVal);
      const finalBalance = isNaN(parsedBalance) ? totalBalance : parsedBalance;
      
      const payload = {
        userId: user.id,
        date: bookkeepingDate,
        session: bookkeepingSession,
        totalBalance: finalBalance,
        note: bookkeepingNote
      };

      const response = await fetch('/api/bookkeeping', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        await fetchBookkeeping();
        setShowBookkeepingModal(false);
      } else {
        const err = await response.json();
        alert("Gagal menyimpan pembukuan: " + (err.error || "Unknown error"));
      }
    } catch (err) {
      console.error("Error saving bookkeeping:", err);
      alert("Terjadi kesalahan saat menyimpan pembukuan.");
    } finally {
      setBookkeepingSaving(false);
    }
  };

  const handleDeleteBookkeeping = async (id: string) => {
    if (!confirm("Apakah Anda yakin ingin menghapus catatan pembukuan ini?")) return;
    try {
      const response = await fetch(`/api/bookkeeping/${id}`, {
        method: 'DELETE'
      });
      if (response.ok) {
        await fetchBookkeeping();
      } else {
        alert("Gagal menghapus catatan.");
      }
    } catch (err) {
      console.error(err);
    }
  };

  const displayCurrency = (value: number) => {
    return (
      <span className={clsx(
        "transition-all duration-300",
        !showBalances && "blur-[6px] select-none scale-95"
      )}>
        {formatCurrency(value)}
      </span>
    );
  };

  const getProfitToday = () => {
     return transactionsToday.reduce((acc, tx) => {
       const profit = tx.profit != null ? tx.profit : ((tx.fee || 0) - (tx.feeExternal || 0));
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

  const todayDateStr = format(currentTime, 'yyyy-MM-dd');
  const pagiLogged = bookkeepingRecords.some(r => r.date === todayDateStr && r.session === 'pagi');
  const soreLogged = bookkeepingRecords.some(r => r.date === todayDateStr && r.session === 'sore');
  const isAfternoon = currentTime.getHours() >= 12;

  const pendingNotificationPagi = !pagiLogged;
  const pendingNotificationSore = !soreLogged && isAfternoon;

  return (
    <div className="space-y-4 pb-20 md:pb-0">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="hidden sm:flex flex-col items-center justify-center bg-white w-14 h-14 rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
             <div className="bg-blue-600 w-full text-[8px] text-center py-0.5 text-white font-black uppercase tracking-tighter">
                {format(currentTime, 'MMM', { locale: id })}
             </div>
             <div className="flex-1 flex items-center justify-center text-xl font-black text-slate-800 leading-none">
                {format(currentTime, 'd')}
             </div>
          </div>
          <div>
            <h2 className="text-xl font-black text-slate-900 tracking-tight">Halo, {user?.displayName || 'Pengguna'}!</h2>
            <div className="flex items-center gap-2 mt-0.5">
               <Clock size={12} className="text-blue-500" />
               <p className="text-slate-500 text-[11px] font-bold tracking-tight">
                  {format(currentTime, 'EEEE, d MMMM yyyy • HH:mm:ss', { locale: id })}
               </p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setShowBalances(!showBalances)}
            className="p-2 rounded-xl bg-white border border-slate-100 shadow-sm text-slate-400 hover:text-blue-600 transition-colors"
            title={showBalances ? "Sembunyikan Saldo" : "Tampilkan Saldo"}
          >
            {showBalances ? <Eye size={18} /> : <EyeOff size={18} />}
          </button>
          <button 
            onClick={() => onNavigate('add')}
            className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-xl flex items-center gap-2 font-bold shadow-lg shadow-blue-100 transition-all active:scale-95"
          >
            <Plus size={16} />
            <span className="text-[11px]">TRANSAKSI</span>
          </button>
        </div>
      </div>

      {/* Notification Panel for Daily Bookkeeping */}
      {(pendingNotificationPagi || pendingNotificationSore) && (
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-amber-50 border border-amber-200 rounded-[2rem] p-5 text-amber-900 shadow-sm relative overflow-hidden"
        >
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center shrink-0 text-amber-700">
                <Clock size={20} />
              </div>
              <div>
                <h4 className="font-black text-xs uppercase tracking-wider text-amber-800">PERINGATAN PEMBUKUAN HARIAN</h4>
                <p className="text-xs text-amber-700 font-medium mt-0.5">
                  {pendingNotificationPagi && pendingNotificationSore && (
                    "Pembukuan pagi dan sore hari ini belum dicatat!"
                  )}
                  {pendingNotificationPagi && !pendingNotificationSore && (
                    "Pembukuan pagi hari ini belum dicatat! Segera catat saldo awal kasir Anda."
                  )}
                  {!pendingNotificationPagi && pendingNotificationSore && (
                    "Pembukuan sore hari ini belum dicatat! Segera kunci saldo akhir kasir Anda."
                  )}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              {pendingNotificationPagi && (
                <button
                  onClick={() => handleOpenBookkeeping('pagi')}
                  className="flex-1 sm:flex-initial bg-amber-600 hover:bg-amber-700 text-white font-black text-[10px] uppercase tracking-widest px-4 py-2.5 rounded-xl transition-all shadow-sm shadow-amber-300"
                >
                  Catat Pagi
                </button>
              )}
              {pendingNotificationSore && (
                <button
                  onClick={() => handleOpenBookkeeping('sore')}
                  className="flex-1 sm:flex-initial bg-blue-600 hover:bg-blue-700 text-white font-black text-[10px] uppercase tracking-widest px-4 py-2.5 rounded-xl transition-all shadow-sm shadow-blue-300"
                >
                  Catat Sore
                </button>
              )}
            </div>
          </div>
        </motion.div>
      )}

      {/* Total Saldo Card - High Visualization */}
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-slate-900 rounded-[2rem] p-6 text-white shadow-2xl shadow-blue-100 relative overflow-hidden"
      >
        <div className="absolute top-0 right-0 p-8 opacity-10">
          <Wallet size={160} />
        </div>
        <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-blue-500/20 to-transparent opacity-50"></div>
        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 rounded-xl bg-blue-500/10 flex items-center justify-center">
              <Wallet size={16} className="text-blue-400" />
            </div>
            <span className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">Total Saldo Gabungan</span>
          </div>
          
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div>
              <p className="text-4xl font-black tracking-tight mb-1">{displayCurrency(totalBalance)}</p>
              <div className="flex items-center gap-2">
                <span className="inline-block w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Akun Terhubung & Aktif</p>
              </div>
            </div>
            
            <div className="flex items-center gap-4 bg-white/5 p-3 rounded-2xl backdrop-blur-sm border border-white/10">
               <div className="text-right">
                  <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1">Untung Hari Ini</p>
                  <p className="text-sm font-black text-green-400">+{displayCurrency(getProfitToday())}</p>
               </div>
               <div className="w-[1px] h-8 bg-white/10"></div>
               <div className="text-right">
                  <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1">Total Akun</p>
                  <p className="text-sm font-black">{accounts.length}</p>
               </div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Bento Grid Layout */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
        {/* Main Stats Bento */}
        <div className="md:col-span-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <div className="bg-white p-4 rounded-[1.5rem] border border-slate-100 shadow-sm hover:shadow-md transition-all group overflow-hidden relative">
            <div className="absolute top-0 right-0 w-24 h-24 bg-rose-500/5 rounded-full -mr-12 -mt-12 group-hover:scale-110 transition-transform"></div>
            <div className="w-8 h-8 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center mb-2 relative z-10">
              <TrendingUp size={18} />
            </div>
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1 relative z-10">Untung Hari Ini</p>
            <p className="text-lg font-black text-rose-600 relative z-10">{displayCurrency(getProfitToday())}</p>
          </div>

          <div className="bg-white p-4 rounded-[1.5rem] border border-slate-100 shadow-sm hover:shadow-md transition-all group overflow-hidden relative">
            <div className="absolute top-0 right-0 w-24 h-24 bg-sky-500/5 rounded-full -mr-12 -mt-12 group-hover:scale-110 transition-transform"></div>
            <div className="w-8 h-8 rounded-lg bg-sky-50 text-sky-600 flex items-center justify-center mb-2 relative z-10">
              <History size={18} />
            </div>
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1 relative z-10">Aktivitas</p>
            <p className="text-lg font-black text-slate-900 font-mono relative z-10">{recentTransactions.length} <span className="text-[9px] font-bold text-slate-400">TRX</span></p>
          </div>

          <div className="bg-slate-900 p-4 rounded-[1.5rem] text-white shadow-xl shadow-indigo-900/10 sm:col-span-2 lg:col-span-1 flex flex-col justify-between overflow-hidden relative group">
             <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/10 rounded-full -mr-12 -mt-12 group-hover:scale-110 transition-transform"></div>
             <div className="flex items-center justify-between mb-2 relative z-10">
                <div className="w-6 h-6 rounded-md bg-white/10 flex items-center justify-center">
                  <TrendingUp size={14} className="text-indigo-400" />
                </div>
                <span className="text-[7px] font-black uppercase text-slate-500">Volume Toko</span>
             </div>
             <div className="relative z-10">
                <p className="text-[9px] font-black text-indigo-400 uppercase tracking-widest mb-1">Perputaran Hari Ini</p>
                <p className="text-lg font-black tracking-tight leading-none">
                   {displayCurrency(totalVolume)}
                </p>
                <p className="text-[8px] font-bold text-slate-500 mt-1 uppercase">Total dari {transactionsToday.length} Transaksi</p>
             </div>
          </div>
        </div>

        {/* Account Quick Glance */}
        <div className="md:col-span-4 bg-white/50 backdrop-blur-sm rounded-[1.5rem] border border-slate-100 shadow-sm p-4 space-y-2">
           <h3 className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1">Ringkasan Akun</h3>
           <div className="space-y-1.5 overflow-y-auto max-h-[140px] scrollbar-hide px-0.5 pt-0.5">
              {accounts.map(acc => (
                <div key={acc.id} className="flex items-center justify-between p-2 rounded-xl bg-white border border-slate-100 hover:border-indigo-200 transition-all shadow-sm">
                   <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-500">
                        {getAccountIcon(acc.type)}
                      </div>
                      <span className="text-[9px] font-bold text-slate-600 truncate max-w-[80px]">{acc.name}</span>
                   </div>
                   <span className="text-[10px] font-black text-slate-900 font-mono">{displayCurrency(acc.balance)}</span>
                </div>
              ))}
           </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Recent Activity List */}
        <div className="lg:col-span-7 xl:col-span-8">
          <div className="flex items-center justify-between mb-4 px-2">
            <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Aktivitas Terakhir</h3>
            <button onClick={() => onNavigate('transactions')} className="text-[11px] font-black text-indigo-600 hover:underline uppercase">Lihat Full</button>
          </div>
          
          <div className="bg-white/70 backdrop-blur-sm rounded-[1.5rem] border border-slate-100 shadow-sm overflow-hidden divide-y divide-slate-50">
            {recentTransactions.map((tx) => (
              <div key={tx.id} className="p-4 hover:bg-white/80 transition-all flex items-center gap-4 group">
                <div className={clsx(
                  "w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-sm transition-transform group-hover:scale-110",
                  tx.type === 'tarik_tunai' ? "bg-emerald-50 text-emerald-600" :
                  tx.type === 'setor_tunai' ? "bg-sky-50 text-sky-600" :
                  tx.type === 'expense' ? "bg-rose-50 text-rose-600" : "bg-slate-50 text-slate-600"
                )}>
                  {tx.type === 'tarik_tunai' ? <ArrowUpRight size={20} /> : 
                   tx.type === 'expense' ? <TrendingDown size={20} /> : <ArrowDownLeft size={20} />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p className="font-bold text-slate-900 text-sm truncate">{tx.customerName || (tx.type === 'transfer_bank' ? 'Kirim Uang' : tx.type.replace('_', ' ').toUpperCase())}</p>
                    <div className="text-right">
                       <p className={clsx(
                         "font-black text-sm",
                         ((tx.profit ?? ((tx.fee || 0) - (tx.feeExternal || 0)))) > 0 ? "text-indigo-600" : "text-slate-400"
                       )}>
                         + {displayCurrency(tx.profit ?? ((tx.fee || 0) - (tx.feeExternal || 0)))}
                       </p>
                       <p className="text-[9px] font-bold text-slate-400 leading-none">Net Laba</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between mt-1">
                    <div className="flex items-center gap-2 text-[10px] font-medium text-slate-400">
                      <span className="uppercase">{tx.type.replace('_', ' ')}</span>
                      <span>•</span>
                      <span>{tx.timestamp ? format(safeParseDate(tx.timestamp), 'HH:mm') : ''}</span>
                    </div>
                    <div className="flex items-center gap-1.5 bg-slate-100 px-1.5 py-0.5 rounded-md">
                      <span className="text-[9px] font-bold text-slate-400 uppercase">Nominal:</span>
                      <span className="text-[10px] font-black text-slate-600">
                        {displayCurrency(tx.amount)}
                      </span>
                    </div>
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

        {/* Daily Bookkeeping Logs */}
        <div className="lg:col-span-5 xl:col-span-4">
          <div className="flex items-center justify-between mb-4 px-2">
            <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Buku Harian</h3>
            <button 
              onClick={() => handleOpenBookkeeping(currentTime.getHours() < 12 ? 'pagi' : 'sore')}
              className="text-[11px] font-black text-blue-600 hover:underline uppercase flex items-center gap-1"
            >
              <Plus size={12} /> CATAT BARU
            </button>
          </div>

          <div className="bg-white/70 backdrop-blur-sm rounded-[1.5rem] border border-slate-100 shadow-sm p-4 space-y-3 max-h-[400px] overflow-y-auto scrollbar-hide">
            {bookkeepingRecords.map((rec) => (
              <div key={rec.id} className="p-3 bg-white hover:bg-slate-50 border border-slate-100 rounded-2xl transition-all relative group flex flex-col gap-2 shadow-sm">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={clsx(
                      "px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-wider",
                      rec.session === 'pagi' ? "bg-amber-50 text-amber-700 border border-amber-200" : "bg-sky-50 text-sky-700 border border-sky-200"
                    )}>
                      {rec.session}
                    </span>
                    <span className="text-xs font-bold text-slate-500">
                      {format(new Date(rec.date), 'dd MMM yyyy')}
                    </span>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black text-slate-900 font-mono">
                      {displayCurrency(rec.totalBalance)}
                    </span>
                    <button 
                      onClick={() => handleDeleteBookkeeping(rec.id)}
                      className="text-slate-350 hover:text-red-500 transition-colors"
                      title="Hapus"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
                {rec.note && <p className="text-[10px] text-slate-500 pl-1 italic border-l-2 border-slate-200">{rec.note}</p>}
                <p className="text-[8px] text-slate-400 text-right">Dicatat {format(new Date(rec.timestamp), 'HH:mm • dd/MM')}</p>
              </div>
            ))}

            {bookkeepingRecords.length === 0 && (
              <div className="p-12 text-center flex flex-col items-center justify-center gap-2">
                <div className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center text-slate-350">
                  <Calendar size={20} />
                </div>
                <p className="text-slate-400 font-medium text-xs">Belum ada catatan pembukuan.</p>
                <button 
                  onClick={() => handleOpenBookkeeping(currentTime.getHours() < 12 ? 'pagi' : 'sore')}
                  className="mt-1 bg-blue-50 text-blue-600 px-3 py-1.5 rounded-xl font-bold text-[10px] hover:bg-blue-100 transition-colors uppercase tracking-wider"
                >
                  Catat Sekarang
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Bookkeeping Dialog Modal */}
      <AnimatePresence>
        {showBookkeepingModal && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-[2rem] shadow-2xl p-6 w-full max-w-md border border-slate-100 relative overflow-hidden"
            >
              <h3 className="text-lg font-black text-slate-900 mb-1">Pencatatan Buku Harian</h3>
              <p className="text-slate-500 text-[11px] font-bold uppercase tracking-wider mb-6">Konsolidasi Total Saldo Seluruh Akun</p>

              <form onSubmit={handleSaveBookkeeping} className="space-y-4">
                {/* Date Input */}
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 block mb-1">Tanggal</label>
                  <input 
                    type="date"
                    required
                    value={bookkeepingDate}
                    onChange={(e) => setBookkeepingDate(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-bold text-sm text-slate-800"
                  />
                </div>

                {/* Session Toggle */}
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 block mb-1">Sesi Pembukuan (Pagi / Sore)</label>
                  <div className="flex bg-slate-50 p-1 rounded-xl border border-slate-100">
                    <button
                      type="button"
                      onClick={() => setBookkeepingSession('pagi')}
                      className={clsx(
                        "flex-1 py-2 text-xs font-black rounded-lg transition-all uppercase",
                        bookkeepingSession === 'pagi' ? "bg-white text-amber-600 shadow-sm border border-slate-100" : "text-slate-500"
                      )}
                    >
                      Pagi (Awal)
                    </button>
                    <button
                      type="button"
                      onClick={() => setBookkeepingSession('sore')}
                      className={clsx(
                        "flex-1 py-2 text-xs font-black rounded-lg transition-all uppercase",
                        bookkeepingSession === 'sore' ? "bg-white text-blue-600 shadow-sm border border-slate-100" : "text-slate-500"
                      )}
                    >
                      Sore (Akhir)
                    </button>
                  </div>
                </div>

                {/* Total Balance Field */}
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 block mb-1">Total Saldo Seluruh Akun (Buku)</label>
                  <div className="relative group">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[11px] font-black text-slate-400 uppercase">Rp</span>
                    <input 
                      type="text"
                      required
                      value={bookkeepingTotalBalance}
                      onChange={(e) => setBookkeepingTotalBalance(e.target.value)}
                      className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-black text-base text-slate-800"
                    />
                  </div>
                  <p className="text-[10.5px] text-slate-400 mt-1 block leading-tight">
                    Nilai otomatis dihitung dari total saldo gabungan seluruh akun saat ini: 
                    <span className="font-bold text-slate-600 ml-1">Rp {formatCurrency(totalBalance)}</span>
                  </p>
                </div>

                {/* Optional Note */}
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 block mb-1">Catatan Tambahan (Opsional)</label>
                  <textarea 
                    rows={2}
                    value={bookkeepingNote}
                    onChange={(e) => setBookkeepingNote(e.target.value)}
                    placeholder="Contoh: Saldo sesuai laci kasir..."
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm placeholder:text-slate-350"
                  />
                </div>

                {/* Action Buttons */}
                <div className="flex items-center gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowBookkeepingModal(false)}
                    className="flex-1 border border-slate-100 hover:bg-slate-50 text-slate-600 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={bookkeepingSaving}
                    className="flex-1 bg-blue-600 hover:bg-blue-500 text-white py-3 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all disabled:opacity-50 shadow-md shadow-blue-100"
                  >
                    {bookkeepingSaving ? "Menyimpan..." : "Simpan Buku"}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
