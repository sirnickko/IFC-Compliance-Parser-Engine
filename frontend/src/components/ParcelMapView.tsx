import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Map as MapLibreMap, NavigationControl, type GeoJSONSource } from 'maplibre-gl';
import { AlertCircle, Loader2, Search, X } from 'lucide-react';
import { AuditResponse, Severity } from '../types/audit';
import {
  MapFilters,
  ParcelAuditStatus,
  ParcelDetails,
  ParcelFeature,
  ParcelFeatureCollection,
  MapLayerDefinition,
} from '../types/parcel';
import { getParcelDetails, getParcelFeatures } from '../services/api';
import { filterParcels, getParcelZones, parcelStatusColor } from '../services/mapUtils';

const EMPTY_FEATURE_COLLECTION: ParcelFeatureCollection = {
  type: 'FeatureCollection',
  features: [],
};
const INITIAL_FILTERS: MapFilters = {
  status: 'all',
  severity: 'all',
  zone: 'all',
  lrSearch: '',
};

export const MAP_LAYERS: MapLayerDefinition[] = [
  { id: 'parcels', sourceType: 'parcel', enabled: true },
  { id: 'detected-new-construction', sourceType: 'detected-construction', enabled: false },
];
const PARCELS_LAYER = MAP_LAYERS.find((layer) => layer.sourceType === 'parcel');

const STATUS_OPTIONS: Array<{ value: ParcelAuditStatus | 'all'; label: string }> = [
  { value: 'all', label: 'All statuses' },
  { value: 'non-compliant', label: 'Non-compliant' },
  { value: 'could_not_check', label: 'Could not check / unverified' },
  { value: 'compliant', label: 'Compliant' },
  { value: 'unchecked', label: 'Unchecked' },
];

interface ParcelMapViewProps {
  active: boolean;
  styleUrl: string;
  onOpenAudit: (result: AuditResponse) => void;
}

