import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';

/** Saves a downloaded export (CSV/PDF) and opens the share sheet, or triggers a browser download on web. */
export async function saveAndShare({ blob, fileName, contentType }: { blob: Blob; fileName: string; contentType: string }): Promise<string> {
  if (Platform.OS === 'web') {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
    return fileName;
  }
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const file = new File(Paths.cache, fileName);
  if (file.exists) file.delete();
  file.create();
  file.write(bytes);
  if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(file.uri, { mimeType: contentType, dialogTitle: fileName });
  return file.uri;
}
