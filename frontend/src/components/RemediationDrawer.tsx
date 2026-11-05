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
      <div className="h-full bg-slate-50/70 border-l border-slate-200 p-6 flex flex-col items-center justify-center text-center">
        <div className="w-14 h-14 rounded-2xl bg-white border border-slate-200 flex items-center justify-center text-slate-400 mb-3 shadow-xs">
          <Activity className="w-7 h-7" />
        </div>
        <h3 className="text-sm font-bold text-slate-800">Awaiting Kenyan BIM Model</h3>
        <p className="text-xs text-slate-500 mt-1 max-w-[240px]">
          Upload an ArchiCAD / Revit .ifc model on the left or select a Kenyan collapse case study to run the audit.
        </p>
      </div>
    );
  }

  const { overall_status, summary, metadata, findings, parcel_id, county, zoning_zone } = auditResult;
  const isRejected = overall_status === 'REJECTED';
  const isApproved = overall_status === 'APPROVED';

  return (
    <div className="h-full bg-white border-l border-slate-200 flex flex-col overflow-hidden">
      {/* Verdict Banner Header */}
      <div className="p-5 border-b border-slate-200 bg-white">
        <div
          className={`p-4 rounded-xl border flex items-center gap-3 shadow-xs ${isRejected
            ? 'bg-rose-50/80 border-rose-200 text-rose-950'
            : isApproved
              ? 'bg-emerald-50/80 border-emerald-200 text-emerald-950'
              : 'bg-amber-50/80 border-amber-200 text-amber-950'
            }`}
        >
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${isRejected
              ? 'bg-rose-100 text-rose-700 ring-1 ring-rose-200'
              : isApproved
                ? 'bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200'
                : 'bg-amber-100 text-amber-700 ring-1 ring-amber-200'
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
            <div className={`text-[10px] font-mono uppercase tracking-widest font-bold ${isRejected ? 'text-rose-700' : isApproved ? 'text-emerald-700' : 'text-amber-700'}`}>
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
        <div className="mt-3 px-3 py-2 bg-slate-50 rounded-lg border border-slate-200 flex items-center justify-between text-[11px] font-mono">
          <div className="flex items-center gap-1.5 text-slate-700 truncate max-w-[200px]" title={parcel_id}>
            <MapPin className="w-3.5 h-3.5 text-slate-500 shrink-0" />
            <span className="truncate font-semibold">{parcel_id}</span>
          </div>
          <span className="text-[10px] px-2 py-0.5 rounded bg-white border border-slate-200 text-slate-700 font-semibold truncate max-w-[170px] shadow-2xs" title={county || 'Nairobi City County'}>
            {county || 'Nairobi City County'}
          </span>
        </div>

        {/* Summary Metric Counters */}
        <div className="grid grid-cols-3 gap-2 mt-3 text-center">
          <div className="p-2.5 rounded-lg bg-slate-50/80 border border-slate-200 shadow-2xs">
            <div className="flex items-center justify-center gap-1 text-[10px] text-slate-500 mb-0.5 font-medium">
              <Layers className="w-3.5 h-3.5 text-slate-600" />
              <span>Storeys</span>
            </div>
            <div className="text-base font-bold font-mono text-slate-900">
              {metadata.total_storeys}
            </div>
          </div>

          <div className="p-2.5 rounded-lg bg-slate-50/80 border border-slate-200 shadow-2xs">
            <div className="flex items-center justify-center gap-1 text-[10px] text-slate-500 mb-0.5 font-medium">
              <Columns className="w-3.5 h-3.5 text-slate-600" />
              <span>Columns</span>
            </div>
            <div className="text-base font-bold font-mono text-slate-900">
              {metadata.total_columns}
            </div>
          </div>

          <div className="p-2.5 rounded-lg bg-slate-50/80 border border-slate-200 shadow-2xs">
            <div className="flex items-center justify-center gap-1 text-[10px] text-rose-600 mb-0.5 font-medium">
              <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
              <span>Defects</span>
            </div>
            <div
              className={`text-base font-bold font-mono ${findings.length > 0 ? 'text-rose-600' : 'text-emerald-600'
                }`}
            >
              {findings.length}
            </div>
          </div>
        </div>
      </div>

      {/* Accordion Findings List */}
      <div className="flex-1 p-5 overflow-y-auto space-y-3 bg-slate-50/40">
        <div className="flex items-center justify-between pb-1">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
            <Flame className="w-3.5 h-3.5 text-rose-600" />
            Kenyan Code Violations & Collapse Risks ({findings.length})
          </h3>
        </div>

        {findings.length === 0 ? (
          <div className="p-6 rounded-xl bg-white border border-emerald-200 text-center space-y-2 shadow-xs">
            <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto" />
            <h4 className="text-xs font-bold text-emerald-800">Code Compliant with Kenya Standards</h4>
            <p className="text-[11px] text-slate-500 leading-relaxed">
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
                className={`rounded-xl border transition-all duration-200 overflow-hidden shadow-2xs bg-white ${isCritical
                  ? 'border-rose-200 hover:border-rose-300'
                  : 'border-amber-200 hover:border-amber-300'
                  }`}
              >
                <button
                  type="button"
                  onClick={() => toggleCard(finding.id)}
                  className="w-full p-3.5 flex items-center justify-between gap-3 text-left hover:bg-slate-50 transition"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span
                      className={`text-[9px] font-mono px-2 py-0.5 rounded font-bold uppercase tracking-wider ${isCritical
                        ? 'bg-rose-100 text-rose-800 border border-rose-200'
                        : 'bg-amber-100 text-amber-800 border border-amber-200'
                        }`}
                    >
                      {finding.severity}
                    </span>
                    <span className="text-xs font-bold text-slate-900 truncate">
                      {finding.title}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {finding.element_guids.length > 0 && (
                      <span className="text-[10px] font-mono text-slate-600 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded">
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
                  <div className="px-4 pb-4 pt-1 space-y-3 border-t border-slate-100 text-xs">
                    {/* Kenyan Statute Citation */}
                    {finding.standard_ref && (
                      <div className="flex items-start gap-1.5 p-2 bg-amber-50/80 rounded-lg border border-amber-200/80 text-[10px] text-amber-900 font-mono">
                        <Scale className="w-3.5 h-3.5 text-amber-700 shrink-0 mt-0.5" />
                        <span><strong>Standard:</strong> {finding.standard_ref}</span>
                      </div>
                    )}

                    {/* Observed Flaw */}
                    <div>
                      <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                        Observed Violation:
                      </div>
                      <p className="text-slate-800 bg-slate-50 p-2.5 rounded-lg border border-slate-200 font-mono text-[11px] leading-relaxed">
                        {finding.details}
                      </p>
                    </div>

                    {/* Structural Hazard */}
                    <div>
                      <div className="text-[10px] font-bold text-rose-700 uppercase tracking-wider mb-1 flex items-center gap-1">
                        <AlertOctagon className="w-3 h-3 text-rose-600" />
                        Kenyan Collapse Risk:
                      </div>
                      <p className="text-rose-950 bg-rose-50/80 p-2.5 rounded-lg border border-rose-200 text-[11px] leading-relaxed font-medium">
                        {finding.structural_risk}
                      </p>
                    </div>

                    {/* Actionable Remediation Callout */}
                    <div>
                      <div className="text-[10px] font-bold text-sky-800 uppercase tracking-wider mb-1 flex items-center gap-1">
                        <Wrench className="w-3 h-3 text-sky-600" />
                        Remediation & Compliance Action:
                      </div>
                      <div className="p-3 bg-sky-50/80 rounded-lg border border-sky-200 text-sky-950 text-[11px] leading-relaxed shadow-2xs">
                        {finding.recommendation}
                      </div>
                    </div>

                    {/* Statutory Enforcement Action */}
                    {finding.statutory_action && (
                      <div className="flex items-start gap-1.5 p-2 bg-rose-50/90 rounded-lg border border-rose-200 text-[10px] text-rose-900">
                        <FileWarning className="w-3.5 h-3.5 text-rose-600 shrink-0 mt-0.5" />
                        <span><strong>Enforcement:</strong> {finding.statutory_action}</span>
                      </div>
                    )}

                    {finding.element_guids.length > 0 && (
                      <button
                        type="button"
                        onClick={() => onLocateElement(finding.element_guids[0])}
                        className="w-full py-2 px-3 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-lg text-xs font-semibold text-slate-800 flex items-center justify-center gap-2 transition active:scale-98 shadow-2xs"
                      >
                        <Focus className="w-3.5 h-3.5 text-slate-600" />
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
