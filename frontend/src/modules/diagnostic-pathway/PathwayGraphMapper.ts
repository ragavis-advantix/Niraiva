
import { Node, Edge } from 'reactflow';

export function buildGraph(steps: any[], edges: [string, string][]) {
    const nodes: Node[] = steps.map(step => ({
        id: step.id,
        data: {
            label: step.label,
            status: step.status,
            type: step.type
        },
        position: { x: 0, y: 0 },
        style: {
            background: step.status === 'completed' ? '#D1FAE5' : '#FFFFFF',
            borderRadius: 8,
            padding: '10px 15px',
            border: step.status === 'completed' ? '2px solid #059669' : '1px dashed #94a3b8',
            color: step.status === 'completed' ? '#064e3b' : '#64748b',
            fontWeight: step.status === 'completed' ? 'bold' : 'normal',
            width: 180,
            fontSize: '12px',
            textAlign: 'center'
        }
    }));

    const rfEdges: Edge[] = edges.map(([s, t]) => ({
        id: `${s}-${t}`,
        source: s,
        target: t,
        type: 'smoothstep',
        animated: true,
        style: { stroke: '#cbd5e1' }
    }));

    return { nodes, edges: rfEdges };
}
