import React, { useState } from 'react';
import { 
  Stethoscope, 
  PlusCircle, 
  AlertCircle, 
  CheckCircle2, 
  Trash2, 
  Edit3, 
  Search, 
  X,
  Save,
  HeartPulse
} from 'lucide-react';
import { PhysioRecord, SquadPlayer } from '../types';

interface PhysiotherapySectionProps {
  records: PhysioRecord[];
  squadPlayers: SquadPlayer[];
  onUpdateRecords: (records: PhysioRecord[]) => void;
  onUpdateSquadPlayerStatus?: (playerId: string, status: SquadPlayer['status']) => void;
}

export const PhysiotherapySection: React.FC<PhysiotherapySectionProps> = ({
  records,
  squadPlayers,
  onUpdateRecords,
  onUpdateSquadPlayerStatus
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<PhysioRecord | null>(null);

  const [formData, setFormData] = useState<{
    playerId: string;
    injuryDate: string;
    injuryType: string;
    severity: PhysioRecord['severity'];
    status: PhysioRecord['status'];
    treatmentNotes: string;
    estimatedReturnDate: string;
    physioName: string;
  }>({
    playerId: squadPlayers[0]?.id || '',
    injuryDate: new Date().toISOString().split('T')[0],
    injuryType: '',
    severity: 'Moderate',
    status: 'Active Treatment',
    treatmentNotes: '',
    estimatedReturnDate: '',
    physioName: 'Medical Team'
  });

  const handleOpenAdd = () => {
    setEditingRecord(null);
    setFormData({
      playerId: squadPlayers[0]?.id || '',
      injuryDate: new Date().toISOString().split('T')[0],
      injuryType: '',
      severity: 'Moderate',
      status: 'Active Treatment',
      treatmentNotes: '',
      estimatedReturnDate: '',
      physioName: 'Medical Team'
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (rec: PhysioRecord) => {
    setEditingRecord(rec);
    setFormData({
      playerId: rec.playerId,
      injuryDate: rec.injuryDate,
      injuryType: rec.injuryType,
      severity: rec.severity,
      status: rec.status,
      treatmentNotes: rec.treatmentNotes,
      estimatedReturnDate: rec.estimatedReturnDate || '',
      physioName: rec.physioName || 'Medical Team'
    });
    setIsModalOpen(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const selectedPlayer = squadPlayers.find(p => p.id === formData.playerId);
    const playerName = selectedPlayer 
      ? `${selectedPlayer.firstName} ${selectedPlayer.lastName}` 
      : 'Unknown Player';

    if (editingRecord) {
      const updated = records.map(r => 
        r.id === editingRecord.id
          ? {
              ...r,
              playerId: formData.playerId,
              playerName: playerName,
              injuryDate: formData.injuryDate,
              injuryType: formData.injuryType,
              severity: formData.severity,
              status: formData.status,
              treatmentNotes: formData.treatmentNotes,
              estimatedReturnDate: formData.estimatedReturnDate,
              physioName: formData.physioName,
              updatedAt: new Date().toISOString().split('T')[0]
            }
          : r
      );
      onUpdateRecords(updated);
    } else {
      const newRec: PhysioRecord = {
        id: 'physio-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
        playerId: formData.playerId,
        playerName: playerName,
        injuryDate: formData.injuryDate,
        injuryType: formData.injuryType,
        severity: formData.severity,
        status: formData.status,
        treatmentNotes: formData.treatmentNotes,
        estimatedReturnDate: formData.estimatedReturnDate,
        physioName: formData.physioName,
        updatedAt: new Date().toISOString().split('T')[0]
      };
      onUpdateRecords([...records, newRec]);
    }

    // Auto update squad status
    if (onUpdateSquadPlayerStatus && formData.playerId) {
      if (formData.status === 'Active Treatment') {
        onUpdateSquadPlayerStatus(formData.playerId, 'Injured');
      } else if (formData.status === 'Rehab / Field Work') {
        onUpdateSquadPlayerStatus(formData.playerId, 'Recovering');
      } else if (formData.status === 'Cleared for Training') {
        onUpdateSquadPlayerStatus(formData.playerId, 'Active');
      }
    }

    setIsModalOpen(false);
  };

  const handleDelete = (id: string, name: string) => {
    if (confirm(`Are you sure you want to delete the medical record for ${name}?`)) {
      onUpdateRecords(records.filter(r => r.id !== id));
    }
  };

  const filtered = records.filter(r => {
    const matchesSearch = r.playerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          r.injuryType.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'ALL' || r.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const activeRehabCount = records.filter(r => r.status === 'Active Treatment' || r.status === 'Rehab / Field Work').length;
  const clearedCount = records.filter(r => r.status === 'Cleared for Training').length;

  return (
    <div className="space-y-6">
      {/* Medical Header */}
      <div className="bg-slate-900 text-white p-6 rounded-2xl shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border border-slate-800">
        <div>
          <div className="flex items-center space-x-2 text-rose-400 text-xs font-mono font-bold uppercase tracking-widest mb-1">
            <HeartPulse className="w-4 h-4" />
            <span>Physiotherapy & Medical Department</span>
          </div>
          <h2 className="text-2xl font-black tracking-tight text-white font-display">
            Medical & Injury Tracking
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Track injury diagnoses, treatment protocols, rehab progress, and field return clearances.
          </p>
        </div>

        <button
          type="button"
          onClick={handleOpenAdd}
          className="px-4 py-2.5 bg-rose-500 hover:bg-rose-400 text-white text-xs font-extrabold rounded-xl transition-all shadow-md shadow-rose-500/20 flex items-center space-x-2 shrink-0 active:scale-95"
        >
          <PlusCircle className="w-4 h-4" />
          <span>New Medical Record</span>
        </button>
      </div>

      {/* Quick Medical Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center border border-rose-200 shrink-0">
            <AlertCircle className="w-5 h-5" />
          </div>
          <div>
            <span className="block text-xs font-bold text-slate-400 uppercase tracking-wider">Active Rehab</span>
            <span className="text-lg font-black text-slate-900">{activeRehabCount} Players</span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-200 shrink-0">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <span className="block text-xs font-bold text-slate-400 uppercase tracking-wider">Cleared / Fit</span>
            <span className="text-lg font-black text-slate-900">{clearedCount} Cleared</span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-slate-50 text-slate-600 flex items-center justify-center border border-slate-200 shrink-0">
            <Stethoscope className="w-5 h-5" />
          </div>
          <div>
            <span className="block text-xs font-bold text-slate-400 uppercase tracking-wider">Total Records</span>
            <span className="text-lg font-black text-slate-900">{records.length} Logged</span>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by player or injury type..."
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:border-rose-500"
          />
        </div>

        <div className="flex items-center space-x-2">
          <span className="text-xs font-bold text-slate-500">Filter Status:</span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none"
          >
            <option value="ALL">All Statuses</option>
            <option value="Active Treatment">Active Treatment</option>
            <option value="Rehab / Field Work">Rehab / Field Work</option>
            <option value="Cleared for Training">Cleared for Training</option>
            <option value="Closed">Closed Log</option>
          </select>
        </div>
      </div>

      {/* Medical Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filtered.length === 0 ? (
          <div className="col-span-full py-12 text-center bg-white rounded-2xl border border-slate-200 text-slate-400 text-xs font-medium">
            No medical records found matching criteria.
          </div>
        ) : (
          filtered.map((rec) => {
            let statusBadge = 'bg-slate-100 text-slate-700 border-slate-200';
            if (rec.status === 'Active Treatment') statusBadge = 'bg-rose-100 text-rose-800 border-rose-300 font-extrabold';
            else if (rec.status === 'Rehab / Field Work') statusBadge = 'bg-amber-100 text-amber-800 border-amber-300 font-extrabold';
            else if (rec.status === 'Cleared for Training') statusBadge = 'bg-emerald-100 text-emerald-800 border-emerald-300 font-extrabold';

            return (
              <div key={rec.id} className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-5 space-y-4 hover:shadow-md transition-shadow relative">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">{rec.playerName}</h3>
                    <p className="text-xs font-bold text-rose-600 mt-0.5">{rec.injuryType}</p>
                  </div>
                  <span className={`text-[10px] font-mono px-2 py-0.5 rounded border ${statusBadge}`}>
                    {rec.status}
                  </span>
                </div>

                <div className="space-y-1.5 text-xs text-slate-600 bg-slate-50 p-3 rounded-xl border border-slate-100">
                  <div className="flex justify-between">
                    <span className="text-slate-400 font-semibold">Severity:</span>
                    <span className="font-bold text-slate-800">{rec.severity}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400 font-semibold">Injury Date:</span>
                    <span className="font-mono text-slate-800">{rec.injuryDate}</span>
                  </div>
                  {rec.estimatedReturnDate && (
                    <div className="flex justify-between">
                      <span className="text-slate-400 font-semibold">Est. Return:</span>
                      <span className="font-mono text-emerald-600 font-bold">{rec.estimatedReturnDate}</span>
                    </div>
                  )}
                </div>

                <p className="text-xs text-slate-500 line-clamp-3 leading-relaxed italic">
                  "{rec.treatmentNotes || 'No specific treatment notes entered.'}"
                </p>

                <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
                  <span>Physio: {rec.physioName}</span>
                  <div className="flex items-center space-x-1">
                    <button
                      type="button"
                      onClick={() => handleOpenEdit(rec)}
                      className="p-1 hover:bg-slate-100 text-slate-500 rounded-md"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(rec.id, rec.playerName)}
                      className="p-1 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded-md"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Modal Dialog */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-5 animate-fadeIn">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900">
                {editingRecord ? 'Edit Medical Record' : 'Log New Medical Injury'}
              </h3>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Select Player *
                </label>
                <select
                  required
                  value={formData.playerId}
                  onChange={(e) => setFormData({ ...formData, playerId: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:border-rose-500"
                >
                  {squadPlayers.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.firstName} {p.lastName} (#{p.number || '-'} {p.position})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Injury Diagnosis *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.injuryType}
                    onChange={(e) => setFormData({ ...formData, injuryType: e.target.value })}
                    placeholder="e.g. Ankle Sprain Grade II"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:border-rose-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Injury Date
                  </label>
                  <input
                    type="date"
                    required
                    value={formData.injuryDate}
                    onChange={(e) => setFormData({ ...formData, injuryDate: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:border-rose-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Severity
                  </label>
                  <select
                    value={formData.severity}
                    onChange={(e) => setFormData({ ...formData, severity: e.target.value as PhysioRecord['severity'] })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:border-rose-500"
                  >
                    <option value="Mild">Mild (1-7 days)</option>
                    <option value="Moderate">Moderate (2-4 weeks)</option>
                    <option value="Severe">Severe (1+ month)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Current Status
                  </label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value as PhysioRecord['status'] })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:border-rose-500"
                  >
                    <option value="Active Treatment">Active Treatment</option>
                    <option value="Rehab / Field Work">Rehab / Field Work</option>
                    <option value="Cleared for Training">Cleared for Training</option>
                    <option value="Closed">Closed</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Est. Return Date
                </label>
                <input
                  type="date"
                  value={formData.estimatedReturnDate}
                  onChange={(e) => setFormData({ ...formData, estimatedReturnDate: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:border-rose-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Treatment & Physio Protocol Notes
                </label>
                <textarea
                  rows={3}
                  value={formData.treatmentNotes}
                  onChange={(e) => setFormData({ ...formData, treatmentNotes: e.target.value })}
                  placeholder="Ice therapy, EMS protocol, light isometric loading..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:border-rose-500"
                />
              </div>

              <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-rose-600 hover:bg-rose-500 text-white text-xs font-extrabold rounded-xl transition-colors shadow-md shadow-rose-600/30 flex items-center space-x-1"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>Save Medical Log</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
