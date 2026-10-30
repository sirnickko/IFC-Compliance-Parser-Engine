import React, { useState } from 'react';
import {
  AlertTriangle,
  AlertOctagon,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Focus,
  Wrench,
  Flame,
  Activity,
  Layers,
  Columns,
  ShieldCheck,
  ShieldAlert,
  MapPin,
  Scale,
  FileWarning,
} from 'lucide-react';
import { AuditResponse, Finding } from '../types/audit';

interface RemediationDrawerProps {
  auditResult: AuditResponse | null;
  onLocateElement: (guid: string) => void;
}

export const RemediationDrawer: React.FC<RemediationDrawerProps> = ({
  auditResult,
  onLocateElement,
}) => {
  const [openCards, setOpenCards] = useState<Record<string, boolean>>({});

  const toggleCard = (id: string) => {
    setOpenCards((prev) => ({
      ...prev,
      [id]: prev[id] === undefined ? false : !prev[id],
    }));
  };

  const isCardOpen = (id: string) => {
    return openCards[id] !== false;
  };

  if (!auditResult) {
    return (
      <div className="h-full bg-slate-900/60 border-l border-slate-800 p-6 flex flex-col items-center justify-center text-center">
        <div className="w-14 h-14 rounded-2xl bg-slate-800/80 border border-slate-700/80 flex items-center justify-center text-slate-500 mb-3 shadow-inner">
          <Activity className="w-7 h-7" />
        </div>
        <h3 className="text-sm font-bold text-slate-200">Awaiting Kenyan BIM Model</h3>
        <p className="text-xs text-slate-400 mt-1 max-w-[240px]">
          Upload an ArchiCAD / Revit .ifc model on the left or select a Kenyan collapse case study to run the audit.
        </p>
      </div>
    );
  }

  const { overall_status, summary, metadata, findings, parcel_id, county, zoning_zone } = auditResult;
  const isRejected = overall_status === 'REJECTED';
  const isApproved = overall_status === 'APPROVED';

  return (
    <div className="h-full bg-slate-900/60 border-l border-slate-800 flex flex-col overflow-hidden">
      {/* Verdict Banner Header */}
      <div className="p-5 border-b border-slate-800 bg-slate-900/80">
        <div
          className={`p-4 rounded-xl border flex items-center gap-3 shadow-lg ${isRejected
            ? 'bg-rose-950/40 border-rose-800/80 text-rose-300 shadow-rose-950/20'
            : isApproved
              ? 'bg-emerald-950/40 border-emerald-800/80 text-emerald-300 shadow-emerald-950/20'
              : 'bg-amber-950/40 border-amber-800/80 text-amber-300 shadow-amber-950/20'
            }`}
        >
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${isRejected
              ? 'bg-rose-500/20 text-rose-400 ring-1 ring-rose-500/40'
              : isApproved
                ? 'bg-emerald-500/20 text-emerald-400 ring-1 ring-emerald-500/40'
                : 'bg-amber-500/20 text-amber-400 ring-1 ring-amber-500/40'
              }`}
          >
            {isRejected ? (
              <ShieldAlert className="w-6 h-6" />
            ) : isApproved ? (
              <ShieldCheck className="w-6 h-6" />
            ) : (
              <AlertTriangle className="w-6 h-6" />
            )}
          </div>
          <div>
            <div className="text-[10px] font-mono uppercase tracking-widest font-semibold opacity-80">
              Kenya Municipal Audit Verdict
            </div>
            <div className="text-sm font-extrabold tracking-tight leading-snug">
              {isRejected
                ? 'REJECTED — NCA STOP WORK ORDER WARRANTED'
                : isApproved
                ? 'APPROVED — KENYA BUILDING CODE COMPLIANT'
                : 'FLAGGED FOR MANUAL STRUCTURAL REVIEW'}
            </div>
          </div>
        </div>

        {/* Cadastral & County Context Banner */}
        <div className="mt-3 px-3 py-2 bg-slate-950/60 rounded-lg border border-slate-800 flex items-center justify-between text-[11px] font-mono">
          <div className="flex items-center gap-1.5 text-cyan-300 truncate max-w-[200px]" title={parcel_id}>
            <MapPin className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
            <span className="truncate">{parcel_id}</span>
          </div>
          <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-semibold truncate max-w-[170px]" title={county || 'Nairobi City County'}>
            {county || 'Nairobi City County'}
          </span>
        </div>

        {/* Summary Metric Counters */}
        <div className="grid grid-cols-3 gap-2 mt-3 text-center">
          <div className="p-2.5 rounded-lg bg-slate-800/70 border border-slate-700/60">
            <div className="flex items-center justify-center gap-1 text-[10px] text-slate-400 mb-0.5">
              <Layers className="w-3.5 h-3.5 text-cyan-400" />
              <span>Storeys</span>
            </div>
            <div className="text-base font-bold font-mono text-white">
              {metadata.total_storeys}
            </div>
          </div>

          <div className="p-2.5 rounded-lg bg-slate-800/70 border border-slate-700/60">
            <div className="flex items-center justify-center gap-1 text-[10px] text-slate-400 mb-0.5">
              <Columns className="w-3.5 h-3.5 text-cyan-400" />
              <span>Columns</span>
            </div>
            <div className="text-base font-bold font-mono text-white">
              {metadata.total_columns}
            </div>
          </div>

          <div className="p-2.5 rounded-lg bg-slate-800/70 border border-slate-700/60">
            <div className="flex items-center justify-center gap-1 text-[10px] text-rose-400 mb-0.5">
              <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
              <span>Defects</span>
            </div>
            <div
              className={`text-base font-bold font-mono ${findings.length > 0 ? 'text-rose-400' : 'text-emerald-400'
                }`}
            >
              {findings.length}
            </div>
          </div>
        </div>
      </div>

      {/* Accordion Findings List */}
      <div className="flex-1 p-5 overflow-y-auto space-y-3">
        <div className="flex items-center justify-between pb-1">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
            <Flame className="w-3.5 h-3.5 text-rose-400" />
            Kenyan Code Violations & Collapse Risks ({findings.length})
          </h3>
        </div>

        {findings.length === 0 ? (
          <div className="p-6 rounded-xl bg-slate-800/40 border border-slate-700/60 text-center space-y-2">
            <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto" />
            <h4 className="text-xs font-bold text-emerald-300">Code Compliant with Kenya Standards</h4>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              All column cross-sections meet KS 04-245 / BS 8110, storey count respects County zoning, vertical egress is continuous, and vertical load paths are sound.
            </p>
          </div>
        ) : (
          findings.map((finding) => {
            const isOpen = isCardOpen(finding.id);
            const isCritical = finding.severity === 'CRITICAL';

            return (
              <div
                key={finding.id}
                className={`rounded-xl border transition-all duration-200 overflow-hidden ${isCritical
                  ? 'border-rose-900/60 bg-slate-900/90 hover:border-rose-700/80'
                  : 'border-amber-900/60 bg-slate-900/90 hover:border-amber-700/80'
                  }`}
              >
                <button
                  type="button"
                  onClick={() => toggleCard(finding.id)}
                  className="w-full p-3.5 flex items-center justify-between gap-3 text-left hover:bg-slate-800/40 transition"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span
                      className={`text-[9px] font-mono px-2 py-0.5 rounded font-bold uppercase tracking-wider ${isCritical
                        ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                        : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                        }`}
                    >
                      {finding.severity}
                    </span>
                    <span className="text-xs font-bold text-slate-100 truncate">
                      {finding.title}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {finding.element_guids.length > 0 && (
                      <span className="text-[10px] font-mono text-slate-400 bg-slate-800 px-2 py-0.5 rounded">
                        {finding.element_guids.length} el
                      </span>
                    )}
                    {isOpen ? (
                      <ChevronDown className="w-4 h-4 text-slate-400" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-slate-400" />
                    )}
                  </div>
                </button>

                {isOpen && (
                  <div className="px-4 pb-4 pt-1 space-y-3 border-t border-slate-800/80 text-xs">
                    {/* Kenyan Statute Citation */}
                    {finding.standard_ref && (
                      <div className="flex items-start gap-1.5 p-2 bg-slate-950/80 rounded-lg border border-slate-800 text-[10px] text-amber-300 font-mono">
                        <Scale className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                        <span><strong>Standard:</strong> {finding.standard_ref}</span>
                      </div>
                    )}

                    {/* Observed Flaw */}
                    <div>
                      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                        Observed Violation:
                      </div>
                      <p className="text-slate-200 bg-slate-950/60 p-2.5 rounded-lg border border-slate-800 font-mono text-[11px] leading-relaxed">
                        {finding.details}
                      </p>
                    </div>

                    {/* Structural Hazard */}
                    <div>
                      <div className="text-[10px] font-bold text-rose-400 uppercase tracking-wider mb-1 flex items-center gap-1">
                        <AlertOctagon className="w-3 h-3 text-rose-400" />
                        Kenyan Collapse Risk:
                      </div>
                      <p className="text-rose-200/90 bg-rose-950/30 p-2.5 rounded-lg border border-rose-900/40 text-[11px] leading-relaxed">
                        {finding.structural_risk}
                      </p>
                    </div>

                    {/* Actionable Remediation Callout */}
                    <div>
                      <div className="text-[10px] font-bold text-cyan-400 uppercase tracking-wider mb-1 flex items-center gap-1">
                        <Wrench className="w-3 h-3 text-cyan-400" />
                        Remediation & Compliance Action:
                      </div>
                      <div className="p-3 bg-cyan-950/30 rounded-lg border border-cyan-800/60 text-cyan-100 text-[11px] leading-relaxed shadow-sm">
                        {finding.recommendation}
                      </div>
                    </div>

                    {/* Statutory Enforcement Action */}
                    {finding.statutory_action && (
                      <div className="flex items-start gap-1.5 p-2 bg-rose-950/40 rounded-lg border border-rose-900/60 text-[10px] text-rose-300">
                        <FileWarning className="w-3.5 h-3.5 text-rose-400 shrink-0 mt-0.5" />
                        <span><strong>Enforcement:</strong> {finding.statutory_action}</span>
                      </div>
                    )}

                    {finding.element_guids.length > 0 && (
                      <button
                        type="button"
                        onClick={() => onLocateElement(finding.element_guids[0])}
                        className="w-full py-2 px-3 bg-slate-800 hover:bg-cyan-950/60 hover:text-cyan-300 border border-slate-700 hover:border-cyan-700/80 rounded-lg text-xs font-semibold text-slate-300 flex items-center justify-center gap-2 transition active:scale-98"
                      >
                        <Focus className="w-3.5 h-3.5 text-cyan-400" />
                        <span>Locate & Highlight in 3D Viewport</span>
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
