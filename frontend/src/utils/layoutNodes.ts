
import dagre from 'dagre';
import { Node, Edge, Position } from 'reactflow';

const graph = new dagre.graphlib.Graph();
graph.setDefaultEdgeLabel(() => ({}));

export function layoutNodes(nodes: Node[], edges: Edge[]) {
    graph.setGraph({ rankdir: 'TB', nodesep: 50, ranksep: 80 });

    nodes.forEach(n =>
        graph.setNode(n.id, { width: 180, height: 60 })
    );
    edges.forEach(e =>
        graph.setEdge(e.source, e.target)
    );

    dagre.layout(graph);

    return {
        nodes: nodes.map(n => {
            const p = graph.node(n.id);
            return {
                ...n,
                // ReactFlow needs top-left position, Dagre gives center
                position: { x: p.x - 90, y: p.y - 30 },
                targetPosition: Position.Top,
                sourcePosition: Position.Bottom
            };
        }),
        edges
    };
}
