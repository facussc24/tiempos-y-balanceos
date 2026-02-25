// hooks/useAppModals.ts
/**
 * Hook for managing all modal states in App.tsx.
 * Extracted to reduce App component complexity.
 */
import { useState, useCallback } from 'react';
import { INITIAL_PROJECT } from '../types';
import { listClients } from '../utils/pathManager';

interface UseAppModalsResult {
    showRevisionHistory: boolean;
    setShowRevisionHistory: React.Dispatch<React.SetStateAction<boolean>>;
    showDiagnosticQA: boolean;
    setShowDiagnosticQA: React.Dispatch<React.SetStateAction<boolean>>;
    showProjectWizard: boolean;
    setShowProjectWizard: React.Dispatch<React.SetStateAction<boolean>>;
    wizardClients: string[];
    setWizardClients: React.Dispatch<React.SetStateAction<string[]>>;
    showCloseModal: boolean;
    setShowCloseModal: React.Dispatch<React.SetStateAction<boolean>>;
    showSyncPanel: boolean;
    setShowSyncPanel: React.Dispatch<React.SetStateAction<boolean>>;
    showStorageConfig: boolean;
    setShowStorageConfig: React.Dispatch<React.SetStateAction<boolean>>;
    showShortcutsHelp: boolean;
    setShowShortcutsHelp: React.Dispatch<React.SetStateAction<boolean>>;
    showCommandPalette: boolean;
    setShowCommandPalette: React.Dispatch<React.SetStateAction<boolean>>;

    /** Opens the project wizard after loading clients list */
    openProjectWizard: () => Promise<void>;
    /** Opens the close project confirmation modal */
    handleCloseProject: () => void;
    /** Confirms closing the project: resets data and navigates to dashboard */
    confirmCloseProject: (
        setData: React.Dispatch<React.SetStateAction<import('../types').ProjectData>>,
        navigateToDashboard: () => void
    ) => void;
}

export function useAppModals(): UseAppModalsResult {
    const [showRevisionHistory, setShowRevisionHistory] = useState(false);
    const [showDiagnosticQA, setShowDiagnosticQA] = useState(false);
    const [showProjectWizard, setShowProjectWizard] = useState(false);
    const [wizardClients, setWizardClients] = useState<string[]>([]);
    const [showCloseModal, setShowCloseModal] = useState(false);
    const [showSyncPanel, setShowSyncPanel] = useState(false);
    const [showStorageConfig, setShowStorageConfig] = useState(false);
    const [showShortcutsHelp, setShowShortcutsHelp] = useState(false);
    const [showCommandPalette, setShowCommandPalette] = useState(false);

    const openProjectWizard = useCallback(async () => {
        const clients = await listClients();
        setWizardClients(clients);
        setShowProjectWizard(true);
    }, []);

    const handleCloseProject = useCallback(() => {
        setShowCloseModal(true);
    }, []);

    const confirmCloseProject = useCallback((
        setData: React.Dispatch<React.SetStateAction<import('../types').ProjectData>>,
        navigateToDashboard: () => void
    ) => {
        setData(INITIAL_PROJECT);
        navigateToDashboard();
        setShowCloseModal(false);
    }, []);

    return {
        showRevisionHistory,
        setShowRevisionHistory,
        showDiagnosticQA,
        setShowDiagnosticQA,
        showProjectWizard,
        setShowProjectWizard,
        wizardClients,
        setWizardClients,
        showCloseModal,
        setShowCloseModal,
        showSyncPanel,
        setShowSyncPanel,
        showStorageConfig,
        setShowStorageConfig,
        showShortcutsHelp,
        setShowShortcutsHelp,
        showCommandPalette,
        setShowCommandPalette,
        openProjectWizard,
        handleCloseProject,
        confirmCloseProject,
    };
}
