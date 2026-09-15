import type { BackupPayload } from './api';

export async function saveBackupFile(backup: BackupPayload) {
  const fileName = `paygauge-backup-${new Date().toISOString().slice(0, 10)}.json`;
  const contents = JSON.stringify(backup, null, 2);

  if (typeof window !== 'undefined') {
    window.localStorage.setItem('paygauge.lastBackupAt', new Date().toISOString());
  }

  try {
    const [{ Filesystem, Directory, Encoding }, { Share }] = await Promise.all([
      import('@capacitor/filesystem'),
      import('@capacitor/share'),
    ]);
    const result = await Filesystem.writeFile({
      path: fileName,
      data: contents,
      directory: Directory.Documents,
      encoding: Encoding.UTF8,
    });
    await Share.share({
      title: 'PayGauge Backup',
      text: 'PayGauge loan and payment backup',
      url: result.uri,
      dialogTitle: 'Save or share PayGauge backup',
    });
    return 'Saved to phone storage and opened share sheet.';
  } catch {
    const blob = new Blob([contents], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    link.click();
    URL.revokeObjectURL(url);
    return 'Downloaded backup file.';
  }
}

export function readBackupFile(file: File) {
  return new Promise<BackupPayload>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        resolve(JSON.parse(String(reader.result)) as BackupPayload);
      } catch (error) {
        reject(error);
      }
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}

export function getLastBackupLabel() {
  if (typeof window === 'undefined') return 'Never';
  const lastBackupAt = window.localStorage.getItem('paygauge.lastBackupAt');
  if (!lastBackupAt) return 'Never';
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(lastBackupAt));
}
