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
  source_document?: string | null;
  clause_reference?: string | null;
  last_reviewed?: string | null;
  status?: string | null;
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

export type CheckStatusValue = 'Passed' | 'Failed' | 'Could not check';

export interface CheckStatus {
  id: string;
  name: string;
  status: CheckStatusValue;
  detail: string;
}

export interface Element3DGeometry {
  guid: string;
  name: string;
  type: string;
  storey?: string | null;
  position: [number, number, number];
  dimensions: [number, number, number];
  color_hint?: string | null;
  change_status?: 'added' | 'removed' | 'changed';
}

export interface VersionDiff {
  storeys_added: string[];
  storeys_removed: string[];
  columns_added: Element3DGeometry[];
  columns_removed: Element3DGeometry[];
  added_elements: Element3DGeometry[];
  removed_elements: Element3DGeometry[];
  columns_changed: Array<{
    guid: string;
    name: string;
    approved_section_mm: [number, number] | null;
    current_section_mm: [number, number] | null;
  }>;
  approved_height_m: number | null;
  current_height_m: number | null;
  height_change_m: number | null;
  approved_footprint_area_m2: number | null;
  current_footprint_area_m2: number | null;
  footprint_change_m2: number | null;
  statuses: Record<string, CheckStatusValue>;
}

export interface AuditResponse {
  audit_id?: string | null;
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
  checks: CheckStatus[];
  version_diff?: VersionDiff | null;
}

export interface AuditFormValues {
  parcelId: string;
  county?: string;
  zoningZone?: string;
  maxPermittedFloors: number;
  minColumnDimMm: number;
  file: File | null;
  sampleName?: 'violating' | 'compliant';
}

export interface MockParcel {
  id: string;
  lr_number: string;
  county: string;
  zone: string;
  permitted_storeys: number;
  source: 'MOCK DEMO DATA';
  last_updated: string;
}
