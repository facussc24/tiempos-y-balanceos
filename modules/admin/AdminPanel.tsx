/**
 * AdminPanel — User management for admins
 *
 * Lists all registered users, allows inviting new ones,
 * and toggling active/inactive status.
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
    ArrowLeft, Users, UserPlus, ShieldCheck, ShieldOff,
    Loader2, RefreshCw, X, Eye, EyeOff, Copy, Check,
    Shield, User,
} from 'lucide-react';
import { ConfirmModal } from '../../components/modals/ConfirmModal';
import {
    listUsers, toggleUserActive, createUser, setUserRole,
    type AdminUser,
} from '../../utils/repositories/adminRepository';
import { useAuth } from '../../components/auth/AuthProvider';
import { Breadcrumb } from '../../components/navigation/Breadcrumb';
import { logger } from '../../utils/logger';

interface AdminPanelProps {
    onBackToLanding: () => void;
}

// ---------------------------------------------------------------------------
// Password generator
// ---------------------------------------------------------------------------

function generateTempPassword(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
    let pwd = '';
    for (let i = 0; i < 12; i++) {
        pwd += chars[Math.floor(Math.random() * chars.length)];
    }
    return pwd;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const AdminPanel: React.FC<AdminPanelProps> = ({ onBackToLanding }) => {
    const { user } = useAuth();

    // Users list
    const [users, setUsers] = useState<AdminUser[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Invite form
    const [showInvite, setShowInvite] = useState(false);
    const [inviteEmail, setInviteEmail] = useState('');
    const [inviteName, setInviteName] = useState('');
    const [invitePassword, setInvitePassword] = useState(() => generateTempPassword());
    const [showPassword, setShowPassword] = useState(false);
    const [inviting, setInviting] = useState(false);
    const [inviteError, setInviteError] = useState<string | null>(null);
    const [inviteSuccess, setInviteSuccess] = useState<string | null>(null);
    const [copiedPassword, setCopiedPassword] = useState(false);

    // Toggle confirm
    const [toggleTarget, setToggleTarget] = useState<AdminUser | null>(null);
    const [toggling, setToggling] = useState(false);

    // ---------------------------------------------------------------------------
    // Load users
    // ---------------------------------------------------------------------------

    const loadUsers = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await listUsers();
            setUsers(data);
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            setError(msg);
            logger.error('AdminPanel', 'Failed to load users', { error: msg });
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { loadUsers(); }, [loadUsers]);

    // ---------------------------------------------------------------------------
    // Invite user
    // ---------------------------------------------------------------------------

    const handleInvite = async () => {
        if (!inviteEmail.trim()) { setInviteError('El email es obligatorio'); return; }
        if (!invitePassword.trim() || invitePassword.length < 6) {
            setInviteError('La contraseña debe tener al menos 6 caracteres');
            return;
        }

        setInviting(true);
        setInviteError(null);
        setInviteSuccess(null);

        try {
            const { error: err } = await createUser(
                inviteEmail.trim(),
                invitePassword,
                inviteName.trim() || inviteEmail.split('@')[0],
            );

            if (err) {
                setInviteError(err);
            } else {
                setInviteSuccess(`Usuario ${inviteEmail.trim()} creado. Compartí la contraseña temporal.`);
                // Refresh list
                await loadUsers();
            }
        } catch (err) {
            setInviteError(err instanceof Error ? err.message : String(err));
        } finally {
            setInviting(false);
        }
    };

    const resetInviteForm = () => {
        setShowInvite(false);
        setInviteEmail('');
        setInviteName('');
        setInvitePassword(generateTempPassword());
        setShowPassword(false);
        setInviteError(null);
        setInviteSuccess(null);
        setCopiedPassword(false);
    };

    const handleCopyPassword = async () => {
        try {
            await navigator.clipboard.writeText(invitePassword);
            setCopiedPassword(true);
            setTimeout(() => setCopiedPassword(false), 2000);
        } catch {
            // Fallback: select the input
        }
    };

    // ---------------------------------------------------------------------------
    // Toggle active/inactive
    // ---------------------------------------------------------------------------

    const handleToggleConfirm = async () => {
        if (!toggleTarget) return;
        setToggling(true);
        try {
            const shouldBan = !toggleTarget.banned_until;
            await toggleUserActive(toggleTarget.id, shouldBan);
            await loadUsers();
            setToggleTarget(null);
        } catch (err) {
            logger.error('AdminPanel', 'Toggle user failed', { error: String(err) });
            setError(err instanceof Error ? err.message : String(err));
            setToggleTarget(null);
        } finally {
            setToggling(false);
        }
    };

    // ---------------------------------------------------------------------------
    // Toggle role
    // ---------------------------------------------------------------------------

    const handleToggleRole = async (targetUser: AdminUser) => {
        const newRole = targetUser.role === 'admin' ? 'user' : 'admin';
        try {
            await setUserRole(targetUser.id, newRole);
            await loadUsers();
        } catch (err) {
            setError(err instanceof Error ? err.message : String(err));
        }
    };

    // ---------------------------------------------------------------------------
    // Helpers
    // ---------------------------------------------------------------------------

    const formatDate = (iso: string | null) => {
        if (!iso) return '—';
        try {
            const d = new Date(iso);
            if (isNaN(d.getTime())) return '—';
            return d.toLocaleDateString('es-AR', {
                day: '2-digit', month: 'short', year: 'numeric',
            });
        } catch { return '—'; }
    };

    const formatDateTime = (iso: string | null) => {
        if (!iso) return 'Nunca';
        try {
            const d = new Date(iso);
            if (isNaN(d.getTime())) return 'Nunca';
            return d.toLocaleDateString('es-AR', {
                day: '2-digit', month: 'short', year: 'numeric',
                hour: '2-digit', minute: '2-digit',
            });
        } catch { return 'Nunca'; }
    };

    const isActive = (u: AdminUser) => !u.banned_until;
    const isSelf = (u: AdminUser) => u.id === user?.id;

    // ---------------------------------------------------------------------------
    // Render
    // ---------------------------------------------------------------------------

    return (
        <div className="min-h-full bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 font-sans">
            <div className="max-w-6xl mx-auto px-6 py-8">

                {/* Header */}
                <header className="flex items-center gap-4 mb-8">
                    <button
                        onClick={onBackToLanding}
                        className="p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                        title="Volver al inicio"
                    >
                        <ArrowLeft size={20} />
                    </button>
                    <div className="bg-violet-500/15 w-11 h-11 rounded-lg flex items-center justify-center">
                        <Users size={22} className="text-violet-400" />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold text-white">Administración de Usuarios</h1>
                        <p className="text-sm text-slate-400">Gestionar usuarios y permisos</p>
                    </div>
                    <div className="flex-grow" />
                    <button
                        onClick={loadUsers}
                        disabled={loading}
                        className="p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors disabled:opacity-50"
                        title="Refrescar"
                    >
                        <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
                    </button>
                    <button
                        onClick={() => { resetInviteForm(); setShowInvite(true); }}
                        className="flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium rounded-lg transition-colors"
                    >
                        <UserPlus size={16} />
                        Nuevo usuario
                    </button>
                </header>

                <Breadcrumb
                    items={[
                        { label: 'Inicio', onClick: onBackToLanding },
                        { label: 'Administración', isActive: true },
                    ]}
                    className="mb-6 px-2 py-1"
                />

                {/* Error banner */}
                {error && (
                    <div className="mb-6 bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3 flex items-start gap-3">
                        <ShieldOff size={18} className="text-red-400 flex-shrink-0 mt-0.5" />
                        <div className="flex-grow">
                            <p className="text-sm text-red-300">{error}</p>
                        </div>
                        <button onClick={() => setError(null)} className="text-red-400 hover:text-red-300" title="Cerrar error">
                            <X size={16} />
                        </button>
                    </div>
                )}

                {/* Invite form (inline panel) */}
                {showInvite && (
                    <div className="mb-6 bg-white/[0.04] border border-violet-500/30 rounded-xl p-6">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-base font-bold text-white flex items-center gap-2">
                                <UserPlus size={18} className="text-violet-400" />
                                Crear nuevo usuario
                            </h2>
                            <button onClick={resetInviteForm} className="text-slate-400 hover:text-white" title="Cerrar formulario">
                                <X size={18} />
                            </button>
                        </div>

                        {inviteSuccess ? (
                            <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg px-4 py-3">
                                <p className="text-sm text-emerald-300 mb-3">{inviteSuccess}</p>
                                <div className="flex items-center gap-2 bg-black/20 rounded-lg px-3 py-2">
                                    <span className="text-xs text-slate-400">Contraseña:</span>
                                    <code className="text-sm text-white font-mono flex-grow">{invitePassword}</code>
                                    <button
                                        onClick={handleCopyPassword}
                                        className="text-slate-400 hover:text-white transition-colors"
                                        title="Copiar"
                                    >
                                        {copiedPassword ? <Check size={16} className="text-emerald-400" /> : <Copy size={16} />}
                                    </button>
                                </div>
                                <button
                                    onClick={resetInviteForm}
                                    className="mt-3 text-xs text-violet-400 hover:text-violet-300 font-medium"
                                >
                                    Cerrar
                                </button>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs text-slate-400 mb-1">Email *</label>
                                    <input
                                        type="email"
                                        value={inviteEmail}
                                        onChange={(e) => setInviteEmail(e.target.value)}
                                        placeholder="usuario@empresa.com"
                                        className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-violet-500/50"
                                        autoFocus
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs text-slate-400 mb-1">Nombre</label>
                                    <input
                                        type="text"
                                        value={inviteName}
                                        onChange={(e) => setInviteName(e.target.value)}
                                        placeholder="Juan Pérez"
                                        className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-violet-500/50"
                                    />
                                </div>
                                <div className="sm:col-span-2">
                                    <label className="block text-xs text-slate-400 mb-1">Contraseña temporal</label>
                                    <div className="flex items-center gap-2">
                                        <div className="relative flex-grow">
                                            <input
                                                type={showPassword ? 'text' : 'password'}
                                                value={invitePassword}
                                                onChange={(e) => setInvitePassword(e.target.value)}
                                                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-violet-500/50 pr-20"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setShowPassword(!showPassword)}
                                                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                                                title={showPassword ? 'Ocultar' : 'Mostrar'}
                                            >
                                                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                            </button>
                                        </div>
                                        <button
                                            onClick={handleCopyPassword}
                                            className="p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                                            title="Copiar contraseña"
                                        >
                                            {copiedPassword ? <Check size={16} className="text-emerald-400" /> : <Copy size={16} />}
                                        </button>
                                        <button
                                            onClick={() => setInvitePassword(generateTempPassword())}
                                            className="p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                                            title="Generar nueva contraseña"
                                        >
                                            <RefreshCw size={16} />
                                        </button>
                                    </div>
                                    <p className="text-xs text-slate-500 mt-1">
                                        Compartí esta contraseña con el usuario. Puede cambiarla después.
                                    </p>
                                </div>

                                {inviteError && (
                                    <div className="sm:col-span-2 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">
                                        <p className="text-xs text-red-300">{inviteError}</p>
                                    </div>
                                )}

                                <div className="sm:col-span-2 flex justify-end gap-3">
                                    <button
                                        onClick={resetInviteForm}
                                        className="px-4 py-2 text-sm text-slate-400 hover:text-white transition-colors"
                                    >
                                        Cancelar
                                    </button>
                                    <button
                                        onClick={handleInvite}
                                        disabled={inviting}
                                        className="flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-60"
                                    >
                                        {inviting ? (
                                            <><Loader2 size={16} className="animate-spin" /> Creando...</>
                                        ) : (
                                            <><UserPlus size={16} /> Crear usuario</>
                                        )}
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* Users table */}
                {loading ? (
                    <div className="flex items-center justify-center py-20">
                        <Loader2 size={32} className="text-violet-400 animate-spin" />
                    </div>
                ) : users.length === 0 ? (
                    <div className="text-center py-20">
                        <Users size={40} className="mx-auto mb-3 text-slate-600" />
                        <p className="text-slate-400">No se encontraron usuarios</p>
                    </div>
                ) : (
                    <div className="bg-white/[0.04] border border-white/10 rounded-xl overflow-hidden">
                        <table className="w-full">
                            <thead>
                                <tr className="border-b border-white/10">
                                    <th className="text-left text-xs font-bold text-slate-400 uppercase tracking-wider px-4 py-3">Usuario</th>
                                    <th className="text-left text-xs font-bold text-slate-400 uppercase tracking-wider px-4 py-3 hidden md:table-cell">Creado</th>
                                    <th className="text-left text-xs font-bold text-slate-400 uppercase tracking-wider px-4 py-3 hidden lg:table-cell">Último acceso</th>
                                    <th className="text-center text-xs font-bold text-slate-400 uppercase tracking-wider px-4 py-3">Rol</th>
                                    <th className="text-center text-xs font-bold text-slate-400 uppercase tracking-wider px-4 py-3">Estado</th>
                                    <th className="text-right text-xs font-bold text-slate-400 uppercase tracking-wider px-4 py-3">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {users.map((u) => (
                                    <tr key={u.id} className={`hover:bg-white/[0.03] transition-colors ${!isActive(u) ? 'opacity-50' : ''}`}>
                                        {/* User info */}
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-3">
                                                <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${
                                                    u.role === 'admin'
                                                        ? 'bg-violet-500/20 text-violet-400'
                                                        : 'bg-slate-500/20 text-slate-400'
                                                }`}>
                                                    {u.role === 'admin' ? <Shield size={16} /> : <User size={16} />}
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="text-sm font-medium text-white truncate">
                                                        {u.display_name || u.email?.split('@')[0] || '—'}
                                                    </p>
                                                    <p className="text-xs text-slate-500 truncate">{u.email}</p>
                                                </div>
                                                {isSelf(u) && (
                                                    <span className="text-[10px] bg-blue-500/20 text-blue-300 px-1.5 py-0.5 rounded-full font-bold flex-shrink-0">
                                                        VOS
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                        {/* Created */}
                                        <td className="px-4 py-3 hidden md:table-cell">
                                            <span className="text-xs text-slate-400">{formatDate(u.created_at)}</span>
                                        </td>
                                        {/* Last sign in */}
                                        <td className="px-4 py-3 hidden lg:table-cell">
                                            <span className="text-xs text-slate-400">{formatDateTime(u.last_sign_in_at)}</span>
                                        </td>
                                        {/* Role */}
                                        <td className="px-4 py-3 text-center">
                                            <span className={`inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full ${
                                                u.role === 'admin'
                                                    ? 'bg-violet-500/20 text-violet-300'
                                                    : 'bg-slate-500/20 text-slate-400'
                                            }`}>
                                                {u.role === 'admin' ? <Shield size={10} /> : <User size={10} />}
                                                {u.role === 'admin' ? 'Admin' : 'Usuario'}
                                            </span>
                                        </td>
                                        {/* Status */}
                                        <td className="px-4 py-3 text-center">
                                            {isActive(u) ? (
                                                <span className="inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300">
                                                    <ShieldCheck size={10} />
                                                    Activo
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full bg-red-500/20 text-red-300">
                                                    <ShieldOff size={10} />
                                                    Inactivo
                                                </span>
                                            )}
                                        </td>
                                        {/* Actions */}
                                        <td className="px-4 py-3 text-right">
                                            <div className="flex items-center justify-end gap-1">
                                                {/* Toggle role (only if not self) */}
                                                {!isSelf(u) && (
                                                    <button
                                                        onClick={() => handleToggleRole(u)}
                                                        className="p-1.5 text-slate-400 hover:text-violet-400 hover:bg-violet-500/10 rounded-lg transition-colors"
                                                        title={u.role === 'admin' ? 'Quitar admin' : 'Hacer admin'}
                                                    >
                                                        {u.role === 'admin' ? <User size={15} /> : <Shield size={15} />}
                                                    </button>
                                                )}
                                                {/* Toggle active (only if not self) */}
                                                {!isSelf(u) && (
                                                    <button
                                                        onClick={() => setToggleTarget(u)}
                                                        className={`p-1.5 rounded-lg transition-colors ${
                                                            isActive(u)
                                                                ? 'text-slate-400 hover:text-red-400 hover:bg-red-500/10'
                                                                : 'text-slate-400 hover:text-emerald-400 hover:bg-emerald-500/10'
                                                        }`}
                                                        title={isActive(u) ? 'Desactivar usuario' : 'Reactivar usuario'}
                                                    >
                                                        {isActive(u) ? <ShieldOff size={15} /> : <ShieldCheck size={15} />}
                                                    </button>
                                                )}
                                                {isSelf(u) && (
                                                    <span className="text-xs text-slate-600 px-2">—</span>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>

                        {/* Footer count */}
                        <div className="border-t border-white/5 px-4 py-2.5 flex items-center justify-between">
                            <span className="text-xs text-slate-500">
                                {users.length} usuario{users.length !== 1 ? 's' : ''} registrado{users.length !== 1 ? 's' : ''}
                            </span>
                            <span className="text-xs text-slate-500">
                                {users.filter(isActive).length} activo{users.filter(isActive).length !== 1 ? 's' : ''}
                            </span>
                        </div>
                    </div>
                )}
            </div>

            {/* Confirm toggle modal */}
            <ConfirmModal
                isOpen={!!toggleTarget}
                onClose={() => setToggleTarget(null)}
                onConfirm={handleToggleConfirm}
                title={toggleTarget && isActive(toggleTarget) ? 'Desactivar usuario' : 'Reactivar usuario'}
                message={
                    toggleTarget
                        ? isActive(toggleTarget)
                            ? `¿Desactivar a ${toggleTarget.display_name || toggleTarget.email}?\nNo podrá iniciar sesión hasta que lo reactives.`
                            : `¿Reactivar a ${toggleTarget.display_name || toggleTarget.email}?\nPodrá volver a iniciar sesión.`
                        : ''
                }
                confirmText={toggleTarget && isActive(toggleTarget) ? 'Desactivar' : 'Reactivar'}
                variant={toggleTarget && isActive(toggleTarget) ? 'danger' : 'info'}
                isLoading={toggling}
            />
        </div>
    );
};

export default AdminPanel;
