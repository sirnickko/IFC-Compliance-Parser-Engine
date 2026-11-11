import React, { useEffect, useRef, useState } from 'react';
import { AlertCircle, FileText, Loader2, ShieldAlert, UploadCloud } from 'lucide-react';
import { AuditFormValues, AuditResponse, MockParcel, VersionDiff } from '../types/audit';
import { loadMockParcels } from '../services/api';

interface PlanUploaderProps {
  onAudit: (formValues: AuditFormValues) => Promise<void>;
  onCompare: (approvedFile: File, currentFile: File) => Promise<void>;
  auditResult: AuditResponse | null;
  versionDiff: VersionDiff | null;
  isLoading: boolean;
}

const MAX_FILE_BYTES = 50 * 1024 * 1024;

export const PlanUploader: React.FC<PlanUploaderProps> = ({
  onAudit,
  onCompare,
  auditResult,
  versionDiff,
  isLoading,
}) => {
  const [parcels, setParcels] = useState<MockParcel[]>([]);
  const [selectedParcelId, setSelectedParcelId] = useState('');
  const [mode, setMode] = useState<'audit' | 'compare'>('audit');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [approvedFile, setApprovedFile] = useState<File | null>(null);
  const [currentFile, setCurrentFile] = useState<File | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const selectedParcel = parcels.find((parcel) => parcel.id === selectedParcelId);

  useEffect(() => {
    loadMockParcels()
      .then((records) => {
        setParcels(records);
        if (records.length) setSelectedParcelId(records[0].id);
      })
      .catch((error: Error) => setErrorMessage(error.message));
  }, []);

  const validateFile = (file: File): boolean => {
    if (!file.name.toLowerCase().endsWith('.ifc') && !file.name.toLowerCase().endsWith('.step')) {
      setErrorMessage('Choose an IFC or STEP model file.');
      return false;
    }
    if (file.size > MAX_FILE_BYTES) {
      setErrorMessage('This model exceeds the 50 MiB upload limit. Export a smaller or simplified IFC.');
      return false;
    }
    setErrorMessage(null);
    return true;
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setErrorMessage(null);
    try {
      if (mode === 'compare') {
        if (!approvedFile || !currentFile) {
          setErrorMessage('Choose both the approved and current IFC versions.');
          return;
        }
        await onCompare(approvedFile, currentFile);
        return;
      }
      if (!selectedFile) {
        setErrorMessage('Please upload or drag and drop an IFC model to check.');
        return;
      }
      if (!selectedParcel) {
        setErrorMessage('Select a parcel from the mock parcel records.');
        return;
      }
      await onAudit({
        parcelId: selectedParcel.id,
        county: selectedParcel.county,
        zoningZone: selectedParcel.zone,
        maxPermittedFloors: selectedParcel.permitted_storeys,
        minColumnDimMm: 200,
        file: selectedFile,
      });
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'The IFC operation failed.');
    }
  };

  const setVersionFile = (version: 'approved' | 'current', file?: File) => {
    if (!file || !validateFile(file)) return;
    if (version === 'approved') setApprovedFile(file);
    else setCurrentFile(file);
  };

  return (
    <div className="h-full flex flex-col bg-white border-r border-slate-200 p-5 overflow-y-auto">
      <div className="flex items-center gap-2.5 mb-4">
        <div className="p-2 bg-slate-900 text-white rounded-lg"><ShieldAlert className="w-5 h-5" /></div>
        <div>
          <h2 className="text-sm font-bold text-slate-900">IFC Compliance Check</h2>
          <p className="text-xs text-slate-500">Local deterministic rules — advisory only</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 mb-4">
        <button type="button" onClick={() => setMode('audit')} className={`rounded-lg py-2 text-xs font-semibold ${mode === 'audit' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700'}`}>Single model</button>
        <button type="button" onClick={() => setMode('compare')} className={`rounded-lg py-2 text-xs font-semibold ${mode === 'compare' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700'}`}>Compare versions</button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4 flex-1 flex flex-col">
        {mode === 'audit' ? (
          <>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <label className="block text-[11px] font-semibold uppercase tracking-wide text-slate-700 mb-1">Mock parcel permit record</label>
              <select value={selectedParcelId} onChange={(event) => setSelectedParcelId(event.target.value)} className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-xs">
                {parcels.map((parcel) => <option key={parcel.id} value={parcel.id}>{parcel.lr_number} — {parcel.zone}</option>)}
              </select>
              <p className="mt-1 text-[10px] text-amber-700">Mock data, not an official county permit. Permitted storeys are taken from this record.</p>
              {selectedParcel && <p className="mt-1 text-xs text-slate-700">{selectedParcel.permitted_storeys} storeys · {selectedParcel.county}</p>}
            </div>

            <div
              onDragOver={(event) => { event.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={(event) => {
                event.preventDefault();
                setIsDragging(false);
                const file = event.dataTransfer.files[0];
                if (file && validateFile(file)) setSelectedFile(file);
              }}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer ${isDragging ? 'border-slate-900 bg-slate-100' : 'border-slate-300 bg-slate-50'}`}
            >
              <input ref={fileInputRef} type="file" accept=".ifc,.step" onChange={(event) => {
                const file = event.target.files?.[0];
                if (file && validateFile(file)) setSelectedFile(file);
              }} className="hidden" />
              <UploadCloud className="w-8 h-8 mx-auto text-slate-500" />
              <p className="mt-2 text-xs font-semibold text-slate-800">{selectedFile ? selectedFile.name : 'Upload or drop IFC model'}</p>
              <p className="mt-1 text-[10px] text-slate-500">IFC / STEP · up to 50 MiB</p>
            </div>

            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-[11px] text-amber-900">
              Column dimensions are an engineer review flag, not a pass/fail rule. The 200 mm default and 150/300 mm fixtures are placeholders pending a documented source.
            </div>
          </>
        ) : (
          <div className="space-y-3">
            <label className="block rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs font-semibold text-slate-700">
              Approved version
              <input type="file" accept=".ifc,.step" onChange={(event) => setVersionFile('approved', event.target.files?.[0])} className="mt-2 block w-full text-xs font-normal" />
              {approvedFile && <span className="mt-1 block font-normal">{approvedFile.name}</span>}
            </label>
            <label className="block rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs font-semibold text-slate-700">
              Current version
              <input type="file" accept=".ifc,.step" onChange={(event) => setVersionFile('current', event.target.files?.[0])} className="mt-2 block w-full text-xs font-normal" />
              {currentFile && <span className="mt-1 block font-normal">{currentFile.name}</span>}
            </label>
            {versionDiff && <div className="rounded-xl border border-slate-200 p-3 text-xs text-slate-700">
              <p className="font-bold">Version difference</p>
              <p>Storeys: +{versionDiff.storeys_added.length} / −{versionDiff.storeys_removed.length}</p>
              <p>Columns: +{versionDiff.columns_added.length} / −{versionDiff.columns_removed.length} / {versionDiff.columns_changed.length} section changes</p>
              <p>Height change: {versionDiff.height_change_m === null ? 'Could not check' : `${versionDiff.height_change_m} m`}</p>
              <p>Footprint change: {versionDiff.footprint_change_m2 === null ? 'Could not check' : `${versionDiff.footprint_change_m2} m²`}</p>
              {Object.entries(versionDiff.statuses).map(([name, status]) => <p key={name}>{name}: {status}</p>)}
            </div>}
          </div>
        )}

        {errorMessage && <div className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800"><AlertCircle className="w-4 h-4 shrink-0" />{errorMessage}</div>}

        <button type="submit" disabled={isLoading || (mode === 'audit' ? !selectedFile : !approvedFile || !currentFile)} className="mt-auto w-full rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-bold uppercase text-white disabled:opacity-50">
          {isLoading ? <span className="inline-flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" />Processing IFC…</span> : <span className="inline-flex items-center gap-2"><FileText className="w-4 h-4" />{mode === 'audit' ? 'Run Compliance Check' : 'Compare IFC Versions'}</span>}
        </button>
        {auditResult && <p className="text-[10px] text-slate-500">Checked {new Date(auditResult.audit_timestamp).toLocaleString()} · SHA-256 {auditResult.file_sha256.slice(0, 12)}…</p>}
      </form>
    </div>
  );
};
