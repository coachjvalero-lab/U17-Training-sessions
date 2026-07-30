import React, { useState, useEffect } from 'react';
import { Database, Check, Copy, ExternalLink, X, ShieldAlert, Sparkles, RefreshCw } from 'lucide-react';
import { getSupabaseCredentials, saveSupabaseCredentials, getSupabaseClient } from '../supabase';

interface SupabaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConnected?: () => void;
}

export const SupabaseModal: React.FC<SupabaseModalProps> = ({ isOpen, onClose, onConnected }) => {
  const [url, setUrl] = useState('');
  const [anonKey, setAnonKey] = useState('');
  const [isCopied, setIsCopied] = useState(false);
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    if (isOpen) {
      const creds = getSupabaseCredentials();
      if (creds) {
        setUrl(creds.url);
        setAnonKey(creds.key);
      }
      setTestStatus('idle');
      setErrorMessage('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const sqlScript = `-- 1. Crea la tabla de sesiones en Supabase SQL Editor:
CREATE TABLE IF NOT EXISTS public.sessions (
  id TEXT PRIMARY KEY,
  updated_at BIGINT,
  data JSONB
);

-- 2. Habilita acceso libre RLS para lectura y escritura:
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public access to sessions" 
  ON public.sessions 
  FOR ALL 
  USING (true) 
  WITH CHECK (true);`;

  const handleCopySql = () => {
    navigator.clipboard.writeText(sqlScript);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const handleTestAndSave = async () => {
    if (!url.trim() || !anonKey.trim()) {
      setErrorMessage('Por favor introduce la URL y la clave Anon Key de Supabase.');
      setTestStatus('error');
      return;
    }

    setTestStatus('testing');
    setErrorMessage('');

    try {
      saveSupabaseCredentials(url, anonKey);
      const supabase = getSupabaseClient();

      if (!supabase) {
        throw new Error('No se pudo inicializar el cliente de Supabase.');
      }

      // Try reading from sessions table
      const { error } = await supabase.from('sessions').select('id').limit(1);

      if (error && error.code === '42P01') {
        // Table doesn't exist yet
        setTestStatus('error');
        setErrorMessage('Conectado a Supabase, pero la tabla "sessions" no existe aún. Ejecuta el script SQL de abajo en el SQL Editor de Supabase.');
        return;
      } else if (error) {
        setTestStatus('error');
        setErrorMessage(`Error de conexión con Supabase: ${error.message}`);
        return;
      }

      setTestStatus('success');
      setTimeout(() => {
        onConnected?.();
        onClose();
        window.location.reload(); // Reload to refresh real-time listeners
      }, 1000);
    } catch (err: any) {
      setTestStatus('error');
      setErrorMessage(err.message || 'Error al conectar con Supabase');
    }
  };

  const handleDisconnect = () => {
    saveSupabaseCredentials('', '');
    setUrl('');
    setAnonKey('');
    setTestStatus('idle');
    window.location.reload();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-2xl max-w-xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="bg-[#002142] text-white p-5 flex items-center justify-between border-b border-[#a79078]/30">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-emerald-500/20 rounded-xl border border-emerald-400/30 text-emerald-400">
              <Database className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-base font-black uppercase tracking-wider text-white">Conectar Base de Datos Supabase</h2>
              <p className="text-xs text-[#a79078]">Sustituye Firebase por tu propia base de datos Supabase</p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="p-1.5 text-slate-300 hover:text-white rounded-lg hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-5 overflow-y-auto">

          {/* Credentials Inputs */}
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-1">
                Project URL de Supabase
              </label>
              <input 
                type="text" 
                placeholder="https://xyzcompany.supabase.co" 
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                className="w-full text-xs font-mono bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#002142]"
              />
            </div>

            <div>
              <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-1">
                Anon / Public API Key
              </label>
              <input 
                type="password" 
                placeholder="eyJhY2Nlc3NfdG9rZW4iOi..." 
                value={anonKey}
                onChange={(e) => setAnonKey(e.target.value)}
                className="w-full text-xs font-mono bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#002142]"
              />
            </div>
          </div>

          {/* Test Status Feedback */}
          {testStatus === 'error' && (
            <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs flex items-start space-x-2">
              <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">Atención</p>
                <p className="text-[11px] mt-0.5">{errorMessage}</p>
              </div>
            </div>
          )}

          {testStatus === 'success' && (
            <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs flex items-center space-x-2">
              <Check className="w-4 h-4 text-emerald-600 shrink-0" />
              <p className="font-bold">¡Conectado con éxito a Supabase! Guardando configuración...</p>
            </div>
          )}

          {/* SQL Setup Instruction Box */}
          <div className="bg-slate-900 text-slate-200 rounded-xl p-4 space-y-2.5 border border-slate-800 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-bold text-emerald-400 text-[11px] uppercase tracking-wider flex items-center space-x-1.5">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Script de Creación en Supabase SQL Editor</span>
              </span>
              <button 
                type="button"
                onClick={handleCopySql}
                className="text-[10px] font-bold px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg flex items-center space-x-1 transition-colors border border-slate-700"
              >
                {isCopied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                <span>{isCopied ? '¡Copiado!' : 'Copiar SQL'}</span>
              </button>
            </div>

            <pre className="p-3 bg-black/50 rounded-lg text-[10px] font-mono text-emerald-300 overflow-x-auto leading-relaxed border border-slate-800/80">
              {sqlScript}
            </pre>

            <p className="text-[10px] text-slate-400">
              Copia este script e insértalo en tu panel de Supabase en <strong>SQL Editor</strong> &gt; <strong>New query</strong> &gt; <strong>Run</strong>.
            </p>
          </div>

        </div>

        {/* Modal Footer Actions */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          {getSupabaseCredentials() ? (
            <button
              type="button"
              onClick={handleDisconnect}
              className="px-3 py-2 text-xs font-bold text-rose-600 hover:bg-rose-50 rounded-xl transition-colors"
            >
              Desconectar Supabase
            </button>
          ) : <div />}

          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-200/60 rounded-xl transition-colors"
            >
              Cancelar
            </button>
            <button
              type="button"
              disabled={testStatus === 'testing'}
              onClick={handleTestAndSave}
              className="px-5 py-2 text-xs font-black bg-[#002142] hover:bg-[#001020] text-white rounded-xl shadow-md transition-all flex items-center space-x-1.5"
            >
              {testStatus === 'testing' ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-emerald-400" />
                  <span>Probando...</span>
                </>
              ) : (
                <span>Guardar y Conectar</span>
              )}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
