import { useState, FormEvent } from 'react';
import { Account, AccountType } from '../types';
import { Save, Wallet, Plus, Trash2, CreditCard, Landmark, Smartphone, Edit2, X } from 'lucide-react';
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

  const handleSaveProfile = async (e: FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setLoading(true);
    setSuccess(false);

    try {
      // For local demo, we just update the local storage/session if we don't have a profile endpoint
      const updatedUser = { ...user, displayName: name };
      localStorage.setItem('kas_user', JSON.stringify(updatedUser));
      // Trigger a page reload or state update to reflect changes globally
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
      // We'll need a delete endpoint for accounts too, but for now we skip or add it
      // For now, let's just make it a "soft delete" or not implemented yet.
      // Actually, I'll add a generic accounts delete endpoint in server.ts
      setDeletingAcc(null);
      alert('Fitur hapus akun belum tersedia di versi lokal ini.');
    } catch (err) {
      console.error(err);
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
      // 1. Update Account
      await fetch('/api/accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...editingAcc, balance: newBal })
      });

      // 2. Add Adjustment Transaction
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

  const accTypes: {id: AccountType, label: string, icon: any}[] = [
    { id: 'cash', label: 'Tunai / Cash', icon: Wallet },
    { id: 'bank', label: 'Bank / BRI / BCA', icon: Landmark },
    { id: 'ewallet', label: 'E-Wallet / DANA', icon: Smartphone },
    { id: 'other', label: 'Lainnya', icon: CreditCard },
  ];

  return (
    <div className="max-w-5xl mx-auto pb-20 md:pb-0">
      <div className="mb-6">
        <h2 className="text-2xl font-black text-slate-900 tracking-tight">Pengaturan Akun</h2>
        <p className="text-slate-500 text-xs font-medium">Kelola profil bisnis dan sumber modal Anda.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Profile & Accounts List */}
        <div className="lg:col-span-12 md:col-span-12 space-y-6">
           <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white rounded-[2rem] border border-slate-100 shadow-sm p-6 space-y-4"
              >
                <div className="flex items-center justify-between mb-2">
                   <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">Profil Bisnis</h3>
                   <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                      <Save size={16} />
                   </div>
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
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-blue-600 hover:bg-blue-500 text-white py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all shadow-md shadow-blue-200 disabled:opacity-50"
                  >
                    SIMPAN PERUBAHAN
                  </button>
                  {success && <p className="text-center text-green-600 text-[10px] font-black uppercase tracking-widest">TERSIMPAN!</p>}
                </form>
              </motion.div>

              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="bg-slate-900 rounded-[2rem] p-6 text-white shadow-xl shadow-blue-900/10 flex flex-col"
              >
                <div className="flex items-center justify-between mb-4">
                   <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest leading-none">Tambah Rekening</h3>
                   <div className="w-8 h-8 rounded-lg bg-white/10 text-white flex items-center justify-center">
                      <Plus size={16} />
                   </div>
                </div>
                <form onSubmit={handleAddAccount} className="space-y-4 flex-1 flex flex-col justify-between">
                   <div className="space-y-3">
                      <input
                        type="text"
                        value={newAccName}
                        onChange={(e) => setNewAccName(e.target.value)}
                        className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl outline-none focus:bg-white/10 transition-all font-bold text-sm text-white placeholder:text-slate-600"
                        placeholder="Nama Akun (Misal: BRI, DANA)"
                      />
                      <div className="grid grid-cols-4 gap-2">
                        {accTypes.map(t => (
                          <button
                            key={t.id}
                            type="button"
                            onClick={() => setNewAccType(t.id)}
                            title={t.label}
                            className={clsx(
                              "flex flex-col items-center justify-center p-2 rounded-xl border transition-all",
                              newAccType === t.id 
                                ? "border-blue-500 bg-blue-500/20 text-blue-400" 
                                : "border-white/5 bg-white/5 text-slate-500 hover:text-slate-300"
                            )}
                          >
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
                          placeholder="Saldo Awal"
                        />
                      </div>
                   </div>
                   <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-white text-slate-900 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all hover:bg-slate-200 mt-4"
                   >
                     DAFTARKAN AKUN
                   </button>
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
                         <tr key={acc.id} className="group hover:bg-slate-50/50 transition-all">
                            <td className="px-6 py-4">
                               <div className="flex items-center gap-3">
                                  <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                                    {accTypes.find(t => t.id === acc.type)?.id.charAt(0).toUpperCase()}
                                  </div>
                                  <div>
                                     <p className="text-sm font-black text-slate-900 leading-tight uppercase tracking-tight">{acc.name}</p>
                                     <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none">{acc.type}</p>
                                  </div>
                               </div>
                            </td>
                            <td className="px-6 py-4 text-right">
                               <div className="flex items-center justify-end gap-1 group/edit">
                                  <span className="text-sm font-black text-slate-900 font-mono">{formatCurrency(acc.balance)}</span>
                                  <button
                                    onClick={() => {
                                      setEditingAcc(acc);
                                      setEditedBalance(formatNumber(acc.balance.toString()));
                                    }}
                                    className="p-1 text-slate-300 hover:text-blue-500 transition-all"
                                  >
                                    <Edit2 size={10} />
                                  </button>
                               </div>
                            </td>
                            <td className="px-6 py-4 text-right">
                               <span className="text-[11px] font-bold text-slate-400 font-mono italic">{formatCurrency(acc.initialBalance)}</span>
                            </td>
                            <td className="px-6 py-4">
                               <div className="flex items-center justify-center">
                                  <button 
                                    onClick={() => setDeletingAcc(acc)}
                                    className="p-2 text-slate-300 hover:text-red-500 transition-all"
                                  >
                                    <Trash2 size={14} />
                                  </button>
                               </div>
                            </td>
                         </tr>
                       ))}
                    </tbody>
                 </table>
                 {accounts.length === 0 && (
                   <div className="p-12 text-center text-slate-400 text-xs font-black uppercase tracking-widest">Belum ada akun terdaftar</div>
                 )}
              </div>
           </div>
        </div>
      </div>

      {/* Modern Dialogs */}
      <AnimatePresence>
        {editingAcc && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-white rounded-[2rem] shadow-2xl w-full max-w-sm overflow-hidden"
            >
              <div className="p-6 bg-slate-900 text-white flex items-center justify-between">
                <h3 className="text-xs font-black uppercase tracking-widest">Koreksi Saldo</h3>
                <button onClick={() => setEditingAcc(null)} className="text-slate-500 hover:text-white transition-all"><X size={16} /></button>
              </div>

              <form onSubmit={handleEditBalance} className="p-6 space-y-4">
                <div className="space-y-4">
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Set Saldo Real {editingAcc.name}</label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-slate-400 text-xs">Rp</span>
                      <input
                        type="text"
                        autoFocus
                        value={editedBalance}
                        onChange={(e) => setEditedBalance(formatNumber(e.target.value))}
                        className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all font-black text-xl text-blue-600"
                      />
                    </div>
                    <p className="mt-2 text-[9px] text-slate-400 font-bold leading-tight uppercase">Sistem akan otomatis mencatat selisih sebagai transaksi PENYESUAIAN.</p>
                  </div>
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex-1 bg-blue-600 hover:bg-blue-500 text-white py-3 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all shadow-lg shadow-blue-200"
                  >
                    {loading ? 'MENYIMPAN...' : 'SIMPAN SALDO'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {deletingAcc && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-white rounded-[2rem] shadow-2xl w-full max-w-sm overflow-hidden"
            >
              <div className="p-8 text-center">
                <div className="w-12 h-12 bg-red-50 text-red-600 rounded-2xl flex items-center justify-center mx-auto mb-6 transform -rotate-12">
                  <Trash2 size={24} />
                </div>
                <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight mb-2">Hapus Akun?</h3>
                <p className="text-[11px] text-slate-500 font-bold uppercase tracking-tight mb-8">
                  Menghapus <span className="text-red-500">{deletingAcc.name}</span> akan menghilangkan referensi akun namun riwayat tetap ada.
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={() => setDeletingAcc(null)}
                    className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-black text-[10px] uppercase tracking-widest"
                  >
                    BATAL
                  </button>
                  <button
                    onClick={handleDeleteAccount}
                    disabled={loading}
                    className="flex-1 bg-red-600 hover:bg-red-500 text-white px-4 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all disabled:opacity-50"
                  >
                    {loading ? '...' : 'YA, HAPUS'}
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
