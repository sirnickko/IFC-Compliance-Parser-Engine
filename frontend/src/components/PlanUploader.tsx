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
} from 'lucide-react';
import { AuditFormValues, AuditResponse } from '../types/audit';

interface PlanUploaderProps {
  onAudit: (formValues: AuditFormValues) => Promise<void>;
  auditResult: AuditResponse | null;
  isLoading: boolean;
}

export const PlanUploader: React.FC<PlanUploaderProps> = ({
  onAudit,
  auditResult,
  isLoading,
}) => {
  const [parcelId, setParcelId] = useState('MUN-PARCEL-8402');
  const [maxPermittedFloors, setMaxPermittedFloors] = useState<number>(4);
  const [minColumnDimMm, setMinColumnDimMm] = useState<number>(200);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [copiedHash, setCopiedHash] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

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
      setErrorMessage('Please select a valid Industry Foundation Classes (.ifc) file.');
      return;
    }
    setSelectedFile(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!selectedFile) {
      setErrorMessage('Please upload or drag & drop an IFC file to audit.');
      return;
    }

    try {
      await onAudit({
        parcelId,
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
        <div className="p-2 bg-blue-500/10 text-blue-400 rounded-lg border border-blue-500/20">
          <UploadCloud className="w-5 h-5" />
        </div>
        <div>
          <h2 className="text-sm font-bold text-white tracking-tight">Plan Ingestion & Zoning</h2>
          <p className="text-xs text-slate-400">Deterministic Municipal Code Parameters</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4 flex-1 flex flex-col">
        <div className="p-3 bg-slate-800/40 rounded-xl border border-slate-700/60 space-y-2">
          <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider flex items-center justify-between">
            <span>Quick Test Fixtures</span>
            <span className="text-[9px] text-cyan-400 font-mono">1-Click Load</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              id="quick-load-violating-btn"
              onClick={() => onAudit({ parcelId: 'PARCEL-VIOLATING-01', maxPermittedFloors: 4, minColumnDimMm: 200, file: null, sampleName: 'violating' } as any)}
              disabled={isLoading}
              className="p-2 rounded-lg bg-rose-950/40 hover:bg-rose-900/50 border border-rose-800/60 hover:border-rose-600 text-left transition group active:scale-95 disabled:opacity-50"
            >
              <div className="text-[10px] font-bold text-rose-300 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                Violating Tower
              </div>
              <div className="text-[9px] text-slate-400 mt-0.5 font-mono">8F • 150mm col</div>
            </button>

            <button
              type="button"
              id="quick-load-compliant-btn"
              onClick={() => onAudit({ parcelId: 'PARCEL-COMPLIANT-01', maxPermittedFloors: 4, minColumnDimMm: 200, file: null, sampleName: 'compliant' } as any)}
              disabled={isLoading}
              className="p-2 rounded-lg bg-emerald-950/40 hover:bg-emerald-900/50 border border-emerald-800/60 hover:border-emerald-600 text-left transition group active:scale-95 disabled:opacity-50"
            >
              <div className="text-[10px] font-bold text-emerald-300 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                Compliant Model
              </div>
              <div className="text-[9px] text-slate-400 mt-0.5 font-mono">4F • 300mm col</div>
            </button>
          </div>
        </div>

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
                {(selectedFile.size / 1024).toFixed(1)} KB • Click to swap file
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="w-12 h-12 rounded-full bg-slate-800 text-cyan-400 flex items-center justify-center mx-auto border border-slate-700">
                <UploadCloud className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs font-medium text-slate-200">
                  <span className="text-cyan-400 font-semibold">Click to upload</span> or drag IFC model
                </p>
                <p className="text-[10px] text-slate-500 mt-1 font-mono">
                  Supports IFC2X3 & IFC4 (.ifc, .step)
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

        <div className="space-y-3 pt-2">
          <div>
            <label className="text-[11px] font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5 mb-1">
              <Building className="w-3.5 h-3.5 text-cyan-400" />
              Parcel / Cadastral ID
            </label>
            <input
              type="text"
              required
              value={parcelId}
              onChange={(e) => setParcelId(e.target.value)}
              placeholder="e.g. ZONE-DISTRICT-4A"
              className="w-full bg-slate-800/90 border border-slate-700 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 rounded-lg px-3 py-2 text-xs font-mono text-slate-100 placeholder:text-slate-600 outline-none transition"
            />
          </div>

          <div>
            <label className="text-[11px] font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5 mb-1">
              <Layers className="w-3.5 h-3.5 text-amber-400" />
              Permitted Storeys Limit
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
              Storeys exceeding this count trigger <span className="text-rose-400 font-mono">ERR_STOREY_EXCEEDED</span>.
            </p>
          </div>

          <div>
            <label className="text-[11px] font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5 mb-1">
              <Ruler className="w-3.5 h-3.5 text-emerald-400" />
              Min Column Dimension
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
              Columns below this cross-section trigger <span className="text-rose-400 font-mono">ERR_UNDERSIZED_COLUMN</span>.
            </p>
          </div>
        </div>

        <button
          type="submit"
          id="run-audit-btn"
          disabled={isLoading || !selectedFile}
          className="w-full mt-4 py-2.5 px-4 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-bold tracking-wide uppercase rounded-xl shadow-lg shadow-cyan-600/25 flex items-center justify-center gap-2 transition active:scale-[0.98]"
        >
          {isLoading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin text-white" />
              <span>Auditing Structural Plan...</span>
            </>
          ) : (
            <>
              <FileText className="w-4 h-4 text-cyan-200" />
              <span>Run Structural Audit</span>
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
                <span>Timestamp:</span>
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
