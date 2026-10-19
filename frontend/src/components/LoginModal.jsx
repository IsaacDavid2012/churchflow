import React, { useState } from 'react';
import { Sparkles, Shield, Key, Lock, UserCheck } from 'lucide-react';
import { api } from '../api';

export default function LoginModal({ onLoginSuccess }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleLogin(e, customUser, customPass) {
    if (e) e.preventDefault();
    const u = customUser || username;
    const p = customPass || password;

    if (!u || !p) {
      setError('Please enter username and password');
      return;
    }

    setError('');
    setLoading(true);

    try {
      const data = await api.login(u, p);
      localStorage.setItem('servesync_token', data.token);
      localStorage.setItem('servesync_user', JSON.stringify(data.user));
      onLoginSuccess(data.user);
    } catch (err) {
      setError(err.message || 'Login failed. Check credentials.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-white text-slate-900">
      <div className="w-full max-w-md bg-white border border-slate-200 rounded-3xl p-8 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-red-500 via-red-600 to-rose-600"></div>

        <div className="text-center mb-8">
          <div className="w-20 h-20 rounded-2xl bg-white border border-red-200 p-1.5 mx-auto flex items-center justify-center mb-3 shadow-sm">
            <img 
              src="/churchflow-logo.png" 
              alt="JMR Logo" 
              className="w-full h-full object-contain" 
              onError={(e) => { e.target.style.display = 'none'; }}
            />
          </div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900">ChurchFlow</h1>
          <p className="text-xs text-slate-500 mt-1 font-medium">Worship Team Rostering & Service Planning</p>
        </div>

        {error && (
          <div className="mb-5 p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-600 text-xs font-semibold">
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Username
            </label>
            <input
              type="text"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter your username"
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Password
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 text-sm"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 py-3 px-4 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold shadow-lg shadow-red-600/25 disabled:opacity-50 transition-all cursor-pointer text-sm"
          >
            {loading ? 'Authenticating...' : 'Sign In to Dashboard'}
          </button>
        </form>

        <div className="mt-6 pt-5 border-t border-slate-100 text-center">
          <a
            href="/"
            className="inline-flex items-center justify-center text-xs font-semibold text-slate-500 hover:text-red-600 transition-colors"
          >
            ← Back to ChurchFlow Overview
          </a>
        </div>
      </div>
    </div>
  );
}
