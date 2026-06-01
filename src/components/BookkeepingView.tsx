// BookkeepingView components
import React, { useState, useEffect, useMemo } from 'react';
import { DailyBookkeeping, Account } from '../types';
import { Calendar, Clock, Plus, Trash2, Edit2, Download, Search, Filter, MessageSquare, TrendingUp, Landmark, ShieldCheck } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format, parseISO, compareDesc } from 'date-fns';
import { clsx } from 'clsx';
import { formatCurrency } from '../lib/format';

export default function BookkeepingView({ user, accounts, onUpdateAccounts }: { user: any, accounts: Account[], onUpdateAccounts?: () => void }) {
  const [records, setRecords] = useState<DailyBookkeeping[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterSession, setFilterSession] = useState<'all' | 'pagi' | 'sore'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Create / Edit Modal States
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [dateStr, setDateStr] = useState('');
  const [sessionVal, setSessionVal] = useState<'pagi' | 'sore'>('pagi');
  const [balanceVal, setBalanceVal] = useState('');
  const [noteVal, setNoteVal] = useState('');
  const [saving, setSaving] = useState(false);
  const [accountBalances, setAccountBalances] = useState<Record<string, string>>({});

  const totalAppBalance = useMemo(() => {
    return accounts.reduce((acc, curr) => acc + curr.balance, 0);
  }, [accounts]);

  const fetchRecords = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const response = await fetch(`/api/bookkeeping?userId=${user.id}`);
      const data = await response.json();
      setRecords(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Gagal mengambil buku harian:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecords();
  }, [user?.id]);

  const handleOpenAdd = (sessionType: 'pagi' | 'sore') => {
    setEditingId(null);
    setDateStr(format(new Date(), 'yyyy-MM-dd'));
    setSessionVal(sessionType);
    
    const initialAccBals: Record<string, string> = {};
    accounts.forEach(acc => {
      initialAccBals[acc.id] = String(acc.balance);
    });
    setAccountBalances(initialAccBals);
    setBalanceVal(String(totalAppBalance));
    setNoteVal('');
    setShowModal(true);
  };

  const handleOpenEdit = (rec: DailyBookkeeping) => {
    setEditingId(rec.id);
    setDateStr(rec.date);
    setSessionVal(rec.session);
    
    let initialAccBals: Record<string, string> = {};
    if (rec.details) {
      try {
        const parsed = JSON.parse(rec.details);
        Object.keys(parsed).forEach(k => {
          initialAccBals[k] = String(parsed[k]);
        });
      } catch (e) {
        console.error("Gagal parse bookkeeping details:", e);
      }
    }
    
    accounts.forEach(acc => {
      if (!(acc.id in initialAccBals)) {
        initialAccBals[acc.id] = String(acc.balance);
      }
    });
    
    setAccountBalances(initialAccBals);
    setBalanceVal(String(rec.totalBalance));
    setNoteVal(rec.note || '');
    setShowModal(true);
  };

  const handleAccountBalanceChange = (accountId: string, rawVal: string) => {
    const cleanStr = rawVal.replace(/[^0-9.-]+/g, "");
    setAccountBalances(prev => {
      const updated = { ...prev, [accountId]: rawVal };
      
      const total = accounts.reduce((acc, curr) => {
        const valStr = updated[curr.id] || "0";
        const numericVal = parseFloat(valStr.replace(/[^0-9.-]+/g, "")) || 0;
        return acc + numericVal;
      }, 0);
      
      setBalanceVal(String(total));
      return updated;
    });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    try {
      const cleanVal = balanceVal.replace(/[^0-9.-]+/g, "");
      const numVal = parseFloat(cleanVal) || 0;

      const detailsPayload: Record<string, number> = {};
      accounts.forEach(acc => {
        const strVal = accountBalances[acc.id] || "0";
        const clean = strVal.replace(/[^0-9.-]+/g, "");
        detailsPayload[acc.id] = parseFloat(clean) || 0;
      });

      const payload = {
        id: editingId || undefined,
        userId: user.id,
        date: dateStr,
        session: sessionVal,
        totalBalance: numVal,
        note: noteVal,
        details: JSON.stringify(detailsPayload),
        timestamp: new Date().toISOString()
      };

      const response = await fetch('/api/bookkeeping', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        await fetchRecords();
        if (onUpdateAccounts) {
          onUpdateAccounts();
        }
        setShowModal(false);
      } else {
        const err = await response.json();
        alert("Gagal menyimpan pembukuan: " + (err.error || "Unknown error"));
      }
    } catch (err) {
      console.error(err);
      alert("Terjadi kesalahan.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Apakah Anda yakin ingin menghapus catatan pembukuan harian ini?")) return;
    try {
      const response = await fetch(`/api/bookkeeping/${id}`, {
        method: 'DELETE'
      });
      if (response.ok) {
        setRecords(prev => prev.filter(r => r.id !== id));
      } else {
        alert("Gagal menghapus.");
      }
    } catch (err) {
      console.error(err);
    }
  };

  const filteredRecords = useMemo(() => {
    return records
      .filter(r => {
        if (filterSession !== 'all' && r.session !== filterSession) return false;
        if (searchQuery) {
          const notes = r.note?.toLowerCase() || '';
          const dateStrFmt = format(new Date(r.date), 'dd MMMM yyyy').toLowerCase();
          const query = searchQuery.toLowerCase();
          return notes.includes(query) || r.date.includes(query) || dateStrFmt.includes(query);
        }
        return true;
      })
      .sort((a, b) => compareDesc(parseISO(a.date), parseISO(b.date)));
  }, [records, filterSession, searchQuery]);

  // Statistics summaries
  const latestPagi = useMemo(() => {
    return records.find(r => r.session === 'pagi');
  }, [records]);

  const latestSore = useMemo(() => {
    return records.find(r => r.session === 'sore');
  }, [records]);

  // Chart data: prepare historical trends (reverse chronological for chronological UI display)
  const chartData = useMemo(() => {
    // Take the last 10 unique dates to show trends
    const uniqueDates = Array.from(new Set<string>(records.map(r => r.date))).slice(0, 10).reverse();
    
    return uniqueDates.map((d: string) => {
      const p = records.find(r => r.date === d && r.session === 'pagi');
      const s = records.find(r => r.date === d && r.session === 'sore');
      return {
        date: format(new Date(d), 'dd MMM'),
        Pagi: p ? p.totalBalance : null,
        Sore: s ? s.totalBalance : null,
      };
    });
  }, [records]);

  // Export CSV
  const handleExportCSV = () => {
    if (records.length === 0) return;
    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "ID,Tanggal,Sesi,Total Saldo,Catatan,Waktu Pencatatan\n";
    
    records.forEach(r => {
      const row = [
        r.id,
        r.date,
        r.session.toUpperCase(),
        r.totalBalance,
        `"${(r.note || '').replace(/"/g, '""')}"`,
        r.timestamp
      ].join(",");
      csvContent += row + "\n";
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Buku_Harian_${format(new Date(), 'yyyyMMdd_HHmmss')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-4 pb-20 md:pb-0">
      {/* Header section styled with sleek high contrast */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight">Pembukuan Kasir</h2>
          <p className="text-slate-500 text-xs font-medium">Monitoring perbandingan & pencatatan saldo riil pagi-sore.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleOpenAdd('pagi')}
            className="bg-amber-600 hover:bg-amber-700 text-white font-black text-[10px] uppercase tracking-widest px-4 py-2.5 rounded-xl transition-all shadow-sm"
          >
            + Pagi
          </button>
          <button
            onClick={() => handleOpenAdd('sore')}
            className="bg-blue-600 hover:bg-blue-700 text-white font-black text-[10px] uppercase tracking-widest px-4 py-2.5 rounded-xl transition-all shadow-sm"
          >
            + Sore
          </button>
        </div>
      </div>

      {/* Main Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-[2rem] p-5 border border-slate-100 shadow-sm flex items-center gap-4 group">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-amber-50 text-amber-600 shadow-sm transition-transform group-hover:scale-110">
            <Clock size={20} />
          </div>
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Pagi Terakhir</p>
            <p className="text-sm font-black text-slate-800 leading-tight">
              {latestPagi ? `Rp ${formatCurrency(latestPagi.totalBalance)}` : 'Belum Ada'}
            </p>
            {latestPagi && (
              <p className="text-[9px] text-slate-400 mt-0.5 font-bold">
                {format(new Date(latestPagi.date), 'dd MMM yyyy')}
              </p>
            )}
          </div>
        </div>

        <div className="bg-white rounded-[2rem] p-5 border border-slate-100 shadow-sm flex items-center gap-4 group">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-sky-50 text-sky-600 shadow-sm transition-transform group-hover:scale-110">
            <Clock size={20} />
          </div>
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Sore Terakhir</p>
            <p className="text-sm font-black text-slate-800 leading-tight">
              {latestSore ? `Rp ${formatCurrency(latestSore.totalBalance)}` : 'Belum Ada'}
            </p>
            {latestSore && (
              <p className="text-[9px] text-slate-400 mt-0.5 font-bold">
                {format(new Date(latestSore.date), 'dd MMM yyyy')}
              </p>
            )}
          </div>
        </div>

        <div className="bg-slate-900 rounded-[2rem] p-5 text-white flex items-center gap-4 group">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-white/10 text-blue-400 shadow-sm transition-transform group-hover:scale-110">
            <Landmark size={20} />
          </div>
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Saldo Kasir Terkini</p>
            <p className="text-base font-black text-white leading-tight">
              Rp {formatCurrency(totalAppBalance)}
            </p>
            <p className="text-[8px] text-white/50 mt-0.5 font-black uppercase tracking-wider">
              Gabungan Seluruh Rekening
            </p>
          </div>
        </div>
      </div>

      {/* Visual Log List & Date Summary Card */}
      {records.length > 0 && (
        <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm p-6 space-y-4">
          <div>
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Status Pembukuan Harian</h3>
            <p className="text-xs font-black text-slate-900 uppercase">Daftar Log & Kelengkapan Sesi Berdasarkan Tanggal</p>
          </div>

          <div className="space-y-3">
            {/* Take unique dates of the last 7 days */}
            {Array.from(new Set<string>(records.map(r => r.date))).slice(0, 7).map((d: string) => {
              const pagi = records.find(r => r.date === d && r.session === 'pagi');
              const sore = records.find(r => r.date === d && r.session === 'sore');
              
              const diff = pagi && sore ? sore.totalBalance - pagi.totalBalance : null;
              
              return (
                <div key={d} className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 p-4 bg-slate-50 border border-slate-100 hover:border-indigo-100 rounded-2xl transition-all">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                      <Calendar size={18} />
                    </div>
                    <div>
                      <p className="text-sm font-black text-slate-800">
                        {format(new Date(d), 'dd MMMM yyyy')}
                      </p>
                      <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">
                        {pagi && sore ? 'Sesi Lengkap (Awal & Akhir)' : !pagi && !sore ? 'Belum Tercatat' : 'Sesi Sebagian'}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 sm:gap-6">
                    {/* Pagi Indicator */}
                    <div className="flex items-center gap-2">
                      <div className={clsx(
                        "px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5",
                        pagi ? "bg-amber-50 text-amber-700 border border-amber-200" : "bg-slate-100/70 text-slate-400 border border-slate-200"
                      )}>
                        <span className={clsx("w-1.5 h-1.5 rounded-full animate-pulse", pagi ? "bg-amber-500" : "bg-slate-350")} />
                        Pagi: {pagi ? `Rp ${formatCurrency(pagi.totalBalance)}` : 'Kosong'}
                      </div>
                    </div>

                    {/* Sore Indicator */}
                    <div className="flex items-center gap-2">
                      <div className={clsx(
                        "px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5",
                        sore ? "bg-sky-50 text-sky-700 border border-sky-200" : "bg-slate-100/70 text-slate-400 border border-slate-200"
                      )}>
                        <span className={clsx("w-1.5 h-1.5 rounded-full", sore ? "bg-sky-500" : "bg-slate-350")} />
                        Sore: {sore ? `Rp ${formatCurrency(sore.totalBalance)}` : 'Kosong'}
                      </div>
                    </div>

                    {/* Balance Difference */}
                    {diff !== null && (
                      <div className="flex items-center gap-1.5 px-3 py-1 bg-white rounded-lg border border-slate-200 text-[10px] font-black font-mono shadow-sm">
                        <span className="text-slate-400 uppercase text-[8px] tracking-wider font-sans">Selisih:</span>
                        <span className={diff >= 0 ? "text-emerald-600" : "text-rose-600"}>
                          {diff >= 0 ? "+" : ""}{formatCurrency(diff)}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Main Content Pane */}
      <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm p-6 space-y-4">
        {/* Controls Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-2 bg-slate-50 p-1 rounded-xl border border-slate-100 max-w-sm w-full sm:w-auto">
            <button
              onClick={() => setFilterSession('all')}
              className={clsx(
                "flex-1 sm:flex-none px-4 py-2 text-[10px] font-black uppercase tracking-wider rounded-lg transition-all",
                filterSession === 'all' ? "bg-white text-slate-900 shadow-sm" : "text-slate-400 hover:text-slate-600"
              )}
            >
              Semua Sesi
            </button>
            <button
              onClick={() => setFilterSession('pagi')}
              className={clsx(
                "flex-1 sm:flex-none px-4 py-2 text-[10px] font-black uppercase tracking-wider rounded-lg transition-all",
                filterSession === 'pagi' ? "bg-white text-amber-600 shadow-sm" : "text-slate-400 hover:text-slate-600"
              )}
            >
              Pagi
            </button>
            <button
              onClick={() => setFilterSession('sore')}
              className={clsx(
                "flex-1 sm:flex-none px-4 py-2 text-[10px] font-black uppercase tracking-wider rounded-lg transition-all",
                filterSession === 'sore' ? "bg-white text-blue-600 shadow-sm" : "text-slate-400 hover:text-slate-600"
              )}
            >
              Sore
            </button>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
            {/* Search */}
            <div className="relative w-full sm:w-60">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                <Search size={14} />
              </span>
              <input
                type="text"
                placeholder="Cari catatan / tanggal..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-150 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-xs text-slate-800 placeholder:text-slate-400"
              />
            </div>

            {/* Export */}
            {records.length > 0 && (
              <button
                onClick={handleExportCSV}
                className="w-full sm:w-auto border border-slate-100 hover:bg-slate-50 text-slate-700 hover:text-slate-900 px-4 py-2 rounded-xl transition-all font-black text-[10px] uppercase tracking-wider flex items-center justify-center gap-2 shrink-0 shadow-sm"
              >
                <Download size={12} />
                <span>Ekspor CSV</span>
              </button>
            )}
          </div>
        </div>

        {/* List of Bookkeeping entries */}
        {loading ? (
          <div className="space-y-3">
            <div className="h-16 bg-slate-50 rounded-2xl animate-pulse" />
            <div className="h-16 bg-slate-50 rounded-2xl animate-pulse" />
            <div className="h-16 bg-slate-50 rounded-2xl animate-pulse" />
          </div>
        ) : filteredRecords.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredRecords.map((rec) => (
              <div 
                key={rec.id} 
                className="bg-white hover:bg-slate-50/50 border border-slate-100 rounded-3xl p-5 relative group flex flex-col justify-between gap-4 transition-all shadow-sm hover:shadow-md"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2.5">
                    <span className={clsx(
                      "px-2.5 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-wider",
                      rec.session === 'pagi' ? "bg-amber-50 text-amber-700 border border-amber-200" : "bg-sky-50 text-sky-700 border border-sky-200"
                    )}>
                      Sesi {rec.session}
                    </span>
                    <span className="text-xs font-black text-slate-800 flex items-center gap-1">
                      <Calendar size={12} className="text-slate-400" />
                      {format(new Date(rec.date), 'dd MMMM yyyy')}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 opacity-60 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => handleOpenEdit(rec)}
                      className="w-8 h-8 rounded-full bg-slate-50 hover:bg-slate-100 flex items-center justify-center text-slate-600 transition-all"
                      title="Edit Pembukuan"
                    >
                      <Edit2 size={12} />
                    </button>
                    <button
                      onClick={() => handleDelete(rec.id)}
                      className="w-8 h-8 rounded-full bg-slate-50 hover:bg-red-50 hover:text-red-600 flex items-center justify-center text-slate-400 transition-all"
                      title="Hapus"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>

                <div className="bg-slate-50 rounded-2xl p-3 flex justify-between items-center">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Total Pembukuan</span>
                  <span className="text-sm font-black text-slate-900 font-mono">
                    Rp {formatCurrency(rec.totalBalance)}
                  </span>
                </div>

                {rec.details && (
                  <div className="bg-slate-50/60 rounded-2xl p-3 text-[10px] space-y-1.5 border border-slate-100">
                    <p className="font-bold text-slate-400 uppercase text-[8px] tracking-wider">Rincian Akun Saat Dicatat:</p>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                      {(() => {
                        try {
                          const parsed = JSON.parse(rec.details);
                          return Object.entries(parsed).map(([accId, bal]) => {
                            const accName = accounts.find(a => a.id === accId)?.name || 'Akun Lain';
                            return (
                              <div key={accId} className="flex justify-between items-center text-slate-600 min-w-0">
                                <span className="truncate text-slate-500 mr-1.5 font-medium">{accName}</span>
                                <span className="font-black font-mono text-slate-800 shrink-0">Rp {formatCurrency(Number(bal))}</span>
                              </div>
                            );
                          });
                        } catch (e) {
                          return null;
                        }
                      })()}
                    </div>
                  </div>
                )}

                {rec.note && (
                  <div className="text-[11px] text-slate-500 pl-2 italic border-l-2 border-slate-200 flex items-start gap-1">
                    <MessageSquare size={10} className="text-slate-400 mt-0.5 shrink-0" />
                    <span className="truncate">{rec.note}</span>
                  </div>
                )}

                <div className="flex justify-between items-center border-t border-slate-50 pt-3">
                  <span className="text-[9px] text-slate-400 font-bold">
                    Dicatat pada {format(new Date(rec.timestamp || Date.now()), 'HH:mm')}
                  </span>
                  <span className="text-[8px] text-slate-350 font-medium">
                    ID: {rec.id.slice(-8)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-16 text-center flex flex-col items-center justify-center gap-3">
            <div className="w-14 h-14 rounded-full bg-slate-50 flex items-center justify-center text-slate-350 shadow-inner">
              <Calendar size={28} />
            </div>
            <h4 className="font-black text-slate-800 text-sm">Tidak Ada Catatan</h4>
            <p className="text-slate-400 text-xs max-w-sm mx-auto leading-relaxed">
              Catatan pembukuan harian yang sesuai filter atau pencarian Anda tidak ditemukan.
            </p>
          </div>
        )}
      </div>

      {/* Bookkeeping Entry / Edit Modal Dialog */}
      <AnimatePresence>
        {showModal && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-[2.5rem] shadow-2xl p-6 w-full max-w-md border border-slate-100 relative overflow-hidden"
            >
              <h3 className="text-lg font-black text-slate-900 mb-1">
                {editingId ? "Edit Pembukuan Harian" : "Catat Buku Baru"}
              </h3>
              <p className="text-slate-500 text-[11px] font-bold uppercase tracking-wider mb-6">Konsolidasi Total Posisi Kasir</p>

              <form onSubmit={handleSave} className="space-y-4">
                {/* Date Input */}
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 block mb-1">Tanggal</label>
                  <input 
                    type="date"
                    required
                    value={dateStr}
                    onChange={(e) => setDateStr(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-bold text-sm text-slate-800"
                  />
                </div>

                {/* Session Choice */}
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 block mb-1">Sesi Pembukuan (Pagi / Sore)</label>
                  <div className="flex bg-slate-50 p-1 rounded-xl border border-slate-100">
                    <button
                      type="button"
                      onClick={() => setSessionVal('pagi')}
                      className={clsx(
                        "flex-1 py-2 text-xs font-black rounded-lg transition-all uppercase",
                        sessionVal === 'pagi' ? "bg-white text-amber-600 shadow-sm border border-slate-100" : "text-slate-500"
                      )}
                    >
                      Pagi (Awal)
                    </button>
                    <button
                      type="button"
                      onClick={() => setSessionVal('sore')}
                      className={clsx(
                        "flex-1 py-2 text-xs font-black rounded-lg transition-all uppercase",
                        sessionVal === 'sore' ? "bg-white text-blue-600 shadow-sm border border-slate-100" : "text-slate-500"
                      )}
                    >
                      Sore (Akhir)
                    </button>
                  </div>
                </div>

                {/* Individual Account Balance Inputs */}
                <div className="space-y-2 border-t border-slate-100 pt-4">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 block mb-2">Input Saldo Setiap Rekening Aktif</label>
                  <div className="space-y-3.5 max-h-[220px] overflow-y-auto pr-1 scrollbar-hide">
                    {accounts.map((acc) => {
                      const val = accountBalances[acc.id] !== undefined ? accountBalances[acc.id] : '';
                      return (
                        <div key={acc.id} className="flex items-center justify-between gap-3 p-3 bg-slate-50 border border-slate-100 rounded-2xl group transition-all hover:bg-slate-50/80">
                          <div className="min-w-0">
                            <p className="text-xs font-black text-slate-800 truncate leading-tight">{acc.name}</p>
                            <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">
                              Sistem: Rp {formatCurrency(acc.balance)}
                            </p>
                          </div>
                          
                          <div className="relative shrink-0 w-36">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] font-black text-slate-400">Rp</span>
                            <input 
                              type="text"
                              required
                              value={val}
                              onChange={(e) => handleAccountBalanceChange(acc.id, e.target.value)}
                              placeholder="0"
                              className="w-full pl-8 pr-3 py-2 bg-white border border-slate-200 focus:border-blue-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-100 font-black text-xs text-right text-slate-800"
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Total Calculated Display Card */}
                <div className="bg-blue-50/50 rounded-2xl p-4 border border-blue-100/50 flex items-center justify-between mt-3">
                  <div>
                    <h5 className="text-[10px] font-black text-blue-700 uppercase tracking-wider mb-1">Total Saldo Hasil Hitung</h5>
                    <p className="text-[9px] text-slate-400 font-bold">Otomatis diakumulasikan dari rincian rincian kasir.</p>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="text-sm font-black font-mono text-blue-700">
                      Rp {formatCurrency(parseFloat(balanceVal) || 0)}
                    </span>
                  </div>
                </div>

                {/* Additional Optional Note */}
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 block mb-1">Catatan Tambahan (Opsional)</label>
                  <textarea 
                    rows={2}
                    value={noteVal}
                    onChange={(e) => setNoteVal(e.target.value)}
                    placeholder="Contoh: Saldo riil laci lunas sesuai buku kas..."
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm placeholder:text-slate-350"
                  />
                </div>

                {/* Act Buttons */}
                <div className="flex items-center gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="flex-1 border border-slate-100 hover:bg-slate-50 text-slate-600 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="flex-1 bg-blue-600 hover:bg-blue-500 text-white py-3 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all disabled:opacity-50 shadow-md shadow-blue-100"
                  >
                    {saving ? "Menyimpan..." : "Simpan Buku"}
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
