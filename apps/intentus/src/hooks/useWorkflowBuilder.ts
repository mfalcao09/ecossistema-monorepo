/**
 * useWorkflowBuilder — State management para o Workflow Visual Builder.
 * Gerencia nodes (trigger + actions), edges (conexões), e sincroniza com CreateAutomationParams.
 */

import { useState, useCallback, useMemo } from "react";
import {
  type TriggerEvent,
  type ActionType,
  type AutomationType,
  type AutomationStep,
  type ConditionGroup,
  type CreateAutomationParams,
  TRIGGER_LABELS,
  ACTION_LABELS,
} from "@/hooks/useCommercialAutomationEngine";

// ─── Types ───────────────────────────────────────────────────────────────────

export type NodeType = "trigger" | "condition" | "action" | "delay";

export interface WorkflowNode {
  id: string;
  type: NodeType;
  label: string;
  /** For trigger nodes */
  triggerEvent?: TriggerEvent;
  /** For action nodes */
  actionType?: ActionType;
  actionConfig?: Record<string, unknown>;
  /** For delay nodes */
  delayMinutes?: number;
  /** For condition nodes */
  conditions?: ConditionGroup;
  /** Position in the sequence (0 = trigger) */
  order: number;
}

export interface WorkflowEdge {
  id: string;
  from: string;
  to: string;
}

export interface WorkflowState {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  name: string;
  description: string;
}

// ─── Constants ───────────────────────────────────────────────────────────────

export const NODE_TYPE_LABELS: Record<NodeType, string> = {
  trigger: "Gatilho",
  condition: "Condição",
  action: "Ação",
  delay: "Atraso",
};

export const NODE_TYPE_COLORS: Record<NodeType, string> = {
  trigger: "bg-blue-100 border-blue-400 dark:bg-blue-900/30 dark:border-blue-600",
  condition: "bg-amber-100 border-amber-400 dark:bg-amber-900/30 dark:border-amber-600",
  action: "bg-green-100 border-green-400 dark:bg-green-900/30 dark:border-green-600",
  delay: "bg-purple-100 border-purple-400 dark:bg-purple-900/30 dark:border-purple-600",
};

export const NODE_TYPE_ICON_COLORS: Record<NodeType, string> = {
  trigger: "text-blue-600 dark:text-blue-400",
  condition: "text-amber-600 dark:text-amber-400",
  action: "text-green-600 dark:text-green-400",
  delay: "text-purple-600 dark:text-purple-400",
};

