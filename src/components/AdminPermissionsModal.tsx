import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  Check,
  Plus,
  Save,
  Shield,
  UserCheck,
  Users,
  X
} from 'lucide-react';
import {
  adminCheckAuthUserByEmail,
  adminCreateUserAccount,
  adminSyncIdentityProfilesForEmails,
  type AdminAuthUserStatus
} from '../services/auth/authService';
import { classifySupabaseError } from '../services/supabaseError';
import {
  listIdentityUsersWithPermissions,
  saveUserPermissions
} from '../services/permissions/permissionsService';
import {
  ALL_SECTIONS_LIST,
  type UserPermission
} from '../services/permissions/permissionModel';

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
  const [users, setUsers] = useState<UserPermission[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);

  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserDisplayName, setNewUserDisplayName] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [newUserConfirmPassword, setNewUserConfirmPassword] = useState('');

  const [authStatus, setAuthStatus] = useState<AdminAuthUserStatus | null>(null);
  const [isCheckingAuthStatus, setIsCheckingAuthStatus] = useState(false);
  const [isCreatingUser, setIsCreatingUser] = useState(false);

  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (!isOpen) return;

    const loadUsers = async () => {
      setIsLoadingUsers(true);
      setErrorMsg('');
      try {
        const loaded = await listIdentityUsersWithPermissions();
        setUsers(loaded);
      } catch (error: any) {
        console.error('[AdminPermissionsModal] failed to load users', error);
        setUsers([]);
        setErrorMsg(error?.message || 'Failed to load users from Supabase.');
      } finally {
        setIsLoadingUsers(false);
      }
    };

    void loadUsers();
  }, [isOpen]);

  if (!isOpen) return null;

  const normalizeEmailInput = (value: string) => {
    const clean = value.trim().toLowerCase();
    if (!clean) return '';
    return clean.includes('@') ? clean : `${clean}@alula.com`;
  };

  const handleCheckAuthStatus = async () => {
    setErrorMsg('');

    const clean = normalizeEmailInput(newUserEmail);
    if (!clean) {
      setAuthStatus(null);
      setErrorMsg('Please enter a valid email or username.');
      return null;
    }

    setIsCheckingAuthStatus(true);
    try {
      const status = await adminCheckAuthUserByEmail(clean);
      setAuthStatus(status);
      return status;
    } catch (error: any) {
      setAuthStatus(null);
      setErrorMsg(error?.message || 'Failed to check Auth user status.');
      return null;
    } finally {
      setIsCheckingAuthStatus(false);
    }
  };

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    const clean = normalizeEmailInput(newUserEmail);
    if (!clean) {
      setErrorMsg('Please enter a valid email or username.');
      return;
    }

    if (users.some((u) => u.email.toLowerCase() === clean)) {
      setErrorMsg('This user already exists in the permissions list.');
      return;
    }

    setIsCreatingUser(true);
    try {
      const status = authStatus && authStatus.normalizedEmail === clean
        ? authStatus
        : await handleCheckAuthStatus();

      if (!status) {
        throw new Error('Unable to validate the Auth account status.');
      }

      const isExistingAuthUser = status.authUserExists;

      if (!isExistingAuthUser) {
        if (newUserPassword.length < 6) {
          setErrorMsg('Set a temporary login password of at least 6 characters for this new user.');
          return;
        }
        if (newUserPassword !== newUserConfirmPassword) {
          setErrorMsg('Passwords do not match. Please verify and try again.');
          return;
        }

        await adminCreateUserAccount(clean, newUserPassword);
      }

      await adminSyncIdentityProfilesForEmails([clean]);

      setUsers((prev) => ([
        ...prev,
        {
          email: clean,
          displayName: newUserDisplayName.trim() || clean.split('@')[0],
          isActive: true,
          isAdmin: false,
          allowedSections: []
        }
      ]));

      setNewUserEmail('');
      setNewUserDisplayName('');
      setNewUserPassword('');
      setNewUserConfirmPassword('');
      setAuthStatus(null);
      setSuccessMsg(
        isExistingAuthUser
          ? `Existing Auth user found for ${clean}. Profile synced and user added.`
          : `New Auth account created for ${clean}. Profile linked and user added.`
      );
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (error: any) {
      if (error?.code === 'weak_password') {
        setErrorMsg('Password is too weak (minimum 6 characters required).');
      } else {
        const classified = classifySupabaseError(error);
        setErrorMsg(classified.userMessage);
      }
    } finally {
      setIsCreatingUser(false);
    }
  };

  const handleToggleSection = (userEmail: string, sectionId: (typeof ALL_SECTIONS_LIST)[number]['id']) => {
    setUsers((prev) => prev.map((u) => {
      if (u.email.toLowerCase() !== userEmail.toLowerCase()) return u;
      if (u.isAdmin) return u;
      const has = u.allowedSections.includes(sectionId);
      return {
        ...u,
        allowedSections: has
          ? u.allowedSections.filter((s) => s !== sectionId)
          : [...u.allowedSections, sectionId]
      };
    }));
  };

  const handleToggleAll = (userEmail: string, enableAll: boolean) => {
    setUsers((prev) => prev.map((u) => {
      if (u.email.toLowerCase() !== userEmail.toLowerCase()) return u;
      if (u.isAdmin) return u;
      return {
        ...u,
        allowedSections: enableAll ? ALL_SECTIONS_LIST.map((s) => s.id) : []
      };
    }));
  };

  const handleSaveAll = async () => {
    setErrorMsg('');
    try {
      await saveUserPermissions(users);
      await adminSyncIdentityProfilesForEmails(users.map((user) => user.email));
      setSuccessMsg('User permissions saved successfully.');
      onPermissionsUpdated?.();
      setTimeout(() => {
        setSuccessMsg('');
        onClose();
      }, 1000);
    } catch (error: any) {
      const classified = classifySupabaseError(error);
      setErrorMsg(classified.userMessage);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5 select-none">
      <div className="bg-white rounded-3xl max-w-4xl w-full p-6 shadow-2xl border border-slate-200 flex flex-col max-h-[90vh] space-y-5 animate-fadeIn">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4 shrink-0">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-2xl">
              <Shield className="w-6 h-6 text-emerald-600" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-lg font-black text-[#002142] font-display">Admin Control: User Section Access</h3>
                <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase border border-emerald-300">
                  Admin Profile
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                Manage user identity, active state, and explicit allowed sections.
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

        <form onSubmit={handleAddUser} className="bg-slate-50 p-4 border border-slate-200 rounded-2xl flex flex-col gap-3 shrink-0">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2 flex items-center space-x-2">
              <Users className="w-4 h-4 text-slate-400 shrink-0" />
              <input
                type="text"
                value={newUserEmail}
                onChange={(e) => {
                  setNewUserEmail(e.target.value);
                  setAuthStatus(null);
                  setNewUserPassword('');
                  setNewUserConfirmPassword('');
                }}
                onBlur={() => {
                  if (newUserEmail.trim()) {
                    void handleCheckAuthStatus();
                  }
                }}
                placeholder="New user email e.g. coach2@alula.com or username..."
                className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium focus:outline-none focus:border-emerald-500 text-slate-800"
              />
            </div>

            <input
              type="text"
              value={newUserDisplayName}
              onChange={(e) => setNewUserDisplayName(e.target.value)}
              placeholder="Display name (optional)"
              className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium focus:outline-none focus:border-emerald-500 text-slate-800"
            />
          </div>

          {authStatus?.authUserExists === false && (
            <div className="flex flex-col sm:flex-row items-center gap-3">
              <input
                type="password"
                value={newUserPassword}
                onChange={(e) => setNewUserPassword(e.target.value)}
                placeholder="Temporary login password (min. 6 chars)"
                className="w-full sm:flex-1 bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium focus:outline-none focus:border-emerald-500 text-slate-800"
              />
              <input
                type="password"
                value={newUserConfirmPassword}
                onChange={(e) => setNewUserConfirmPassword(e.target.value)}
                placeholder="Confirm password"
                className="w-full sm:flex-1 bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium focus:outline-none focus:border-emerald-500 text-slate-800"
              />
            </div>
          )}

          <div className="flex flex-col sm:flex-row items-center gap-3">
            {authStatus && (
              <div className="w-full sm:flex-1 text-[11px] font-semibold text-slate-500">
                {authStatus.authUserExists
                  ? 'Auth user exists. Password is not required for assignment.'
                  : 'Auth user not found. Provide a password to create a new account.'}
              </div>
            )}

            <button
              type="button"
              onClick={() => void handleCheckAuthStatus()}
              disabled={isCheckingAuthStatus || isCreatingUser}
              className="w-full sm:w-auto px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-colors cursor-pointer disabled:opacity-60"
            >
              {isCheckingAuthStatus ? 'Checking Auth...' : 'Check Auth User'}
            </button>

            <button
              type="submit"
              disabled={isCreatingUser}
              className="w-full sm:w-auto px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl transition-colors shrink-0 flex items-center justify-center space-x-1 cursor-pointer disabled:opacity-60"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>
                {isCreatingUser
                  ? 'Processing User...'
                  : authStatus?.authUserExists
                  ? 'Add Existing Auth User'
                  : authStatus?.authUserExists === false
                  ? 'Create New Auth User'
                  : 'Add User'}
              </span>
            </button>
          </div>
        </form>

        <div className="flex-1 overflow-y-auto space-y-4 pr-1">
          {isLoadingUsers && (
            <div className="p-3 bg-sky-50 border border-sky-200 rounded-2xl text-sky-900 text-xs font-bold shrink-0">
              Loading users from Supabase...
            </div>
          )}

          {!isLoadingUsers && users.length === 0 && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-2xl text-amber-900 text-xs font-bold shrink-0">
              No active users found in user_profiles.
            </div>
          )}

          {users.map((user) => {
            const allChecked = ALL_SECTIONS_LIST.every((s) => user.allowedSections.includes(s.id));
            const effectiveAllowed = user.isAdmin
              ? ALL_SECTIONS_LIST.map((s) => s.id)
              : user.allowedSections;

            return (
              <div
                key={user.email}
                className="p-4 bg-white border border-slate-200 rounded-2xl shadow-sm space-y-3 hover:border-slate-300 transition-colors"
              >
                <div className="flex items-start justify-between border-b border-slate-100 pb-3 gap-3">
                  <div className="flex items-center space-x-3 min-w-0">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-xs font-extrabold text-white ${
                      user.isAdmin ? 'bg-[#002142]' : 'bg-emerald-700'
                    }`}>
                      {user.email.substring(0, 2).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center space-x-2">
                        <span className="text-sm font-extrabold text-[#002142] truncate">{user.email}</span>
                        {user.isAdmin && (
                          <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase border bg-slate-100 text-slate-800 border-slate-300">
                            Admin
                          </span>
                        )}
                        {!user.isActive && (
                          <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase border bg-amber-50 text-amber-700 border-amber-300">
                            Inactive
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] text-slate-400 font-mono">
                        {effectiveAllowed.length} of {ALL_SECTIONS_LIST.length} sections allowed
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {!user.isAdmin && (
                      <button
                        type="button"
                        onClick={() => handleToggleAll(user.email, !allChecked)}
                        className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-bold rounded-lg transition-colors cursor-pointer"
                      >
                        {allChecked ? 'Deselect All' : 'Select All'}
                      </button>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <label className="space-y-1">
                    <span className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Display Name</span>
                    <input
                      type="text"
                      value={user.displayName || ''}
                      onChange={(e) => {
                        const value = e.target.value;
                        setUsers((prev) => prev.map((u) => (
                          u.email.toLowerCase() === user.email.toLowerCase()
                            ? { ...u, displayName: value }
                            : u
                        )));
                      }}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-2 text-xs"
                      placeholder="Display name"
                    />
                  </label>

                  <label className="space-y-1">
                    <span className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Active User</span>
                    <button
                      type="button"
                      onClick={() => {
                        if (user.isAdmin) return;
                        setUsers((prev) => prev.map((u) => (
                          u.email.toLowerCase() === user.email.toLowerCase()
                            ? { ...u, isActive: !u.isActive }
                            : u
                        )));
                      }}
                      className={`w-full rounded-lg px-2.5 py-2 text-xs font-bold border inline-flex items-center justify-center gap-1.5 ${
                        user.isAdmin
                          ? 'bg-slate-100 text-slate-500 border-slate-300 cursor-default'
                          : user.isActive
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                          : 'bg-amber-50 text-amber-800 border-amber-300'
                      }`}
                    >
                      <UserCheck className="w-3.5 h-3.5" />
                      {user.isAdmin ? 'Admin (always active)' : user.isActive ? 'Active' : 'Inactive'}
                    </button>
                  </label>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 pt-1">
                  {ALL_SECTIONS_LIST.map((sec) => {
                    const isAllowed = effectiveAllowed.includes(sec.id);

                    return (
                      <label
                        key={sec.id}
                        className={`p-2.5 rounded-xl border text-xs font-semibold flex items-center justify-between transition-all select-none ${
                          user.isAdmin
                            ? 'bg-slate-50 border-slate-200 text-slate-500 cursor-not-allowed opacity-80'
                            : isAllowed
                            ? 'bg-emerald-50/80 border-emerald-300 text-emerald-950 shadow-sm cursor-pointer'
                            : 'bg-slate-50 border-slate-200 text-slate-400 hover:bg-slate-100 cursor-pointer'
                        }`}
                      >
                        <div className="flex items-center space-x-2 truncate pr-1">
                          <input
                            type="checkbox"
                            disabled={user.isAdmin}
                            checked={isAllowed}
                            onChange={() => handleToggleSection(user.email, sec.id)}
                            className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer disabled:cursor-not-allowed"
                          />
                          <span className="truncate">{sec.label}</span>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex items-center justify-between pt-3 border-t border-slate-100 shrink-0">
          <p className="text-xs text-slate-400 font-mono">
            Section access is applied from database and enforced by RLS.
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
              <span>Save Changes</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
