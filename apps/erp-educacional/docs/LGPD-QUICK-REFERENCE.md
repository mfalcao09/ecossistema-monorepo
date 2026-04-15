# LGPD Data Purge — Quick Reference

**For Developers:** Copy-paste recipes for common LGPD tasks.

---

## 1. Request User Deletion (Right to Be Forgotten)

```typescript
'use server'

import { solicitarExclusaoUsuario } from '@/lib/lgpd'

export async function handleDeleteUserRequest(userId: string) {
  const req = await solicitarExclusaoUsuario(
    userId,
    'User requested account deletion via profile settings'
  )

  console.log('Purge request created:', req.id)
  return req
}
```

**UI Component:**
```tsx
'use client'

import { handleDeleteUserRequest } from './actions'

export function DeleteAccountButton({ userId }: { userId: string }) {
  const [loading, setLoading] = useState(false)

  async function handleClick() {
    if (!confirm('This will permanently delete all your data. Continue?')) {
      return
    }

    setLoading(true)
    try {
      await handleDeleteUserRequest(userId)
      alert('Your deletion request has been submitted.')
      // Redirect to goodbye page
    } catch (error) {
      alert('Error: ' + String(error))
    } finally {
      setLoading(false)
    }
  }

  return (
    <button onClick={handleClick} disabled={loading}>
      {loading ? 'Deleting...' : 'Delete My Account'}
    </button>
  )
}
```

---

## 2. Process Purges Manually (Admin)

```typescript
'use server'

import { executarPurgaLGPD, obterStatusFilaPurga } from '@/lib/lgpd'

export async function triggerManualPurge() {
  // Run all pending + retention checks
  const resultado = await executarPurgaLGPD('auto')

  console.log(`Processed ${resultado.processados} requests`)
  console.log(`Purged ${resultado.total_registros_purgados} records`)
  console.log(`Duration: ${resultado.duracao_ms}ms`)

  return resultado
}

export async function checkPurgeQueueStatus() {
  const status = await obterStatusFilaPurga()

  return {
    pending: status.pendente,
    processing: status.processando,
    completed: status.concluido,
    failed: status.erro,
    total: status.total,
  }
}
```

**Admin Dashboard:**
```tsx
'use client'

import { useState } from 'react'
import { triggerManualPurge, checkPurgeQueueStatus } from './actions'

export function LGPDAdminPanel() {
  const [status, setStatus] = useState(null)
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)

  async function handleManualRun() {
    setLoading(true)
    try {
      const resultado = await triggerManualPurge()
      setResult(resultado)
      await handleCheckStatus()
    } finally {
      setLoading(false)
    }
  }

  async function handleCheckStatus() {
    const s = await checkPurgeQueueStatus()
    setStatus(s)
  }

  return (
    <div className="p-4 space-y-4">
      <h2>LGPD Purge Management</h2>

      <button
        onClick={handleCheckStatus}
        className="px-4 py-2 bg-blue-500 text-white rounded"
      >
        Check Queue Status
      </button>

      <button
        onClick={handleManualRun}
        disabled={loading}
        className="px-4 py-2 bg-green-500 text-white rounded disabled:opacity-50"
      >
        {loading ? 'Running...' : 'Run Purge Now'}
      </button>

      {status && (
        <div className="p-4 bg-gray-100 rounded">
          <h3>Queue Status</h3>
          <ul>
            <li>Pending: {status.pending}</li>
            <li>Processing: {status.processing}</li>
            <li>Completed: {status.completed}</li>
            <li>Failed: {status.failed}</li>
            <li>Total: {status.total}</li>
          </ul>
        </div>
      )}

      {result && (
        <div className="p-4 bg-green-100 rounded">
          <h3>Last Run Result</h3>
          <pre className="text-sm overflow-auto">
            {JSON.stringify(result, null, 2)}
          </pre>
        </div>
      )}
    </div>
  )
}
```

---

## 3. Monitor Purge Requests

