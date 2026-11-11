import { AuditResponse, MockParcel, VersionDiff } from '../types/audit';
import { ParcelDetails, ParcelFeatureCollection } from '../types/parcel';

const BASE_URL = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');
const API_BASE = `${BASE_URL}/api/v1`;

export async function auditPlan(
  file: File,
  parcelId: string,
  maxPermittedFloors: number,
  minColumnDimMm: number,
  county: string = 'Nairobi City County',
  zoningZone: string = 'Nairobi Zone 14'
): Promise<AuditResponse> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('parcel_id', parcelId);
  formData.append('county', county);
  formData.append('zoning_zone', zoningZone);
  formData.append('max_permitted_floors', maxPermittedFloors.toString());
  formData.append('min_column_dim_mm', minColumnDimMm.toString());

  const response = await fetch(`${API_BASE}/plans/audit`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || `Audit request failed with status ${response.status}`);
  }

  return response.json();
}

export async function loadSampleAudit(
  sampleName: 'violating' | 'compliant',
  maxPermittedFloors = 4,
  minColumnDimMm = 200,
  county = 'Nairobi City County',
  zoningZone = 'Nairobi Zone 14 (Kasarani / Pipeline)'
): Promise<AuditResponse> {
  const params = new URLSearchParams({
    max_permitted_floors: maxPermittedFloors.toString(),
    min_column_dim_mm: minColumnDimMm.toString(),
    county,
    zoning_zone: zoningZone,
  });

  const response = await fetch(`${API_BASE}/plans/sample-audit/${sampleName}?${params.toString()}`);
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || `Failed to load sample: ${response.statusText}`);
  }

  return response.json();
}

export async function checkHealth(): Promise<{ status: string; ifcopenshell_version: string }> {
  const response = await fetch(`${BASE_URL}/health`);
  if (!response.ok) {
    throw new Error('Backend offline');
  }
  return response.json();
}

export async function loadMockParcels(): Promise<MockParcel[]> {
  const response = await fetch(`${API_BASE}/parcels`);
  if (!response.ok) {
    throw new Error(`Failed to load mock parcel records: ${response.statusText}`);
  }
  const data: ParcelFeatureCollection = await response.json();
  return data.features.map((feature) => ({
    id: feature.properties.id,
    lr_number: feature.properties.lr_number,
    county: feature.properties.county,
    zone: feature.properties.zone,
    permitted_storeys: feature.properties.permitted_storeys,
    source: feature.properties.source,
    last_updated: feature.properties.last_updated,
  }));
}

export async function getParcelFeatures(bbox?: string): Promise<ParcelFeatureCollection> {
  const query = bbox ? `?bbox=${encodeURIComponent(bbox)}` : '';
  const response = await fetch(`${API_BASE}/parcels${query}`);
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || `Failed to load parcels: ${response.statusText}`);
  }
  return response.json();
}

export async function getParcelDetails(parcelId: string): Promise<ParcelDetails> {
  const response = await fetch(`${API_BASE}/parcels/${encodeURIComponent(parcelId)}`);
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || `Failed to load parcel: ${response.statusText}`);
  }
  return response.json();
}

export async function linkAuditToParcel(parcelId: string, auditId: string): Promise<void> {
  const response = await fetch(`${API_BASE}/parcels/${encodeURIComponent(parcelId)}/link-audit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ audit_id: auditId }),
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || `Failed to link audit: ${response.statusText}`);
  }
}

export async function comparePlans(approvedFile: File, currentFile: File): Promise<VersionDiff> {
  const formData = new FormData();
  formData.append('approved_file', approvedFile);
  formData.append('current_file', currentFile);
  const response = await fetch(`${API_BASE}/plans/compare`, { method: 'POST', body: formData });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || `Version comparison failed with status ${response.status}`);
  }
  return response.json();
}
