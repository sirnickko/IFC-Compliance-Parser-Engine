import React, { useState, useEffect, useRef } from 'react';
import { Navbar } from './components/Navbar';
import { PlanUploader } from './components/PlanUploader';
import { BIMViewer, BIMViewerRef } from './components/BIMViewer';
import { RemediationDrawer } from './components/RemediationDrawer';
import { AuditFormValues, AuditResponse, Element3DGeometry } from './types/audit';
import { auditPlan, loadSampleAudit, checkHealth } from './services/api';

export const App: React.FC = () => {
  const [auditResult, setAuditResult] = useState<AuditResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [backendHealthy, setBackendHealthy] = useState<boolean>(true);
  const [highlightedGuid, setHighlightedGuid] = useState<string | null>(null);
  const [selectedElement, setSelectedElement] = useState<Element3DGeometry | null>(null);

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
    if ((formValues as any).sampleName) {
      await handleLoadSample((formValues as any).sampleName);
      return;
    }
    if (!formValues.file) return;
    setIsLoading(true);
    try {
      const result = await auditPlan(
        formValues.file,
        formValues.parcelId,
        formValues.maxPermittedFloors,
        formValues.minColumnDimMm
      );
      setAuditResult(result);
      setHighlightedGuid(null);
    } catch (err) {
      console.error('Audit failed:', err);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const handleLoadSample = async (sampleName: 'violating' | 'compliant') => {
    setIsLoading(true);
    try {
      const result = await loadSampleAudit(sampleName, 4, 200);
      setAuditResult(result);
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
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-slate-950 text-slate-100">
      <Navbar
        onLoadSample={handleLoadSample}
        auditResult={auditResult}
        backendHealthy={backendHealthy}
        isLoading={isLoading}
      />

      <main className="flex-1 flex overflow-hidden">
        <section className="w-[340px] shrink-0 h-full">
          <PlanUploader
            onAudit={handleAudit}
            auditResult={auditResult}
            isLoading={isLoading}
          />
        </section>

        <section className="flex-1 h-full relative">
          <BIMViewer
            ref={bimViewerRef}
            elements={auditResult?.elements_3d || []}
            findings={auditResult?.findings || []}
            maxPermittedFloors={4}
            highlightedGuid={highlightedGuid}
            onSelectElement={setSelectedElement}
          />
        </section>

        <section className="w-[420px] shrink-0 h-full">
          <RemediationDrawer
            auditResult={auditResult}
            onLocateElement={handleLocateElement}
          />
        </section>
      </main>
    </div>
  );
};

export default App;
