import React, { useMemo, useState } from 'react';
import { motion } from 'motion/react';
import type { BoletoRecord } from '../types';
import { formatCurrencyBRL, getEffectiveBoletoStatus } from '../utils/formatters';

interface RecebimentosChartProps {
  boletos: BoletoRecord[];
}

interface MonthBucket {
  key: string;
  label: string;
  pago: number;
  pendente: number;
  vencido: number;
}

const MONTHS_PT = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

export const RecebimentosChart: React.FC<RecebimentosChartProps> = ({ boletos }) => {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const buckets = useMemo<MonthBucket[]>(() => {
    const map = new Map<string, MonthBucket>();

    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const label = `${MONTHS_PT[d.getMonth()]}/${String(d.getFullYear()).slice(-2)}`;
      map.set(key, { key, label, pago: 0, pendente: 0, vencido: 0 });
    }

    for (const b of boletos) {
      if (!b.vencimento || b.vencimento.length < 7) continue;
      const key = b.vencimento.slice(0, 7);
      const [y, m] = key.split('-');
      const mIdx = Number(m) - 1;
      const label = `${MONTHS_PT[mIdx] || m}/${(y || '').slice(-2)}`;
      if (!map.has(key)) {
        map.set(key, { key, label, pago: 0, pendente: 0, vencido: 0 });
      }
      const bucket = map.get(key)!;
      const st = getEffectiveBoletoStatus(b);
      if (st === 'Pago') bucket.pago += b.valor;
      else if (st === 'Vencido') bucket.vencido += b.valor;
      else bucket.pendente += b.valor;
    }

    return Array.from(map.values())
      .sort((a, b) => a.key.localeCompare(b.key))
      .slice(-8);
  }, [boletos]);

  const maxTotal = useMemo(() => {
    let max = 0;
    for (const b of buckets) {
      const sum = b.pago + b.pendente + b.vencido;
      if (sum > max) max = sum;
    }
    return max > 0 ? Math.ceil(max * 1.1) : 1000;
  }, [buckets]);

  const visibleBuckets = buckets.slice(-8);

  return (
    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-5 sm:p-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <h3 className="text-base sm:text-lg font-bold text-slate-900">Gráfico de Recebimentos</h3>
          <p className="text-xs sm:text-sm text-slate-500">
            Comparativo mensal por vencimento (Recebido, Pendente e Vencido)
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-4 text-xs font-semibold text-slate-700">
          <span className="inline-flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm bg-green-600 inline-block" />
            Recebido
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm bg-blue-600 inline-block" />
            A Receber
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm bg-red-600 inline-block" />
            Vencido
          </span>
        </div>
      </div>

      <div className="relative">
        {/* Linhas de referência horizontais com escala Y */}
        <div className="relative h-56 flex">
          <div className="hidden sm:flex flex-col justify-between pr-3 pb-2 text-[11px] font-mono text-slate-400 tabular-nums select-none w-20 text-right shrink-0">
            <span>{formatCurrencyBRL(maxTotal)}</span>
            <span>{formatCurrencyBRL(maxTotal / 2)}</span>
            <span>R$ 0</span>
          </div>

          <div className="relative flex-1">
            <div className="absolute inset-0 flex flex-col justify-between pointer-events-none pb-2">
              <div className="border-b border-dashed border-slate-200/80 w-full" />
              <div className="border-b border-dashed border-slate-200/80 w-full" />
              <div className="border-b border-slate-200 w-full" />
            </div>

            <div className="relative grid grid-cols-6 sm:grid-cols-8 gap-2 sm:gap-3 items-end h-full pt-4 pb-2 z-10">
              {visibleBuckets.map((b, idx) => {
                const total = b.pago + b.pendente + b.vencido;
                const pagoH = Math.round((b.pago / maxTotal) * 164);
                const pendH = Math.round((b.pendente / maxTotal) * 164);
                const vencH = Math.round((b.vencido / maxTotal) * 164);
                const isHovered = hoveredIdx === idx;

                return (
                  <div
                    key={b.key}
                    onMouseEnter={() => setHoveredIdx(idx)}
                    onMouseLeave={() => setHoveredIdx(null)}
                    onClick={() => setHoveredIdx(isHovered ? null : idx)}
                    className="relative flex flex-col items-center justify-end h-full cursor-pointer group"
                  >
                    {isHovered && (
                      <div className="absolute -top-2 left-1/2 -translate-x-1/2 -translate-y-full z-20 w-44 p-2.5 rounded-xl bg-slate-900 text-white text-xs shadow-lg pointer-events-none space-y-1">
                        <p className="font-bold border-b border-slate-700 pb-1">{b.label}</p>
                        <p className="flex justify-between tabular-nums">
                          <span className="text-green-400">Pago:</span>
                          <span>{formatCurrencyBRL(b.pago)}</span>
                        </p>
                        <p className="flex justify-between tabular-nums">
                          <span className="text-blue-400">Pendente:</span>
                          <span>{formatCurrencyBRL(b.pendente)}</span>
                        </p>
                        <p className="flex justify-between tabular-nums">
                          <span className="text-red-400">Vencido:</span>
                          <span>{formatCurrencyBRL(b.vencido)}</span>
                        </p>
                      </div>
                    )}

                    <div className="w-full max-w-[38px] flex flex-col-reverse gap-0.5 items-stretch">
                      {b.pago > 0 && (
                        <motion.div
                          initial={{ scaleY: 0.2, opacity: 0.5 }}
                          animate={{ scaleY: 1, opacity: 1 }}
                          transition={{ duration: 0.22 }}
                          style={{ height: `${Math.max(pagoH, 5)}px`, transformOrigin: 'bottom' }}
                          className="w-full bg-green-600 rounded-t-sm transition-colors group-hover:bg-green-500"
                        />
                      )}
                      {b.pendente > 0 && (
                        <motion.div
                          initial={{ scaleY: 0.2, opacity: 0.5 }}
                          animate={{ scaleY: 1, opacity: 1 }}
                          transition={{ duration: 0.22 }}
                          style={{ height: `${Math.max(pendH, 5)}px`, transformOrigin: 'bottom' }}
                          className="w-full bg-blue-600 rounded-t-sm transition-colors group-hover:bg-blue-500"
                        />
                      )}
                      {b.vencido > 0 && (
                        <motion.div
                          initial={{ scaleY: 0.2, opacity: 0.5 }}
                          animate={{ scaleY: 1, opacity: 1 }}
                          transition={{ duration: 0.22 }}
                          style={{ height: `${Math.max(vencH, 5)}px`, transformOrigin: 'bottom' }}
                          className="w-full bg-red-600 rounded-t-sm transition-colors group-hover:bg-red-500"
                        />
                      )}
                      {total === 0 && <div className="w-full h-1 bg-slate-200 rounded-full" />}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="flex pt-2">
          <div className="hidden sm:block w-20 pr-3 shrink-0" />
          <div className="flex-1 grid grid-cols-6 sm:grid-cols-8 gap-2 sm:gap-3">
            {visibleBuckets.map((b) => (
              <div key={b.key} className="text-center text-[11px] sm:text-xs font-mono text-slate-600 truncate">
                {b.label}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
