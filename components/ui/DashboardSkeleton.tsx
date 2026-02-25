/**
 * Dashboard Skeleton Loader Component
 * 
 * Provides a loading skeleton for the Dashboard to improve perceived performance.
 * Uses animated pulse effect for a modern loading experience.
 * 
 * @module DashboardSkeleton
 * @version 1.0.0 - UX-02: Skeleton loader implementation
 */

import React from 'react';

/**
 * Skeleton loader component for the Dashboard
 * Displays placeholder UI elements while data is loading
 */
export const DashboardSkeleton: React.FC = () => (
    <div className="animate-shimmer space-y-6 p-6">
        {/* Header Skeleton */}
        <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
                <div className="h-12 w-12 bg-slate-200 rounded-lg"></div>
                <div className="space-y-2">
                    <div className="h-6 w-48 bg-slate-200 rounded"></div>
                    <div className="h-4 w-32 bg-slate-200 rounded"></div>
                </div>
            </div>
            <div className="h-10 w-32 bg-slate-200 rounded-lg"></div>
        </div>

        {/* Filter Bar Skeleton */}
        <div className="flex gap-4">
            <div className="h-10 w-48 bg-slate-200 rounded-lg"></div>
            <div className="h-10 w-48 bg-slate-200 rounded-lg"></div>
            <div className="h-10 flex-1 bg-slate-200 rounded-lg"></div>
        </div>

        {/* Stats Cards Skeleton */}
        <div className="grid grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => (
                <div key={i} className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
                    <div className="h-4 w-20 bg-slate-200 rounded"></div>
                    <div className="h-8 w-16 bg-slate-200 rounded"></div>
                    <div className="h-3 w-24 bg-slate-200 rounded"></div>
                </div>
            ))}
        </div>

        {/* Table Skeleton */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            {/* Table Header */}
            <div className="bg-slate-50 px-6 py-4 border-b border-slate-200">
                <div className="flex gap-4">
                    <div className="h-4 w-32 bg-slate-200 rounded"></div>
                    <div className="h-4 w-24 bg-slate-200 rounded"></div>
                    <div className="h-4 w-28 bg-slate-200 rounded"></div>
                    <div className="h-4 w-20 bg-slate-200 rounded"></div>
                    <div className="h-4 w-16 bg-slate-200 rounded"></div>
                </div>
            </div>

            {/* Table Rows */}
            {[1, 2, 3, 4, 5].map(i => (
                <div key={i} className="px-6 py-4 border-b border-slate-100 flex items-center gap-4">
                    <div className="h-5 w-40 bg-slate-200 rounded"></div>
                    <div className="h-5 w-32 bg-slate-200 rounded"></div>
                    <div className="h-5 w-28 bg-slate-200 rounded"></div>
                    <div className="h-5 w-20 bg-slate-200 rounded"></div>
                    <div className="flex gap-2 ml-auto">
                        <div className="h-8 w-8 bg-slate-200 rounded"></div>
                        <div className="h-8 w-8 bg-slate-200 rounded"></div>
                    </div>
                </div>
            ))}
        </div>
    </div>
);

/**
 * Generic skeleton line for inline use
 */
export const SkeletonLine: React.FC<{ width?: string; height?: string }> = ({
    width = 'w-24',
    height = 'h-4'
}) => (
    <div className={`animate-pulse bg-slate-200 rounded ${width} ${height}`}></div>
);

/**
 * Skeleton card for grid layouts
 */
export const SkeletonCard: React.FC<{ children?: React.ReactNode }> = ({ children }) => (
    <div className="animate-pulse bg-white rounded-xl border border-slate-200 p-4 space-y-3">
        {children || (
            <>
                <div className="h-4 w-3/4 bg-slate-200 rounded"></div>
                <div className="h-8 w-1/2 bg-slate-200 rounded"></div>
                <div className="h-3 w-full bg-slate-200 rounded"></div>
            </>
        )}
    </div>
);
