import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'motion/react';
import {
  LayoutDashboard,
  Users,
  Receipt,
  FileText,
  MessageSquare,
  BarChart3,
  LogOut,
  Plus,
  Search,
  Edit3,
  Eye,
  Trash2,
  CheckCircle2,
  Send,
  Upload,
  Download,
  Copy,
  Check,
  AlertCircle,
  X,
  RefreshCw,
  Settings,
  ShieldCheck,
  Calendar,
  FileSpreadsheet,
  TrendingUp,
} from 'lucide-react';
import {
  collection,
  query,
  where,
  onSnapshot,
  doc,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  writeBatch,
  getDocs,
} from 'firebase/firestore';
import {
  createUserWithEmailAndPassword,
  deleteUser,
  EmailAuthProvider,
  reauthenticateWithCredential,
  signOut,
} from 'firebase/auth';
import {
  ref,
  getBlob,
  deleteObject,
} from 'firebase/storage';
import {
  auth,
  db,
  storage,
  provisionerAuth,
  handleFirestoreError,
  OperationType,
  isOfflineError,
} from '../firebase';
import type {
  AtividadeRecord,
  BoletoRecord,
  ChamadoRecord,
  ClienteProfile,
  DocumentoRecord,
  EmpresaProfile,
  StatusBoleto,
  StatusChamado,
} from '../types';
import {
  buildWhatsAppUrl,
  downloadBlob,
  formatCurrencyBRL,
  formatDateBR,
  formatFileSize,
  formatTimestampBR,
  formatWhatsappInput,
  generatePixCopiaECola,
  generateTemporaryPassword,
  getEffectiveBoletoStatus,
  getTodayISO,
  fileToBase64Chunks,
  base64ChunksToPdfBlob,
} from '../utils/formatters';
import { BoletoStatusBadge, ChamadoStatusBadge } from './StatusLabel';
import { RecebimentosChart } from './RecebimentosChart';
import { PdfPreviewModal } from './PdfPreviewModal';
import { Footer } from './Footer';

type EmpresaTab = 'dashboard' | 'clientes' | 'boletos' | 'documentos' | 'chamados' | 'relatorio';

interface EmpresaDashboardProps {
  empresa: EmpresaProfile;
  onOpenPrivacy: () => void;
  onAccountDeleted: (message: string) => void;
  isOffline: boolean;
}