```typescript
'use server'

import {
  buscarRequisioesRecentes,
  buscarLogsDeRequisicao,
  buscarRequisicaoPurga,
} from '@/lib/lgpd'

// Get recent requests
export async function getRecentPurgeRequests(limit = 20) {
  return await buscarRequisioesRecentes(limit)
}

// Get details + logs for a request
export async function getPurgeDetails(purgeId: string) {
  const req = await buscarRequisicaoPurga(purgeId)
  const logs = await buscarLogsDeRequisicao(purgeId)

  return {
    request: req,
    logs,
    totalRecords: logs.reduce((acc, log) => acc + log.registros_afetados, 0),
  }
}
```

**Monitor Component:**
```tsx
'use client'

import { useEffect, useState } from 'react'
import { getRecentPurgeRequests, getPurgeDetails } from './actions'

export function PurgeMonitor() {
  const [requests, setRequests] = useState([])
  const [selectedId, setSelectedId] = useState(null)
  const [details, setDetails] = useState(null)

  useEffect(() => {
    async function loadRequests() {
      const reqs = await getRecentPurgeRequests(10)
      setRequests(reqs)
    }
    loadRequests()
    const interval = setInterval(loadRequests, 30000) // Refresh every 30s
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    if (!selectedId) return

    async function loadDetails() {
      const d = await getPurgeDetails(selectedId)
      setDetails(d)
    }
    loadDetails()
  }, [selectedId])

  return (
    <div className="space-y-4">
      <h2>Purge Requests Monitor</h2>

      <table className="w-full border">
        <thead>
          <tr className="bg-gray-200">
            <th className="p-2 text-left">ID</th>
            <th className="p-2 text-left">Type</th>
            <th className="p-2 text-left">Status</th>
            <th className="p-2 text-left">Created</th>
            <th className="p-2">Action</th>
          </tr>
        </thead>
        <tbody>
          {requests.map((req) => (
            <tr key={req.id} className="border-t hover:bg-gray-50">
              <td className="p-2 text-sm font-mono">{req.id.slice(0, 8)}</td>
              <td className="p-2 text-sm capitalize">{req.tipo}</td>
              <td className={`p-2 text-sm font-bold ${
                req.status === 'concluido' ? 'text-green-600' :
                req.status === 'erro' ? 'text-red-600' :
                req.status === 'processando' ? 'text-blue-600' :
                'text-yellow-600'
              }`}>
                {req.status}
              </td>
              <td className="p-2 text-sm">
                {new Date(req.criado_em).toLocaleString()}
              </td>
              <td className="p-2">
                <button
                  onClick={() => setSelectedId(req.id)}
                  className="px-2 py-1 bg-blue-500 text-white text-sm rounded"
                >
                  Details
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {details && (
        <div className="p-4 bg-gray-50 border rounded">
          <h3 className="font-bold mb-2">Details</h3>
          <p>Total Records Purged: {details.totalRecords}</p>
          <p>Logs: {details.logs.length}</p>
          {details.logs.map((log) => (
            <div key={log.id} className="ml-4 text-sm">
              • {log.tabela}: {log.registros_afetados} {log.acao}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
```

---

## 4. Handle Consent Withdrawal

```typescript
'use server'

import { solicitarPurgaPorConsentimento } from '@/lib/lgpd'

// When user withdraws consent in their settings
export async function handleConsentWithdrawal(userId: string) {
  // Example: User unchecked "Share data with marketing"
  const req = await solicitarPurgaPorConsentimento(
    'marketing_contacts',
    'consentimento_marketing'
  )

  console.log('Consent withdrawal queued:', req.id)
  return req
}
```

