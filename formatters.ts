import type { Timestamp } from 'firebase/firestore';
import type { BoletoRecord, StatusBoleto } from '../types';

export function formatCurrencyBRL(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(Number.isFinite(value) ? value : 0);
}

export function getTodayISO(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function formatDateBR(isoDate: string): string {
  if (!isoDate || !/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) return isoDate || '—';
  const [y, m, d] = isoDate.split('-');
  return `${d}/${m}/${y}`;
}

export function formatTimestampBR(ts: Timestamp | Date | null | undefined): string {
  if (!ts) return '—';
  const date = ts instanceof Date ? ts : typeof ts.toDate === 'function' ? ts.toDate() : null;
  if (!date) return '—';
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(date);
}

export function getEffectiveBoletoStatus(boleto: Pick<BoletoRecord, 'status' | 'vencimento'>): StatusBoleto {
  if (boleto.status === 'Pago') return 'Pago';
  if (boleto.status === 'Vencido') return 'Vencido';
  const today = getTodayISO();
  if (boleto.vencimento && boleto.vencimento < today) {
    return 'Vencido';
  }
  return 'Pendente';
}

export function sanitizeWhatsappDigits(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('55') && digits.length >= 12) return digits;
  if (digits.length >= 10 && digits.length <= 11) return `55${digits}`;
  return digits;
}

export function formatWhatsappInput(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  if (digits.length === 0) return '';
  if (digits.length <= 2) return `(${digits}`;
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

export function buildWhatsAppUrl(phone: string, message: string): string {
  const digits = sanitizeWhatsappDigits(phone);
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}

export function generateTemporaryPassword(length = 10): string {
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lower = 'abcdefghijkmnpqrstuvwxyz';
  const digits = '23456789';
  const symbols = '@#$%';
  const all = upper + lower + digits + symbols;

  const array = new Uint32Array(length);
  crypto.getRandomValues(array);

  const chars: string[] = [
    upper[array[0] % upper.length],
    lower[array[1] % lower.length],
    digits[array[2] % digits.length],
    symbols[array[3] % symbols.length],
  ];

  for (let i = 4; i < length; i++) {
    chars.push(all[array[i] % all.length]);
  }

  for (let i = chars.length - 1; i > 0; i--) {
    const j = array[i] % (i + 1);
    const tmp = chars[i];
    chars[i] = chars[j];
    chars[j] = tmp;
  }

  return chars.join('');
}

export function sanitizeFileName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .slice(0, 120);
}

export function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

// Formata campo EMV TLV para PIX Copia e Cola
function tlv(id: string, value: string): string {
  const len = String(value.length).padStart(2, '0');
  return `${id}${len}${value}`;
}

function crc16ccitt(payload: string): string {
  let crc = 0xffff;
  for (let i = 0; i < payload.length; i++) {
    crc ^= payload.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      if ((crc & 0x8000) !== 0) {
        crc = ((crc << 1) ^ 0x1021) & 0xffff;
      } else {
        crc = (crc << 1) & 0xffff;
      }
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

export function generatePixCopiaECola(params: {
  pixKey: string;
  merchantName: string;
  amount: number;
  txId?: string;
}): string {
  const cleanKey = (params.pixKey || 'financeiro@empresa.com').trim().slice(0, 77);
  const cleanName = (params.merchantName || 'PORTAL EMPRESA')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9 ]/g, '')
    .toUpperCase()
    .trim()
    .slice(0, 25) || 'EMPRESA';
  const cleanTxId = (params.txId || 'PORTAL01')
    .replace(/[^a-zA-Z0-9]/g, '')
    .toUpperCase()
    .slice(0, 20) || 'PORTAL01';
  const amountStr = Number(params.amount || 0).toFixed(2);

  const gui = tlv('00', 'br.gov.bcb.pix');
  const keyField = tlv('01', cleanKey);
  const merchantAccount = tlv('26', `${gui}${keyField}`);

  const base =
    tlv('00', '01') +
    merchantAccount +
    tlv('52', '0000') +
    tlv('53', '986') +
    tlv('54', amountStr) +
    tlv('58', 'BR') +
    tlv('59', cleanName) +
    tlv('60', 'BRASIL') +
    tlv('62', tlv('05', cleanTxId)) +
    '6304';

  return `${base}${crc16ccitt(base)}`;
}

