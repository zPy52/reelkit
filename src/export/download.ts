export class SubmoduleExportServiceDownload {
  public createUrl(blob: Blob): string {
    if (typeof URL.createObjectURL !== 'function') {
      throw new Error('Blob URLs are not supported in this environment.');
    }

    return URL.createObjectURL(blob);
  }

  public trigger(blob: Blob, filename: string): string {
    if (typeof document === 'undefined') {
      throw new Error('Downloads require a DOM-enabled environment.');
    }

    const url = this.createUrl(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.style.display = 'none';

    const container = document.body ?? document.documentElement;
    container.appendChild(anchor);
    anchor.click();
    anchor.remove();

    return url;
  }
}
