/**
 * Login Page
 *
 * Simple email + password authentication form using Supabase Auth.
 */

import React, { useState, useCallback } from 'react';
import { useAuth } from './AuthProvider';

export function LoginPage() {
    const { signIn } = useAuth();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    const handleSubmit = useCallback(async (e: React.FormEvent) => {
        e.preventDefault();
        if (!email.trim() || !password) return;

        setError(null);
        setLoading(true);
        try {
            const result = await signIn(email.trim(), password);
            if (result.error) {
                setError(result.error);
            }
        } finally {
            setLoading(false);
        }
    }, [email, password, signIn]);

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-950 px-4">
            <div className="w-full max-w-sm">
                {/* Logo / Brand */}
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-blue-600 mb-4">
                        <svg className="w-9 h-9 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                    </div>
                    <h1 className="text-2xl font-bold text-white">Barack Mercosul</h1>
                    <p className="text-gray-400 text-sm mt-1">Ingenieria de Manufactura</p>
                </div>

                {/* Login form */}
                <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 shadow-xl">
                    <h2 className="text-lg font-semibold text-white mb-5">Iniciar sesion</h2>

                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label htmlFor="email" className="block text-sm font-medium text-gray-300 mb-1.5">
                                Correo electronico
                            </label>
                            <input
                                id="email"
                                type="email"
                                value={email}
                                onChange={e => setEmail(e.target.value)}
                                placeholder="nombre@empresa.com"
                                required
                                autoComplete="email"
                                className="w-full px-3.5 py-2.5 bg-gray-800 border border-gray-700 rounded-lg
                                           text-white placeholder-gray-500 text-sm
                                           focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                                           transition-colors"
                            />
                        </div>

                        <div>
                            <label htmlFor="password" className="block text-sm font-medium text-gray-300 mb-1.5">
                                Contrasena
                            </label>
                            <input
                                id="password"
                                type="password"
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                                placeholder="••••••••"
                                required
                                autoComplete="current-password"
                                className="w-full px-3.5 py-2.5 bg-gray-800 border border-gray-700 rounded-lg
                                           text-white placeholder-gray-500 text-sm
                                           focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                                           transition-colors"
                            />
                        </div>

                        {error && (
                            <div className="flex items-start gap-2.5 p-3 bg-red-950/50 border border-red-800/50 rounded-lg">
                                <svg className="w-4 h-4 text-red-400 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                        d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                <p className="text-red-300 text-sm">{error}</p>
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={loading || !email.trim() || !password}
                            className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-900
                                       disabled:text-blue-700 text-white font-medium text-sm rounded-lg
                                       transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500
                                       focus:ring-offset-2 focus:ring-offset-gray-900 flex items-center justify-center gap-2"
                        >
                            {loading ? (
                                <>
                                    <div className="w-4 h-4 border-2 border-blue-300 border-t-transparent rounded-full animate-spin" />
                                    Ingresando...
                                </>
                            ) : (
                                'Ingresar'
                            )}
                        </button>
                    </form>

                    <p className="text-center text-xs text-gray-600 mt-4">
                        Contacta a tu administrador si no tenes acceso.
                    </p>

                    {/* ⚠️ DEV-LOGIN BUTTON — DO NOT REMOVE — See .claude/rules/dev-login.md
                        This button has been accidentally deleted 3+ times. It is NOT dead code.
                        It is critical infrastructure for visual verification of the application. */}
                    {import.meta.env.VITE_AUTO_LOGIN_EMAIL && (
                        <button
                            type="button"
                            onClick={async () => {
                                const devEmail = import.meta.env.VITE_AUTO_LOGIN_EMAIL;
                                const devPassword = import.meta.env.VITE_AUTO_LOGIN_PASSWORD;
                                if (!devEmail || !devPassword) {
                                    setError('Faltan VITE_AUTO_LOGIN_EMAIL o VITE_AUTO_LOGIN_PASSWORD en .env.local');
                                    return;
                                }
                                setEmail(devEmail);
                                setPassword(devPassword);
                                setError(null);
                                setLoading(true);
                                try {
                                    const result = await signIn(devEmail, devPassword);
                                    if (result.error) setError(result.error);
                                } finally {
                                    setLoading(false);
                                }
                            }}
                            disabled={loading}
                            className="w-full mt-3 py-2 px-4 border-2 border-amber-500 bg-transparent
                                       hover:bg-amber-500/10 text-amber-400 font-medium text-sm rounded-lg
                                       transition-colors disabled:opacity-50"
                        >
                            Acceso rapido (dev)
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
