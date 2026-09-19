export class BrowserProjectFiles {
  async read(file: File): Promise<Uint8Array> {
    return new Uint8Array(await file.arrayBuffer());
  }

  download(bytes: Uint8Array, filename: string): void {
    const blob = new Blob([Uint8Array.from(bytes)], { type: "application/zip" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.style.display = "none";
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    queueMicrotask(() => URL.revokeObjectURL(url));
  }
}

export function projectArchiveFilename(projectName: string): string {
  const safe = projectName
    .normalize("NFKD")
    .replace(/[^\p{Letter}\p{Number}._-]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return `${safe || "hawya-project"}.hawya`;
}
