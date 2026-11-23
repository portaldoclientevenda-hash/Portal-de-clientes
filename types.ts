import type { Timestamp } from 'firebase/firestore';

export type PapelUsuario = 'empresa' | 'cliente';
export type StatusBoleto = 'Pago' | 'Pendente' | 'Vencido';
export type StatusChamado = 'Aberto' | 'Em Andamento' | 'Resolvido';

export interface EmpresaProfile {
  empresaId: string;
  nome: string;
  email: string;
  whatsapp: string;
  papel: 'empresa';
  pixChave: string;
  lgpdConsent: boolean;
  lgpdConsentAt: Timestamp | null;
  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;
}

export interface ClienteProfile {
  clienteId: string;
  empresaId: string;
  empresaNome: string;
  empresaEmail: string;
  nome: string;
  whatsapp: string;
  email: string;
  papel: 'cliente';
  lgpdConsent: boolean;
  lgpdConsentAt: Timestamp | null;
  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;
}

export interface BoletoRecord {
  id: string;
  empresaId: string;
  clienteId: string;
  clienteNome: string;
  clienteWhatsapp: string;
  empresaNome: string;
  pixChave: string;
  codigoPix: string;
  descricao: string;
  valor: number;
  vencimento: string; // YYYY-MM-DD
  status: StatusBoleto;
  pagoEm: Timestamp | null;
  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;
}

export interface DocumentoRecord {
  id: string;
  empresaId: string;
  clienteId: string;
  clienteNome: string;
  titulo: string;
  descricao: string;
  fileName: string;
  fileSize: number;
  storageMode?: 'firestore' | 'storage';
  chunkCount?: number;
  storagePath: string;
  downloadUrl: string;
  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;
}

export interface ChamadoRecord {
  id: string;
  empresaId: string;
  clienteId: string;
  clienteNome: string;
  titulo: string;
  mensagem: string;
  status: StatusChamado;
  resposta: string;
  respondidoEm: Timestamp | null;
  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;
}

export interface AtividadeRecord {
  id: string;
  empresaId: string;
  clienteId: string;
  actorUid: string;
  acao: string;
  detalhe: string;
  createdAt: Timestamp | null;
}
