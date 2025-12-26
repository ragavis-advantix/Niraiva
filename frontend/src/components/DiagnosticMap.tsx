import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import { ZoomIn, ZoomOut, Maximize2 } from 'lucide-react';
import { DiagnosticNode } from '@/utils/healthData';
import { useIsMobile } from '@/hooks/use-mobile';

interface DiagnosticMapProps {
  nodes: DiagnosticNode[];
  className?: string;
}

export function DiagnosticMap({ nodes, className }: DiagnosticMapProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [activeNode, setActiveNode] = useState<DiagnosticNode | null>(null);
  const [viewBox, setViewBox] = useState('0 0 1000 1000');
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [lastPan, setLastPan] = useState({ x: 0, y: 0 });
  const [pinchDistance, setPinchDistance] = useState<number | null>(null);
  const [lastZoom, setLastZoom] = useState(1);
  const [initialTouchPosition, setInitialTouchPosition] = useState({ x: 0, y: 0 });
  const [isPinching, setIsPinching] = useState(false);
  const [pinchFingerRemoved, setPinchFingerRemoved] = useState(false);
  const isMobile = useIsMobile();

  // Memoize sortedNodes so the array identity is stable between renders
  // unless `nodes` actually changes. This prevents effects that depend
  // on `sortedNodes` from running every render and causing update loops.
  const sortedNodes = useMemo(() => {
    // Support nodes that may not have a `date` field by falling back
    // to other possible timestamp fields or the epoch. Also keep the
    // array identity stable by spreading into a new array.
    return [...nodes].sort((a, b) => {
      const aTime = new Date((a as any).date ?? (a as any).timestamp ?? 0).getTime();
      const bTime = new Date((b as any).date ?? (b as any).timestamp ?? 0).getTime();
      return aTime - bTime;
    });
  }, [nodes]);

  useEffect(() => {
    if (sortedNodes.length > 0 && svgRef.current) {
      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;

      sortedNodes.forEach(node => {
        const pos = getNodePosition(node);
        minX = Math.min(minX, pos.x - 100);
        maxX = Math.max(maxX, pos.x + 100);
        minY = Math.min(minY, pos.y - 50);
        maxY = Math.max(maxY, pos.y + 100);
      });

      const width = maxX - minX + 200;
      const height = maxY - minY + 200;

      setPan({ x: minX - 100, y: minY - 100 });
      setViewBox(`${minX - 100} ${minY - 100} ${width} ${height}`);
    }
  }, [sortedNodes]);

  const getNodeColor = (nodeType: string) => {
    switch (nodeType.toLowerCase()) {
      case 'initial':
        return "#CCFBF1"; // Teal-50
      case 'terminal':
        return "#D1FAE5"; // Emerald-100
      case 'symptoms':
        return "#FED7AA"; // Orange-200
      case 'treatment':
        return "#A7F3D0"; // Emerald-200
      case 'care':
        return "#BAE6FD"; // Sky-200
      case 'diagnosis':
        return "#E9D5FF"; // Purple-200
      default:
        return "#F1F5F9"; // Slate-100
    }
  };

  // Function to get connection color based on the type of connection
  const getConnectionColor = (sourceNode: DiagnosticNode, targetNode: DiagnosticNode) => {
    // Find connection type from source and target nodes. Use fallbacks
    // for `title` (or `name`) in case the node shape differs.
    const sourceType = ((sourceNode as any).title ?? (sourceNode as any).name ?? '').toLowerCase();
    const targetType = ((targetNode as any).title ?? (targetNode as any).name ?? '').toLowerCase();

    if (sourceType.includes('symptom') || targetType.includes('symptom')) {
      return "#F97316"; // Orange for symptom connections
    } else if (sourceType.includes('treatment') || targetType.includes('treatment') ||
      sourceType.includes('medication') || targetType.includes('medication')) {
      return "#10B981"; // Green for treatment connections
    } else if (sourceType.includes('care') || targetType.includes('care')) {
      return "#0EA5E9"; // Blue for care connections
    } else if (sourceType.includes('diagnosis') || targetType.includes('diagnosis')) {
      return "#8B5CF6"; // Purple for diagnosis connections
    } else if (sourceType.includes('recovery') || targetType.includes('recovery')) {
      return "#06B6D4"; // Teal for recovery connections
    } else {
      return "#9CA3AF"; // Default gray
    }
  };

  const getNodePosition = (node: DiagnosticNode) => {
    // Some node shapes may not include x/y. Default to 0 when missing so
    // layout can still render deterministically.
    const nx = (node as any).x ?? 0;
    const ny = (node as any).y ?? 0;
    const baseX = 150 + nx * 250;
    const baseY = 100 + ny * 150;
    return { x: baseX, y: baseY };
  };

  const getConnectionPath = (sourceNode: DiagnosticNode, targetNode: DiagnosticNode) => {
    const sourcePos = getNodePosition(sourceNode);
    const targetPos = getNodePosition(targetNode);

    return `M${sourcePos.x},${sourcePos.y} 
            Q${(sourcePos.x + targetPos.x) / 2},${(sourcePos.y + targetPos.y) / 2 - 30} 
            ${targetPos.x},${targetPos.y}`;
  };

  const calculateZoomAndPan = useCallback((centerX: number, centerY: number, newZoom: number, curZoom: number) => {
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();

      // Convert screen coordinates to SVG coordinates
      const svgX = ((centerX - rect.left) / rect.width) * 1000 / curZoom + pan.x;
      const svgY = ((centerY - rect.top) / rect.height) * 1000 / curZoom + pan.y;

      // Calculate new pan to maintain the cursor position
      const newPanX = svgX - ((centerX - rect.left) / rect.width) * 1000 / newZoom;
      const newPanY = svgY - ((centerY - rect.top) / rect.height) * 1000 / newZoom;

      return { newPanX, newPanY };
    }
    return { newPanX: pan.x, newPanY: pan.y };
  }, [pan]);

  const zoomIn = useCallback((centerX?: number, centerY?: number) => {
    const newZoom = Math.min(zoom + 0.2, 3);

    if (centerX !== undefined && centerY !== undefined) {
      const { newPanX, newPanY } = calculateZoomAndPan(centerX, centerY, newZoom, zoom);

      setZoom(newZoom);
      setPan({ x: newPanX, y: newPanY });
    } else if (containerRef.current) {
      // Default to center of container if no coordinates provided
      const rect = containerRef.current.getBoundingClientRect();
      const centerOfContainerX = rect.width / 2;
      const centerOfContainerY = rect.height / 2;

      const { newPanX, newPanY } = calculateZoomAndPan(centerOfContainerX, centerOfContainerY, newZoom, zoom);

      setZoom(newZoom);
      setPan({ x: newPanX, y: newPanY });
    } else {
      setZoom(newZoom);
    }
  }, [zoom, calculateZoomAndPan]);

  const zoomOut = useCallback((centerX?: number, centerY?: number) => {
    const newZoom = Math.max(zoom - 0.2, 0.3);

    if (centerX !== undefined && centerY !== undefined) {
      const { newPanX, newPanY } = calculateZoomAndPan(centerX, centerY, newZoom, zoom);

      setZoom(newZoom);
      setPan({ x: newPanX, y: newPanY });
    } else if (containerRef.current) {
      // Default to center of container if no coordinates provided
      const rect = containerRef.current.getBoundingClientRect();
      const centerOfContainerX = rect.width / 2;
      const centerOfContainerY = rect.height / 2;

      const { newPanX, newPanY } = calculateZoomAndPan(centerOfContainerX, centerOfContainerY, newZoom, zoom);

      setZoom(newZoom);
      setPan({ x: newPanX, y: newPanY });
    } else {
      setZoom(newZoom);
    }
  }, [zoom, calculateZoomAndPan]);

  const resetView = useCallback(() => {
    if (sortedNodes.length > 0) {
      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;

      sortedNodes.forEach(node => {
        const pos = getNodePosition(node);
        minX = Math.min(minX, pos.x - 100);
        maxX = Math.max(maxX, pos.x + 100);
        minY = Math.min(minY, pos.y - 50);
        maxY = Math.max(maxY, pos.y + 100);
      });

      const width = maxX - minX + 200;
      const height = maxY - minY + 200;

      setZoom(1);
      setPan({ x: minX - 100, y: minY - 100 });
      setViewBox(`${minX - 100} ${minY - 100} ${width} ${height}`);
    }
  }, [sortedNodes]);

  const getTouchDistance = (e: React.TouchEvent) => {
    if (e.touches.length < 2) return null;

    const dx = e.touches[0].clientX - e.touches[1].clientX;
    const dy = e.touches[0].clientY - e.touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
  };

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      setIsDragging(true);
      setInitialTouchPosition({
        x: e.touches[0].clientX,
        y: e.touches[0].clientY
      });
      setDragStart({
        x: e.touches[0].clientX,
        y: e.touches[0].clientY
      });
      setLastPan({ ...pan });
      setPinchFingerRemoved(false);
      setTimeout(() => {
        setIsPinching(false);
      }, 50);
    } else if (e.touches.length === 2) {
      setIsPinching(true);
      setIsDragging(false);
      const distance = getTouchDistance(e);
      setPinchDistance(distance);
      setLastZoom(zoom);
      setPinchFingerRemoved(false);
    }
  }, [pan, zoom]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (isDragging && e.touches.length === 1 && (!isPinching || pinchFingerRemoved)) {
      // preventDefault for touchmove is handled by a native non-passive
      // listener attached to the container (see effect below). Avoid
      // calling preventDefault on the React synthetic event because
      // React may attach passive listeners which cause the browser
      // to warn.
      const dx = (e.touches[0].clientX - dragStart.x) / zoom;
      const dy = (e.touches[0].clientY - dragStart.y) / zoom;

      setPan({
        x: lastPan.x - dx,
        y: lastPan.y - dy
      });
    } else if (e.touches.length === 2) {
      // Native listener handles preventDefault for multi-touch as well.
      setIsPinching(true);

      const newDistance = getTouchDistance(e);
      if (newDistance === null) return;

      const scaleFactor = newDistance / (pinchDistance || 1);
      const newZoom = Math.max(0.3, Math.min(3, lastZoom * scaleFactor));

      // Get center point between the two fingers
      const centerX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
      const centerY = (e.touches[0].clientY + e.touches[1].clientY) / 2;

      if (containerRef.current) {
        const { newPanX, newPanY } = calculateZoomAndPan(centerX, centerY, newZoom, lastZoom);

        setZoom(newZoom);
        setPan({ x: newPanX, y: newPanY });
      }
    }
  }, [isDragging, dragStart, lastPan, zoom, pinchDistance, lastZoom, pan, isPinching, pinchFingerRemoved, calculateZoomAndPan]);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 0) {
      // All fingers removed
      if (isPinching) {
        setPinchFingerRemoved(true);
      }

      setTimeout(() => {
        setIsDragging(false);
        setIsPinching(false);
      }, 100);

    } else if (e.touches.length === 1 && isPinching) {
      // One finger left after pinching
      setPinchFingerRemoved(true);

      // Update the drag start for subsequent panning
      setDragStart({
        x: e.touches[0].clientX,
        y: e.touches[0].clientY
      });
      setLastPan({ ...pan });

      setTimeout(() => {
        setIsPinching(false);
      }, 100);
    }

    setPinchDistance(null);
  }, [isPinching, pan]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX, y: e.clientY });
    setLastPan({ ...pan });
  }, [pan]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging) return;

    const dx = (e.clientX - dragStart.x) / zoom;
    const dy = (e.clientY - dragStart.y) / zoom;

    setPan({
      x: lastPan.x - dx,
      y: lastPan.y - dy
    });
  }, [isDragging, dragStart, lastPan, zoom]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    // preventDefault is handled by a native non-passive wheel listener
    // attached to the container. Here we keep the logic but avoid
    // calling preventDefault on the React synthetic event to prevent
    // passive listener warnings.
    const { deltaY, clientX, clientY } = e;
    if (deltaY > 0) zoomOut(clientX, clientY);
    else zoomIn(clientX, clientY);
  }, [zoomIn, zoomOut]);

  const handleDoubleClick = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    zoomIn(e.clientX, e.clientY);
  }, [zoomIn]);

  useEffect(() => {
    if (!svgRef.current) return;

    const width = 1000 / zoom;
    const height = 1000 / zoom;

    setViewBox(`${pan.x} ${pan.y} ${width} ${height}`);
  }, [zoom, pan]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const preventDefaultTouchMove = (e: TouchEvent) => {
      if (isDragging || isPinching || e.touches.length === 2) {
        e.preventDefault();
      }
    };

    container.addEventListener('touchmove', preventDefaultTouchMove, { passive: false });

    return () => {
      container.removeEventListener('touchmove', preventDefaultTouchMove);
    };
  }, [isDragging, isPinching]);

  // Attach a native wheel listener with passive: false so we can call
  // preventDefault safely when the user scrolls over the map. React's
  // synthetic onWheel may use passive listeners which prevents calling
  // preventDefault without a browser warning.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const onNativeWheel = (ev: WheelEvent) => {
      // Prevent the page from scrolling while interacting with the map
      ev.preventDefault();
      const { deltaY, clientX, clientY } = ev;
      if (deltaY > 0) zoomOut(clientX, clientY);
      else zoomIn(clientX, clientY);
    };

    container.addEventListener('wheel', onNativeWheel, { passive: false });
    return () => container.removeEventListener('wheel', onNativeWheel as EventListener);
  }, [zoomIn, zoomOut]);

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      <div className="glass-panel p-4 rounded-xl overflow-hidden">
        <div className="absolute top-6 right-6 z-10 flex space-x-2">
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={() => zoomIn()}
            className="bg-white dark:bg-gray-800 p-2 rounded-full shadow-md hover:shadow-lg transition-shadow"
            aria-label="Zoom in"
          >
            <ZoomIn className="h-5 w-5 text-gray-700 dark:text-gray-300" />
          </motion.button>
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={() => zoomOut()}
            className="bg-white dark:bg-gray-800 p-2 rounded-full shadow-md hover:shadow-lg transition-shadow"
            aria-label="Zoom out"
          >
            <ZoomOut className="h-5 w-5 text-gray-700 dark:text-gray-300" />
          </motion.button>
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={resetView}
            className="bg-white dark:bg-gray-800 p-2 rounded-full shadow-md hover:shadow-lg transition-shadow"
            aria-label="Reset view"
          >
            <Maximize2 className="h-5 w-5 text-gray-700 dark:text-gray-300" />
          </motion.button>
        </div>

        <div
          className="w-full h-[700px] relative touch-none"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onDoubleClick={handleDoubleClick}
        >
          <svg
            ref={svgRef}
            viewBox={viewBox}
            className="w-full h-full bg-gray-50 dark:bg-gray-900 rounded-lg"
            style={{
              cursor: isDragging ? 'grabbing' : 'grab'
            }}
          >
            <defs>
              {/* Define markers with different colors */}
              <marker
                id="arrowhead-default"
                markerWidth="10"
                markerHeight="7"
                refX="7"
                refY="3.5"
                orient="auto"
              >
                <polygon
                  points="0 0, 7 3.5, 0 7"
                  fill="#9CA3AF"
                />
              </marker>
              <marker
                id="arrowhead-symptom"
                markerWidth="10"
                markerHeight="7"
                refX="7"
                refY="3.5"
                orient="auto"
              >
                <polygon
                  points="0 0, 7 3.5, 0 7"
                  fill="#F97316"
                />
              </marker>
              <marker
                id="arrowhead-treatment"
                markerWidth="10"
                markerHeight="7"
                refX="7"
                refY="3.5"
                orient="auto"
              >
                <polygon
                  points="0 0, 7 3.5, 0 7"
                  fill="#10B981"
                />
              </marker>
              <marker
                id="arrowhead-care"
                markerWidth="10"
                markerHeight="7"
                refX="7"
                refY="3.5"
                orient="auto"
              >
                <polygon
                  points="0 0, 7 3.5, 0 7"
                  fill="#0EA5E9"
                />
              </marker>
              <marker
                id="arrowhead-diagnosis"
                markerWidth="10"
                markerHeight="7"
                refX="7"
                refY="3.5"
                orient="auto"
              >
                <polygon
                  points="0 0, 7 3.5, 0 7"
                  fill="#8B5CF6"
                />
              </marker>
              <marker
                id="arrowhead-recovery"
                markerWidth="10"
                markerHeight="7"
                refX="7"
                refY="3.5"
                orient="auto"
              >
                <polygon
                  points="0 0, 7 3.5, 0 7"
                  fill="#06B6D4"
                />
              </marker>

              {/* Define gradients for prettier connections */}
              <linearGradient id="gradient-symptom" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#F97316" stopOpacity="0.8" />
                <stop offset="100%" stopColor="#F97316" stopOpacity="0.6" />
              </linearGradient>
              <linearGradient id="gradient-treatment" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#10B981" stopOpacity="0.8" />
                <stop offset="100%" stopColor="#10B981" stopOpacity="0.6" />
              </linearGradient>
              <linearGradient id="gradient-care" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#0EA5E9" stopOpacity="0.8" />
                <stop offset="100%" stopColor="#0EA5E9" stopOpacity="0.6" />
              </linearGradient>
              <linearGradient id="gradient-diagnosis" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#8B5CF6" stopOpacity="0.8" />
                <stop offset="100%" stopColor="#8B5CF6" stopOpacity="0.6" />
              </linearGradient>
              <linearGradient id="gradient-recovery" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#06B6D4" stopOpacity="0.8" />
                <stop offset="100%" stopColor="#06B6D4" stopOpacity="0.6" />
              </linearGradient>
            </defs>

            {sortedNodes.map(node => {
              // Defensive: connections may be undefined or not an array
              const connections: string[] = Array.isArray((node as any).connections)
                ? (node as any).connections
                : [];

              return connections.map(targetId => {
                const targetNode = sortedNodes.find(n => n.id === targetId);
                if (!targetNode) return null;

                const connectionPath = getConnectionPath(node, targetNode);
                const connectionColor = getConnectionColor(node, targetNode);
                let markerEnd = "url(#arrowhead-default)";
                let gradientUrl = "";

                // Set appropriate marker and gradient based on connection type
                if (connectionColor === "#F97316") {
                  markerEnd = "url(#arrowhead-symptom)";
                  gradientUrl = "url(#gradient-symptom)";
                } else if (connectionColor === "#10B981") {
                  markerEnd = "url(#arrowhead-treatment)";
                  gradientUrl = "url(#gradient-treatment)";
                } else if (connectionColor === "#0EA5E9") {
                  markerEnd = "url(#arrowhead-care)";
                  gradientUrl = "url(#gradient-care)";
                } else if (connectionColor === "#8B5CF6") {
                  markerEnd = "url(#arrowhead-diagnosis)";
                  gradientUrl = "url(#gradient-diagnosis)";
                } else if (connectionColor === "#06B6D4") {
                  markerEnd = "url(#arrowhead-recovery)";
                  gradientUrl = "url(#gradient-recovery)";
                }

                return (
                  <path
                    key={`${node.id}-${targetId}`}
                    d={connectionPath}
                    stroke={connectionColor}
                    strokeWidth="2"
                    strokeDasharray={gradientUrl ? "none" : "5,5"}
                    fill="none"
                    markerEnd={markerEnd}
                    style={{
                      stroke: gradientUrl || connectionColor,
                      filter: "drop-shadow(0px 1px 1px rgba(0,0,0,0.1))"
                    }}
                  />
                );
              });
            })}

            {sortedNodes.map(node => {
              const pos = getNodePosition(node);
              const titleOrName = ((node as any).title ?? (node as any).name ?? '').toString().toLowerCase();
              const nodeType = titleOrName.includes('symptom') ? 'symptoms' :
                (titleOrName.includes('treatment') || titleOrName.includes('medication')) ? 'treatment' :
                  titleOrName.includes('care') ? 'care' :
                    titleOrName.includes('recovery') ? 'terminal' :
                      node.id === "terminal" ? 'terminal' :
                        node.id.startsWith('init') ? 'initial' : 'diagnosis';

              const nodeColor = getNodeColor(nodeType);
              const nodeWidth = 180;
              const nodeHeight = 70;
              // Support alternative shapes: `parameters` or `children` may hold
              // additional details. Normalize to a parameters array for rendering.
              const parameters: any[] = Array.isArray((node as any).parameters)
                ? (node as any).parameters
                : Array.isArray((node as any).children)
                  ? (node as any).children
                  : [];

              const hasParameters = parameters.length > 0;

              return (
                <g
                  key={node.id}
                  transform={`translate(${pos.x - nodeWidth / 2}, ${pos.y - nodeHeight / 2})`}
                  onClick={() => setActiveNode(activeNode?.id === node.id ? null : node)}
                  className="cursor-pointer"
                >
                  <rect
                    x="0"
                    y="0"
                    width={nodeWidth}
                    height={nodeHeight}
                    rx="35"
                    ry="35"
                    fill={nodeColor}
                    stroke={activeNode?.id === node.id ? "#0EA5E9" : "#CBD5E1"}
                    strokeWidth={activeNode?.id === node.id ? "3" : "1.5"}
                    filter="drop-shadow(0px 4px 6px rgba(0,0,0,0.1))"
                  />

                  <text
                    x={nodeWidth / 2}
                    y={hasParameters ? 25 : 40}
                    textAnchor="middle"
                    className="fill-gray-900 dark:fill-gray-900 text-sm font-medium"
                    style={{ pointerEvents: 'none' }}
                  >
                    {(node as any).title ?? (node as any).name}
                  </text>

                  {hasParameters && (
                    <text
                      x={nodeWidth / 2}
                      y={48}
                      textAnchor="middle"
                      className="fill-gray-600 dark:fill-gray-600 text-xs"
                      style={{ pointerEvents: 'none' }}
                    >
                      {`Type: ${parameters[0]?.value ?? parameters[0]?.name ?? 'Unknown'}`}
                    </text>
                  )}
                </g>
              );
            })}

            {(() => {
              const sortedNodesLength = sortedNodes.length;
              if (sortedNodesLength === 0) return null;

              let centerX = 0, centerY = 0;
              sortedNodes.forEach(node => {
                const pos = getNodePosition(node);
                centerX += pos.x;
                centerY += pos.y;
              });
              centerX /= sortedNodesLength;
              centerY /= sortedNodesLength;

              const conditionName = ((sortedNodes[0] as any).title ?? (sortedNodes[0] as any).name ?? '').toString().split(' ')[0] || 'Condition';

              return (
                <g
                  transform={`translate(${centerX - 50}, ${centerY - 50})`}
                  className="cursor-pointer"
                >
                  <rect
                    x="0"
                    y="0"
                    width="100"
                    height="100"
                    rx="10"
                    ry="10"
                    fill="#D1D5DB"
                    stroke="#9CA3AF"
                    strokeWidth="1"
                    filter="drop-shadow(0px 3px 5px rgba(0,0,0,0.15))"
                  />
                  <text
                    x="50"
                    y="55"
                    textAnchor="middle"
                    className="fill-gray-900 dark:fill-gray-900 text-sm font-medium"
                    style={{ pointerEvents: 'none' }}
                  >
                    {conditionName}
                  </text>
                </g>
              );
            })()}
          </svg>
        </div>

        {isMobile && (
          <div className="mt-2 p-2 bg-gray-100 dark:bg-gray-800 rounded-md text-xs text-gray-600 dark:text-gray-300">
            <p className="text-center">
              <span className="font-medium">Tip:</span> Use two fingers to pinch zoom at any point. You can pan with one finger after zooming. Double tap to zoom in.
            </p>
          </div>
        )}

        {activeNode && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="mt-4 glass-card p-4"
          >
            <div className="flex justify-between items-start mb-2">
              <div>
                <h3 className="text-lg font-medium text-gray-900 dark:text-white">{(activeNode as any).title ?? (activeNode as any).name}</h3>
                <div className="text-sm text-gray-500 dark:text-gray-400">
                  {new Date((activeNode as any).date ?? (activeNode as any).timestamp ?? Date.now()).toLocaleDateString('en-IN', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  })}
                </div>
              </div>
            </div>

            <p className="text-gray-700 dark:text-gray-300 mb-4">{(activeNode as any).description ?? ''}</p>

            {(() => {
              const activeParameters: any[] = Array.isArray((activeNode as any).parameters)
                ? (activeNode as any).parameters
                : Array.isArray((activeNode as any).children)
                  ? (activeNode as any).children
                  : [];

              if (activeParameters.length === 0) return null;

              return (
                <div>
                  <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-2">Details:</h4>
                  <div className="space-y-2">
                    {activeParameters.map(param => (
                      <div key={param.id ?? `${param.name}-${param.value}`} className="flex justify-between items-center text-sm p-2 bg-gray-50 dark:bg-gray-800 rounded">
                        <span className="text-gray-700 dark:text-gray-300">{param.name ?? param.id ?? 'Unknown'}</span>
                        <div className="flex items-center">
                          <span className="font-medium text-gray-900 dark:text-white">{param.value ?? param}</span>
                          {param.unit && (
                            <span className="ml-1 text-gray-500 dark:text-gray-400 text-xs">{param.unit}</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}
          </motion.div>
        )}
      </div>
    </div>
  );
}