**Settings Component:**
```tsx
'use client'

import { useState } from 'react'
import { handleConsentWithdrawal } from './actions'

export function ConsentSettings({ userId }: { userId: string }) {
  const [marketingConsent, setMarketingConsent] = useState(true)
  const [saving, setSaving] = useState(false)

  async function handleToggle(e: React.ChangeEvent<HTMLInputElement>) {
    setSaving(true)
    try {
      if (!e.target.checked && marketingConsent) {
        // User is unchecking consent
        await handleConsentWithdrawal(userId)
        setMarketingConsent(false)
        alert('Your data will be purged within 24 hours.')
      } else {
        setMarketingConsent(e.target.checked)
        // Re-consent would be handled separately
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <label>
      <input
        type="checkbox"
        checked={marketingConsent}
        onChange={handleToggle}
        disabled={saving}
      />
      {saving ? 'Saving...' : 'Allow marketing communications'}
    </label>
  )
}
```

---

## 5. Generate LGPD Reports

```typescript
'use server'

import { gerarRelatorioPurgas } from '@/lib/lgpd'

export async function generateWeeklyReport() {
  const hoje = new Date()
  const semanaAtras = new Date(hoje.getTime() - 7 * 24 * 60 * 60 * 1000)

  const relatorio = await gerarRelatorioPurgas(semanaAtras, hoje)

  return {
    periodo: `${semanaAtras.toLocaleDateString()} - ${hoje.toLocaleDateString()}`,
    requisicoes: relatorio.total_requisicoes,
    registros_purgados: relatorio.total_registros_purgados,
    tempo_medio: relatorio.tempo_medio_processamento_ms,
    taxa_sucesso: relatorio.taxa_sucesso_percent,
    por_tabela: relatorio.detalhes_por_tabela,
  }
}

// Export as CSV for management
export async function exportPurgeDataAsCSV() {
  const relatorio = await generateWeeklyReport()

  let csv = 'Tabela,Registros,Acao,Ultima Execucao\n'
  for (const [tabela, detalhes] of Object.entries(relatorio.por_tabela)) {
    csv += `${tabela},${detalhes.registros},${detalhes.acao},${detalhes.ultima_execucao}\n`
  }

  return csv
}
```

---

## 6. Database Queries for Monitoring

```sql
-- Most recent purges
SELECT id, tipo, status, criado_em, processado_em
FROM lgpd_purge_queue
ORDER BY criado_em DESC
LIMIT 20;

-- Failed purges (investigate)
SELECT id, tipo, alvo_user_id, erro_mensagem
FROM lgpd_purge_queue
WHERE status = 'erro'
ORDER BY criado_em DESC;

-- Records purged per table today
SELECT
  tabela,
  acao,
  SUM(registros_afetados) as total,
  COUNT(*) as operacoes
FROM lgpd_purge_log
WHERE DATE(executado_em) = CURRENT_DATE
GROUP BY tabela, acao
ORDER BY total DESC;

-- Average processing time
SELECT
  AVG(EXTRACT(EPOCH FROM (processado_em - criado_em))) as media_segundos
FROM lgpd_purge_queue
WHERE status = 'concluido'
  AND processado_em >= NOW() - INTERVAL '30 days';

-- View purge status (pre-built view)
SELECT * FROM v_lgpd_purge_status
ORDER BY criado_em DESC
LIMIT 10;
```

---

## 7. Error Handling Pattern

```typescript
'use server'

import {
  solicitarExclusaoUsuario,
  executarPurgaLGPD,
  LGPDError,
  PurgeQueueError,
  EdgeFunctionError,
} from '@/lib/lgpd'

export async function safePurgeOperation(userId: string) {
  try {
    const req = await solicitarExclusaoUsuario(userId, 'Test request')
    return { success: true, purgeId: req.id }
  } catch (error) {
    if (error instanceof PurgeQueueError) {
      console.error('Database error:', error.message)
      return { success: false, error: 'Failed to queue purge request' }
    }

    if (error instanceof EdgeFunctionError) {
      console.error('Function error:', error.message)
      return { success: false, error: 'Purge service temporarily unavailable' }
    }

    if (error instanceof LGPDError) {
      console.error('LGPD error:', error.code, error.message)
      return { success: false, error: error.message }
    }

    // Generic error
    console.error('Unexpected error:', error)
    return { success: false, error: 'An unexpected error occurred' }
  }
}
```

