import { Capacitor } from "@capacitor/core";
import { toast } from "sonner";

/**
 * Cross-platform file download utility
 *
 * - Native (iOS/Android): Uses Capacitor Filesystem + Share sheet
 *   - Writes to Cache directory (always accessible)
 *   - Opens native share sheet for user to save/share
 * - Web: Uses standard blob download
 *
 * Non-breaking: Falls back to web method if native fails
 */
export async function downloadTextFile(
  content: string,
  filename: string
): Promise<boolean> {
  console.log("[Download] Starting download for:", filename);
  console.log("[Download] Platform:", Capacitor.getPlatform());
  console.log("[Download] Is native:", Capacitor.isNativePlatform());

  // Try native download with share sheet on Capacitor
  if (Capacitor.isNativePlatform()) {
    try {
      // Dynamic imports to avoid bundling issues on web
      const { Filesystem, Directory, Encoding } = await import(
        "@capacitor/filesystem"
      );
      const { Share } = await import("@capacitor/share");

      console.log("[Download] Writing file to Cache directory...");

      // 1. Write file to Cache directory (always accessible on both platforms)
      const result = await Filesystem.writeFile({
        path: filename,
        data: content,
        directory: Directory.Cache,
        encoding: Encoding.UTF8,
      });

      console.log("[Download] File written successfully:", result.uri);

      // 2. Check if sharing is available
      const canShare = await Share.canShare();
      console.log("[Download] Can share:", canShare.value);

      if (canShare.value) {
        // 3. Open native share sheet
        console.log("[Download] Opening share sheet...");
        await Share.share({
          title: "Save Recovery Key",
          text: "Your Hushh recovery key - store this securely!",
          url: result.uri,
          dialogTitle: "Save your recovery key",
        });

        console.log("[Download] Share sheet completed");
        toast.success("Recovery key ready to save", {
          description: "Choose where to save your recovery key",
        });
        return true;
      } else {
        // Share not available, show file location
        const platform = Capacitor.getPlatform();
        const location = platform === "ios" ? "app cache" : "app cache";
        console.log("[Download] Share not available, file saved to:", location);
        toast.success(`File saved to ${location}`, {
          description: filename,
        });
        return true;
      }
    } catch (error) {
      console.warn(
        "[Download] Native save/share failed, trying web fallback:",
        error
      );
      // Fall through to web method
    }
  }

  // Web fallback (also used if native fails)
  try {
    console.log("[Download] Using web fallback...");
    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    console.log("[Download] Web download triggered");
    return true;
  } catch (error) {
    console.error("[Download] All download methods failed:", error);
    toast.error("Failed to download file");
    return false;
  }
}