let _nodeCounter = 0;
function generateNodeId(type: NodeType): string {
  _nodeCounter++;
  return `${type}_${Date.now()}_${_nodeCounter}`;
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useWorkflowBuilder() {
  const [state, setState] = useState<WorkflowState>({
    nodes: [],
    edges: [],
    name: "",
    description: "",
  });

  // ── Setters ──

  const setName = useCallback((name: string) => {
    setState((prev) => ({ ...prev, name }));
  }, []);

  const setDescription = useCallback((description: string) => {
    setState((prev) => ({ ...prev, description }));
  }, []);

  // ── Node operations ──

  const addTriggerNode = useCallback((triggerEvent: TriggerEvent) => {
    const id = generateNodeId("trigger");
    const node: WorkflowNode = {
      id,
      type: "trigger",
      label: TRIGGER_LABELS[triggerEvent] || triggerEvent,
      triggerEvent,
      order: 0,
    };
    setState((prev) => {
      // Remove existing trigger (only one allowed)
      const filtered = prev.nodes.filter((n) => n.type !== "trigger");
      const edges = prev.edges.filter(
        (e) => !prev.nodes.find((n) => n.type === "trigger" && (n.id === e.from || n.id === e.to)),
      );
      return { ...prev, nodes: [node, ...filtered], edges };
    });
    return id;
  }, []);

  const addActionNode = useCallback((actionType: ActionType, actionConfig: Record<string, unknown> = {}) => {
    const id = generateNodeId("action");
    setState((prev) => {
      const order = prev.nodes.length;
      const node: WorkflowNode = {
        id,
        type: "action",
        label: ACTION_LABELS[actionType] || actionType,
        actionType,
        actionConfig,
        order,
      };
      const nodes = [...prev.nodes, node];

      // Auto-connect: link to last node
      const prevNode = prev.nodes[prev.nodes.length - 1];
      const edges = prevNode
        ? [...prev.edges, { id: `edge_${prevNode.id}_${id}`, from: prevNode.id, to: id }]
        : prev.edges;

      return { ...prev, nodes, edges };
    });
    return id;
  }, []);

  const addDelayNode = useCallback((delayMinutes: number) => {
    const id = generateNodeId("delay");
    setState((prev) => {
      const order = prev.nodes.length;
      const label = delayMinutes >= 1440
        ? `Aguardar ${Math.round(delayMinutes / 1440)}d`
        : delayMinutes >= 60
          ? `Aguardar ${Math.round(delayMinutes / 60)}h`
          : `Aguardar ${delayMinutes}min`;
      const node: WorkflowNode = {
        id,
        type: "delay",
        label,
        delayMinutes,
        order,
      };
      const nodes = [...prev.nodes, node];
      const prevNode = prev.nodes[prev.nodes.length - 1];
      const edges = prevNode
        ? [...prev.edges, { id: `edge_${prevNode.id}_${id}`, from: prevNode.id, to: id }]
        : prev.edges;

      return { ...prev, nodes, edges };
    });
    return id;
  }, []);

  const removeNode = useCallback((nodeId: string) => {
    setState((prev) => {
      const filteredNodes = prev.nodes.filter((n) => n.id !== nodeId);
      const filteredEdges = prev.edges.filter((e) => e.from !== nodeId && e.to !== nodeId);
      // Re-link: if removed node was between two others, connect them
      const inEdge = prev.edges.find((e) => e.to === nodeId);
      const outEdge = prev.edges.find((e) => e.from === nodeId);
      if (inEdge && outEdge) {
        filteredEdges.push({ id: `edge_${inEdge.from}_${outEdge.to}`, from: inEdge.from, to: outEdge.to });
      }
      // Recompute order (immutable — create new objects)
      const nodes = filteredNodes.map((n, i) => ({ ...n, order: i }));
      return { ...prev, nodes, edges: filteredEdges };
    });
  }, []);

  const updateNode = useCallback((nodeId: string, updates: Partial<WorkflowNode>) => {
    setState((prev) => ({
      ...prev,
      nodes: prev.nodes.map((n) => (n.id === nodeId ? { ...n, ...updates } : n)),
    }));
  }, []);

  const moveNode = useCallback((fromIndex: number, toIndex: number) => {
    setState((prev) => {
      const arr = [...prev.nodes];
      const [moved] = arr.splice(fromIndex, 1);
      arr.splice(toIndex, 0, moved);
      // Recompute order (immutable) + edges
      const nodes = arr.map((n, i) => ({ ...n, order: i }));
      const edges: WorkflowEdge[] = [];
      for (let i = 0; i < nodes.length - 1; i++) {
        edges.push({ id: `edge_${nodes[i].id}_${nodes[i + 1].id}`, from: nodes[i].id, to: nodes[i + 1].id });
      }
      return { ...prev, nodes, edges };
    });
  }, []);

  const clearAll = useCallback(() => {
    setState({ nodes: [], edges: [], name: "", description: "" });
  }, []);

  // ── Derived state ──

  const triggerNode = useMemo(() => state.nodes.find((n) => n.type === "trigger"), [state.nodes]);
  const actionNodes = useMemo(() => state.nodes.filter((n) => n.type !== "trigger"), [state.nodes]);
  const isValid = useMemo(() => {
    return (
      state.name.trim().length > 0 &&
      !!triggerNode?.triggerEvent &&
      actionNodes.some((n) => n.type === "action")
    );
  }, [state.name, triggerNode, actionNodes]);

  // ── Convert to CreateAutomationParams ──

  const toCreateParams = useCallback((): CreateAutomationParams | null => {
    if (!isValid || !triggerNode) return null;

    const firstAction = actionNodes.find((n) => n.type === "action");
    if (!firstAction) return null;

    const isSequence = actionNodes.length > 1;

    if (!isSequence) {
      // Simple automation
      const delayNode = actionNodes.find((n) => n.type === "delay");
      return {
        name: state.name,
        description: state.description || undefined,
        trigger_event: triggerNode.triggerEvent!,
        action_type: firstAction.actionType!,
        automation_type: "simples" as AutomationType,
        delay_days: delayNode ? Math.round((delayNode.delayMinutes || 0) / 1440) : 0,
        action_config: firstAction.actionConfig,
        conditions: triggerNode.conditions || undefined,
      };
    }

    // Sequence automation
    let cumulativeDelay = 0;
    const steps: AutomationStep[] = [];
    let stepOrder = 1;

    for (const node of actionNodes) {
      if (node.type === "delay") {
        cumulativeDelay += node.delayMinutes || 0;
        continue;
      }
      if (node.type === "action") {
        steps.push({
          step_order: stepOrder++,
          delay_minutes: cumulativeDelay,
          action_type: node.actionType!,
          action_config: node.actionConfig || {},
          conditions: node.conditions || null,
          is_active: true,
        });
        cumulativeDelay = 0; // Reset after action consumes the delay
      }
    }

    return {
      name: state.name,
      description: state.description || undefined,
      trigger_event: triggerNode.triggerEvent!,
      action_type: steps[0]?.action_type || firstAction.actionType!,
      automation_type: "sequencia" as AutomationType,
      delay_days: 0,
      conditions: triggerNode.conditions || undefined,
      steps,
    };
  }, [state, isValid, triggerNode, actionNodes]);

  return {
    state,
    setName,
    setDescription,
    addTriggerNode,
    addActionNode,
    addDelayNode,
    removeNode,
    updateNode,
    moveNode,
    clearAll,
    triggerNode,
    actionNodes,
    isValid,
    toCreateParams,
  };
}
