export const MOCK_INTER_SALDO_RESPONSE = {
  saldo: 45230.50,
  conta: '***123',
  timestamp: new Date().toISOString(),
};

export const MOCK_AGENT_TOOL_BLOCKED_RESPONSE = {
  status: 'blocked',
  events: [
    {
      type: 'tool_blocked',
      reason: 'Art. II — valor acima de R$10.000 requer aprovação humana',
      tool_name: 'emitir_boleto',
      timestamp: new Date().toISOString(),
    },
    {
      type: 'approval_request_created',
      data: { approval_id: 'mock-approval-123' },
      timestamp: new Date().toISOString(),
    },
  ],
  tools_used: [],
  result: null,
};

export const MOCK_MEMORY_RECALL_RESPONSE = [
  {
    id: 'mem-001',
    content: 'Marcelo prefere Sonnet 4.6 para análises financeiras',
    score: 0.92,
    type: 'semantic',
    filters: { user_id: 'marcelo', agent_id: 'cfo-fic', business_id: 'fic' },
  },
];
