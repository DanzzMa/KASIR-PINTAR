import React, { useState } from 'react';
import { Wallet, Mail, Lock, UserPlus, LogIn } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from './AuthProvider';
import { clsx } from 'clsx';

export default function Auth() {
  const { login } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<'login' | 'register' | 'forgot' | 'recover'>('login');
  const [success, setSuccess] = useState<string | null>(null);
  const [recoveredEmails, setRecoveredEmails] = useState<string[]>([]);
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [hasUser, setHasUser] = useState<boolean | null>(null);

  React.useEffect(() => {
    fetch('/api/auth/status')
      .then(res => res.json())
      .then(data => setHasUser(data.hasUser))
      .catch(() => setHasUser(false));
  }, []);

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      let endpoint = '';
      let body: any = { email, password, displayName };

      if (mode === 'login') endpoint = '/api/auth/login';
      else if (mode === 'register') endpoint = '/api/auth/register';
      else if (mode === 'forgot') {
        endpoint = '/api/auth/forgot-password';
        body = { email, newPassword: password };
      }
      else if (mode === 'recover') {
        endpoint = '/api/auth/recover-account';
        body = { displayName };
      }

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Terjadi kesalahan');
      }
      
      if (mode === 'forgot') {
        setSuccess('Password berhasil diubah! Silakan login.');
        setMode('login');
      } else if (mode === 'recover') {
        setRecoveredEmails(data.emails);
      } else {
        login(data);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const getTitle = () => {
    if (mode === 'login') return 'Selamat Datang';
    if (mode === 'register') return 'Buat Akun Baru';
    if (mode === 'forgot') return 'Reset Password';
    if (mode === 'recover') return 'Cari Akun Anda';
    return '';
  };

  const getSubTitle = () => {
    if (mode === 'login') return 'Masuk untuk mengelola bisnis Anda hari ini.';
    if (mode === 'register') return 'Daftar sekarang untuk mulai mengelola keuangan.';
    if (mode === 'forgot') return 'Masukkan email Anda untuk memperbarui password.';
    if (mode === 'recover') return 'Masukkan Nama Toko Anda untuk menemukan email.';
    return '';
  };

  return (
    <div className="min-h-screen fresh-gradient flex items-center justify-center p-4 relative overflow-hidden">
      {/* Decorative Background Elements */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-400/10 rounded-full blur-[120px]" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-rose-400/10 rounded-full blur-[120px]" />
      
      <div className="w-full max-w-[1000px] grid grid-cols-1 lg:grid-cols-2 bg-white/80 backdrop-blur-xl rounded-[2.5rem] shadow-[0_32px_64px_-16px_rgba(0,0,0,0.1)] border border-white/20 overflow-hidden relative z-10">
        
        {/* Left Side: Branding/Visual */}
        <div className="hidden lg:flex flex-col justify-between p-12 bg-slate-900 text-white relative">
          <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(#ffffff 1px, transparent 1px)', backgroundSize: '24px 24px' }}></div>
          
          <div className="relative z-10">
             <div className="w-12 h-12 bg-blue-500 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-500/20 mb-6 group">
                <Wallet size={24} className="text-white group-hover:scale-110 transition-transform" />
             </div>
             <h2 className="text-4xl font-black tracking-tight leading-tight mb-4">
                Sistem Kasir <br />
                Pintar & <span className="text-blue-400 text-glow">Aman.</span>
             </h2>
             <p className="text-slate-400 font-medium text-lg max-w-xs">
                Kelola mutasi, piutang, dan laporan bisnis Anda dalam satu genggaman.
             </p>
          </div>

          <div className="relative z-10">
             <div className="flex gap-2 mb-8">
                {[1,2,3].map(i => <div key={i} className="h-1 w-8 rounded-full bg-slate-700"></div>)}
                <div className="h-1 w-12 rounded-full bg-blue-500"></div>
             </div>
             <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500">Powered by Enterprise Cloud Services</p>
          </div>
        </div>

        {/* Right Side: Form */}
        <div className="p-8 md:p-12 lg:p-16 flex flex-col justify-center">
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="w-full max-w-sm mx-auto"
          >
            <div className="mb-10">
              <h1 className="text-3xl font-black text-slate-900 tracking-tight leading-none mb-3">
                {getTitle()}
              </h1>
              <p className="text-slate-500 text-sm font-medium">
                {getSubTitle()}
              </p>
            </div>

            {error && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="mb-6 p-4 bg-red-50 text-red-600 rounded-2xl text-[11px] font-bold border border-red-100 flex items-center gap-3"
              >
                <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse shrink-0" />
                {error}
              </motion.div>
            )}

            {success && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="mb-6 p-4 bg-green-50 text-green-600 rounded-2xl text-[11px] font-bold border border-green-100 flex items-center gap-3"
              >
                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse shrink-0" />
                {success}
              </motion.div>
            )}

            <form onSubmit={handleEmailAuth} className="space-y-5">
              <AnimatePresence mode="wait">
                {(mode === 'register' || mode === 'recover') && (
                  <motion.div
                    key="name"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="space-y-1.5"
                  >
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Nama Toko / User</label>
                    <div className="relative group">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors">
                        <UserPlus size={18} />
                      </span>
                      <input
                        type="text"
                        required
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        className="w-full pl-11 pr-4 py-4 bg-slate-50 border border-slate-100 rounded-[1.25rem] focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 focus:bg-white transition-all text-sm font-bold placeholder:text-slate-300"
                        placeholder="Contoh: AGEN BERKAH"
                      />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {mode === 'recover' && recoveredEmails.length > 0 && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="p-4 bg-blue-50 rounded-2xl border border-blue-100 space-y-2">
                  <p className="text-[9px] font-black text-blue-400 uppercase tracking-widest">Akun Ditemukan:</p>
                  {recoveredEmails.map((u, i) => (
                    <div key={i} className="text-sm font-black text-blue-900 bg-white p-2 rounded-lg border border-blue-100">{u}</div>
                  ))}
                  <button onClick={() => setMode('login')} className="w-full text-center text-[10px] font-black text-blue-600 uppercase mt-2 hover:underline">Kembali ke Login</button>
                </motion.div>
              )}

              {mode !== 'recover' && (
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Email Bisnis</label>
                  <div className="relative group">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors">
                      <Mail size={18} />
                    </span>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full pl-11 pr-4 py-4 bg-slate-50 border border-slate-100 rounded-[1.25rem] focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 focus:bg-white transition-all text-sm font-bold placeholder:text-slate-300"
                      placeholder="email@anda.com"
                    />
                  </div>
                </div>
              )}

              {mode !== 'recover' && (
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center px-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">
                      {mode === 'forgot' ? 'Password Baru' : 'Password'}
                    </label>
                    {mode === 'login' && <button onClick={() => setMode('forgot')} type="button" className="text-[9px] font-black text-blue-500 uppercase tracking-widest hover:text-blue-600 transition-colors">Lupa Password?</button>}
                  </div>
                  <div className="relative group">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors">
                      <Lock size={18} />
                    </span>
                    <input
                      type="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full pl-11 pr-4 py-4 bg-slate-50 border border-slate-100 rounded-[1.25rem] focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 focus:bg-white transition-all text-sm font-bold placeholder:text-slate-300"
                      placeholder="••••••••"
                    />
                  </div>
                </div>
              )}

              {mode === 'recover' && recoveredEmails.length === 0 && (
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-blue-600 hover:bg-blue-500 text-white py-4 mt-4 rounded-[1.25rem] font-black text-xs uppercase tracking-[0.2em] transition-all shadow-xl shadow-blue-100 disabled:opacity-50 flex items-center justify-center gap-3 group"
                >
                   {loading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : 'CARI EMAIL SAYA'}
                </button>
              )}

              {mode !== 'recover' && (
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-slate-900 hover:bg-black text-white py-4 mt-4 rounded-[1.25rem] font-black text-xs uppercase tracking-[0.2em] transition-all shadow-xl shadow-slate-200 disabled:opacity-50 flex items-center justify-center gap-3 group active:scale-[0.98]"
                >
                  {loading ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      <span>
                        {mode === 'login' ? 'MASUK KE SISTEM' : mode === 'forgot' ? 'RESET PASSWORD' : 'DAFTAR SEKARANG'}
                      </span>
                      {mode === 'login' && <LogIn size={18} className="group-hover:translate-x-1 transition-transform" />}
                      {mode === 'register' && <UserPlus size={18} />}
                    </>
                  )}
                </button>
              )}
            </form>

            <div className="mt-10 text-center space-y-3">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none">
                {mode === 'login' ? 'Masalah Login?' : 'Sudah ingat?'}
              </p>
              <div className={clsx("grid gap-2", hasUser === false ? "grid-cols-2" : "grid-cols-1")}>
                {mode === 'login' ? (
                  <>
                    {hasUser === false && <button onClick={() => setMode('register')} className="py-3 rounded-xl border border-slate-100 text-[10px] font-black text-slate-600 uppercase tracking-widest hover:bg-slate-50 transition-all">BUAT AKUN</button>}
                    <button onClick={() => setMode('recover')} className="py-3 rounded-xl border border-slate-100 text-[10px] font-black text-blue-600 uppercase tracking-widest hover:bg-blue-50 transition-all shadow-sm">LUPA EMAIL?</button>
                  </>
                ) : (
                  <button onClick={() => { setMode('login'); setRecoveredEmails([]); }} className="col-span-2 py-3 rounded-xl border border-slate-100 text-[10px] font-black text-slate-600 uppercase tracking-widest hover:bg-slate-50 transition-all">KEMBALI KE LOGIN</button>
                )}
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
