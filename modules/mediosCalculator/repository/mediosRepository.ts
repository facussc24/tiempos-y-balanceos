/**
 * Supabase repository for Medios Calculator module.
 * CRUD operations for projects, pieces, and container types.
 */
import { supabase } from '../../../utils/supabaseClient';
import { logger } from '../../../utils/logger';
import type { MediosProject, MediosPiece, ContainerType } from '../types';

// ─── Helper ───────────────────────────────────────────────────────────────────

function mapProject(row: Record<string, unknown>): MediosProject {
  return {
    id: row.id as string,
    name: row.name as string,
    description: (row.description as string) ?? '',
    utilizationRate: (row.utilization_rate as number) ?? 0.55,
    availableM2: (row.available_m2 as number) ?? null,
    createdAt: row.created_at as string | undefined,
    updatedAt: row.updated_at as string | undefined,
    createdBy: row.created_by as string | undefined,
  };
}

function mapPiece(row: Record<string, unknown>): MediosPiece {
  return {
    id: row.id as string,
    projectId: row.project_id as string,
    pieceCode: row.piece_code as string,
    description: (row.description as string) ?? '',
    family: (row.family as string) ?? '',
    client: (row.client as string) ?? '',
    stage: (row.stage as string) ?? '',
    dailyDemand: (row.daily_demand as number) ?? 0,
    leadTimeDays: (row.lead_time_days as number) ?? 0,
    safetyPct: (row.safety_pct as number) ?? 0.15,
    containerTypeId: row.container_type_id as string,
    pcsPerContainer: (row.pcs_per_container as number) ?? 1,
    productId: (row.product_id as number) ?? null,
    sortOrder: (row.sort_order as number) ?? 0,
    createdAt: row.created_at as string | undefined,
  };
}

function mapContainerType(row: Record<string, unknown>): ContainerType {
  return {
    id: row.id as string,
    name: row.name as string,
    lengthMm: row.length_mm as number,
    widthMm: row.width_mm as number,
    heightMm: row.height_mm as number,
    weightRefKg: (row.weight_ref_kg as number) ?? null,
    maxStacking: (row.max_stacking as number) ?? 1,
    defaultPcs: (row.default_pcs as number) ?? null,
    createdBy: row.created_by as string | undefined,
  };
}

// ─── Projects ─────────────────────────────────────────────────────────────────

export async function listProjects(): Promise<MediosProject[]> {
  const { data, error } = await supabase
    .from('medios_projects')
    .select('*')
    .order('updated_at', { ascending: false });
  if (error) { logger.error('mediosRepo', 'listProjects failed', error); return []; }
  return (data ?? []).map(mapProject);
}

export async function getProject(id: string): Promise<MediosProject | null> {
  const { data, error } = await supabase
    .from('medios_projects')
    .select('*')
    .eq('id', id)
    .single();
  if (error) { logger.error('mediosRepo', 'getProject failed', error); return null; }
  return data ? mapProject(data) : null;
}

export async function createProject(
  project: { name: string; description?: string; utilizationRate?: number; availableM2?: number | null }
): Promise<MediosProject | null> {
  const { data, error } = await supabase
    .from('medios_projects')
    .insert({
      name: project.name,
      description: project.description ?? '',
      utilization_rate: project.utilizationRate ?? 0.55,
      available_m2: project.availableM2 ?? null,
    })
    .select()
    .single();
  if (error) { logger.error('mediosRepo', 'createProject failed', error); return null; }
  return data ? mapProject(data) : null;
}

export async function updateProject(
  id: string,
  updates: Partial<{ name: string; description: string; utilizationRate: number; availableM2: number | null }>
): Promise<boolean> {
  const mapped: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (updates.name !== undefined) mapped.name = updates.name;
  if (updates.description !== undefined) mapped.description = updates.description;
  if (updates.utilizationRate !== undefined) mapped.utilization_rate = updates.utilizationRate;
  if (updates.availableM2 !== undefined) mapped.available_m2 = updates.availableM2;

  const { error } = await supabase.from('medios_projects').update(mapped).eq('id', id);
  if (error) { logger.error('mediosRepo', 'updateProject failed', error); return false; }
  return true;
}

export async function deleteProject(id: string): Promise<boolean> {
  const { error } = await supabase.from('medios_projects').delete().eq('id', id);
  if (error) { logger.error('mediosRepo', 'deleteProject failed', error); return false; }
  return true;
}

// ─── Pieces ───────────────────────────────────────────────────────────────────

export async function listPieces(projectId: string): Promise<MediosPiece[]> {
  const { data, error } = await supabase
    .from('medios_pieces')
    .select('*')
    .eq('project_id', projectId)
    .order('sort_order', { ascending: true });
  if (error) { logger.error('mediosRepo', 'listPieces failed', error); return []; }
  return (data ?? []).map(mapPiece);
}

export async function createPiece(piece: Omit<MediosPiece, 'id' | 'createdAt'>): Promise<MediosPiece | null> {
  const { data, error } = await supabase
    .from('medios_pieces')
    .insert({
      project_id: piece.projectId,
      piece_code: piece.pieceCode,
      description: piece.description,
      family: piece.family,
      client: piece.client,
      stage: piece.stage,
      daily_demand: piece.dailyDemand,
      lead_time_days: piece.leadTimeDays,
      safety_pct: piece.safetyPct,
      container_type_id: piece.containerTypeId,
      pcs_per_container: piece.pcsPerContainer,
      product_id: piece.productId,
      sort_order: piece.sortOrder,
    })
    .select()
    .single();
  if (error) { logger.error('mediosRepo', 'createPiece failed', error); return null; }
  return data ? mapPiece(data) : null;
}

