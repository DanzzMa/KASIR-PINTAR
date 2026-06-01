import React, { useState, useEffect, useMemo } from 'react';
import { Transaction, Account } from '../types';
import { FileBarChart, PieChart, TrendingUp, Download, TrendingDown, ChevronDown, ChevronUp, RefreshCw, AlertTriangle, Calendar, CheckCircle2, Archive, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format, startOfDay, startOfMonth, endOfDay } from 'date-fns';
import { id } from 'date-fns/locale';
import { clsx } from 'clsx';
import { formatCurrency, safeParseDate } from '../lib/format';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

const COLORS = {
  tarik_tunai: '#10b981',
  setor_tunai: '#3b82f6',
  topup: '#f59e0b',
  ppob: '#8b5cf6',
  topup_game: '#ec4899',
  transfer_bank: '#06b6d4',
  transfer: '#64748b',
  expense: '#ef4444',
  adjustment: '#94a3b8'
};

const formatMonthName = (monthStr: string) => {
  if (!monthStr || monthStr.length < 7) return monthStr;
  const parts = monthStr.split('-');
  const year = parts[0];
  const monthNum = parseInt(parts[1], 10);
  const indonesianMonths = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
  ];
  if (monthNum >= 1 && monthNum <= 12) {
    return `${indonesianMonths[monthNum - 1]} ${year}`;
  }
  return monthStr;
};

