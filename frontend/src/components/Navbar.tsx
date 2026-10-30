import React, { useState } from 'react';
import {
  Shield,
  CheckCircle2,
  AlertTriangle,
  Download,
  Server,
  Zap,
  Info,
  MapPin,
  Building2,
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
    a.download = `LindaSite-Kenya-Audit-${auditResult.parcel_id.replace(/[^a-zA-Z0-9]/g, '_')}-${auditResult.file_sha256.slice(0, 8)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <header className="h-16 border-b border-slate-800 bg-slate-900/90 backdrop-blur-md px-6 flex items-center justify-between z-30 select-none">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-rose-600 to-red-500 flex items-center justify-center shadow-lg shadow-rose-500/20 text-white font-bold ring-1 ring-rose-400/40">
            <Shield className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-lg font-bold tracking-tight text-white">LindaSite Kenya</span>
              <span className="text-[10px] font-mono tracking-widest uppercase bg-rose-950/80 text-rose-300 border border-rose-800/80 px-2 py-0.5 rounded-full font-semibold">
                NCA & County Standards
              </span>
            </div>
            <p className="text-xs text-slate-400 hidden sm:block">
              Kenya Municipal Building Code Audit & Collapse Prevention Spotter
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800/80 border border-slate-700/60 text-xs">
            <span
              className={`w-2 h-2 rounded-full ${
                backendHealthy ? 'bg-emerald-400 animate-pulse-subtle shadow-sm shadow-emerald-400' : 'bg-rose-500'
              }`}
            />
            <Server className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-slate-300 font-mono">
              {backendHealthy ? 'NCA Engine Connected' : 'Engine Offline'}
            </span>
          </div>

          <div className="relative">
            <button
              id="load-sample-btn"
              onClick={() => setShowSampleDropdown(!showSampleDropdown)}
              disabled={isLoading}
              className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-slate-600 text-xs font-medium text-slate-200 transition shadow-sm active:scale-95 disabled:opacity-50"
            >
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              <span>Load Kenya Case Fixtures</span>
            </button>

            {showSampleDropdown && (
              <div className="absolute right-0 mt-2 w-80 rounded-xl bg-slate-900 border border-slate-700 shadow-2xl p-2 z-50 animate-in fade-in slide-in-from-top-2">
                <div className="px-3 py-2 border-b border-slate-800 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                  Kenyan Building Disaster Profiles
                </div>
                <button
                  id="sample-violating-btn"
                  onClick={() => {
                    setShowSampleDropdown(false);
                    onLoadSample('violating');
                  }}
                  className="w-full text-left p-2.5 rounded-lg hover:bg-rose-950/40 hover:border hover:border-rose-800/60 transition group flex flex-col gap-1 mt-1 cursor-pointer"
                >
                  <div className="flex items-center justify-between text-xs font-semibold text-rose-300 group-hover:text-rose-200">
                    <span className="flex items-center gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                      Kasarani / Pipeline Rogue Tenement
                    </span>
                    <span className="text-[10px] bg-rose-500/20 text-rose-300 px-1.5 py-0.5 rounded font-mono">
                      FAIL
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-tight">
                    +4 illegal floors, 150mm slender columns, missing fire stairs, floating columns.
                  </p>
                </button>

                <button
                  id="sample-compliant-btn"
                  onClick={() => {
                    setShowSampleDropdown(false);
                    onLoadSample('compliant');
                  }}
                  className="w-full text-left p-2.5 rounded-lg hover:bg-emerald-950/40 hover:border hover:border-emerald-800/60 transition group flex flex-col gap-1 mt-1 cursor-pointer"
                >
                  <div className="flex items-center justify-between text-xs font-semibold text-emerald-300 group-hover:text-emerald-200">
                    <span className="flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                      Compliant 4-Storey Residential Block
                    </span>
                    <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-1.5 py-0.5 rounded font-mono">
                      PASS
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-tight">
                    4 permitted floors, 300mm columns, fully continuous fire stair core and load path.
                  </p>
                </button>
              </div>
            )}
          </div>

          {auditResult && (
            <button
              onClick={handleDownloadCertificate}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-medium shadow-md shadow-rose-600/20 transition active:scale-95"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Export Audit Certificate</span>
            </button>
          )}

          <button
            onClick={() => setShowInfoModal(true)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition"
            title="Kenyan Standards & Collapse Study Background"
          >
            <Info className="w-4 h-4" />
          </button>
        </div>
      </header>

      {showInfoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700 max-w-xl w-full rounded-2xl p-6 shadow-2xl relative max-h-[85vh] overflow-y-auto">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <Shield className="w-5 h-5 text-rose-400" />
              LindaSite Kenya: Preventing Building Collapses
            </h3>
            <p className="text-xs text-slate-300 mt-2 leading-relaxed">
              Following forensic investigations into repeated catastrophic building collapses in Nairobi (Kasarani, Huruma, Tassia),
              Kiambu (Kinoo, Ruiru), and Mombasa, LindaSite provides an automated, tamper-proof gatekeeper for county planning
              authorities, NCA inspectors, and consulting engineers.
            </p>
            <div className="mt-4 space-y-2.5 text-xs text-slate-300">
              <div className="p-3 bg-slate-800/80 rounded-lg border border-slate-700/60">
                <span className="font-semibold text-rose-300 block mb-0.5">1. Illegal Storey Additions (NCA Cause #1)</span>
                Developers obtain permits for 4 floors and stealthily cast 4 extra floors without foundation reinforcement. LindaSite checks IFC spatial storeys against cadastral parcel permits under the <em>Physical and Land Use Planning Act, 2019</em>.
              </div>
              <div className="p-3 bg-slate-800/80 rounded-lg border border-slate-700/60">
                <span className="font-semibold text-rose-300 block mb-0.5">2. Undersized Slender Columns (KS 04-245 / BS 8110)</span>
                Casting 150 mm columns instead of the required 200 mm+ minimum to cut costs causes sudden Euler buckling under axial dead loads. LindaSite parses profile geometries across all structural columns.
              </div>
              <div className="p-3 bg-slate-800/80 rounded-lg border border-slate-700/60">
                <span className="font-semibold text-rose-300 block mb-0.5">3. Floating Columns / Discontinuous Load Paths</span>
                Omitting ground-floor columns to accommodate parking bays or retail stalls without transfer girders creates fatal punching shear. LindaSite performs 2D centroid proximity checks across consecutive storeys.
              </div>
              <div className="p-3 bg-slate-800/80 rounded-lg border border-slate-700/60">
                <span className="font-semibold text-rose-300 block mb-0.5">4. Continuous Fire Stair Egress</span>
                Enforces the <em>Kenya National Building Code 2024</em> requirement for protected, continuous vertical egress routes spanning all storeys down to exterior discharge.
              </div>
              <div className="p-3 bg-slate-800/80 rounded-lg border border-slate-700/60">
                <span className="font-semibold text-amber-300 block mb-0.5">5. SHA-256 Provenance Fingerprint</span>
                Generates a cryptographic hash directly from raw bytes to prevent post-approval drawing substitutions on site.
              </div>
            </div>
            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setShowInfoModal(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg transition"
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
