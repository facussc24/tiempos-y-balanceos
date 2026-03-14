/**
 * DataManagerCard
 *
 * Reusable card component for the Data Manager screen.
 * Displays a section with icon, title, and content area.
 */
import React from 'react';

interface DataManagerCardProps {
    icon: React.ReactNode;
    title: string;
    description?: string;
    children: React.ReactNode;
    className?: string;
}

export const DataManagerCard: React.FC<DataManagerCardProps> = ({
    icon, title, description, children, className = '',
}) => {
    return (
        <div className={`bg-slate-800 rounded-xl border border-slate-700 overflow-hidden ${className}`}>
            {/* Card Header */}
            <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-700/50">
                <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-slate-700/50">
                    {icon}
                </div>
                <div>
                    <h3 className="font-semibold text-white text-sm">{title}</h3>
                    {description && (
                        <p className="text-xs text-slate-400 mt-0.5">{description}</p>
                    )}
                </div>
            </div>

            {/* Card Content */}
            <div className="p-5">
                {children}
            </div>
        </div>
    );
};

export default DataManagerCard;
