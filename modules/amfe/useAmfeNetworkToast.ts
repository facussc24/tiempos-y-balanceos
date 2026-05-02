import { useState, useEffect } from 'react';

type NetworkToastState = 'lost' | 'recovered' | null;

interface UseAmfeNetworkToastReturn {
    networkToast: NetworkToastState;
    clearNetworkToast: () => void;
}

export function useAmfeNetworkToast(networkAvailable: boolean): UseAmfeNetworkToastReturn {
    const [networkToast, setNetworkToast] = useState<NetworkToastState>(null);
    const [prevNetwork, setPrevNetwork] = useState<boolean | null>(null);

    // "Set state during render" pattern (React 19) — detect transicion sin
    // cascada de renders ni setState dentro de effect.
    if (prevNetwork !== networkAvailable) {
        setPrevNetwork(networkAvailable);
        if (prevNetwork === true && !networkAvailable) {
            setNetworkToast('lost');
        } else if (prevNetwork === false && networkAvailable) {
            setNetworkToast('recovered');
        }
        // prevNetwork === null: primer render, sin toast (skip).
    }

    // Auto-dismiss del toast 'recovered' tras 3s. Effect aislado al timer
    // (con cleanup para evitar memory leak si se desmonta).
    useEffect(() => {
        if (networkToast !== 'recovered') return;
        const t = setTimeout(() => setNetworkToast(null), 3000);
        return () => clearTimeout(t);
    }, [networkToast]);

    const clearNetworkToast = () => setNetworkToast(null);

    return { networkToast, clearNetworkToast };
}
