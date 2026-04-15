import { describe, it, expect } from "vitest";
import {
  AUDIT_CATEGORY_CONFIG,
  EVENT_TYPE_TO_CATEGORY,
  EVENT_TYPE_LABELS,
  groupEventsByDate,
  calculateAuditHash,
  type AuditEvent,
  type AuditEventType,
  type AuditEventCategory,
} from "@/hooks/useAuditTimeline";

// ============================================================
// Testes: useAuditTimeline — Fase 4, Épico 4
// ============================================================

describe("Audit Timeline — Configurações", () => {
  it("deve ter configuração para todas as 8 categorias", () => {
    const categories: AuditEventCategory[] = [
      "lifecycle", "content", "approval", "signature",
      "document", "financial", "ai", "system",
    ];

    categories.forEach((cat) => {
      expect(AUDIT_CATEGORY_CONFIG[cat]).toBeDefined();
      expect(AUDIT_CATEGORY_CONFIG[cat].label).toBeTruthy();
      expect(AUDIT_CATEGORY_CONFIG[cat].color).toBeTruthy();
      expect(AUDIT_CATEGORY_CONFIG[cat].bgColor).toBeTruthy();
      expect(AUDIT_CATEGORY_CONFIG[cat].icon).toBeTruthy();
    });
  });

  it("deve mapear todos os 27 tipos de evento para categorias válidas", () => {
    const allEventTypes = Object.keys(EVENT_TYPE_TO_CATEGORY) as AuditEventType[];
    expect(allEventTypes.length).toBe(27);

    const validCategories: AuditEventCategory[] = [
      "lifecycle", "content", "approval", "signature",
      "document", "financial", "ai", "system",
    ];

    allEventTypes.forEach((eventType) => {
      const category = EVENT_TYPE_TO_CATEGORY[eventType];
      expect(validCategories).toContain(category);
    });
  });

  it("deve ter labels em português para todos os tipos de evento", () => {
    const allEventTypes = Object.keys(EVENT_TYPE_TO_CATEGORY) as AuditEventType[];

    allEventTypes.forEach((eventType) => {
      const label = EVENT_TYPE_LABELS[eventType];
      expect(label).toBeDefined();
      expect(label.length).toBeGreaterThan(3);
    });
  });

  it("labels devem estar em português (não conter palavras comuns em inglês)", () => {
    const englishWords = ["created", "updated", "deleted", "added", "removed"];
    const labels = Object.values(EVENT_TYPE_LABELS);

    labels.forEach((label) => {
      englishWords.forEach((word) => {
        expect(label.toLowerCase()).not.toContain(word);
      });
    });
  });
});

describe("Audit Timeline — groupEventsByDate", () => {
  const mockEvents: AuditEvent[] = [
    {
      id: "1",
      contract_id: "c1",
      event_type: "contract_created",
      event_category: "lifecycle",
      description: "Contrato criado",
      user_id: "u1",
      created_at: "2026-03-07T10:00:00Z",
    },
    {
      id: "2",
      contract_id: "c1",
      event_type: "clause_added",
      event_category: "content",
      description: "Cláusula adicionada",
      user_id: "u1",
      created_at: "2026-03-07T14:30:00Z",
    },
    {
      id: "3",
      contract_id: "c1",
      event_type: "approval_granted",
      event_category: "approval",
      description: "Aprovação concedida",
      user_id: "u2",
      created_at: "2026-03-06T09:00:00Z",
    },
  ];

  it("deve agrupar eventos por data", () => {
    const groups = groupEventsByDate(mockEvents);
    const dateKeys = Object.keys(groups);

    // Deve ter 2 grupos (2 datas diferentes)
    expect(dateKeys.length).toBe(2);
  });

  it("deve colocar eventos do mesmo dia no mesmo grupo", () => {
    const groups = groupEventsByDate(mockEvents);
    const dateKeys = Object.keys(groups);

    // Um dos grupos deve ter 2 eventos (dia 07/03)
    const maxGroupSize = Math.max(...dateKeys.map((k) => groups[k].length));
    expect(maxGroupSize).toBe(2);
  });

  it("deve retornar objeto vazio para array vazio", () => {
    const groups = groupEventsByDate([]);
    expect(Object.keys(groups).length).toBe(0);
  });
});

describe("Audit Timeline — calculateAuditHash", () => {
  const mockEvents: AuditEvent[] = [
    {
      id: "event-1",
      contract_id: "c1",
      event_type: "contract_created",
      event_category: "lifecycle",
      description: "Contrato criado",
      user_id: "u1",
      created_at: "2026-03-07T10:00:00Z",
    },
  ];

  it("deve gerar hash SHA-256 válido (64 caracteres hex)", async () => {
    const hash = await calculateAuditHash(mockEvents);
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("deve gerar hashes diferentes para eventos diferentes", async () => {
    const hash1 = await calculateAuditHash(mockEvents);

    const differentEvents: AuditEvent[] = [
      { ...mockEvents[0], id: "event-2", description: "Outro evento" },
    ];
    const hash2 = await calculateAuditHash(differentEvents);

    expect(hash1).not.toBe(hash2);
  });

  it("deve gerar hash consistente para mesmos dados", async () => {
    const hash1 = await calculateAuditHash(mockEvents);
    const hash2 = await calculateAuditHash(mockEvents);
    expect(hash1).toBe(hash2);
  });

  it("deve gerar hash para array vazio", async () => {
    const hash = await calculateAuditHash([]);
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
  });
});

describe("Audit Timeline — Mapeamento de Categorias", () => {
  it("eventos de ciclo de vida devem mapear para 'lifecycle'", () => {
    const lifecycleEvents: AuditEventType[] = [
      "contract_created", "contract_updated", "contract_deleted",
      "status_changed", "version_created", "renewal_initiated", "renewal_completed",
    ];
    lifecycleEvents.forEach((evt) => {
      expect(EVENT_TYPE_TO_CATEGORY[evt]).toBe("lifecycle");
    });
  });

  it("eventos de conteúdo devem mapear para 'content'", () => {
    const contentEvents: AuditEventType[] = [
      "clause_added", "clause_removed", "clause_modified",
      "party_added", "party_removed", "comment_added", "field_changed",
    ];
    contentEvents.forEach((evt) => {
      expect(EVENT_TYPE_TO_CATEGORY[evt]).toBe("content");
    });
  });

  it("eventos de aprovação devem mapear para 'approval'", () => {
    const approvalEvents: AuditEventType[] = [
      "approval_requested", "approval_granted", "approval_rejected",
    ];
    approvalEvents.forEach((evt) => {
      expect(EVENT_TYPE_TO_CATEGORY[evt]).toBe("approval");
    });
  });

  it("eventos de assinatura devem mapear para 'signature'", () => {
    const signatureEvents: AuditEventType[] = [
      "signature_sent", "signature_completed", "signature_refused",
    ];
    signatureEvents.forEach((evt) => {
      expect(EVENT_TYPE_TO_CATEGORY[evt]).toBe("signature");
    });
  });

  it("ai_analysis_run deve mapear para 'ai'", () => {
    expect(EVENT_TYPE_TO_CATEGORY["ai_analysis_run"]).toBe("ai");
  });
});
