import { describe, expect, it } from 'vitest';
import { filterParcels, parcelStatusColor } from './mapUtils';
import { MapFilters, ParcelFeature } from '../types/parcel';

const createFeature = (
  id: string,
  status: ParcelFeature['properties']['audit_status'],
  severity: ParcelFeature['properties']['highest_severity'],
  zone: string,
  lrNumber: string
): ParcelFeature => ({
  type: 'Feature',
  id,
  geometry: { type: 'Polygon', coordinates: [[[36.8, -1.2], [36.9, -1.2], [36.9, -1.1], [36.8, -1.2]]] },
  properties: {
    id,
    lr_number: lrNumber,
    county: 'Nairobi City County',
    zone,
    permitted_storeys: 4,
    source: 'MOCK DEMO DATA',
    last_updated: '2026-01-01',
    audit_status: status,
    violation_count: 1,
    highest_severity: severity,
    audited_at: null,
    model_hash: null,
    audit_id: null,
    has_unverified_rules: false,
  },
});

describe('parcelStatusColor', () => {
  it('maps each audit status to its documented map color', () => {
    expect(parcelStatusColor('non-compliant')).toBe('#dc2626');
    expect(parcelStatusColor('could_not_check')).toBe('#d97706');
    expect(parcelStatusColor('compliant')).toBe('#16a34a');
    expect(parcelStatusColor('unchecked')).toBe('#64748b');
  });

  it('highlights unverified rules as amber', () => {
    expect(parcelStatusColor('compliant', true)).toBe('#d97706');
  });
});

describe('filterParcels', () => {
  const features = [
    createFeature('1', 'non-compliant', 'CRITICAL', 'Residential', 'DEMO-LR-001'),
    createFeature('2', 'compliant', 'INFO', 'Commercial', 'DEMO-LR-002'),
    createFeature('3', 'could_not_check', null, 'Residential', 'DEMO-LR-003'),
  ];
  const defaults: MapFilters = { status: 'all', severity: 'all', zone: 'all', lrSearch: '' };

  it('combines status, severity, zone, and case-insensitive LR search filters', () => {
    const result = filterParcels(features, {
      ...defaults,
      status: 'non-compliant',
      severity: 'CRITICAL',
      zone: 'Residential',
      lrSearch: 'demo-lr-001',
    });
    expect(result.map((feature) => feature.id)).toEqual(['1']);
  });

  it('returns no matches when filters do not match any parcel', () => {
    expect(filterParcels(features, { ...defaults, severity: 'WARNING' })).toEqual([]);
  });
});
