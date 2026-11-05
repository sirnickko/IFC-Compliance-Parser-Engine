import React, { useState, useRef } from 'react';
import {
  UploadCloud,
  FileCheck,
  Hash,
  Copy,
  Check,
  Building,
  Ruler,
  Layers,
  AlertCircle,
  Loader2,
  FileText,
  MapPin,
  ShieldAlert,
} from 'lucide-react';
import { AuditFormValues, AuditResponse } from '../types/audit';

interface PlanUploaderProps {
  onAudit: (formValues: AuditFormValues) => Promise<void>;
  auditResult: AuditResponse | null;
  isLoading: boolean;
}

const KENYAN_ZONES: Record<string, { label: string; county: string; maxFloors: number; minColMm: number }> = {
  nairobi_14: {
    label: 'Nairobi Zone 14: Kasarani / Roysambu / Embakasi',
    county: 'Nairobi City County',
    maxFloors: 4,
    minColMm: 200,
  },
  nairobi_5: {
    label: 'Nairobi Zone 5: Kileleshwa / Kilimani',
    county: 'Nairobi City County',
    maxFloors: 8,
    minColMm: 250,
  },
  nairobi_4: {
    label: 'Nairobi Zone 4: Lavington / Karen / Spring Valley',
    county: 'Nairobi City County',
    maxFloors: 3,
    minColMm: 200,
  },
  kiambu_ruiru: {
    label: 'Kiambu County: Ruiru / Juja Corridor',
    county: 'Kiambu County',
    maxFloors: 4,
    minColMm: 200,
  },
  kiambu_kinoo: {
    label: 'Kiambu County: Kinoo / Kikuyu',
    county: 'Kiambu County',
    maxFloors: 5,
    minColMm: 200,
  },
  mombasa_island: {
    label: 'Mombasa County: Island / Nyali',
    county: 'Mombasa County',
    maxFloors: 6,
    minColMm: 250,
  },
};

