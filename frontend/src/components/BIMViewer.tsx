import React, { useEffect, useRef, useState, useImperativeHandle, forwardRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import {
  RotateCcw,
  Eye,
  Box,
  Layers,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Info,
  AlertTriangle,
  CheckCircle2,
} from 'lucide-react';
import { Element3DGeometry, Finding } from '../types/audit';

export interface BIMViewerRef {
  focusElement: (guid: string) => void;
  resetCamera: () => void;
}

interface BIMViewerProps {
  elements: Element3DGeometry[];
  findings: Finding[];
  maxPermittedFloors?: number;
  highlightedGuid?: string | null;
  onSelectElement?: (element: Element3DGeometry | null) => void;
}

export const BIMViewer = forwardRef<BIMViewerRef, BIMViewerProps>(({
  elements,
  findings,
  maxPermittedFloors = 4,
  highlightedGuid,
  onSelectElement,
}, ref) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const meshMapRef = useRef<Map<string, THREE.Mesh>>(new Map());
  const reqIdRef = useRef<number | null>(null);

  const [wireframe, setWireframe] = useState(false);
  const [isolateViolations, setIsolateViolations] = useState(false);
  const [showZoningCeiling, setShowZoningCeiling] = useState(true);
  const [hoveredElement, setHoveredElement] = useState<Element3DGeometry | null>(null);
  const [selectedElement, setSelectedElement] = useState<Element3DGeometry | null>(null);

  const criticalGuids = new Set<string>();
  const warningGuids = new Set<string>();

  findings.forEach((f) => {
    f.element_guids.forEach((g) => {
      if (f.severity === 'CRITICAL') {
        criticalGuids.add(g);
      } else if (f.severity === 'WARNING') {
        warningGuids.add(g);
      }
    });
  });

  let minX = Infinity, maxX = -Infinity;
  let minY = Infinity, maxY = -Infinity;
  let minZ = Infinity, maxZ = -Infinity;

  elements.forEach((el) => {
    const [x, y, z] = el.position;
    minX = Math.min(minX, x); maxX = Math.max(maxX, x);
    minY = Math.min(minY, y); maxY = Math.max(maxY, y);
    minZ = Math.min(minZ, z); maxZ = Math.max(maxZ, z);
  });

  const centerX = (minX + maxX) / 2 || 4;
  const centerY = (minY + maxY) / 2 || 6;
  const centerZ = (minZ + maxZ) / 2 || 4;
  const modelHeight = (maxY - minY) || 12;

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x090d16);
    scene.fog = new THREE.FogExp2(0x090d16, 0.012);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(
      45,
      container.clientWidth / container.clientHeight,
      0.1,
      1000
    );
    camera.position.set(centerX + 18, centerY + 14, centerZ + 22);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    container.innerHTML = '';
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.target.set(centerX, centerY, centerZ);
    controls.maxPolarAngle = Math.PI / 2 - 0.02; // Don't flip below ground
    controls.minDistance = 3;
    controls.maxDistance = 150;
    controlsRef.current = controls;

    const hemiLight = new THREE.HemisphereLight(0x38bdf8, 0x0f172a, 0.9);
    scene.add(hemiLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 1.4);
    dirLight.position.set(centerX + 25, centerY + 40, centerZ + 20);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 1024;
    dirLight.shadow.mapSize.height = 1024;
    scene.add(dirLight);

    const cyanRimLight = new THREE.DirectionalLight(0x06b6d4, 0.6);
    cyanRimLight.position.set(centerX - 30, centerY + 10, centerZ - 20);
    scene.add(cyanRimLight);

    const gridHelper = new THREE.GridHelper(50, 50, 0x0284c7, 0x1e293b);
    gridHelper.position.y = -0.05;
    gridHelper.position.x = centerX;
    gridHelper.position.z = centerZ;
    scene.add(gridHelper);

    const groundGeo = new THREE.PlaneGeometry(120, 120);
    const groundMat = new THREE.MeshStandardMaterial({
      color: 0x070b12,
      roughness: 0.9,
      metalness: 0.1,
    });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(centerX, -0.1, centerZ);
    ground.receiveShadow = true;
    scene.add(ground);

    const animate = () => {
      reqIdRef.current = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    const handleResize = () => {
      if (!container || !camera || !renderer) return;
      camera.aspect = container.clientWidth / container.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(container.clientWidth, container.clientHeight);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (reqIdRef.current) cancelAnimationFrame(reqIdRef.current);
      renderer.dispose();
      controls.dispose();
    };
  }, []);

  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;

    meshMapRef.current.forEach((mesh) => {
      scene.remove(mesh);
      mesh.geometry.dispose();
      if (Array.isArray(mesh.material)) {
        mesh.material.forEach((m) => m.dispose());
      } else {
        mesh.material.dispose();
      }
    });
    meshMapRef.current.clear();

    const defaultConcreteMat = new THREE.MeshStandardMaterial({
      color: 0xcbd5e1,
      transparent: true,
      opacity: 0.65,
      roughness: 0.5,
      metalness: 0.1,
      wireframe,
    });

    const slabMat = new THREE.MeshStandardMaterial({
      color: 0x475569,
      transparent: true,
      opacity: 0.35,
      roughness: 0.7,
      metalness: 0.2,
      wireframe,
    });

    const criticalMat = new THREE.MeshStandardMaterial({
      color: 0xef4444,
      emissive: 0x7f1d1d,
      emissiveIntensity: 0.4,
      roughness: 0.3,
      metalness: 0.2,
      wireframe,
    });

    const warningMat = new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      emissive: 0x78350f,
      emissiveIntensity: 0.4,
      roughness: 0.3,
      metalness: 0.2,
      wireframe,
    });

    const isolatedDimMat = new THREE.MeshStandardMaterial({
      color: 0x334155,
      transparent: true,
      opacity: 0.08,
      wireframe,
    });

    elements.forEach((el) => {
      const isCritical = criticalGuids.has(el.guid);
      const isWarning = warningGuids.has(el.guid);
      const hasViolation = isCritical || isWarning;

      if (isolateViolations && !hasViolation && el.type !== 'IfcBuildingStorey') {
      }

      const [dx, dy, dz] = el.dimensions;
      const [x, y, z] = el.position;

      let geo: THREE.BufferGeometry;
      if (el.type === 'IfcColumn') {
        geo = new THREE.BoxGeometry(dx, dy, dz);
      } else if (el.type === 'IfcBuildingStorey') {
        geo = new THREE.BoxGeometry(dx, dy, dz);
      } else {
        geo = new THREE.BoxGeometry(dx, dy, dz);
      }

      let mat: THREE.Material;
      if (isolateViolations && !hasViolation) {
        mat = isolatedDimMat;
      } else if (isCritical) {
        mat = criticalMat;
      } else if (isWarning) {
        mat = warningMat;
      } else if (el.type === 'IfcBuildingStorey') {
        mat = slabMat;
      } else {
        mat = defaultConcreteMat;
      }

      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(x, y, z);
      mesh.castShadow = !isolateViolations || hasViolation;
      mesh.receiveShadow = true;
      mesh.userData = { element: el, isCritical, isWarning };

      scene.add(mesh);
      meshMapRef.current.set(el.guid, mesh);
    });

    if (showZoningCeiling && elements.length > 0) {
      const ceilingHeight = maxPermittedFloors * 3.0;
      const ceilingGeo = new THREE.PlaneGeometry(16, 16);
      const ceilingMat = new THREE.MeshBasicMaterial({
        color: 0xef4444,
        transparent: true,
        opacity: 0.2,
        side: THREE.DoubleSide,
        depthWrite: false,
      });
      const ceiling = new THREE.Mesh(ceilingGeo, ceilingMat);
      ceiling.rotation.x = Math.PI / 2;
      ceiling.position.set(centerX, ceilingHeight, centerZ);
      scene.add(ceiling);

      const edges = new THREE.EdgesGeometry(ceilingGeo);
      const line = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: 0xef4444, linewidth: 2 }));
      line.rotation.x = Math.PI / 2;
      line.position.set(centerX, ceilingHeight, centerZ);
      scene.add(line);
      meshMapRef.current.set('__zoning_ceiling__', ceiling);
      meshMapRef.current.set('__zoning_border__', line as any);
    }
  }, [elements, findings, wireframe, isolateViolations, showZoningCeiling]);

  useEffect(() => {
    if (!highlightedGuid) return;
    focusElement(highlightedGuid);
  }, [highlightedGuid]);

  const focusElement = (guid: string) => {
    const mesh = meshMapRef.current.get(guid);
    if (!mesh || !controlsRef.current || !cameraRef.current) return;

    const targetPos = mesh.position.clone();
    const camera = cameraRef.current;
    const controls = controlsRef.current;

    const startTarget = controls.target.clone();
    const startCamPos = camera.position.clone();
    const desiredCamPos = new THREE.Vector3(
      targetPos.x + 6,
      targetPos.y + 4,
      targetPos.z + 8
    );

    let progress = 0;
    const animateFocus = () => {
      progress += 0.05;
      if (progress <= 1.0) {
        controls.target.lerpVectors(startTarget, targetPos, progress);
        camera.position.lerpVectors(startCamPos, desiredCamPos, progress);
        requestAnimationFrame(animateFocus);
      } else {
        controls.target.copy(targetPos);
        camera.position.copy(desiredCamPos);
      }
    };
    animateFocus();

    const origMaterial = mesh.material;
    const pulseMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0xef4444,
      emissiveIntensity: 1.0,
      roughness: 0.1,
    });
    mesh.material = pulseMat;
    setTimeout(() => {
      mesh.material = origMaterial;
    }, 1200);

    const elem = mesh.userData.element as Element3DGeometry;
    setSelectedElement(elem);
    if (onSelectElement) onSelectElement(elem);
  };

  const resetCamera = () => {
    if (!controlsRef.current || !cameraRef.current) return;
    const camera = cameraRef.current;
    const controls = controlsRef.current;

    controls.target.set(centerX, centerY, centerZ);
    camera.position.set(centerX + 18, centerY + 14, centerZ + 22);
    setSelectedElement(null);
    if (onSelectElement) onSelectElement(null);
  };

  useImperativeHandle(ref, () => ({
    focusElement,
    resetCamera,
  }));

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const container = mountRef.current;
    if (!container || !cameraRef.current || !sceneRef.current) return;

    const rect = container.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / container.clientWidth) * 2 - 1;
    const y = -((e.clientY - rect.top) / container.clientHeight) * 2 + 1;

    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(new THREE.Vector2(x, y), cameraRef.current);

    const meshes = Array.from(meshMapRef.current.values()).filter(
      (m) => m.userData && m.userData.element
    );
    const intersects = raycaster.intersectObjects(meshes);

    if (intersects.length > 0) {
      const hit = intersects[0].object as THREE.Mesh;
      const elem = hit.userData.element as Element3DGeometry;
      setSelectedElement(elem);
      if (onSelectElement) onSelectElement(elem);
    } else {
      setSelectedElement(null);
      if (onSelectElement) onSelectElement(null);
    }
  };

  return (
    <div className="relative w-full h-full bg-slate-950 flex flex-col overflow-hidden select-none">
      <div
        ref={mountRef}
        onClick={handleClick}
        className="w-full h-full cursor-grab active:cursor-grabbing outline-none"
      />

      <div className="absolute top-4 left-4 z-20 flex items-center gap-1.5 p-1.5 rounded-xl bg-slate-900/90 backdrop-blur-md border border-slate-700/80 shadow-2xl">
        <button
          onClick={resetCamera}
          className="p-2 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition active:scale-95"
          title="Reset Camera View"
        >
          <RotateCcw className="w-4 h-4 text-cyan-400" />
        </button>

        <div className="w-[1px] h-5 bg-slate-800 mx-1" />

        <button
          onClick={() => setIsolateViolations(!isolateViolations)}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition active:scale-95 ${
            isolateViolations
              ? 'bg-rose-950/80 text-rose-300 border border-rose-700/80'
              : 'text-slate-300 hover:text-white hover:bg-slate-800'
          }`}
          title="Isolate only structural violations"
        >
          <AlertTriangle className={`w-3.5 h-3.5 ${isolateViolations ? 'text-rose-400' : 'text-slate-400'}`} />
          <span>Isolate Violations</span>
        </button>

        <button
          onClick={() => setWireframe(!wireframe)}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition active:scale-95 ${
            wireframe
              ? 'bg-cyan-950/80 text-cyan-300 border border-cyan-700/80'
              : 'text-slate-300 hover:text-white hover:bg-slate-800'
          }`}
          title="Toggle wireframe rendering"
        >
          <Box className={`w-3.5 h-3.5 ${wireframe ? 'text-cyan-400' : 'text-slate-400'}`} />
          <span>Wireframe</span>
        </button>

        <button
          onClick={() => setShowZoningCeiling(!showZoningCeiling)}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition active:scale-95 ${
            showZoningCeiling
              ? 'bg-amber-950/80 text-amber-300 border border-amber-700/80'
              : 'text-slate-300 hover:text-white hover:bg-slate-800'
          }`}
          title="Toggle zoning permitted height limit plane"
        >
          <Layers className={`w-3.5 h-3.5 ${showZoningCeiling ? 'text-amber-400' : 'text-slate-400'}`} />
          <span>Zoning Ceiling ({maxPermittedFloors}F)</span>
        </button>
      </div>

      <div className="absolute bottom-4 left-4 z-20 p-3 rounded-xl bg-slate-900/90 backdrop-blur-md border border-slate-700/80 shadow-2xl flex items-center gap-4 text-xs font-mono">
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-sm bg-rose-500 shadow-sm shadow-rose-500/50" />
          <span className="text-slate-300">Critical Violation</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-sm bg-amber-500 shadow-sm shadow-amber-500/50" />
          <span className="text-slate-300">Warning</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-sm bg-slate-300 opacity-65" />
          <span className="text-slate-300">Compliant Member</span>
        </div>
      </div>

      {selectedElement && (
        <div className="absolute top-4 right-4 z-20 max-w-sm w-full p-4 rounded-xl bg-slate-900/95 backdrop-blur-md border border-slate-700 shadow-2xl animate-in fade-in slide-in-from-right-2">
          <div className="flex items-start justify-between border-b border-slate-800 pb-2 mb-3">
            <div>
              <span className="text-[10px] uppercase font-mono tracking-wider text-cyan-400 font-semibold">
                {selectedElement.type}
              </span>
              <h4 className="text-sm font-bold text-white tracking-tight">{selectedElement.name}</h4>
            </div>
            <button
              onClick={() => setSelectedElement(null)}
              className="text-slate-500 hover:text-slate-300 text-xs px-1.5 py-0.5 rounded hover:bg-slate-800"
            >
              ✕
            </button>
          </div>

          <div className="space-y-1.5 text-xs font-mono text-slate-300">
            <div className="flex justify-between">
              <span className="text-slate-500">GlobalId:</span>
              <span className="text-cyan-300 text-[11px] truncate max-w-[180px]">{selectedElement.guid}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Storey:</span>
              <span className="text-slate-200">{selectedElement.storey || 'Unknown'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Position (x,y,z):</span>
              <span className="text-slate-200">
                {selectedElement.position.map((v) => v.toFixed(2)).join(', ')} m
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Dimensions:</span>
              <span className="text-slate-200">
                {(selectedElement.dimensions[0] * 1000).toFixed(0)} × {(selectedElement.dimensions[2] * 1000).toFixed(0)} mm
              </span>
            </div>
          </div>

          {findings.some((f) => f.element_guids.includes(selectedElement.guid)) && (
            <div className="mt-3 pt-2.5 border-t border-slate-800">
              <div className="text-[11px] font-bold text-rose-400 flex items-center gap-1.5 mb-1">
                <AlertTriangle className="w-3.5 h-3.5 text-rose-500" />
                Active Structural Violation
              </div>
              <p className="text-[11px] text-slate-300 leading-snug">
                {
                  findings.find((f) => f.element_guids.includes(selectedElement.guid))?.title
                }
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
});
