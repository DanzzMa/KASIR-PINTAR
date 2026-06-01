import { useState, FormEvent, useEffect, useRef, ChangeEvent } from 'react';
import { Account, AccountType } from '../types';
import { Save, Wallet, Plus, Trash2, CreditCard, Landmark, Smartphone, Edit2, X, Download, Upload, ShieldCheck, Send, Database as DbIcon, Activity, RefreshCw, AlertTriangle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { clsx } from 'clsx';
import { formatNumber, getCleanNumber, formatCurrency } from '../lib/format';

interface SettingsProps {
  user: any;
  accounts: Account[];
  isInitialSetup: boolean;
  onUpdate: () => void;
}

export default function Settings({ user, accounts, isInitialSetup, onUpdate }: SettingsProps) {
  const [name, setName] = useState(user?.displayName || '');
  const [newAccName, setNewAccName] = useState('');
  const [newAccType, setNewAccType] = useState<AccountType>('cash');
  const [newAccBalance, setNewAccBalance] = useState('0');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [editingAcc, setEditingAcc] = useState<Account | null>(null);
  const [deletingAcc, setDeletingAcc] = useState<Account | null>(null);
  const [editedBalance, setEditedBalance] = useState('');

  // Reset Transactions States
  const [showResetTxModal, setShowResetTxModal] = useState(false);
  const [resetTxMode, setResetTxMode] = useState<'restore_initial' | 'keep_current'>('keep_current');
  const [resetTxLoading, setResetTxLoading] = useState(false);

  // Telegram & Data States
  const [tgToken, setTgToken] = useState('');
  const [tgChatId, setTgChatId] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [dbStats, setDbStats] = useState<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchSettings = async () => {
    if (!user?.id) return;
    try {
      const res = await fetch(`/api/settings?userId=${user.id}`);
      const data = await res.json();
      if (data.telegram_token) setTgToken(data.telegram_token);
      if (data.telegram_chat_id) setTgChatId(data.telegram_chat_id);
      if (data.app_logo_url) setLogoUrl(data.app_logo_url);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchDbStatus = async () => {
    try {
      const res = await fetch('/api/db/status');
      const data = await res.json();
      setDbStats(data);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    if (user?.id) {
      fetchSettings();
      fetchDbStatus();
    }
  }, [user?.id]);

  const handleSaveTelegram = async (e: FormEvent) => {
    e.preventDefault();
    if (!user?.id) return;
    setLoading(true);
    try {
      await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          telegram_token: tgToken,
          telegram_chat_id: tgChatId
        })
      });
      alert('Pengaturan Telegram berhasil disimpan.');
    } catch (err) {
      console.error(err);
      alert('Gagal menyimpan pengaturan Telegram.');
    } finally {
      setLoading(false);
    }
  };

  const handleBackupNow = async () => {
    if (!tgToken || !tgChatId || !user?.id) return alert('Atur Token & Chat ID Telegram dulu!');
    setLoading(true);
    try {
      const res = await fetch('/api/db/backup/telegram', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: tgToken, chatId: tgChatId, userId: user.id })
      });
      if (res.ok) alert('Backup berhasil dikirim ke Telegram!');
      else alert('Gagal mengirim backup.');
    } catch (err) {
      console.error(err);
      alert('Terjadi kesalahan saat mencadangkan.');
    } finally {
      setLoading(false);
    }
  };

  const handleTestReportNow = async () => {
    if (!tgToken || !tgChatId || !user?.id) return alert('Atur Token & Chat ID Telegram dulu!');
    setLoading(true);
    try {
      const res = await fetch('/api/db/report/telegram-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: tgToken, chatId: tgChatId, userId: user.id })
      });
      if (res.ok) alert('Laporan mutasi berhasil dikirim ke Telegram!');
      else alert('Gagal mengirim laporan mutasi.');
    } catch (err) {
      console.error(err);
      alert('Terjadi kesalahan saat mengirim laporan mutasi.');
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async () => {
    try {
      const res = await fetch('/api/db/export');
      const data = await res.json();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `backup-kasir-pintar-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
      alert('Gagal mengekspor data.');
    }
  };

  const handleImport = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!confirm('PERINGATAN! Melakukan impor data akan MENGHAPUS SEMUA DATA yang ada saat ini. Lanjutkan?')) {
      e.target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const data = JSON.parse(event.target?.result as string);
        const res = await fetch('/api/db/import', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        });

        if (res.ok) {
          alert('Impor data berhasil! Halaman akan dimuat ulang.');
          window.location.reload();
        } else {
          alert('Gagal mengimpor data. Format file mungkin salah.');
        }
      } catch (err) {
        console.error(err);
        alert('Gagal membaca file backup.');
      }
    };
    reader.readAsText(file);
  };

  const handleSaveProfile = async (e: FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setLoading(true);
    setSuccess(false);

    try {
      const updatedUser = { ...user, displayName: name };
      localStorage.setItem('kas_user', JSON.stringify(updatedUser));
      
      // Save logo URL to settings
      await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          app_logo_url: logoUrl
        })
      });

      window.location.reload(); 
    } catch (err) {
      console.error(err);
      alert('Gagal menyimpan profil.');
    } finally {
      setLoading(false);
    }
  };

  const handleAddAccount = async (e: FormEvent) => {
    e.preventDefault();
    if (!newAccName || !user) return;

    setLoading(true);
    try {
      const bal = parseFloat(getCleanNumber(newAccBalance)) || 0;
      if (bal < 0) {
        alert('Saldo awal tidak boleh negatif.');
        setLoading(false);
        return;
      }

      await fetch('/api/accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          name: newAccName,
          type: newAccType,
          balance: bal,
          initialBalance: bal,
          createdAt: new Date().toISOString()
        })
      });

      setNewAccName('');
      setNewAccBalance('0');
      onUpdate();
    } catch (err) {
      console.error(err);
      alert('Gagal menambahkan rekening.');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!deletingAcc) return;
    setLoading(true);
    try {
      const response = await fetch(`/api/accounts/${deletingAcc.id}`, {
        method: 'DELETE'
      });
      
      if (!response.ok) throw new Error('Gagal menghapus akun');

      setDeletingAcc(null);
      onUpdate();
    } catch (err) {
      console.error(err);
      alert('Gagal menghapus rekening.');
    } finally {
      setLoading(false);
    }
  };

  const handleEditBalance = async (e: FormEvent) => {
    e.preventDefault();
    if (!editingAcc || !user) return;

    const newBal = parseFloat(getCleanNumber(editedBalance));
    if (isNaN(newBal) || newBal < 0) {
      alert('Saldo tidak boleh negatif.');
      return;
    }

    const diff = newBal - editingAcc.balance;
    if (diff === 0) {
      setEditingAcc(null);
      return;
    }

    setLoading(true);
    try {
      await fetch('/api/accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...editingAcc, balance: newBal })
      });

      await fetch('/api/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          accountId: editingAcc.id,
          type: 'adjustment',
          amount: Math.abs(diff),
          fee: 0,
          feeExternal: 0,
          netAmount: diff,
          note: `Edit Saldo (Koreksi dari ${formatCurrency(editingAcc.balance)} ke ${formatCurrency(newBal)})`,
          paymentStatus: 'success'
        })
      });

      setEditingAcc(null);
      onUpdate();
    } catch (err) {
      console.error(err);
      alert('Gagal memperbarui saldo.');
    } finally {
      setLoading(false);
    }
  };

  const handleResetTransactions = async () => {
    if (!user?.id) return;
    setResetTxLoading(true);
    try {
      const res = await fetch('/api/transactions/reset-all', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          mode: resetTxMode
        })
      });

      if (res.ok) {
        setShowResetTxModal(false);
        onUpdate();
        alert('Semua transaksi berhasil dihapus & di-reset!');
      } else {
        const errData = await res.json();
        alert(errData.error || 'Gagal meriset transaksi.');
      }
    } catch (err) {
      console.error(err);
      alert('Terjadi kesalahan saat meriset transaksi.');
    } finally {
      setResetTxLoading(false);
    }
  };

  const accTypes: {id: AccountType, label: string, icon: any}[] = [
    { id: 'cash', label: 'Tunai / Cash', icon: Wallet },
    { id: 'bank', label: 'Bank / BRI / BCA', icon: Landmark },
    { id: 'ewallet', label: 'E-Wallet / DANA', icon: Smartphone },
    { id: 'other', label: 'Lainnya', icon: CreditCard },
  ];

  return (
    <div className="max-w-5xl mx-auto pb-20 md:pb-0">
      <div className="mb-6">
        <h2 className="text-2xl font-black text-slate-900 tracking-tight">Pengaturan Sistem</h2>
        <p className="text-slate-500 text-xs font-medium">Kelola profil, rekening, dan backup data Anda.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-12 space-y-6">
           <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white rounded-[2rem] border border-slate-100 shadow-sm p-6 space-y-4"
              >
                <div className="flex items-center justify-between mb-2">
                   <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">Profil Bisnis</h3>
                   <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center"><Save size={16} /></div>
                </div>
                <form onSubmit={handleSaveProfile} className="space-y-4">
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase mb-1 px-1 tracking-widest">Nama Toko/Agen</label>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all font-bold text-sm"
                      placeholder="Contoh: AGEN BERKAH"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase mb-1 px-1 tracking-widest">Logo App (URL Gambar)</label>
                    <input
                      type="text"
                      value={logoUrl}
                      onChange={(e) => setLogoUrl(e.target.value)}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all font-bold text-sm"
                      placeholder="https://example.com/logo.png"
                    />
                  </div>
                  <button type="submit" disabled={loading} className="w-full bg-blue-600 hover:bg-blue-500 text-white py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all shadow-md shadow-blue-200 disabled:opacity-50">SIMPAN PROFIL</button>
                </form>
              </motion.div>

              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="bg-slate-900 rounded-[2rem] p-6 text-white shadow-xl flex flex-col"
              >
                <div className="flex items-center justify-between mb-4">
                   <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest leading-none">Tambah Rekening</h3>
                   <div className="w-8 h-8 rounded-lg bg-white/10 text-white flex items-center justify-center"><Plus size={16} /></div>
                </div>
                <form onSubmit={handleAddAccount} className="space-y-4 flex-1 flex flex-col justify-between">
                   <div className="space-y-3">
                      <input
                        type="text"
                        value={newAccName}
                        onChange={(e) => setNewAccName(e.target.value)}
                        className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl outline-none focus:bg-white/10 transition-all font-bold text-sm text-white placeholder:text-slate-600"
                        placeholder="Nama Akun (BRI, DANA, dsb)"
                      />
                      <div className="grid grid-cols-4 gap-2">
                        {accTypes.map(t => (
                          <button key={t.id} type="button" onClick={() => setNewAccType(t.id)} title={t.label} className={clsx("flex flex-col items-center justify-center p-2 rounded-xl border transition-all", newAccType === t.id ? "border-blue-500 bg-blue-500/20 text-blue-400" : "border-white/5 bg-white/5 text-slate-500")}>
                            <t.icon size={16} />
                          </button>
                        ))}
                      </div>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-slate-600 text-xs">Rp</span>
                        <input
                          type="text"
                          value={newAccBalance}
                          onChange={(e) => setNewAccBalance(formatNumber(e.target.value))}
                          className="w-full pl-8 pr-4 py-2.5 bg-white/5 border border-white/10 rounded-xl outline-none focus:bg-white/10 transition-all font-black text-sm text-blue-400"
                        />
                      </div>
                   </div>
                   <button type="submit" disabled={loading} className="w-full bg-blue-500 text-white py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all hover:bg-blue-600 mt-4">DAFTARKAN AKUN</button>
                </form>
              </motion.div>
           </div>

           <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden">
              <div className="p-6 border-b border-slate-50 flex items-center justify-between">
                 <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">Kelola Rekening</h3>
              </div>
              <div className="divide-y divide-slate-50 overflow-x-auto">
                 <table className="w-full text-left">
                    <thead>
                       <tr className="text-[10px] font-black text-slate-400 uppercase tracking-widest bg-slate-50/50">
                          <th className="px-6 py-3">Nama & Jenis</th>
                          <th className="px-6 py-3 text-right">Saldo Saat Ini</th>
                          <th className="px-6 py-3 text-right">Modal Awal</th>
                          <th className="px-6 py-3 text-center">Aksi</th>
                       </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                       {accounts.map(acc => (
                         <tr key={acc.id} className="group hover:bg-slate-50/50">
                            <td className="px-6 py-4">
                               <div className="flex items-center gap-3">
                                  <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                                    {accTypes.find(t => t.id === acc.type)?.id.charAt(0).toUpperCase()}
                                  </div>
                                  <div>
                                     <p className="text-sm font-black text-slate-900 leading-tight uppercase">{acc.name}</p>
                                     <p className="text-[10px] font-bold text-slate-400 uppercase">{acc.type}</p>
                                  </div>
                               </div>
                            </td>
                            <td className="px-6 py-4 text-right">
                               <div className="flex items-center justify-end gap-1">
                                  <span className="text-sm font-black text-slate-900">{formatCurrency(acc.balance)}</span>
                                  <button onClick={() => { setEditingAcc(acc); setEditedBalance(formatNumber(acc.balance.toString())); }} className="p-1 text-slate-300 hover:text-blue-500"><Edit2 size={10} /></button>
                               </div>
                            </td>
                            <td className="px-6 py-4 text-right"><span className="text-[11px] font-bold text-slate-400 italic">{formatCurrency(acc.initialBalance)}</span></td>
                            <td className="px-6 py-4 text-center"><button onClick={() => setDeletingAcc(acc)} className="p-2 text-slate-300 hover:text-red-500"><Trash2 size={14} /></button></td>
                         </tr>
                       ))}
                    </tbody>
                 </table>
                 {accounts.length === 0 && <div className="p-12 text-center text-slate-400 text-xs font-black uppercase tracking-widest">Belum ada akun</div>}
              </div>
           </div>

           {/* Data Management & Backup */}
           <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <motion.div initial={{ opacity: 0, scale: 0.95 }} whileInView={{ opacity: 1, scale: 1 }} className="bg-white rounded-[2rem] border border-slate-100 shadow-sm p-6 space-y-4">
                 <div className="flex items-center justify-between mb-2">
                    <div>
Local seting                       <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Backup Otomatis</h3>
                       <p className="text-xs font-black text-slate-900 uppercase">Bot Telegram</p>
                    </div>
                    <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center"><Send size={18} /></div>
                 </div>
                 <form onSubmit={handleSaveTelegram} className="space-y-3">
                    <div className="space-y-1">
                       <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1">Bot Token</label>
                       <input type="password" value={tgToken} onChange={e => setTgToken(e.target.value)} placeholder="Bot Token" className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-xs font-bold" />
                    </div>
                    <div className="space-y-1">
                       <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1">Chat ID</label>
                       <input type="text" value={tgChatId} onChange={e => setTgChatId(e.target.value)} placeholder="Chat ID" className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-xs font-bold" />
                    </div>
                    <div className="flex gap-2 pt-2">
                       <button type="submit" className="flex-1 bg-slate-100 text-slate-900 py-2.5 rounded-xl font-black text-[10px] uppercase">Simpan Bot</button>
                       <button type="button" onClick={handleBackupNow} disabled={loading} className="flex-1 bg-blue-600 text-white py-2.5 rounded-xl font-black text-[10px] uppercase flex items-center justify-center gap-1.5 shadow-lg"><Send size={12} /> Test Backup</button>
                       <button type="button" onClick={handleTestReportNow} disabled={loading} className="flex-1 bg-emerald-600 text-white py-2.5 rounded-xl font-black text-[10px] uppercase flex items-center justify-center gap-1.5 shadow-lg"><Activity size={12} /> Test Laporan</button>
                    </div>
                 </form>
              </motion.div>

              <motion.div initial={{ opacity: 0, scale: 0.95 }} whileInView={{ opacity: 1, scale: 1 }} className="bg-slate-900 rounded-[2rem] p-6 text-white shadow-xl space-y-6">
                 <div className="flex items-center justify-between">
                    <div>
                       <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Manajemen Data</h3>
                       <p className="text-xs font-black text-white uppercase">Export & Import</p>
                    </div>
                    <div className="w-10 h-10 rounded-xl bg-white/10 text-white flex items-center justify-center"><ShieldCheck size={18} /></div>
                 </div>
                 <div className="grid grid-cols-2 gap-3">
                    <button onClick={handleExport} className="flex flex-col items-center justify-center gap-2 p-4 bg-white/5 border border-white/10 rounded-2xl hover:bg-white/10 transition-all group">
                       <Download size={24} className="text-blue-400 group-hover:scale-110" />
                       <span className="text-[9px] font-black uppercase tracking-widest">Export JSON</span>
                    </button>
                    <button onClick={() => fileInputRef.current?.click()} className="flex flex-col items-center justify-center gap-2 p-4 bg-white/5 border border-white/10 rounded-2xl hover:bg-white/10 transition-all group">
                       <Upload size={24} className="text-orange-400 group-hover:scale-110" />
                       <span className="text-[9px] font-black uppercase tracking-widest">Import JSON</span>
                    </button>
                    <input type="file" ref={fileInputRef} className="hidden" accept=".json" onChange={handleImport} />
                 </div>
                 <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl font-bold text-[9px] text-red-300">Impor data bersifat permanen & menimpa data lama!</div>
                  <div className="border-t border-white/5 pt-4">
                     <button 
                       type="button"
                       onClick={() => setShowResetTxModal(true)} 
                       className="w-full bg-red-650/20 hover:bg-red-600/30 border border-red-500/30 text-red-200 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all flex items-center justify-center gap-2 group"
                     >
                        <Trash2 size={14} className="text-red-400 group-hover:scale-110 transition-transform" />
                        <span>Reset Semua Transaksi</span>
                     </button>
                  </div>
              </motion.div>

              <motion.div initial={{ opacity: 0, y: 10 }} whileInView={{ opacity: 1, y: 0 }} className="bg-white rounded-[2rem] border border-slate-100 shadow-sm p-6 md:col-span-2">
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                       <div className="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center"><DbIcon size={18} /></div>
                       <div><h3 className="text-xs font-black text-slate-900 uppercase">Status Database Sistem</h3><p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Penyimpanan real-time</p></div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                     <div className="bg-green-50 p-4 rounded-2xl border border-green-100 flex items-center justify-between">
                        <div>
                           <p className="text-[9px] font-black text-green-600 uppercase mb-1 tracking-widest">Kesehatan</p>
                           <p className="text-xl font-black text-green-700 uppercase">Optimal</p>
                        </div>
                        <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center text-green-500 shadow-sm">
                           <Activity size={20} className="animate-pulse" />
                        </div>
                     </div>
                     <div className="bg-blue-50 p-4 rounded-2xl border border-blue-100 flex items-center justify-between">
                        <div>
                           <p className="text-[9px] font-black text-blue-600 uppercase mb-1 tracking-widest">Ukuran Data</p>
                           <p className="text-xl font-black text-blue-700 uppercase">
                              {(dbStats?.dbSize / 1024).toFixed(1)} KB
                           </p>
                        </div>
                        <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center text-blue-500 shadow-sm">
                           <DbIcon size={20} />
                        </div>
                     </div>
                  </div>
              </motion.div>
           </div>
        </div>
      </div>

      <AnimatePresence>
        {editingAcc && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="bg-white rounded-[2rem] shadow-2xl w-full max-w-sm overflow-hidden">
              <div className="p-6 bg-slate-900 text-white flex items-center justify-between"><h3 className="text-xs font-black uppercase">Koreksi Saldo</h3><button onClick={() => setEditingAcc(null)} className="text-slate-500 hover:text-white"><X size={16} /></button></div>
              <form onSubmit={handleEditBalance} className="p-6 space-y-4">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase mb-1 px-1">Saldo Real {editingAcc.name}</label>
                  <div className="relative"><span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-slate-400 text-xs">Rp</span>
                    <input type="text" autoFocus value={editedBalance} onChange={(e) => setEditedBalance(formatNumber(e.target.value))} className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-xl font-black text-blue-600" />
                  </div>
                </div>
                <button type="submit" disabled={loading} className="w-full bg-blue-600 text-white py-3 rounded-xl font-black text-[10px] uppercase shadow-lg shadow-blue-200">SIMPAN SALDO</button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {deletingAcc && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="bg-white rounded-[2rem] shadow-2xl w-full max-w-sm overflow-hidden">
              <div className="p-8 text-center">
                <div className="w-12 h-12 bg-red-50 text-red-600 rounded-2xl flex items-center justify-center mx-auto mb-6"><Trash2 size={24} /></div>
                <h3 className="text-lg font-black text-slate-900 uppercase mb-2">Hapus Akun?</h3>
                <div className="flex gap-3"><button onClick={() => setDeletingAcc(null)} className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-black text-[10px] uppercase">BATAL</button>
                  <button onClick={handleDeleteAccount} disabled={loading} className="flex-1 bg-red-600 text-white px-4 py-2.5 rounded-xl font-black text-[10px] uppercase disabled:opacity-50">YA, HAPUS</button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showResetTxModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }} 
              animate={{ opacity: 1, scale: 1 }} 
              exit={{ opacity: 0, scale: 0.95 }} 
              className="bg-white rounded-[2rem] shadow-2xl w-full max-w-sm overflow-hidden border border-slate-100 p-6 space-y-4"
            >
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 bg-red-100 text-red-600 rounded-xl flex items-center justify-center shrink-0">
                  <AlertTriangle size={22} className="animate-pulse" />
                </div>
                <div>
                  <h4 className="text-xs font-black text-slate-900 uppercase">Reset Transaksi</h4>
                  <p className="text-[9px] text-slate-400 font-bold uppercase">Hapus semua histori transaksi aktif.</p>
                </div>
              </div>

              <div className="p-4 bg-red-50 rounded-2xl border border-red-100 space-y-2 text-red-800">
                <p className="text-[10px] font-black uppercase">⚠️ Peringatan Kredensial & Risiko:</p>
                <p className="text-[9px] font-medium leading-relaxed">
                  Tindakan ini akan menghapus semua histori transaksi Anda di sistem secara permanen. Silakan pilih bagaimana saldo rekening saat ini akan ditangani:
                </p>
              </div>

              <div className="space-y-3">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block pl-1">Opsi Penanganan Saldo</label>
                
                <div className="space-y-2">
                  <button
                    type="button"
                    onClick={() => setResetTxMode('keep_current')}
                    className={clsx(
                      "w-full p-4 rounded-xl border text-left flex items-start gap-3 transition-all",
                      resetTxMode === 'keep_current' 
                        ? "border-blue-500 bg-blue-50/50" 
                        : "border-slate-150 hover:bg-slate-50"
                    )}
                  >
                    <input 
                      type="radio" 
                      checked={resetTxMode === 'keep_current'} 
                      onChange={() => setResetTxMode('keep_current')}
                      className="mt-0.5"
                    />
                    <div>
                      <p className="text-[11px] font-black text-slate-900 uppercase">Gunakan Saldo Saat Ini</p>
                      <p className="text-[9px] text-slate-550 font-medium">Histori transaksi dihapus, saldo saat ini tetap disimpan & dijadikan modal awal baru.</p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setResetTxMode('restore_initial')}
                    className={clsx(
                      "w-full p-4 rounded-xl border text-left flex items-start gap-3 transition-all",
                      resetTxMode === 'restore_initial' 
                        ? "border-blue-500 bg-blue-50/50" 
                        : "border-slate-150 hover:bg-slate-50"
                    )}
                  >
                    <input 
                      type="radio" 
                      checked={resetTxMode === 'restore_initial'} 
                      onChange={() => setResetTxMode('restore_initial')}
                      className="mt-0.5"
                    />
                    <div>
                      <p className="text-[11px] font-black text-slate-900 uppercase">Kembalikan Saldo Asal</p>
                      <p className="text-[9px] text-slate-550 font-medium">Histori transaksi dihapus, saldo rekening dikembalikan ke modal awal pendaftaran.</p>
                    </div>
                  </button>
                </div>
              </div>

              <div className="flex gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowResetTxModal(false)}
                  disabled={resetTxLoading}
                  className="flex-1 py-3 bg-slate-50 border border-slate-200 text-slate-600 text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-slate-100 transition-all disabled:opacity-50"
                >
                  Batal
                </button>

                <button
                  type="button"
                  onClick={handleResetTransactions}
                  disabled={resetTxLoading}
                  className="flex-1 py-3 bg-red-650 hover:bg-red-600 text-white text-[10px] font-black uppercase tracking-widest rounded-xl flex items-center justify-center gap-1 shadow-lg shadow-red-500/20 transition-all disabled:opacity-50"
                >
                  {resetTxLoading ? (
                    <RefreshCw size={12} className="animate-spin" />
                  ) : (
                    <>
                      <Trash2 size={12} />
                      <span>Hapus Semua</span>
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