/**
 * Gera um PDF 1.4 válido em memória contendo os dados estruturados do boleto/fatura.
 */
export function generateBoletoPdfBlob(boleto: BoletoRecord): Blob {
  const cleanPdfText = (txt: string) =>
    txt
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^\x20-\x7E]/g, ' ')
      .replace(/\\/g, '\\\\')
      .replace(/\(/g, '\\(')
      .replace(/\)/g, '\\)');

  const effectiveStatus = getEffectiveBoletoStatus(boleto);
  const pixWrapped: string[] = [];
  for (let i = 0; i < boleto.codigoPix.length; i += 64) {
    pixWrapped.push(boleto.codigoPix.slice(i, i + 64));
  }

  const lines = [
    'PORTAL DO CLIENTE - DEMONSTRATIVO DE COBRANCA / PIX',
    '================================================================',
    `Beneficiario (Empresa) : ${boleto.empresaNome}`,
    `Pagador (Cliente)      : ${boleto.clienteNome}`,
    `WhatsApp               : ${boleto.clienteWhatsapp}`,
    '----------------------------------------------------------------',
    `Descricao              : ${boleto.descricao}`,
    `Valor                  : ${formatCurrencyBRL(boleto.valor)}`,
    `Data de Vencimento     : ${formatDateBR(boleto.vencimento)}`,
    `Status                 : ${effectiveStatus}`,
    '----------------------------------------------------------------',
    `Chave PIX              : ${boleto.pixChave}`,
    'Codigo PIX (Copia e Cola):',
    ...pixWrapped,
    '----------------------------------------------------------------',
    `Codigo de Controle     : ${boleto.id}`,
    'Documento gerado eletronicamente em conformidade com a LGPD',
    '(Lei 13.709/2018) - Coleta minima sem CPF/dados sensiveis.',
  ];

  const streamCommands = [
    'q',
    '0.06 0.09 0.16 RG',
    '1 w',
    '36 740 523 64 re S',
    '0.88 0.91 0.94 RG',
    '36 410 523 320 re S',
    'Q',
    'BT',
    '/F1 11 Tf',
    '48 780 Td',
    '17 TL',
    ...lines.map((line, idx) =>
      idx === 0 ? `(${cleanPdfText(line)}) Tj` : `T* (${cleanPdfText(line)}) Tj`
    ),
    'ET',
  ].join('\n');

  const objects: string[] = [
    '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n',
    '2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n',
    '3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj\n',
    `4 0 obj\n<< /Length ${streamCommands.length} >>\nstream\n${streamCommands}\nendstream\nendobj\n`,
    '5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Courier >>\nendobj\n',
  ];

  let pdf = '%PDF-1.4\n';
  const offsets: number[] = [0];
  for (const obj of objects) {
    offsets.push(pdf.length);
    pdf += obj;
  }
  const xrefPos = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i <= objects.length; i++) {
    pdf += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefPos}\n%%EOF`;

  return new Blob([pdf], { type: 'application/pdf' });
}

export function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

const PDF_CHUNK_CHAR_SIZE = 450_000;

export async function fileToBase64Chunks(file: File): Promise<string[]> {
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const sliceSize = 0x8000;
  for (let i = 0; i < bytes.length; i += sliceSize) {
    const sub = bytes.subarray(i, i + sliceSize);
    binary += String.fromCharCode(...sub);
  }
  const base64 = btoa(binary);
  const chunks: string[] = [];
  for (let i = 0; i < base64.length; i += PDF_CHUNK_CHAR_SIZE) {
    chunks.push(base64.slice(i, i + PDF_CHUNK_CHAR_SIZE));
  }
  return chunks;
}

export function base64ChunksToPdfBlob(chunks: string[]): Blob {
  const base64 = chunks.join('');
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Blob([bytes], { type: 'application/pdf' });
}

