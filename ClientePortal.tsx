import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import {
  Receipt,
  FileText,
  MessageSquare,
  User,
  LogOut,
  QrCode,
  Download,
  Copy,
  Check,
  Plus,
  Edit3,
  Trash2,
  ShieldCheck,
  AlertCircle,
  CheckCircle2,
  X,
  Eye,
  Search,
} from 'lucide-react';
import {
  collection,
  query,
  where,
  onSnapshot,
  doc,
  addDoc,
  updateDoc,
  serverTimestamp,
  writeBatch,
  getDocs,
} from 'firebase/firestore';
import {
  deleteUser,
  EmailAuthProvider,
  reauthenticateWithCredential,
  signOut,
} from 'firebase/auth';
import { ref, getBlob, deleteObject } from 'firebase/storage';
import {
  auth,
  db,
  storage,
  handleFirestoreError,
  OperationType,
  isOfflineError,
} from '../firebase';
import type {
  BoletoRecord,
  ChamadoRecord,
  ClienteProfile,
  DocumentoRecord,
  StatusBoleto,
} from '../types';
import {
  downloadBlob,
  formatCurrencyBRL,
  formatDateBR,
  formatFileSize,
  formatTimestampBR,
  formatWhatsappInput,
  generateBoletoPdfBlob,
  getEffectiveBoletoStatus,
  base64ChunksToPdfBlob,
} from '../utils/formatters';
import { BoletoStatusBadge, ChamadoStatusBadge } from './StatusLabel';
import { PdfPreviewModal } from './PdfPreviewModal';
import { Footer } from './Footer';

type ClienteTab = 'boletos' | 'documentos' | 'chamados' | 'perfil';

interface ClientePortalProps {
  cliente: ClienteProfile;
  onOpenPrivacy: () => void;
  onAccountDeleted: (message: string) => void;
  isOffline: boolean;
}