export const PlanUploader: React.FC<PlanUploaderProps> = ({
  onAudit,
  auditResult,
  isLoading,
}) => {
  const [county, setCounty] = useState('Nairobi City County');
  const [selectedZoneKey, setSelectedZoneKey] = useState('nairobi_14');
  const [parcelId, setParcelId] = useState('L.R. 209/8402 (Kasarani)');
  const [maxPermittedFloors, setMaxPermittedFloors] = useState<number>(4);
  const [minColumnDimMm, setMinColumnDimMm] = useState<number>(200);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [copiedHash, setCopiedHash] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleZoneChange = (zoneKey: string) => {
    setSelectedZoneKey(zoneKey);
    const z = KENYAN_ZONES[zoneKey];
    if (z) {
      setCounty(z.county);
      setMaxPermittedFloors(z.maxFloors);
      setMinColumnDimMm(z.minColMm);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      validateAndSetFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      validateAndSetFile(e.target.files[0]);
    }
  };

  const validateAndSetFile = (file: File) => {
    setErrorMessage(null);
    if (!file.name.toLowerCase().endsWith('.ifc') && !file.name.toLowerCase().endsWith('.step')) {
      setErrorMessage('Please select a valid Industry Foundation Classes (.ifc) model file exported from ArchiCAD or Revit.');
      return;
    }
    setSelectedFile(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!selectedFile) {
      setErrorMessage('Please upload or drag & drop an IFC model to audit.');
      return;
    }

    try {
      await onAudit({
        parcelId,
        county,
        zoningZone: KENYAN_ZONES[selectedZoneKey]?.label || selectedZoneKey,
        maxPermittedFloors: Number(maxPermittedFloors),
        minColumnDimMm: Number(minColumnDimMm),
        file: selectedFile,
      });
    } catch (err: any) {
      setErrorMessage(err.message || 'Audit execution failed.');
    }
  };

  const handleCopyHash = () => {
    if (!auditResult?.file_sha256) return;
    navigator.clipboard.writeText(auditResult.file_sha256);
    setCopiedHash(true);
    setTimeout(() => setCopiedHash(false), 2000);
  };

  return (
    <div className="h-full flex flex-col bg-white border-r border-slate-200 p-5 overflow-y-auto">
      <div className="flex items-center gap-2.5 mb-4">
        <div className="p-2 bg-slate-900 text-white rounded-lg border border-slate-800 shadow-xs">
          <ShieldAlert className="w-5 h-5 text-white" />
        </div>
        <div>
          <h2 className="text-sm font-bold text-slate-900 tracking-tight">Kenya Municipal Ingestion</h2>
          <p className="text-xs text-slate-500">NCA & County Code Verification</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4 flex-1 flex flex-col">
        {/* Kenyan Disaster Collapse Profiles */}
        <div className="p-3 bg-slate-100 rounded-xl border border-slate-200 space-y-2">
          <div className="text-[10px] font-semibold text-slate-600 uppercase tracking-wider flex items-center justify-between">
            <span>Kenyan Case Profiles</span>
            <span className="text-[9px] text-slate-500 font-mono font-medium">1-Click Test</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              id="quick-load-violating-btn"
              onClick={() => {
                setParcelId('L.R. 209/8402 (Kasarani, Nairobi)');
                setSelectedZoneKey('nairobi_14');
                setMaxPermittedFloors(4);
                setMinColumnDimMm(200);
                onAudit({
                  parcelId: 'L.R. 209/8402 (Kasarani, Nairobi)',
                  county: 'Nairobi City County',
                  zoningZone: 'Nairobi Zone 14 (Kasarani / Pipeline)',
                  maxPermittedFloors: 4,
                  minColumnDimMm: 200,
                  file: null,
                  sampleName: 'violating',
                } as any);
              }}
              disabled={isLoading}
              className="p-2.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-left transition group active:scale-95 disabled:opacity-50 shadow-xs text-white"
            >
              <div className="text-[10px] font-bold text-white flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
                Kasarani Profile
              </div>
              <div className="text-[9px] text-slate-400 mt-0.5 font-mono">8F (+4 illegal) • 150mm col</div>
            </button>

            <button
              type="button"
              id="quick-load-compliant-btn"
              onClick={() => {
                setParcelId('L.R. 209/11204 (Westlands, Nairobi)');
                setSelectedZoneKey('nairobi_14');
                setMaxPermittedFloors(4);
                setMinColumnDimMm(200);
                onAudit({
                  parcelId: 'L.R. 209/11204 (Westlands, Nairobi)',
                  county: 'Nairobi City County',
                  zoningZone: 'Nairobi Zone 14 (Compliant Sector)',
                  maxPermittedFloors: 4,
                  minColumnDimMm: 200,
                  file: null,
                  sampleName: 'compliant',
                } as any);
              }}
              disabled={isLoading}
              className="p-2.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-left transition group active:scale-95 disabled:opacity-50 shadow-xs text-white"
            >
              <div className="text-[10px] font-bold text-white flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                Compliant Block
              </div>
              <div className="text-[9px] text-slate-400 mt-0.5 font-mono">4F • 300mm col • Dual stairs</div>
            </button>
          </div>
        </div>

        {/* Dropzone */}
        <div
          id="dropzone"
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`relative border-2 border-dashed rounded-xl p-6 flex flex-col items-center justify-center text-center cursor-pointer transition-all duration-200 ${
            isDragging
              ? 'border-slate-800 bg-slate-100 scale-[0.99]'
              : selectedFile
              ? 'border-slate-800 bg-slate-100 shadow-xs'
              : 'border-slate-300 bg-slate-50 hover:bg-white hover:border-slate-400 shadow-2xs'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".ifc,.step"
            onChange={handleFileChange}
            className="hidden"
          />

          {selectedFile ? (
            <div className="space-y-2">
              <div className="w-12 h-12 rounded-full bg-slate-900 text-white flex items-center justify-center mx-auto shadow-xs">
                <FileCheck className="w-6 h-6 text-white" />
              </div>
              <p className="text-xs font-semibold text-slate-900 break-all max-w-[220px]">
                {selectedFile.name}
              </p>
              <p className="text-[10px] text-slate-500 font-mono">
                {(selectedFile.size / 1024).toFixed(1)} KB • ArchiCAD/Revit IFC
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="w-12 h-12 rounded-full bg-white text-slate-700 flex items-center justify-center mx-auto border border-slate-200 shadow-xs">
                <UploadCloud className="w-6 h-6 text-slate-600" />
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-800">
                  <span>Upload IFC Model</span> (ArchiCAD / Revit)
                </p>
                <p className="text-[10px] text-slate-500 mt-1 font-mono">
                  Supported formats: IFC 2X3, IFC 4 (.ifc, .step)
                </p>
              </div>
            </div>
          )}
        </div>

        {errorMessage && (
          <div className="p-3 bg-slate-900 border border-slate-800 rounded-lg text-xs text-slate-200 flex items-start gap-2 animate-in fade-in shadow-xs">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Kenya Municipal Controls */}
        <div className="space-y-3 pt-2">
          {/* County & Zone Selection */}
          <div>
            <label className="text-[11px] font-semibold text-slate-700 uppercase tracking-wider flex items-center gap-1.5 mb-1">
              <MapPin className="w-3.5 h-3.5 text-slate-600" />
              County & Urban Planning Zone
            </label>
            <select
              value={selectedZoneKey}
              onChange={(e) => handleZoneChange(e.target.value)}
              className="w-full bg-white border border-slate-300 focus:border-slate-800 focus:ring-1 focus:ring-slate-800 rounded-lg px-2.5 py-2 text-xs font-medium text-slate-800 outline-none transition shadow-2xs"
            >
              {Object.entries(KENYAN_ZONES).map(([key, item]) => (
                <option key={key} value={key} className="text-slate-900">
                  {item.label}
                </option>
              ))}
            </select>
          </div>

          {/* Parcel ID / L.R. No. */}
          <div>
            <label className="text-[11px] font-semibold text-slate-700 uppercase tracking-wider flex items-center gap-1.5 mb-1">
              <Building className="w-3.5 h-3.5 text-slate-600" />
              Cadastral Parcel (L.R. Number)
            </label>
            <input
              type="text"
              required
              value={parcelId}
              onChange={(e) => setParcelId(e.target.value)}
              placeholder="e.g. L.R. 209/8402 (Nairobi) or RUIRU/BLOCK 2/451"
              className="w-full bg-white border border-slate-300 focus:border-slate-800 focus:ring-1 focus:ring-slate-800 rounded-lg px-3 py-2 text-xs font-mono text-slate-800 placeholder:text-slate-400 outline-none transition shadow-2xs"
            />
          </div>

          {/* Permitted Storeys Limit */}
          <div>
            <label className="text-[11px] font-semibold text-slate-700 uppercase tracking-wider flex items-center gap-1.5 mb-1">
              <Layers className="w-3.5 h-3.5 text-slate-600" />
              Permitted Storeys (County Permit)
            </label>
            <div className="relative">
              <input
                type="number"
                min={1}
                max={50}
                required
                value={maxPermittedFloors}
                onChange={(e) => setMaxPermittedFloors(parseInt(e.target.value) || 1)}
                className="w-full bg-white border border-slate-300 focus:border-slate-800 focus:ring-1 focus:ring-slate-800 rounded-lg px-3 py-2 text-xs font-mono text-slate-800 outline-none transition shadow-2xs"
              />
              <span className="absolute right-3 top-2 text-[11px] font-mono text-slate-400">
                floors max
              </span>
            </div>
            <p className="text-[10px] text-slate-500 mt-1">
              Physical and Land Use Planning Act, 2019: Extra floors trigger <span className="text-slate-800 font-mono font-bold">ERR_STOREY_EXCEEDED</span>.
            </p>
          </div>

          {/* Min Column Dimension */}
          <div>
            <label className="text-[11px] font-semibold text-slate-700 uppercase tracking-wider flex items-center gap-1.5 mb-1">
              <Ruler className="w-3.5 h-3.5 text-slate-600" />
              Min Column Section (KS 04-245 / BS 8110)
            </label>
            <div className="relative">
              <input
                type="number"
                min={100}
                max={2000}
                step={10}
                required
                value={minColumnDimMm}
                onChange={(e) => setMinColumnDimMm(parseFloat(e.target.value) || 100)}
                className="w-full bg-white border border-slate-300 focus:border-slate-800 focus:ring-1 focus:ring-slate-800 rounded-lg px-3 py-2 text-xs font-mono text-slate-800 outline-none transition shadow-2xs"
              />
              <span className="absolute right-3 top-2 text-[11px] font-mono text-slate-400">
                mm
              </span>
            </div>
            <p className="text-[10px] text-slate-500 mt-1">
              Columns below 200 mm trigger <span className="text-slate-800 font-mono font-bold">ERR_UNDERSIZED_COLUMN</span>.
            </p>
          </div>
        </div>

        <button
          type="submit"
          id="run-audit-btn"
          disabled={isLoading || !selectedFile}
          className="w-full mt-4 py-2.5 px-4 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-bold tracking-wide uppercase rounded-xl shadow-sm transition active:scale-[0.98]"
        >
          {isLoading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin text-white" />
              <span>Verifying Against Kenya Codes...</span>
            </>
          ) : (
            <>
              <FileText className="w-4 h-4 text-slate-200" />
              <span>Run Kenya Municipal Audit</span>
            </>
          )}
        </button>

        {auditResult && (
          <div className="mt-4 pt-4 border-t border-slate-200 animate-in fade-in">
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                  <Hash className="w-3.5 h-3.5 text-slate-500" />
                  SHA-256 Plan Fingerprint
                </span>
                <button
                  type="button"
                  onClick={handleCopyHash}
                  className="flex items-center gap-1 text-[10px] font-mono text-slate-700 hover:text-slate-900 bg-white hover:bg-slate-100 border border-slate-300 px-2 py-0.5 rounded transition shadow-2xs"
                  title="Copy SHA-256 Hash"
                >
                  {copiedHash ? (
                    <>
                      <Check className="w-3 h-3 text-emerald-600" />
                      <span className="text-emerald-700 font-semibold">Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3" />
                      <span>Copy</span>
                    </>
                  )}
                </button>
              </div>

              <div className="p-2 bg-white rounded-lg border border-slate-200 font-mono text-[10px] text-slate-800 break-all select-all leading-tight shadow-2xs">
                {auditResult.file_sha256}
              </div>

              <div className="text-[10px] text-slate-500 flex items-center justify-between">
                <span>Audited:</span>
                <span className="font-mono text-slate-700 font-medium">
                  {new Date(auditResult.audit_timestamp).toLocaleTimeString()}
                </span>
              </div>
            </div>
          </div>
        )}
      </form>
    </div>
  );
};
