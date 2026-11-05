import React, { useState } from 'react';
import {
  Shield,
  CheckCircle2,
  AlertTriangle,
  Download,
  Server,
  Zap,
  Info,
} from 'lucide-react';
import { AuditResponse, VersionDiff } from '../types/audit';

interface NavbarProps {
  onLoadSample: (sampleName: 'violating' | 'compliant') => void;
  auditResult: AuditResponse | null;
  backendHealthy: boolean;
  isLoading: boolean;
  versionDiff: VersionDiff | null;
}

export const Navbar: React.FC<NavbarProps> = ({
  onLoadSample,
  auditResult,
  backendHealthy,
  isLoading,
  versionDiff,
}) => {
  const [showSampleDropdown, setShowSampleDropdown] = useState(false);
  const [showInfoModal, setShowInfoModal] = useState(false);

  const handleDownloadReport = () => {
    if (!auditResult) return;
    const reportData = {
      report_title: 'SiteBeta Kenya - Compliance Check Report',
      advisory_notice: 'Advisory only. This is not an official approval, and structural adequacy must be confirmed by a registered engineer.',
      exported_at: new Date().toISOString(),
      version_diff: versionDiff,
      ...auditResult,
    };
    const blob = new Blob([JSON.stringify(reportData, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `SiteBeta-Kenya-Compliance-Report-${auditResult.parcel_id.replace(/[^a-zA-Z0-9]/g, '_')}-${auditResult.file_sha256.slice(0, 8)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <header className="h-16 border-b border-slate-200 bg-white px-6 flex items-center justify-between z-30 select-none shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center shadow-xs text-white font-bold">
            <Shield className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-lg font-extrabold tracking-tight text-slate-900">SiteBeta Kenya</span>
              <span className="text-[10px] font-mono tracking-wider bg-slate-900 text-white px-2.5 py-0.5 rounded-full font-semibold shadow-2xs">
                Based on published Kenyan regulations (see rule sources)
              </span>
            </div>
            <p className="text-xs text-slate-500 hidden sm:block">
              Local geometry checks · advisory only
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div
            className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-100 border border-slate-200 text-xs shadow-2xs"
            title="Local rule engine v0.1 (not connected to government systems)"
          >
            <span
              className={`w-2 h-2 rounded-full ${
                backendHealthy ? 'bg-emerald-500 animate-pulse-subtle shadow-xs shadow-emerald-500' : 'bg-rose-500'
              }`}
            />
            <Server className="w-3.5 h-3.5 text-slate-500" />
            <span className="text-slate-700 font-mono text-[11px] font-medium">
              {backendHealthy ? 'Rule Engine v0.1' : 'Engine Offline'}
            </span>
          </div>

          <div className="relative">
            <button
              id="load-sample-btn"
              onClick={() => setShowSampleDropdown(!showSampleDropdown)}
              disabled={isLoading}
              className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-white hover:bg-slate-50 border border-slate-300 hover:border-slate-400 text-xs font-semibold text-slate-700 transition shadow-2xs active:scale-95 disabled:opacity-50"
            >
              <Zap className="w-3.5 h-3.5 text-slate-700" />
              <span>Load Kenya Case Fixtures</span>
            </button>

            {showSampleDropdown && (
              <div className="absolute right-0 mt-2 w-80 rounded-xl bg-white border border-slate-200 shadow-xl p-2 z-50 animate-in fade-in slide-in-from-top-2">
                <div className="px-3 py-2 border-b border-slate-100 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                    Synthetic IFC demo fixtures
                </div>
                <button
                  id="sample-violating-btn"
                  onClick={() => {
                    setShowSampleDropdown(false);
                    onLoadSample('violating');
                  }}
                  className="w-full text-left p-2.5 rounded-lg hover:bg-slate-100 border border-transparent hover:border-slate-200 transition group flex flex-col gap-1 mt-1 cursor-pointer"
                >
                  <div className="flex items-center justify-between text-xs font-semibold text-slate-900 group-hover:text-slate-950">
                    <span className="flex items-center gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5 text-slate-600" />
                      8-storey synthetic model
                    </span>
                    <span className="text-[10px] bg-slate-900 text-white px-1.5 py-0.5 rounded font-mono font-bold">
                      DEMO
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 leading-tight">
                    Includes geometry variations for demonstration; not a real building.
                  </p>
                </button>

                <button
                  id="sample-compliant-btn"
                  onClick={() => {
                    setShowSampleDropdown(false);
                    onLoadSample('compliant');
                  }}
                  className="w-full text-left p-2.5 rounded-lg hover:bg-slate-100 border border-transparent hover:border-slate-200 transition group flex flex-col gap-1 mt-1 cursor-pointer"
                >
                  <div className="flex items-center justify-between text-xs font-semibold text-slate-900 group-hover:text-slate-950">
                    <span className="flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-slate-600" />
                      4-storey synthetic model
                    </span>
                    <span className="text-[10px] bg-slate-900 text-white px-1.5 py-0.5 rounded font-mono font-bold">
                      DEMO
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 leading-tight">
                    Includes sample geometry; dimensions are placeholders and not compliance thresholds.
                  </p>
                </button>
              </div>
            )}
          </div>

          {(auditResult || versionDiff) && (
            <button
              onClick={() => {
                if (auditResult) handleDownloadReport();
                else if (versionDiff) {
                  const blob = new Blob([JSON.stringify({
                    report_title: 'SiteBeta Kenya - Compliance Check Report',
                    advisory_notice: 'Advisory only. This is not an official approval, and structural adequacy must be confirmed by a registered engineer.',
                    exported_at: new Date().toISOString(),
                    version_diff: versionDiff,
                  }, null, 2)], { type: 'application/json' });
                  const url = URL.createObjectURL(blob);
                  const link = document.createElement('a');
                  link.href = url;
                  link.download = 'SiteBeta-Kenya-Version-Comparison-Report.json';
                  link.click();
                  URL.revokeObjectURL(url);
                }
              }}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold shadow-xs transition active:scale-95 border border-slate-800"
            >
              <Download className="w-3.5 h-3.5 text-slate-200" />
              <span className="hidden sm:inline">Export Compliance Check Report</span>
            </button>
          )}

          <button
            onClick={() => setShowInfoModal(true)}
            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 border border-transparent hover:border-slate-200 transition"
            title="Scope and limitations"
          >
            <Info className="w-4 h-4" />
          </button>
        </div>
      </header>

      {showInfoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="bg-white border border-slate-200 max-w-xl w-full rounded-2xl p-6 shadow-2xl relative max-h-[85vh] overflow-y-auto">
            <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Shield className="w-5 h-5 text-slate-900" />
              SiteBeta Kenya: Scope and limitations
            </h3>
            <p className="text-xs text-slate-600 mt-2 leading-relaxed">
              SiteBeta runs deterministic geometry checks against a small list of rules. It is local software and does not connect to NCA or county systems, issue approvals, or make structural adequacy determinations.
            </p>
            <div className="mt-4 space-y-2.5 text-xs text-slate-700">
              <div className="p-3 bg-slate-100 rounded-xl border border-slate-200">
                <span className="font-bold text-slate-900 block mb-0.5">Checks</span>
                IFC geometry for storey count, stair presence, column alignment, and extracted column sections for engineer review. See rule sources for verification status.
              </div>
              <div className="p-3 bg-slate-100 rounded-xl border border-slate-200">
                <span className="font-bold text-slate-900 block mb-0.5">Not checked</span>
                Structural adequacy, material quality, reinforcement, foundation capacity, site conditions, or official compliance. Missing IFC data is reported as “Could not check.”
              </div>
              <div className="p-3 bg-slate-100 rounded-xl border border-slate-200">
                <span className="font-bold text-slate-900 block mb-0.5">Version comparison</span>
                IFC GlobalIds and available geometry are compared deterministically. IFC exports that change identifiers can affect element matching.
              </div>
            </div>
            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setShowInfoModal(false)}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg shadow-sm transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
