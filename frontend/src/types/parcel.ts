import { AuditResponse, Severity } from './audit';

export type ParcelAuditStatus = 'compliant' | 'non-compliant' | 'could_not_check' | 'unchecked';

export interface ParcelGeometry {
  type: 'Polygon';
  coordinates: number[][][];
}

export interface ParcelProperties {
  id: string;
  lr_number: string;
  county: string;
  zone: string;
  permitted_storeys: number;
  source: 'MOCK DEMO DATA';
  last_updated: string;
  audit_status: ParcelAuditStatus;
  violation_count: number;
  highest_severity: Severity | null;
  audited_at: string | null;
  model_hash: string | null;
  audit_id: string | null;
  has_unverified_rules: boolean;
}

export interface ParcelFeature {
  type: 'Feature';
  id: string;
  geometry: ParcelGeometry;
  properties: ParcelProperties;
}

export interface ParcelFeatureCollection {
  type: 'FeatureCollection';
  features: ParcelFeature[];
}

export interface ParcelAuditHistoryItem {
  submission_id: string;
  audit_id: string;
  audit_status: ParcelAuditStatus;
  violation_count: number;
  highest_severity: Severity | null;
  audited_at: string;
  model_hash: string;
  audit_result: AuditResponse;
}

export interface ParcelDetails extends ParcelFeature {
  audit_history: ParcelAuditHistoryItem[];
}

export interface MapFilters {
  status: ParcelAuditStatus | 'all';
  severity: Severity | 'all';
  zone: string;
  lrSearch: string;
}

export interface DetectedConstructionProperties {
  detected_at: string;
  confidence: number;
  source_image_date: string;
  matched_parcel_id: string | null;
}

export interface DetectedConstructionFeature {
  type: 'Feature';
  id: string;
  geometry: ParcelGeometry | { type: 'Point'; coordinates: number[] };
  properties: DetectedConstructionProperties;
}

export type MapLayerDefinition =
  | { id: 'parcels'; sourceType: 'parcel'; enabled: true }
  | { id: 'detected-new-construction'; sourceType: 'detected-construction'; enabled: false };
