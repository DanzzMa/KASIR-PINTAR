import { useState, useEffect, FormEvent } from 'react';
import { Debt, User } from '../types';
import { Plus, Search, Calendar, ChevronRight, CheckCircle2, AlertCircle, Clock, MoreHorizontal, Trash2, Edit2, Coins } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import { clsx } from 'clsx';
import { formatCurrency, safeParseDate } from '../lib/format';

export default function Debts({ user }: { user: User }) {
  const [debts, setDebts] = useState<Debt[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);

  // States for new debt
  const [customerName, setCustomerName] = useState('');
  const [amount, setAmount] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [note, setNote] = useState('');

  // States for Editing/Detail Actions
  const [selectedDebt, setSelectedDebt] = useState<Debt | null>(null);
  const [showActionMenu, setShowActionMenu] = useState(false);
  const [showEditForm, setShowEditForm] = useState(false);
  const [showPartialPayForm, setShowPartialPayForm] = useState(false);

  // States for editing fields
  const [editCustomerName, setEditCustomerName] = useState('');
  const [editAmount, setEditAmount] = useState('');
  const [editRemainingAmount, setEditRemainingAmount] = useState('');
  const [editDueDate, setEditDueDate] = useState('');
  const [editNote, setEditNote] = useState('');

  // State for partial payment
  const [partialPayAmount, setPartialPayAmount] = useState('');

  const formatToInputDate = (dateStr?: string) => {
    if (!dateStr) return '';
    try {
      return new Date(dateStr).toISOString().split('T')[0];
    } catch {
      return '';
    }
  };

  const fetchDebts = async () => {
    if (!user) return;
    try {
      const response = await fetch(`/api/debts?userId=${user.id}`);
      const data = await response.json();
      setDebts(data.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDebts();
  }, [user.id]);

  const handleAddDebt = async (e: FormEvent) => {
    e.preventDefault();
    if (!customerName || !amount) return;

    try {
      const newDebt = {
        userId: user.id,
        customerName,
        amount: Number(amount),
        remainingAmount: Number(amount),
        status: 'unpaid',
        dueDate: dueDate ? new Date(dueDate).toISOString() : null,
        createdAt: new Date().toISOString(),
        note
      };

      const response = await fetch('/api/debts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newDebt)
      });

      if (response.ok) {
        setShowAddForm(false);
        setCustomerName('');
        setAmount('');
        setDueDate('');
        setNote('');
        fetchDebts();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const markAsPaid = async (debtId: string) => {
    try {
      const response = await fetch(`/api/debts/${debtId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'paid', remainingAmount: 0 })
      });

      if (response.ok) {
        fetchDebts();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const openEditModal = (debt: Debt) => {
    setSelectedDebt(debt);
    setEditCustomerName(debt.customerName);
    setEditAmount(String(debt.amount));
    setEditRemainingAmount(String(debt.remainingAmount));
    setEditDueDate(formatToInputDate(debt.dueDate));
    setEditNote(debt.note || '');
    setShowActionMenu(false);
    setShowEditForm(true);
  };

  const openPartialPayModal = (debt: Debt) => {
    setSelectedDebt(debt);
    setPartialPayAmount('');
    setShowActionMenu(false);
    setShowPartialPayForm(true);
  };

  const handlePartialPayment = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedDebt || !partialPayAmount) return;

    const payVal = Number(partialPayAmount);
    if (isNaN(payVal) || payVal <= 0) {
      alert("Masukkan nominal pembayaran sebagian yang valid.");
      return;
    }

    if (payVal > selectedDebt.remainingAmount) {
      alert("Jumlah bayar melebihi sisa piutang.");
      return;
    }

    const newRemaining = Math.max(0, selectedDebt.remainingAmount - payVal);
    const newStatus = newRemaining <= 0 ? 'paid' : 'partially_paid';

    try {
      const response = await fetch(`/api/debts/${selectedDebt.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          remainingAmount: newRemaining,
          status: newStatus
        })
      });

      if (response.ok) {
        setShowPartialPayForm(false);
        setPartialPayAmount('');
        setSelectedDebt(null);
        fetchDebts();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleEditDebt = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedDebt) return;

    const amt = Number(editAmount);
    const remain = Number(editRemainingAmount);

    if (isNaN(amt) || amt < 0 || isNaN(remain) || remain < 0) {
      alert("Masukkan jumlah piutang yang valid.");
      return;
    }

    let statusVal = selectedDebt.status;
    if (remain <= 0) {
      statusVal = 'paid';
    } else if (remain < amt) {
      statusVal = 'partially_paid';
    } else {
      statusVal = 'unpaid';
    }

    try {
      const response = await fetch(`/api/debts/${selectedDebt.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerName: editCustomerName,
          amount: amt,
          remainingAmount: remain,
          status: statusVal,
          dueDate: editDueDate ? new Date(editDueDate).toISOString() : null,
          note: editNote
        })
      });

      if (response.ok) {
         setShowEditForm(false);
         setSelectedDebt(null);
         fetchDebts();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteDebt = async (debtId: string) => {
    if (!window.confirm("Apakah Anda yakin ingin menghapus catatan piutang ini secara permanen?")) {
      return;
    }

    try {
      const response = await fetch(`/api/debts/${debtId}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        setShowActionMenu(false);
        setSelectedDebt(null);
        fetchDebts();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const filteredDebts = debts.filter(d => 
    d.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (d.note || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalUnpaid = debts.reduce((acc, curr) => acc + (curr.status !== 'paid' ? curr.remainingAmount : 0), 0);

  return (
    <div className="space-y-4 pb-20 md:pb-0">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-slate-900 tracking-tight">Manajemen Piutang</h2>
          <p className="text-slate-500 text-[10px] font-bold uppercase tracking-wider">Catat & Tagih pembayaran pelanggan.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="bg-white px-3 py-1.5 rounded-xl border border-slate-100 shadow-sm">
             <p className="text-[9px] font-black text-red-400 uppercase tracking-widest mb-1 leading-none">Total Belum Bayar</p>
             <p className="text-base font-black text-red-600 leading-none">{formatCurrency(totalUnpaid)}</p>
          </div>
          <button 
            onClick={() => setShowAddForm(true)}
            className="bg-slate-900 hover:bg-slate-800 text-white px-3 py-2 rounded-xl flex items-center gap-2 font-bold shadow-lg transition-all active:scale-95"
          >
            <Plus size={16} />
            <span className="text-[11px]">BARU</span>
          </button>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
        <input
          type="text"
          placeholder="Cari nama pelanggan..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-10 pr-4 py-2 bg-white border border-slate-100 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all text-sm font-medium"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        <AnimatePresence mode="popLayout">
          {filteredDebts.map((debt) => (
            <motion.div
              layout
              key={debt.id}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 space-y-3 relative overflow-hidden"
            >
              {debt.status === 'paid' && (
                <div className="absolute top-0 right-0 p-2">
                  <CheckCircle2 className="text-green-500" size={20} />
                </div>
              )}
              
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <h3 className="font-black text-slate-900 uppercase text-xs">{debt.customerName}</h3>
                    {debt.status === 'partially_paid' && (
                      <span className="bg-amber-50 text-amber-800 text-[8px] font-black uppercase px-1.5 py-0.5 rounded-md border border-amber-200">
                        Dicicil
                      </span>
                    )}
                    {debt.status === 'unpaid' && (
                      <span className="bg-rose-50 text-rose-800 text-[8px] font-black uppercase px-1.5 py-0.5 rounded-md border border-rose-200">
                        Belum
                      </span>
                    )}
                  </div>
                  <p className="text-[9px] font-bold text-slate-400 uppercase mt-0.5">{format(new Date(debt.createdAt), 'd MMM yyyy')}</p>
                </div>
                <div className="text-right">
                  <p className={clsx(
                    "font-black text-base leading-none",
                    debt.status === 'paid' ? "text-slate-400 line-through" : "text-red-600"
                  )}>
                    {formatCurrency(debt.remainingAmount)}
                  </p>
                  {debt.status === 'partially_paid' && (
                    <p className="text-[8px] font-bold text-slate-400 uppercase mt-1">
                      Dari {formatCurrency(debt.amount)}
                    </p>
                  )}
                </div>
              </div>

              {debt.note && (
                <p className="text-[10px] font-medium text-slate-500 bg-slate-50 p-2 rounded-lg italic">
                  "{debt.note}"
                </p>
              )}

              {debt.dueDate && debt.status !== 'paid' && (
                <div className="flex items-center gap-1.5 text-[9px] font-bold text-orange-500 uppercase">
                  <Clock size={12} />
                  <span>Jatuh Tempo: {format(new Date(debt.dueDate), 'd MMMM yyyy', { locale: id })}</span>
                </div>
              )}

              <div className="pt-2 flex items-center gap-2">
                {debt.status !== 'paid' ? (
                  <button 
                    onClick={() => markAsPaid(debt.id)}
                    className="flex-1 bg-green-50 hover:bg-green-100 text-green-700 py-2 rounded-xl text-[10px] font-black uppercase transition-colors"
                  >
                    Lunas
                  </button>
                ) : (
                  <div className="flex-1 bg-slate-50 text-slate-400 py-2 rounded-xl text-[10px] font-black uppercase text-center font-mono">
                    Telah Dibayar
                  </div>
                )}
                <button 
                  onClick={() => {
                    setSelectedDebt(debt);
                    setShowActionMenu(true);
                  }}
                  className="w-10 h-10 bg-slate-50 hover:bg-slate-100 text-slate-400 rounded-xl flex items-center justify-center transition-colors"
                >
                  <MoreHorizontal size={16} />
                </button>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {filteredDebts.length === 0 && !loading && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-12 text-center">
          <AlertCircle className="mx-auto text-slate-300 mb-2" size={40} />
          <p className="text-slate-400 font-bold text-sm uppercase italic">Belum ada catatan piutang.</p>
        </div>
      )}

      {/* Modal Add Debt */}
      <AnimatePresence>
        {showAddForm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowAddForm(false)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white w-full max-w-md rounded-[2rem] shadow-2xl relative z-10 p-6 md:p-8"
            >
              <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight mb-1">Catat Piutang Baru</h3>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-6">Jangan sampai lupa tagih uang Anda!</p>
              
              <form onSubmit={handleAddDebt} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1">Nama Pelanggan</label>
                  <input 
                    required
                    type="text" 
                    value={customerName}
                    onChange={e => setCustomerName(e.target.value)}
                    placeholder="Contoh: Pak Budi"
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all font-bold text-sm"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1">Jumlah Piutang</label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-slate-300">Rp</span>
                    <input 
                      required
                      type="number" 
                      value={amount}
                      onChange={e => setAmount(e.target.value)}
                      placeholder="0"
                      className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-100 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all font-black text-lg"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1">Jatuh Tempo (Opsional)</label>
                  <input 
                    type="date" 
                    value={dueDate}
                    onChange={e => setDueDate(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all font-bold text-sm"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1">Catatan Keperluan</label>
                  <textarea 
                    value={note}
                    onChange={e => setNote(e.target.value)}
                    placeholder="Contoh: Belum bayar token listrik"
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all font-bold text-sm h-20 resize-none"
                  />
                </div>

                <div className="flex gap-3 pt-4">
                  <button 
                    type="button"
                    onClick={() => setShowAddForm(false)}
                    className="flex-1 px-4 py-3 rounded-xl border border-slate-100 font-bold text-[11px] uppercase text-slate-400 hover:bg-slate-50 transition-colors"
                  >
                    Batal
                  </button>
                  <button 
                    type="submit"
                    className="flex-1 bg-slate-900 hover:bg-slate-800 text-white px-4 py-3 rounded-xl font-bold text-[11px] uppercase shadow-lg shadow-slate-200 transition-all active:scale-95"
                  >
                    Simpan Catatan
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal Actions / Action Menu */}
      <AnimatePresence>
        {showActionMenu && selectedDebt && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                setShowActionMenu(false);
                setSelectedDebt(null);
              }}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white w-full max-w-sm rounded-[2rem] shadow-2xl relative z-10 p-6 space-y-4"
            >
              <div>
                <h3 className="text-base font-black text-slate-900 uppercase tracking-tight">Pilihan Tindakan</h3>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Piutang: {selectedDebt.customerName}</p>
              </div>

              <div className="grid grid-cols-1 gap-2">
                {selectedDebt.status !== 'paid' && (
                  <>
                    <button 
                      onClick={() => openPartialPayModal(selectedDebt)}
                      className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-amber-50 text-amber-900 hover:bg-amber-100 font-bold text-xs uppercase transition-colors text-left"
                    >
                      <Coins size={16} className="text-amber-600" />
                      <span>Bayar Sebagian</span>
                    </button>

                    <button 
                      onClick={() => {
                        setShowActionMenu(false);
                        markAsPaid(selectedDebt.id);
                        setSelectedDebt(null);
                      }}
                      className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-green-50 text-green-900 hover:bg-green-100 font-bold text-xs uppercase transition-colors text-left"
                    >
                      <CheckCircle2 size={16} className="text-green-600" />
                      <span>Tandai Lunas</span>
                    </button>
                  </>
                )}

                <button 
                  onClick={() => openEditModal(selectedDebt)}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-slate-50 text-slate-900 hover:bg-slate-100 font-bold text-xs uppercase transition-colors text-left"
                >
                  <Edit2 size={16} className="text-slate-600" />
                  <span>Edit Piutang</span>
                </button>

                <button 
                  onClick={() => {
                    const id = selectedDebt.id;
                    handleDeleteDebt(id);
                  }}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-rose-50 text-rose-900 hover:bg-rose-100 font-bold text-xs uppercase transition-colors text-left"
                >
                  <Trash2 size={16} className="text-rose-600" />
                  <span>Hapus Piutang</span>
                </button>
              </div>

              <button 
                onClick={() => {
                  setShowActionMenu(false);
                  setSelectedDebt(null);
                }}
                className="w-full py-3 rounded-xl border border-slate-100 font-bold text-[11px] uppercase text-slate-400 hover:bg-slate-50 transition-colors"
              >
                Batal
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal Edit Debt */}
      <AnimatePresence>
        {showEditForm && selectedDebt && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                setShowEditForm(false);
                setSelectedDebt(null);
              }}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white w-full max-w-md rounded-[2rem] shadow-2xl relative z-10 p-6 md:p-8"
            >
              <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight mb-1">Edit Detail Piutang</h3>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-6">Ubah data atau perbarui sisa tagihan.</p>
              
              <form onSubmit={handleEditDebt} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1">Nama Pelanggan</label>
                  <input 
                    required
                    type="text" 
                    value={editCustomerName}
                    onChange={e => setEditCustomerName(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all font-bold text-sm"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1">Total Piutang</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-xs text-slate-350">Rp</span>
                      <input 
                        required
                        type="number" 
                        value={editAmount}
                        onChange={e => setEditAmount(e.target.value)}
                        className="w-full pl-8 pr-3 py-3 bg-slate-50 border border-slate-100 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all font-black text-sm"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1">Sisa Piutang</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-xs text-slate-350">Rp</span>
                      <input 
                        required
                        type="number" 
                        value={editRemainingAmount}
                        onChange={e => setEditRemainingAmount(e.target.value)}
                        className="w-full pl-8 pr-3 py-3 bg-slate-50 border border-slate-100 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all font-black text-sm text-red-600"
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1">Jatuh Tempo (Opsional)</label>
                  <input 
                    type="date" 
                    value={editDueDate}
                    onChange={e => setEditDueDate(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all font-bold text-sm text-slate-700"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1">Catatan Keperluan</label>
                  <textarea 
                    value={editNote}
                    onChange={e => setEditNote(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all font-bold text-sm h-20 resize-none"
                  />
                </div>

                <div className="flex gap-3 pt-4">
                  <button 
                    type="button"
                    onClick={() => {
                      setShowEditForm(false);
                      setSelectedDebt(null);
                    }}
                    className="flex-1 px-4 py-3 rounded-xl border border-slate-100 font-bold text-[11px] uppercase text-slate-400 hover:bg-slate-50 transition-colors"
                  >
                    Batal
                  </button>
                  <button 
                    type="submit"
                    className="flex-1 bg-slate-900 hover:bg-slate-800 text-white px-4 py-3 rounded-xl font-bold text-[11px] uppercase shadow-lg shadow-slate-200 transition-all active:scale-95"
                  >
                    Simpan Perubahan
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal Bayar Sebagian (Partial Pay) */}
      <AnimatePresence>
        {showPartialPayForm && selectedDebt && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                setShowPartialPayForm(false);
                setSelectedDebt(null);
              }}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white w-full max-w-sm rounded-[2rem] shadow-2xl relative z-10 p-6 space-y-4"
            >
              <div>
                <h3 className="text-base font-black text-slate-900 uppercase tracking-tight">Bayar Sebagian</h3>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Pelanggan: {selectedDebt.customerName}</p>
              </div>

              <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 text-xs space-y-1">
                 <div className="flex justify-between">
                    <span className="font-bold text-slate-400 uppercase text-[9px]">Sisa Piutang Saat Ini:</span>
                    <span className="font-black text-red-600">{formatCurrency(selectedDebt.remainingAmount)}</span>
                 </div>
                 <div className="flex justify-between">
                    <span className="font-bold text-slate-400 uppercase text-[9px]">Maksimal Pembayaran:</span>
                    <span className="font-bold text-slate-700">{formatCurrency(selectedDebt.remainingAmount)}</span>
                 </div>
              </div>

              <form onSubmit={handlePartialPayment} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1">Nominal Yang Dibayarkan</label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-slate-350">Rp</span>
                    <input 
                      required
                      type="number"
                      max={selectedDebt.remainingAmount}
                      value={partialPayAmount}
                      onChange={e => setPartialPayAmount(e.target.value)}
                      placeholder="Contoh: 50000"
                      className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-100 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all font-black text-lg"
                    />
                  </div>
                </div>

                <div className="flex gap-3">
                  <button 
                    type="button"
                    onClick={() => {
                      setShowPartialPayForm(false);
                      setSelectedDebt(null);
                    }}
                    className="flex-1 px-4 py-3 rounded-xl border border-slate-100 font-bold text-[11px] uppercase text-slate-400 hover:bg-slate-50 transition-colors"
                  >
                    Batal
                  </button>
                  <button 
                    type="submit"
                    className="flex-1 bg-amber-500 hover:bg-amber-600 text-white px-4 py-3 rounded-xl font-bold text-[11px] uppercase shadow-lg shadow-amber-200 transition-all active:scale-95"
                  >
                    Proses Bayar
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
