import { useState, useEffect, useMemo } from 'react';
import { Transaction, Account } from '../types';
import { FileBarChart, PieChart, TrendingUp, Download, TrendingDown } from 'lucide-react';
import { motion } from 'motion/react';
import { format, startOfDay, startOfMonth, endOfDay } from 'date-fns';
import { id } from 'date-fns/locale';
import { clsx } from 'clsx';
import { formatCurrency, safeParseDate } from '../lib/format';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

export default function Reports({ user, accounts }: { user: any, accounts: Account[] }) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<'today' | 'month' | 'all'>('today');

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

  useEffect(() => {
    fetchTransactions();
  }, [user?.id]);

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

  return (
    <div className="space-y-4 pb-20 md:pb-0">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight">Analisis Laba</h2>
          <p className="text-slate-500 text-xs font-medium">Performa bisnis Anda secara real-time.</p>
        </div>
        <div className="flex p-1 bg-slate-100 rounded-2xl">
          {(['today', 'month', 'all'] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={clsx(
                "px-4 py-1.5 rounded-xl text-[11px] font-black uppercase tracking-tight transition-all",
                period === p ? "bg-white text-blue-600 shadow-sm" : "text-slate-500"
              )}
            >
              {p === 'today' ? 'Hari Ini' : p === 'month' ? 'Bulan Ini' : 'Semua'}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
           <div className="h-32 bg-slate-100 rounded-[2rem] animate-pulse" />
           <div className="h-32 bg-slate-100 rounded-[2rem] animate-pulse" />
           <div className="h-32 bg-slate-100 rounded-[2rem] animate-pulse" />
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
              bg="bg-green-50"
            />
            <SummaryCard 
              label="Volume TRX" 
              value={formatCurrency(stats.totalVolume)} 
              icon={FileBarChart} 
              color="text-blue-600" 
              bg="bg-blue-50"
            />
            <SummaryCard 
              label="Qty Transaksi" 
              value={`${stats.count} TRX`} 
              icon={TrendingUp} 
              color="text-orange-600" 
              bg="bg-orange-50"
            />
          </div>

          {/* New Profit Breakdown Chart */}
          <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm p-6 overflow-hidden">
             <div className="flex items-center justify-between mb-8 px-1">
               <div>
                  <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Visualisasi Profitabilitas</h3>
                  <p className="text-xs font-black text-slate-900 uppercase">Kontribusi Laba per Layanan</p>
               </div>
               <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1">
                     <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                     <span className="text-[8px] font-bold text-slate-400 uppercase">Profit Tinggi</span>
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
                    <YAxis 
                      hide 
                    />
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
                     <div key={type} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
                        <div className="flex items-center gap-2">
                           <div className={clsx(
                              "w-8 h-8 rounded-lg flex items-center justify-center shrink-0 shadow-sm",
                              type === 'tarik_tunai' ? "bg-green-100 text-green-700" :
                              type === 'setor_tunai' ? "bg-blue-100 text-blue-700" :
                              type === 'expense' ? "bg-red-100 text-red-700" : "bg-slate-200 text-slate-600"
                           )}>
                              {type === 'expense' ? <TrendingDown size={14}/> : <TrendingUp size={14}/>}
                           </div>
                           <span className="text-[11px] font-bold text-slate-700 uppercase tracking-tight truncate max-w-[120px]">{type.replace('_', ' ')}</span>
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
                        <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
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

          <div className="bg-slate-900 rounded-[2rem] p-6 text-white flex flex-col md:flex-row items-center justify-between gap-4">
             <div className="text-center md:text-left">
                <h4 className="text-sm font-black uppercase tracking-wider">Ekspor Data Laporan</h4>
                <p className="text-[10px] text-slate-500 font-medium">Download rincian lengkap dalam format CSV/Excel.</p>
             </div>
             <button className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest flex items-center gap-2 transition-all shadow-lg shadow-blue-900/20">
               <Download size={14} />
               <span>Ekspor Rekap</span>
             </button>
          </div>
        </div>
      )}
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
