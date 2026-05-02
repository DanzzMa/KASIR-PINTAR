/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { auth, db } from './lib/firebase';
import { onAuthStateChanged, User, signOut } from 'firebase/auth';
import { doc, onSnapshot, collection, query, where } from 'firebase/firestore';
import { UserProfile, Account } from './types';
import Auth from './components/Auth';
import Dashboard from './components/Dashboard';
import Transactions from './components/Transactions';
import TransactionForm from './components/TransactionForm';
import Reports from './components/Reports';
import Settings from './components/Settings';
import { LayoutGrid, ListOrdered, PlusCircle, FileBarChart, Settings as SettingsIcon, LogOut, Wallet } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

type Tab = 'dashboard' | 'transactions' | 'add' | 'reports' | 'settings';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      if (!u) {
        setProfile(null);
        setAccounts([]);
        setLoading(false);
      }
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!user) return;

    const unsubProfile = onSnapshot(doc(db, 'users', user.uid), (docSnap) => {
      if (docSnap.exists()) {
        setProfile(docSnap.data() as UserProfile);
      } else {
        setProfile(null);
      }
    });

    const q = query(collection(db, 'users', user.uid, 'accounts'));
    const unsubAccounts = onSnapshot(q, (snapshot) => {
      const accs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Account));
      setAccounts(accs);
      setLoading(false);
    });

    return () => {
      unsubProfile();
      unsubAccounts();
    };
  }, [user]);

  const handleLogout = async () => {
    await signOut(auth);
    setActiveTab('dashboard');
  };

  if (loading) {
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

  // Initial setup if no profile or no accounts
  if (user && (!profile || accounts.length === 0) && activeTab !== 'settings') {
    return <Settings user={user} profile={profile} accounts={accounts} isInitialSetup={true} />;
  }

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return <Dashboard profile={profile!} user={user} accounts={accounts} onNavigate={setActiveTab} />;
      case 'transactions':
        return <Transactions user={user} accounts={accounts} />;
      case 'add':
        return <TransactionForm user={user} profile={profile!} accounts={accounts} onComplete={() => setActiveTab('dashboard')} />;
      case 'reports':
        return <Reports user={user} accounts={accounts} />;
      case 'settings':
        return <Settings user={user} profile={profile} accounts={accounts} isInitialSetup={!profile || accounts.length === 0} />;
      default:
        return <Dashboard profile={profile!} user={user} accounts={accounts} onNavigate={setActiveTab} />;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-20 md:pb-0 md:pl-64">
      {/* Sidebar - Desktop */}
      <aside className="fixed left-0 top-0 h-full w-64 bg-white border-r border-slate-200 hidden md:flex flex-col p-6 z-30">
        <div className="flex items-center gap-3 mb-10">
          <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-blue-200">
            <Wallet size={24} />
          </div>
          <h1 className="text-xl font-bold tracking-tight text-slate-800">KasPintar</h1>
        </div>

        <nav className="flex-1 space-y-2">
          <NavItem icon={LayoutGrid} label="Dashboard" active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} />
          <NavItem icon={ListOrdered} label="Transaksi" active={activeTab === 'transactions'} onClick={() => setActiveTab('transactions')} />
          <NavItem icon={PlusCircle} label="Tambah Baru" active={activeTab === 'add'} onClick={() => setActiveTab('add')} />
          <NavItem icon={FileBarChart} label="Laporan" active={activeTab === 'reports'} onClick={() => setActiveTab('reports')} />
          <NavItem icon={SettingsIcon} label="Pengaturan" active={activeTab === 'settings'} onClick={() => setActiveTab('settings')} />
        </nav>

        <button
          onClick={handleLogout}
          className="flex items-center gap-3 px-4 py-3 rounded-xl text-slate-500 hover:bg-red-50 hover:text-red-600 transition-colors mt-auto group"
        >
          <LogOut size={20} className="group-hover:translate-x-1 transition-transform" />
          <span className="font-medium">Keluar</span>
        </button>
      </aside>

      {/* Main Content */}
      <main className="max-w-5xl mx-auto p-4 md:p-10">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            {renderContent()}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Bottom Nav - Mobile */}
      <nav className="fixed bottom-0 left-0 right-0 h-16 bg-white border-t border-slate-200 flex md:hidden items-center justify-around px-2 z-40 bg-opacity-95 backdrop-blur-sm">
        <MobileNavItem icon={LayoutGrid} active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} />
        <MobileNavItem icon={ListOrdered} active={activeTab === 'transactions'} onClick={() => setActiveTab('transactions')} />
        <div className="relative -top-4">
           <button 
            onClick={() => setActiveTab('add')}
            className="w-14 h-14 bg-blue-600 rounded-full flex items-center justify-center text-white shadow-lg shadow-blue-200 animate-pulse-slow"
          >
            <PlusCircle size={28} />
          </button>
        </div>
        <MobileNavItem icon={FileBarChart} active={activeTab === 'reports'} onClick={() => setActiveTab('reports')} />
        <MobileNavItem icon={SettingsIcon} active={activeTab === 'settings'} onClick={() => setActiveTab('settings')} />
      </nav>
    </div>
  );
}

function NavItem({ icon: Icon, label, active, onClick }: { icon: any, label: string, active: boolean, onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group",
        active 
          ? "bg-blue-600 text-white shadow-md shadow-blue-100" 
          : "text-slate-500 hover:bg-slate-100"
      )}
    >
      <Icon size={20} className={cn(active ? "" : "group-hover:scale-110 transition-transform")} />
      <span className="font-medium">{label}</span>
    </button>
  );
}

function MobileNavItem({ icon: Icon, active, onClick }: { icon: any, active: boolean, onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "p-3 rounded-xl transition-colors",
        active ? "text-blue-600 bg-blue-50" : "text-slate-400"
      )}
    >
      <Icon size={24} />
    </button>
  );
}
