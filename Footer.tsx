import React from 'react';
import { Shield, Trash2 } from 'lucide-react';

interface FooterProps {
  onOpenPrivacy: () => void;
  showEmpresaNotice?: boolean;
  onRequestDelete?: () => void;
}

export const Footer: React.FC<FooterProps> = ({
  onOpenPrivacy,
  showEmpresaNotice = false,
  onRequestDelete,
}) => {
  return (
    <footer className="border-t border-slate-200 bg-white mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-5 flex flex-col gap-3">
        {showEmpresaNotice && (
          <p className="text-xs sm:text-sm font-medium text-slate-700 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5">
            Faça backup regularmente. A empresa é responsável pelo uso dos dados.
          </p>
        )}

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs sm:text-sm text-slate-600">
          <div className="flex items-start sm:items-center gap-2">
            <Shield className="w-4 h-4 text-blue-600 shrink-0 mt-0.5 sm:mt-0" />
            <span>
              Dados protegidos conforme LGPD - Seus dados só são vistos por você e pela empresa.
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-4 shrink-0">
            <button
              type="button"
              onClick={onOpenPrivacy}
              className="text-blue-600 hover:text-blue-700 font-semibold underline underline-offset-4 whitespace-nowrap min-h-[40px] inline-flex items-center"
            >
              Política de Privacidade
            </button>
            {onRequestDelete && (
              <button
                type="button"
                onClick={onRequestDelete}
                className="text-red-600 hover:text-red-700 font-semibold inline-flex items-center gap-1.5 whitespace-nowrap min-h-[40px]"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Excluir meus dados
              </button>
            )}
          </div>
        </div>
      </div>
    </footer>
  );
};
