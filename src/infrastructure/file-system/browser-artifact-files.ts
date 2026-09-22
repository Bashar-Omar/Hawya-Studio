import type { ExportArtifact } from "@/domain/export/export-contract";

export class BrowserArtifactFiles {
  download(artifact: ExportArtifact): void {
    const blob = new Blob([Uint8Array.from(artifact.bytes)], { type: artifact.mime });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = artifact.filename;
    anchor.style.display = "none";
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    queueMicrotask(() => URL.revokeObjectURL(url));
  }
}
