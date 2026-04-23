"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  addEdge,
  ReactFlowProvider,
  useReactFlow,
  type Node,
  type Edge,
  type Connection,
  type NodeChange,
  type EdgeChange,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import BubbleNode from "./nodes/BubbleNode";
import InputNode from "./nodes/InputNode";
import ActionNode from "./nodes/ActionNode";
import ConditionalNode from "./nodes/ConditionalNode";
import AgentNode from "./nodes/AgentNode";
import type {
  DsBotFlow,
  DsBotNode,
  DsBotEdge,
  DsBotNodeType,
} from "@/lib/atendimento/ds-bot-types";

interface Props {
  initial: DsBotFlow;
  onChange: (flow: DsBotFlow) => void;
  onSelectionChange?: (node: DsBotNode | null) => void;
}

// React Flow node types registry
const nodeTypes = {
  trigger: ActionNode,
  bubble_text: BubbleNode,
  bubble_image: BubbleNode,
  bubble_video: BubbleNode,
  bubble_audio: BubbleNode,
  bubble_embed: BubbleNode,
  input_text: InputNode,
  input_number: InputNode,
  input_email: InputNode,
  input_website: InputNode,
  input_date: InputNode,
  input_phone: InputNode,
  input_button: InputNode,
  input_file: InputNode,
  flow_goto: ActionNode,
  flow_back: ActionNode,
  flow_end: ActionNode,
  flow_wait: ActionNode,
  contact_add_tag: ActionNode,
  contact_remove_tag: ActionNode,
  contact_update_field: ActionNode,
  message_waba_template: ActionNode,
  message_ds_voice: ActionNode,
  message_forward: ActionNode,
  attendance_transfer_queue: ActionNode,
  attendance_assign_agent: ActionNode,
  attendance_open_protocol: ActionNode,
  attendance_close: ActionNode,
  conditional: ConditionalNode,
  agent_handoff: AgentNode,
};

function makeId(prefix = "n"): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

function defaultDataForType(type: DsBotNodeType): Record<string, unknown> {
  switch (type) {
    case "trigger":
      return { label: "Início" };
    case "bubble_text":
      return { text: "Escreva aqui..." };
    case "bubble_image":
      return { url: "" };
    case "bubble_video":
      return { url: "" };
    case "bubble_audio":
      return { url: "" };
    case "bubble_embed":
      return { url: "" };
    case "input_text":
      return { question: "Qual sua resposta?", variable: "resposta" };
    case "input_number":
      return { question: "Informe um número", variable: "numero" };
    case "input_email":
      return { question: "Qual seu e-mail?", variable: "email" };
    case "input_website":
      return { question: "Qual URL?", variable: "url" };
    case "input_date":
      return { question: "Escolha uma data", variable: "data" };
    case "input_phone":
      return { question: "Qual seu telefone?", variable: "telefone" };
    case "input_button":
      return {
        question: "Escolha uma opção",
        variable: "opcao",
        options: [
          { id: "opt-0", label: "Sim", value: "yes" },
          { id: "opt-1", label: "Não", value: "no" },
        ],
      };
    case "input_file":
      return {
        question: "Envie o arquivo",
        variable: "arquivo",
        accept: "image/*,application/pdf",
        max_mb: 10,
      };
    case "flow_goto":
      return { target_node_id: "" };
    case "flow_back":
      return {};
    case "flow_end":
      return { reason: "" };
    case "flow_wait":
      return { timeout_seconds: 60 };
    case "contact_add_tag":
      return { tag: "" };
    case "contact_remove_tag":
      return { tag: "" };
    case "contact_update_field":
      return { field: "", value: "" };
    case "message_waba_template":
      return { template_id: "" };
    case "message_ds_voice":
      return { library_item_id: "" };
    case "message_forward":
      return { message_id: "" };
    case "attendance_transfer_queue":
      return { queue_id: "" };
    case "attendance_assign_agent":
      return { agent_id: "" };
    case "attendance_open_protocol":
      return { subject: "", priority: "normal" };
    case "attendance_close":
      return {};
    case "conditional":
      return {
        logic: "AND",
        clauses: [{ left: "var.x", op: "eq", right: "" }],
      };
    case "agent_handoff":
      return { agent_id: "", context_vars: [] };
    default:
      return {};
  }
}

function toRFNodes(nodes: DsBotNode[]): Node[] {
  return nodes.map((n) => ({
    id: n.id,
    type: n.type,
    position: n.position,
    data: n.data as Record<string, unknown>,
  }));
}
function toRFEdges(edges: DsBotEdge[]): Edge[] {
  return edges.map((e) => ({
    id: e.id,
    source: e.source,
    target: e.target,
    sourceHandle: e.sourceHandle ?? undefined,
    targetHandle: e.targetHandle ?? undefined,
    label: e.label,
  }));
}

