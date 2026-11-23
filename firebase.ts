/**
 * ============================================================================
 * CONFIGURAÇÃO DO FIREBASE (Auth, Firestore e Storage)
 * ============================================================================
 * Cole aqui as chaves do seu projeto no Firebase Console
 * (Configurações do Projeto -> Seus aplicativos -> Web) ou defina as variáveis
 * VITE_FIREBASE_* no arquivo .env / GitHub Secrets.
 */
const firebaseConfig = {
  apiKey: 'AIzaSyCpsVP6akhB-3JzLxFxnV2hvEfDBorOyF0',
  authDomain: 'cliente-3f2bc.firebaseapp.com',
  projectId: 'cliente-3f2bc',
  storageBucket: 'cliente-3f2bc.firebasestorage.app',
  messagingSenderId: '323213079597',
  appId: '1:323213079597:web:a392358a449e8824de34a4',
  firestoreDatabaseId: '',
};

import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';
import {
  getFirestore,
  doc,
  getDocFromServer,
  type Firestore
} from 'firebase/firestore';
import { getStorage, type FirebaseStorage } from 'firebase/storage';
import appletConfig from '../firebase-applet-config.json';

const hasRealValue = (value?: string): value is string =>
  Boolean(value && value.trim() !== '' && value !== 'SUA_CHAVE_AQUI');

const envConfig = hasRealValue(import.meta.env.VITE_FIREBASE_API_KEY)
  ? {
      apiKey: import.meta.env.VITE_FIREBASE_API_KEY as string,
      authDomain: (import.meta.env.VITE_FIREBASE_AUTH_DOMAIN as string) || '',
      projectId: (import.meta.env.VITE_FIREBASE_PROJECT_ID as string) || '',
      storageBucket: (import.meta.env.VITE_FIREBASE_STORAGE_BUCKET as string) || '',
      messagingSenderId: (import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID as string) || '',
      appId: (import.meta.env.VITE_FIREBASE_APP_ID as string) || '',
      firestoreDatabaseId: (import.meta.env.VITE_FIREBASE_DATABASE_ID as string) || '',
    }
  : null;

const resolvedConfig = hasRealValue(firebaseConfig.apiKey)
  ? firebaseConfig
  : envConfig
  ? envConfig
  : appletConfig && hasRealValue(appletConfig.apiKey)
  ? appletConfig
  : firebaseConfig;

export const activeFirebaseProjectId = hasRealValue(resolvedConfig.projectId)
  ? resolvedConfig.projectId
  : '';

// Instância principal do Firebase
export const app: FirebaseApp =
  getApps().find((a) => a.name === '[DEFAULT]') ?? initializeApp(resolvedConfig);

export const auth: Auth = getAuth(app);

// Usa o firestoreDatabaseId quando informado (padrão "(default)" para projetos novos)
export const db: Firestore = resolvedConfig.firestoreDatabaseId
  ? getFirestore(app, resolvedConfig.firestoreDatabaseId)
  : getFirestore(app);

export const storage: FirebaseStorage = getStorage(app);

// Instância secundária usada exclusivamente pela Empresa ao criar a conta de um Cliente,
// evitando que a sessão da Empresa logada seja substituída pelo novo cliente no Firebase Auth.
const provisionerApp: FirebaseApp =
  getApps().find((a) => a.name === 'ClientProvisioner') ??
  initializeApp(resolvedConfig, 'ClientProvisioner');

export const provisionerAuth: Auth = getAuth(provisionerApp);

/**
 * Validação inicial de conexão com o Firestore.
 */
export async function testConnection(): Promise<{ online: boolean; message?: string }> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return { online: false, message: 'Sem conexão, tente novamente.' };
  }
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    return { online: true };
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      return { online: false, message: 'Sem conexão, tente novamente.' };
    }
    // Se retornou permission-denied no doc de teste, significa que o servidor respondeu normalmente
    return { online: true };
  }
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error:', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export function isOfflineError(error: unknown): boolean {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return true;
  }
  const msg = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
  return (
    msg.includes('offline') ||
    msg.includes('network-request-failed') ||
    msg.includes('unavailable') ||
    msg.includes('failed to fetch')
  );
}
