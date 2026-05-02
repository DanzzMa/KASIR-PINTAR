import { useState, FormEvent } from 'react';
import { db } from '../lib/firebase';
import { doc, setDoc, collection, addDoc, deleteDoc } from 'firebase/firestore';
import { User } from 'firebase/auth';
import { UserProfile, Account, AccountType } from '../types';
import { Save, Wallet, AlertCircle, Plus, Trash2, CreditCard, Landmark, Smartphone } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { clsx } from 'clsx';

interface SettingsProps {
  user: User;
  profile?: UserProfile | null;
  accounts: Account[];
  isInitialSetup: boolean;
}

export default function Settings({ user, profile, accounts, isInitialSetup }: SettingsProps) {
  const [displayName, setDisplayName] = useState(profile?.displayName || user.displayName || '');
  const [newAccName, setNewAccName] = useState('');
  const [newAccType, setNewAccType] = useState<AccountType>('cash');
  const [newAccBalance, setNewAccBalance] = useState('0');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSaveProfile = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setSuccess(false);

    try {
      const data = {
        email: user.email,
        displayName: displayName,
        createdAt: profile?.createdAt || new Date().toISOString(),
      };

      await setDoc(doc(db, 'users', user.uid), data);
      
      // If initial setup and no accounts, prompt to add at least one
      if (isInitialSetup && accounts.length === 0) {
        alert('Silakan tambahkan minimal satu rekening/sumber saldo.');
      } else {
        setSuccess(true);
        setTimeout(() => setSuccess(false), 3000);
      }
    } catch (err) {
      console.error(err);
      alert('Gagal menyimpan profil.');
    } finally {
      setLoading(false);
    }
  };

  const handleAddAccount = async (e: FormEvent) => {
    e.preventDefault();
    if (!newAccName) return;

    setLoading(true);
    try {
      const bal = parseFloat(newAccBalance) || 0;
      const accountData = {
        userId: user.uid,
        name: newAccName,
        type: newAccType,
        balance: bal,
        initialBalance: bal,
      };

      await addDoc(collection(db, 'users', user.uid, 'accounts'), accountData);
      setNewAccName('');
      setNewAccBalance('0');
    } catch (err) {
      console.error(err);
      alert('Gagal menambahkan rekening.');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAccount = async (accId: string) => {
    if (!confirm('Hapus rekening ini? Ini tidak menghapus riwayat transaksi.')) return;
    try {
      await deleteDoc(doc(db, 'users', user.uid, 'accounts', accId));
    } catch (err) {
      console.error(err);
    }
  };

  const accTypes: {id: AccountType, label: string, icon: any}[] = [
    { id: 'cash', label: 'Tunai / Cash', icon: Wallet },
    { id: 'bank', label: 'Bank / BRI / BCA', icon: Landmark },
    { id: 'ewallet', label: 'E-Wallet / DANA', icon: Smartphone },
    { id: 'other', label: 'Lainnya', icon: CreditCard },
  ];

  return (
    <div className="max-w-4xl mx-auto pb-10">
      <div className="mb-8">
        <h2 className="text-3xl font-bold text-slate-800 mb-2">
          {isInitialSetup ? 'Lengkapi Profil Bisnis' : 'Pengaturan & Rekening'}
        </h2>
        <p className="text-slate-500">
          Atur profil dan kelola berbagai sumber saldo bisnis Anda.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Profile Section */}
        <div className="space-y-6">
          <motion.form 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            onSubmit={handleSaveProfile} 
            className="bg-white rounded-3xl shadow-xl shadow-slate-200 border border-slate-100 p-8 space-y-6"
          >
            <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
               <Save size={20} className="text-blue-600" />
               Informasi Profil
            </h3>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Nama Bisnis / Nama Anda</label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none transition-all font-medium"
                placeholder="Contoh: Toko Berkah"
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white py-4 rounded-2xl transition-all shadow-lg shadow-blue-100 font-bold disabled:opacity-50"
            >
              Simpan Profil
            </button>
            {success && <p className="text-center text-green-600 text-sm font-bold">Berhasil disimpan!</p>}
          </motion.form>

          {/* Account List */}
          <div className="bg-white rounded-3xl shadow-xl shadow-slate-200 border border-slate-100 p-8">
            <h3 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2">
               <Wallet size={20} className="text-green-600" />
               Daftar Rekening / Saldo
            </h3>
            
            <div className="space-y-4">
              {accounts.length === 0 ? (
                <div className="text-center py-6 text-slate-400 font-medium bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                   Belum ada rekening ditambahkan.
                </div>
              ) : (
                <AnimatePresence>
                  {accounts.map(acc => (
                    <motion.div 
                      key={acc.id}
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      className="flex items-center justify-between p-4 bg-slate-50 border border-slate-200 rounded-2xl group"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-blue-600 shadow-sm">
                           {(() => {
                             const Icon = accTypes.find(t => t.id === acc.type)?.icon || Wallet;
                             return <Icon size={20} />;
                           })()}
                        </div>
                        <div>
                          <p className="font-bold text-slate-800">{acc.name}</p>
                          <p className="text-xs text-slate-400 font-bold uppercase tracking-tight">{acc.type}</p>
                        </div>
                      </div>
                      <div className="text-right flex items-center gap-4">
                        <div>
                          <p className="font-bold text-slate-900">Rp{acc.balance.toLocaleString('id-ID')}</p>
                          <p className="text-[10px] text-slate-400">Modal: Rp{acc.initialBalance.toLocaleString('id-ID')}</p>
                        </div>
                        {!isInitialSetup && (
                          <button 
                            onClick={() => handleDeleteAccount(acc.id)}
                            className="p-2 text-slate-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                          >
                            <Trash2 size={18} />
                          </button>
                        )}
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              )}
            </div>
          </div>
        </div>

        {/* Add Account Form */}
        <motion.div 
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="bg-white rounded-3xl shadow-xl shadow-slate-200 border border-slate-100 p-8 flex flex-col"
        >
          <h3 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2">
             <Plus size={24} className="text-blue-600" />
             Tambah Rekening Baru
          </h3>

          <form onSubmit={handleAddAccount} className="space-y-6">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Nama Rekening / Wallet</label>
              <input
                type="text"
                value={newAccName}
                onChange={(e) => setNewAccName(e.target.value)}
                className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none transition-all font-medium"
                placeholder="Contoh: DANA, BRI Bisnis, Cash Laci"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Jenis Rekening</label>
              <div className="grid grid-cols-2 gap-3">
                {accTypes.map(t => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setNewAccType(t.id)}
                    className={clsx(
                      "flex flex-col items-center gap-2 p-4 rounded-2xl border-2 transition-all",
                      newAccType === t.id 
                        ? "border-blue-600 bg-blue-50 text-blue-600" 
                        : "border-transparent bg-slate-50 text-slate-500"
                    )}
                  >
                    <t.icon size={20} />
                    <span className="text-xs font-bold">{t.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Saldo Awal (Modal)</label>
              <div className="relative">
                <span className="absolute left-5 top-1/2 -translate-y-1/2 font-bold text-slate-400">Rp</span>
                <input
                  type="number"
                  value={newAccBalance}
                  onChange={(e) => setNewAccBalance(e.target.value)}
                  className="w-full pl-12 pr-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none transition-all font-bold text-lg"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-3 bg-green-600 hover:bg-green-700 text-white py-4 rounded-2xl transition-all shadow-lg shadow-green-100 font-bold mt-auto"
            >
              <Plus size={20} />
              <span>Tambahkan Rekening</span>
            </button>
          </form>

          {isInitialSetup && (
            <div className="mt-8 p-4 bg-yellow-50 text-yellow-700 rounded-2xl border border-yellow-100 flex gap-3">
              <AlertCircle className="shrink-0 mt-0.5" size={18} />
              <p className="text-xs font-medium leading-relaxed">
                Tambahkan minimal satu rekening agar Anda bisa mulai mencatat transaksi. Anda bisa menambahkan Rekening Bank, E-Wallet, atau sekadar dompet tunai.
              </p>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}
