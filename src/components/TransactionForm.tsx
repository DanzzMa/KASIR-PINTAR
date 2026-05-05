import { useState, FormEvent, useEffect } from 'react';
import { TransactionType, Account } from '../types';
import { PlusCircle, Wallet, ArrowDownCircle, ArrowUpCircle, Smartphone, Receipt, Info, Gamepad2, Repeat, ArrowRightCircle, TrendingDown, ChevronDown } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { clsx } from 'clsx';
import { formatNumber, getCleanNumber, formatCurrency } from '../lib/format';

interface TransactionFormProps {
  user: any;
  accounts: Account[];
  onComplete: () => void;
}

export default function TransactionForm({ user, accounts, onComplete }: TransactionFormProps) {
  const [type, setType] = useState<TransactionType>('tarik_tunai');
  const [selectedAccountId, setSelectedAccountId] = useState(accounts[0]?.id || '');
  const [toAccountId, setToAccountId] = useState(accounts[1]?.id || '');

  const [selectedCashAccountId, setSelectedCashAccountId] = useState('');
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

  useEffect(() => {
    if (accounts.length > 0) {
      if (!selectedAccountId) setSelectedAccountId(accounts[0].id);
      if (!toAccountId && accounts.length > 1) setToAccountId(accounts[1].id);
      
      const cashAcc = accounts.find(a => a.type === 'cash');
      if (cashAcc && !selectedCashAccountId) {
        setSelectedCashAccountId(cashAcc.id);
      } else if (!selectedCashAccountId) {
        setSelectedCashAccountId(accounts[0].id);
      }
    }
  }, [accounts]);

  const [isTypeDropdownOpen, setIsTypeDropdownOpen] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!amount || !selectedAccountId || !user) return;
    
    // For many transaction types, we really want a cash account selected
    const needsCashAccount = ['tarik_tunai', 'setor_tunai', 'topup', 'ppob', 'topup_game', 'transfer_bank'].includes(type);
    if (needsCashAccount && !selectedCashAccountId) {
      alert('Harap pilih Rekening Tunai (Laci/Cash).');
      return;
    }

    setLoading(true);
    try {
      const amt = parseFloat(getCleanNumber(amount)) || 0;
      const f = parseFloat(getCleanNumber(fee)) || 0;
      const fe = parseFloat(getCleanNumber(feeExternal)) || 0;
      
      const profit = type === 'expense' ? -amt : f - fe;
      let netImpact = 0;
      let cashImpact = 0;

      if (type === 'transfer_bank') {
        const nominalSent = feeMethod === 'added' ? amt : amt - f;
        netImpact = -(nominalSent + fe);
        cashImpact = feeMethod === 'added' ? amt + f : amt;
      } else if (type === 'transfer') {
        netImpact = feeMethod === 'added' ? -(amt + f + fe) : -amt;
      } else if (type === 'expense') {
        netImpact = -amt;
      } else if (type === 'adjustment') {
        netImpact = adjustmentMode === 'add' ? amt : -amt;
      } else if (type === 'tarik_tunai') {
        netImpact = amt - fe;
        cashImpact = f - amt;
      } else {
        netImpact = feeMethod === 'added' ? -(amt + fe) : -(amt - f + fe);
        cashImpact = feeMethod === 'added' ? amt + f : amt;
      }

      // 1. Update Digital Account
      const digitalAcc = accounts.find(a => a.id === selectedAccountId);
      if (digitalAcc) {
        await fetch('/api/accounts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...digitalAcc, balance: digitalAcc.balance + netImpact })
        });
      }

      // 2. Update Cash Account if needed
      const cashAcc = needsCashAccount && selectedCashAccountId ? accounts.find(a => a.id === selectedCashAccountId) : null;
      if (cashAcc) {
        await fetch('/api/accounts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...cashAcc, balance: cashAcc.balance + cashImpact })
        });
      }

      // 3. Update To Account if transfer
      const toAcc = type === "transfer" && toAccountId ? accounts.find(a => a.id === toAccountId) : null;
      if (toAcc) {
        await fetch('/api/accounts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...toAcc, balance: toAcc.balance + amt })
        });
      }

      // 4. Save Transaction
      await fetch('/api/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          type,
          amount: amt,
          fee: f,
          feeExternal: fe,
          feeMethod,
          netAmount: netImpact,
          note,
          customerName,
          referenceNumber,
          paymentStatus,
          bankType,
          profit,
          accountId: selectedAccountId,
          toAccountId: type === "transfer" ? toAccountId : null,
          cashAccountId: needsCashAccount ? selectedCashAccountId : null,
        })
      });

      onComplete();
    } catch (err) {
      console.error(err);
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
    <div className="max-w-4xl mx-auto pb-10">
      <div className="mb-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-slate-900 tracking-tight">Simpan Transaksi</h2>
          <p className="text-slate-500 text-[10px] font-bold uppercase tracking-wider">Input data transaksi dengan cepat dan akurat.</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Type Selector - High Quality Custom Dropdown */}
        <div className="bg-white p-3 md:p-4 rounded-[1.5rem] border border-slate-100 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4 relative">
          <div className="flex items-center gap-3 px-2">
            <div className={clsx(
              "w-10 h-10 rounded-xl flex items-center justify-center transition-colors",
              types.find(t => t.id === type)?.bg || "bg-slate-50"
            )}>
              {(() => {
                const ActiveIcon = types.find(t => t.id === type)?.icon || Info;
                return <ActiveIcon className={clsx("w-5 h-5", types.find(t => t.id === type)?.color || "text-slate-400")} />;
              })()}
            </div>
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Tipe Transaksi</p>
              <h3 className="text-sm font-black text-slate-900 uppercase">
                {types.find(t => t.id === type)?.label}
              </h3>
            </div>
          </div>
          
          <div className="relative flex-1 max-w-xs ml-auto">
            <button
              type="button"
              onClick={() => setIsTypeDropdownOpen(!isTypeDropdownOpen)}
              className="w-full pl-4 pr-10 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all font-black text-[11px] uppercase tracking-wider flex items-center justify-between group"
            >
              <span>GANTI TIPE</span>
              <ChevronDown 
                className={clsx(
                  "text-slate-400 transition-transform duration-200",
                  isTypeDropdownOpen ? "rotate-180" : ""
                )} 
                size={16} 
              />
            </button>

            <AnimatePresence>
              {isTypeDropdownOpen && (
                <>
                  {/* Backdrop to close */}
                  <div 
                    className="fixed inset-0 z-40" 
                    onClick={() => setIsTypeDropdownOpen(false)} 
                  />
                  <motion.div
                    initial={{ opacity: 0, y: -10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -10, scale: 0.95 }}
                    transition={{ duration: 0.15, ease: "easeOut" }}
                    className="absolute right-0 top-full mt-2 w-full min-w-[240px] bg-white border border-slate-100 rounded-2xl shadow-2xl shadow-slate-200/50 z-50 p-2 overflow-hidden"
                  >
                    <div className="grid grid-cols-1 gap-1 max-h-[400px] overflow-y-auto scrollbar-hide">
                      {types.map((t) => {
                        const Icon = t.icon;
                        const active = type === t.id;
                        return (
                          <button
                            key={t.id}
                            type="button"
                            onClick={() => {
                              setType(t.id as TransactionType);
                              setIsTypeDropdownOpen(false);
                            }}
                            className={clsx(
                              "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-left",
                              active ? `${t.bg} border-l-4 ${t.border}` : "hover:bg-slate-50 border-l-4 border-transparent"
                            )}
                          >
                            <div className={clsx("w-8 h-8 rounded-lg flex items-center justify-center", active ? "bg-white" : t.bg)}>
                              <Icon size={16} className={t.color} />
                            </div>
                            <div>
                               <p className={clsx("text-xs font-black uppercase tracking-tight", active ? "text-slate-900" : "text-slate-600")}>{t.label}</p>
                               {active && <p className="text-[9px] font-bold text-slate-400">Sedang Dipilih</p>}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Main Form Area */}
          <div className="lg:col-span-8 space-y-6">
            <motion.div 
              layout
              className="bg-white rounded-[2rem] border border-slate-100 shadow-sm p-6 space-y-6"
            >
              {/* Financial Section */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 px-1">Nominal Utama</label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-slate-300">Rp</span>
                      <input
                        type="text"
                        value={amount}
                        onChange={(e) => setAmount(formatNumber(e.target.value))}
                        className="w-full pl-11 pr-5 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all font-black text-xl text-slate-900"
                        placeholder="0"
                        required
                      />
                    </div>
                  </div>

                  {type === 'adjustment' && (
                    <div className="p-1 bg-slate-100 rounded-xl flex gap-1">
                      <button
                        type="button"
                        onClick={() => setAdjustmentMode('add')}
                        className={clsx(
                          "flex-1 py-2 text-[10px] font-black rounded-lg transition-all flex items-center justify-center gap-2 uppercase",
                          adjustmentMode === 'add' ? "bg-white text-green-600 shadow-sm" : "text-slate-500"
                        )}
                      >
                        <PlusCircle size={14} /> TAMBAH (+)
                      </button>
                      <button
                        type="button"
                        onClick={() => setAdjustmentMode('subtract')}
                        className={clsx(
                          "flex-1 py-2 text-[10px] font-black rounded-lg transition-all flex items-center justify-center gap-2 uppercase",
                          adjustmentMode === 'subtract' ? "bg-white text-red-600 shadow-sm" : "text-slate-500"
                        )}
                      >
                        <TrendingDown size={14} /> KURANGI (-)
                      </button>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 px-1">Admin Anda</label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-slate-300 text-xs">Rp</span>
                        <input
                          type="text"
                          value={fee}
                          onChange={(e) => setFee(formatNumber(e.target.value))}
                          className="w-full pl-8 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all font-bold text-sm text-blue-600"
                          placeholder="0"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 px-1">Admin Bank</label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-slate-300 text-xs">Rp</span>
                        <input
                          type="text"
                          value={feeExternal}
                          onChange={(e) => setFeeExternal(formatNumber(e.target.value))}
                          className="w-full pl-8 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all font-bold text-sm text-red-600"
                          placeholder="0"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex p-1 bg-slate-100 rounded-xl">
                    <button
                      type="button"
                      onClick={() => setFeeMethod('added')}
                      className={clsx(
                        "flex-1 py-1.5 text-[10px] font-black rounded-lg transition-all uppercase",
                        feeMethod === 'added' ? "bg-white text-blue-600 shadow-sm" : "text-slate-500"
                      )}
                    >
                      Beban Pelanggan
                    </button>
                    <button
                      type="button"
                      onClick={() => setFeeMethod('deducted')}
                      className={clsx(
                        "flex-1 py-1.5 text-[10px] font-black rounded-lg transition-all uppercase",
                        feeMethod === 'deducted' ? "bg-white text-blue-600 shadow-sm" : "text-slate-500"
                      )}
                    >
                      Potong Saldo
                    </button>
                  </div>
                </div>

                <div className="space-y-4">
                  {/* Account Selection Small */}
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 px-1">
                      {type === 'transfer' ? 'Pindah Dari' : 'Rekening Digital'}
                    </label>
                    <div className="flex flex-wrap gap-2">
                       {(['expense', 'adjustment', 'transfer'].includes(type) ? accounts : digitalAccounts).map(acc => (
                        <button
                          key={acc.id}
                          type="button"
                          disabled={type === 'transfer' && acc.id === toAccountId}
                          onClick={() => setSelectedAccountId(acc.id)}
                          className={clsx(
                            "flex-1 min-w-[120px] px-3 py-2 rounded-xl border transition-all text-left group",
                            selectedAccountId === acc.id 
                              ? "border-blue-500 bg-blue-50 ring-2 ring-blue-50" 
                              : "border-slate-100 bg-white hover:bg-slate-50 disabled:opacity-30"
                          )}
                        >
                          <p className={clsx("font-bold text-[11px] truncate uppercase", selectedAccountId === acc.id ? "text-blue-700" : "text-slate-600")}>{acc.name}</p>
                          <p className="text-[9px] font-bold text-slate-400 mt-0.5">{formatCurrency(acc.balance)}</p>
                        </button>
                      ))}
                    </div>
                  </div>

                  {(type !== 'expense' && type !== 'adjustment' && type !== 'transfer') && (
                    <div>
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 px-1">Rekening Tunai (Laci)</label>
                      <div className="flex flex-wrap gap-2">
                        {cashAccounts.map(acc => (
                          <button
                            key={acc.id}
                            type="button"
                            onClick={() => setSelectedCashAccountId(acc.id)}
                            className={clsx(
                              "flex-1 min-w-[120px] px-3 py-2 rounded-xl border transition-all text-left",
                              selectedCashAccountId === acc.id 
                                ? "border-slate-800 bg-slate-50 ring-2 ring-slate-50" 
                                : "border-slate-100 bg-white hover:bg-slate-50"
                            )}
                          >
                            <p className={clsx("font-bold text-[11px] truncate uppercase", selectedCashAccountId === acc.id ? "text-slate-900" : "text-slate-600")}>{acc.name}</p>
                            <p className="text-[9px] font-bold text-slate-400 mt-0.5">{formatCurrency(acc.balance)}</p>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {type === 'transfer' && (
                    <div className="pt-2 border-t border-slate-50">
                      <label className="block text-[10px] font-black text-blue-400 uppercase tracking-widest mb-2 px-1">Tujuan Pindah</label>
                      <div className="flex flex-wrap gap-2">
                        {accounts.map(acc => (
                          <button
                            key={acc.id}
                            type="button"
                            disabled={acc.id === selectedAccountId}
                            onClick={() => setToAccountId(acc.id)}
                            className={clsx(
                              "flex-1 min-w-[120px] px-3 py-2 rounded-xl border transition-all text-left",
                              toAccountId === acc.id 
                                ? "border-green-500 bg-green-50 ring-2 ring-green-50" 
                                : "border-slate-100 bg-white hover:bg-slate-50 disabled:opacity-30"
                            )}
                          >
                            <p className={clsx("font-bold text-[11px] truncate uppercase", toAccountId === acc.id ? "text-green-700" : "text-slate-600")}>{acc.name}</p>
                            <p className="text-[9px] font-bold text-slate-400 mt-0.5">{formatCurrency(acc.balance)}</p>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {type === 'transfer_bank' && (
                <div className="p-4 bg-indigo-50/50 rounded-2xl border border-indigo-100 grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[9px] font-black text-indigo-400 uppercase tracking-widest mb-2">Tujuan Bank</label>
                    <div className="flex p-1 bg-white rounded-xl shadow-sm">
                      <button
                        type="button"
                        onClick={() => setBankType('same')}
                        className={clsx(
                          "flex-1 py-1.5 text-[10px] font-black rounded-lg transition-all uppercase",
                          bankType === 'same' ? "bg-indigo-600 text-white shadow-sm" : "text-slate-500"
                        )}
                      >Sama Bank</button>
                      <button
                        type="button"
                        onClick={() => setBankType('other')}
                        className={clsx(
                          "flex-1 py-1.5 text-[10px] font-black rounded-lg transition-all uppercase",
                          bankType === 'other' ? "bg-indigo-600 text-white shadow-sm" : "text-slate-500"
                        )}
                      >Beda Bank</button>
                    </div>
                  </div>
                </div>
              )}

              {/* Status and Customer Section */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-slate-50">
                <div className="space-y-4">
                   <div className="grid grid-cols-1 gap-4">
                      <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 px-1">Nama Customer</label>
                        <input
                          type="text"
                          value={customerName}
                          onChange={(e) => setCustomerName(e.target.value)}
                          className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all font-bold text-sm"
                          placeholder="Nama atau ID"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 px-1">No. Reff / SN</label>
                        <input
                          type="text"
                          value={referenceNumber}
                          onChange={(e) => setReferenceNumber(e.target.value)}
                          className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all font-bold text-sm"
                          placeholder="OPSIONA"
                        />
                      </div>
                   </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 px-1">Status Final</label>
                    <div className="flex p-1 bg-slate-100 rounded-xl">
                      {(['success', 'pending', 'failed'] as const).map((s) => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => setPaymentStatus(s)}
                          className={clsx(
                            "flex-1 py-2 text-[9px] font-black rounded-lg transition-all uppercase tracking-tight",
                            paymentStatus === s 
                              ? s === 'success' ? "bg-green-600 text-white shadow-sm" : 
                                s === 'pending' ? "bg-orange-500 text-white shadow-sm" : 
                                "bg-red-600 text-white shadow-sm"
                              : "text-slate-500"
                          )}
                        >
                          {s === 'success' ? 'BERHASIL' : s === 'pending' ? 'PENDING' : 'GAGAL'}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 px-1">Catatan</label>
                    <textarea
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all font-medium text-xs min-h-[60px]"
                      placeholder="Info tambahan..."
                    />
                  </div>
                </div>
              </div>
            </motion.div>
          </div>

          {/* Side Preview Area */}
          <div className="lg:col-span-4 space-y-6 lg:sticky lg:top-6">
            <div className="bg-slate-900 rounded-[2rem] p-6 text-white shadow-xl shadow-blue-900/10 border border-slate-800">
               <div className="flex items-center justify-between mb-6">
                 <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Detail Summary</p>
                 <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center">
                    <Receipt size={14} className="text-white" />
                 </div>
               </div>
               
               <div className="space-y-4 mb-8">
                  <div className="flex justify-between items-center pb-3 border-b border-white/5">
                    <span className="text-xs text-slate-400 font-bold uppercase">Laba Bersih</span>
                    <span className="text-xl font-black text-blue-400">
                      {formatCurrency(((parseFloat(getCleanNumber(fee)) || 0) - (parseFloat(getCleanNumber(feeExternal)) || 0)))}
                    </span>
                  </div>
                  
                  <div className="space-y-3">
                    <p className="text-[10px] font-black text-slate-600 uppercase">Rangkuman Alur:</p>
                    <div className="bg-white/5 p-4 rounded-2xl text-[11px] font-medium leading-relaxed text-slate-300">
                      {type === 'tarik_tunai' 
                      ? (feeMethod === 'added'
                          ? `Pelanggan bayar ${formatCurrency(parseFloat(getCleanNumber(amount))||0)} digital & ${formatCurrency(parseFloat(getCleanNumber(fee))||0)} cash. Anda beri cash ${formatCurrency(parseFloat(getCleanNumber(amount))||0)}. Saldo digital sistem bertambah ${formatCurrency((parseFloat(getCleanNumber(amount))||0) - (parseFloat(getCleanNumber(feeExternal))||0))}.`
                          : `Pelanggan bayar ${formatCurrency(parseFloat(getCleanNumber(amount))||0)} digital. Anda beri cash ${formatCurrency((parseFloat(getCleanNumber(amount))||0) - (parseFloat(getCleanNumber(fee))||0))}. Saldo digital sistem bertambah ${formatCurrency((parseFloat(getCleanNumber(amount))||0) - (parseFloat(getCleanNumber(feeExternal))||0))}.`)
                      : type === 'transfer_bank'
                      ? (feeMethod === 'added'
                          ? `Pelanggan bayar ${formatCurrency((parseFloat(getCleanNumber(amount))||0) + (parseFloat(getCleanNumber(fee))||0))} cash. Anda kirim ${formatCurrency(parseFloat(getCleanNumber(amount))||0)} bank. Saldo bank berkurang ${formatCurrency((parseFloat(getCleanNumber(amount))||0) + (parseFloat(getCleanNumber(feeExternal))||0))}.`
                          : `Pelanggan bayar ${formatCurrency(parseFloat(getCleanNumber(amount))||0)} cash. Anda kirim ${formatCurrency((parseFloat(getCleanNumber(amount))||0) - (parseFloat(getCleanNumber(fee))||0))} bank. Saldo bank berkurang ${formatCurrency((parseFloat(getCleanNumber(amount))||0) - (parseFloat(getCleanNumber(fee))||0) + (parseFloat(getCleanNumber(feeExternal))||0))}.`)
                      : type === 'transfer'
                      ? `Rekening Asal berkurang ${formatCurrency((parseFloat(getCleanNumber(amount))||0) + (parseFloat(getCleanNumber(fee))||0) + (parseFloat(getCleanNumber(feeExternal))||0))}. Rekening Tujuan bertambah ${formatCurrency(parseFloat(getCleanNumber(amount))||0)}.`
                      : type === 'adjustment'
                      ? `Saldo ${accounts.find(a => a.id === selectedAccountId)?.name} akan ${adjustmentMode === 'add' ? 'bertambah' : 'berkurang'} ${formatCurrency(parseFloat(getCleanNumber(amount))||0)}.`
                      : (feeMethod === 'added'
                          ? `Pelanggan bayar ${formatCurrency((parseFloat(getCleanNumber(amount))||0) + (parseFloat(getCleanNumber(fee))||0))} cash. Digital berkurang ${formatCurrency((parseFloat(getCleanNumber(amount))||0) + (parseFloat(getCleanNumber(feeExternal))||0))}.`
                          : `Pelanggan bayar ${formatCurrency(parseFloat(getCleanNumber(amount))||0)} cash. Digital berkurang ${formatCurrency((parseFloat(getCleanNumber(amount))||0) - (parseFloat(getCleanNumber(fee))||0) + (parseFloat(getCleanNumber(feeExternal))||0))}.`)}
                    </div>
                  </div>
               </div>

               <button
                  type="submit"
                  disabled={loading}
                  onClick={handleSubmit}
                  className="w-full flex items-center justify-center gap-3 bg-blue-600 hover:bg-blue-500 text-white py-4 rounded-2xl transition-all shadow-lg shadow-blue-900/20 font-black text-sm uppercase tracking-wider disabled:opacity-50"
                >
                  {loading ? (
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      <PlusCircle size={18} />
                      <span>SIMPAN DATA</span>
                    </>
                  )}
               </button>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
