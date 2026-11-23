import React, { useState } from 'react';
import { motion } from 'motion/react';
import {
  Building2,
  UserCheck,
  ShieldCheck,
  ArrowLeft,
  Mail,
  Lock,
  Phone,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  KeyRound,
  FileText,
  Receipt,
  MessageSquare,
  ArrowRight,
  ExternalLink,
} from 'lucide-react';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  updateProfile,
  GoogleAuthProvider,
  signInWithPopup,
} from 'firebase/auth';
import { doc, getDoc, setDoc, addDoc, collection, serverTimestamp } from 'firebase/firestore';
import {
  auth,
  db,
  activeFirebaseProjectId,
  isOfflineError,
  handleFirestoreError,
  OperationType,
} from '../firebase';
import { formatWhatsappInput } from '../utils/formatters';
import { Footer } from './Footer';

export type AuthScreenMode = 'landing' | 'empresa-login' | 'empresa-cadastro' | 'cliente-login';

interface AuthViewsProps {
  mode: AuthScreenMode;
  onChangeMode: (mode: AuthScreenMode) => void;
  onOpenPrivacy: () => void;
  externalNotice?: string | null;
  onClearExternalNotice?: () => void;
  isOffline: boolean;
}

export const AuthViews: React.FC<AuthViewsProps> = ({
  mode,
  onChangeMode,
  onOpenPrivacy,
  externalNotice,
  onClearExternalNotice,
  isOffline,
}) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nomeEmpresa, setNomeEmpresa] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [pixChave, setPixChave] = useState('');
  const [lgpdAccepted, setLgpdAccepted] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [needsEmailProviderSetup, setNeedsEmailProviderSetup] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [showResetBox, setShowResetBox] = useState(false);
  const [resetEmail, setResetEmail] = useState('');

  const resetMessages = () => {
    setErrorMsg(null);
    setSuccessMsg(null);
    setNeedsEmailProviderSetup(false);
    onClearExternalNotice?.();
  };

  const switchMode = (next: AuthScreenMode) => {
    resetMessages();
    setShowResetBox(false);
    setPassword('');
    onChangeMode(next);
  };

  const mapAuthError = (err: unknown): string => {
    if (isOffline || isOfflineError(err)) {
      return 'Sem conexão, tente novamente.';
    }
    const code = (err as { code?: string })?.code || '';
    if (
      code === 'auth/invalid-credential' ||
      code === 'auth/wrong-password' ||
      code === 'auth/user-not-found' ||
      code === 'auth/invalid-email'
    ) {
      return 'E-mail ou senha incorretos.';
    }
    if (code === 'auth/email-already-in-use') {
      return 'Este e-mail já está cadastrado no sistema.';
    }
    if (code === 'auth/weak-password') {
      return 'A senha deve ter no mínimo 6 caracteres.';
    }
    if (code === 'auth/too-many-requests') {
      return 'Muitas tentativas seguidas. Aguarde alguns instantes e tente novamente.';
    }
    if (code === 'auth/operation-not-allowed' || code === 'auth/configuration-not-found') {
      setNeedsEmailProviderSetup(true);
      return 'O provedor E-mail/Senha ainda não está ativado no Firebase Console deste projeto.';
    }
    return 'Não foi possível autenticar. Verifique seus dados e tente novamente.';
  };

  const handleGoogleEmpresaLogin = async () => {
    resetMessages();
    if (isOffline || !navigator.onLine) {
      setErrorMsg('Sem conexão, tente novamente.');
      return;
    }
    setLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      const cred = await signInWithPopup(auth, provider);
      const u = cred.user;
      const empRef = doc(db, 'empresas', u.uid);
      const cliSnap = await getDoc(doc(db, 'clientes', u.uid));
      if (!cliSnap.exists()) {
        const empSnap = await getDoc(empRef);
        if (!empSnap.exists()) {
          const empNome = u.displayName || 'Minha Empresa';
          const empEmail = u.email || 'contato@empresa.com';
          await setDoc(empRef, {
            empresaId: u.uid,
            nome: empNome,
            email: empEmail,
            whatsapp: '(11) 99999-0000',
            papel: 'empresa',
            pixChave: empEmail,
            lgpdConsent: true,
            lgpdConsentAt: serverTimestamp(),
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        }
      }
    } catch (err) {
      const code = (err as { code?: string })?.code || '';
      if (code !== 'auth/popup-closed-by-user') {
        setErrorMsg(mapAuthError(err));
      }
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    resetMessages();
    if (isOffline || !navigator.onLine) {
      setErrorMsg('Sem conexão, tente novamente.');
      return;
    }
    if (!email.trim() || !password) {
      setErrorMsg('Informe seu e-mail e senha para entrar.');
      return;
    }

    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
    } catch (err) {
      setErrorMsg(mapAuthError(err));
    } finally {
      setLoading(false);
    }
  };

  const handleCreateEmpresa = async (e: React.FormEvent) => {
    e.preventDefault();
    resetMessages();
    if (isOffline || !navigator.onLine) {
      setErrorMsg('Sem conexão, tente novamente.');
      return;
    }
    if (!nomeEmpresa.trim() || nomeEmpresa.trim().length < 2) {
      setErrorMsg('Informe o nome da empresa.');
      return;
    }
    if (!whatsapp.trim() || whatsapp.replace(/\D/g, '').length < 10) {
      setErrorMsg('Informe um número de WhatsApp válido com DDD.');
      return;
    }
    if (!email.trim()) {
      setErrorMsg('Informe o e-mail da empresa.');
      return;
    }
    if (password.length < 6) {
      setErrorMsg('A senha deve ter no mínimo 6 caracteres.');
      return;
    }
    if (!lgpdAccepted) {
      setErrorMsg('Você precisa aceitar para continuar.');
      return;
    }

    setLoading(true);
    try {
      const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
      const uid = cred.user.uid;
      await updateProfile(cred.user, { displayName: nomeEmpresa.trim() });

      const empresaPath = `empresas/${uid}`;
      try {
        await setDoc(doc(db, 'empresas', uid), {
          empresaId: uid,
          nome: nomeEmpresa.trim(),
          email: email.trim().toLowerCase(),
          whatsapp: whatsapp.trim(),
          papel: 'empresa',
          pixChave: (pixChave.trim() || email.trim().toLowerCase()).slice(0, 160),
          lgpdConsent: true,
          lgpdConsentAt: serverTimestamp(),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } catch (fsErr) {
        handleFirestoreError(fsErr, OperationType.CREATE, empresaPath);
      }

      try {
        await addDoc(collection(db, 'atividades'), {
          empresaId: uid,
          clienteId: '',
          actorUid: uid,
          acao: 'Cadastro da Empresa',
          detalhe: `Conta criada para ${nomeEmpresa.trim()} com aceite LGPD.`,
          createdAt: serverTimestamp(),
        });
      } catch {
        // Log secundário
      }
    } catch (err) {
      setErrorMsg(mapAuthError(err));
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    resetMessages();
    if (isOffline || !navigator.onLine) {
      setErrorMsg('Sem conexão, tente novamente.');
      return;
    }
    const targetEmail = (resetEmail || email).trim();
    if (!targetEmail) {
      setErrorMsg('Digite seu e-mail para receber o link de recuperação.');
      return;
    }
    setLoading(true);
    try {
      await sendPasswordResetEmail(auth, targetEmail);
      setSuccessMsg(`E-mail de recuperação enviado para ${targetEmail}. Verifique sua caixa de entrada ou spam.`);
      setShowResetBox(false);
    } catch (err) {
      const code = (err as { code?: string })?.code || '';
      if (code === 'auth/user-not-found' || code === 'auth/invalid-email') {
        setErrorMsg('Não encontramos uma conta com este e-mail.');
      } else {
        setErrorMsg(mapAuthError(err));
      }
    } finally {
      setLoading(false);
    }
  };

  const firebaseAuthProvidersUrl = activeFirebaseProjectId
    ? `https://console.firebase.google.com/project/${activeFirebaseProjectId}/authentication/providers`
    : 'https://console.firebase.google.com/';

  if (mode === 'landing') {
    return (
      <div className="min-h-screen flex flex-col bg-slate-100 bg-grid-subtle">
        <header className="bg-white/95 backdrop-blur-md border-b border-slate-200 sticky top-0 z-30">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-8">
            <span className="font-display text-lg sm:text-xl font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0">
              Portal do Cliente
            </span>

            <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600">
              <button
                type="button"
                onClick={() => switchMode('empresa-login')}
                className="hover:text-slate-900 transition-colors whitespace-nowrap shrink-0"
              >
                Acesso Empresa
              </button>
              <button
                type="button"
                onClick={() => switchMode('cliente-login')}
                className="hover:text-slate-900 transition-colors whitespace-nowrap shrink-0"
              >
                Acesso Cliente
              </button>
              <button
                type="button"
                onClick={onOpenPrivacy}
                className="hover:text-slate-900 transition-colors whitespace-nowrap shrink-0"
              >
                Privacidade LGPD
              </button>
            </nav>

            <button
              type="button"
              onClick={() => switchMode('cliente-login')}
              className="min-h-[40px] px-4 py-2 rounded-xl bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0"
            >
              Entrar
            </button>
          </div>
        </header>

        <main className="flex-1 flex items-center">
          <div className="max-w-6xl w-full mx-auto px-4 sm:px-6 py-10 sm:py-14">
            {externalNotice && (
              <motion.div
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.18 }}
                className="mb-8 p-4 rounded-xl bg-green-50 border border-green-200 text-green-800 flex items-center gap-3 text-sm font-medium shadow-sm"
              >
                <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0" />
                <span>{externalNotice}</span>
              </motion.div>
            )}

            {errorMsg && (
              <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-200 text-red-800 text-sm space-y-2.5" role="alert">
                <div className="flex items-start gap-2.5">
                  <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                  <span>{errorMsg}</span>
                </div>
                {needsEmailProviderSetup && (
                  <div className="pl-7 flex flex-wrap items-center gap-3 pt-1">
                    <a
                      href={firebaseAuthProvidersUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="min-h-[38px] px-3.5 py-1.5 rounded-lg bg-slate-900 text-white text-xs font-semibold inline-flex items-center gap-1.5 hover:bg-slate-800"
                    >
                      Ativar E-mail/Senha no Firebase Console
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                    <button
                      type="button"
                      onClick={handleGoogleEmpresaLogin}
                      disabled={loading}
                      className="min-h-[38px] px-3.5 py-1.5 rounded-lg bg-white border border-slate-300 text-slate-800 text-xs font-semibold hover:bg-slate-50"
                    >
                      Ou entrar com Google (Empresa)
                    </button>
                  </div>
                )}
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start">
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.22 }}
                className="lg:col-span-7 space-y-6"
              >
                <p className="text-xs sm:text-sm font-semibold text-blue-600 tracking-wide">
                  Gestão Financeira · Documentos PDF · Atendimento Privado
                </p>

                <h1 className="font-display text-3xl sm:text-5xl font-bold tracking-tight text-slate-900 leading-[1.1] text-balance">
                  Boletos, documentos e suporte em um portal privado e seguro.
                </h1>

                <p className="text-base sm:text-lg text-slate-600 max-w-2xl leading-relaxed">
                  Acompanhe cobranças com pagamento via PIX, acesse contratos e comprovantes em PDF e converse diretamente com a empresa responsável, com proteção integral pela LGPD.
                </p>

                {/* 2 Botões Grandes Solicitados */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                  <button
                    type="button"
                    onClick={() => switchMode('empresa-login')}
                    className="min-h-[76px] p-5 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white text-left transition-all shadow-md hover:shadow-lg active:scale-[0.99] flex items-center justify-between gap-3 group"
                  >
                    <div className="flex items-center gap-3.5">
                      <div className="w-12 h-12 rounded-xl bg-blue-600 flex items-center justify-center shrink-0">
                        <Building2 className="w-6 h-6 text-white" />
                      </div>
                      <div>
                        <span className="block text-base sm:text-lg font-bold tracking-tight">
                          SOU EMPRESA
                        </span>
                        <span className="block text-xs sm:text-sm text-slate-300">
                          Gerenciar clientes e boletos
                        </span>
                      </div>
                    </div>
                    <ArrowRight className="w-5 h-5 text-slate-400 group-hover:text-white group-hover:translate-x-0.5 transition-all shrink-0" />
                  </button>

                  <button
                    type="button"
                    onClick={() => switchMode('cliente-login')}
                    className="min-h-[76px] p-5 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white text-left transition-all shadow-md hover:shadow-lg active:scale-[0.99] flex items-center justify-between gap-3 group"
                  >
                    <div className="flex items-center gap-3.5">
                      <div className="w-12 h-12 rounded-xl bg-white/15 flex items-center justify-center shrink-0">
                        <UserCheck className="w-6 h-6 text-white" />
                      </div>
                      <div>
                        <span className="block text-base sm:text-lg font-bold tracking-tight">
                          SOU CLIENTE
                        </span>
                        <span className="block text-xs sm:text-sm text-blue-100">
                          Boletos, PDFs e chamados
                        </span>
                      </div>
                    </div>
                    <ArrowRight className="w-5 h-5 text-blue-200 group-hover:text-white group-hover:translate-x-0.5 transition-all shrink-0" />
                  </button>
                </div>

                <div>
                  <button
                    type="button"
                    onClick={onOpenPrivacy}
                    className="min-h-[44px] inline-flex items-center gap-2 text-sm font-semibold text-slate-700 hover:text-blue-600 underline underline-offset-4 transition-colors"
                  >
                    <ShieldCheck className="w-4 h-4 text-blue-600" />
                    POLÍTICA DE PRIVACIDADE
                  </button>
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25, delay: 0.05 }}
                className="lg:col-span-5"
              >
                <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6 sm:p-7 space-y-5">
                  <div className="space-y-1">
                    <h2 className="text-lg font-bold text-slate-900">
                      Privacidade por padrão (Lei 13.709/2018)
                    </h2>
                    <p className="text-sm text-slate-600">
                      Coleta mínima estritamente necessária para relacionamento comercial.
                    </p>
                  </div>

                  <div className="divide-y divide-slate-100">
                    <div className="py-3.5 flex items-start gap-3.5">
                      <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                        <Receipt className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-slate-900">Boletos e Chave PIX</p>
                        <p className="text-xs sm:text-sm text-slate-600">
                          Emissão organizada com código Copia e Cola, PDF e lembrete direto no WhatsApp.
                        </p>
                      </div>
                    </div>

                    <div className="py-3.5 flex items-start gap-3.5">
                      <div className="w-9 h-9 rounded-xl bg-slate-100 text-slate-800 flex items-center justify-center shrink-0">
                        <FileText className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-slate-900">Documentos PDF Privados</p>
                        <p className="text-xs sm:text-sm text-slate-600">
                          Arquivos PDF salvos no banco privado com acesso restrito ao cliente destinatário.
                        </p>
                      </div>
                    </div>

                    <div className="py-3.5 flex items-start gap-3.5">
                      <div className="w-9 h-9 rounded-xl bg-green-50 text-green-600 flex items-center justify-center shrink-0">
                        <MessageSquare className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-slate-900">Sem CPF ou Dados Sensíveis</p>
                        <p className="text-xs sm:text-sm text-slate-600">
                          Apenas Nome, WhatsApp e E-mail, com exclusão total disponível a qualquer instante.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            </div>
          </div>
        </main>

        <Footer onOpenPrivacy={onOpenPrivacy} />
      </div>
    );
  }

  const isEmpresaMode = mode === 'empresa-login' || mode === 'empresa-cadastro';

  return (
    <div className="min-h-screen flex flex-col bg-slate-100 bg-grid-subtle">
      <header className="bg-white/95 backdrop-blur-md border-b border-slate-200 sticky top-0 z-30">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <button
            type="button"
            onClick={() => switchMode('landing')}
            className="min-h-[44px] inline-flex items-center gap-2 text-sm font-semibold text-slate-700 hover:text-slate-900 transition-colors whitespace-nowrap"
          >
            <ArrowLeft className="w-4 h-4" />
            Voltar ao início
          </button>

          <span className="font-display text-base sm:text-lg font-bold text-slate-900 truncate">
            Portal do Cliente
          </span>

          <button
            type="button"
            onClick={() => switchMode(isEmpresaMode ? 'cliente-login' : 'empresa-login')}
            className="min-h-[40px] px-3 py-1.5 rounded-xl border border-slate-200 text-xs sm:text-sm font-semibold text-slate-700 hover:bg-slate-50 whitespace-nowrap"
          >
            {isEmpresaMode ? 'Sou Cliente' : 'Sou Empresa'}
          </button>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center px-4 py-8 sm:py-12">
        <motion.div
          key={mode + (showResetBox ? '-reset' : '')}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.18 }}
          className="w-full max-w-md bg-white border border-slate-200 rounded-2xl shadow-sm p-6 sm:p-8 space-y-6"
        >
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-2 text-xs font-semibold text-blue-600">
              {isEmpresaMode ? <Building2 className="w-4 h-4" /> : <UserCheck className="w-4 h-4" />}
              <span>{isEmpresaMode ? 'Área da Empresa' : 'Área do Cliente'}</span>
            </div>
            <h1 className="font-display text-2xl font-bold text-slate-900">
              {mode === 'empresa-login' && 'Entrar como Empresa'}
              {mode === 'empresa-cadastro' && 'Criar conta da Empresa'}
              {mode === 'cliente-login' && 'Entrar no Portal do Cliente'}
            </h1>
            <p className="text-sm text-slate-600">
              {mode === 'empresa-login' && 'Acesse o painel administrativo para gerenciar clientes, boletos e documentos.'}
              {mode === 'empresa-cadastro' && 'Cadastre sua empresa para emitir cobranças e atender clientes em conformidade com a LGPD.'}
              {mode === 'cliente-login' && 'Use o e-mail e a senha temporária fornecidos pela empresa responsável.'}
            </p>
          </div>

          {externalNotice && (
            <div className="p-3.5 rounded-xl bg-green-50 border border-green-200 text-green-800 text-sm flex items-start gap-2.5">
              <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0 mt-0.5" />
              <span>{externalNotice}</span>
            </div>
          )}

          {errorMsg && (
            <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm space-y-2" role="alert">
              <div className="flex items-start gap-2.5">
                <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                <span>{errorMsg}</span>
              </div>
              {needsEmailProviderSetup && (
                <a
                  href={firebaseAuthProvidersUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs font-semibold underline text-red-800"
                >
                  Abrir Console do Firebase (Sign-in method)
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              )}
            </div>
          )}

          {successMsg && (
            <div className="p-3.5 rounded-xl bg-green-50 border border-green-200 text-green-800 text-sm flex items-start gap-2.5">
              <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0 mt-0.5" />
              <span>{successMsg}</span>
            </div>
          )}

          {showResetBox ? (
            <form onSubmit={handlePasswordReset} className="space-y-4">
              <div>
                <label htmlFor="reset-email" className="block text-sm font-semibold text-slate-800 mb-1.5">
                  E-mail cadastrado
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    id="reset-email"
                    type="email"
                    required
                    value={resetEmail}
                    onChange={(e) => setResetEmail(e.target.value)}
                    placeholder="seu@email.com"
                    className="w-full min-h-[46px] pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600"
                  />
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-2.5">
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 min-h-[46px] px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-semibold text-sm transition-colors"
                >
                  {loading ? 'Enviando...' : 'Enviar link de recuperação'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowResetBox(false)}
                  className="min-h-[46px] px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 font-semibold text-sm hover:bg-slate-50 transition-colors"
                >
                  Voltar
                </button>
              </div>
            </form>
          ) : mode === 'empresa-cadastro' ? (
            <form onSubmit={handleCreateEmpresa} className="space-y-4">
              <div>
                <label htmlFor="emp-nome" className="block text-sm font-semibold text-slate-800 mb-1.5">
                  Nome da Empresa
                </label>
                <div className="relative">
                  <Building2 className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    id="emp-nome"
                    type="text"
                    required
                    maxLength={120}
                    value={nomeEmpresa}
                    onChange={(e) => setNomeEmpresa(e.target.value)}
                    placeholder="Ex: Silva Consultoria Ltda"
                    className="w-full min-h-[46px] pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="emp-whatsapp" className="block text-sm font-semibold text-slate-800 mb-1.5">
                  WhatsApp
                </label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    id="emp-whatsapp"
                    type="tel"
                    required
                    maxLength={30}
                    value={whatsapp}
                    onChange={(e) => setWhatsapp(formatWhatsappInput(e.target.value))}
                    placeholder="(11) 99999-9999"
                    className="w-full min-h-[46px] pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 text-slate-900 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="emp-email" className="block text-sm font-semibold text-slate-800 mb-1.5">
                  E-mail
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    id="emp-email"
                    type="email"
                    required
                    maxLength={160}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="contato@suaempresa.com.br"
                    className="w-full min-h-[46px] pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="emp-pix" className="block text-sm font-semibold text-slate-800 mb-1.5">
                  Chave PIX para recebimentos (opcional)
                </label>
                <div className="relative">
                  <KeyRound className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    id="emp-pix"
                    type="text"
                    maxLength={160}
                    value={pixChave}
                    onChange={(e) => setPixChave(e.target.value)}
                    placeholder="Se vazio, usará o e-mail da empresa"
                    className="w-full min-h-[46px] pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="emp-senha" className="block text-sm font-semibold text-slate-800 mb-1.5">
                  Senha
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    id="emp-senha"
                    type={showPassword ? 'text' : 'password'}
                    required
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Mínimo de 6 caracteres"
                    className="w-full min-h-[46px] pl-10 pr-12 py-2.5 rounded-xl border border-slate-300 text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                    className="absolute right-2 top-1/2 -translate-y-1/2 min-h-[40px] min-w-[40px] flex items-center justify-center text-slate-500 hover:text-slate-800"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <label className="flex items-start gap-3 p-3.5 rounded-xl border border-slate-200 bg-slate-50 cursor-pointer hover:bg-slate-100/70 transition-colors">
                <input
                  type="checkbox"
                  checked={lgpdAccepted}
                  onChange={(e) => setLgpdAccepted(e.target.checked)}
                  className="mt-1 w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-600 shrink-0"
                />
                <span className="text-xs sm:text-sm text-slate-700 leading-snug">
                  Concordo com o tratamento dos dados da empresa para envio de boletos, documentos e atendimento, nos termos da LGPD (Lei 13.709/2018), sem coleta de CPF ou dados sensíveis.
                </span>
              </label>

              <button
                type="submit"
                disabled={loading}
                className="w-full min-h-[48px] px-5 py-3 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:opacity-60 text-white font-semibold text-base transition-colors"
              >
                {loading ? 'Criando conta...' : 'Criar conta da Empresa'}
              </button>

              <button
                type="button"
                onClick={() => switchMode('empresa-login')}
                className="w-full min-h-[44px] text-sm font-semibold text-blue-600 hover:text-blue-700"
              >
                Já tenho conta — Fazer login
              </button>
            </form>
          ) : (
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label htmlFor="login-email" className="block text-sm font-semibold text-slate-800 mb-1.5">
                  E-mail
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    id="login-email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="seu@email.com"
                    className="w-full min-h-[46px] pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="login-senha" className="block text-sm font-semibold text-slate-800 mb-1.5">
                  Senha
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    id="login-senha"
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Sua senha"
                    className="w-full min-h-[46px] pl-10 pr-12 py-2.5 rounded-xl border border-slate-300 text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                    className="absolute right-2 top-1/2 -translate-y-1/2 min-h-[40px] min-w-[40px] flex items-center justify-center text-slate-500 hover:text-slate-800"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => {
                    resetMessages();
                    setResetEmail(email);
                    setShowResetBox(true);
                  }}
                  className="text-sm font-semibold text-blue-600 hover:text-blue-700 min-h-[40px] inline-flex items-center"
                >
                  Esqueci minha senha
                </button>
              </div>

              <button
                type="submit"
                disabled={loading}
                className={`w-full min-h-[48px] px-5 py-3 rounded-xl text-white font-semibold text-base transition-colors disabled:opacity-60 ${
                  isEmpresaMode
                    ? 'bg-slate-900 hover:bg-slate-800'
                    : 'bg-blue-600 hover:bg-blue-700'
                }`}
              >
                {loading ? 'Entrando...' : 'Entrar'}
              </button>

              {mode === 'empresa-login' ? (
                <div className="pt-2 border-t border-slate-100 space-y-2.5">
                  <button
                    type="button"
                    onClick={() => switchMode('empresa-cadastro')}
                    className="w-full min-h-[46px] px-4 py-2.5 rounded-xl border border-slate-300 text-slate-800 font-semibold text-sm hover:bg-slate-50 transition-colors"
                  >
                    Criar conta da Empresa
                  </button>

                  <button
                    type="button"
                    disabled={loading}
                    onClick={handleGoogleEmpresaLogin}
                    className="w-full min-h-[44px] px-4 py-2 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 font-semibold text-sm transition-colors"
                  >
                    Entrar com Google (Empresa)
                  </button>
                </div>
              ) : (
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs sm:text-sm text-slate-600 leading-relaxed">
                  <strong>Acesso exclusivo para clientes cadastrados:</strong> a conta é criada diretamente pela sua empresa, que envia o e-mail e a senha temporária de acesso.
                </div>
              )}
            </form>
          )}
        </motion.div>
      </main>

      <Footer onOpenPrivacy={onOpenPrivacy} />
    </div>
  );
};
