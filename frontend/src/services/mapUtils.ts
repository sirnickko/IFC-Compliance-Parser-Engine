import { MapFilters, ParcelAuditStatus, ParcelFeature } from '../types/parcel';

export function parcelStatusColor(
  status: ParcelAuditStatus,
  hasUnverifiedRules = false
): string {
  if (status === 'non-compliant') return '#dc2626';
  if (status === 'could_not_check' || hasUnverifiedRules) return '#d97706';
  if (status === 'compliant') return '#16a34a';
  return '#64748b';
}

export function filterParcels(
  features: ParcelFeature[],
  filters: MapFilters
): ParcelFeature[] {
  const search = filters.lrSearch.trim().toLocaleLowerCase();
  return features.filter(({ properties }) => {
    const statusMatches = filters.status === 'all' || properties.audit_status === filters.status;
    const severityMatches = filters.severity === 'all' || properties.highest_severity === filters.severity;
    const zoneMatches = filters.zone === 'all' || properties.zone === filters.zone;
    const searchMatches = !search || properties.lr_number.toLocaleLowerCase().includes(search);
    return statusMatches && severityMatches && zoneMatches && searchMatches;
  });
}

export function getParcelZones(features: ParcelFeature[]): string[] {
  return Array.from(new Set(features.map(({ properties }) => properties.zone))).sort();
}
