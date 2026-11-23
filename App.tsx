/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { onAuthStateChanged, signOut, type User } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import { WifiOff, LogOut, AlertCircle } from 'lucide-react';
import { auth, db, testConnection, isOfflineError } from './firebase';
import type { ClienteProfile, EmpresaProfile } from './types';
import { ErrorBoundary } from './components/ErrorBoundary';
import { AuthViews, type AuthScreenMode } from './components/AuthViews';
import { EmpresaDashboard } from './components/EmpresaDashboard';
import { ClientePortal } from './components/ClientePortal';
import { LgpdPrivacyModal } from './components/LgpdPrivacyModal';

function PortalAppContent() {
  const [authReady, setAuthReady] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [empresa, setEmpresa] = useState<EmpresaProfile | null>(null);
  const [cliente, setCliente] = useState<ClienteProfile | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [profileMissing, setProfileMissing] = useState(false);

  const [authMode, setAuthMode] = useState<AuthScreenMode>('landing');
  const [privacyOpen, setPrivacyOpen] = useState(false);
  const [externalNotice, setExternalNotice] = useState<string | null>(null);
  const [isOffline, setIsOffline] = useState<boolean>(
    typeof navigator !== 'undefined' ? !navigator.onLine : false
  );

  // Testa conexão inicial e monitora status de rede
  useEffect(() => {
    let active = true;
    testConnection().then((res) => {
      if (active && !res.online) {
        setIsOffline(true);
      }
    });

    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      active = false;
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Observa estado de autenticação do Firebase Auth
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      setAuthReady(true);
      if (!firebaseUser) {
        setEmpresa(null);
        setCliente(null);
        setProfileMissing(false);
        setLoadingProfile(false);
      }
    });
    return () => unsub();
  }, []);

  // Carrega perfil em tempo real somente após usuário autenticado
  useEffect(() => {
    if (!authReady || !user) return;

    setLoadingProfile(true);
    setProfileMissing(false);
    let empLoaded = false;
    let cliLoaded = false;
    let empData: EmpresaProfile | null = null;
    let cliData: ClienteProfile | null = null;

    const evaluateState = () => {
      if (empLoaded && cliLoaded) {
        setEmpresa(empData);
        setCliente(cliData);
        setProfileMissing(!empData && !cliData);
        setLoadingProfile(false);
      }
    };

    const unsubEmp = onSnapshot(
      doc(db, 'empresas', user.uid),
      (snap) => {
        empData = snap.exists() ? (snap.data() as EmpresaProfile) : null;
        empLoaded = true;
        evaluateState();
      },
      (err) => {
        if (isOfflineError(err)) {
          setIsOffline(true);
        }
        empLoaded = true;
        evaluateState();
      }
    );

    const unsubCli = onSnapshot(
      doc(db, 'clientes', user.uid),
      (snap) => {
        cliData = snap.exists() ? (snap.data() as ClienteProfile) : null;
        cliLoaded = true;
        evaluateState();
      },
      (err) => {
        if (isOfflineError(err)) {
          setIsOffline(true);
        }
        cliLoaded = true;
        evaluateState();
      }
    );

    return () => {
      unsubEmp();
      unsubCli();
    };
  }, [authReady, user]);

  const handleAccountDeleted = (message: string) => {
    setEmpresa(null);
    setCliente(null);
    setUser(null);
    setAuthMode('landing');
    setExternalNotice(message);
  };

  const dpoName = empresa?.nome || cliente?.empresaNome;
  const dpoEmail = empresa?.email || cliente?.empresaEmail;

  return (
    <>
      {isOffline && (
        <div
          role="status"
          className="bg-red-600 text-white px-4 py-2.5 text-xs sm:text-sm font-semibold flex items-center justify-center gap-2 sticky top-0 z-50"
        >
          <WifiOff className="w-4 h-4 shrink-0" />
          <span>Sem conexão, tente novamente.</span>
        </div>
      )}

      {!authReady || (user && loadingProfile) ? (
        <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-8 text-center space-y-3 max-w-sm w-full">
            <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-sm font-semibold text-slate-700">
              Carregando portal com segurança...
            </p>
          </div>
        </div>
      ) : !user ? (
        <AuthViews
          mode={authMode}
          onChangeMode={setAuthMode}
          onOpenPrivacy={() => setPrivacyOpen(true)}
          externalNotice={externalNotice}
          onClearExternalNotice={() => setExternalNotice(null)}
          isOffline={isOffline}
        />
      ) : empresa ? (
        <EmpresaDashboard
          empresa={empresa}
          onOpenPrivacy={() => setPrivacyOpen(true)}
          onAccountDeleted={handleAccountDeleted}
          isOffline={isOffline}
        />
      ) : cliente ? (
        <ClientePortal
          cliente={cliente}
          onOpenPrivacy={() => setPrivacyOpen(true)}
          onAccountDeleted={handleAccountDeleted}
          isOffline={isOffline}
        />
      ) : profileMissing ? (
        <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-white border border-slate-200 rounded-2xl shadow-sm p-6 text-center space-y-4">
            <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto">
              <AlertCircle className="w-6 h-6" />
            </div>
            <h2 className="text-lg font-bold text-slate-900">Cadastro não localizado</h2>
            <p className="text-sm text-slate-600 leading-relaxed">
              Esta conta ainda não possui perfil ativo ou seus dados foram excluídos conforme a LGPD. Entre em contato com a empresa responsável ou acesse com outra conta.
            </p>
            <button
              type="button"
              onClick={() => signOut(auth)}
              className="w-full min-h-[46px] inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-slate-900 text-white font-semibold text-sm hover:bg-slate-800"
            >
              <LogOut className="w-4 h-4" />
              SAIR
            </button>
          </div>
        </div>
      ) : null}

      <LgpdPrivacyModal
        open={privacyOpen}
        onClose={() => setPrivacyOpen(false)}
        dpoName={dpoName}
        dpoEmail={dpoEmail}
      />
    </>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <PortalAppContent />
    </ErrorBoundary>
  );
}
