import { useCallback, useEffect, useMemo } from "react";
import {
  Background,
  Controls,
  Handle,
  MarkerType,
  MiniMap,
  Position,
  ReactFlow,
  useEdgesState,
  useNodesState,
  type Connection,
  type Edge,
  type Node,
  type NodeProps,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { cn } from "@/lib/utils";
import {
  FLOW_ENDING,
  FLOW_WELCOME,
  defaultEdges,
  describeRule,
} from "~/shared/flow";
import {
  normalizeFormSchema,
  pageLabel,
  type FormSchema,
  type PageRule,
} from "~/shared/schema";
import type { PlayerScreen } from "~/player/FormPlayer";

type FlowNodeData = { label: string; kind: string };

function selectedId(schema: FormSchema, selected: PlayerScreen): string {
  if (selected === "welcome") return FLOW_WELCOME;
  if (selected === "ending") return FLOW_ENDING;
  if (typeof selected === "object" && "pageId" in selected) return selected.pageId;
  if (typeof selected === "object" && "questionId" in selected) {
    const page = schema.pages?.find((p) => p.questionIds.includes(selected.questionId));
    return page?.id ?? "";
  }
  return "";
}

function FlowCard({ data, selected }: NodeProps<Node<FlowNodeData>>) {
  return (
    <div
      className={cn(
        "min-w-40 rounded-lg border bg-card px-3 py-2 shadow-sm",
        selected && "ring-2 ring-ring",
      )}
    >
      {data.kind !== "Welcome" && <Handle type="target" position={Position.Left} />}
      <p className="text-[0.7rem] uppercase tracking-wide text-muted-foreground">{data.kind}</p>
      <p className="text-sm font-medium">{data.label}</p>
      {data.kind !== "Ending" && <Handle type="source" position={Position.Right} />}
    </div>
  );
}

const nodeTypes = { flow: FlowCard };

function pos(schema: FormSchema, id: string, fallback: { x: number; y: number }) {
  return schema.flowPositions?.[id] ?? fallback;
}

function targetId(target: { kind: "page"; pageId: string } | { kind: "ending" }): string {
  return target.kind === "ending" ? FLOW_ENDING : target.pageId;
}

function buildNodes(schema: FormSchema, selected: PlayerScreen): Node<FlowNodeData>[] {
  const n = normalizeFormSchema(schema);
  const current = selectedId(schema, selected);
  const nodes: Node<FlowNodeData>[] = [
    {
      id: FLOW_WELCOME,
      type: "flow",
      position: pos(schema, FLOW_WELCOME, { x: 0, y: 80 }),
      data: { kind: "Welcome", label: n.welcome.title },
      selected: current === FLOW_WELCOME,
    },
  ];
  n.pages.forEach((page, i) => {
    nodes.push({
      id: page.id,
      type: "flow",
      position: pos(schema, page.id, { x: 240 * (i + 1), y: 80 }),
      data: { kind: "Page", label: pageLabel(page, i) },
      selected: current === page.id,
    });
  });
  nodes.push({
    id: FLOW_ENDING,
    type: "flow",
    position: pos(schema, FLOW_ENDING, { x: 240 * (n.pages.length + 1), y: 80 }),
    data: { kind: "Ending", label: n.ending.title },
    selected: current === FLOW_ENDING,
  });
  return nodes;
}

function buildEdges(schema: FormSchema): Edge[] {
  const n = normalizeFormSchema(schema);
  const edges: Edge[] = defaultEdges(n).map((e) => ({
    id: `default:${e.from}->${targetId(e.to)}`,
    source: e.from,
    target: targetId(e.to),
    deletable: false,
    selectable: false,
    style: { strokeDasharray: "6 4" },
    markerEnd: { type: MarkerType.ArrowClosed, width: 16, height: 16 },
  }));
  for (const page of n.pages) {
    for (const rule of page.routing?.rules ?? []) {
      edges.push({
        id: `rule:${page.id}:${rule.id}`,
        source: page.id,
        target: targetId(rule.target),
        label: describeRule(n, rule),
        deletable: true,
        markerEnd: { type: MarkerType.ArrowClosed, width: 16, height: 16 },
      });
    }
  }
  return edges;
}

export function FlowMap(props: {
  schema: FormSchema;
  selected: PlayerScreen;
  onSelect: (screen: PlayerScreen) => void;
  onChange: (fn: (s: FormSchema) => FormSchema) => void;
}) {
  const structure = useMemo(
    () =>
      JSON.stringify({
        pages: (props.schema.pages ?? []).map((p) => [p.id, p.routing, p.title]),
        welcome: props.schema.welcome.title,
        ending: props.schema.ending.title,
      }),
    [props.schema],
  );
  const [nodes, setNodes, onNodesChange] = useNodesState(buildNodes(props.schema, props.selected));
  const [edges, setEdges, onEdgesChange] = useEdgesState(buildEdges(props.schema));

  useEffect(() => {
    setNodes(buildNodes(props.schema, props.selected));
    setEdges(buildEdges(props.schema));
  }, [structure, props.selected, props.schema, setNodes, setEdges]);

  const onConnect = useCallback(
    (c: Connection) => {
      if (!c.source || !c.target) return;
      if (c.source === FLOW_WELCOME || c.source === FLOW_ENDING) return;
      if (c.target === FLOW_WELCOME || c.source === c.target) return;
      const rule: PageRule = {
        id: crypto.randomUUID(),
        conditions: [],
        target: c.target === FLOW_ENDING ? { kind: "ending" } : { kind: "page", pageId: c.target },
      };
      props.onChange((s) => {
        const n = normalizeFormSchema(s);
        return {
          ...n,
          pages: n.pages.map((p) =>
            p.id === c.source ? { ...p, routing: { rules: [...(p.routing?.rules ?? []), rule] } } : p,
          ),
        };
      });
      props.onSelect({ pageId: c.source });
    },
    [props],
  );

  return (
    <div className="h-full min-h-[50vh] w-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        nodeTypes={nodeTypes}
        fitView
        colorMode="system"
        deleteKeyCode={["Backspace", "Delete"]}
        isValidConnection={(c) =>
          !!c.source &&
          !!c.target &&
          c.source !== FLOW_WELCOME &&
          c.source !== FLOW_ENDING &&
          c.target !== FLOW_WELCOME &&
          c.source !== c.target
        }
        onNodeClick={(_, node) => {
          if (node.id === FLOW_WELCOME) props.onSelect("welcome");
          else if (node.id === FLOW_ENDING) props.onSelect("ending");
          else props.onSelect({ pageId: node.id });
        }}
        onNodeDragStop={(_, node) => {
          props.onChange((s) => ({
            ...s,
            flowPositions: { ...s.flowPositions, [node.id]: node.position },
          }));
        }}
        onEdgesDelete={(removed) => {
          for (const e of removed) {
            if (!e.id.startsWith("rule:")) continue;
            const parts = e.id.split(":");
            const pageId = parts[1];
            const ruleId = parts[2];
            if (!pageId || !ruleId) continue;
            props.onChange((s) => {
              const n = normalizeFormSchema(s);
              return {
                ...n,
                pages: n.pages.map((p) => {
                  if (p.id !== pageId) return p;
                  const rules = (p.routing?.rules ?? []).filter((r) => r.id !== ruleId);
                  return { ...p, routing: rules.length ? { rules } : undefined };
                }),
              };
            });
          }
        }}
        onEdgeClick={(_, edge) => {
          if (!edge.id.startsWith("rule:")) return;
          const pageId = edge.id.split(":")[1];
          if (pageId) props.onSelect({ pageId });
        }}
      >
        <Background />
        <Controls />
        <MiniMap />
      </ReactFlow>
    </div>
  );
}
