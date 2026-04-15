/**
 * Hook for managing the active medios project — CRUD, piece management, auto-save.
 */
import { useState, useEffect, useCallback } from 'react';
import type { MediosProject, MediosPiece, ContainerType } from '../types';
import * as repo from '../repository/mediosRepository';
import { logger } from '../../../utils/logger';

interface UseMediosProjectReturn {
  // Data
  projects: MediosProject[];
  activeProject: MediosProject | null;
  pieces: MediosPiece[];
  containerTypes: ContainerType[];
  loading: boolean;

  // Project actions
  selectProject: (id: string) => Promise<void>;
  createProject: (name: string, description?: string) => Promise<MediosProject | null>;
  updateProject: (updates: Partial<{ name: string; description: string; utilizationRate: number; availableM2: number | null }>) => Promise<void>;
  deleteProject: (id: string) => Promise<void>;

  // Piece actions
  addPiece: (piece: Omit<MediosPiece, 'id' | 'createdAt'>) => Promise<MediosPiece | null>;
  updatePiece: (id: string, updates: Partial<MediosPiece>) => Promise<void>;
  deletePiece: (id: string) => Promise<void>;

  // Container type actions
  addContainerType: (ct: Omit<ContainerType, 'id' | 'createdBy'>) => Promise<ContainerType | null>;
  updateContainerType: (id: string, updates: Partial<ContainerType>) => Promise<void>;
  deleteContainerType: (id: string) => Promise<void>;

  // Refresh
  refresh: () => Promise<void>;
}

const LS_KEY = 'medios_active_project';

export function useMediosProject(): UseMediosProjectReturn {
  const [projects, setProjects] = useState<MediosProject[]>([]);
  const [activeProject, setActiveProject] = useState<MediosProject | null>(null);
  const [pieces, setPieces] = useState<MediosPiece[]>([]);
  const [containerTypes, setContainerTypes] = useState<ContainerType[]>([]);
  const [loading, setLoading] = useState(true);

  // Load projects and container types on mount
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [projs, cts] = await Promise.all([
          repo.listProjects(),
          repo.listContainerTypes(),
        ]);
        if (cancelled) return;
        setProjects(projs);
        setContainerTypes(cts);

        // Restore last active project
        const savedId = localStorage.getItem(LS_KEY);
        if (savedId) {
          const proj = projs.find(p => p.id === savedId);
          if (proj) {
            setActiveProject(proj);
            const pcs = await repo.listPieces(proj.id);
            if (!cancelled) setPieces(pcs);
          }
        }
      } catch (err) {
        logger.error('useMediosProject', 'init failed', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const selectProject = useCallback(async (id: string) => {
    setLoading(true);
    try {
      const proj = await repo.getProject(id);
      setActiveProject(proj);
      if (proj) {
        localStorage.setItem(LS_KEY, proj.id);
        const pcs = await repo.listPieces(proj.id);
        setPieces(pcs);
      } else {
        localStorage.removeItem(LS_KEY);
        setPieces([]);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const createProject = useCallback(async (name: string, description?: string) => {
    const proj = await repo.createProject({ name, description });
    if (proj) {
      setProjects(prev => [proj, ...prev]);
      setActiveProject(proj);
      setPieces([]);
      localStorage.setItem(LS_KEY, proj.id);
    }
    return proj;
  }, []);

  const updateProject = useCallback(async (
    updates: Partial<{ name: string; description: string; utilizationRate: number; availableM2: number | null }>
  ) => {
    if (!activeProject) return;
    const ok = await repo.updateProject(activeProject.id, updates);
    if (ok) {
      setActiveProject(prev => prev ? { ...prev, ...updates } : null);
      setProjects(prev => prev.map(p => p.id === activeProject.id ? { ...p, ...updates } : p));
    }
  }, [activeProject]);

  const deleteProjectFn = useCallback(async (id: string) => {
    const ok = await repo.deleteProject(id);
    if (ok) {
      setProjects(prev => prev.filter(p => p.id !== id));
      if (activeProject?.id === id) {
        setActiveProject(null);
        setPieces([]);
        localStorage.removeItem(LS_KEY);
      }
    }
  }, [activeProject]);

  const addPiece = useCallback(async (piece: Omit<MediosPiece, 'id' | 'createdAt'>) => {
    const created = await repo.createPiece(piece);
    if (created) {
      setPieces(prev => [...prev, created]);
    }
    return created;
  }, []);

  const updatePieceFn = useCallback(async (id: string, updates: Partial<MediosPiece>) => {
    const ok = await repo.updatePiece(id, updates);
    if (ok) {
      setPieces(prev => prev.map(p => p.id === id ? { ...p, ...updates } : p));
    }
  }, []);

  const deletePieceFn = useCallback(async (id: string) => {
    const ok = await repo.deletePiece(id);
    if (ok) {
      setPieces(prev => prev.filter(p => p.id !== id));
    }
  }, []);

  const addContainerType = useCallback(async (ct: Omit<ContainerType, 'id' | 'createdBy'>) => {
    const created = await repo.createContainerType(ct);
    if (created) {
      setContainerTypes(prev => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)));
    }
    return created;
  }, []);

  const updateContainerTypeFn = useCallback(async (id: string, updates: Partial<ContainerType>) => {
    const ok = await repo.updateContainerType(id, updates);
    if (ok) {
      setContainerTypes(prev => prev.map(ct => ct.id === id ? { ...ct, ...updates } : ct));
    }
  }, []);

  const deleteContainerTypeFn = useCallback(async (id: string) => {
    const ok = await repo.deleteContainerType(id);
    if (ok) {
      setContainerTypes(prev => prev.filter(ct => ct.id !== id));
    }
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [projs, cts] = await Promise.all([
        repo.listProjects(),
        repo.listContainerTypes(),
      ]);
      setProjects(projs);
      setContainerTypes(cts);
      if (activeProject) {
        const pcs = await repo.listPieces(activeProject.id);
        setPieces(pcs);
      }
    } finally {
      setLoading(false);
    }
  }, [activeProject]);

  return {
    projects,
    activeProject,
    pieces,
    containerTypes,
    loading,
    selectProject,
    createProject,
    updateProject,
    deleteProject: deleteProjectFn,
    addPiece,
    updatePiece: updatePieceFn,
    deletePiece: deletePieceFn,
    addContainerType,
    updateContainerType: updateContainerTypeFn,
    deleteContainerType: deleteContainerTypeFn,
    refresh,
  };
}
