import { useState, useEffect, useRef } from 'react';

type NetworkToastState = 'lost' | 'recovered' | null;

interface UseAmfeNetworkToastReturn {
    networkToast: NetworkToastState;
    clearNetworkToast: () => void;
}

export function useAmfeNetworkToast(networkAvailable: boolean): UseAmfeNetworkToastReturn {
    const [networkToast, setNetworkToast] = useState<NetworkToastState>(null);
    const prevNetworkRef = useRef<boolean | null>(null);

    useEffect(() => {
        // Skip the initial render (don't show toast when first mounting)
        if (prevNetworkRef.current === null) {
            prevNetworkRef.current = networkAvailable;
            return;
        }
        const prev = prevNetworkRef.current;
        prevNetworkRef.current = networkAvailable;

        if (prev && !networkAvailable) {
            // Network lost
            setNetworkToast('lost');
        } else if (!prev && networkAvailable) {
            // Network recovered
            setNetworkToast('recovered');
            setTimeout(() => setNetworkToast(null), 3000);
        }
    }, [networkAvailable]);

    const clearNetworkToast = () => setNetworkToast(null);

    return { networkToast, clearNetworkToast };
}
