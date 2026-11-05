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
          className="p-4 rounded-xl border border-slate-800 bg-slate-900 text-white flex items-center gap-3.5 shadow-md"
        >
          <div
            className="w-10 h-10 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center shrink-0 shadow-xs"
          >
            {isRejected ? (
              <ShieldAlert className="w-5 h-5 text-rose-400" />
            ) : isApproved ? (
              <ShieldCheck className="w-5 h-5 text-emerald-400" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-amber-400" />
            )}
          </div>
          <div>
            <div className="text-[10px] font-mono uppercase tracking-widest font-semibold text-slate-400">
              Kenya Municipal Audit Verdict
            </div>
            <div className="text-sm font-extrabold tracking-tight leading-snug text-white">
              {isRejected
                ? 'NON-COMPLIANT — Recommend referral to NCA'
                : isApproved
                ? 'APPROVED — KENYA BUILDING CODE COMPLIANT'
                : 'FLAGGED FOR MANUAL STRUCTURAL REVIEW'}
            </div>
          </div>
        </div>

        {/* Cadastral & County Context Banner */}
        <div className="mt-3 px-3 py-2 bg-slate-100 rounded-lg border border-slate-200 flex items-center justify-between text-[11px] font-mono">
          <div className="flex items-center gap-1.5 text-slate-800 truncate max-w-[200px]" title={parcel_id}>
            <MapPin className="w-3.5 h-3.5 text-slate-500 shrink-0" />
            <span className="truncate font-semibold">{parcel_id}</span>
          </div>
          <span className="text-[10px] px-2 py-0.5 rounded bg-white border border-slate-200 text-slate-700 font-semibold truncate max-w-[170px] shadow-2xs" title={county || 'Nairobi City County'}>
            {county || 'Nairobi City County'}
          </span>
        </div>

        {/* Summary Metric Counters */}
        <div className="grid grid-cols-3 gap-2 mt-3 text-center">
          <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 text-white shadow-xs">
            <div className="flex items-center justify-center gap-1 text-[10px] text-slate-400 mb-0.5 font-medium">
              <Layers className="w-3.5 h-3.5 text-slate-400" />
              <span>Storeys</span>
            </div>
            <div className="text-base font-bold font-mono text-white">
              {metadata.total_storeys}
            </div>
          </div>

          <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 text-white shadow-xs">
            <div className="flex items-center justify-center gap-1 text-[10px] text-slate-400 mb-0.5 font-medium">
              <Columns className="w-3.5 h-3.5 text-slate-400" />
              <span>Columns</span>
            </div>
            <div className="text-base font-bold font-mono text-white">
              {metadata.total_columns}
            </div>
          </div>

          <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 text-white shadow-xs">
            <div className="flex items-center justify-center gap-1 text-[10px] text-slate-400 mb-0.5 font-medium">
              <AlertTriangle className="w-3.5 h-3.5 text-slate-400" />
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
      <div className="flex-1 p-5 overflow-y-auto space-y-3 bg-slate-100">
        <div className="flex items-center justify-between pb-1">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
            <Flame className="w-3.5 h-3.5 text-slate-700" />
            Kenyan Code Violations & Collapse Risks ({findings.length})
          </h3>
        </div>

        {findings.length === 0 ? (
          <div className="p-6 rounded-xl bg-white border border-slate-200 text-center space-y-2 shadow-xs">
            <CheckCircle2 className="w-8 h-8 text-slate-800 mx-auto" />
            <h4 className="text-xs font-bold text-slate-900">Code Compliant with Kenya Standards</h4>
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
                className="rounded-xl border border-slate-200 bg-white hover:border-slate-300 transition-all duration-200 overflow-hidden shadow-2xs"
              >
                <button
                  type="button"
                  onClick={() => toggleCard(finding.id)}
                  className="w-full p-3.5 flex items-center justify-between gap-3 text-left hover:bg-slate-50 transition"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span
                      className="text-[9px] font-mono px-2 py-0.5 rounded font-bold uppercase tracking-wider bg-slate-900 text-white"
                    >
                      {finding.severity}
                    </span>
                    <span className="text-xs font-bold text-slate-900 truncate">
                      {finding.title}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {finding.element_guids.length > 0 && (
                      <span className="text-[10px] font-mono text-slate-700 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded font-medium">
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
                      <div className="flex items-start gap-1.5 p-2 bg-slate-100 rounded-lg border border-slate-200 text-[10px] text-slate-800 font-mono">
                        <Scale className="w-3.5 h-3.5 text-slate-600 shrink-0 mt-0.5" />
                        <span><strong>Standard:</strong> {finding.standard_ref}</span>
                      </div>
                    )}

                    {/* Rule Provenance */}
                    {(finding.source_document || finding.clause_reference) && (
                      <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
                        {finding.source_document && (
                          <span className="px-2 py-0.5 rounded bg-slate-100 border border-slate-200 text-slate-700 font-mono">
                            📄 {finding.source_document}
                          </span>
                        )}
                        {finding.clause_reference && (
                          <span className="px-2 py-0.5 rounded bg-slate-100 border border-slate-200 text-slate-700 font-mono">
                            §{finding.clause_reference}
                          </span>
                        )}
                        {finding.last_reviewed && (
                          <span className="px-2 py-0.5 rounded bg-slate-50 border border-slate-200 text-slate-500 font-mono">
                            Reviewed: {finding.last_reviewed}
                          </span>
                        )}
                      </div>
                    )}

                    {/* Unverified Rule Tag */}
                    {finding.status === 'needs_review' && (
                      <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-amber-50 border border-amber-200 rounded-lg text-[10px] text-amber-800 font-semibold">
                        <AlertTriangle className="w-3 h-3 text-amber-500" />
                        Unverified rule — clause reference needs review
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
                      <div className="text-[10px] font-bold text-slate-700 uppercase tracking-wider mb-1 flex items-center gap-1">
                        <AlertOctagon className="w-3 h-3 text-slate-600" />
                        Kenyan Collapse Risk:
                      </div>
                      <p className="text-slate-800 bg-slate-100 p-2.5 rounded-lg border border-slate-200 text-[11px] leading-relaxed">
                        {finding.structural_risk}
                      </p>
                    </div>

                    {/* Actionable Remediation Callout */}
                    <div>
                      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1">
                        <Wrench className="w-3 h-3 text-slate-400" />
                        Remediation & Compliance Action:
                      </div>
                      <div className="p-3 bg-slate-900 rounded-lg border border-slate-800 text-slate-100 text-[11px] leading-relaxed shadow-xs">
                        {finding.recommendation}
                      </div>
                    </div>

                    {/* Statutory Enforcement Action */}
                    {finding.statutory_action && (
                      <div className="flex items-start gap-1.5 p-2 bg-slate-100 rounded-lg border border-slate-200 text-[10px] text-slate-700">
                        <FileWarning className="w-3.5 h-3.5 text-slate-500 shrink-0 mt-0.5" />
                        <span><strong>Enforcement:</strong> {finding.statutory_action}</span>
                      </div>
                    )}

                    {finding.element_guids.length > 0 && (
                      <button
                        type="button"
                        onClick={() => onLocateElement(finding.element_guids[0])}
                        className="w-full py-2 px-3 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-lg text-xs font-semibold text-white flex items-center justify-center gap-2 transition active:scale-98 shadow-xs"
                      >
                        <Focus className="w-3.5 h-3.5 text-slate-300" />
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
