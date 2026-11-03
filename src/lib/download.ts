import { isNative } from './platform';

/** Saves a Blob from the API: a normal download in browsers, the share sheet in the Android app. */
export async function saveBlob(blob: Blob, filename: string) {
  if (isNative) return shareOnPhone(blob, filename);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Android WebView can't download blobs: write to app cache, then open the share sheet (WhatsApp, Drive, Files…). */
async function shareOnPhone(blob: Blob, filename: string) {
  const [{ Filesystem, Directory }, { Share }] = await Promise.all([import('@capacitor/filesystem'), import('@capacitor/share')]);
  const data = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1] ?? '');
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
  const { uri } = await Filesystem.writeFile({ path: filename, data, directory: Directory.Cache });
  await Share.share({ title: filename, url: uri, dialogTitle: 'Save or share' });
}