export const ClientePortal: React.FC<ClientePortalProps> = ({
  cliente,
  onOpenPrivacy,
  onAccountDeleted,
  isOffline,
}) => {
  const [activeTab, setActiveTab] = useState<ClienteTab>('boletos');

  const [boletos, setBoletos] = useState<BoletoRecord[]>([]);
  const [documentos, setDocumentos] = useState<DocumentoRecord[]>([]);
  const [chamados, setChamados] = useState<ChamadoRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const [toast, setToast] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const showToast = (type: 'success' | 'error', text: string) => {
    setToast({ type, text });
    setTimeout(() => {
      setToast((prev) => (prev?.text === text ? null : prev));
    }, 5000);
  };

  useEffect(() => {
    const cliUid = cliente.clienteId;
    setLoading(true);

    const qBoletos = query(collection(db, 'boletos'), where('clienteId', '==', cliUid));
    const qDocs = query(collection(db, 'documentos'), where('clienteId', '==', cliUid));
    const qChamados = query(collection(db, 'chamados'), where('clienteId', '==', cliUid));

    const unsubBoletos = onSnapshot(
      qBoletos,
      (snap) => {
        const rows = snap.docs.map((d) => ({ ...(d.data() as Omit<BoletoRecord, 'id'>), id: d.id }));
        rows.sort((a, b) => (b.vencimento || '').localeCompare(a.vencimento || ''));
        setBoletos(rows);
        setLoading(false);
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

    return () => {
      unsubBoletos();
      unsubDocs();
      unsubChamados();
    };
  }, [cliente.clienteId]);

  // === Resumo e Filtros de Boletos ===
  const [boletoFilter, setBoletoFilter] = useState<'Todos' | StatusBoleto>('Todos');
  const [pixBoleto, setPixBoleto] = useState<BoletoRecord | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [copiedPixKey, setCopiedPixKey] = useState(false);

  const boletosSummary = useMemo(() => {
    let emAberto = 0;
    let totalPago = 0;
    let qtdVencidos = 0;
    for (const b of boletos) {
      const st = getEffectiveBoletoStatus(b);
      if (st === 'Pago') {
        totalPago += b.valor;
      } else {
        emAberto += b.valor;
        if (st === 'Vencido') qtdVencidos += 1;
      }
    }
    return { emAberto, totalPago, qtdVencidos };
  }, [boletos]);

  const filteredBoletos = useMemo(() => {
    if (boletoFilter === 'Todos') return boletos;
    return boletos.filter((b) => getEffectiveBoletoStatus(b) === boletoFilter);
  }, [boletos, boletoFilter]);

  const handleCopyCode = async (id: string, code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedId(id);
      showToast('success', 'Código PIX copiado para a área de transferência.');
      setTimeout(() => setCopiedId((curr) => (curr === id ? null : curr)), 2500);
    } catch {
      showToast('error', 'Não foi possível copiar automaticamente. Selecione o código no modal.');
    }
  };

  const handleDownloadBoletoPdf = (b: BoletoRecord) => {
    const pdfBlob = generateBoletoPdfBlob(b);
    downloadBlob(pdfBlob, `boleto-${b.id.slice(0, 8)}.pdf`);
    showToast('success', 'Boleto PDF gerado e baixado.');
  };

  // === Documentos ===
  const [docSearch, setDocSearch] = useState('');
  const [downloadingDocId, setDownloadingDocId] = useState<string | null>(null);
  const [previewDoc, setPreviewDoc] = useState<{
    doc: DocumentoRecord;
    blobUrl: string;
  } | null>(null);

  const filteredDocumentos = useMemo(() => {
    const q = docSearch.trim().toLowerCase();
    if (!q) return documentos;
    return documentos.filter(
      (d) =>
        d.titulo.toLowerCase().includes(q) ||
        d.fileName.toLowerCase().includes(q) ||
        d.descricao.toLowerCase().includes(q)
    );
  }, [documentos, docSearch]);

  const fetchDocBlob = async (d: DocumentoRecord): Promise<Blob> => {
    if (!d.storagePath || d.storageMode === 'firestore') {
      const chunkSnap = await getDocs(
        query(
          collection(db, 'documentos', d.id, 'chunks'),
          where('clienteId', '==', cliente.clienteId)
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
      if (!res.ok) throw new Error('Erro ao baixar PDF');
      return await res.blob();
    }
  };

  const handleDownloadDoc = async (d: DocumentoRecord) => {
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

  const handlePreviewDoc = async (d: DocumentoRecord) => {
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
      showToast('error', 'Não foi possível visualizar este PDF no momento.');
    } finally {
      setDownloadingDocId(null);
    }
  };

  const closePreviewDoc = () => {
    if (previewDoc?.blobUrl) {
      URL.revokeObjectURL(previewDoc.blobUrl);
    }
    setPreviewDoc(null);
  };

  // === Chamados ===
  const [showNewChamadoModal, setShowNewChamadoModal] = useState(false);
  const [chTitulo, setChTitulo] = useState('');
  const [chMensagem, setChMensagem] = useState('');
  const [savingChamado, setSavingChamado] = useState(false);

  const handleCreateChamado = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isOffline || !navigator.onLine) {
      showToast('error', 'Sem conexão, tente novamente.');
      return;
    }
    if (!chTitulo.trim() || !chMensagem.trim()) {
      showToast('error', 'Preencha o título e a mensagem do chamado.');
      return;
    }
    setSavingChamado(true);
    try {
      await addDoc(collection(db, 'chamados'), {
        empresaId: cliente.empresaId,
        clienteId: cliente.clienteId,
        clienteNome: cliente.nome,
        titulo: chTitulo.trim(),
        mensagem: chMensagem.trim(),
        status: 'Aberto',
        resposta: '',
        respondidoEm: null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      try {
        await addDoc(collection(db, 'atividades'), {
          empresaId: cliente.empresaId,
          clienteId: cliente.clienteId,
          actorUid: cliente.clienteId,
          acao: 'Chamado aberto pelo cliente',
          detalhe: `${chTitulo.trim()} — ${cliente.nome}`,
          createdAt: serverTimestamp(),
        });
      } catch {
        // Log secundário
      }

      setShowNewChamadoModal(false);
      setChTitulo('');
      setChMensagem('');
      showToast('success', 'Chamado aberto com sucesso!');
    } catch (err) {
      if (isOfflineError(err)) {
        showToast('error', 'Sem conexão, tente novamente.');
      } else {
        handleFirestoreError(err, OperationType.CREATE, 'chamados');
      }
    } finally {
      setSavingChamado(false);
    }
  };

  // === Meu Perfil & LGPD Erasure ===
  const [editingProfile, setEditingProfile] = useState(false);
  const [profNome, setProfNome] = useState(cliente.nome);
  const [profWhatsapp, setProfWhatsapp] = useState(cliente.whatsapp);
  const [profEmail, setProfEmail] = useState(cliente.email);
  const [savingProfile, setSavingProfile] = useState(false);

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [needReauth, setNeedReauth] = useState(false);
  const [deletingAll, setDeletingAll] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isOffline || !navigator.onLine) {
      showToast('error', 'Sem conexão, tente novamente.');
      return;
    }
    setSavingProfile(true);
    try {
      await updateDoc(doc(db, 'clientes', cliente.clienteId), {
        nome: profNome.trim(),
        whatsapp: profWhatsapp.trim(),
        email: profEmail.trim().toLowerCase(),
        updatedAt: serverTimestamp(),
      });
      try {
        await addDoc(collection(db, 'atividades'), {
          empresaId: cliente.empresaId,
          clienteId: cliente.clienteId,
          actorUid: cliente.clienteId,
          acao: 'Perfil atualizado pelo cliente',
          detalhe: `${profNome.trim()} atualizou seus dados cadastrais.`,
          createdAt: serverTimestamp(),
        });
      } catch {
        // Log secundário
      }
      setEditingProfile(false);
      showToast('success', 'Seus dados foram atualizados.');
    } catch (err) {
      if (isOfflineError(err)) {
        showToast('error', 'Sem conexão, tente novamente.');
      } else {
        handleFirestoreError(err, OperationType.UPDATE, `clientes/${cliente.clienteId}`);
      }
    } finally {
      setSavingProfile(false);
    }
  };

  const handleDeleteMyDataLgpd = async () => {
    setDeleteError(null);
    if (isOffline || !navigator.onLine) {
      setDeleteError('Sem conexão, tente novamente.');
      return;
    }
    const user = auth.currentUser;
    if (!user) return;

    setDeletingAll(true);
    try {
      if (needReauth && deletePassword && user.email) {
        const cred = EmailAuthProvider.credential(user.email, deletePassword);
        await reauthenticateWithCredential(user, cred);
      }

      const refsToDelete = [];
      for (const d of documentos) {
        if (d.storagePath) {
          try {
            await deleteObject(ref(storage, d.storagePath));
          } catch {
            // Segue caso já não exista
          }
        }
        const chunkSnap = await getDocs(
          query(
            collection(db, 'documentos', d.id, 'chunks'),
            where('clienteId', '==', cliente.clienteId)
          )
        );
        chunkSnap.forEach((c) => refsToDelete.push(c.ref));
        refsToDelete.push(doc(db, 'documentos', d.id));
      }

      boletos.forEach((b) => refsToDelete.push(doc(db, 'boletos', b.id)));
      chamados.forEach((c) => refsToDelete.push(doc(db, 'chamados', c.id)));
      const ativSnap = await getDocs(
        query(collection(db, 'atividades'), where('clienteId', '==', cliente.clienteId))
      );
      ativSnap.forEach((docSnap) => refsToDelete.push(docSnap.ref));
      refsToDelete.push(doc(db, 'clientes', cliente.clienteId));

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
        setNeedReauth(true);
        setDeleteError('Por segurança, confirme sua senha atual para concluir a exclusão.');
      } else if (code === 'auth/wrong-password' || code === 'auth/invalid-credential') {
        setDeleteError('Senha incorreta.');
      } else {
        setDeleteError('Não foi possível concluir a exclusão agora. Tente novamente.');
      }
    } finally {
      setDeletingAll(false);
    }
  };

  const navItems: { id: ClienteTab; label: string; mobileLabel: string; icon: React.ReactNode }[] = [
    { id: 'boletos', label: 'Meus Boletos', mobileLabel: 'Boletos', icon: <Receipt className="w-5 h-5" /> },
    { id: 'documentos', label: 'Meus Documentos', mobileLabel: 'Docs', icon: <FileText className="w-5 h-5" /> },
    { id: 'chamados', label: 'Meus Chamados', mobileLabel: 'Chamados', icon: <MessageSquare className="w-5 h-5" /> },
    { id: 'perfil', label: 'Meu Perfil', mobileLabel: 'Perfil', icon: <User className="w-5 h-5" /> },
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
          <p className="text-xs text-slate-400">Cliente de {cliente.empresaNome}</p>
          <p className="text-sm font-semibold text-white truncate">{cliente.nome}</p>
          <p className="text-xs text-slate-400 truncate">{cliente.email}</p>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1">
          {navItems.map((item) => {
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id)}
                className={`w-full min-h-[44px] flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-colors ${
                  active
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
              >
                {item.icon}
                <span className="whitespace-nowrap">{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="p-3 border-t border-slate-800">
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

      {/* Área Principal */}
      <div className="flex-1 md:pl-64 flex flex-col min-h-screen pb-20 md:pb-0">
        <header className="sticky top-0 z-20 bg-white/95 backdrop-blur-md border-b border-slate-200 h-14 md:h-16 px-4 sm:px-6 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <h1 className="font-display text-base sm:text-xl font-bold text-slate-900 truncate">
              {navItems.find((n) => n.id === activeTab)?.label}
            </h1>
            <span className="hidden sm:inline text-slate-300" aria-hidden="true">·</span>
            <span className="hidden sm:inline text-sm text-slate-500 truncate">
              {cliente.empresaNome}
            </span>
          </div>

          <button
            type="button"
            onClick={() => signOut(auth)}
            className="md:hidden min-h-[40px] px-3 py-1.5 rounded-xl bg-slate-900 text-white text-xs font-semibold inline-flex items-center gap-1.5"
          >
            <LogOut className="w-3.5 h-3.5" />
            SAIR
          </button>
        </header>

        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.16 }}
            className="max-w-5xl w-full mx-auto px-4 sm:px-6 pt-4"
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
              <button type="button" onClick={() => setToast(null)}>
                <X className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        )}

        <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 py-6 space-y-6">
          {loading && (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-28 rounded-2xl bg-white border border-slate-200 animate-pulse" />
              ))}
            </div>
          )}

          {/* === MEUS BOLETOS === */}
          {!loading && activeTab === 'boletos' && (
            <motion.div
              key="cli-boletos"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.18 }}
              className="space-y-4"
            >
              {boletos.length > 0 && (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-4">
                      <p className="text-xs font-semibold text-slate-500">Total em Aberto</p>
                      <p className="text-xl sm:text-2xl font-bold text-blue-600 tabular-nums mt-1">
                        {formatCurrencyBRL(boletosSummary.emAberto)}
                      </p>
                    </div>
                    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-4">
                      <p className="text-xs font-semibold text-slate-500">Total Pago</p>
                      <p className="text-xl sm:text-2xl font-bold text-green-600 tabular-nums mt-1">
                        {formatCurrencyBRL(boletosSummary.totalPago)}
                      </p>
                    </div>
                    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-4">
                      <p className="text-xs font-semibold text-slate-500">Boletos Vencidos</p>
                      <p
                        className={`text-xl sm:text-2xl font-bold tabular-nums mt-1 ${
                          boletosSummary.qtdVencidos > 0 ? 'text-red-600' : 'text-slate-900'
                        }`}
                      >
                        {boletosSummary.qtdVencidos}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 p-1 bg-white border border-slate-200 rounded-xl w-fit overflow-x-auto max-w-full">
                    {(['Todos', 'Pendente', 'Vencido', 'Pago'] as const).map((st) => (
                      <button
                        key={st}
                        type="button"
                        onClick={() => setBoletoFilter(st)}
                        className={`min-h-[38px] px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition-colors whitespace-nowrap ${
                          boletoFilter === st
                            ? 'bg-slate-900 text-white'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        {st}
                      </button>
                    ))}
                  </div>
                </>
              )}

              {filteredBoletos.length === 0 ? (
                <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center space-y-2">
                  <Receipt className="w-10 h-10 text-slate-300 mx-auto" />
                  <p className="text-base font-semibold text-slate-800">
                    {boletos.length === 0
                      ? 'Você ainda não possui boletos emitidos'
                      : 'Nenhum boleto encontrado neste filtro'}
                  </p>
                  <p className="text-sm text-slate-500">
                    Quando {cliente.empresaNome} emitir uma cobrança, ela aparecerá aqui.
                  </p>
                </div>
              ) : (
                filteredBoletos.map((b) => {
                  const status = getEffectiveBoletoStatus(b);
                  return (
                    <div
                      key={b.id}
                      className="bg-white border border-slate-200 rounded-2xl shadow-sm hover:shadow-md transition-shadow p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4"
                    >
                      <div className="space-y-1.5">
                        <div className="flex flex-wrap items-center gap-2.5">
                          <h3 className="text-base font-bold text-slate-900">{b.descricao}</h3>
                          <BoletoStatusBadge status={status} />
                        </div>
                        <div className="flex flex-wrap items-center gap-3 text-sm text-slate-600 tabular-nums">
                          <span className="text-lg font-bold text-slate-900">
                            {formatCurrencyBRL(b.valor)}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span>Vencimento: {formatDateBR(b.vencimento)}</span>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => {
                            setCopiedPixKey(false);
                            setPixBoleto(b);
                          }}
                          className="min-h-[44px] px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs sm:text-sm font-semibold inline-flex items-center gap-1.5 whitespace-nowrap shadow-sm"
                        >
                          <QrCode className="w-4 h-4" />
                          Pagar
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDownloadBoletoPdf(b)}
                          className="min-h-[44px] px-4 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-800 text-xs sm:text-sm font-semibold inline-flex items-center gap-1.5 whitespace-nowrap"
                        >
                          <Download className="w-4 h-4" />
                          Baixar Boleto
                        </button>

                        <button
                          type="button"
                          onClick={() => handleCopyCode(b.id, b.codigoPix)}
                          className="min-h-[44px] px-4 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-800 text-xs sm:text-sm font-semibold inline-flex items-center gap-1.5 whitespace-nowrap"
                        >
                          {copiedId === b.id ? (
                            <Check className="w-4 h-4 text-green-600" />
                          ) : (
                            <Copy className="w-4 h-4" />
                          )}
                          {copiedId === b.id ? 'Copiado!' : 'Copiar Código'}
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </motion.div>
          )}

          {/* === MEUS DOCUMENTOS === */}
          {!loading && activeTab === 'documentos' && (
            <motion.div
              key="cli-docs"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.18 }}
              className="space-y-4"
            >
              {documentos.length > 0 && (
                <div className="relative max-w-md">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={docSearch}
                    onChange={(e) => setDocSearch(e.target.value)}
                    placeholder="Buscar documento por título ou nome do arquivo..."
                    className="w-full min-h-[44px] pl-10 pr-4 py-2 rounded-xl bg-white border border-slate-200 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>
              )}

              {filteredDocumentos.length === 0 ? (
                <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center space-y-2">
                  <FileText className="w-10 h-10 text-slate-300 mx-auto" />
                  <p className="text-base font-semibold text-slate-800">
                    Nenhum documento disponível
                  </p>
                  <p className="text-sm text-slate-500">
                    Contratos, comprovantes e PDFs enviados pela empresa serão exibidos aqui.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {filteredDocumentos.map((d) => (
                    <div
                      key={d.id}
                      className="bg-white border border-slate-200 rounded-2xl shadow-sm hover:shadow-md transition-shadow p-5 flex flex-col justify-between gap-4"
                    >
                      <div className="space-y-1.5">
                        <div className="flex items-start justify-between gap-2">
                          <h3 className="text-base font-bold text-slate-900">{d.titulo}</h3>
                          <span className="text-xs font-mono text-slate-500 tabular-nums">
                            {formatFileSize(d.fileSize)}
                          </span>
                        </div>
                        {d.descricao && <p className="text-sm text-slate-600">{d.descricao}</p>}
                        <p className="text-xs font-mono text-slate-500 truncate">
                          {d.fileName} · {formatTimestampBR(d.createdAt)}
                        </p>
                      </div>

                      <div className="flex gap-2">
                        <button
                          type="button"
                          disabled={downloadingDocId === d.id}
                          onClick={() => handlePreviewDoc(d)}
                          className="min-h-[46px] px-4 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-800 text-sm font-semibold inline-flex items-center justify-center gap-1.5"
                        >
                          <Eye className="w-4 h-4" />
                          Visualizar
                        </button>
                        <button
                          type="button"
                          disabled={downloadingDocId === d.id}
                          onClick={() => handleDownloadDoc(d)}
                          className="flex-1 min-h-[46px] px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:opacity-60 text-white text-sm font-semibold inline-flex items-center justify-center gap-2"
                        >
                          <Download className="w-4 h-4" />
                          {downloadingDocId === d.id ? 'Baixando...' : 'BAIXAR'}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          )}

          {/* === MEUS CHAMADOS === */}
          {!loading && activeTab === 'chamados' && (
            <motion.div
              key="cli-chamados"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.18 }}
              className="space-y-4"
            >
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm text-slate-600">
                  Fale diretamente com {cliente.empresaNome}.
                </p>
                <button
                  type="button"
                  onClick={() => setShowNewChamadoModal(true)}
                  className="min-h-[46px] px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold inline-flex items-center gap-2 whitespace-nowrap shadow-sm"
                >
                  <Plus className="w-4 h-4" />
                  ABRIR CHAMADO
                </button>
              </div>

              {chamados.length === 0 ? (
                <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center space-y-2">
                  <MessageSquare className="w-10 h-10 text-slate-300 mx-auto" />
                  <p className="text-base font-semibold text-slate-800">
                    Você não possui chamados abertos
                  </p>
                  <p className="text-sm text-slate-500">
                    Clique em ABRIR CHAMADO para tirar dúvidas ou solicitar atendimento.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {chamados.map((ch) => (
                    <div
                      key={ch.id}
                      className="bg-white border border-slate-200 rounded-2xl shadow-sm p-5 space-y-3"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-2.5">
                          <h3 className="text-base font-bold text-slate-900">{ch.titulo}</h3>
                          <ChamadoStatusBadge status={ch.status} />
                        </div>
                        <span className="text-xs font-mono text-slate-500 tabular-nums">
                          {formatTimestampBR(ch.createdAt)}
                        </span>
                      </div>
                      <p className="text-sm text-slate-700 leading-relaxed">{ch.mensagem}</p>
                      {ch.resposta ? (
                        <div className="p-3.5 rounded-xl bg-blue-50 border border-blue-200 text-sm">
                          <p className="text-xs font-semibold text-blue-700 mb-1">
                            Resposta de {cliente.empresaNome} ({formatTimestampBR(ch.respondidoEm)}):
                          </p>
                          <p className="text-slate-900">{ch.resposta}</p>
                        </div>
                      ) : (
                        <p className="text-xs text-slate-400">
                          Aguardando resposta da empresa.
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          )}

          {/* === MEU PERFIL === */}
          {!loading && activeTab === 'perfil' && (
            <motion.div
              key="cli-perfil"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.18 }}
              className="space-y-6"
            >
              <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6 space-y-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
                  <div>
                    <h2 className="text-lg font-bold text-slate-900">Meus Dados Cadastrais</h2>
                    <p className="text-xs sm:text-sm text-slate-500">
                      Coletamos apenas Nome, WhatsApp e E-mail (sem CPF ou dados sensíveis).
                    </p>
                  </div>
                  {!editingProfile && (
                    <button
                      type="button"
                      onClick={() => {
                        setProfNome(cliente.nome);
                        setProfWhatsapp(cliente.whatsapp);
                        setProfEmail(cliente.email);
                        setEditingProfile(true);
                      }}
                      className="min-h-[44px] px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold inline-flex items-center justify-center gap-2 whitespace-nowrap"
                    >
                      <Edit3 className="w-4 h-4" />
                      EDITAR DADOS
                    </button>
                  )}
                </div>

                {editingProfile ? (
                  <form onSubmit={handleSaveProfile} className="space-y-4 max-w-lg">
                    <div>
                      <label className="block text-sm font-semibold text-slate-800 mb-1">Nome completo</label>
                      <input
                        type="text"
                        required
                        value={profNome}
                        onChange={(e) => setProfNome(e.target.value)}
                        className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-300 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-slate-800 mb-1">WhatsApp</label>
                      <input
                        type="tel"
                        required
                        value={profWhatsapp}
                        onChange={(e) => setProfWhatsapp(formatWhatsappInput(e.target.value))}
                        className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-300 text-sm font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-slate-800 mb-1">E-mail de contato</label>
                      <input
                        type="email"
                        required
                        value={profEmail}
                        onChange={(e) => setProfEmail(e.target.value)}
                        className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-300 text-sm"
                      />
                    </div>
                    <div className="flex gap-2.5 pt-2">
                      <button
                        type="button"
                        onClick={() => setEditingProfile(false)}
                        className="min-h-[44px] px-5 py-2 rounded-xl border border-slate-200 text-slate-700 font-semibold text-sm"
                      >
                        Cancelar
                      </button>
                      <button
                        type="submit"
                        disabled={savingProfile}
                        className="min-h-[44px] px-5 py-2 rounded-xl bg-blue-600 text-white font-semibold text-sm"
                      >
                        {savingProfile ? 'Salvando...' : 'Salvar Alterações'}
                      </button>
                    </div>
                  </form>
                ) : (
                  <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                    <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100">
                      <dt className="text-xs font-semibold text-slate-500">Nome completo</dt>
                      <dd className="text-base font-bold text-slate-900 mt-0.5">{cliente.nome}</dd>
                    </div>
                    <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100">
                      <dt className="text-xs font-semibold text-slate-500">WhatsApp</dt>
                      <dd className="text-base font-mono text-slate-900 mt-0.5">{cliente.whatsapp}</dd>
                    </div>
                    <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100">
                      <dt className="text-xs font-semibold text-slate-500">E-mail</dt>
                      <dd className="text-base text-slate-900 mt-0.5">{cliente.email}</dd>
                    </div>
                    <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100">
                      <dt className="text-xs font-semibold text-slate-500">Empresa Responsável (DPO)</dt>
                      <dd className="text-sm font-semibold text-slate-900 mt-0.5">
                        {cliente.empresaNome} ({cliente.empresaEmail})
                      </dd>
                    </div>
                  </dl>
                )}
              </div>

              <div className="bg-white border border-red-200 rounded-2xl shadow-sm p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-red-700 font-bold text-base">
                    <ShieldCheck className="w-5 h-5" />
                    <span>Direito de Exclusão (LGPD — Lei 13.709/2018)</span>
                  </div>
                  <p className="text-sm text-slate-600">
                    Você pode apagar permanentemente seu cadastro, boletos, documentos PDF e sua conta de acesso a qualquer momento.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setDeleteError(null);
                    setShowDeleteConfirm(true);
                  }}
                  className="min-h-[48px] px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-semibold text-sm inline-flex items-center justify-center gap-2 whitespace-nowrap shrink-0"
                >
                  <Trash2 className="w-4 h-4" />
                  EXCLUIR MEUS DADOS
                </button>
              </div>
            </motion.div>
          )}
        </main>

        <Footer
          onOpenPrivacy={onOpenPrivacy}
          onRequestDelete={() => {
            setDeleteError(null);
            setShowDeleteConfirm(true);
          }}
        />
      </div>

      {/* Bottom Tab Bar Mobile */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-white/95 backdrop-blur-md border-t border-slate-200 grid grid-cols-4 h-16 pb-safe">
        {navItems.map((item) => {
          const active = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveTab(item.id)}
              className={`flex flex-col items-center justify-center gap-0.5 text-[11px] font-semibold transition-colors ${
                active ? 'text-blue-600' : 'text-slate-500'
              }`}
            >
              {item.icon}
              <span>{item.mobileLabel}</span>
            </button>
          );
        })}
      </nav>

      {/* === MODAL: PAGAR VIA PIX === */}
      {pixBoleto && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/60 backdrop-blur-sm p-0 sm:p-4">
          <div className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl border border-slate-200 shadow-xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <QrCode className="w-5 h-5 text-blue-600" />
                <h2 className="text-lg font-bold text-slate-900">Pagamento via PIX</h2>
              </div>
              <button type="button" onClick={() => setPixBoleto(null)}>
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>

            <div className="space-y-1 text-sm">
              <p className="text-slate-600">{pixBoleto.descricao}</p>
              <p className="text-2xl font-bold text-slate-900 tabular-nums">
                {formatCurrencyBRL(pixBoleto.valor)}
              </p>
              <p className="text-xs text-slate-500">
                Recebedor: <strong>{pixBoleto.empresaNome}</strong> · Vencimento:{' '}
                {formatDateBR(pixBoleto.vencimento)}
              </p>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
              <p className="text-xs font-semibold text-slate-500">Chave PIX</p>
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-sm font-semibold text-slate-900 break-all">
                  {pixBoleto.pixChave}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(pixBoleto.pixChave);
                    setCopiedPixKey(true);
                    setTimeout(() => setCopiedPixKey(false), 2000);
                  }}
                  className="min-h-[38px] px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-xs font-semibold shrink-0"
                >
                  {copiedPixKey ? 'Copiada!' : 'Copiar Chave'}
                </button>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
              <p className="text-xs font-semibold text-slate-500">PIX Copia e Cola</p>
              <p className="font-mono text-xs text-slate-700 break-all select-all">
                {pixBoleto.codigoPix}
              </p>
            </div>

            <div className="flex gap-2.5">
              <button
                type="button"
                onClick={() => handleCopyCode(pixBoleto.id, pixBoleto.codigoPix)}
                className="flex-1 min-h-[46px] rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm inline-flex items-center justify-center gap-2"
              >
                <Copy className="w-4 h-4" />
                Copiar Código PIX
              </button>
              <button
                type="button"
                onClick={() => setPixBoleto(null)}
                className="min-h-[46px] px-5 rounded-xl border border-slate-200 text-slate-700 font-semibold text-sm"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* === MODAL: ABRIR CHAMADO === */}
      {showNewChamadoModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/60 backdrop-blur-sm p-0 sm:p-4">
          <div className="bg-white w-full sm:max-w-lg rounded-t-3xl sm:rounded-2xl border border-slate-200 shadow-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900">Abrir Novo Chamado</h2>
              <button type="button" onClick={() => setShowNewChamadoModal(false)}>
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>
            <form onSubmit={handleCreateChamado} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-800 mb-1">Título</label>
                <input
                  type="text"
                  required
                  maxLength={160}
                  value={chTitulo}
                  onChange={(e) => setChTitulo(e.target.value)}
                  placeholder="Ex: Dúvida sobre boleto de novembro"
                  className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-300 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-800 mb-1">Mensagem</label>
                <textarea
                  rows={4}
                  required
                  maxLength={1500}
                  value={chMensagem}
                  onChange={(e) => setChMensagem(e.target.value)}
                  placeholder="Descreva sua solicitação..."
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-sm"
                />
              </div>
              <div className="flex gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowNewChamadoModal(false)}
                  className="flex-1 min-h-[46px] rounded-xl border border-slate-200 text-slate-700 font-semibold text-sm"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingChamado}
                  className="flex-1 min-h-[46px] rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm"
                >
                  {savingChamado ? 'Enviando...' : 'Enviar Chamado'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* === MODAL: CONFIRMAR EXCLUSÃO LGPD === */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white max-w-md w-full rounded-2xl border border-slate-200 shadow-xl p-6 space-y-4">
            <h2 className="text-lg font-bold text-slate-900">Excluir meus dados</h2>
            <p className="text-sm text-slate-700 font-medium">
              Tem certeza? Essa ação não pode ser desfeita.
            </p>
            <p className="text-xs sm:text-sm text-slate-500">
              Todos os seus dados cadastrais, boletos, documentos PDF, chamados e conta de login serão apagados permanentemente conforme a LGPD.
            </p>

            {deleteError && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs sm:text-sm">
                {deleteError}
              </div>
            )}

            {needReauth && (
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Digite sua senha para confirmar a exclusão
                </label>
                <input
                  type="password"
                  value={deletePassword}
                  onChange={(e) => setDeletePassword(e.target.value)}
                  placeholder="Sua senha atual"
                  className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-300 text-sm"
                />
              </div>
            )}

            <div className="flex gap-2.5">
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 min-h-[44px] rounded-xl border border-slate-200 text-slate-700 font-semibold text-sm"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={deletingAll}
                onClick={handleDeleteMyDataLgpd}
                className="flex-1 min-h-[44px] rounded-xl bg-red-600 hover:bg-red-700 text-white font-semibold text-sm"
              >
                {deletingAll ? 'Apagando...' : 'Sim, excluir tudo'}
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
        onClose={closePreviewDoc}
        onDownload={() => previewDoc && handleDownloadDoc(previewDoc.doc)}
      />
    </div>
  );
};
