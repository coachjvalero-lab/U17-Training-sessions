import React, { useState } from 'react';
import { 
  X, 
  Shield, 
  UserCheck, 
  Plus, 
  Check, 
  Save, 
  Trash2, 
  Lock, 
  Unlock, 
  CheckSquare, 
  Square,
  AlertCircle,
  Sparkles,
  Users
} from 'lucide-react';
import { PortalSection } from '../types';
import { 
  UserPermission, 
  ALL_SECTIONS_LIST, 
  getUserPermissionsList, 
  saveUserPermissionsList,
  saveUserPermissionsListToCloud
} from '../utils/permissions';

interface AdminPermissionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPermissionsUpdated?: () => void;
}

export const AdminPermissionsModal: React.FC<AdminPermissionsModalProps> = ({
  isOpen,
  onClose,
  onPermissionsUpdated
}) => {
  const [users, setUsers] = useState<UserPermission[]>(() => getUserPermissionsList());
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserRole, setNewUserRole] = useState<UserPermission['role']>('coach');
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  if (!isOpen) return null;

  const getRoleBadgeLabel = (role: UserPermission['role']) => {
    switch (role) {
      case 'admin': return 'Admin';
      case 'coach': return 'Coach';
      case 'fitness_coach': return 'Fitness Coach';
      case 'gk_coach': return 'GK Coach';
      case 'physio': return 'Physio Staff';
      case 'analyst': return 'Video Analyst';
      default: return 'Custom';
    }
  };

  const handleAddUser = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    if (!newUserEmail.trim()) {
      setErrorMsg('Please enter a valid email or username.');
      return;
    }

    let clean = newUserEmail.trim().toLowerCase();
    if (!clean.includes('@')) {
      clean = `${clean}@alula.com`;
    }

    if (users.some(u => u.email.toLowerCase() === clean)) {
      setErrorMsg('This user already exists in the permissions list.');
      return;
    }

    // Default sections based on role
    let defaultAllowed: PortalSection[] = [];
    if (newUserRole === 'admin') {
      defaultAllowed = ALL_SECTIONS_LIST.map(s => s.id);
    } else if (newUserRole === 'coach') {
      defaultAllowed = ['football', 'squad', 'attendance', 'video', 'exercises', 'planning'];
    } else if (newUserRole === 'fitness_coach') {
      defaultAllowed = ['fitness', 'squad', 'attendance', 'exercises', 'planning'];
    } else if (newUserRole === 'gk_coach') {
      defaultAllowed = ['gk', 'squad', 'attendance', 'exercises', 'planning'];
    } else if (newUserRole === 'physio') {
      defaultAllowed = ['physio', 'squad', 'attendance'];
    } else if (newUserRole === 'analyst') {
      defaultAllowed = ['video', 'exercises', 'football', 'planning'];
    } else {
      defaultAllowed = ['football', 'squad'];
    }

    const newUser: UserPermission = {
      email: clean,
      role: newUserRole,
      allowedSections: defaultAllowed
    };

    const updated = [...users, newUser];
    setUsers(updated);
    setNewUserEmail('');
    setSuccessMsg(`User ${clean} added! Adjust tab permissions below.`);
    setTimeout(() => setSuccessMsg(''), 2500);
  };

  const handleToggleSection = (userEmail: string, sectionId: PortalSection) => {
    const updated = users.map(u => {
      if (u.email.toLowerCase() === userEmail.toLowerCase()) {
        const has = u.allowedSections.includes(sectionId);
        const nextAllowed = has 
          ? u.allowedSections.filter(s => s !== sectionId)
          : [...u.allowedSections, sectionId];
        return { ...u, allowedSections: nextAllowed };
      }
      return u;
    });
    setUsers(updated);
  };

  const handleToggleAll = (userEmail: string, enableAll: boolean) => {
    const updated = users.map(u => {
      if (u.email.toLowerCase() === userEmail.toLowerCase()) {
        return {
          ...u,
          allowedSections: enableAll ? ALL_SECTIONS_LIST.map(s => s.id) : []
        };
      }
      return u;
    });
    setUsers(updated);
  };

  const handleRemoveUser = (userEmail: string) => {
    if (userEmail.toLowerCase().startsWith('admin')) {
      alert('Cannot delete default system admin.');
      return;
    }
    const updated = users.filter(u => u.email.toLowerCase() !== userEmail.toLowerCase());
    setUsers(updated);
  };

  const handleSaveAll = () => {
    saveUserPermissionsList(users);
    saveUserPermissionsListToCloud(users);
    setSuccessMsg('User tab permissions saved successfully!');
    if (onPermissionsUpdated) {
      onPermissionsUpdated();
    }
    setTimeout(() => {
      setSuccessMsg('');
      onClose();
    }, 1000);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5 select-none">
      <div className="bg-white rounded-3xl max-w-4xl w-full p-6 shadow-2xl border border-slate-200 flex flex-col max-h-[90vh] space-y-5 animate-fadeIn">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-4 shrink-0">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-2xl">
              <Shield className="w-6 h-6 text-emerald-600" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-lg font-black text-[#002142] font-display">
                  Admin Control: User Tab Permissions
                </h3>
                <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase border border-emerald-300">
                  Admin Profile
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                Limit which tabs & modules each user account can view in the Portal Navigation Hub.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Success / Error Banners */}
        {successMsg && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl text-emerald-800 text-xs font-bold flex items-center space-x-2 shrink-0 animate-fadeIn">
            <Check className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {errorMsg && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-2xl text-rose-800 text-xs font-bold flex items-center space-x-2 shrink-0 animate-fadeIn">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Add User Bar */}
        <form onSubmit={handleAddUser} className="bg-slate-50 p-4 border border-slate-200 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          <div className="flex-1 w-full flex items-center space-x-2">
            <Users className="w-4 h-4 text-slate-400 shrink-0" />
            <input
              type="text"
              value={newUserEmail}
              onChange={(e) => setNewUserEmail(e.target.value)}
              placeholder="Add user email e.g. coach2@alula.com or username..."
              className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium focus:outline-none focus:border-emerald-500 text-slate-800"
            />
          </div>

          <div className="flex items-center space-x-2 w-full sm:w-auto shrink-0">
            <select
              value={newUserRole}
              onChange={(e) => setNewUserRole(e.target.value as any)}
              className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 focus:outline-none focus:border-emerald-500 cursor-pointer"
            >
              <option value="coach">Role: Coach</option>
              <option value="fitness_coach">Role: Fitness Coach</option>
              <option value="gk_coach">Role: GK Coach</option>
              <option value="physio">Role: Physio Staff</option>
              <option value="analyst">Role: Video Analyst</option>
              <option value="admin">Role: Admin</option>
              <option value="custom">Role: Custom</option>
            </select>

            <button
              type="submit"
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl transition-colors shrink-0 flex items-center space-x-1 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add User</span>
            </button>
          </div>
        </form>

        {/* User Permissions Table / Matrix List */}
        <div className="flex-1 overflow-y-auto space-y-4 pr-1">
          {users.map((user) => {
            const isAdminUser = user.email.toLowerCase().startsWith('admin') || user.role === 'admin';
            const allChecked = ALL_SECTIONS_LIST.every(s => user.allowedSections.includes(s.id));

            return (
              <div 
                key={user.email}
                className="p-4 bg-white border border-slate-200 rounded-2xl shadow-sm space-y-3 hover:border-slate-300 transition-colors"
              >
                {/* User Row Header */}
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div className="flex items-center space-x-3">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-xs font-extrabold text-white ${
                      isAdminUser ? 'bg-[#002142]' : 'bg-emerald-700'
                    }`}>
                      {user.email.substring(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="text-sm font-extrabold text-[#002142]">
                          {user.email}
                        </span>
                        
                        {/* Role Selector / Badge */}
                        {isAdminUser ? (
                          <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase border bg-slate-100 text-slate-800 border-slate-300">
                            {getRoleBadgeLabel(user.role)}
                          </span>
                        ) : (
                          <select
                            value={user.role}
                            onChange={(e) => {
                              const newRole = e.target.value as UserPermission['role'];
                              let defaultAllowed: PortalSection[] = [];
                              if (newRole === 'coach') {
                                defaultAllowed = ['football', 'squad', 'attendance', 'video', 'exercises', 'planning'];
                              } else if (newRole === 'fitness_coach') {
                                defaultAllowed = ['fitness', 'squad', 'attendance', 'exercises', 'planning'];
                              } else if (newRole === 'gk_coach') {
                                defaultAllowed = ['gk', 'squad', 'attendance', 'exercises', 'planning'];
                              } else if (newRole === 'physio') {
                                defaultAllowed = ['physio', 'squad', 'attendance'];
                              } else if (newRole === 'analyst') {
                                defaultAllowed = ['video', 'exercises', 'football', 'planning'];
                              } else if (newRole === 'admin') {
                                defaultAllowed = ALL_SECTIONS_LIST.map(s => s.id);
                              } else {
                                defaultAllowed = ['football', 'squad'];
                              }

                              setUsers(users.map(u => 
                                u.email.toLowerCase() === user.email.toLowerCase()
                                  ? { ...u, role: newRole, allowedSections: defaultAllowed }
                                  : u
                              ));
                            }}
                            className="bg-emerald-50 text-emerald-900 border border-emerald-300 rounded-lg px-2 py-0.5 text-[11px] font-bold focus:outline-none cursor-pointer"
                          >
                            <option value="coach">Role: Coach</option>
                            <option value="fitness_coach">Role: Fitness Coach</option>
                            <option value="gk_coach">Role: GK Coach</option>
                            <option value="physio">Role: Physio Staff</option>
                            <option value="analyst">Role: Video Analyst</option>
                            <option value="admin">Role: Admin</option>
                            <option value="custom">Role: Custom</option>
                          </select>
                        )}
                      </div>
                      <span className="text-[11px] text-slate-400 font-mono">
                        {isAdminUser 
                          ? 'Full Admin • All portal tabs unlocked' 
                          : `${user.allowedSections.length} of ${ALL_SECTIONS_LIST.length} tabs permitted`}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    {!isAdminUser && (
                      <button
                        type="button"
                        onClick={() => handleToggleAll(user.email, !allChecked)}
                        className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-bold rounded-lg transition-colors cursor-pointer"
                      >
                        {allChecked ? 'Deselect All' : 'Select All Tabs'}
                      </button>
                    )}

                    {!user.email.toLowerCase().startsWith('admin') && (
                      <button
                        type="button"
                        onClick={() => handleRemoveUser(user.email)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors cursor-pointer"
                        title="Remove User Account"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Section Checkboxes Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 pt-1">
                  {ALL_SECTIONS_LIST.map((sec) => {
                    const isAllowed = isAdminUser || user.allowedSections.includes(sec.id);

                    return (
                      <label
                        key={sec.id}
                        className={`p-2.5 rounded-xl border text-xs font-semibold flex items-center justify-between transition-all select-none ${
                          isAdminUser
                            ? 'bg-slate-50 border-slate-200 text-slate-500 cursor-not-allowed opacity-80'
                            : isAllowed
                            ? 'bg-emerald-50/80 border-emerald-300 text-emerald-950 shadow-sm cursor-pointer'
                            : 'bg-slate-50 border-slate-200 text-slate-400 hover:bg-slate-100 cursor-pointer'
                        }`}
                      >
                        <div className="flex items-center space-x-2 truncate pr-1">
                          <input
                            type="checkbox"
                            disabled={isAdminUser}
                            checked={isAllowed}
                            onChange={() => handleToggleSection(user.email, sec.id)}
                            className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer disabled:cursor-not-allowed"
                          />
                          <span className="truncate">{sec.label}</span>
                        </div>
                        {isAllowed ? (
                          <Unlock className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        ) : (
                          <Lock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        )}
                      </label>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between pt-3 border-t border-slate-100 shrink-0">
          <p className="text-xs text-slate-400 font-mono">
            Permissions apply instantly upon logging into the portal.
          </p>
          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSaveAll}
              className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs rounded-xl transition-colors shadow-md shadow-emerald-600/30 flex items-center space-x-1.5 cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>Save Permissions Changes</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
