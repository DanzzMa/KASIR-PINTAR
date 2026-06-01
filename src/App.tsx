/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { Account } from './types';
import Auth from './components/Auth';
import Dashboard from './components/Dashboard';
import Transactions from './components/Transactions';
import TransactionForm from './components/TransactionForm';
import Reports from './components/Reports';
import Settings from './components/Settings';
import Debts from './components/Debts';
import { LayoutGrid, ListOrdered, PlusCircle, FileBarChart, Settings as SettingsIcon, LogOut, Wallet, Users, BookOpen } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { useAuth } from './components/AuthProvider';
import BookkeepingView from './components/BookkeepingView';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

type Tab = 'dashboard' | 'transactions' | 'debts' | 'add' | 'reports' | 'bookkeeping' | 'settings';

export default function App() {
  const { user, loading: authLoading, logout } = useAuth();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
  const [logoUrl, setLogoUrl] = useState('');

  const fetchAccounts = async () => {
    if (!user) return;
    try {
      const response = await fetch(`/api/accounts?userId=${user.id}`);
      const data = await response.json();
      setAccounts(data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchLogo = async () => {
    if (!user) return;
    try {
      const response = await fetch(`/api/settings?userId=${user.id}`);
      const data = await response.json();
      if (data.app_logo_url) {
        setLogoUrl(data.app_logo_url);
        // Update favicon
        let link: HTMLLinkElement | null = document.querySelector("link[rel~='icon']");
        if (!link) {
          link = document.createElement('link');
          link.rel = 'icon';
          document.getElementsByTagName('head')[0].appendChild(link);
        }
        link.href = data.app_logo_url;
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    if (user) {
      fetchAccounts();
      fetchLogo();
    }
  }, [user]);

  const handleLogout = () => {
    logout();
    setActiveTab('dashboard');
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full"
        />
      </div>
    );
  }

  if (!user) {
    return <Auth />;
  }

  // Initial setup if no accounts
  if (user && accounts.length === 0 && activeTab !== 'settings') {
    return <Settings user={user} accounts={accounts} isInitialSetup={true} onUpdate={fetchAccounts} />;
  }

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return <Dashboard user={user} accounts={accounts} onNavigate={setActiveTab} />;
      case 'transactions':
        return <Transactions user={user} accounts={accounts} onUpdate={fetchAccounts} />;
      case 'debts':
        return <Debts user={user} />;
      case 'add':
        return <TransactionForm user={user} accounts={accounts} onComplete={() => { fetchAccounts(); setActiveTab('dashboard'); }} />;
      case 'reports':
        return <Reports user={user} accounts={accounts} />;
      case 'bookkeeping':
        return <BookkeepingView user={user} accounts={accounts} onUpdateAccounts={fetchAccounts} />;
      case 'settings':
        return <Settings user={user} accounts={accounts} isInitialSetup={accounts.length === 0} onUpdate={fetchAccounts} />;
      default:
        return <Dashboard user={user} accounts={accounts} onNavigate={setActiveTab} />;
    }
  };

  return (
    <div className="min-h-screen fresh-gradient text-slate-900 pb-20 md:pb-0 md:pl-64">
      {/* Sidebar - Desktop - Bento Styled */}
      <aside className="fixed left-0 top-0 h-full w-64 p-5 hidden md:flex flex-col z-30">
        <div className="glass-card h-full w-full rounded-[2.5rem] flex flex-col p-6 overflow-hidden">
          <div className="flex items-center gap-3 mb-12 px-2">
            <div className="w-10 h-10 bg-slate-900 rounded-xl flex items-center justify-center text-white shadow-xl shadow-slate-200 overflow-hidden">
              {logoUrl ? (
                <img src={logoUrl} alt="Logo" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
              ) : (
                <Wallet size={20} />
              )}
            </div>
            <div>
              <h1 className="text-xl font-black tracking-tighter text-slate-900 leading-none">{user?.displayName?.split(' ')[0] || 'AGENT'}</h1>
              <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest mt-0.5">Kasir Pintar</p>
            </div>
          </div>

          <nav className="flex-1 space-y-1">
            <NavItem icon={LayoutGrid} label="Dasbor" active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} />
            <NavItem icon={ListOrdered} label="Mutasi" active={activeTab === 'transactions'} onClick={() => setActiveTab('transactions')} />
            <NavItem icon={Users} label="Piutang" active={activeTab === 'debts'} onClick={() => setActiveTab('debts')} />
            <NavItem icon={PlusCircle} label="Transaksi" active={activeTab === 'add'} onClick={() => setActiveTab('add')} />
            <NavItem icon={FileBarChart} label="Laporan" active={activeTab === 'reports'} onClick={() => setActiveTab('reports')} />
            <NavItem icon={BookOpen} label="Buku Harian" active={activeTab === 'bookkeeping'} onClick={() => setActiveTab('bookkeeping')} />
            <NavItem icon={SettingsIcon} label="Sistem" active={activeTab === 'settings'} onClick={() => setActiveTab('settings')} />
          </nav>

          <div className="mt-auto space-y-4 pt-6">
            <div className="bg-slate-50 rounded-2xl p-4">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">USER AKTIF</p>
              <p className="text-xs font-black text-slate-800 truncate uppercase">{user?.displayName || user?.email}</p>
            </div>
            <button
              onClick={handleLogout}
              className="w-full flex items-center justify-center gap-3 px-4 py-3 rounded-2xl bg-white border border-slate-100 text-red-500 hover:bg-red-50 transition-all font-black text-[10px] uppercase tracking-widest"
            >
              <LogOut size={16} />
              <span>LOGOUT</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="max-w-[1280px] mx-auto p-4 md:p-6 lg:p-8">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
          >
            {renderContent()}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Bottom Nav - Mobile */}
      <div className="fixed bottom-0 left-0 right-0 p-4 md:hidden z-40">
        <nav className="h-16 bg-white/80 border border-white/20 backdrop-blur-md rounded-[2.5rem] shadow-xl shadow-blue-100/50 flex items-center justify-around px-4">
          <MobileNavItem icon={LayoutGrid} active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} />
          <MobileNavItem icon={ListOrdered} active={activeTab === 'transactions'} onClick={() => setActiveTab('transactions')} />
          <MobileNavItem icon={BookOpen} active={activeTab === 'bookkeeping'} onClick={() => setActiveTab('bookkeeping')} />
          <button 
            onClick={() => setActiveTab('add')}
            className={clsx(
              "w-12 h-12 rounded-full flex items-center justify-center text-white shadow-lg transition-all",
              activeTab === 'add' ? "bg-slate-900 scale-110 shadow-slate-400" : "bg-blue-600 shadow-blue-200"
            )}
          >
            <PlusCircle size={24} />
          </button>
          <MobileNavItem icon={Users} active={activeTab === 'debts'} onClick={() => setActiveTab('debts')} />
          <MobileNavItem icon={FileBarChart} active={activeTab === 'reports'} onClick={() => setActiveTab('reports')} />
          <MobileNavItem icon={SettingsIcon} active={activeTab === 'settings'} onClick={() => setActiveTab('settings')} />
        </nav>
      </div>
    </div>
  );
}

function NavItem({ icon: Icon, label, active, onClick }: { icon: any, label: string, active: boolean, onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-3 px-4 py-3 rounded-2xl transition-all duration-200 group border border-transparent",
        active 
          ? "bg-slate-900 text-white shadow-lg shadow-slate-200" 
          : "text-slate-500 hover:bg-slate-50 hover:border-slate-100"
      )}
    >
      <Icon size={18} className={cn(active ? "text-blue-500" : "group-hover:scale-110 transition-transform")} />
      <span className="font-black text-[11px] uppercase tracking-widest">{label}</span>
    </button>
  );
}

function MobileNavItem({ icon: Icon, active, onClick }: { icon: any, active: boolean, onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-10 h-10 rounded-xl transition-all flex items-center justify-center",
        active ? "text-slate-900 bg-slate-50" : "text-slate-400"
      )}
    >
      <Icon size={20} />
    </button>
  );
}