export default function Reports({ user, accounts }: { user: any, accounts: Account[] }) {
  const [activeTab, setActiveTab] = useState<'realtime' | 'archives'>('realtime');
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<'today' | 'month' | 'all'>('today');

  // Archive States
  const [archives, setArchives] = useState<any[]>([]);
  const [loadingArchives, setLoadingArchives] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetMonth, setResetMonth] = useState('');
  const [resetting, setResetting] = useState(false);
  const [resetError, setResetError] = useState('');
  const [expandedArchiveId, setExpandedArchiveId] = useState<string | null>(null);

  const fetchTransactions = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const response = await fetch(`/api/transactions?userId=${user.id}`);
      const data = await response.json();
      setTransactions(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchArchives = async () => {
    if (!user) return;
    setLoadingArchives(true);
    try {
      const response = await fetch(`/api/monthly-reports?userId=${user.id}`);
      const data = await response.json();
      setArchives(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingArchives(false);
    }
  };

  useEffect(() => {
    fetchTransactions();
    fetchArchives();
  }, [user?.id]);

  useEffect(() => {
    if (activeTab === 'archives') {
      fetchArchives();
    }
  }, [activeTab]);

  const filteredTxs = transactions.filter(tx => {
    if (!tx.timestamp) return false;
    const date = safeParseDate(tx.timestamp);
    if (period === 'today') {
      return date >= startOfDay(new Date()) && date <= endOfDay(new Date());
    }
    if (period === 'month') {
      return date >= startOfMonth(new Date());
    }
    return true;
  });

  const stats = filteredTxs.reduce((acc, tx) => {
    const profit = tx.profit !== undefined && tx.profit !== null ? tx.profit : (tx.type === 'expense' ? -(tx.amount || 0) : ((tx.fee || 0) - (tx.feeExternal || 0)));
    
    // Exclude internal movements and income adjustment from business volume
    if (!['transfer_in', 'cash_in', 'cash_out', 'adjustment', 'transfer'].includes(tx.type)) {
      acc.totalVolume += tx.amount;
    }
    
    // Profit calculation for all types
    if (!['transfer_in', 'cash_in', 'cash_out', 'adjustment'].includes(tx.type)) {
      acc.totalFees += profit;
      acc.feeByType[tx.type] = (acc.feeByType[tx.type] || 0) + profit;
    }
    
    acc.count += 1;
    if (!['transfer_in', 'cash_in', 'cash_out'].includes(tx.type)) {
      acc.byType[tx.type] = (acc.byType[tx.type] || 0) + tx.amount;
    }
    acc.byAccount[tx.accountId] = (acc.byAccount[tx.accountId] || 0) + tx.amount;
    return acc;
  }, { totalVolume: 0, totalFees: 0, count: 0, byType: {} as any, feeByType: {} as any, byAccount: {} as any });

  const transactionTypes = ['tarik_tunai', 'setor_tunai', 'topup', 'ppob', 'topup_game', 'transfer_bank', 'transfer', 'expense', 'adjustment'];

  const chartData = useMemo(() => {
    return transactionTypes
      .map(type => ({
        name: type.replace('_', ' ').toUpperCase(),
        profit: stats.feeByType[type] || 0,
        type: type
      }))
      .filter(d => d.profit !== 0)
      .sort((a, b) => b.profit - a.profit);
  }, [stats.feeByType, transactionTypes]);

  // Find unique months in active transactions
  const availableMonthsToReset = useMemo(() => {
    const monthsSet = new Set<string>();
    transactions.forEach(tx => {
      if (tx.timestamp) {
        const m = tx.timestamp.substring(0, 7); // 'YYYY-MM'
        if (/^\d{4}-\d{2}$/.test(m)) {
          monthsSet.add(m);
        }
      }
    });
    return Array.from(monthsSet).sort().reverse();
  }, [transactions]);

  // Open the reset modal and set initial value
  const handleOpenResetModal = () => {
    if (availableMonthsToReset.length > 0) {
      setResetMonth(availableMonthsToReset[0]);
    } else {
      const todayString = format(new Date(), 'yyyy-MM');
      setResetMonth(todayString);
    }
    setResetError('');
    setShowResetModal(true);
  };

  const handleResetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !resetMonth) return;
    setResetting(true);
    setResetError('');
    try {
      const response = await fetch('/api/monthly-reports/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, month: resetMonth })
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Gagal memproses tutup buku bulanan');
      }
      
      // Success!
      await Promise.all([
        fetchTransactions(),
        fetchArchives()
      ]);
      setShowResetModal(false);
    } catch (err: any) {
      setResetError(err.message || 'Terjadi kesalahan sistem.');
    } finally {
      setResetting(false);
    }
  };

  const handleDeleteArchive = async (archiveId: string) => {
    if (!confirm('Apakah Anda yakin ingin menghapus data arsip laporan bulanan ini? Tindakan ini permanen.')) return;
    try {
      const response = await fetch(`/api/monthly-reports/${archiveId}`, {
        method: 'DELETE'
      });
      if (response.ok) {
        fetchArchives();
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="space-y-4 pb-20 md:pb-0">
      {/* Header and main navigation tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight">Laporan & Tutup Buku</h2>
          <p className="text-slate-500 text-xs font-medium">Lacak pertumbuhan profit harian, bulanan, dan kelola laporan keuangan.</p>
        </div>

        {/* Real-time vs Archives tab selector */}
        <div className="flex p-1 bg-slate-100 rounded-2xl shrink-0 w-fit self-start sm:self-auto">
          <button
            onClick={() => setActiveTab('realtime')}
            className={clsx(
              "px-4 py-1.5 rounded-xl text-[11px] font-black uppercase tracking-tight transition-all",
              activeTab === 'realtime' ? "bg-white text-blue-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
            )}
          >
            Laba Real-Time
          </button>
          <button
            onClick={() => setActiveTab('archives')}
            className={clsx(
              "px-4 py-1.5 rounded-xl text-[11px] font-black uppercase tracking-tight transition-all flex items-center gap-1.5",
              activeTab === 'archives' ? "bg-white text-blue-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
            )}
          >
            <Archive size={11} className={activeTab === 'archives' ? "text-blue-600" : "text-slate-400"} />
            Buku Bulanan
          </button>
        </div>
      </div>

      {activeTab === 'realtime' ? (
        // --- REALTIME TAB ---
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">Filter Periode Laporan Aktif</h3>
            <div className="flex p-1 bg-slate-100/70 rounded-2xl">
              {(['today', 'month', 'all'] as const).map((p) => (
                <button
                  key={p}
                  onClick={() => setPeriod(p)}
                  className={clsx(
                    "px-3.5 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-tight transition-all",
                    period === p ? "bg-white text-slate-800 shadow-sm border border-slate-100" : "text-slate-400 hover:text-slate-600"
                  )}
                >
                  {p === 'today' ? 'Hari Ini' : p === 'month' ? 'Bulan Ini' : 'Semua'}
                </button>
              ))}
            </div>
          </div>

          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
               <div className="h-32 bg-slate-50 border border-slate-100 rounded-[2rem] animate-pulse" />
               <div className="h-32 bg-slate-50 border border-slate-100 rounded-[2rem] animate-pulse" />
               <div className="h-32 bg-slate-50 border border-slate-100 rounded-[2rem] animate-pulse" />
            </div>
          ) : (
            <div className="space-y-6">
              {/* Main Summary Compact */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <SummaryCard 
                  label="Keuntungan (Puro)" 
                  value={formatCurrency(stats.totalFees)} 
                  icon={PieChart} 
                  color="text-green-600" 
                  bg="bg-green-50/50 border border-green-100"
                />
                <SummaryCard 
                  label="Volume TRX" 
                  value={formatCurrency(stats.totalVolume)} 
                  icon={FileBarChart} 
                  color="text-blue-600" 
                  bg="bg-blue-50/55 border border-blue-100"
                />
                <SummaryCard 
                  label="Qty Transaksi" 
                  value={`${stats.count} TRX`} 
                  icon={TrendingUp} 
                  color="text-orange-600" 
                  bg="bg-orange-50/55 border border-orange-100"
                />
              </div>

              {/* New Profit Breakdown Chart */}
              {chartData.length > 0 ? (
                <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm p-6 overflow-hidden">
                   <div className="flex items-center justify-between mb-8 px-1">
                     <div>
                        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Visualisasi Profitabilitas</h4>
                        <p className="text-xs font-black text-slate-900 uppercase">Kontribusi Laba per Layanan Terpilih</p>
                     </div>
                     <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1">
                           <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></div>
                           <span className="text-[8px] font-bold text-slate-400 uppercase">Visual Aktif</span>
                        </div>
                     </div>
                   </div>
                   
                   <div className="h-[280px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={chartData} margin={{ top: 0, right: 10, left: 10, bottom: 20 }}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                          <XAxis 
                            dataKey="name" 
                            axisLine={false} 
                            tickLine={false} 
                            tick={{ fontSize: 9, fontWeight: 800, fill: '#94a3b8' }}
                            angle={-25}
                            textAnchor="end"
                            interval={0}
                          />
                          <YAxis hide />
                          <Tooltip 
                            cursor={{ fill: '#f8fafc', radius: 12 }}
                            content={({ active, payload }) => {
                              if (active && payload && payload.length) {
                                return (
                                  <div className="bg-slate-900 text-white p-3 rounded-xl shadow-2xl border border-slate-800">
                                    <p className="text-[9px] font-black uppercase text-slate-400 mb-1 leading-none">{payload[0].payload.name}</p>
                                    <p className="text-sm font-black">{formatCurrency(payload[0].value as number)}</p>
                                  </div>
                                );
                              }
                              return null;
                            }}
                          />
                          <Bar 
                            dataKey="profit" 
                            radius={[8, 8, 8, 8]} 
                            barSize={40}
                          >
                            {chartData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={(COLORS as any)[entry.type] || '#3b82f6'} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                   </div>
                </div>
              ) : (
                <div className="bg-slate-50 rounded-[2rem] border border-slate-100 p-8 text-center text-slate-400 font-bold text-xs uppercase">
                  Tidak ada data visualisasi laba untuk filter terpilih.
                </div>
              )}

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* By Layanan Fees - Compact List */}
                <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm p-6">
                   <div className="flex items-center justify-between mb-4 px-1">
                     <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">Laba per Layanan</h3>
                   </div>
                   <div className="space-y-2">
                     {transactionTypes.map(type => {
                       const profit = stats.feeByType[type] || 0;
                       if (profit === 0 && period !== 'all') return null;
                       return (
                         <div key={type} className="flex items-center justify-between p-3 bg-slate-50/50 hover:bg-slate-50 rounded-xl border border-slate-100 transition-all">
                            <div className="flex items-center gap-2">
                               <div className={clsx(
                                  "w-8 h-8 rounded-lg flex items-center justify-center shrink-0 shadow-sm",
                                  type === 'tarik_tunai' ? "bg-green-100 text-green-700" :
                                  type === 'setor_tunai' ? "bg-blue-100 text-blue-700" :
                                  type === 'expense' ? "bg-red-100 text-red-700" : "bg-slate-100 text-slate-600"
                               )}>
                                  {type === 'expense' ? <TrendingDown size={14}/> : <TrendingUp size={14}/>}
                               </div>
                               <span className="text-[11px] font-bold text-slate-700 uppercase tracking-tight truncate max-w-[140px]">{type.replace('_', ' ')}</span>
                            </div>
                            <span className="text-[12px] font-black text-slate-900 font-mono">{formatCurrency(profit)}</span>
                         </div>
                       );
                     })}
                   </div>
                </div>

                {/* By Account Volume - Gauge Style */}
                <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm p-6">
                   <div className="flex items-center justify-between mb-4 px-1">
                     <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">Perputaran Rekening</h3>
                   </div>
                   <div className="space-y-4">
                     {accounts.map(acc => {
                       const volume = stats.byAccount[acc.id] || 0;
                       const percentage = stats.totalVolume > 0 ? (volume / stats.totalVolume) * 100 : 0;
                       return (
                         <div key={acc.id} className="space-y-1.5">
                            <div className="flex justify-between items-center text-[10px] font-black">
                               <span className="text-slate-500 uppercase tracking-tight">{acc.name}</span>
                               <span className="text-slate-900 font-mono">{formatCurrency(volume)}</span>
                            </div>
                            <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden animate-pulse-slow">
                               <motion.div 
                                initial={{ width: 0 }}
                                animate={{ width: `${percentage}%` }}
                                className="h-full bg-blue-500 rounded-full"
                               />
                            </div>
                         </div>
                       );
                     })}
                   </div>
                </div>
              </div>

              {/* Reset Monthly Action Card inside Realtime list as a helper */}
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100/50 rounded-[2rem] p-6 flex flex-col md:flex-row items-center justify-between gap-4">
                <div className="text-center md:text-left">
                  <h4 className="text-xs font-black uppercase text-blue-900 tracking-wider">Tutup Buku Bulan Ini?</h4>
                  <p className="text-[10px] text-slate-500 font-bold max-w-md mt-0.5 leading-relaxed">
                    Reset transaksi aktif di akhir bulan untuk diarsipkan secara otomatis ke laporan permanen agar sistem tetap ringan dan laporan tertata rapi.
                  </p>
                </div>
                <button 
                  onClick={handleOpenResetModal}
                  className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest flex items-center gap-2 transition-all shadow-lg shadow-blue-500/20 shrink-0"
                >
                  <Archive size={14} />
                  <span>Tutup Buku Bulanan</span>
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        // --- ARCHIVES TAB ---
        <div className="space-y-6">
          <div className="bg-slate-900 rounded-[2rem] p-6 text-white flex flex-col sm:flex-row items-center justify-between gap-4">
             <div className="text-center sm:text-left">
                <h4 className="text-sm font-black uppercase tracking-wider flex items-center justify-center sm:justify-start gap-1.5">
                  <Archive size={16} className="text-blue-400" />
                  Sistem Arsip & Tutup Buku Bulanan
                </h4>
                <p className="text-[10px] text-slate-400 font-medium mt-1 leading-relaxed max-w-xl">
                  Simpan ringkasan transaksi Anda ke dalam basis data permanen dan bersihkan transaksi aktif untuk bulan baru. Nilai uang tetap utuh dan menjadi saldo awal bulan berikutnya.
                </p>
             </div>
             <button 
               onClick={handleOpenResetModal}
               className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest flex items-center gap-2 transition-all shadow-lg shrink-0"
             >
               <Calendar size={13} />
               <span>Proses Tutup Buku Baru</span>
             </button>
          </div>

          {loadingArchives ? (
            <div className="space-y-3">
              <div className="h-16 bg-slate-50 border border-slate-100 rounded-2xl animate-pulse" />
              <div className="h-16 bg-slate-50 border border-slate-100 rounded-2xl animate-pulse" />
              <div className="h-16 bg-slate-50 border border-slate-100 rounded-2xl animate-pulse" />
            </div>
          ) : archives.length === 0 ? (
            <div className="bg-white rounded-[2rem] text-center p-12 border border-slate-100">
               <div className="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
                 <AlertTriangle size={20} className="text-slate-400" />
               </div>
               <h4 className="text-xs font-black uppercase text-slate-700">Belum Ada Arsip Tutup Buku</h4>
               <p className="text-[10px] text-slate-400 max-w-sm mx-auto mt-1 leading-relaxed">
                 Klik tombol di atas untuk membuat tutup buku bulanan pertama Anda berdasarkan pencatatan transaksi yang aktif.
               </p>
            </div>
          ) : (
            <div className="space-y-3">
               <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1 leading-none">Riwayat Laporan Bulan Sebelumnya ({archives.length})</h4>
               
               <div className="space-y-3">
                 {archives.map((arc) => {
                   const isExpanded = expandedArchiveId === arc.id;
                   
                   let detailsObj: any = null;
                   try {
                     detailsObj = typeof arc.details === 'string' ? JSON.parse(arc.details) : arc.details;
                   } catch (e) {
                     console.error(e);
                   }

                   return (
                     <div 
                       key={arc.id} 
                       className="bg-white border border-slate-100 rounded-[2rem] p-4 sm:p-5 transition-all shadow-sm space-y-4 hover:border-slate-200"
                     >
                       {/* Row Header */}
                       <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                         <div className="flex items-center gap-3">
                           <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                             <Calendar size={18} />
                           </div>
                           <div>
                             <h4 className="text-sm font-black text-slate-800 uppercase">
                               {formatMonthName(arc.month)}
                             </h4>
                             <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">
                               {arc.transactionCount} Transaksi Diarsipkan • {format(new Date(arc.createdAt), 'dd MMMM yyyy • HH:mm', { locale: id })}
                             </p>
                           </div>
                         </div>

                         {/* Mini summary figures */}
                         <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-right shrink-0">
                           <div>
                             <span className="text-[8px] font-black text-slate-450 uppercase block tracking-wider leading-none text-slate-400">Total Volume:</span>
                             <span className="text-xs font-black text-slate-800 font-mono">
                               {formatCurrency(arc.totalVolume)}
                             </span>
                           </div>

                           <div>
                             <span className="text-[8px] font-black text-slate-450 uppercase block tracking-wider leading-none text-slate-400">Keuntungan Bersih:</span>
                             <span className="text-xs font-black text-green-600 font-mono">
                               {formatCurrency(arc.totalProfit)}
                             </span>
                           </div>
                         </div>

                         {/* Action Buttons */}
                         <div className="flex items-center gap-2 self-end sm:self-auto pt-2 sm:pt-0">
                           <button 
                             onClick={() => handleDeleteArchive(arc.id)}
                             className="p-2 text-slate-400 hover:text-red-500 rounded-lg hover:bg-slate-50 transition-colors"
                             title="Hapus data arsip"
                           >
                             <Trash2 size={13} />
                           </button>

                           <button
                             onClick={() => setExpandedArchiveId(isExpanded ? null : arc.id)}
                             className="px-4 py-2 bg-slate-50 border border-slate-100 text-[10px] uppercase font-black tracking-wider text-slate-700 hover:bg-slate-100 rounded-xl flex items-center gap-1 shrink-0"
                           >
                             <span>Rincian</span>
                             {isExpanded ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
                           </button>
                         </div>
                       </div>

                       {/* Row Expandable Details */}
                       <AnimatePresence>
                         {isExpanded && (
                           <motion.div
                             initial={{ opacity: 0, height: 0 }}
                             animate={{ opacity: 1, height: 'auto' }}
                             exit={{ opacity: 0, height: 0 }}
                             className="overflow-hidden border-t border-slate-50 pt-4"
                           >
                             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                               {/* Category breakdown */}
                               <div className="bg-slate-50/50 rounded-2xl p-4 border border-slate-100 space-y-3">
                                 <h5 className="text-[9px] font-black text-slate-400 uppercase tracking-widest pl-0.5">Keuntungan per Layanan Termedial</h5>
                                 <div className="space-y-1.5 max-h-[220px] overflow-y-auto pr-1">
                                   {detailsObj && detailsObj.feeByType ? (
                                     Object.entries(detailsObj.feeByType).map(([type, profit]: any) => (
                                       <div key={type} className="flex justify-between items-center text-[11px] p-2 bg-white rounded-lg border border-slate-100/60 font-medium">
                                         <span className="text-slate-600 uppercase text-[9px] font-black">{type.replace('_', ' ')}</span>
                                         <span className="font-mono text-slate-800 font-bold">{formatCurrency(profit)}</span>
                                       </div>
                                     ))
                                   ) : (
                                     <p className="text-[10px] text-slate-400 font-bold italic text-center py-4">Rincian rincian kategori kosong</p>
                                   )}
                                 </div>
                               </div>

                               {/* Account volumes */}
                               <div className="bg-slate-50/50 rounded-2xl p-4 border border-slate-100 space-y-3">
                                 <h5 className="text-[9px] font-black text-slate-400 uppercase tracking-widest pl-0.5">Perputaran Saldo per Rekening</h5>
                                 <div className="space-y-1.5 max-h-[220px] overflow-y-auto pr-1">
                                   {detailsObj && detailsObj.byAccount ? (
                                     Object.entries(detailsObj.byAccount).map(([accId, volume]: any) => {
                                       const accName = accounts.find(a => a.id === accId)?.name || 'Akun Lain';
                                       return (
                                         <div key={accId} className="flex justify-between items-center text-[11px] p-2 bg-white rounded-lg border border-slate-100/60 font-medium">
                                           <span className="text-slate-600 font-bold">{accName}</span>
                                           <span className="font-mono text-slate-900 font-black">{formatCurrency(volume)}</span>
                                         </div>
                                       );
                                     })
                                   ) : (
                                     <p className="text-[10px] text-slate-400 font-bold italic text-center py-4">Rincian rincian kasir kosong</p>
                                   )}
                                 </div>
                               </div>
                             </div>
                           </motion.div>
                         )}
                       </AnimatePresence>
                     </div>
                   );
                 })}
               </div>
            </div>
          )}
        </div>
      )}

      {/* --- RESET / CLOSE BOOKING MODAL --- */}
      <AnimatePresence>
        {showResetModal && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-[2.5rem] p-6 max-w-sm w-full border border-slate-100 shadow-2xl space-y-4"
            >
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 bg-orange-100 text-orange-600 rounded-xl flex items-center justify-center shrink-0">
                  <AlertTriangle size={22} className="animate-pulse" />
                </div>
                <div>
                  <h4 className="text-sm font-black text-slate-900 uppercase">Tutup Buku & Reset</h4>
                  <p className="text-[10px] text-slate-400 font-bold">Arsipkan transaksi bulanan.</p>
                </div>
              </div>

              {resetError && (
                <div className="p-3 bg-red-50 text-red-600 text-[10px] font-black rounded-xl border border-red-100">
                  {resetError}
                </div>
              )}

              <form onSubmit={handleResetSubmit} className="space-y-4">
                {/* Select target month */}
                <div>
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1.5 ml-1">Pilih Bulan Transaksi</label>
                  {availableMonthsToReset.length > 0 ? (
                    <select
                      value={resetMonth}
                      onChange={(e) => setResetMonth(e.target.value)}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-100 font-black text-xs text-slate-700"
                    >
                      {availableMonthsToReset.map(m => (
                        <option key={m} value={m}>{formatMonthName(m)}</option>
                      ))}
                    </select>
                  ) : (
                    <div className="p-3 bg-slate-50 border border-slate-100 text-slate-400 font-bold text-[10px] text-center rounded-xl uppercase">
                      Tidak ada transaksi aktif yang dapat diarsipkan.
                    </div>
                  )}
                </div>

                <div className="p-4 bg-amber-50 rounded-2xl border border-amber-100 space-y-2">
                  <p className="text-[10px] text-amber-800 font-bold leading-relaxed">
                    ⚙️ <strong className="uppercase">Informasi Penting:</strong>
                  </p>
                  <ul className="text-[9px] text-amber-700/95 font-medium list-disc list-inside space-y-1 leading-normal">
                    <li>Semua log transaksi pada bulan terpilih akan dihapus dari histori aktif.</li>
                    <li>Rincian total laba dan volume bulanan akan disimpan secara aman di tab <strong>Buku Bulanan</strong>.</li>
                    <li>Sistem akan menyamakan saldo awal rekening dengan saldo saat ini agar modal awal bulan depan selalu seimbang.</li>
                  </ul>
                </div>

                {/* Submit / Cancel Buttons */}
                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowResetModal(false)}
                    disabled={resetting}
                    className="flex-1 py-3 bg-slate-50 border border-slate-200 text-slate-600 text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-slate-100 transition-all disabled:opacity-50"
                  >
                    Batal
                  </button>

                  <button
                    type="submit"
                    disabled={resetting || availableMonthsToReset.length === 0}
                    className="flex-1 py-3 bg-blue-600 hover:bg-blue-500 text-white text-[10px] font-black uppercase tracking-widest rounded-xl flex items-center justify-center gap-1 shadow-lg shadow-blue-500/20 transition-all disabled:opacity-50"
                  >
                    {resetting ? (
                      <RefreshCw size={12} className="animate-spin" />
                    ) : (
                      <>
                        <CheckCircle2 size={12} />
                        <span>Eksekusi</span>
                      </>
                    )}
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

function SummaryCard({ label, value, icon: Icon, color, bg }: { label: string, value: string, icon: any, color: string, bg: string }) {
  return (
    <div className="bg-white rounded-[2rem] p-5 border border-slate-100 shadow-sm flex items-center gap-4 group">
      <div className={clsx("w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-transform group-hover:scale-110 shadow-sm", bg, color)}>
         <Icon size={20} />
      </div>
      <div>
         <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">{label}</p>
         <p className={clsx("text-lg font-black leading-none", color)}>{value}</p>
      </div>
    </div>
  );
}
