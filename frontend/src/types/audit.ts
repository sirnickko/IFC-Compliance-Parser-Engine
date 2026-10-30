export type Severity = 'CRITICAL' | 'WARNING' | 'INFO';

export type OverallStatus = 'APPROVED' | 'FLAGGED_FOR_REVIEW' | 'REJECTED';

export interface Finding {
  id: string;
  severity: Severity;
  title: string;
  element_guids: string[];
  storey_names?: string[] | null;
  details: string;
  structural_risk: string;
  recommendation: string;
  standard_ref?: string | null;
  statutory_action?: string | null;
}

export interface StoreyInfo {
  name: string;
  global_id: string;
  elevation_m: number;
  height_m?: number | null;
}

export interface BuildingMetadata {
  project_name?: string | null;
  schema_version?: string | null;
  creation_timestamp?: string | null;
  authoring_application?: string | null;
  total_storeys: number;
  storeys: StoreyInfo[];
  total_building_height_m?: number | null;
  total_columns: number;
  total_stairs: number;
}

export interface AuditSummary {
  total_elements_audited: number;
  total_findings: number;
  critical_count: number;
  warning_count: number;
  passed_checks: number;
  overall_status: OverallStatus;
}

export interface Element3DGeometry {
  guid: string;
  name: string;
  type: string;
  storey?: string | null;
  position: [number, number, number];
  dimensions: [number, number, number];
  color_hint?: string | null;
}

export interface AuditResponse {
  file_sha256: string;
  parcel_id: string;
  county?: string;
  zoning_zone?: string;
  audit_timestamp: string;
  overall_status: OverallStatus;
  metadata: BuildingMetadata;
  summary: AuditSummary;
  findings: Finding[];
  elements_3d: Element3DGeometry[];
}

export interface AuditFormValues {
  parcelId: string;
  county?: string;
  zoningZone?: string;
  maxPermittedFloors: number;
  minColumnDimMm: number;
  file: File | null;
}