---

## 8. Retention Policy Configuration

```typescript
'use server'

import {
  buscarPoliticasRetencao,
  salvarPoliticaRetencao,
  desativarPoliticaRetencao,
} from '@/lib/lgpd'

// Get all active policies
export async function getPolicies() {
  return await buscarPoliticasRetencao()
}

// Update a policy (ex: extend audit trail retention to 180 days)
export async function updatePolicy(id: string, diasRetencao: number) {
  return await salvarPoliticaRetencao({
    id,
    dias_retencao: diasRetencao,
  })
}

// Disable a policy (ex: stop auto-deletion of portal logs)
export async function disablePolicy(id: string) {
  return await desativarPoliticaRetencao(id)
}
```

**Admin UI:**
```tsx
'use client'

import { useEffect, useState } from 'react'
import { getPolicies, updatePolicy } from './actions'

export function RetentionPoliciesEditor() {
  const [policies, setPolicies] = useState([])

  useEffect(() => {
    getPolicies().then(setPolicies)
  }, [])

  async function handleUpdate(id: string, dias: number) {
    await updatePolicy(id, dias)
    const updated = await getPolicies()
    setPolicies(updated)
  }

  return (
    <div>
      <h2>Retention Policies</h2>
      <table className="w-full">
        <thead>
          <tr>
            <th>Tabela</th>
            <th>Dias Retencao</th>
            <th>Acao</th>
            <th>Ativo</th>
          </tr>
        </thead>
        <tbody>
          {policies.map((p) => (
            <tr key={p.id}>
              <td>{p.tabela}</td>
              <td>
                <input
                  type="number"
                  defaultValue={p.dias_retencao}
                  onChange={(e) => handleUpdate(p.id, parseInt(e.target.value))}
                  className="w-20 px-2 py-1 border"
                />
              </td>
              <td>{p.acao}</td>
              <td>{p.ativo ? '✓' : '✗'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
```

---

## 9. Type Safety

```typescript
'use client'

import {
  PurgeRequest,
  PurgeResponse,
  PurgeLog,
  isPurgeRequest,
  isPurgeResponse,
  formatDuration,
} from '@/lib/lgpd'

// Type-safe response handling
function handlePurgeResult(response: unknown): PurgeResponse | null {
  if (!isPurgeResponse(response)) {
    console.error('Invalid response format')
    return null
  }

  // Now TypeScript knows response is PurgeResponse
  console.log(`Purged ${response.total_registros_purgados} records in ${formatDuration(response.duracao_ms)}`)
  return response
}

// Type-safe request validation
function validateRequest(data: unknown): PurgeRequest | null {
  if (!isPurgeRequest(data)) {
    return null
  }
  return data
}
```

---

## 10. Logging & Debugging

```typescript
'use server'

import { buscarRequisicaoPurga, buscarLogsDeRequisicao } from '@/lib/lgpd'

export async function debugPurgeRequest(purgeId: string) {
  const req = await buscarRequisicaoPurga(purgeId)

  if (!req) {
    console.warn(`Purge request ${purgeId} not found`)
    return null
  }

  const logs = await buscarLogsDeRequisicao(purgeId)

  console.log('=== PURGE REQUEST DEBUG ===')
  console.log('ID:', req.id)
  console.log('Type:', req.tipo)
  console.log('Status:', req.status)
  console.log('Created:', req.criado_em)
  console.log('Processed:', req.processado_em)
  console.log('Error:', req.erro_mensagem)
  console.log('---')
  console.log('Logs:', logs.length)
  logs.forEach((log) => {
    console.log(`  ${log.tabela}: ${log.registros_afetados} ${log.acao}`)
  })

  return { request: req, logs }
}
```

---

**Last Updated:** 2026-03-26
