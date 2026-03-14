import React from 'react';
import { Link2 } from 'lucide-react';

interface SyncStatusIndicatorProps {
    alertCount: number;
    onClick: () => void;
}

const SyncStatusIndicator: React.FC<SyncStatusIndicatorProps> = ({ alertCount, onClick }) => {
    return (
        <button
            onClick={onClick}
            className="relative p-1.5 rounded hover:bg-gray-100 transition"
            title={alertCount > 0 ? `${alertCount} alerta(s) de sincronización` : 'Documentos sincronizados'}
        >
            <Link2 size={14} className={alertCount > 0 ? 'text-amber-500' : 'text-green-500'} />
            {alertCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 bg-amber-500 text-white text-[7px] font-bold rounded-full w-3.5 h-3.5 flex items-center justify-center">
                    {alertCount}
                </span>
            )}
        </button>
    );
};

export default SyncStatusIndicator;