export async function updatePiece(
  id: string,
  updates: Partial<Omit<MediosPiece, 'id' | 'projectId' | 'createdAt'>>
): Promise<boolean> {
  const mapped: Record<string, unknown> = {};
  if (updates.pieceCode !== undefined) mapped.piece_code = updates.pieceCode;
  if (updates.description !== undefined) mapped.description = updates.description;
  if (updates.family !== undefined) mapped.family = updates.family;
  if (updates.client !== undefined) mapped.client = updates.client;
  if (updates.stage !== undefined) mapped.stage = updates.stage;
  if (updates.dailyDemand !== undefined) mapped.daily_demand = updates.dailyDemand;
  if (updates.leadTimeDays !== undefined) mapped.lead_time_days = updates.leadTimeDays;
  if (updates.safetyPct !== undefined) mapped.safety_pct = updates.safetyPct;
  if (updates.containerTypeId !== undefined) mapped.container_type_id = updates.containerTypeId;
  if (updates.pcsPerContainer !== undefined) mapped.pcs_per_container = updates.pcsPerContainer;
  if (updates.productId !== undefined) mapped.product_id = updates.productId;
  if (updates.sortOrder !== undefined) mapped.sort_order = updates.sortOrder;

  const { error } = await supabase.from('medios_pieces').update(mapped).eq('id', id);
  if (error) { logger.error('mediosRepo', 'updatePiece failed', error); return false; }
  return true;
}

export async function deletePiece(id: string): Promise<boolean> {
  const { error } = await supabase.from('medios_pieces').delete().eq('id', id);
  if (error) { logger.error('mediosRepo', 'deletePiece failed', error); return false; }
  return true;
}

export async function bulkCreatePieces(
  pieces: Omit<MediosPiece, 'id' | 'createdAt'>[]
): Promise<MediosPiece[]> {
  if (pieces.length === 0) return [];
  const rows = pieces.map(p => ({
    project_id: p.projectId,
    piece_code: p.pieceCode,
    description: p.description,
    family: p.family,
    client: p.client,
    stage: p.stage,
    daily_demand: p.dailyDemand,
    lead_time_days: p.leadTimeDays,
    safety_pct: p.safetyPct,
    container_type_id: p.containerTypeId,
    pcs_per_container: p.pcsPerContainer,
    product_id: p.productId,
    sort_order: p.sortOrder,
  }));
  const { data, error } = await supabase.from('medios_pieces').insert(rows).select();
  if (error) { logger.error('mediosRepo', 'bulkCreatePieces failed', error); return []; }
  return (data ?? []).map(mapPiece);
}

export async function listAllPieces(): Promise<MediosPiece[]> {
  const { data, error } = await supabase
    .from('medios_pieces')
    .select('*')
    .order('sort_order', { ascending: true });
  if (error) { logger.error('mediosRepo', 'listAllPieces failed', error); return []; }
  return (data ?? []).map(mapPiece);
}

// ─── Container Types ──────────────────────────────────────────────────────────

export async function listContainerTypes(): Promise<ContainerType[]> {
  const { data, error } = await supabase
    .from('medios_container_types')
    .select('*')
    .order('name', { ascending: true });
  if (error) { logger.error('mediosRepo', 'listContainerTypes failed', error); return []; }
  return (data ?? []).map(mapContainerType);
}

export async function createContainerType(
  ct: Omit<ContainerType, 'id' | 'createdBy'>
): Promise<ContainerType | null> {
  const { data, error } = await supabase
    .from('medios_container_types')
    .insert({
      name: ct.name,
      length_mm: ct.lengthMm,
      width_mm: ct.widthMm,
      height_mm: ct.heightMm,
      weight_ref_kg: ct.weightRefKg,
      max_stacking: ct.maxStacking,
      default_pcs: ct.defaultPcs,
    })
    .select()
    .single();
  if (error) { logger.error('mediosRepo', 'createContainerType failed', error); return null; }
  return data ? mapContainerType(data) : null;
}

export async function updateContainerType(
  id: string,
  updates: Partial<Omit<ContainerType, 'id' | 'createdBy'>>
): Promise<boolean> {
  const mapped: Record<string, unknown> = {};
  if (updates.name !== undefined) mapped.name = updates.name;
  if (updates.lengthMm !== undefined) mapped.length_mm = updates.lengthMm;
  if (updates.widthMm !== undefined) mapped.width_mm = updates.widthMm;
  if (updates.heightMm !== undefined) mapped.height_mm = updates.heightMm;
  if (updates.weightRefKg !== undefined) mapped.weight_ref_kg = updates.weightRefKg;
  if (updates.maxStacking !== undefined) mapped.max_stacking = updates.maxStacking;
  if (updates.defaultPcs !== undefined) mapped.default_pcs = updates.defaultPcs;

  const { error } = await supabase.from('medios_container_types').update(mapped).eq('id', id);
  if (error) { logger.error('mediosRepo', 'updateContainerType failed', error); return false; }
  return true;
}

export async function deleteContainerType(id: string): Promise<boolean> {
  const { error } = await supabase.from('medios_container_types').delete().eq('id', id);
  if (error) { logger.error('mediosRepo', 'deleteContainerType failed', error); return false; }
  return true;
}
