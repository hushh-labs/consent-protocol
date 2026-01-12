import { Capacitor } from "@capacitor/core";
import { toast } from "sonner";

/**
 * Cross-platform file download utility
 * 
 * - Native (iOS/Android): Uses Capacitor Filesystem to save to Documents
 * - Web: Uses standard blob download
 * 
 * Non-breaking: Falls back to web method if native fails
 */
export async function downloadTextFile(
  content: string,
  filename: string
): Promise<boolean> {
  // Try native download first on Capacitor
  if (Capacitor.isNativePlatform()) {
    try {
      // Dynamic import to avoid bundling issues on web
      const { Filesystem, Directory, Encoding } = await import(
        "@capacitor/filesystem"
      );

      await Filesystem.writeFile({
        path: filename,
        data: content,
        directory: Directory.Documents,
        encoding: Encoding.UTF8,
      });

      const platform = Capacitor.getPlatform();
      const location = platform === "ios" ? "Files app" : "Documents folder";
      toast.success(`Saved to ${location}`, {
        description: filename,
      });
      return true;
    } catch (error) {
      console.warn("[Download] Native save failed, trying web fallback:", error);
      // Fall through to web method
    }
  }

  // Web fallback (also used if native fails)
  try {
    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    return true;
  } catch (error) {
    console.error("[Download] All download methods failed:", error);
    toast.error("Failed to download file");
    return false;
  }
}