export const EmpresaDashboard: React.FC<EmpresaDashboardProps> = ({
  empresa,
  onOpenPrivacy,
  onAccountDeleted,
  isOffline,
}) => {
  const [activeTab, setActiveTab] = useState<EmpresaTab>('dashboard');

  const [clientes, setClientes] = useState<ClienteProfile[]>([]);
  const [boletos, setBoletos] = useState<BoletoRecord[]>([]);
  const [documentos, setDocumentos] = useState<DocumentoRecord[]>([]);
  const [chamados, setChamados] = useState<ChamadoRecord[]>([]);
  const [atividades, setAtividades] = useState<AtividadeRecord[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  const [toast, setToast] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const showToast = (type: 'success' | 'error', text: string) => {
    setToast({ type, text });
    setTimeout(() => {
      setToast((prev) => (prev?.text === text ? null : prev));
    }, 5000);
  };

  // === Listeners Firestore em tempo real ===
  useEffect(() => {
    const empUid = empresa.empresaId;
    setLoadingData(true);

    const qClientes = query(collection(db, 'clientes'), where('empresaId', '==', empUid));
    const qBoletos = query(collection(db, 'boletos'), where('empresaId', '==', empUid));
    const qDocs = query(collection(db, 'documentos'), where('empresaId', '==', empUid));
    const qChamados = query(collection(db, 'chamados'), where('empresaId', '==', empUid));
    const qAtividades = query(collection(db, 'atividades'), where('empresaId', '==', empUid));

    const unsubClientes = onSnapshot(
      qClientes,
      (snap) => {
        const rows = snap.docs.map((d) => d.data() as ClienteProfile);
        rows.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
        setClientes(rows);
        setLoadingData(false);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'clientes')
    );

    const unsubBoletos = onSnapshot(
      qBoletos,
      (snap) => {
        const rows = snap.docs.map((d) => ({ ...(d.data() as Omit<BoletoRecord, 'id'>), id: d.id }));
        rows.sort((a, b) => (b.vencimento || '').localeCompare(a.vencimento || ''));
        setBoletos(rows);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'boletos')
    );

    const unsubDocs = onSnapshot(
      qDocs,
      (snap) => {
        const rows = snap.docs.map((d) => ({ ...(d.data() as Omit<DocumentoRecord, 'id'>), id: d.id }));
        rows.sort((a, b) => {
          const ta = a.createdAt?.toMillis?.() ?? 0;
          const tb = b.createdAt?.toMillis?.() ?? 0;
          return tb - ta;
        });
        setDocumentos(rows);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'documentos')
    );

    const unsubChamados = onSnapshot(
      qChamados,
      (snap) => {
        const rows = snap.docs.map((d) => ({ ...(d.data() as Omit<ChamadoRecord, 'id'>), id: d.id }));
        rows.sort((a, b) => {
          const ta = a.createdAt?.toMillis?.() ?? 0;
          const tb = b.createdAt?.toMillis?.() ?? 0;
          return tb - ta;
        });
        setChamados(rows);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'chamados')
    );

    const unsubAtiv = onSnapshot(
      qAtividades,
      (snap) => {
        const rows = snap.docs.map((d) => ({ ...(d.data() as Omit<AtividadeRecord, 'id'>), id: d.id }));
        rows.sort((a, b) => {
          const ta = a.createdAt?.toMillis?.() ?? 0;
          const tb = b.createdAt?.toMillis?.() ?? 0;
          return tb - ta;
        });
        setAtividades(rows.slice(0, 20));
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'atividades')
    );

    return () => {
      unsubClientes();
      unsubBoletos();
      unsubDocs();
      unsubChamados();
      unsubAtiv();
    };
  }, [empresa.empresaId]);

  const registrarAtividade = async (acao: string, detalhe: string, clienteId = '') => {
    try {
      await addDoc(collection(db, 'atividades'), {
        empresaId: empresa.empresaId,
        clienteId,
        actorUid: empresa.empresaId,
        acao: acao.slice(0, 120),
        detalhe: detalhe.slice(0, 300),
        createdAt: serverTimestamp(),
      });
    } catch {
      // Log secundário
    }
  };

  // === Métricas ===
  const metrics = useMemo(() => {
    let totalReceber = 0;
    let totalRecebido = 0;
    let totalVencido = 0;
    let countPendente = 0;
    let countVencido = 0;
    let countPago = 0;
    const inadimplentesSet = new Set<string>();

    for (const b of boletos) {
      const st = getEffectiveBoletoStatus(b);
      if (st === 'Pago') {
        totalRecebido += b.valor;
        countPago += 1;
      } else if (st === 'Vencido') {
        totalVencido += b.valor;
        totalReceber += b.valor;
        countVencido += 1;
        inadimplentesSet.add(b.clienteId);
      } else {
        totalReceber += b.valor;
        countPendente += 1;
      }
    }

    const totalEmitido = totalRecebido + totalReceber;
    const taxaRecebimento = totalEmitido > 0 ? Math.round((totalRecebido / totalEmitido) * 100) : 0;

    return {
      totalClientes: clientes.length,
      totalReceber,
      totalRecebido,
      totalVencido,
      totalEmitido,
      taxaRecebimento,
      countPendente,
      countVencido,
      countPago,
      inadimplentesCount: inadimplentesSet.size,
      chamadosAbertos: chamados.filter((c) => c.status !== 'Resolvido').length,
    };
  }, [clientes.length, boletos, chamados]);

  // === Clientes ===
  const [clienteSearch, setClienteSearch] = useState('');
  const [showNewClienteModal, setShowNewClienteModal] = useState(false);
  const [cliNome, setCliNome] = useState('');
  const [cliWhatsapp, setCliWhatsapp] = useState('');
  const [cliEmail, setCliEmail] = useState('');
  const [cliTempPass, setCliTempPass] = useState(() => generateTemporaryPassword());
  const [cliLgpdConsent, setCliLgpdConsent] = useState(false);
  const [cliFormError, setCliFormError] = useState<string | null>(null);
  const [savingCliente, setSavingCliente] = useState(false);

  const [createdClientCreds, setCreatedClientCreds] = useState<{
    nome: string;
    email: string;
    whatsapp: string;
    senhaTemporaria: string;
  } | null>(null);
  const [copiedCreds, setCopiedCreds] = useState(false);

  const [editingCliente, setEditingCliente] = useState<ClienteProfile | null>(null);
  const [editCliNome, setEditCliNome] = useState('');
  const [editCliWhatsapp, setEditCliWhatsapp] = useState('');
  const [editCliEmail, setEditCliEmail] = useState('');

  const [detailCliente, setDetailCliente] = useState<ClienteProfile | null>(null);
  const [confirmDeleteCliente, setConfirmDeleteCliente] = useState<ClienteProfile | null>(null);
  const [deletingCliente, setDeletingCliente] = useState(false);

  const filteredClientes = useMemo(() => {
    const q = clienteSearch.trim().toLowerCase();
    if (!q) return clientes;
    return clientes.filter(
      (c) =>
        c.nome.toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q) ||
        c.whatsapp.toLowerCase().includes(q)
    );
  }, [clientes, clienteSearch]);

  const handleCreateCliente = async (e: React.FormEvent) => {
    e.preventDefault();
    setCliFormError(null);
    if (isOffline || !navigator.onLine) {
      setCliFormError('Sem conexão, tente novamente.');
      return;
    }
    if (!cliNome.trim() || cliNome.trim().length < 2) {
      setCliFormError('Informe o nome completo do cliente.');
      return;
    }
    if (!cliWhatsapp.trim() || cliWhatsapp.replace(/\D/g, '').length < 10) {
      setCliFormError('Informe um WhatsApp válido com DDD.');
      return;
    }
    if (!cliEmail.trim()) {
      setCliFormError('Informe o e-mail do cliente.');
      return;
    }
    if (!cliLgpdConsent) {
      setCliFormError('Você precisa aceitar para continuar.');
      return;
    }

    setSavingCliente(true);
    try {
      const cred = await createUserWithEmailAndPassword(
        provisionerAuth,
        cliEmail.trim().toLowerCase(),
        cliTempPass
      );
      const clientUid = cred.user.uid;
      await signOut(provisionerAuth);

      const clientePath = `clientes/${clientUid}`;
      try {
        await setDoc(doc(db, 'clientes', clientUid), {
          clienteId: clientUid,
          empresaId: empresa.empresaId,
          empresaNome: empresa.nome,
          empresaEmail: empresa.email,
          nome: cliNome.trim(),
          whatsapp: cliWhatsapp.trim(),
          email: cliEmail.trim().toLowerCase(),
          papel: 'cliente',
          lgpdConsent: true,
          lgpdConsentAt: serverTimestamp(),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } catch (fsErr) {
        handleFirestoreError(fsErr, OperationType.CREATE, clientePath);
      }

      await registrarAtividade(
        'Cliente cadastrado',
        `Cliente ${cliNome.trim()} cadastrado pela empresa.`,
        clientUid
      );

      setCreatedClientCreds({
        nome: cliNome.trim(),
        email: cliEmail.trim().toLowerCase(),
        whatsapp: cliWhatsapp.trim(),
        senhaTemporaria: cliTempPass,
      });

      setShowNewClienteModal(false);
      setCliNome('');
      setCliWhatsapp('');
      setCliEmail('');
      setCliTempPass(generateTemporaryPassword());
      setCliLgpdConsent(false);
      showToast('success', 'Cliente cadastrado! Envie a senha temporária ao cliente.');
    } catch (err) {
      const code = (err as { code?: string })?.code || '';
      if (isOfflineError(err)) {
        setCliFormError('Sem conexão, tente novamente.');
      } else if (code === 'auth/email-already-in-use') {
        setCliFormError('Este e-mail já possui uma conta cadastrada no Firebase Auth.');
      } else if (code === 'auth/invalid-email') {
        setCliFormError('E-mail inválido.');
      } else if (code === 'auth/operation-not-allowed') {
        setCliFormError(
          'Ative o provedor E-mail/Senha no Firebase Console (Authentication → Sign-in method) para criar contas.'
        );
      } else {
        setCliFormError('Não foi possível cadastrar o cliente. Verifique os dados e tente novamente.');
      }
    } finally {
      setSavingCliente(false);
    }
  };

  const handleUpdateCliente = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCliente) return;
    if (isOffline || !navigator.onLine) {
      showToast('error', 'Sem conexão, tente novamente.');
      return;
    }
    setSavingCliente(true);
    try {
      await updateDoc(doc(db, 'clientes', editingCliente.clienteId), {
        nome: editCliNome.trim(),
        whatsapp: editCliWhatsapp.trim(),
        email: editCliEmail.trim().toLowerCase(),
        updatedAt: serverTimestamp(),
      });
      await registrarAtividade(
        'Cliente atualizado',
        `Dados do cliente ${editCliNome.trim()} atualizados.`,
        editingCliente.clienteId
      );
      setEditingCliente(null);
      showToast('success', 'Dados do cliente atualizados.');
    } catch (err) {
      if (isOfflineError(err)) {
        showToast('error', 'Sem conexão, tente novamente.');
      } else {
        handleFirestoreError(err, OperationType.UPDATE, `clientes/${editingCliente.clienteId}`);
      }
    } finally {
      setSavingCliente(false);
    }
  };

  const handleDeleteClienteData = async () => {
    if (!confirmDeleteCliente) return;
    if (isOffline || !navigator.onLine) {
      showToast('error', 'Sem conexão, tente novamente.');
      return;
    }
    setDeletingCliente(true);
    const targetId = confirmDeleteCliente.clienteId;
    const targetNome = confirmDeleteCliente.nome;
    try {
      const clientDocs = documentos.filter((d) => d.clienteId === targetId);
      const refsToDelete = [];
      for (const d of clientDocs) {
        if (d.storagePath) {
          try {
            await deleteObject(ref(storage, d.storagePath));
          } catch {
            // Ignora caso arquivo já removido
          }
        }
        const chunkSnap = await getDocs(
          query(
            collection(db, 'documentos', d.id, 'chunks'),
            where('empresaId', '==', empresa.empresaId)
          )
        );
        chunkSnap.forEach((c) => refsToDelete.push(c.ref));
        refsToDelete.push(doc(db, 'documentos', d.id));
      }

      for (const b of boletos.filter((x) => x.clienteId === targetId)) {
        refsToDelete.push(doc(db, 'boletos', b.id));
      }
      for (const ch of chamados.filter((x) => x.clienteId === targetId)) {
        refsToDelete.push(doc(db, 'chamados', ch.id));
      }
      const ativSnap = await getDocs(
        query(
          collection(db, 'atividades'),
          where('empresaId', '==', empresa.empresaId),
          where('clienteId', '==', targetId)
        )
      );
      ativSnap.forEach((docSnap) => refsToDelete.push(docSnap.ref));
      refsToDelete.push(doc(db, 'clientes', targetId));

      for (let i = 0; i < refsToDelete.length; i += 400) {
        const batch = writeBatch(db);
        refsToDelete.slice(i, i + 400).forEach((r) => batch.delete(r));
        await batch.commit();
      }

      await registrarAtividade('Exclusão LGPD de cliente', `Dados de ${targetNome} excluídos.`);
      setConfirmDeleteCliente(null);
      showToast('success', `Dados de ${targetNome} apagados conforme LGPD.`);
    } catch (err) {
      if (isOfflineError(err)) {
        showToast('error', 'Sem conexão, tente novamente.');
      } else {
        handleFirestoreError(err, OperationType.DELETE, `clientes/${targetId}`);
      }
    } finally {
      setDeletingCliente(false);
    }
  };

  // === Boletos ===
  const [boletoFilter, setBoletoFilter] = useState<'Todos' | StatusBoleto>('Todos');
  const [boletoSearch, setBoletoSearch] = useState('');
  const [showNewBoletoModal, setShowNewBoletoModal] = useState(false);
  const [bolClienteId, setBolClienteId] = useState('');
  const [bolValor, setBolValor] = useState('');
  const [bolVencimento, setBolVencimento] = useState(getTodayISO());
  const [bolDescricao, setBolDescricao] = useState('');
  const [bolStatus, setBolStatus] = useState<StatusBoleto>('Pendente');
  const [savingBoleto, setSavingBoleto] = useState(false);

  const [editingBoleto, setEditingBoleto] = useState<BoletoRecord | null>(null);
  const [editBolValor, setEditBolValor] = useState('');
  const [editBolVencimento, setEditBolVencimento] = useState('');
  const [editBolDescricao, setEditBolDescricao] = useState('');
  const [editBolStatus, setEditBolStatus] = useState<'Pendente' | 'Vencido'>('Pendente');

  const filteredBoletos = useMemo(() => {
    const q = boletoSearch.trim().toLowerCase();
    return boletos.filter((b) => {
      if (boletoFilter !== 'Todos' && getEffectiveBoletoStatus(b) !== boletoFilter) {
        return false;
      }
      if (!q) return true;
      return (
        b.clienteNome.toLowerCase().includes(q) ||
        b.descricao.toLowerCase().includes(q)
      );
    });
  }, [boletos, boletoFilter, boletoSearch]);

  const handleCreateBoleto = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isOffline || !navigator.onLine) {
      showToast('error', 'Sem conexão, tente novamente.');
      return;
    }
    const cli = clientes.find((c) => c.clienteId === bolClienteId);
    const numericVal = Number(bolValor.replace(',', '.'));
    if (!cli) {
      showToast('error', 'Selecione um cliente.');
      return;
    }
    if (!Number.isFinite(numericVal) || numericVal <= 0) {
      showToast('error', 'Informe um valor maior que zero.');
      return;
    }
    if (!bolDescricao.trim()) {
      showToast('error', 'Informe a descrição do boleto.');
      return;
    }

    setSavingBoleto(true);
    try {
      const pixKey = empresa.pixChave || empresa.email;
      const docRef = doc(collection(db, 'boletos'));
      const codigoPix = generatePixCopiaECola({
        pixKey,
        merchantName: empresa.nome,
        amount: numericVal,
        txId: docRef.id,
      });

      await setDoc(docRef, {
        empresaId: empresa.empresaId,
        clienteId: cli.clienteId,
        clienteNome: cli.nome,
        clienteWhatsapp: cli.whatsapp,
        empresaNome: empresa.nome,
        pixChave: pixKey,
        codigoPix,
        descricao: bolDescricao.trim(),
        valor: numericVal,
        vencimento: bolVencimento,
        status: bolStatus,
        pagoEm: bolStatus === 'Pago' ? serverTimestamp() : null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      await registrarAtividade(
        'Boleto emitido',
        `Boleto de ${formatCurrencyBRL(numericVal)} para ${cli.nome}.`,
        cli.clienteId
      );

      setShowNewBoletoModal(false);
      setBolClienteId('');
      setBolValor('');
      setBolDescricao('');
      setBolStatus('Pendente');
      setBolVencimento(getTodayISO());
      showToast('success', 'Boleto cadastrado com sucesso.');
    } catch (err) {
      if (isOfflineError(err)) {
        showToast('error', 'Sem conexão, tente novamente.');
      } else {
        handleFirestoreError(err, OperationType.CREATE, 'boletos');
      }
    } finally {
      setSavingBoleto(false);
    }
  };

  const handleUpdateBoleto = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingBoleto) return;
    if (isOffline || !navigator.onLine) {
      showToast('error', 'Sem conexão, tente novamente.');
      return;
    }
    const numericVal = Number(editBolValor.replace(',', '.'));
    if (!Number.isFinite(numericVal) || numericVal <= 0) {
      showToast('error', 'Informe um valor maior que zero.');
      return;
    }
    setSavingBoleto(true);
    try {
      const pixKey = empresa.pixChave || empresa.email;
      const codigoPix = generatePixCopiaECola({
        pixKey,
        merchantName: empresa.nome,
        amount: numericVal,
        txId: editingBoleto.id,
      });

      await updateDoc(doc(db, 'boletos', editingBoleto.id), {
        descricao: editBolDescricao.trim(),
        valor: numericVal,
        vencimento: editBolVencimento,
        status: editBolStatus,
        pixChave: pixKey,
        codigoPix,
        updatedAt: serverTimestamp(),
      });

      await registrarAtividade(
        'Boleto atualizado',
        `${editBolDescricao.trim()} (${formatCurrencyBRL(numericVal)}) — ${editingBoleto.clienteNome}`,
        editingBoleto.clienteId
      );

      setEditingBoleto(null);
      showToast('success', 'Boleto atualizado com sucesso.');
    } catch (err) {
      if (isOfflineError(err)) {
        showToast('error', 'Sem conexão, tente novamente.');
      } else {
        handleFirestoreError(err, OperationType.UPDATE, `boletos/${editingBoleto.id}`);
      }
    } finally {
      setSavingBoleto(false);
    }
  };

  const handleMarkBoletoPaid = async (b: BoletoRecord) => {
    if (isOffline || !navigator.onLine) {
      showToast('error', 'Sem conexão, tente novamente.');
      return;
    }
    try {
      await updateDoc(doc(db, 'boletos', b.id), {
        status: 'Pago',
        pagoEm: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      await registrarAtividade(
        'Boleto marcado como Pago',
        `${b.descricao} (${formatCurrencyBRL(b.valor)}) — ${b.clienteNome}`,
        b.clienteId
      );
      showToast('success', 'Boleto marcado como Pago.');
    } catch (err) {
      if (isOfflineError(err)) {
        showToast('error', 'Sem conexão, tente novamente.');
      } else {
        handleFirestoreError(err, OperationType.UPDATE, `boletos/${b.id}`);
      }
    }
  };

  const handleDeleteBoleto = async (b: BoletoRecord) => {
    if (isOffline || !navigator.onLine) {
      showToast('error', 'Sem conexão, tente novamente.');
      return;
    }
    try {
      await deleteDoc(doc(db, 'boletos', b.id));
      await registrarAtividade('Boleto excluído', `${b.descricao} — ${b.clienteNome}`, b.clienteId);
      showToast('success', 'Boleto excluído.');
    } catch (err) {
      if (isOfflineError(err)) {
        showToast('error', 'Sem conexão, tente novamente.');
      } else {
        handleFirestoreError(err, OperationType.DELETE, `boletos/${b.id}`);
      }
    }
  };

  // === Documentos ===
  const [docSearch, setDocSearch] = useState('');
  const [showNewDocModal, setShowNewDocModal] = useState(false);
  const [docClienteId, setDocClienteId] = useState('');
  const [docTitulo, setDocTitulo] = useState('');
  const [docDescricao, setDocDescricao] = useState('');
  const [docFile, setDocFile] = useState<File | null>(null);
  const [isDraggingPdf, setIsDraggingPdf] = useState(false);
  const [docFormError, setDocFormError] = useState<string | null>(null);
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const [downloadingDocId, setDownloadingDocId] = useState<string | null>(null);
  const [previewDoc, setPreviewDoc] = useState<{
    doc: DocumentoRecord;
    blobUrl: string;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const filteredDocumentos = useMemo(() => {
    const q = docSearch.trim().toLowerCase();
    if (!q) return documentos;
    return documentos.filter(
      (d) =>
        d.titulo.toLowerCase().includes(q) ||
        d.clienteNome.toLowerCase().includes(q) ||
        d.fileName.toLowerCase().includes(q) ||
        d.descricao.toLowerCase().includes(q)
    );
  }, [documentos, docSearch]);

  const validateAndSetPdf = (file: File | undefined) => {
    setDocFormError(null);
    if (!file) return;
    const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
    if (!isPdf) {
      setDocFormError('Selecione apenas arquivos no formato PDF.');
      setDocFile(null);
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setDocFormError('O arquivo PDF deve ter no máximo 5 MB.');
      setDocFile(null);
      return;
    }
    setDocFile(file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    validateAndSetPdf(e.target.files?.[0]);
  };

  const handleDropPdf = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDraggingPdf(false);
    validateAndSetPdf(e.dataTransfer.files?.[0]);
  };

  const handleUploadDocumento = async (e: React.FormEvent) => {
    e.preventDefault();
    setDocFormError(null);
    if (isOffline || !navigator.onLine) {
      setDocFormError('Sem conexão, tente novamente.');
      return;
    }
    const cli = clientes.find((c) => c.clienteId === docClienteId);
    if (!cli) {
      setDocFormError('Selecione o cliente destinatário.');
      return;
    }
    if (!docTitulo.trim()) {
      setDocFormError('Informe o título do documento.');
      return;
    }
    if (!docFile) {
      setDocFormError('Escolha um arquivo PDF antes de enviar.');
      return;
    }

    setUploadingDoc(true);
    try {
      const chunks = await fileToBase64Chunks(docFile);
      if (chunks.length === 0 || chunks.length > 30) {
        setDocFormError('O arquivo PDF excede o limite permitido (5 MB).');
        setUploadingDoc(false);
        return;
      }

      const docRef = doc(collection(db, 'documentos'));
      const batch = writeBatch(db);

      batch.set(docRef, {
        empresaId: empresa.empresaId,
        clienteId: cli.clienteId,
        clienteNome: cli.nome,
        titulo: docTitulo.trim(),
        descricao: docDescricao.trim(),
        fileName: docFile.name,
        fileSize: docFile.size,
        storageMode: 'firestore',
        chunkCount: chunks.length,
        storagePath: '',
        downloadUrl: '',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      chunks.forEach((chunkData, index) => {
        const chunkRef = doc(db, 'documentos', docRef.id, 'chunks', String(index));
        batch.set(chunkRef, {
          empresaId: empresa.empresaId,
          clienteId: cli.clienteId,
          index,
          data: chunkData,
          createdAt: serverTimestamp(),
        });
      });

      await batch.commit();

      await registrarAtividade(
        'Documento PDF enviado',
        `${docTitulo.trim()} (${docFile.name}) para ${cli.nome}`,
        cli.clienteId
      );

      setShowNewDocModal(false);
      setDocClienteId('');
      setDocTitulo('');
      setDocDescricao('');
      setDocFile(null);
      showToast('success', 'Documento PDF enviado e protegido no banco privado.');
    } catch (err) {
      if (isOfflineError(err)) {
        setDocFormError('Sem conexão, tente novamente.');
      } else {
        setDocFormError('Falha ao enviar o documento PDF. Verifique as regras do Firestore e tente novamente.');
      }
    } finally {
      setUploadingDoc(false);
    }
  };

  const fetchDocBlob = async (d: DocumentoRecord): Promise<Blob> => {
    if (!d.storagePath || d.storageMode === 'firestore') {
      const chunkSnap = await getDocs(
        query(
          collection(db, 'documentos', d.id, 'chunks'),
          where('empresaId', '==', empresa.empresaId)
        )
      );
      if (chunkSnap.empty) {
        throw new Error('Conteúdo do PDF não encontrado');
      }
      const ordered = chunkSnap.docs
        .map((c) => c.data() as { index: number; data: string })
        .sort((a, b) => a.index - b.index)
        .map((c) => c.data);
      return base64ChunksToPdfBlob(ordered);
    }

    try {
      return await getBlob(ref(storage, d.storagePath));
    } catch {
      const res = await fetch(d.downloadUrl);
      if (!res.ok) throw new Error('Falha ao baixar arquivo');
      return await res.blob();
    }
  };

  const handleDownloadDocumentoBlob = async (d: DocumentoRecord) => {
    if (isOffline || !navigator.onLine) {
      showToast('error', 'Sem conexão, tente novamente.');
      return;
    }
    setDownloadingDocId(d.id);
    try {
      const blob = await fetchDocBlob(d);
      downloadBlob(blob, d.fileName);
    } catch {
      showToast('error', 'Não foi possível baixar o PDF no momento.');
    } finally {
      setDownloadingDocId(null);
    }
  };

  const handlePreviewDocumento = async (d: DocumentoRecord) => {
    if (isOffline || !navigator.onLine) {
      showToast('error', 'Sem conexão, tente novamente.');
      return;
    }
    setDownloadingDocId(d.id);
    try {
      const blob = await fetchDocBlob(d);
      const url = URL.createObjectURL(new Blob([blob], { type: 'application/pdf' }));
      setPreviewDoc({ doc: d, blobUrl: url });
    } catch {
      showToast('error', 'Não foi possível carregar a visualização do PDF.');
    } finally {
      setDownloadingDocId(null);
    }
  };

  const closePreviewModal = () => {
    if (previewDoc?.blobUrl) {
      URL.revokeObjectURL(previewDoc.blobUrl);
    }
    setPreviewDoc(null);
  };

  const handleDeleteDocumento = async (d: DocumentoRecord) => {
    if (isOffline || !navigator.onLine) {
      showToast('error', 'Sem conexão, tente novamente.');
      return;
    }
    try {
      if (d.storagePath) {
        try {
          await deleteObject(ref(storage, d.storagePath));
        } catch {
          // Ignora caso já removido
        }
      }
      const chunkSnap = await getDocs(
        query(
          collection(db, 'documentos', d.id, 'chunks'),
          where('empresaId', '==', empresa.empresaId)
        )
      );
      const batch = writeBatch(db);
      chunkSnap.forEach((c) => batch.delete(c.ref));
      batch.delete(doc(db, 'documentos', d.id));
      await batch.commit();

      await registrarAtividade('Documento excluído', `${d.titulo} (${d.fileName})`, d.clienteId);
      showToast('success', 'Documento excluído.');
    } catch (err) {
      if (isOfflineError(err)) {
        showToast('error', 'Sem conexão, tente novamente.');
      } else {
        handleFirestoreError(err, OperationType.DELETE, `documentos/${d.id}`);
      }
    }
  };

  // === Chamados ===
  const [chamadoFilter, setChamadoFilter] = useState<'Todos' | StatusChamado>('Todos');
  const [chamadoSearch, setChamadoSearch] = useState('');
  const [selectedChamado, setSelectedChamado] = useState<ChamadoRecord | null>(null);
  const [chamadoResposta, setChamadoResposta] = useState('');
  const [chamadoStatus, setChamadoStatus] = useState<StatusChamado>('Em Andamento');
  const [savingChamado, setSavingChamado] = useState(false);

  const filteredChamados = useMemo(() => {
    const q = chamadoSearch.trim().toLowerCase();
    return chamados.filter((c) => {
      if (chamadoFilter !== 'Todos' && c.status !== chamadoFilter) return false;
      if (!q) return true;
      return (
        c.titulo.toLowerCase().includes(q) ||
        c.clienteNome.toLowerCase().includes(q) ||
        c.mensagem.toLowerCase().includes(q)
      );
    });
  }, [chamados, chamadoFilter, chamadoSearch]);

  const handleSaveChamadoResposta = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedChamado) return;
    if (isOffline || !navigator.onLine) {
      showToast('error', 'Sem conexão, tente novamente.');
      return;
    }
    setSavingChamado(true);
    try {
      const trimmedResposta = chamadoResposta.trim();
      const respostaChanged = trimmedResposta !== (selectedChamado.resposta || '');
      const nextRespondidoEm =
        trimmedResposta.length === 0
          ? null
          : respostaChanged || !selectedChamado.respondidoEm
          ? serverTimestamp()
          : selectedChamado.respondidoEm;

      await updateDoc(doc(db, 'chamados', selectedChamado.id), {
        status: chamadoStatus,
        resposta: trimmedResposta,
        respondidoEm: nextRespondidoEm,
        updatedAt: serverTimestamp(),
      });

      await registrarAtividade(
        'Chamado atualizado',
        `${selectedChamado.titulo} — Status: ${chamadoStatus}`,
        selectedChamado.clienteId
      );

      setSelectedChamado(null);
      showToast('success', 'Chamado atualizado com sucesso.');
    } catch (err) {
      if (isOfflineError(err)) {
        showToast('error', 'Sem conexão, tente novamente.');
      } else {
        handleFirestoreError(err, OperationType.UPDATE, `chamados/${selectedChamado.id}`);
      }
    } finally {
      setSavingChamado(false);
    }
  };

  // === Relatório ===
  const [relStartDate, setRelStartDate] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 3);
    return d.toISOString().slice(0, 10);
  });
  const [relEndDate, setRelEndDate] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() + 3);
    return d.toISOString().slice(0, 10);
  });

  const applyDatePreset = (preset: 'month' | '3months' | 'year' | 'all') => {
    const now = new Date();
    if (preset === 'all') {
      setRelStartDate('');
      setRelEndDate('');
      return;
    }
    if (preset === 'month') {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      setRelStartDate(start.toISOString().slice(0, 10));
      setRelEndDate(end.toISOString().slice(0, 10));
      return;
    }
    if (preset === '3months') {
      const start = new Date(now);
      start.setMonth(start.getMonth() - 3);
      const end = new Date(now);
      end.setMonth(end.getMonth() + 1);
      setRelStartDate(start.toISOString().slice(0, 10));
      setRelEndDate(end.toISOString().slice(0, 10));
      return;
    }
    const start = new Date(now.getFullYear(), 0, 1);
    const end = new Date(now.getFullYear(), 11, 31);
    setRelStartDate(start.toISOString().slice(0, 10));
    setRelEndDate(end.toISOString().slice(0, 10));
  };

  const relatorioData = useMemo(() => {
    const inPeriod = boletos.filter((b) => {
      if (relStartDate && b.vencimento < relStartDate) return false;
      if (relEndDate && b.vencimento > relEndDate) return false;
      return true;
    });

    let recebido = 0;
    let pendente = 0;
    let vencido = 0;
    const debtByClient = new Map<
      string,
      { clienteId: string; nome: string; whatsapp: string; totalDevido: number; qtdBoletos: number }
    >();

    for (const b of inPeriod) {
      const st = getEffectiveBoletoStatus(b);
      if (st === 'Pago') {
        recebido += b.valor;
      } else {
        if (st === 'Vencido') vencido += b.valor;
        else pendente += b.valor;

        const existing = debtByClient.get(b.clienteId) || {
          clienteId: b.clienteId,
          nome: b.clienteNome,
          whatsapp: b.clienteWhatsapp,
          totalDevido: 0,
          qtdBoletos: 0,
        };
        existing.totalDevido += b.valor;
        existing.qtdBoletos += 1;
        debtByClient.set(b.clienteId, existing);
      }
    }

    const maioresDevedores = Array.from(debtByClient.values()).sort(
      (a, b) => b.totalDevido - a.totalDevido
    );

    return {
      totalBoletos: inPeriod.length,
      recebido,
      pendente,
      vencido,
      maioresDevedores,
    };
  }, [boletos, relStartDate, relEndDate]);

  const handleExportBackupCsv = () => {
    const header = 'Tipo,Nome/Cliente,Email/Descricao,WhatsApp/Valor,Vencimento,Status\n';
    const cliRows = clientes.map(
      (c) =>
        `"Cliente","${c.nome.replace(/"/g, '""')}","${c.email}","${c.whatsapp}","","Ativo"`
    );
    const bolRows = boletos.map(
      (b) =>
        `"Boleto","${b.clienteNome.replace(/"/g, '""')}","${b.descricao.replace(/"/g, '""')}","${b.valor.toFixed(2)}","${b.vencimento}","${getEffectiveBoletoStatus(b)}"`
    );
    const csv = header + [...cliRows, ...bolRows].join('\n');
    downloadBlob(
      new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' }),
      `backup-portal-${getTodayISO()}.csv`
    );
    showToast('success', 'Backup CSV exportado com sucesso.');
  };

  // === Configurações / Exclusão LGPD da Empresa ===
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [cfgNome, setCfgNome] = useState(empresa.nome);
  const [cfgWhatsapp, setCfgWhatsapp] = useState(empresa.whatsapp);
  const [cfgPix, setCfgPix] = useState(empresa.pixChave);
  const [savingSettings, setSavingSettings] = useState(false);

  const [showDeleteEmpresaModal, setShowDeleteEmpresaModal] = useState(false);
  const [deleteEmpPassword, setDeleteEmpPassword] = useState('');
  const [deletingEmpresa, setDeletingEmpresa] = useState(false);
  const [deleteEmpError, setDeleteEmpError] = useState<string | null>(null);

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isOffline || !navigator.onLine) {
      showToast('error', 'Sem conexão, tente novamente.');
      return;
    }
    setSavingSettings(true);
    try {
      await updateDoc(doc(db, 'empresas', empresa.empresaId), {
        nome: cfgNome.trim(),
        whatsapp: cfgWhatsapp.trim(),
        pixChave: cfgPix.trim() || empresa.email,
        updatedAt: serverTimestamp(),
      });
      await registrarAtividade('Configurações atualizadas', 'Dados da empresa e Chave PIX atualizados.');
      setShowSettingsModal(false);
      showToast('success', 'Dados da empresa salvos.');
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `empresas/${empresa.empresaId}`);
    } finally {
      setSavingSettings(false);
    }
  };

  const handleDeleteEmpresaAccount = async () => {
    setDeleteEmpError(null);
    if (isOffline || !navigator.onLine) {
      setDeleteEmpError('Sem conexão, tente novamente.');
      return;
    }
    const user = auth.currentUser;
    if (!user) return;
    setDeletingEmpresa(true);
    try {
      if (deleteEmpPassword && user.email) {
        const cred = EmailAuthProvider.credential(user.email, deleteEmpPassword);
        await reauthenticateWithCredential(user, cred);
      }

      const refsToDelete = [];
      for (const d of documentos) {
        if (d.storagePath) {
          try {
            await deleteObject(ref(storage, d.storagePath));
          } catch {
            // Ignora se já removido
          }
        }
        const chunkSnap = await getDocs(
          query(
            collection(db, 'documentos', d.id, 'chunks'),
            where('empresaId', '==', empresa.empresaId)
          )
        );
        chunkSnap.forEach((c) => refsToDelete.push(c.ref));
        refsToDelete.push(doc(db, 'documentos', d.id));
      }

      boletos.forEach((b) => refsToDelete.push(doc(db, 'boletos', b.id)));
      chamados.forEach((c) => refsToDelete.push(doc(db, 'chamados', c.id)));
      clientes.forEach((c) => refsToDelete.push(doc(db, 'clientes', c.clienteId)));
      atividades.forEach((a) => refsToDelete.push(doc(db, 'atividades', a.id)));
      refsToDelete.push(doc(db, 'empresas', empresa.empresaId));

      for (let i = 0; i < refsToDelete.length; i += 400) {
        const batch = writeBatch(db);
        refsToDelete.slice(i, i + 400).forEach((r) => batch.delete(r));
        await batch.commit();
      }

      await deleteUser(user);
      onAccountDeleted('Dados apagados conforme LGPD.');
    } catch (err) {
      const code = (err as { code?: string })?.code || '';
      if (code === 'auth/requires-recent-login') {
        setDeleteEmpError('Por segurança, digite sua senha atual abaixo para confirmar a exclusão.');
      } else if (code === 'auth/wrong-password' || code === 'auth/invalid-credential') {
        setDeleteEmpError('Senha incorreta.');
      } else {
        setDeleteEmpError('Não foi possível excluir os dados. Tente novamente.');
      }
    } finally {
      setDeletingEmpresa(false);
    }
  };

  const navItems: { id: EmpresaTab; label: string; mobileLabel: string; icon: React.ReactNode }[] = [
    { id: 'dashboard', label: 'Dashboard', mobileLabel: 'Início', icon: <LayoutDashboard className="w-5 h-5" /> },
    { id: 'clientes', label: 'Clientes', mobileLabel: 'Clientes', icon: <Users className="w-5 h-5" /> },
    { id: 'boletos', label: 'Boletos', mobileLabel: 'Boletos', icon: <Receipt className="w-5 h-5" /> },
    { id: 'documentos', label: 'Documentos', mobileLabel: 'Docs', icon: <FileText className="w-5 h-5" /> },
    { id: 'chamados', label: 'Chamados', mobileLabel: 'Suporte', icon: <MessageSquare className="w-5 h-5" /> },
    { id: 'relatorio', label: 'Relatório', mobileLabel: 'Relatório', icon: <BarChart3 className="w-5 h-5" /> },
  ];

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-slate-100">
      {/* Sidebar Desktop */}
      <aside className="hidden md:flex md:w-64 md:flex-col md:fixed md:inset-y-0 bg-slate-900 text-white border-r border-slate-800 z-30">
        <div className="px-6 h-16 flex items-center border-b border-slate-800">
          <span className="font-display text-lg font-bold tracking-tight truncate">
            Portal do Cliente
          </span>
        </div>

        <div className="px-4 py-4 border-b border-slate-800">
          <p className="text-xs text-slate-400">Empresa conectada</p>
          <p className="text-sm font-semibold text-white truncate">{empresa.nome}</p>
          <p className="text-xs text-slate-400 truncate">{empresa.email}</p>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id)}
                className={`w-full min-h-[44px] flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-colors ${
                  active
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <span className="flex items-center gap-3">
                  {item.icon}
                  <span className="whitespace-nowrap">{item.label}</span>
                </span>
                {item.id === 'chamados' && metrics.chamadosAbertos > 0 && (
                  <span className="text-xs font-mono tabular-nums px-1.5 py-0.5 rounded bg-slate-800 text-slate-200">
                    {metrics.chamadosAbertos}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        <div className="p-3 border-t border-slate-800 space-y-1.5">
          <button
            type="button"
            onClick={() => {
              setCfgNome(empresa.nome);
              setCfgWhatsapp(empresa.whatsapp);
              setCfgPix(empresa.pixChave);
              setShowSettingsModal(true);
            }}
            className="w-full min-h-[42px] flex items-center gap-2.5 px-3.5 py-2 rounded-xl text-sm font-medium text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
          >
            <Settings className="w-4 h-4" />
            <span>Dados e PIX</span>
          </button>

          <button
            type="button"
            onClick={() => signOut(auth)}
            className="w-full min-h-[44px] flex items-center gap-2.5 px-3.5 py-2 rounded-xl text-sm font-semibold text-red-300 hover:bg-red-950/50 hover:text-red-200 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            <span>SAIR</span>
          </button>
        </div>
      </aside>

      {/* Conteúdo Principal */}
      <div className="flex-1 md:pl-64 flex flex-col min-h-screen pb-20 md:pb-0">
        <header className="sticky top-0 z-20 bg-white/95 backdrop-blur-md border-b border-slate-200 h-14 md:h-16 px-4 sm:px-6 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <h1 className="font-display text-base sm:text-xl font-bold text-slate-900 truncate">
              {navItems.find((n) => n.id === activeTab)?.label}
            </h1>
            <span className="hidden sm:inline text-slate-300" aria-hidden="true">·</span>
            <span className="hidden sm:inline text-sm text-slate-500 truncate">{empresa.nome}</span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => {
                setCfgNome(empresa.nome);
                setCfgWhatsapp(empresa.whatsapp);
                setCfgPix(empresa.pixChave);
                setShowSettingsModal(true);
              }}
              aria-label="Configurações da empresa"
              className="md:hidden min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl border border-slate-200 text-slate-700"
            >
              <Settings className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => signOut(auth)}
              className="md:hidden min-h-[40px] px-3 py-1.5 rounded-xl bg-slate-900 text-white text-xs font-semibold inline-flex items-center gap-1.5"
            >
              <LogOut className="w-3.5 h-3.5" />
              SAIR
            </button>

            <button
              type="button"
              onClick={() => {
                if (activeTab === 'boletos') {
                  if (clientes.length > 0 && !bolClienteId) setBolClienteId(clientes[0].clienteId);
                  setShowNewBoletoModal(true);
                } else if (activeTab === 'documentos') {
                  if (clientes.length > 0 && !docClienteId) setDocClienteId(clientes[0].clienteId);
                  setDocFormError(null);
                  setShowNewDocModal(true);
                } else {
                  setCliFormError(null);
                  setCliTempPass(generateTemporaryPassword());
                  setShowNewClienteModal(true);
                }
              }}
              className="hidden md:inline-flex min-h-[40px] items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold transition-colors whitespace-nowrap"
            >
              <Plus className="w-4 h-4" />
              {activeTab === 'boletos'
                ? 'Novo Boleto'
                : activeTab === 'documentos'
                ? 'Enviar Documento'
                : 'Cadastrar Cliente'}
            </button>
          </div>
        </header>

        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.16 }}
            className="max-w-7xl w-full mx-auto px-4 sm:px-6 pt-4"
          >
            <div
              className={`p-3.5 rounded-xl border text-sm font-medium flex items-center justify-between gap-3 shadow-sm ${
                toast.type === 'success'
                  ? 'bg-green-50 border-green-200 text-green-800'
                  : 'bg-red-50 border-red-200 text-red-700'
              }`}
            >
              <span className="flex items-center gap-2">
                {toast.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                )}
                {toast.text}
              </span>
              <button type="button" onClick={() => setToast(null)} className="text-current opacity-70 hover:opacity-100">
                <X className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        )}

        <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 space-y-6">
          {loadingData && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-28 rounded-2xl bg-white border border-slate-200 animate-pulse" />
              ))}
            </div>
          )}

          {/* === ABA DASHBOARD === */}
          {!loadingData && activeTab === 'dashboard' && (
            <motion.div
              key="tab-dashboard"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.18 }}
              className="space-y-6"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-5 flex flex-col justify-between">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-slate-500">Total de Clientes</p>
                    <Users className="w-4 h-4 text-slate-400" />
                  </div>
                  <p className="text-2xl sm:text-3xl font-bold text-slate-900 tabular-nums mt-2">
                    {metrics.totalClientes}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">Ativos no portal</p>
                </div>

                <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-5 flex flex-col justify-between">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-slate-500">Total a Receber</p>
                    <Receipt className="w-4 h-4 text-blue-600" />
                  </div>
                  <p className="text-2xl font-bold text-blue-600 tabular-nums mt-2">
                    {formatCurrencyBRL(metrics.totalReceber)}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">Pendentes e vencidos</p>
                </div>

                <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-5 flex flex-col justify-between">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-slate-500">Total Recebido</p>
                    <CheckCircle2 className="w-4 h-4 text-green-600" />
                  </div>
                  <p className="text-2xl font-bold text-green-600 tabular-nums mt-2">
                    {formatCurrencyBRL(metrics.totalRecebido)}
                  </p>
                  <p className="text-xs text-slate-500 mt-1 tabular-nums">
                    {metrics.countPago} boleto(s) pago(s)
                  </p>
                </div>

                <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-5 flex flex-col justify-between">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-slate-500">Total Vencido</p>
                    <AlertCircle className="w-4 h-4 text-red-600" />
                  </div>
                  <p className="text-2xl font-bold text-red-600 tabular-nums mt-2">
                    {formatCurrencyBRL(metrics.totalVencido)}
                  </p>
                  <p className="text-xs text-slate-500 mt-1 tabular-nums">
                    {metrics.countVencido} em atraso
                  </p>
                </div>

                <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-5 flex flex-col justify-between">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-slate-500">Clientes Inadimplentes</p>
                    <Users className="w-4 h-4 text-red-600" />
                  </div>
                  <p className="text-2xl sm:text-3xl font-bold text-red-600 tabular-nums mt-2">
                    {metrics.inadimplentesCount}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">Com boleto vencido</p>
                </div>
              </div>

              {/* Barra de Eficiência de Recebimento */}
              <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-green-50 text-green-600 flex items-center justify-center shrink-0">
                    <TrendingUp className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-900">Taxa de Recebimento sobre Faturamento</p>
                    <p className="text-xs text-slate-500 tabular-nums">
                      {formatCurrencyBRL(metrics.totalRecebido)} recebidos de {formatCurrencyBRL(metrics.totalEmitido)} emitidos
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 w-full sm:w-64">
                  <div className="flex-1 h-2.5 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      style={{ width: `${metrics.taxaRecebimento}%` }}
                      className="h-full bg-green-600 rounded-full transition-all duration-300"
                    />
                  </div>
                  <span className="text-sm font-bold font-mono text-slate-900 tabular-nums w-12 text-right">
                    {metrics.taxaRecebimento}%
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                <div className="lg:col-span-8">
                  <RecebimentosChart boletos={boletos} />
                </div>

                <div className="lg:col-span-4 bg-white border border-slate-200 rounded-2xl shadow-sm p-5 sm:p-6 flex flex-col">
                  <h3 className="text-base sm:text-lg font-bold text-slate-900 mb-1">
                    Registro de Ações
                  </h3>
                  <p className="text-xs text-slate-500 mb-4">
                    Data e hora auditáveis de cada movimentação
                  </p>

                  {atividades.length === 0 ? (
                    <p className="text-sm text-slate-500 py-8 text-center">
                      Nenhuma movimentação registrada ainda.
                    </p>
                  ) : (
                    <div className="divide-y divide-slate-100 overflow-y-auto max-h-64 pr-1">
                      {atividades.slice(0, 8).map((a) => (
                        <div key={a.id} className="py-2.5">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-semibold text-slate-900 truncate">
                              {a.acao}
                            </span>
                            <span className="text-[11px] font-mono text-slate-500 tabular-nums shrink-0">
                              {formatTimestampBR(a.createdAt)}
                            </span>
                          </div>
                          <p className="text-xs text-slate-600 mt-0.5 line-clamp-2">{a.detalhe}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}

          {/* === ABA CLIENTES === */}
          {activeTab === 'clientes' && (
            <motion.div
              key="tab-clientes"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.18 }}
              className="space-y-4"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="relative flex-1 max-w-md">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={clienteSearch}
                    onChange={(e) => setClienteSearch(e.target.value)}
                    placeholder="Buscar cliente por nome, e-mail ou WhatsApp..."
                    className="w-full min-h-[44px] pl-10 pr-4 py-2 rounded-xl bg-white border border-slate-200 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setCliFormError(null);
                    setCliTempPass(generateTemporaryPassword());
                    setShowNewClienteModal(true);
                  }}
                  className="min-h-[46px] px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm inline-flex items-center justify-center gap-2 whitespace-nowrap shadow-sm"
                >
                  <Plus className="w-4 h-4" />
                  Cadastrar
                </button>
              </div>

              {filteredClientes.length === 0 ? (
                <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center space-y-3">
                  <Users className="w-10 h-10 text-slate-300 mx-auto" />
                  <p className="text-base font-semibold text-slate-800">
                    Nenhum cliente encontrado
                  </p>
                  <p className="text-sm text-slate-500 max-w-md mx-auto">
                    Cadastre seus clientes informando apenas Nome completo, WhatsApp e E-mail. O acesso será criado automaticamente com senha temporária.
                  </p>
                  <button
                    type="button"
                    onClick={() => setShowNewClienteModal(true)}
                    className="min-h-[44px] px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm inline-flex items-center gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    Cadastrar primeiro cliente
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {filteredClientes.map((c) => (
                    <div
                      key={c.clienteId}
                      className="bg-white border border-slate-200 rounded-2xl shadow-sm hover:shadow-md transition-shadow p-5 flex flex-col justify-between gap-4"
                    >
                      <div className="space-y-1">
                        <h3 className="text-base font-bold text-slate-900">{c.nome}</h3>
                        <p className="text-sm text-slate-600 font-mono">{c.whatsapp}</p>
                        <p className="text-sm text-slate-600 truncate">{c.email}</p>
                        <p className="text-xs text-slate-400 tabular-nums pt-1">
                          Cadastrado em {formatTimestampBR(c.createdAt)}
                        </p>
                      </div>

                      <div className="flex flex-wrap gap-2 pt-3 border-t border-slate-100">
                        <button
                          type="button"
                          onClick={() => setDetailCliente(c)}
                          className="min-h-[42px] px-3.5 py-2 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs sm:text-sm font-semibold inline-flex items-center gap-1.5"
                        >
                          <Eye className="w-4 h-4" />
                          Ver Detalhes
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingCliente(c);
                            setEditCliNome(c.nome);
                            setEditCliWhatsapp(c.whatsapp);
                            setEditCliEmail(c.email);
                          }}
                          className="min-h-[42px] px-3.5 py-2 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs sm:text-sm font-semibold inline-flex items-center gap-1.5"
                        >
                          <Edit3 className="w-4 h-4" />
                          Editar
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteCliente(c)}
                          className="min-h-[42px] px-3.5 py-2 rounded-xl border border-red-200 bg-red-50 text-red-700 hover:bg-red-100 text-xs sm:text-sm font-semibold inline-flex items-center gap-1.5 ml-auto"
                        >
                          <Trash2 className="w-4 h-4" />
                          Excluir dados
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          )}

          {/* === ABA BOLETOS === */}
          {activeTab === 'boletos' && (
            <motion.div
              key="tab-boletos"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.18 }}
              className="space-y-4"
            >
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                <div className="flex flex-col sm:flex-row sm:items-center gap-3 flex-1">
                  <div className="flex items-center gap-1 p-1 bg-white border border-slate-200 rounded-xl overflow-x-auto w-fit max-w-full">
                    {([
                      { id: 'Todos', count: boletos.length },
                      { id: 'Pendente', count: metrics.countPendente },
                      { id: 'Vencido', count: metrics.countVencido },
                      { id: 'Pago', count: metrics.countPago },
                    ] as const).map((st) => (
                      <button
                        key={st.id}
                        type="button"
                        onClick={() => setBoletoFilter(st.id)}
                        className={`min-h-[38px] px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition-colors whitespace-nowrap tabular-nums ${
                          boletoFilter === st.id
                            ? 'bg-slate-900 text-white'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        {st.id} ({st.count})
                      </button>
                    ))}
                  </div>

                  <div className="relative flex-1 max-w-xs">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={boletoSearch}
                      onChange={(e) => setBoletoSearch(e.target.value)}
                      placeholder="Buscar por cliente ou descrição..."
                      className="w-full min-h-[44px] pl-10 pr-4 py-2 rounded-xl bg-white border border-slate-200 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
                    />
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    if (clientes.length > 0 && !bolClienteId) {
                      setBolClienteId(clientes[0].clienteId);
                    }
                    setShowNewBoletoModal(true);
                  }}
                  className="min-h-[46px] px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm inline-flex items-center justify-center gap-2 whitespace-nowrap shadow-sm"
                >
                  <Plus className="w-4 h-4" />
                  Cadastrar Boleto
                </button>
              </div>

              {filteredBoletos.length === 0 ? (
                <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center space-y-3">
                  <Receipt className="w-10 h-10 text-slate-300 mx-auto" />
                  <p className="text-base font-semibold text-slate-800">
                    Nenhum boleto encontrado neste filtro
                  </p>
                  <p className="text-sm text-slate-500">
                    Cadastre boletos vinculados a um cliente para gerar cobrança PIX e lembretes no WhatsApp.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredBoletos.map((b) => {
                    const effectiveStatus = getEffectiveBoletoStatus(b);
                    const waMessage = `Olá ${b.clienteNome}, tudo bem? Segue o lembrete do seu boleto referente a "${b.descricao}" no valor de ${formatCurrencyBRL(
                      b.valor
                    )} com vencimento em ${formatDateBR(b.vencimento)}. Chave PIX: ${b.pixChave}. Código PIX Copia e Cola: ${b.codigoPix}`;

                    return (
                      <div
                        key={b.id}
                        className="bg-white border border-slate-200 rounded-2xl shadow-sm hover:shadow-md transition-shadow p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4"
                      >
                        <div className="space-y-1.5 min-w-0">
                          <div className="flex flex-wrap items-center gap-2.5">
                            <h3 className="text-base font-bold text-slate-900">{b.clienteNome}</h3>
                            <BoletoStatusBadge status={effectiveStatus} />
                          </div>
                          <p className="text-sm text-slate-700">{b.descricao}</p>
                          <div className="flex flex-wrap items-center gap-3 text-xs sm:text-sm text-slate-500 tabular-nums">
                            <span className="font-bold text-slate-900 text-base">
                              {formatCurrencyBRL(b.valor)}
                            </span>
                            <span aria-hidden="true">·</span>
                            <span>Vencimento: {formatDateBR(b.vencimento)}</span>
                            {effectiveStatus === 'Pago' && b.pagoEm && (
                              <>
                                <span aria-hidden="true">·</span>
                                <span className="text-green-700 font-medium">
                                  Pago em {formatTimestampBR(b.pagoEm)}
                                </span>
                              </>
                            )}
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 shrink-0">
                          {effectiveStatus !== 'Pago' && (
                            <>
                              <button
                                type="button"
                                onClick={() => handleMarkBoletoPaid(b)}
                                className="min-h-[44px] px-4 py-2 rounded-xl bg-green-600 hover:bg-green-700 text-white text-xs sm:text-sm font-semibold inline-flex items-center gap-1.5 whitespace-nowrap"
                              >
                                <CheckCircle2 className="w-4 h-4" />
                                Marcar como Pago
                              </button>

                              <button
                                type="button"
                                onClick={() => {
                                  setEditingBoleto(b);
                                  setEditBolDescricao(b.descricao);
                                  setEditBolValor(String(b.valor));
                                  setEditBolVencimento(b.vencimento);
                                  setEditBolStatus(b.status === 'Vencido' ? 'Vencido' : 'Pendente');
                                }}
                                className="min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs sm:text-sm font-semibold inline-flex items-center gap-1.5 whitespace-nowrap"
                              >
                                <Edit3 className="w-4 h-4" />
                                Editar
                              </button>
                            </>
                          )}

                          <a
                            href={buildWhatsAppUrl(b.clienteWhatsapp, waMessage)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="min-h-[44px] px-4 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-800 text-xs sm:text-sm font-semibold inline-flex items-center gap-1.5 whitespace-nowrap"
                          >
                            <Send className="w-4 h-4 text-green-600" />
                            Enviar Lembrete no WhatsApp
                          </a>

                          <button
                            type="button"
                            onClick={() => handleDeleteBoleto(b)}
                            className="min-h-[44px] px-3.5 py-2 rounded-xl border border-red-200 bg-red-50 hover:bg-red-100 text-red-700 text-xs sm:text-sm font-semibold inline-flex items-center gap-1.5"
                          >
                            <Trash2 className="w-4 h-4" />
                            Excluir
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </motion.div>
          )}

          {/* === ABA DOCUMENTOS === */}
          {activeTab === 'documentos' && (
            <motion.div
              key="tab-documentos"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.18 }}
              className="space-y-4"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="relative flex-1 max-w-md">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={docSearch}
                    onChange={(e) => setDocSearch(e.target.value)}
                    placeholder="Buscar documento por título, cliente ou PDF..."
                    className="w-full min-h-[44px] pl-10 pr-4 py-2 rounded-xl bg-white border border-slate-200 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>

                <button
                  type="button"
                  onClick={() => {
                    if (clientes.length > 0 && !docClienteId) {
                      setDocClienteId(clientes[0].clienteId);
                    }
                    setDocFormError(null);
                    setShowNewDocModal(true);
                  }}
                  className="min-h-[46px] px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm inline-flex items-center justify-center gap-2 whitespace-nowrap shadow-sm"
                >
                  <Upload className="w-4 h-4" />
                  ENVIAR DOCUMENTO
                </button>
              </div>

              {filteredDocumentos.length === 0 ? (
                <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center space-y-3">
                  <FileText className="w-10 h-10 text-slate-300 mx-auto" />
                  <p className="text-base font-semibold text-slate-800">
                    Nenhum documento encontrado
                  </p>
                  <p className="text-sm text-slate-500">
                    Envie contratos, notas ou comprovantes em PDF diretamente para a pasta privada do cliente.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {filteredDocumentos.map((d) => (
                    <div
                      key={d.id}
                      className="bg-white border border-slate-200 rounded-2xl shadow-sm hover:shadow-md transition-shadow p-5 flex flex-col justify-between gap-4"
                    >
                      <div className="space-y-1.5">
                        <div className="flex items-start justify-between gap-2">
                          <h3 className="text-base font-bold text-slate-900">{d.titulo}</h3>
                          <span className="text-xs font-mono text-slate-500 shrink-0 tabular-nums">
                            {formatFileSize(d.fileSize)}
                          </span>
                        </div>
                        <p className="text-sm font-medium text-blue-600">{d.clienteNome}</p>
                        {d.descricao && <p className="text-sm text-slate-600">{d.descricao}</p>}
                        <p className="text-xs font-mono text-slate-500 truncate pt-1">
                          {d.fileName} · {formatTimestampBR(d.createdAt)}
                        </p>
                      </div>

                      <div className="flex flex-wrap gap-2 pt-3 border-t border-slate-100">
                        <button
                          type="button"
                          disabled={downloadingDocId === d.id}
                          onClick={() => handlePreviewDocumento(d)}
                          className="min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-800 text-xs sm:text-sm font-semibold inline-flex items-center gap-1.5 whitespace-nowrap"
                        >
                          <Eye className="w-4 h-4" />
                          Visualizar
                        </button>

                        <button
                          type="button"
                          disabled={downloadingDocId === d.id}
                          onClick={() => handleDownloadDocumentoBlob(d)}
                          className="min-h-[44px] flex-1 px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:opacity-60 text-white text-xs sm:text-sm font-semibold inline-flex items-center justify-center gap-2 whitespace-nowrap"
                        >
                          <Download className="w-4 h-4" />
                          {downloadingDocId === d.id ? 'Baixando...' : 'Baixar PDF Real'}
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDeleteDocumento(d)}
                          className="min-h-[44px] px-3.5 py-2 rounded-xl border border-red-200 bg-red-50 hover:bg-red-100 text-red-700 text-xs sm:text-sm font-semibold inline-flex items-center gap-1.5"
                        >
                          <Trash2 className="w-4 h-4" />
                          Excluir
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          )}

          {/* === ABA CHAMADOS === */}
          {activeTab === 'chamados' && (
            <motion.div
              key="tab-chamados"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.18 }}
              className="space-y-4"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-1 p-1 bg-white border border-slate-200 rounded-xl w-fit overflow-x-auto max-w-full">
                  {(['Todos', 'Aberto', 'Em Andamento', 'Resolvido'] as const).map((st) => (
                    <button
                      key={st}
                      type="button"
                      onClick={() => setChamadoFilter(st)}
                      className={`min-h-[38px] px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition-colors whitespace-nowrap ${
                        chamadoFilter === st
                          ? 'bg-slate-900 text-white'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {st}
                    </button>
                  ))}
                </div>

                <div className="relative flex-1 max-w-xs">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={chamadoSearch}
                    onChange={(e) => setChamadoSearch(e.target.value)}
                    placeholder="Buscar chamado ou cliente..."
                    className="w-full min-h-[44px] pl-10 pr-4 py-2 rounded-xl bg-white border border-slate-200 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>
              </div>

              {filteredChamados.length === 0 ? (
                <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center space-y-2">
                  <MessageSquare className="w-10 h-10 text-slate-300 mx-auto" />
                  <p className="text-base font-semibold text-slate-800">
                    Nenhum chamado encontrado
                  </p>
                  <p className="text-sm text-slate-500">
                    Os chamados abertos pelos clientes aparecerão aqui em tempo real.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredChamados.map((ch) => (
                    <div
                      key={ch.id}
                      className="bg-white border border-slate-200 rounded-2xl shadow-sm p-5 space-y-3"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-2.5">
                          <h3 className="text-base font-bold text-slate-900">{ch.titulo}</h3>
                          <ChamadoStatusBadge status={ch.status} />
                        </div>
                        <span className="text-xs font-mono text-slate-500 tabular-nums">
                          {ch.clienteNome} · {formatTimestampBR(ch.createdAt)}
                        </span>
                      </div>

                      <p className="text-sm text-slate-700 leading-relaxed">{ch.mensagem}</p>

                      {ch.resposta && (
                        <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-sm">
                          <p className="text-xs font-semibold text-slate-500 mb-1">
                            Resposta da empresa ({formatTimestampBR(ch.respondidoEm)}):
                          </p>
                          <p className="text-slate-800">{ch.resposta}</p>
                        </div>
                      )}

                      {ch.status !== 'Resolvido' && (
                        <div className="pt-1 flex justify-end">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedChamado(ch);
                              setChamadoResposta(ch.resposta || '');
                              setChamadoStatus(ch.status === 'Aberto' ? 'Em Andamento' : ch.status);
                            }}
                            className="min-h-[42px] px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs sm:text-sm font-semibold"
                          >
                            Responder / Atualizar Status
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          )}

          {/* === ABA RELATÓRIO === */}
          {activeTab === 'relatorio' && (
            <motion.div
              key="tab-relatorio"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.18 }}
              className="space-y-6"
            >
              <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-5 space-y-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-semibold text-slate-500 mr-1">Período rápido:</span>
                  <button
                    type="button"
                    onClick={() => applyDatePreset('month')}
                    className="min-h-[36px] px-3 py-1 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    Este mês
                  </button>
                  <button
                    type="button"
                    onClick={() => applyDatePreset('3months')}
                    className="min-h-[36px] px-3 py-1 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    Últimos 3 meses
                  </button>
                  <button
                    type="button"
                    onClick={() => applyDatePreset('year')}
                    className="min-h-[36px] px-3 py-1 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    Este ano
                  </button>
                  <button
                    type="button"
                    onClick={() => applyDatePreset('all')}
                    className="min-h-[36px] px-3 py-1 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    Todo o período
                  </button>
                </div>

                <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 flex-1 max-w-xl">
                    <div>
                      <label htmlFor="rel-start" className="block text-xs font-semibold text-slate-600 mb-1.5">
                        Data Inicial (Vencimento)
                      </label>
                      <div className="relative">
                        <Calendar className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                          id="rel-start"
                          type="date"
                          value={relStartDate}
                          onChange={(e) => setRelStartDate(e.target.value)}
                          className="w-full min-h-[44px] pl-9 pr-3 py-2 rounded-xl border border-slate-300 text-sm font-mono tabular-nums"
                        />
                      </div>
                    </div>
                    <div>
                      <label htmlFor="rel-end" className="block text-xs font-semibold text-slate-600 mb-1.5">
                        Data Final (Vencimento)
                      </label>
                      <div className="relative">
                        <Calendar className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                          id="rel-end"
                          type="date"
                          value={relEndDate}
                          onChange={(e) => setRelEndDate(e.target.value)}
                          className="w-full min-h-[44px] pl-9 pr-3 py-2 rounded-xl border border-slate-300 text-sm font-mono tabular-nums"
                        />
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleExportBackupCsv}
                    className="min-h-[44px] px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold inline-flex items-center justify-center gap-2 whitespace-nowrap"
                  >
                    <FileSpreadsheet className="w-4 h-4" />
                    Exportar Backup CSV
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-5">
                  <p className="text-xs font-semibold text-slate-500">Total Recebido no Período</p>
                  <p className="text-2xl font-bold text-green-600 tabular-nums mt-1">
                    {formatCurrencyBRL(relatorioData.recebido)}
                  </p>
                </div>
                <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-5">
                  <p className="text-xs font-semibold text-slate-500">Total Pendente no Período</p>
                  <p className="text-2xl font-bold text-blue-600 tabular-nums mt-1">
                    {formatCurrencyBRL(relatorioData.pendente)}
                  </p>
                </div>
                <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-5">
                  <p className="text-xs font-semibold text-slate-500">Total Vencido no Período</p>
                  <p className="text-2xl font-bold text-red-600 tabular-nums mt-1">
                    {formatCurrencyBRL(relatorioData.vencido)}
                  </p>
                </div>
              </div>

              <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-200">
                  <h3 className="text-base font-bold text-slate-900">
                    Clientes que mais devem no período
                  </h3>
                </div>

                {relatorioData.maioresDevedores.length === 0 ? (
                  <p className="p-8 text-center text-sm text-slate-500">
                    Nenhum saldo em aberto encontrado para o intervalo de datas selecionado.
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                          <th className="py-3 px-6">Cliente</th>
                          <th className="py-3 px-4">WhatsApp</th>
                          <th className="py-3 px-4 text-right">Boletos em Aberto</th>
                          <th className="py-3 px-6 text-right">Total Devido</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-sm">
                        {relatorioData.maioresDevedores.map((item) => (
                          <tr key={item.clienteId} className="hover:bg-slate-50">
                            <td className="py-3.5 px-6 font-semibold text-slate-900">{item.nome}</td>
                            <td className="py-3.5 px-4 font-mono text-slate-600">{item.whatsapp}</td>
                            <td className="py-3.5 px-4 text-right font-mono tabular-nums text-slate-700">
                              {item.qtdBoletos}
                            </td>
                            <td className="py-3.5 px-6 text-right font-bold text-red-600 tabular-nums">
                              {formatCurrencyBRL(item.totalDevido)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </main>

        <Footer
          onOpenPrivacy={onOpenPrivacy}
          showEmpresaNotice={true}
          onRequestDelete={() => setShowDeleteEmpresaModal(true)}
        />
      </div>

      {/* Bottom Tab Bar Mobile */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-white/95 backdrop-blur-md border-t border-slate-200 grid grid-cols-6 h-16 pb-safe">
        {navItems.map((item) => {
          const active = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveTab(item.id)}
              className={`flex flex-col items-center justify-center gap-0.5 text-[10px] font-semibold transition-colors ${
                active ? 'text-blue-600' : 'text-slate-500'
              }`}
            >
              {item.icon}
              <span className="truncate max-w-full px-1">{item.mobileLabel}</span>
            </button>
          );
        })}
      </nav>

      {/* === MODAL: CADASTRAR CLIENTE === */}
      {showNewClienteModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/60 backdrop-blur-sm p-0 sm:p-4">
          <div className="bg-white w-full sm:max-w-lg rounded-t-3xl sm:rounded-2xl border border-slate-200 shadow-xl overflow-hidden max-h-[92vh] flex flex-col">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900">Cadastrar Novo Cliente</h2>
              <button
                type="button"
                onClick={() => setShowNewClienteModal(false)}
                className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateCliente} className="p-6 overflow-y-auto space-y-4">
              {cliFormError && (
                <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{cliFormError}</span>
                </div>
              )}

              <div>
                <label className="block text-sm font-semibold text-slate-800 mb-1">Nome completo</label>
                <input
                  type="text"
                  required
                  value={cliNome}
                  onChange={(e) => setCliNome(e.target.value)}
                  placeholder="Ex: Maria Oliveira"
                  className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-300 text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-800 mb-1">WhatsApp</label>
                <input
                  type="tel"
                  required
                  value={cliWhatsapp}
                  onChange={(e) => setCliWhatsapp(formatWhatsappInput(e.target.value))}
                  placeholder="(11) 98888-7777"
                  className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-300 text-sm font-mono"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-800 mb-1">E-mail</label>
                <input
                  type="email"
                  required
                  value={cliEmail}
                  onChange={(e) => setCliEmail(e.target.value)}
                  placeholder="cliente@email.com"
                  className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-300 text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-800 mb-1">
                  Senha temporária gerada automaticamente
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    readOnly
                    value={cliTempPass}
                    className="flex-1 min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-300 bg-slate-50 font-mono text-sm text-slate-900"
                  />
                  <button
                    type="button"
                    onClick={() => setCliTempPass(generateTemporaryPassword())}
                    className="min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-50 text-xs font-semibold inline-flex items-center gap-1.5"
                  >
                    <RefreshCw className="w-4 h-4" />
                    Gerar outra
                  </button>
                </div>
              </div>

              <label className="flex items-start gap-3 p-3.5 rounded-xl border border-slate-200 bg-slate-50 cursor-pointer">
                <input
                  type="checkbox"
                  checked={cliLgpdConsent}
                  onChange={(e) => setCliLgpdConsent(e.target.checked)}
                  className="mt-1 w-4 h-4 rounded border-slate-300 text-blue-600 shrink-0"
                />
                <span className="text-xs sm:text-sm text-slate-700 leading-snug">
                  Concordo que meus dados sejam usados apenas para envio de boletos, documentos e atendimento.
                </span>
              </label>

              <div className="flex gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setShowNewClienteModal(false)}
                  className="flex-1 min-h-[46px] rounded-xl border border-slate-200 text-slate-700 font-semibold text-sm"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingCliente}
                  className="flex-1 min-h-[46px] rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-semibold text-sm"
                >
                  {savingCliente ? 'Salvando...' : 'Salvar Cliente'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* === MODAL: SENHA TEMPORÁRIA DO CLIENTE CRIADO === */}
      {createdClientCreds && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white max-w-md w-full rounded-2xl border border-slate-200 shadow-xl p-6 space-y-4">
            <div className="flex items-center gap-2.5 text-green-700">
              <CheckCircle2 className="w-6 h-6 text-green-600" />
              <h2 className="text-lg font-bold text-slate-900">Conta do Cliente Criada</h2>
            </div>
            <p className="text-sm text-slate-600">
              Envie os dados de acesso abaixo para <strong>{createdClientCreds.nome}</strong> entrar no Portal do Cliente:
            </p>
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2 text-sm font-mono">
              <p>
                <span className="text-slate-500">E-mail:</span>{' '}
                <strong className="text-slate-900">{createdClientCreds.email}</strong>
              </p>
              <p>
                <span className="text-slate-500">Senha temporária:</span>{' '}
                <strong className="text-blue-600">{createdClientCreds.senhaTemporaria}</strong>
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-2.5">
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(
                    `Portal do Cliente (${empresa.nome})\nE-mail: ${createdClientCreds.email}\nSenha temporária: ${createdClientCreds.senhaTemporaria}`
                  );
                  setCopiedCreds(true);
                  setTimeout(() => setCopiedCreds(false), 2500);
                }}
                className="flex-1 min-h-[44px] px-4 py-2 rounded-xl border border-slate-300 text-slate-800 text-sm font-semibold inline-flex items-center justify-center gap-2"
              >
                {copiedCreds ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
                {copiedCreds ? 'Copiado!' : 'Copiar Acesso'}
              </button>
              <a
                href={buildWhatsAppUrl(
                  createdClientCreds.whatsapp,
                  `Olá ${createdClientCreds.nome}! Seu acesso ao Portal do Cliente (${empresa.nome}) foi criado.\nE-mail: ${createdClientCreds.email}\nSenha temporária: ${createdClientCreds.senhaTemporaria}`
                )}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 min-h-[44px] px-4 py-2 rounded-xl bg-green-600 hover:bg-green-700 text-white text-sm font-semibold inline-flex items-center justify-center gap-2"
              >
                <Send className="w-4 h-4" />
                Enviar WhatsApp
              </a>
            </div>
            <button
              type="button"
              onClick={() => setCreatedClientCreds(null)}
              className="w-full min-h-[44px] rounded-xl bg-slate-900 text-white font-semibold text-sm"
            >
              Fechar
            </button>
          </div>
        </div>
      )}

      {/* === MODAL: EDITAR CLIENTE === */}
      {editingCliente && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white max-w-md w-full rounded-2xl border border-slate-200 shadow-xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900">Editar Cliente</h2>
              <button type="button" onClick={() => setEditingCliente(null)}>
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>
            <form onSubmit={handleUpdateCliente} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-800 mb-1">Nome completo</label>
                <input
                  type="text"
                  required
                  value={editCliNome}
                  onChange={(e) => setEditCliNome(e.target.value)}
                  className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-300 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-800 mb-1">WhatsApp</label>
                <input
                  type="tel"
                  required
                  value={editCliWhatsapp}
                  onChange={(e) => setEditCliWhatsapp(formatWhatsappInput(e.target.value))}
                  className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-300 text-sm font-mono"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-800 mb-1">E-mail de contato</label>
                <input
                  type="email"
                  required
                  value={editCliEmail}
                  onChange={(e) => setEditCliEmail(e.target.value)}
                  className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-300 text-sm"
                />
              </div>
              <div className="flex gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingCliente(null)}
                  className="flex-1 min-h-[44px] rounded-xl border border-slate-200 text-slate-700 font-semibold text-sm"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingCliente}
                  className="flex-1 min-h-[44px] rounded-xl bg-blue-600 text-white font-semibold text-sm"
                >
                  {savingCliente ? 'Salvando...' : 'Salvar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* === MODAL: DETALHES DO CLIENTE === */}
      {detailCliente && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white max-w-lg w-full rounded-2xl border border-slate-200 shadow-xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="text-lg font-bold text-slate-900">Detalhes do Cliente</h2>
              <button type="button" onClick={() => setDetailCliente(null)}>
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>

            <div className="space-y-2 text-sm">
              <p><strong className="text-slate-700">Nome:</strong> {detailCliente.nome}</p>
              <p><strong className="text-slate-700">WhatsApp:</strong> <span className="font-mono">{detailCliente.whatsapp}</span></p>
              <p><strong className="text-slate-700">E-mail:</strong> {detailCliente.email}</p>
              <p className="text-xs text-slate-500 flex items-center gap-1.5 pt-1">
                <ShieldCheck className="w-4 h-4 text-green-600" />
                Consentimento LGPD registrado em {formatTimestampBR(detailCliente.lgpdConsentAt)}
              </p>
            </div>

            <div className="grid grid-cols-3 gap-3 pt-2 border-t border-slate-100 text-center">
              <div className="p-3 rounded-xl bg-slate-50">
                <p className="text-xs text-slate-500">Boletos</p>
                <p className="text-lg font-bold text-slate-900 tabular-nums">
                  {boletos.filter((b) => b.clienteId === detailCliente.clienteId).length}
                </p>
              </div>
              <div className="p-3 rounded-xl bg-slate-50">
                <p className="text-xs text-slate-500">Documentos</p>
                <p className="text-lg font-bold text-slate-900 tabular-nums">
                  {documentos.filter((d) => d.clienteId === detailCliente.clienteId).length}
                </p>
              </div>
              <div className="p-3 rounded-xl bg-slate-50">
                <p className="text-xs text-slate-500">Chamados</p>
                <p className="text-lg font-bold text-slate-900 tabular-nums">
                  {chamados.filter((c) => c.clienteId === detailCliente.clienteId).length}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setDetailCliente(null)}
              className="w-full min-h-[44px] rounded-xl bg-slate-900 text-white font-semibold text-sm"
            >
              Fechar
            </button>
          </div>
        </div>
      )}

      {/* === MODAL: CONFIRMAR EXCLUSÃO DO CLIENTE === */}
      {confirmDeleteCliente && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white max-w-md w-full rounded-2xl border border-slate-200 shadow-xl p-6 space-y-4">
            <h2 className="text-lg font-bold text-slate-900">Excluir dados do cliente?</h2>
            <p className="text-sm text-slate-600">
              Tem certeza? Isso apagará permanentemente os dados, boletos, documentos PDF e chamados de{' '}
              <strong>{confirmDeleteCliente.nome}</strong> conforme a LGPD.
            </p>
            <div className="flex gap-2.5">
              <button
                type="button"
                onClick={() => setConfirmDeleteCliente(null)}
                className="flex-1 min-h-[44px] rounded-xl border border-slate-200 text-slate-700 font-semibold text-sm"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={deletingCliente}
                onClick={handleDeleteClienteData}
                className="flex-1 min-h-[44px] rounded-xl bg-red-600 hover:bg-red-700 text-white font-semibold text-sm"
              >
                {deletingCliente ? 'Apagando...' : 'Excluir dados'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* === MODAL: CADASTRAR BOLETO === */}
      {showNewBoletoModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/60 backdrop-blur-sm p-0 sm:p-4">
          <div className="bg-white w-full sm:max-w-lg rounded-t-3xl sm:rounded-2xl border border-slate-200 shadow-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900">Cadastrar Boleto</h2>
              <button type="button" onClick={() => setShowNewBoletoModal(false)}>
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>
            <form onSubmit={handleCreateBoleto} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-800 mb-1">Cliente</label>
                <select
                  required
                  value={bolClienteId}
                  onChange={(e) => setBolClienteId(e.target.value)}
                  className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-300 text-sm bg-white"
                >
                  <option value="">Selecione um cliente...</option>
                  {clientes.map((c) => (
                    <option key={c.clienteId} value={c.clienteId}>
                      {c.nome} ({c.email})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-semibold text-slate-800 mb-1">Valor (R$)</label>
                  <input
                    type="text"
                    required
                    value={bolValor}
                    onChange={(e) => setBolValor(e.target.value)}
                    placeholder="250.00"
                    className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-300 text-sm font-mono tabular-nums"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-800 mb-1">Vencimento</label>
                  <input
                    type="date"
                    required
                    value={bolVencimento}
                    onChange={(e) => setBolVencimento(e.target.value)}
                    className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-300 text-sm font-mono tabular-nums"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-800 mb-1">Descrição</label>
                <input
                  type="text"
                  required
                  maxLength={240}
                  value={bolDescricao}
                  onChange={(e) => setBolDescricao(e.target.value)}
                  placeholder="Ex: Mensalidade Novembro/2026"
                  className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-300 text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-800 mb-1">Status inicial</label>
                <select
                  value={bolStatus}
                  onChange={(e) => setBolStatus(e.target.value as StatusBoleto)}
                  className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-300 text-sm bg-white"
                >
                  <option value="Pendente">Pendente</option>
                  <option value="Vencido">Vencido</option>
                  <option value="Pago">Pago</option>
                </select>
              </div>

              <div className="flex gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setShowNewBoletoModal(false)}
                  className="flex-1 min-h-[46px] rounded-xl border border-slate-200 text-slate-700 font-semibold text-sm"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingBoleto || clientes.length === 0}
                  className="flex-1 min-h-[46px] rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-semibold text-sm"
                >
                  {savingBoleto ? 'Salvando...' : 'Salvar Boleto'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* === MODAL: EDITAR BOLETO === */}
      {editingBoleto && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/60 backdrop-blur-sm p-0 sm:p-4">
          <div className="bg-white w-full sm:max-w-lg rounded-t-3xl sm:rounded-2xl border border-slate-200 shadow-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900">Editar Boleto</h2>
              <button type="button" onClick={() => setEditingBoleto(null)}>
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>
            <form onSubmit={handleUpdateBoleto} className="p-6 space-y-4">
              <p className="text-sm text-slate-600">
                Cliente: <strong className="text-slate-900">{editingBoleto.clienteNome}</strong>
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-semibold text-slate-800 mb-1">Valor (R$)</label>
                  <input
                    type="text"
                    required
                    value={editBolValor}
                    onChange={(e) => setEditBolValor(e.target.value)}
                    className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-300 text-sm font-mono tabular-nums"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-800 mb-1">Vencimento</label>
                  <input
                    type="date"
                    required
                    value={editBolVencimento}
                    onChange={(e) => setEditBolVencimento(e.target.value)}
                    className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-300 text-sm font-mono tabular-nums"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-800 mb-1">Descrição</label>
                <input
                  type="text"
                  required
                  maxLength={240}
                  value={editBolDescricao}
                  onChange={(e) => setEditBolDescricao(e.target.value)}
                  className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-300 text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-800 mb-1">Status</label>
                <select
                  value={editBolStatus}
                  onChange={(e) => setEditBolStatus(e.target.value as 'Pendente' | 'Vencido')}
                  className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-300 text-sm bg-white"
                >
                  <option value="Pendente">Pendente</option>
                  <option value="Vencido">Vencido</option>
                </select>
              </div>

              <div className="flex gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingBoleto(null)}
                  className="flex-1 min-h-[46px] rounded-xl border border-slate-200 text-slate-700 font-semibold text-sm"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingBoleto}
                  className="flex-1 min-h-[46px] rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-semibold text-sm"
                >
                  {savingBoleto ? 'Salvando...' : 'Salvar Alterações'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* === MODAL: ENVIAR DOCUMENTO PDF === */}
      {showNewDocModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/60 backdrop-blur-sm p-0 sm:p-4">
          <div className="bg-white w-full sm:max-w-lg rounded-t-3xl sm:rounded-2xl border border-slate-200 shadow-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900">Enviar Documento PDF</h2>
              <button type="button" onClick={() => setShowNewDocModal(false)}>
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>
            <form onSubmit={handleUploadDocumento} className="p-6 space-y-4">
              {docFormError && (
                <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{docFormError}</span>
                </div>
              )}

              <div>
                <label className="block text-sm font-semibold text-slate-800 mb-1">Selecionar cliente</label>
                <select
                  required
                  value={docClienteId}
                  onChange={(e) => setDocClienteId(e.target.value)}
                  className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-300 text-sm bg-white"
                >
                  <option value="">Selecione um cliente...</option>
                  {clientes.map((c) => (
                    <option key={c.clienteId} value={c.clienteId}>
                      {c.nome}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-800 mb-1">Título</label>
                <input
                  type="text"
                  required
                  maxLength={160}
                  value={docTitulo}
                  onChange={(e) => setDocTitulo(e.target.value)}
                  placeholder="Ex: Contrato de Prestação de Serviços"
                  className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-300 text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-800 mb-1">Descrição</label>
                <textarea
                  rows={2}
                  maxLength={400}
                  value={docDescricao}
                  onChange={(e) => setDocDescricao(e.target.value)}
                  placeholder="Observações sobre o documento (opcional)"
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-sm"
                />
              </div>

              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDraggingPdf(true);
                }}
                onDragLeave={() => setIsDraggingPdf(false)}
                onDrop={handleDropPdf}
                className={`rounded-xl border-2 border-dashed p-4 text-center transition-colors ${
                  isDraggingPdf
                    ? 'border-blue-600 bg-blue-50'
                    : 'border-blue-300 bg-blue-50/40'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="application/pdf,.pdf"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full min-h-[46px] px-4 py-2 rounded-xl text-blue-700 font-semibold text-sm inline-flex items-center justify-center gap-2"
                >
                  <Upload className="w-4 h-4" />
                  ESCOLHER PDF (ou arraste aqui)
                </button>
                {docFile && (
                  <p className="mt-1.5 text-xs sm:text-sm font-medium text-green-700">
                    Arquivo selecionado: {docFile.name} ({formatFileSize(docFile.size)})
                  </p>
                )}
              </div>

              <div className="flex gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setShowNewDocModal(false)}
                  className="flex-1 min-h-[46px] rounded-xl border border-slate-200 text-slate-700 font-semibold text-sm"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={uploadingDoc || clientes.length === 0}
                  className="flex-1 min-h-[46px] rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-semibold text-sm"
                >
                  {uploadingDoc ? 'Enviando PDF...' : 'Enviar Documento'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* === MODAL: RESPONDER CHAMADO === */}
      {selectedChamado && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/60 backdrop-blur-sm p-0 sm:p-4">
          <div className="bg-white w-full sm:max-w-lg rounded-t-3xl sm:rounded-2xl border border-slate-200 shadow-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900">Atender Chamado</h2>
              <button type="button" onClick={() => setSelectedChamado(null)}>
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>
            <form onSubmit={handleSaveChamadoResposta} className="p-6 space-y-4">
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-sm space-y-1">
                <p className="font-bold text-slate-900">{selectedChamado.titulo}</p>
                <p className="text-slate-600">{selectedChamado.mensagem}</p>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-800 mb-1">Status</label>
                <select
                  value={chamadoStatus}
                  onChange={(e) => setChamadoStatus(e.target.value as StatusChamado)}
                  className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-300 text-sm bg-white"
                >
                  <option value="Aberto">Aberto</option>
                  <option value="Em Andamento">Em Andamento</option>
                  <option value="Resolvido">Resolvido</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-800 mb-1">Resposta para o cliente</label>
                <textarea
                  rows={4}
                  maxLength={1500}
                  value={chamadoResposta}
                  onChange={(e) => setChamadoResposta(e.target.value)}
                  placeholder="Escreva a orientação ou solução..."
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-sm"
                />
              </div>

              <div className="flex gap-2.5">
                <button
                  type="button"
                  onClick={() => setSelectedChamado(null)}
                  className="flex-1 min-h-[44px] rounded-xl border border-slate-200 text-slate-700 font-semibold text-sm"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingChamado}
                  className="flex-1 min-h-[44px] rounded-xl bg-blue-600 text-white font-semibold text-sm"
                >
                  {savingChamado ? 'Salvando...' : 'Salvar Resposta'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* === MODAL: CONFIGURAÇÕES DA EMPRESA === */}
      {showSettingsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white max-w-md w-full rounded-2xl border border-slate-200 shadow-xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900">Dados da Empresa e Chave PIX</h2>
              <button type="button" onClick={() => setShowSettingsModal(false)}>
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>
            <form onSubmit={handleSaveSettings} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-800 mb-1">Nome da Empresa</label>
                <input
                  type="text"
                  required
                  value={cfgNome}
                  onChange={(e) => setCfgNome(e.target.value)}
                  className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-300 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-800 mb-1">WhatsApp</label>
                <input
                  type="tel"
                  required
                  value={cfgWhatsapp}
                  onChange={(e) => setCfgWhatsapp(formatWhatsappInput(e.target.value))}
                  className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-300 text-sm font-mono"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-800 mb-1">Chave PIX</label>
                <input
                  type="text"
                  required
                  value={cfgPix}
                  onChange={(e) => setCfgPix(e.target.value)}
                  className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-300 text-sm font-mono"
                />
              </div>
              <div className="flex gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setShowSettingsModal(false)}
                  className="flex-1 min-h-[44px] rounded-xl border border-slate-200 text-slate-700 font-semibold text-sm"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingSettings}
                  className="flex-1 min-h-[44px] rounded-xl bg-slate-900 text-white font-semibold text-sm"
                >
                  {savingSettings ? 'Salvando...' : 'Salvar Dados'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* === MODAL: EXCLUIR CONTA DA EMPRESA (LGPD) === */}
      {showDeleteEmpresaModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white max-w-md w-full rounded-2xl border border-slate-200 shadow-xl p-6 space-y-4">
            <h2 className="text-lg font-bold text-slate-900">Excluir meus dados (LGPD)</h2>
            <p className="text-sm text-slate-600">
              Tem certeza? Essa ação não pode ser desfeita. Todos os registros da empresa, clientes, boletos e PDFs vinculados serão apagados do Firestore e do Auth.
            </p>
            {deleteEmpError && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs sm:text-sm">
                {deleteEmpError}
              </div>
            )}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Confirme sua senha (recomendado)
              </label>
              <input
                type="password"
                value={deleteEmpPassword}
                onChange={(e) => setDeleteEmpPassword(e.target.value)}
                placeholder="Sua senha atual"
                className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-300 text-sm"
              />
            </div>
            <div className="flex gap-2.5">
              <button
                type="button"
                onClick={() => setShowDeleteEmpresaModal(false)}
                className="flex-1 min-h-[44px] rounded-xl border border-slate-200 text-slate-700 font-semibold text-sm"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={deletingEmpresa}
                onClick={handleDeleteEmpresaAccount}
                className="flex-1 min-h-[44px] rounded-xl bg-red-600 hover:bg-red-700 text-white font-semibold text-sm"
              >
                {deletingEmpresa ? 'Excluindo...' : 'Confirmar Exclusão'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* === MODAL: VISUALIZAR PDF IN-APP === */}
      <PdfPreviewModal
        open={Boolean(previewDoc)}
        title={previewDoc?.doc.titulo || ''}
        fileName={previewDoc?.doc.fileName || ''}
        blobUrl={previewDoc?.blobUrl || null}
        onClose={closePreviewModal}
        onDownload={() => previewDoc && handleDownloadDocumentoBlob(previewDoc.doc)}
      />
    </div>
  );
};
