import React from 'react';
import { AuditLog } from '../../types';
import { History, ShieldCheck, User } from 'lucide-react';

interface AuditLogViewerProps {
  logs: AuditLog[];
}

export const AuditLogViewer: React.FC<AuditLogViewerProps> = ({ logs }) => {
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-md overflow-hidden text-xs">
      <div className="p-4 bg-[#092B60] text-white flex items-center justify-between">
        <div>
          <h2 className="font-black text-sm flex items-center gap-2 text-white">
            <History className="w-4 h-4 text-[#FFD000]" />
            İşlem Geçmişi & Değişiklik Günlüğü (Audit Trail)
          </h2>
          <p className="text-blue-200 text-[11px]">
            Sistemde gerçekleşen talep dağıtımları, araç aktarımları, durum güncellemeleri ve şoför mesajları
          </p>
        </div>
        <span className="text-[11px] font-black text-[#092B60] bg-[#FFD000] px-2.5 py-1 rounded">
          {logs.length} Kayıt
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead className="bg-[#0D3978] text-white uppercase text-[10px] font-black border-b border-blue-900">
            <tr>
              <th className="px-4 py-3">Zaman</th>
              <th className="px-4 py-3">İşlemi Yapan Rol</th>
              <th className="px-4 py-3">Eylem</th>
              <th className="px-4 py-3">Koleksiyon</th>
              <th className="px-4 py-3">Kayıt ID</th>
              <th className="px-4 py-3">Detaylar</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {logs.map((log) => {
              const formattedTime = log.createdAt?.toDate
                ? log.createdAt.toDate().toLocaleString('tr-TR')
                : new Date().toLocaleString('tr-TR');

              return (
                <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3 text-slate-500 whitespace-nowrap font-mono">{formattedTime}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-block px-2.5 py-0.5 rounded text-[10px] font-black ${
                        log.actorRole === 'ADMIN'
                          ? 'bg-[#FFD000] text-[#092B60]'
                          : log.actorRole === 'OPERATOR'
                          ? 'bg-[#EAF3FF] text-[#092B60] border border-blue-200'
                          : 'bg-amber-100 text-amber-900 border border-amber-300'
                      }`}
                    >
                      {log.actorRole}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-bold text-slate-800">{log.action}</td>
                  <td className="px-4 py-3 font-mono text-slate-600">{log.collection}</td>
                  <td className="px-4 py-3 font-mono text-slate-400 text-[10px] truncate max-w-[100px]">
                    {log.documentId}
                  </td>
                  <td className="px-4 py-3 text-slate-600 max-w-[200px] truncate font-mono text-[11px]">
                    {log.newValues ? JSON.stringify(log.newValues) : '-'}
                  </td>
                </tr>
              );
            })}

            {logs.length === 0 && (
              <tr>
                <td colSpan={6} className="p-8 text-center text-slate-400">
                  Henüz bir işlem kaydı bulunmuyor. Talepler veya araç durumu güncellendikçe burada listelenir.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
