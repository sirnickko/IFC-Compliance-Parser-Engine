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
    <div className="h-full flex flex-col bg-slate-900/60 border-r border-slate-800 p-5 overflow-y-auto">
      <div className="flex items-center gap-2 mb-4">
        <div className="p-2 bg-rose-500/10 text-rose-400 rounded-lg border border-rose-500/20">
          <ShieldAlert className="w-5 h-5 text-rose-400" />
        </div>
        <div>
          <h2 className="text-sm font-bold text-white tracking-tight">Kenya Municipal BIM Ingestion</h2>
          <p className="text-xs text-slate-400">NCA & County Code Verification</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4 flex-1 flex flex-col">
        {/* Kenyan Disaster Collapse Profiles */}
        <div className="p-3 bg-slate-800/40 rounded-xl border border-slate-700/60 space-y-2">
          <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider flex items-center justify-between">
            <span>Kenyan Case Profiles</span>
            <span className="text-[9px] text-cyan-400 font-mono">1-Click Test</span>
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
              className="p-2 rounded-lg bg-rose-950/40 hover:bg-rose-900/50 border border-rose-800/60 hover:border-rose-600 text-left transition group active:scale-95 disabled:opacity-50"
            >
              <div className="text-[10px] font-bold text-rose-300 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                Kasarani Collapse Profile
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
              className="p-2 rounded-lg bg-emerald-950/40 hover:bg-emerald-900/50 border border-emerald-800/60 hover:border-emerald-600 text-left transition group active:scale-95 disabled:opacity-50"
            >
              <div className="text-[10px] font-bold text-emerald-300 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
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
              ? 'border-cyan-400 bg-cyan-950/20 scale-[0.99]'
              : selectedFile
              ? 'border-emerald-500/50 bg-emerald-950/10 hover:border-emerald-400'
              : 'border-slate-700/80 bg-slate-900/50 hover:border-slate-600 hover:bg-slate-800/40'
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
              <div className="w-12 h-12 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto ring-1 ring-emerald-500/40">
                <FileCheck className="w-6 h-6" />
              </div>
              <p className="text-xs font-semibold text-emerald-300 break-all max-w-[220px]">
                {selectedFile.name}
              </p>
              <p className="text-[10px] text-slate-400 font-mono">
                {(selectedFile.size / 1024).toFixed(1)} KB • ArchiCAD/Revit IFC
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="w-12 h-12 rounded-full bg-slate-800 text-cyan-400 flex items-center justify-center mx-auto border border-slate-700">
                <UploadCloud className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs font-medium text-slate-200">
                  <span className="text-cyan-400 font-semibold">Upload IFC Model</span> (ArchiCAD / Revit)
                </p>
                <p className="text-[10px] text-slate-500 mt-1 font-mono">
                  Supported formats: IFC 2X3, IFC 4 (.ifc, .step)
                </p>
              </div>
            </div>
          )}
        </div>

        {errorMessage && (
          <div className="p-3 bg-rose-950/50 border border-rose-800/60 rounded-lg text-xs text-rose-300 flex items-start gap-2 animate-in fade-in">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Kenya Municipal Controls */}
        <div className="space-y-3 pt-2">
          {/* County & Zone Selection */}
          <div>
            <label className="text-[11px] font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5 mb-1">
              <MapPin className="w-3.5 h-3.5 text-cyan-400" />
              County & Urban Planning Zone
            </label>
            <select
              value={selectedZoneKey}
              onChange={(e) => handleZoneChange(e.target.value)}
              className="w-full bg-slate-800/90 border border-slate-700 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 rounded-lg px-2.5 py-2 text-xs font-sans text-slate-100 outline-none transition"
            >
              {Object.entries(KENYAN_ZONES).map(([key, item]) => (
                <option key={key} value={key} className="bg-slate-900 text-slate-100">
                  {item.label}
                </option>
              ))}
            </select>
          </div>

          {/* Parcel ID / L.R. No. */}
          <div>
            <label className="text-[11px] font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5 mb-1">
              <Building className="w-3.5 h-3.5 text-cyan-400" />
              Cadastral Parcel (L.R. Number)
            </label>
            <input
              type="text"
              required
              value={parcelId}
              onChange={(e) => setParcelId(e.target.value)}
              placeholder="e.g. L.R. 209/8402 (Nairobi) or RUIRU/BLOCK 2/451"
              className="w-full bg-slate-800/90 border border-slate-700 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 rounded-lg px-3 py-2 text-xs font-mono text-slate-100 placeholder:text-slate-600 outline-none transition"
            />
          </div>

          {/* Permitted Storeys Limit */}
          <div>
            <label className="text-[11px] font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5 mb-1">
              <Layers className="w-3.5 h-3.5 text-amber-400" />
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
                className="w-full bg-slate-800/90 border border-slate-700 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 rounded-lg px-3 py-2 text-xs font-mono text-slate-100 outline-none transition"
              />
              <span className="absolute right-3 top-2 text-[11px] font-mono text-slate-500">
                floors max
              </span>
            </div>
            <p className="text-[10px] text-slate-500 mt-1">
              Physical Planning Act 2019: Extra floors trigger <span className="text-rose-400 font-mono">ERR_STOREY_EXCEEDED</span>.
            </p>
          </div>

          {/* Min Column Dimension */}
          <div>
            <label className="text-[11px] font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5 mb-1">
              <Ruler className="w-3.5 h-3.5 text-emerald-400" />
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
                className="w-full bg-slate-800/90 border border-slate-700 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 rounded-lg px-3 py-2 text-xs font-mono text-slate-100 outline-none transition"
              />
              <span className="absolute right-3 top-2 text-[11px] font-mono text-slate-500">
                mm
              </span>
            </div>
            <p className="text-[10px] text-slate-500 mt-1">
              Columns below 200 mm trigger <span className="text-rose-400 font-mono">ERR_UNDERSIZED_COLUMN</span>.
            </p>
          </div>
        </div>

        <button
          type="submit"
          id="run-audit-btn"
          disabled={isLoading || !selectedFile}
          className="w-full mt-4 py-2.5 px-4 bg-gradient-to-r from-rose-600 via-cyan-600 to-blue-600 hover:from-rose-500 hover:to-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-bold tracking-wide uppercase rounded-xl shadow-lg shadow-rose-600/20 flex items-center justify-center gap-2 transition active:scale-[0.98]"
        >
          {isLoading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin text-white" />
              <span>Verifying Against Kenya Codes...</span>
            </>
          ) : (
            <>
              <FileText className="w-4 h-4 text-cyan-200" />
              <span>Run Kenya Municipal Audit</span>
            </>
          )}
        </button>

        {auditResult && (
          <div className="mt-4 pt-4 border-t border-slate-800 animate-in fade-in">
            <div className="p-3 bg-slate-800/70 rounded-xl border border-slate-700/80 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Hash className="w-3.5 h-3.5 text-cyan-400" />
                  SHA-256 Plan Fingerprint
                </span>
                <button
                  type="button"
                  onClick={handleCopyHash}
                  className="flex items-center gap-1 text-[10px] font-mono text-cyan-400 hover:text-cyan-300 bg-cyan-950/80 hover:bg-cyan-900 border border-cyan-800 px-2 py-0.5 rounded transition"
                  title="Copy SHA-256 Hash"
                >
                  {copiedHash ? (
                    <>
                      <Check className="w-3 h-3 text-emerald-400" />
                      <span className="text-emerald-400">Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3" />
                      <span>Copy</span>
                    </>
                  )}
                </button>
              </div>

              <div className="p-2 bg-slate-950/80 rounded-lg border border-slate-800 font-mono text-[10px] text-cyan-300 break-all select-all leading-tight">
                {auditResult.file_sha256}
              </div>

              <div className="text-[10px] text-slate-400 flex items-center justify-between">
                <span>Audited:</span>
                <span className="font-mono text-slate-300">
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
