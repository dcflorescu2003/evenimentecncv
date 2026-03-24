import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { toast } from 'sonner';

/**
 * Utilitar pentru descărcarea de fișiere care funcționează și pe Web și pe aplicația mobilă (Capacitor Android/iOS).
 * 
 * @param filename Numele fișierului de salvat (ex: "raport.pdf", "date.csv")
 * @param base64Data Conținutul fișierului în format Base64 (fără prefixul data:mime/type;base64,)
 * @param mimeType Tipul MIME pentru web fallback (ex: "application/pdf", "text/csv")
 */
export async function downloadFileMobileSafe(filename: string, base64Data: string, mimeType: string) {
  if (Capacitor.isNativePlatform()) {
    try {
      // Pe mobil (Android 11+) scrierea directă în Documents este restricționată sever.
      // Cel mai sigur este să scriem temporar în Cache și să deschidem dialogul nativ de Share/Save.
      const savedFile = await Filesystem.writeFile({
        path: filename,
        data: base64Data,
        directory: Directory.Cache,
      });
      
      await Share.share({
        title: filename,
        url: savedFile.uri,
        dialogTitle: 'Salvează sau trimite fișierul'
      });
      
      toast.success(`Fișier procesat: ${filename}`);
    } catch (error) {
      console.error("Eroare la procesarea fișierului pe mobil:", error);
      toast.error("Eroare la descărcarea sau partajarea fișierului.");
    }
  } else {
    // Pe web, convertim base64 în Blob și declanșăm descărcarea clasică
    try {
      const byteCharacters = atob(base64Data);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: mimeType });
      
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Eroare la descărcarea fișierului pe web:", error);
      toast.error("Eroare la generarea fișierului.");
    }
  }
}
