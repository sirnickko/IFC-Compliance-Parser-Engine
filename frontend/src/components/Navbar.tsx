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
import { AuditResponse } from '../types/audit';

interface NavbarProps {
  onLoadSample: (sampleName: 'violating' | 'compliant') => void;
  auditResult: AuditResponse | null;
  backendHealthy: boolean;
  isLoading: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  onLoadSample,
  auditResult,
  backendHealthy,
  isLoading,
}) => {
  const [showSampleDropdown, setShowSampleDropdown] = useState(false);
  const [showInfoModal, setShowInfoModal] = useState(false);

  const handleDownloadCertificate = () => {
    if (!auditResult) return;
    const blob = new Blob([JSON.stringify(auditResult, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `SiteBeta-Kenya-Audit-${auditResult.parcel_id.replace(/[^a-zA-Z0-9]/g, '_')}-${auditResult.file_sha256.slice(0, 8)}.json`;
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
              <span className="text-[10px] font-mono tracking-widest uppercase bg-slate-900 text-white px-2.5 py-0.5 rounded-full font-semibold shadow-2xs">
                NCA & County Standards
              </span>
            </div>
            <p className="text-xs text-slate-500 hidden sm:block">
              Kenya Municipal Building Code Audit & Collapse Prevention Spotter
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-100 border border-slate-200 text-xs shadow-2xs">
            <span
              className={`w-2 h-2 rounded-full ${
                backendHealthy ? 'bg-emerald-500 animate-pulse-subtle shadow-xs shadow-emerald-500' : 'bg-rose-500'
              }`}
            />
            <Server className="w-3.5 h-3.5 text-slate-500" />
            <span className="text-slate-700 font-mono text-[11px] font-medium">
              {backendHealthy ? 'NCA Engine Connected' : 'Engine Offline'}
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
                  Kenyan Building Disaster Profiles
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
                      Kasarani / Pipeline Rogue Tenement
                    </span>
                    <span className="text-[10px] bg-slate-900 text-white px-1.5 py-0.5 rounded font-mono font-bold">
                      FAIL
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 leading-tight">
                    +4 illegal floors, 150mm slender columns, missing fire stairs, floating columns.
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
                      Compliant 4-Storey Residential Block
                    </span>
                    <span className="text-[10px] bg-slate-900 text-white px-1.5 py-0.5 rounded font-mono font-bold">
                      PASS
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 leading-tight">
                    4 permitted floors, 300mm columns, fully continuous fire stair core and load path.
                  </p>
                </button>
              </div>
            )}
          </div>

          {auditResult && (
            <button
              onClick={handleDownloadCertificate}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold shadow-xs transition active:scale-95 border border-slate-800"
            >
              <Download className="w-3.5 h-3.5 text-slate-200" />
              <span className="hidden sm:inline">Export Audit Certificate</span>
            </button>
          )}

          <button
            onClick={() => setShowInfoModal(true)}
            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 border border-transparent hover:border-slate-200 transition"
            title="Kenyan Standards & Collapse Study Background"
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
              SiteBeta Kenya: Preventing Building Collapses
            </h3>
            <p className="text-xs text-slate-600 mt-2 leading-relaxed">
              Following forensic investigations into repeated catastrophic building collapses in Nairobi (Kasarani, Huruma, Tassia),
              Kiambu (Kinoo, Ruiru), and Mombasa, SiteBeta provides an automated, tamper-proof gatekeeper for county planning
              authorities, NCA inspectors, and consulting engineers.
            </p>
            <div className="mt-4 space-y-2.5 text-xs text-slate-700">
              <div className="p-3 bg-slate-100 rounded-xl border border-slate-200">
                <span className="font-bold text-slate-900 block mb-0.5">1. Illegal Storey Additions (NCA Cause #1)</span>
                Developers obtain permits for 4 floors and stealthily cast 4 extra floors without foundation reinforcement. SiteBeta checks IFC spatial storeys against cadastral parcel permits under the <em>Physical and Land Use Planning Act, 2019</em>.
              </div>
              <div className="p-3 bg-slate-100 rounded-xl border border-slate-200">
                <span className="font-bold text-slate-900 block mb-0.5">2. Undersized Slender Columns (KS 04-245 / BS 8110)</span>
                Casting 150 mm columns instead of the required 200 mm+ minimum to cut costs causes sudden Euler buckling under axial dead loads. SiteBeta parses profile geometries across all structural columns.
              </div>
              <div className="p-3 bg-slate-100 rounded-xl border border-slate-200">
                <span className="font-bold text-slate-900 block mb-0.5">3. Floating Columns / Discontinuous Load Paths</span>
                Omitting ground-floor columns to accommodate parking bays or retail stalls without transfer girders creates fatal punching shear. SiteBeta performs 2D centroid proximity checks across consecutive storeys.
              </div>
              <div className="p-3 bg-slate-100 rounded-xl border border-slate-200">
                <span className="font-bold text-slate-900 block mb-0.5">4. Continuous Fire Stair Egress</span>
                Enforces the <em>Kenya National Building Code 2024</em> requirement for protected, continuous vertical egress routes spanning all storeys down to exterior discharge.
              </div>
              <div className="p-3 bg-slate-100 rounded-xl border border-slate-200">
                <span className="font-bold text-slate-900 block mb-0.5">5. SHA-256 Provenance Fingerprint</span>
                Generates a cryptographic hash directly from raw bytes to prevent post-approval drawing substitutions on site.
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