function Inner({ initial, onChange, onSelectionChange }: Props) {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>(
    toRFNodes(initial.nodes),
  );
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>(
    toRFEdges(initial.edges),
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const reactFlow = useReactFlow();
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Sincroniza qualquer mudança (nodes/edges/positions) → props.onChange
  const emit = useCallback(
    (ns: Node[], es: Edge[]) => {
      const dsNodes: DsBotNode[] = ns.map((n) => {
        // mantém category já presente na data, senão infere pelo type
        const existing = initial.nodes.find((x) => x.id === n.id);
        const category =
          existing?.category ?? inferCategory(n.type as DsBotNodeType);
        return {
          id: n.id,
          type: (n.type ?? "bubble_text") as DsBotNodeType,
          category,
          position: n.position,
          data: n.data,
        } as DsBotNode;
      });
      const dsEdges: DsBotEdge[] = es.map((e) => ({
        id: e.id,
        source: e.source,
        target: e.target,
        sourceHandle: e.sourceHandle ?? null,
        targetHandle: e.targetHandle ?? null,
        label: typeof e.label === "string" ? e.label : undefined,
      }));
      onChange({
        nodes: dsNodes,
        edges: dsEdges,
        viewport: reactFlow.getViewport(),
      });
    },
    [initial.nodes, onChange, reactFlow],
  );

  const handleNodesChange = useCallback(
    (changes: NodeChange[]) => {
      onNodesChange(changes);
      setNodes((cur) => {
        emit(cur, edges);
        return cur;
      });
    },
    [edges, emit, onNodesChange, setNodes],
  );

  const handleEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      onEdgesChange(changes);
      setEdges((cur) => {
        emit(nodes, cur);
        return cur;
      });
    },
    [nodes, emit, onEdgesChange, setEdges],
  );

  const onConnect = useCallback(
    (params: Connection) => {
      setEdges((eds) => {
        const next = addEdge({ ...params, id: `e-${makeId()}` }, eds);
        emit(nodes, next);
        return next;
      });
    },
    [emit, nodes, setEdges],
  );

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      const type = event.dataTransfer.getData(
        "application/dsbot-node-type",
      ) as DsBotNodeType;
      if (!type) return;
      const bounds = wrapperRef.current?.getBoundingClientRect();
      if (!bounds) return;
      const position = reactFlow.screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });
      const id = makeId(type.split("_")[0]);
      const newNode: Node = {
        id,
        type,
        position,
        data: defaultDataForType(type),
      };
      setNodes((ns) => {
        const next = [...ns, newNode];
        emit(next, edges);
        return next;
      });
    },
    [edges, emit, reactFlow, setNodes],
  );

  const selectedNode = useMemo<DsBotNode | null>(() => {
    if (!selectedId) return null;
    const n = nodes.find((x) => x.id === selectedId);
    if (!n) return null;
    return {
      id: n.id,
      type: (n.type ?? "bubble_text") as DsBotNodeType,
      category: inferCategory(n.type as DsBotNodeType),
      position: n.position,
      data: n.data,
    } as DsBotNode;
  }, [nodes, selectedId]);

  // Notify parent of selection
  useMemo(() => {
    onSelectionChange?.(selectedNode);
  }, [selectedNode, onSelectionChange]);

  return (
    <div ref={wrapperRef} className="flex-1 h-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={handleNodesChange}
        onEdgesChange={handleEdgesChange}
        onConnect={onConnect}
        onDrop={onDrop}
        onDragOver={onDragOver}
        onNodeClick={(_, n) => setSelectedId(n.id)}
        onPaneClick={() => setSelectedId(null)}
        nodeTypes={nodeTypes}
        fitView
        defaultViewport={initial.viewport ?? { x: 0, y: 0, zoom: 1 }}
      >
        <Background gap={16} />
        <Controls />
        <MiniMap pannable zoomable />
      </ReactFlow>
    </div>
  );
}

function inferCategory(type: DsBotNodeType): DsBotNode["category"] {
  if (type === "trigger") return "trigger";
  if (type.startsWith("bubble_")) return "bubble";
  if (type.startsWith("input_")) return "input";
  if (type.startsWith("flow_")) return "flow";
  if (type.startsWith("contact_")) return "contact";
  if (type.startsWith("message_")) return "message";
  if (type.startsWith("attendance_")) return "attendance";
  if (type === "conditional") return "logic";
  if (type === "agent_handoff") return "agent";
  return "bubble";
}

export default function FlowCanvas(props: Props) {
  return (
    <ReactFlowProvider>
      <Inner {...props} />
    </ReactFlowProvider>
  );
}

export { defaultDataForType, inferCategory };
