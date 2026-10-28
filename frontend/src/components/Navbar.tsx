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
    a.download = `CivicShield-Certificate-${auditResult.parcel_id}-${auditResult.file_sha256.slice(0, 8)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <header className="h-16 border-b border-slate-800 bg-slate-900/90 backdrop-blur-md px-6 flex items-center justify-between z-30 select-none">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-600 to-blue-500 flex items-center justify-center shadow-lg shadow-cyan-500/20 text-white font-bold ring-1 ring-cyan-400/40">
            <Shield className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-lg font-bold tracking-tight text-white">CivicShield</span>
              <span className="text-[10px] font-mono tracking-widest uppercase bg-cyan-950/80 text-cyan-400 border border-cyan-800/80 px-2 py-0.5 rounded-full font-semibold">
                BIM/IFC v1.0
              </span>
            </div>
            <p className="text-xs text-slate-400 hidden sm:block">
              Municipal Structural Safety Audit & 3D Weakness Spotter
            </p>
          </div>
        </div>

        {/* Center / Right controls */}
        <div className="flex items-center gap-3">
          {/* Health indicator */}
          <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800/80 border border-slate-700/60 text-xs">
            <span
              className={`w-2 h-2 rounded-full ${
                backendHealthy ? 'bg-emerald-400 animate-pulse-subtle shadow-sm shadow-emerald-400' : 'bg-rose-500'
              }`}
            />
            <Server className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-slate-300 font-mono">
              {backendHealthy ? 'Engine Connected' : 'Engine Offline'}
            </span>
          </div>

          {/* Load Sample Demo Model */}
          <div className="relative">
            <button
              id="load-sample-btn"
              onClick={() => setShowSampleDropdown(!showSampleDropdown)}
              disabled={isLoading}
              className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-slate-600 text-xs font-medium text-slate-200 transition shadow-sm active:scale-95 disabled:opacity-50"
            >
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              <span>Load Sample Demo Model</span>
            </button>

            {showSampleDropdown && (
              <div className="absolute right-0 mt-2 w-72 rounded-xl bg-slate-900 border border-slate-700 shadow-2xl p-2 z-50 animate-in fade-in slide-in-from-top-2">
                <div className="px-3 py-2 border-b border-slate-800 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                  Synthetic Test Bench Fixtures
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
                      Violating 8-Storey Tower
                    </span>
                    <span className="text-[10px] bg-rose-500/20 text-rose-300 px-1.5 py-0.5 rounded font-mono">
                      FAIL
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-tight">
                    +4 illegal floors, 150mm slender columns, missing stairs, floating load paths.
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
                      Compliant 4-Storey Model
                    </span>
                    <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-1.5 py-0.5 rounded font-mono">
                      PASS
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-tight">
                    4 floors, 300mm columns, fully continuous stair core and load paths.
                  </p>
                </button>
              </div>
            )}
          </div>

          {/* Export Certificate */}
          {auditResult && (
            <button
              onClick={handleDownloadCertificate}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-medium shadow-md shadow-cyan-600/20 transition active:scale-95"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Export Certificate</span>
            </button>
          )}

          {/* Info toggle */}
          <button
            onClick={() => setShowInfoModal(true)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition"
            title="System Documentation & Standards"
          >
            <Info className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Info Modal */}
      {showInfoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700 max-w-lg w-full rounded-2xl p-6 shadow-2xl relative">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <Shield className="w-5 h-5 text-cyan-400" />
              CivicShield Architectural & Structural Rules Engine
            </h3>
            <p className="text-sm text-slate-300 mt-3 leading-relaxed">
              CivicShield performs automated, deterministic verification on Industry Foundation
              Classes (<code className="text-cyan-400 font-mono">.ifc</code>) architectural and
              structural building information models.
            </p>
            <div className="mt-4 space-y-2.5 text-xs text-slate-300">
              <div className="p-3 bg-slate-800/80 rounded-lg border border-slate-700/60">
                <span className="font-semibold text-amber-300 block mb-0.5">1. Immutable SHA-256 Fingerprint</span>
                Calculated directly from the raw byte stream prior to parsing to detect post-approval tampering.
              </div>
              <div className="p-3 bg-slate-800/80 rounded-lg border border-slate-700/60">
                <span className="font-semibold text-rose-300 block mb-0.5">2. Zoning Storey & Height Limit</span>
                Cross-references <code className="text-slate-200">IfcBuildingStorey</code> entities against municipal parcel height restrictions.
              </div>
              <div className="p-3 bg-slate-800/80 rounded-lg border border-slate-700/60">
                <span className="font-semibold text-rose-300 block mb-0.5">3. Column Slenderness & Cross-Section</span>
                Validates structural columns against minimum dimensional safety requirements (default: 200 mm).
              </div>
              <div className="p-3 bg-slate-800/80 rounded-lg border border-slate-700/60">
                <span className="font-semibold text-rose-300 block mb-0.5">4. Continuous Vertical Stair Egress</span>
                Ensures continuous life-safety escape routes spanning all occupied storeys.
              </div>
              <div className="p-3 bg-slate-800/80 rounded-lg border border-slate-700/60">
                <span className="font-semibold text-rose-300 block mb-0.5">5. Column Alignment & Load Path Continuity</span>
                Detects floating columns terminated mid-slab without transfer girders.
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
