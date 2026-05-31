// docs/components/HitlQueue.contract.ts
// Este arquivo é documentação — não é código de produção

interface HITLQueueComponentContract {
  // Props obrigatórias
  approvals: HITLApprovalListItem[];
  onApprove: (id: string) => Promise<void>;
  onReject: (id: string, note?: string) => Promise<void>;
  onEdit: (id: string) => void;           // Abre modal de edição

  // Props opcionais
  maxHeight?: string;                      // Default: 'calc(100vh - 200px)'
  showExpiredWarning?: boolean;            // Default: true
  refreshInterval?: number;               // Default: 30000ms

  // Comportamentos obrigatórios
  // 1. Ordenar por timeRemainingMinutes ASC (expirar primeiro = topo)
  // 2. Badge vermelho na tab se count > 0
  // 3. Countdown visual nos últimos 10 minutos (cor muda para vermelho)
  // 4. Otimistic update: marcar como aprovado antes do server confirmar
  // 5. Rollback se server retornar erro
  // 6. Loading skeleton (não spinner) durante carregamento inicial
}