import React from 'react';
import { CheckCircle2, Clock, AlertCircle, MessageSquare, Loader2 } from 'lucide-react';
import type { StatusBoleto, StatusChamado } from '../types';

export const BoletoStatusBadge: React.FC<{ status: StatusBoleto }> = ({ status }) => {
  if (status === 'Pago') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-green-700 bg-green-50 border border-green-200 px-2.5 py-1 rounded-lg whitespace-nowrap">
        <CheckCircle2 className="w-3.5 h-3.5 text-green-600" />
        Pago
      </span>
    );
  }
  if (status === 'Vencido') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-red-700 bg-red-50 border border-red-200 px-2.5 py-1 rounded-lg whitespace-nowrap">
        <AlertCircle className="w-3.5 h-3.5 text-red-600" />
        Vencido
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-lg whitespace-nowrap">
      <Clock className="w-3.5 h-3.5 text-amber-600" />
      Pendente
    </span>
  );
};

export const ChamadoStatusBadge: React.FC<{ status: StatusChamado }> = ({ status }) => {
  if (status === 'Resolvido') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-green-700 bg-green-50 border border-green-200 px-2.5 py-1 rounded-lg whitespace-nowrap">
        <CheckCircle2 className="w-3.5 h-3.5 text-green-600" />
        Resolvido
      </span>
    );
  }
  if (status === 'Em Andamento') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-700 bg-blue-50 border border-blue-200 px-2.5 py-1 rounded-lg whitespace-nowrap">
        <Loader2 className="w-3.5 h-3.5 text-blue-600" />
        Em Andamento
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-lg whitespace-nowrap">
      <MessageSquare className="w-3.5 h-3.5 text-amber-600" />
      Aberto
    </span>
  );
};
