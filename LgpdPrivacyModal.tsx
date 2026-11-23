import React from 'react';
import { ShieldCheck, X, Lock, Trash2 } from 'lucide-react';

interface LgpdPrivacyModalProps {
  open: boolean;
  onClose: () => void;
  dpoName?: string;
  dpoEmail?: string;
  onRequestDelete?: () => void;
}

export const LgpdPrivacyModal: React.FC<LgpdPrivacyModalProps> = ({
  open,
  onClose,
  dpoName,
  dpoEmail,
  onRequestDelete,
}) => {
  if (!open) return null;

  const resolvedDpoName = dpoName?.trim() || 'Empresa Responsável pelo Portal';
  const resolvedDpoEmail = dpoEmail?.trim() || 'privacidade@empresa.com.br';

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/60 backdrop-blur-sm p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="lgpd-modal-title"
    >
      <div className="bg-white w-full sm:max-w-xl rounded-t-3xl sm:rounded-2xl shadow-xl border border-slate-200 overflow-hidden max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
          <div className="flex items-center gap-2.5">
            <ShieldCheck className="w-5 h-5 text-blue-600 shrink-0" />
            <h2 id="lgpd-modal-title" className="text-lg font-bold text-slate-900">
              Política de Privacidade (LGPD)
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar política de privacidade"
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-slate-500 hover:text-slate-900 hover:bg-slate-200/70 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-5 text-slate-700 text-sm sm:text-base leading-relaxed">
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 space-y-3">
            <p>
              Coletamos apenas <strong>Nome, WhatsApp e E-mail</strong>, apenas para envio de boletos, documentos e atendimento.
              Não coletamos CPF, RG ou nenhum dado sensível.
            </p>
            <p>
              Dados armazenados no Firebase (Google), com acesso restrito por login e senha. Nunca vendemos seus dados.
              Você pode pedir exclusão a qualquer momento pelo botão <strong>Excluir meus dados</strong>, conforme LGPD Lei 13.709/2018.
            </p>
            <p className="pt-2 border-t border-slate-200 font-medium text-slate-900">
              Encarregado de Dados (DPO): {resolvedDpoName} - E-mail: {resolvedDpoEmail}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
            <div className="p-3.5 rounded-xl border border-slate-200 bg-white">
              <div className="flex items-center gap-2 font-semibold text-slate-900 mb-1">
                <Lock className="w-4 h-4 text-blue-600" />
                <span>Banco Privado</span>
              </div>
              <p className="text-slate-600 text-xs sm:text-sm">
                Seus boletos, PDFs e chamados são isolados por UID e visíveis somente por você e pela empresa vinculada.
              </p>
            </div>
            <div className="p-3.5 rounded-xl border border-slate-200 bg-white">
              <div className="flex items-center gap-2 font-semibold text-slate-900 mb-1">
                <Trash2 className="w-4 h-4 text-red-600" />
                <span>Eliminação Imediata</span>
              </div>
              <p className="text-slate-600 text-xs sm:text-sm">
                A exclusão apaga registros e arquivos PDF no Firestore privado e credenciais no Firebase Auth.
              </p>
            </div>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-3">
          {onRequestDelete ? (
            <button
              type="button"
              onClick={() => {
                onClose();
                onRequestDelete();
              }}
              className="min-h-[44px] inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-red-200 bg-red-50 text-red-700 font-semibold text-sm hover:bg-red-100 transition-colors whitespace-nowrap"
            >
              <Trash2 className="w-4 h-4" />
              Excluir meus dados
            </button>
          ) : (
            <span className="text-xs text-slate-500">
              Lei Geral de Proteção de Dados — Lei nº 13.709/2018
            </span>
          )}

          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] px-6 py-2.5 rounded-xl bg-slate-900 text-white font-semibold text-sm hover:bg-slate-800 transition-colors whitespace-nowrap"
          >
            Entendi
          </button>
        </div>
      </div>
    </div>
  );
};
