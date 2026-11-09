import { db } from '../src/firebase.ts';
import { collection, getDocs, deleteDoc, doc, writeBatch } from 'firebase/firestore';
import fs from 'fs';
import path from 'path';

export async function executeOperationalCleanup() {
  console.log('=== TEDARİK360 - OPERASYONEL VERİ TEMİZLİĞİ BAŞLATILIYOR ===');

  // Operational collections to be purged
  const purgeCollections = [
    'vehicleRequests',
    'requestAssignments',
    'supplierRequestViews',
    'vehicles',
    'vehicleEvents',
    'messages',
    'notifications',
    'auditLogs',
    'dailyRequestDrafts',
  ];

  const results: Record<string, { deleted: number; status: string }> = {};

  for (const colName of purgeCollections) {
    try {
      const snap = await getDocs(collection(db, colName));
      let count = 0;
      
      // Execute deletion in controlled batches of 400
      const docs = snap.docs;
      for (let i = 0; i < docs.length; i += 400) {
        const chunk = docs.slice(i, i + 400);
        const batch = writeBatch(db);
        chunk.forEach((d) => batch.delete(doc(db, colName, d.id)));
        await batch.commit();
        count += chunk.length;
      }
      
      results[colName] = { deleted: count, status: 'SUCCESS' };
      console.log(`[CLEANUP] Purged collection '${colName}': ${count} documents deleted.`);
    } catch (err: any) {
      results[colName] = { deleted: 0, status: `ERROR: ${err.message}` };
      console.error(`[CLEANUP ERROR] Failed to purge '${colName}':`, err.message);
    }
  }

  // Record cleanup execution log
  const logFile = path.join(process.cwd(), 'backups', 'cleanup-execution-report.json');
  fs.writeFileSync(
    logFile,
    JSON.stringify({ executedAt: new Date().toISOString(), results }, null, 2)
  );

  console.log('=== TEMİZLİK BİTTİ. SONUÇ RAPORU KAYDEDİLDİ ===');
  return results;
}

if (process.argv[1]?.endsWith('execute-cleanup.ts')) {
  executeOperationalCleanup().then(() => process.exit(0));
}