export const ParcelMapView: React.FC<ParcelMapViewProps> = ({ active, styleUrl, onOpenAudit }) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const [features, setFeatures] = useState<ParcelFeature[]>([]);
  const [filters, setFilters] = useState<MapFilters>(INITIAL_FILTERS);
  const [selectedParcel, setSelectedParcel] = useState<ParcelDetails | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [mapError, setMapError] = useState<string | null>(null);
  const [parcelError, setParcelError] = useState<string | null>(null);
  const [isMapReady, setIsMapReady] = useState(false);

  const filteredFeatures = useMemo(() => filterParcels(features, filters), [features, filters]);
  const zones = useMemo(() => getParcelZones(features), [features]);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setParcelError(null);
    getParcelFeatures()
      .then((collection) => {
        if (!cancelled) setFeatures(collection.features);
      })
      .catch((error: Error) => {
        if (!cancelled) setParcelError(error.message);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [active]);

  useEffect(() => {
    if (!active || !mapContainerRef.current) return;
    if (mapRef.current) {
      mapRef.current.resize();
      return;
    }
    if (!PARCELS_LAYER) {
      setMapError('Parcel map layer is not configured.');
      return;
    }

    const map = new MapLibreMap({
      container: mapContainerRef.current,
      style: styleUrl,
      center: [36.8882, -1.2131],
      zoom: 15,
    });
    mapRef.current = map;
    map.addControl(new NavigationControl({ showCompass: false }), 'top-right');
    map.on('error', (event) => {
      setMapError(`Map tiles could not be loaded. Check your connection or VITE_MAP_STYLE_URL. ${event.error.message}`);
    });
    map.on('load', () => {
      setIsMapReady(true);
      setMapError(null);
      map.addSource(PARCELS_LAYER.id, {
        type: 'geojson',
        data: EMPTY_FEATURE_COLLECTION,
      });
      map.addLayer({
        id: 'parcel-polygons',
        type: 'fill',
        source: PARCELS_LAYER.id,
        paint: {
          'fill-color': [
            'case',
            ['==', ['get', 'audit_status'], 'non-compliant'], parcelStatusColor('non-compliant'),
            ['any',
              ['==', ['get', 'audit_status'], 'could_not_check'],
              ['==', ['get', 'has_unverified_rules'], true],
            ], parcelStatusColor('could_not_check'),
            ['==', ['get', 'audit_status'], 'compliant'], parcelStatusColor('compliant'),
            parcelStatusColor('unchecked'),
          ],
          'fill-opacity': 0.48,
        },
      });
      map.addLayer({
        id: 'parcel-outlines',
        type: 'line',
        source: PARCELS_LAYER.id,
        paint: {
          'line-color': '#1e293b',
          'line-width': 2,
          'line-dasharray': [2, 1],
        },
      });
      map.on('click', 'parcel-polygons', (event) => {
        const featureId = event.features?.[0]?.properties?.id;
        if (typeof featureId === 'string') {
          void openParcel(featureId);
        }
      });
      map.on('mouseenter', 'parcel-polygons', () => { map.getCanvas().style.cursor = 'pointer'; });
      map.on('mouseleave', 'parcel-polygons', () => { map.getCanvas().style.cursor = ''; });
    });
  }, [active, styleUrl]);

  useEffect(() => () => {
    mapRef.current?.remove();
    mapRef.current = null;
  }, []);

  useEffect(() => {
    if (!PARCELS_LAYER) return;
    const source = mapRef.current?.getSource(PARCELS_LAYER.id) as GeoJSONSource | undefined;
    if (!source) return;
    source.setData({
      ...EMPTY_FEATURE_COLLECTION,
      features: filteredFeatures,
    });
  }, [filteredFeatures, active, isMapReady]);

  const openParcel = async (parcelId: string) => {
    setSelectedParcel(null);
    setDetailError(null);
    try {
      setSelectedParcel(await getParcelDetails(parcelId));
    } catch (error) {
      setDetailError(error instanceof Error ? error.message : 'Could not load parcel details.');
    }
  };

  const latestAudit = selectedParcel?.audit_history[0];
  const latestResult = latestAudit?.audit_result;

  return (
    <div className="h-full min-h-0 flex bg-slate-100">
      <div className="relative min-w-0 flex-1">
        <div ref={mapContainerRef} className="absolute inset-0" />

        <div className="absolute left-3 top-3 z-10 w-[min(360px,calc(100%-24px))] space-y-2 rounded-xl border border-slate-200 bg-white/95 p-3 shadow-lg backdrop-blur">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-bold text-slate-900">Parcel map</h2>
            <span className="rounded-full bg-amber-100 px-2 py-1 text-[10px] font-bold text-amber-900">Demo data</span>
          </div>
          <label className="flex items-center gap-2 rounded-lg border border-slate-300 px-2.5 py-2">
            <Search className="h-4 w-4 text-slate-500" />
            <input
              value={filters.lrSearch}
              onChange={(event) => setFilters({ ...filters, lrSearch: event.target.value })}
              placeholder="Search demo LR number"
              className="min-w-0 flex-1 text-xs outline-none"
              aria-label="Search LR number"
            />
            {filters.lrSearch && <button type="button" aria-label="Clear search" onClick={() => setFilters({ ...filters, lrSearch: '' })}><X className="h-3 w-3" /></button>}
          </label>
          <div className="grid grid-cols-2 gap-2">
            <select aria-label="Filter by status" value={filters.status} onChange={(event) => setFilters({ ...filters, status: event.target.value as MapFilters['status'] })} className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs">
              {STATUS_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
            <select aria-label="Filter by severity" value={filters.severity} onChange={(event) => setFilters({ ...filters, severity: event.target.value as Severity | 'all' })} className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs">
              <option value="all">All severities</option>
              <option value="CRITICAL">Critical</option>
              <option value="WARNING">Warning</option>
              <option value="INFO">Info</option>
            </select>
            <select aria-label="Filter by zone" value={filters.zone} onChange={(event) => setFilters({ ...filters, zone: event.target.value })} className="col-span-2 rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs">
              <option value="all">All zones</option>
              {zones.map((zone) => <option key={zone} value={zone}>{zone}</option>)}
            </select>
          </div>
          <div className="flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-slate-700" aria-label="Parcel status legend">
            <span><strong style={{ color: parcelStatusColor('non-compliant') }}>■ !</strong> Non-compliant</span>
            <span><strong style={{ color: parcelStatusColor('could_not_check') }}>▲ ?</strong> Could not check / unverified</span>
            <span><strong style={{ color: parcelStatusColor('compliant') }}>● ✓</strong> Compliant</span>
            <span><strong style={{ color: parcelStatusColor('unchecked') }}>□ —</strong> Unchecked</span>
          </div>
          <p className="text-[10px] text-slate-600">Advisory only. Not an official planning or approval record.</p>
        </div>

        {(mapError || parcelError) && (
          <div role="alert" className="absolute bottom-3 left-3 right-3 z-10 flex items-start gap-2 rounded-lg border border-rose-300 bg-white p-3 text-xs text-rose-800 shadow">
            <AlertCircle className="h-4 w-4 shrink-0" />{mapError || parcelError}
          </div>
        )}
        {isLoading && <div className="absolute bottom-3 left-3 z-10 flex items-center gap-2 rounded-lg bg-white p-2 text-xs shadow"><Loader2 className="h-4 w-4 animate-spin" />Loading parcels…</div>}
        {!isLoading && !parcelError && filteredFeatures.length === 0 && (
          <div className="absolute bottom-3 left-3 z-10 rounded-lg bg-white p-2 text-xs text-slate-700 shadow">No parcels match these filters.</div>
        )}
      </div>

      <aside className="w-[300px] shrink-0 overflow-y-auto border-l border-slate-200 bg-white p-4">
        {selectedParcel ? (
          <div className="space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="text-sm font-bold text-slate-900">{selectedParcel.properties.lr_number}</h3>
                <p className="text-[10px] text-slate-500">Synthetic demo parcel · no owner data</p>
              </div>
              <button type="button" onClick={() => setSelectedParcel(null)} aria-label="Close parcel details" className="rounded p-1 text-slate-500 hover:bg-slate-100"><X className="h-4 w-4" /></button>
            </div>
            <dl className="space-y-1 text-xs text-slate-700">
              <div className="flex justify-between gap-2"><dt>Zone</dt><dd className="text-right">{selectedParcel.properties.zone}</dd></div>
              <div className="flex justify-between gap-2"><dt>Permitted storeys</dt><dd>{selectedParcel.properties.permitted_storeys}</dd></div>
              <div className="flex justify-between gap-2"><dt>Latest audit</dt><dd>{latestAudit?.audit_status.replace(/_/g, ' ') || 'unchecked'}</dd></div>
              {latestAudit && <div className="flex justify-between gap-2"><dt>Violations / findings</dt><dd>{latestAudit.violation_count}</dd></div>}
              {latestAudit && <div className="flex justify-between gap-2"><dt>Highest severity</dt><dd>{latestAudit.highest_severity || 'None'}</dd></div>}
            </dl>
            <div className="border-t border-slate-200 pt-3">
              <h4 className="text-xs font-bold text-slate-800">Latest findings</h4>
              {!latestResult || latestResult.findings.length === 0 ? (
                <p className="mt-2 text-xs text-slate-500">{latestResult ? 'No findings in this audit.' : 'No audits linked to this demo parcel yet.'}</p>
              ) : (
                <ul className="mt-2 space-y-2">
                  {latestResult.findings.map((finding) => <li key={finding.id} className="rounded-lg border border-slate-200 p-2 text-xs">
                    <span className="font-bold">{finding.severity}: </span>{finding.title}
                    <p className="mt-1 text-slate-600">{finding.details}</p>
                  </li>)}
                </ul>
              )}
            </div>
            {detailError && <p role="alert" className="text-xs text-rose-700">{detailError}</p>}
            <button type="button" disabled={!latestResult} onClick={() => latestResult && onOpenAudit(latestResult)} className="w-full rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">Open 3D model</button>
          </div>
        ) : (
          <div className="pt-8 text-center">
            <p className="text-sm font-semibold text-slate-800">Select a parcel</p>
            <p className="mt-1 text-xs text-slate-500">Click a polygon to view its demo parcel details and linked audit history.</p>
            {isLoading && <p className="mt-4 text-xs text-slate-500">Loading demo parcels…</p>}
            {!isLoading && !parcelError && features.length === 0 && <p className="mt-4 text-xs text-slate-500">No demo parcel records are available.</p>}
          </div>
        )}
      </aside>
    </div>
  );
};
