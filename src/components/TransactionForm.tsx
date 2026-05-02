import { useState, FormEvent } from 'react';
import { db } from '../lib/firebase';
import { collection, addDoc, doc, updateDoc, serverTimestamp, increment, writeBatch } from 'firebase/firestore';
import { User } from 'firebase/auth';
import { UserProfile, TransactionType, Account } from '../types';
import { PlusCircle, Wallet, ArrowDownCircle, ArrowUpCircle, Smartphone, Receipt, Info, Gamepad2, Repeat, ArrowRightCircle, TrendingDown } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { clsx } from 'clsx';

interface TransactionFormProps {
  user: User;
  profile: UserProfile;
  accounts: Account[];
  onComplete: () => void;
}

export default function TransactionForm({ user, profile, accounts, onComplete }: TransactionFormProps) {
  const [type, setType] = useState<TransactionType>('tarik_tunai');
  const [selectedAccountId, setSelectedAccountId] = useState(accounts[0]?.id || '');
  const [toAccountId, setToAccountId] = useState(accounts[1]?.id || '');
  const [selectedCashAccountId, setSelectedCashAccountId] = useState(accounts.find(a => a.type === 'cash')?.id || accounts[0]?.id || '');
  const [bankType, setBankType] = useState<'same' | 'other'>('same');
  const [adjustmentMode, setAdjustmentMode] = useState<'add' | 'subtract'>('subtract');
  const [amount, setAmount] = useState('');
  const [fee, setFee] = useState('');
  const [feeExternal, setFeeExternal] = useState('');
  const [feeMethod, setFeeMethod] = useState<'added' | 'deducted'>('added');
  const [note, setNote] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [paymentStatus, setPaymentStatus] = useState<'pending' | 'success' | 'failed'>('success');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!amount || !selectedAccountId) return;
    if (type === 'transfer' && (!toAccountId || selectedAccountId === toAccountId)) {
      alert('Pilih rekening tujuan yang berbeda.');
      return;
    }

    setLoading(true);
    try {
      const amt = parseFloat(amount) || 0;
      const f = parseFloat(fee) || 0;
      const fe = parseFloat(feeExternal) || 0;
      
      const batch = writeBatch(db);

      if (type === 'transfer_bank') {
        const amt = parseFloat(amount) || 0;
        const f = parseFloat(fee) || 0;
        const fe = parseFloat(feeExternal) || 0;
        
        // Digital Balance Decreases (We send money to customer's bank)
        // nominalSent: The amount actually sent through the bank system
        const nominalSent = feeMethod === 'added' ? amt : amt - f;
        
        // digitalImpact: Total change to our digital account balance
        // We lose the nominalSent AND the bank fee fe.
        const digitalImpact = -(nominalSent + fe);
        
        // Cash Increases (Customer pays us cash)
        const cashImpact = feeMethod === 'added' ? amt + f : amt;

        const transactionRef = doc(collection(db, 'transactions'));
        batch.set(transactionRef, {
          userId: user.uid,
          accountId: selectedAccountId,
          cashAccountId: selectedCashAccountId,
          type,
          bankType,
          amount: amt,
          fee: f,
          feeExternal: fe,
          feeMethod,
          netAmount: digitalImpact,
          note: note,
          customerName: customerName.trim() || undefined,
          referenceNumber: referenceNumber.trim() || undefined,
          paymentStatus: paymentStatus,
          timestamp: serverTimestamp(),
        });

        batch.update(doc(db, 'users', user.uid, 'accounts', selectedAccountId), {
          balance: increment(digitalImpact)
        });

        if (selectedCashAccountId) {
          batch.update(doc(db, 'users', user.uid, 'accounts', selectedCashAccountId), {
            balance: increment(cashImpact)
          });
        }
      } else if (type === 'transfer') {
        const transactionRef = doc(collection(db, 'transactions'));
        
        // Internal transfer between own accounts
        // amt is the nominal we want to move.
        // fe is the bank fee for moving it.
        // f (internal fee) should ideally be 0, but if set, it's treated as a cost/loss.
        
        const sourceImpact = feeMethod === 'added' ? -(amt + f + fe) : -amt;
        const targetImpact = feeMethod === 'added' ? amt : amt - f - fe;

        batch.set(transactionRef, {
          userId: user.uid,
          accountId: selectedAccountId,
          toAccountId: toAccountId,
          type,
          amount: amt,
          fee: f,
          feeExternal: fe,
          feeMethod,
          netAmount: sourceImpact, 
          note: note,
          customerName: customerName.trim() || undefined,
          referenceNumber: referenceNumber.trim() || undefined,
          paymentStatus: paymentStatus,
          timestamp: serverTimestamp(),
        });

        // Subtract from source
        batch.update(doc(db, 'users', user.uid, 'accounts', selectedAccountId), {
          balance: increment(sourceImpact)
        });

        // Add to destination
        batch.update(doc(db, 'users', user.uid, 'accounts', toAccountId), {
          balance: increment(targetImpact)
        });
      } else if (type === 'expense') {
        const transactionRef = doc(collection(db, 'transactions'));
        batch.set(transactionRef, {
          userId: user.uid,
          accountId: selectedAccountId,
          type,
          amount: amt,
          fee: 0,
          feeExternal: 0,
          netAmount: -amt,
          note: note,
          customerName: customerName.trim() || undefined,
          referenceNumber: referenceNumber.trim() || undefined,
          paymentStatus: paymentStatus,
          timestamp: serverTimestamp(),
        });

        batch.update(doc(db, 'users', user.uid, 'accounts', selectedAccountId), {
          balance: increment(-amt)
        });
      } else if (type === 'adjustment') {
        const transactionRef = doc(collection(db, 'transactions'));
        const impact = adjustmentMode === 'add' ? amt : -amt;
        
        batch.set(transactionRef, {
          userId: user.uid,
          accountId: selectedAccountId,
          type,
          amount: amt,
          fee: 0,
          feeExternal: 0,
          netAmount: impact,
          note: note || (adjustmentMode === 'add' ? 'Penyesuaian (+) ' : 'Penyesuaian (-) '),
          customerName: customerName.trim() || undefined,
          referenceNumber: referenceNumber.trim() || undefined,
          paymentStatus: paymentStatus,
          timestamp: serverTimestamp(),
        });

        batch.update(doc(db, 'users', user.uid, 'accounts', selectedAccountId), {
          balance: increment(impact)
        });
      } else {
        // Normal Transaction
        let netImpact = 0;
        let cashImpact = 0;

        if (type === 'tarik_tunai') {
          // Digital Balance Increases (Reimbursement)
          // If 'added': Customer transfers Amt + Fee. Our digital increases (Amt + Fee) - feeExternal.
          // If 'deducted': Customer transfers Amt. Our digital increases Amt - feeExternal.
          netImpact = (feeMethod === 'added' ? amt + f : amt) - fe;
          
          // Physical Cash Decreases
          // If 'added': We give full Amt cash.
          // If 'deducted': We give Amt - Fee cash.
          cashImpact = feeMethod === 'added' ? -amt : -(amt - f);
        } else {
          // Setor / Topup / PPOB
          // Digital Balance Decreases (We send money)
          // If 'added': We send Amt. Digital decreases Amt + feeExternal.
          // If 'deducted': We send Amt - Fee. Digital decreases (Amt - Fee) + feeExternal.
          netImpact = feeMethod === 'added' ? -(amt + fe) : -(amt - f + fe);

          // Physical Cash Increases (Customer pays us)
          // If 'added': Customer pays Amt + Fee.
          // If 'deducted': Customer pays Amt.
          cashImpact = feeMethod === 'added' ? amt + f : amt;
        }

        const transactionRef = doc(collection(db, 'transactions'));
        batch.set(transactionRef, {
          userId: user.uid,
          accountId: selectedAccountId,
          cashAccountId: selectedCashAccountId,
          type,
          amount: amt,
          fee: f,
          feeExternal: fe,
          feeMethod,
          netAmount: netImpact,
          note: note,
          customerName: customerName.trim() || undefined,
          referenceNumber: referenceNumber.trim() || undefined,
          paymentStatus: paymentStatus,
          timestamp: serverTimestamp(),
        });

        // Update Digital Account
        batch.update(doc(db, 'users', user.uid, 'accounts', selectedAccountId), {
          balance: increment(netImpact)
        });

        // Update Cash Account
        if (selectedCashAccountId) {
          batch.update(doc(db, 'users', user.uid, 'accounts', selectedCashAccountId), {
            balance: increment(cashImpact)
          });
        }
      }

      await batch.commit();
      onComplete();
    } catch (err) {
      console.error(err);
      alert('Gagal menyimpan transaksi.');
    } finally {
      setLoading(false);
    }
  };

  const types = [
    { id: 'tarik_tunai', label: 'Tarik Tunai', icon: ArrowUpCircle, color: 'text-green-600', bg: 'bg-green-50', border: 'border-green-200' },
    { id: 'setor_tunai', label: 'Setor Tunai', icon: ArrowDownCircle, color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-200' },
    { id: 'topup', label: 'Topup / E-Wallet', icon: Smartphone, color: 'text-purple-600', bg: 'bg-purple-50', border: 'border-purple-200' },
    { id: 'ppob', label: 'PPOB / Tagihan', icon: Receipt, color: 'text-orange-600', bg: 'bg-orange-50', border: 'border-orange-200' },
    { id: 'topup_game', label: 'Topup Game', icon: Gamepad2, color: 'text-pink-600', bg: 'bg-pink-50', border: 'border-pink-200' },
    { id: 'transfer_bank', label: 'Kirim Uang', icon: ArrowRightCircle, color: 'text-indigo-600', bg: 'bg-indigo-50', border: 'border-indigo-200' },
    { id: 'expense', label: 'Pengeluaran', icon: TrendingDown, color: 'text-red-600', bg: 'bg-red-50', border: 'border-red-200' },
    { id: 'adjustment', label: 'Penyesuaian', icon: Info, color: 'text-slate-600', bg: 'bg-slate-50', border: 'border-slate-200' },
    { id: 'transfer', label: 'Pindah Saldo', icon: Repeat, color: 'text-slate-600', bg: 'bg-slate-50', border: 'border-slate-200' },
  ];

  const cashAccounts = accounts.filter(a => a.type === 'cash');
  const digitalAccounts = accounts.filter(a => a.type !== 'cash');

  return (
    <div className="max-w-2xl mx-auto pb-10">
      <div className="mb-8">
        <h2 className="text-3xl font-bold text-slate-800 mb-2">Simpan Transaksi</h2>
        <p className="text-slate-500">Pilih jenis layanan dan rekening yang digunakan.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Type Selector */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {types.map((t) => {
            const Icon = t.icon;
            const active = type === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setType(t.id as TransactionType)}
                className={clsx(
                  "p-5 rounded-3xl border-2 transition-all flex flex-col items-center gap-3 text-center group",
                  active 
                    ? `${t.border} ${t.bg} ring-4 ring-slate-100` 
                    : "bg-white border-transparent hover:border-slate-200 text-slate-500"
                )}
              >
                <div className={clsx(
                  "w-12 h-12 rounded-2xl flex items-center justify-center transition-transform group-hover:scale-110",
                  active ? "bg-white shadow-sm" : "bg-slate-100"
                )}>
                  <Icon className={clsx("w-7 h-7", active ? t.color : "text-slate-400")} />
                </div>
                <span className={clsx("text-sm font-bold", active ? "text-slate-800" : "")}>{t.label}</span>
              </button>
            )
          })}
        </div>

        {/* Input Fields */}
        <motion.div 
          layout
          className="bg-white rounded-3xl shadow-xl shadow-slate-200 border border-slate-100 p-8 space-y-6"
        >
          {/* Account Selector */}
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                {type === 'transfer' ? 'Pindah Dari (Asal)' : type === 'expense' || type === 'adjustment' ? 'Rekening Sumber' : 'Gunakan Rekening Digital'}
              </label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {(type === 'expense' || type === 'adjustment' ? accounts : digitalAccounts).map(acc => (
                  <button
                    key={acc.id}
                    type="button"
                    disabled={type === 'transfer' && acc.id === toAccountId}
                    onClick={() => setSelectedAccountId(acc.id)}
                    className={clsx(
                      "flex flex-col p-4 rounded-2xl border-2 transition-all text-left",
                      selectedAccountId === acc.id 
                        ? "border-blue-600 bg-blue-50" 
                        : "border-slate-100 bg-slate-50 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed"
                    )}
                  >
                    <span className={clsx("font-bold text-sm", selectedAccountId === acc.id ? "text-blue-700" : "text-slate-700")}>{acc.name}</span>
                    <span className="text-[10px] uppercase font-bold text-slate-400 mt-1">Saldo: Rp{acc.balance.toLocaleString('id-ID')}</span>
                  </button>
                ))}
              </div>
            </div>

            {type !== 'transfer' && type !== 'transfer_bank' && type !== 'expense' && type !== 'adjustment' && (
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Pilih Rekening Tunai (Laci/Cash)</label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {cashAccounts.map(acc => (
                    <button
                      key={acc.id}
                      type="button"
                      onClick={() => setSelectedCashAccountId(acc.id)}
                      className={clsx(
                        "flex flex-col p-4 rounded-2xl border-2 transition-all text-left",
                        selectedCashAccountId === acc.id 
                          ? "border-slate-800 bg-slate-100" 
                          : "border-slate-100 bg-slate-50 hover:bg-slate-100"
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <Wallet size={14} className="text-slate-400" />
                        <span className={clsx("font-bold text-sm", selectedCashAccountId === acc.id ? "text-slate-900" : "text-slate-700")}>{acc.name}</span>
                      </div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 mt-1">Saldo: Rp{acc.balance.toLocaleString('id-ID')}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {type === 'transfer_bank' && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="space-y-6"
              >
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Tujuan Bank</label>
                  <div className="flex p-1 bg-slate-100 rounded-2xl w-full">
                    <button
                      type="button"
                      onClick={() => setBankType('same')}
                      className={clsx(
                        "flex-1 py-3 text-sm font-bold rounded-xl transition-all",
                        bankType === 'same' ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500"
                      )}
                    >
                      Sama Bank
                    </button>
                    <button
                      type="button"
                      onClick={() => setBankType('other')}
                      className={clsx(
                        "flex-1 py-3 text-sm font-bold rounded-xl transition-all",
                        bankType === 'other' ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500"
                      )}
                    >
                      Beda Bank
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Rekening Penerimaan Cash</label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {cashAccounts.map(acc => (
                      <button
                        key={acc.id}
                        type="button"
                        onClick={() => setSelectedCashAccountId(acc.id)}
                        className={clsx(
                          "flex flex-col p-4 rounded-2xl border-2 transition-all text-left",
                          selectedCashAccountId === acc.id 
                            ? "border-slate-800 bg-slate-100" 
                            : "border-slate-100 bg-slate-50 hover:bg-slate-100"
                        )}
                      >
                        <div className="flex items-center gap-2">
                          <Wallet size={14} className="text-slate-400" />
                          <span className={clsx("font-bold text-sm", selectedCashAccountId === acc.id ? "text-slate-900" : "text-slate-700")}>{acc.name}</span>
                        </div>
                        <span className="text-[10px] uppercase font-bold text-slate-400 mt-1">Saldo: Rp{acc.balance.toLocaleString('id-ID')}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}

            {type === 'transfer' && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
              >
                <label className="block text-sm font-semibold text-slate-700 mb-2 text-blue-600">Pindah Ke (Tujuan)</label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {accounts.map(acc => (
                    <button
                      key={acc.id}
                      type="button"
                      disabled={acc.id === selectedAccountId}
                      onClick={() => setToAccountId(acc.id)}
                      className={clsx(
                        "flex flex-col p-4 rounded-2xl border-2 transition-all text-left",
                        toAccountId === acc.id 
                          ? "border-green-600 bg-green-50" 
                          : "border-slate-100 bg-slate-50 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed"
                      )}
                    >
                      <span className={clsx("font-bold text-sm", toAccountId === acc.id ? "text-green-700" : "text-slate-700")}>{acc.name}</span>
                      <span className="text-[10px] uppercase font-bold text-slate-400 mt-1">Saldo: Rp{acc.balance.toLocaleString('id-ID')}</span>
                    </button>
                  ))}
                </div>
              </motion.div>
            )}
          </div>

          {type === 'adjustment' && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-4 bg-slate-50 rounded-2xl border border-slate-200"
            >
              <label className="block text-sm font-semibold text-slate-700 mb-3 text-center">Tindakan Penyesuaian</label>
              <div className="flex p-1 bg-slate-200 rounded-xl">
                <button
                  type="button"
                  onClick={() => setAdjustmentMode('add')}
                  className={clsx(
                    "flex-1 py-3 text-sm font-bold rounded-lg transition-all flex items-center justify-center gap-2",
                    adjustmentMode === 'add' ? "bg-white text-green-600 shadow-sm" : "text-slate-500"
                  )}
                >
                  <ArrowDownCircle size={18} />
                  Tambah (+)
                </button>
                <button
                  type="button"
                  onClick={() => setAdjustmentMode('subtract')}
                  className={clsx(
                    "flex-1 py-3 text-sm font-bold rounded-lg transition-all flex items-center justify-center gap-2",
                    adjustmentMode === 'subtract' ? "bg-white text-red-600 shadow-sm" : "text-slate-500"
                  )}
                >
                  <ArrowUpCircle size={18} />
                  Kurangi (-)
                </button>
              </div>
            </motion.div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Jumlah Nominal</label>
              <div className="relative">
                <span className="absolute left-5 top-1/2 -translate-y-1/2 font-bold text-slate-400">Rp</span>
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full pl-12 pr-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none transition-all font-bold text-2xl text-slate-800"
                  placeholder="0"
                  required
                />
              </div>
            </div>

            <div className={clsx("grid grid-cols-1 gap-4", (type === 'expense' || type === 'adjustment') && "opacity-20 pointer-events-none")}>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2 leading-none">Metode Admin</label>
                <div className="flex p-1 bg-slate-100 rounded-2xl">
                  <button
                    type="button"
                    onClick={() => setFeeMethod('added')}
                    className={clsx(
                      "flex-1 py-2 text-xs font-bold rounded-xl transition-all",
                      feeMethod === 'added' ? "bg-white text-blue-600 shadow-sm" : "text-slate-500"
                    )}
                  >
                    Dari Pelanggan
                  </button>
                  <button
                    type="button"
                    onClick={() => setFeeMethod('deducted')}
                    className={clsx(
                      "flex-1 py-2 text-xs font-bold rounded-xl transition-all",
                      feeMethod === 'deducted' ? "bg-white text-blue-600 shadow-sm" : "text-slate-500"
                    )}
                  >
                    Potong Saldo
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1 leading-none">Admin (Biaya)</label>
                <div className="relative">
                  <span className="absolute left-5 top-1/2 -translate-y-1/2 font-bold text-slate-400">Rp</span>
                  <input
                    type="number"
                    value={fee}
                    onChange={(e) => setFee(e.target.value)}
                    className="w-full pl-12 pr-5 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none transition-all font-bold text-lg text-blue-600"
                    placeholder="Fee Anda"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1 leading-none">Admin Pihak Ke-3</label>
                <div className="relative">
                  <span className="absolute left-5 top-1/2 -translate-y-1/2 font-bold text-slate-400">Rp</span>
                  <input
                    type="number"
                    value={feeExternal}
                    onChange={(e) => setFeeExternal(e.target.value)}
                    className="w-full pl-12 pr-5 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none transition-all font-bold text-lg text-red-600"
                    placeholder="Fee Bank/Aplikasi"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Nama Pelanggan</label>
              <input
                type="text"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none transition-all font-medium"
                placeholder="Contoh: Budi Santoso"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">No. Referensi / ID</label>
              <input
                type="text"
                value={referenceNumber}
                onChange={(e) => setReferenceNumber(e.target.value)}
                className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none transition-all font-medium"
                placeholder="Nomor STR atau ID Pelanggan"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-3">Status Pembayaran</label>
            <div className="flex p-1 bg-slate-100 rounded-2xl">
              {(['success', 'pending', 'failed'] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setPaymentStatus(s)}
                  className={clsx(
                    "flex-1 py-3 text-sm font-bold rounded-xl transition-all capitalize",
                    paymentStatus === s 
                      ? s === 'success' ? "bg-white text-green-600 shadow-sm" : 
                        s === 'pending' ? "bg-white text-orange-600 shadow-sm" : 
                        "bg-white text-red-600 shadow-sm"
                      : "text-slate-500"
                  )}
                >
                  {s === 'success' ? 'Berhasil' : s === 'pending' ? 'Pending' : 'Gagal'}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">Catatan / Keterangan</label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none transition-all font-medium min-h-[80px]"
              placeholder="Sebutkan detail atau nama pelanggan..."
            />
          </div>

          {/* Info Card */}
          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 flex items-start gap-4">
             <Info className="shrink-0 text-slate-400 mt-1" size={18} />
             <div className="text-sm text-slate-500 font-medium leading-relaxed">
               <div className="mb-2 pb-2 border-b border-slate-200">
                  <span className="font-bold text-slate-700">Laba Anda: </span>
                  <span className="text-blue-600 font-bold">Rp{( (parseFloat(fee)||0) - (parseFloat(feeExternal)||0) ).toLocaleString('id-ID')}</span>
               </div>
               {type === 'tarik_tunai' 
                ? (feeMethod === 'added'
                    ? `TARIK TUNAI: Pelanggan Bayar Rp${(parseFloat(amount)||0) + (parseFloat(fee)||0)} digital. Anda Beri Cash Rp${amount}. Digital Anda (+) Rp${(parseFloat(amount)||0) + (parseFloat(fee)||0) - (parseFloat(feeExternal)||0)}.`
                    : `TARIK TUNAI: Pelanggan Bayar Rp${amount} digital. Anda Beri Cash Rp${(parseFloat(amount)||0) - (parseFloat(fee)||0)}. Digital Anda (+) Rp${(parseFloat(amount)||0) - (parseFloat(feeExternal)||0)}.`)
                : type === 'transfer_bank'
                ? (feeMethod === 'added'
                    ? `KIRIM UANG (${bankType === 'same' ? 'Sama Bank' : 'Beda Bank'}): Pelanggan Bayar Rp${(parseFloat(amount)||0) + (parseFloat(fee)||0)} cash. Anda Kirim Rp${amount} digital. Digital Anda (-) Rp${(parseFloat(amount)||0) + (parseFloat(feeExternal)||0)} (Nominal + Biaya Bank).`
                    : `KIRIM UANG (${bankType === 'same' ? 'Sama Bank' : 'Beda Bank'}): Pelanggan Bayar Rp${amount} cash. Anda Kirim Rp${(parseFloat(amount)||0) - (parseFloat(fee)||0)} digital. Digital Anda (-) Rp${(parseFloat(amount)||0) - (parseFloat(fee)||0) + (parseFloat(feeExternal)||0)} (Terpotong Laba & Biaya Bank).`)
                : type === 'transfer'
                ? (feeMethod === 'added'
                    ? `PINDAH SALDO: Rekening Asal berkurang Rp${(parseFloat(amount)||0) + (parseFloat(fee)||0) + (parseFloat(feeExternal)||0)} (Nominal + Biaya Bank). Rekening Tujuan terima Rp${amount}.`
                    : `PINDAH SALDO: Rekening Asal berkurang Rp${amount}. Rekening Tujuan terima Rp${(parseFloat(amount)||0) - (parseFloat(fee)||0) - (parseFloat(feeExternal)||0)} (Terpotong Biaya).`)
                : type === 'adjustment'
                ? `PENYESUAIAN: Saldo ${accounts.find(a => a.id === selectedAccountId)?.name} ${adjustmentMode === 'add' ? 'bertambah' : 'berkurang'} Rp${amount}.`
                : (feeMethod === 'added'
                    ? `SETOR/TOPUP: Pelanggan Bayar Rp${(parseFloat(amount)||0) + (parseFloat(fee)||0)} cash. Anda Kirim Rp${amount} digital. Digital Anda (-) Rp${(parseFloat(amount)||0) + (parseFloat(feeExternal)||0)}.`
                    : `SETOR/TOPUP: Pelanggan Bayar Rp${amount} cash. Anda Kirim Rp${(parseFloat(amount)||0) - (parseFloat(fee)||0)} digital. Digital Anda (-) Rp${(parseFloat(amount)||0) - (parseFloat(fee)||0) + (parseFloat(feeExternal)||0)}.`)}
             </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 bg-blue-600 hover:bg-blue-700 text-white py-5 rounded-2xl transition-all shadow-lg shadow-blue-100 font-bold text-lg disabled:opacity-50"
          >
            {loading ? (
               <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <PlusCircle size={22} />
                <span>Simpan Transaksi Sekarang</span>
              </>
            )}
          </button>
        </motion.div>
      </form>
    </div>
  );
}
