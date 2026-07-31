import React, { useState } from 'react';
import { User as UserIcon, Lock, Eye, EyeOff, Loader2, ArrowRight, AlertCircle, Shield, UserPlus, CheckCircle2 } from 'lucide-react';
import { OFFICIAL_ALULA_LOGO_DATA_URL } from '../constants/logo';
import { loginUser, registerUser } from '../firebase';

interface LoginPageProps {
  onSuccess: () => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onSuccess }) => {
  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Logo from localStorage or default
  const [logoUrl, setLogoUrl] = useState<string>(() => {
    try {
      return localStorage.getItem('u17_uploaded_team_logo') || OFFICIAL_ALULA_LOGO_DATA_URL;
    } catch (e) {
      return OFFICIAL_ALULA_LOGO_DATA_URL;
    }
  });

  const toggleMode = () => {
    setIsRegisterMode(!isRegisterMode);
    setErrorMessage('');
    setSuccessMessage('');
    if (!isRegisterMode) {
      setUsername('');
      setPassword('');
      setConfirmPassword('');
    } else {
      setUsername('admin');
      setPassword('');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    if (!username.trim() || !password.trim()) {
      setErrorMessage('Por favor ingresa usuario/email y contraseña.');
      return;
    }

    if (isRegisterMode) {
      if (password.length < 6) {
        setErrorMessage('La contraseña debe tener al menos 6 caracteres.');
        return;
      }
      if (password !== confirmPassword) {
        setErrorMessage('Las contraseñas no coinciden. Verifícalas nuevamente.');
        return;
      }
    }

    setIsLoading(true);
    try {
      if (isRegisterMode) {
        let cleanEmail = username.trim().toLowerCase();
        if (!cleanEmail.includes('@')) {
          cleanEmail = `${cleanEmail}@alula.com`;
        }
        await registerUser(cleanEmail, password);
        setSuccessMessage('¡Usuario creado con éxito! Iniciando sesión...');
        setTimeout(() => {
          onSuccess();
        }, 800);
      } else {
        await loginUser(username, password);
        onSuccess();
      }
    } catch (err: any) {
      console.error('Authentication error:', err);
      if (err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        setErrorMessage('Usuario o contraseña incorrectos. Por favor intenta de nuevo.');
      } else if (err.code === 'auth/email-already-in-use') {
        setErrorMessage('Este usuario/email ya está registrado. Intenta iniciar sesión.');
      } else if (err.code === 'auth/weak-password') {
        setErrorMessage('La contraseña es demasiado débil (mínimo 6 caracteres).');
      } else if (err.message) {
        setErrorMessage(err.message.replace('Firebase: ', ''));
      } else {
        setErrorMessage(isRegisterMode ? 'Error al crear usuario.' : 'Error al iniciar sesión.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#07090e] text-slate-100 flex items-center justify-center p-4 relative overflow-hidden font-sans select-none">
      {/* Background Gradients & Ambient Glow */}
      <div 
        className="absolute inset-0 opacity-40 pointer-events-none"
        style={{
          backgroundImage: `radial-gradient(circle at 50% -20%, rgba(16, 185, 129, 0.18), transparent 70%),
                            radial-gradient(circle at 80% 80%, rgba(14, 165, 233, 0.08), transparent 50%)`
        }}
      />
      
      {/* Subtle Grid overlay */}
      <div 
        className="absolute inset-0 opacity-[0.03] pointer-events-none"
        style={{
          backgroundImage: `linear-gradient(to right, #ffffff 1px, transparent 1px), linear-gradient(to bottom, #ffffff 1px, transparent 1px)`,
          backgroundSize: '32px 32px'
        }}
      />

      {/* Main SaaS Portal Container */}
      <div className="relative w-full max-w-[420px] z-10">
        
        {/* Brand Identity Header */}
        <div className="text-center mb-8 space-y-3">
          <div className="inline-flex items-center justify-center relative">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-b from-slate-800/90 to-slate-900/90 border border-slate-700/50 p-2.5 flex items-center justify-center shadow-xl shadow-black/50 backdrop-blur-md group transition-transform duration-300 hover:scale-105">
              <img 
                src={logoUrl} 
                alt="Al Ula SC Logo" 
                className="w-full h-full object-contain filter drop-shadow"
              />
            </div>
            <div className="absolute -bottom-1 -right-1 bg-emerald-500 text-slate-950 p-1 rounded-full shadow-lg">
              <Shield className="w-3 h-3 fill-current" />
            </div>
          </div>

          <div className="space-y-1">
            <h1 className="text-xl font-extrabold tracking-tight text-white font-display">
              Al Ula FC
            </h1>
            <div className="flex items-center justify-center space-x-2">
              <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 uppercase tracking-widest">
                U17 Women • Tactical Portal
              </span>
            </div>
          </div>
        </div>

        {/* Form Card */}
        <div className="bg-[#111622]/80 backdrop-blur-2xl rounded-2xl border border-slate-800/90 shadow-2xl shadow-black/80 p-7 space-y-6">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div>
              <h2 className="text-sm font-bold text-slate-100">
                {isRegisterMode ? 'Crear Nuevo Usuario' : 'Iniciar Sesión'}
              </h2>
              <p className="text-[11px] text-slate-400 font-normal mt-0.5">
                {isRegisterMode 
                  ? 'Registra una nueva cuenta de entrenador o miembro del staff.' 
                  : 'Ingresa tus credenciales para acceder al portal técnico.'}
              </p>
            </div>
          </div>

          {/* Messages */}
          {errorMessage && (
            <div className="bg-rose-500/10 border border-rose-500/30 text-rose-300 px-3.5 py-2.5 rounded-xl text-xs font-medium flex items-center space-x-2 animate-fadeIn">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {successMessage && (
            <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 px-3.5 py-2.5 rounded-xl text-xs font-medium flex items-center space-x-2 animate-fadeIn">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{successMessage}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Username / Email Input */}
            <div className="space-y-1.5">
              <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider">
                {isRegisterMode ? 'Correo / Usuario' : 'Usuario o Email'}
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                  <UserIcon className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  required
                  autoFocus
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder={isRegisterMode ? 'entrenador@alula.com' : 'admin'}
                  className="w-full pl-10 pr-4 py-2.5 bg-[#171d2a] border border-slate-700/60 rounded-xl text-sm font-medium text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/50 transition-all"
                />
              </div>
            </div>

            {/* Password Input */}
            <div className="space-y-1.5">
              <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider">
                Contraseña
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-10 py-2.5 bg-[#171d2a] border border-slate-700/60 rounded-xl text-sm font-medium text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/50 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-500 hover:text-slate-300 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Confirm Password (only in register mode) */}
            {isRegisterMode && (
              <div className="space-y-1.5 animate-fadeIn">
                <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider">
                  Confirmar Contraseña
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-10 pr-10 py-2.5 bg-[#171d2a] border border-slate-700/60 rounded-xl text-sm font-medium text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/50 transition-all"
                  />
                </div>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full mt-2 py-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs uppercase tracking-wider rounded-xl transition-all duration-200 shadow-lg shadow-emerald-500/20 flex items-center justify-center space-x-2 active:scale-[0.98] disabled:opacity-60 cursor-pointer"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-slate-950" />
                  <span>{isRegisterMode ? 'Creando cuenta...' : 'Autenticando...'}</span>
                </>
              ) : (
                <>
                  {isRegisterMode ? <UserPlus className="w-4 h-4" /> : <ArrowRight className="w-4 h-4" />}
                  <span>{isRegisterMode ? 'Crear Cuenta y Entrar' : 'Iniciar Sesión'}</span>
                </>
              )}
            </button>
          </form>

          {/* Toggle Mode Link */}
          <div className="pt-2 text-center border-t border-slate-800/80">
            <button
              type="button"
              onClick={toggleMode}
              className="text-xs font-semibold text-emerald-400 hover:text-emerald-300 transition-colors focus:outline-none cursor-pointer"
            >
              {isRegisterMode 
                ? '¿Ya tienes una cuenta? Iniciar Sesión' 
                : '¿No tienes cuenta? Crear un nuevo usuario / Registrarse'}
            </button>
          </div>
        </div>

        {/* Minimal Footer */}
        <div className="mt-8 text-center text-[11px] text-slate-500 font-mono">
          U17 Women Al Ula • Sistema de Gestión Técnica
        </div>
      </div>
    </div>
  );
};

