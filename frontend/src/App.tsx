import React, { useState, useEffect, useRef } from 'react';
import { Navbar } from './components/Navbar';
import { PlanUploader } from './components/PlanUploader';
import { BIMViewer, BIMViewerRef } from './components/BIMViewer';
import { RemediationDrawer } from './components/RemediationDrawer';
import { AuditFormValues, AuditResponse, Element3DGeometry, VersionDiff } from './types/audit';
import { auditPlan, loadSampleAudit, checkHealth, comparePlans } from './services/api';

export const App: React.FC = () => {
  const [auditResult, setAuditResult] = useState<AuditResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [backendHealthy, setBackendHealthy] = useState<boolean>(true);
  const [highlightedGuid, setHighlightedGuid] = useState<string | null>(null);
  const [selectedElement, setSelectedElement] = useState<Element3DGeometry | null>(null);
  const [versionDiff, setVersionDiff] = useState<VersionDiff | null>(null);

  const bimViewerRef = useRef<BIMViewerRef>(null);

  useEffect(() => {
    const verifyHealth = async () => {
      try {
        await checkHealth();
        setBackendHealthy(true);
      } catch {
        setBackendHealthy(false);
      }
    };
    verifyHealth();
    const interval = setInterval(verifyHealth, 15000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    handleLoadSample('violating');
  }, []);

  const handleAudit = async (formValues: AuditFormValues) => {
    if (formValues.sampleName) {
      await handleLoadSample(formValues.sampleName);
      return;
    }
    if (!formValues.file) return;
    setIsLoading(true);
    try {
      const result = await auditPlan(
        formValues.file,
        formValues.parcelId,
        formValues.maxPermittedFloors,
        formValues.minColumnDimMm,
        formValues.county,
        formValues.zoningZone
      );
      setAuditResult(result);
      setVersionDiff(null);
      setHighlightedGuid(null);
    } catch (err) {
      console.error('Audit failed:', err);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const handleCompare = async (approvedFile: File, currentFile: File) => {
    setIsLoading(true);
    try {
      const diff = await comparePlans(approvedFile, currentFile);
      setVersionDiff(diff);
      setAuditResult(null);
      setHighlightedGuid(null);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLoadSample = async (sampleName: 'violating' | 'compliant') => {
    setIsLoading(true);
    try {
      const result = await loadSampleAudit(sampleName, 4, 200);
      setAuditResult(result);
      setVersionDiff(null);
      setHighlightedGuid(null);
      setTimeout(() => {
        bimViewerRef.current?.resetCamera();
      }, 100);
    } catch (err) {
      console.error(`Failed to load ${sampleName} sample:`, err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLocateElement = (guid: string) => {
    setHighlightedGuid(guid);
    if (bimViewerRef.current) {
      bimViewerRef.current.focusElement(guid);
    }
  };

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-slate-100 text-slate-900 font-sans antialiased">
      <Navbar
        onLoadSample={handleLoadSample}
        auditResult={auditResult}
        versionDiff={versionDiff}
        backendHealthy={backendHealthy}
        isLoading={isLoading}
      />

      <main className="flex-1 flex overflow-hidden">
        <section className="w-[340px] shrink-0 h-full border-r border-slate-200">
          <PlanUploader
            onAudit={handleAudit}
            onCompare={handleCompare}
            auditResult={auditResult}
            versionDiff={versionDiff}
            isLoading={isLoading}
          />
        </section>

        <section className="flex-1 h-full relative bg-slate-100">
          <BIMViewer
            ref={bimViewerRef}
            elements={[
              ...(auditResult?.elements_3d || []),
              ...(versionDiff?.added_elements || []),
              ...(versionDiff?.removed_elements || []),
            ]}
            findings={auditResult?.findings || []}
            maxPermittedFloors={4}
            highlightedGuid={highlightedGuid}
            onSelectElement={setSelectedElement}
          />
        </section>

        <section className="w-[420px] shrink-0 h-full border-l border-slate-200">
          <RemediationDrawer
            auditResult={auditResult}
            versionDiff={versionDiff}
            onLocateElement={handleLocateElement}
          />
        </section>
      </main>
    </div>
  );
};

export default App;
