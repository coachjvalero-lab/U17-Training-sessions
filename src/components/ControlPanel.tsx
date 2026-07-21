import React, { useRef } from 'react';
import { 
  Printer, Download, Upload, Trash2, RefreshCw, 
  CheckCircle2, Sparkles, Activity
} from 'lucide-react';
import { TrainingSession } from '../types';

interface ControlPanelProps {
  session: TrainingSession;
  onImportSession: (session: TrainingSession) => void;
  onClearSession: () => void;
  onRestoreDemo: () => void;
  isSaving: boolean;
}

export const ControlPanel: React.FC<ControlPanelProps> = ({
  session,
  onImportSession,
  onClearSession,
  onRestoreDemo,
  isSaving
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Export Session to JSON
  const handleExportJSON = () => {
    try {
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(session, null, 2));
      const downloadAnchor = document.createElement('a');
      
      const cleanTeamName = session.teamName.trim().toLowerCase().replace(/[^a-z0-9]/g, '-');
      const dateStr = session.date || 'sin-fecha';
      
      downloadAnchor.setAttribute("href", dataStr);
      downloadAnchor.setAttribute("download", `sesion-${cleanTeamName}-${dateStr}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
    } catch (error) {
      console.error('Error exporting session:', error);
      alert('Hubo un error exportando la sesión.');
    }
  };

  // Import Session from JSON
  const handleImportJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const parsed = JSON.parse(event.target?.result as string);
          
          // Simple structural validation
          if (parsed && typeof parsed === 'object' && parsed.teamName) {
            onImportSession(parsed);
            alert('¡Sesión importada con éxito!');
          } else {
            alert('Archivo JSON no válido. Asegúrate de que es una sesión exportada válida.');
          }
        } catch (error) {
          console.error('Error parsing session file:', error);
          alert('Error al leer el archivo. Asegúrate de que el formato es JSON correcto.');
        }
      };
      reader.readAsText(file);
    }
    // Reset file input so same file can be loaded again if needed
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Trigger system print window
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="bg-slate-900/95 text-white rounded-2xl p-4 md:p-5 shadow-2xl border border-slate-800 print:hidden sticky top-4 z-50 backdrop-blur-md">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        
        {/* Brand & Autosave indicator */}
        <div className="flex items-center justify-between lg:justify-start space-x-3 shrink-0">
          <div className="flex items-center space-x-2">
            <div className="w-9 h-9 rounded-xl bg-emerald-500 flex items-center justify-center font-display font-extrabold text-white shadow-md shadow-emerald-500/20">
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-sm font-display font-black tracking-wider leading-none uppercase text-white">
                U17 Sessions
              </h1>
              <span className="text-[9px] text-emerald-400 font-extrabold tracking-widest uppercase">
                Staff Técnico
              </span>
            </div>
          </div>

          <div className="h-6 w-[1px] bg-slate-800 hidden lg:block" />

          {/* Local Autosave indicator */}
          <div className="flex items-center space-x-2 bg-slate-800/80 px-2.5 py-1.5 rounded-full border border-slate-700/60">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className={`relative inline-flex rounded-full h-2 w-2 ${isSaving ? 'bg-amber-400' : 'bg-emerald-500'}`}></span>
            </span>
            <span className="text-[9px] font-extrabold uppercase tracking-wider text-slate-300">
              {isSaving ? 'Guardando...' : 'Autoguardado local'}
            </span>
          </div>
        </div>

        {/* Action Button Grid */}
        <div className="flex flex-wrap items-center gap-2">
          
          {/* Print/PDF */}
          <button
            type="button"
            onClick={handlePrint}
            className="flex-1 sm:flex-initial flex items-center justify-center space-x-2 bg-emerald-500 hover:bg-emerald-600 active:scale-98 text-white font-extrabold text-xs uppercase tracking-wider py-2.5 px-4.5 rounded-xl transition-all cursor-pointer shadow-lg shadow-emerald-500/20"
            title="Imprimir o Guardar en PDF (Ctrl+P)"
          >
            <Printer className="w-4 h-4" />
            <span>Imprimir / PDF</span>
          </button>

          {/* Export JSON */}
          <button
            type="button"
            onClick={handleExportJSON}
            className="flex-1 sm:flex-initial flex items-center justify-center space-x-1.5 bg-slate-800 hover:bg-slate-700 active:scale-98 text-slate-200 font-bold text-xs uppercase tracking-wider py-2.5 px-3.5 rounded-xl transition-all cursor-pointer border border-slate-700/80"
            title="Exportar archivo de sesión para compartir"
          >
            <Download className="w-4 h-4" />
            <span>Exportar JSON</span>
          </button>

          {/* Import JSON */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex-1 sm:flex-initial flex items-center justify-center space-x-1.5 bg-slate-800 hover:bg-slate-700 active:scale-98 text-slate-200 font-bold text-xs uppercase tracking-wider py-2.5 px-3.5 rounded-xl transition-all cursor-pointer border border-slate-700/80"
            title="Importar un archivo de sesión (.json)"
          >
            <Upload className="w-4 h-4" />
            <span>Importar JSON</span>
          </button>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleImportJSON}
            accept=".json"
            className="hidden"
          />

          {/* Restore Demo */}
          <button
            type="button"
            onClick={onRestoreDemo}
            className="flex-1 sm:flex-initial flex items-center justify-center space-x-1 bg-slate-800 hover:bg-slate-700 text-amber-400 hover:text-amber-300 font-bold text-xs uppercase tracking-wider py-2.5 px-3 rounded-xl transition-all cursor-pointer border border-slate-700/80"
            title="Restaurar sesión de ejemplo para pruebas"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Cargar Demo</span>
          </button>

          {/* Clear Session */}
          <button
            type="button"
            onClick={onClearSession}
            className="flex-1 sm:flex-initial flex items-center justify-center space-x-1 bg-slate-800 hover:bg-rose-950 hover:text-rose-400 text-slate-400 font-bold text-xs uppercase tracking-wider py-2.5 px-3 rounded-xl transition-all cursor-pointer border border-slate-700/80 hover:border-rose-900/50"
            title="Borrar todos los campos para empezar de cero"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Limpiar Todo</span>
          </button>

        </div>

      </div>
    </div>
  );
};
