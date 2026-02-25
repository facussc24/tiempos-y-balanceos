/**
 * AppShell - V4.1 Main Layout Component
 * 
 * Provides the new dashboard-style layout with:
 * - Dark sidebar navigation
 * - Header with breadcrumb
 * - Main content area
 * 
 * @module AppShell
 * @version 4.1.0
 */
import React, { useState } from 'react';
import {
    LayoutDashboard, Settings, Layers, HelpCircle,
    ChevronLeft, ChevronRight, Menu, User
} from 'lucide-react';
import { Tab } from '../../hooks/useAppNavigation';

// Sidebar navigation items
const NAV_ITEMS: Array<{ id: Tab | 'dashboard'; icon: any; label: string }> = [
    { id: 'dashboard' as Tab, icon: LayoutDashboard, label: 'Dashboard' },
    { id: 'plant', icon: Settings, label: 'Planta' },
    { id: 'mix', icon: Layers, label: 'Modo Mix' },
    { id: 'help', icon: HelpCircle, label: 'Ayuda' },
];

interface AppShellProps {
    children: React.ReactNode;
    activeTab: Tab | 'dashboard';
    onNavigate: (tab: Tab | 'dashboard') => void;
    projectName?: string;
    userName?: string;
}

export const AppShell: React.FC<AppShellProps> = ({
    children,
    activeTab,
    onNavigate,
    projectName,
    userName = 'Usuario'
}) => {
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

    return (
        <div className="flex h-screen bg-[var(--gray-50)]">
            {/* Sidebar */}
            <aside
                className={`
          bg-[var(--sidebar-bg)] text-white flex flex-col
          transition-all duration-300 ease-in-out
          ${sidebarCollapsed ? 'w-16' : 'w-56'}
        `}
            >
                {/* Logo Area */}
                <div className="h-16 flex items-center px-4 border-b border-slate-700">
                    {!sidebarCollapsed && (
                        <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-full bg-[#2563EB] flex items-center justify-center shadow-lg">
                                <span className="text-white font-bold text-lg">B</span>
                            </div>
                            <div className="flex flex-col">
                                <span className="font-semibold text-sm">Barack Mercosul</span>
                                <span className="text-[10px] text-slate-400">Tiempos y Balanceos</span>
                            </div>
                        </div>
                    )}
                    {sidebarCollapsed && (
                        <div className="w-9 h-9 mx-auto rounded-full bg-[#2563EB] flex items-center justify-center shadow-lg">
                            <span className="text-white font-bold text-lg">B</span>
                        </div>
                    )}
                </div>

                {/* Navigation */}
                <nav className="flex-1 py-4 px-2 space-y-1">
                    {NAV_ITEMS.map((item) => {
                        const isActive = activeTab === item.id;
                        return (
                            <button
                                key={item.id}
                                onClick={() => onNavigate(item.id)}
                                className={`
                  w-full flex items-center gap-3 px-3 py-2.5 rounded-lg
                  transition-all duration-200 text-sm font-medium
                  ${isActive
                                        ? 'bg-[var(--sidebar-active)] text-white'
                                        : 'text-slate-400 hover:bg-[var(--sidebar-hover)] hover:text-white'
                                    }
                `}
                                title={sidebarCollapsed ? item.label : undefined}
                            >
                                <item.icon size={20} />
                                {!sidebarCollapsed && <span>{item.label}</span>}
                            </button>
                        );
                    })}
                </nav>

                {/* Collapse Toggle */}
                <div className="p-2 border-t border-slate-700">
                    <button
                        onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                        className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-slate-400 hover:bg-[var(--sidebar-hover)] hover:text-white transition-colors"
                    >
                        {sidebarCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
                        {!sidebarCollapsed && <span className="text-xs">Colapsar</span>}
                    </button>
                </div>
            </aside>

            {/* Main Content Area */}
            <div className="flex-1 flex flex-col overflow-hidden">
                {/* Header */}
                <header className="h-16 bg-[#2563EB] border-b border-blue-700 flex items-center justify-between px-6 shadow-md">
                    {/* Left: Breadcrumb */}
                    <div className="flex items-center gap-4">
                        <h1 className="text-lg font-semibold text-white">
                            {activeTab === 'dashboard' && 'Dashboard'}

                            {activeTab === 'plant' && 'Configuración de Planta'}
                            {activeTab === 'mix' && 'Modo Mix'}
                            {activeTab === 'help' && 'Centro de Ayuda'}
                            {activeTab === 'panel' && projectName}
                            {activeTab === 'tasks' && `${projectName} - Tareas`}
                            {activeTab === 'balance' && `${projectName} - Balanceo`}
                        </h1>
                        {projectName && !['dashboard', 'plant', 'mix', 'help'].includes(activeTab) && (
                            <span className="text-xs text-white/90 bg-white/20 px-2 py-1 rounded">
                                {projectName}
                            </span>
                        )}
                    </div>

                    {/* Right: User info */}
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2 pl-4">
                            <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center text-[#2563EB] text-xs font-bold ring-2 ring-white/30">
                                {userName.charAt(0).toUpperCase()}
                            </div>
                            <span className="text-sm font-medium text-white">{userName}</span>
                        </div>
                    </div>
                </header>

                {/* Page Content */}
                <main className="flex-1 overflow-auto p-6">
                    {children}
                </main>
            </div>
        </div>
    );
};
