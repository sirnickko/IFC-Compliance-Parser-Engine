import { AuditResponse } from '../types/audit';

const API_BASE = '/api/v1';

export async function auditPlan(
  file: File,
  parcelId: string,
  maxPermittedFloors: number,
  minColumnDimMm: number
): Promise<AuditResponse> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('parcel_id', parcelId);
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
  minColumnDimMm = 200
): Promise<AuditResponse> {
  const params = new URLSearchParams({
    max_permitted_floors: maxPermittedFloors.toString(),
    min_column_dim_mm: minColumnDimMm.toString(),
  });

  const response = await fetch(`${API_BASE}/plans/sample-audit/${sampleName}?${params.toString()}`);
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || `Failed to load sample: ${response.statusText}`);
  }

  return response.json();
}

export async function checkHealth(): Promise<{ status: string; ifcopenshell_version: string }> {
  const response = await fetch('/health');
  if (!response.ok) {
    throw new Error('Backend offline');
  }
  return response.json();
}
