// Electron supplies its own bridge. Browsers use the local HTTP server.
if (!window.localtrace) {
  const client = crypto.randomUUID();
  async function request(operation: string, data: unknown = {}) {
    const response = await fetch(`/api/${operation}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-LocalTrace-Client': client },
      body: JSON.stringify(data),
    });
    const result = await response.json();
    if (!response.ok) throw Error(result.error || 'LocalTrace request failed');
    return result;
  }
  function base64(bytes: Uint8Array) {
    let text = '';
    for (let i = 0; i < bytes.length; i += 32768) text += String.fromCharCode(...bytes.subarray(i, i + 32768));
    return btoa(text);
  }
  function download(blob: Blob, name: string) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url; link.download = name; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  }
  window.localtrace = {
    prepare: (bytes, count, options) => request('prepare', { bytes: base64(bytes), count, options }),
    trace: (bytes, settings) => request('trace', { bytes: base64(bytes), settings }),
    cancel: () => request('cancel'),
    merge: (doc, ids) => request('merge', { doc, ids }),
    importSVG: text => request('import-svg', { text }),
    openProject: () => new Promise((resolve, reject) => {
      const input = document.createElement('input');
      input.type = 'file'; input.accept = '.json,.localtrace.json';
      input.addEventListener('cancel', () => resolve(null), { once: true });
      input.onchange = async () => {
        try {
          const file = input.files?.[0];
          if (!file) return resolve(null);
          if (file.size > 120e6) throw Error('Project exceeds 120 MB limit');
          resolve(await request('project', JSON.parse(await file.text())));
        } catch (error) { reject(error); }
      };
      input.click();
    }),
    save: async (doc, kind, layerId) => {
      if (kind.startsWith('project')) {
        await request('project', doc);
        download(new Blob([JSON.stringify(doc, null, 2)], { type: 'application/json' }), 'artwork.localtrace.json');
      } else if (kind === 'pdf') {
        const print = window.open('', '_blank');
        if (!print) throw Error('Allow popups to print or save a PDF');
        try {
          const { text } = await request('export', { doc, kind, layerId });
          const model = doc as import('./model').Document;
          const margin = model.registrationMarks ? 10 : 0;
          print.document.write(`<html><head><title>LocalTrace PDF</title><style>@page{size:${model.physicalWidth + margin}mm ${model.physicalWidth * model.height / model.width + margin}mm;margin:0}body{margin:0}svg{display:block}</style></head><body>${text}</body></html>`);
          print.document.close();
          print.focus(); print.print();
        } catch (error) { print.close(); throw error; }
      } else {
        const result = await request('export', { doc, kind, layerId });
        if (kind === 'colors') {
          if (!result.length) throw Error('No visible colors to export');
          download(zip(result), 'LocalTrace-colors.zip');
        } else if (kind === 'png') {
          download(new Blob([Uint8Array.from(atob(result.base64), c => c.charCodeAt(0))], { type: 'image/png' }), 'artwork.png');
        } else download(new Blob([result.text], { type: kind === 'svg' ? 'image/svg+xml' : 'application/dxf' }), `artwork.${kind}`);
      }
      return true;
    },
  };
}

// Stored ZIP entries avoid multiple-download browser prompts for color exports.
function zip(files: { name: string; text: string }[]) {
  const parts: Uint8Array<ArrayBuffer>[] = [], directory: Uint8Array<ArrayBuffer>[] = [];
  let offset = 0, directorySize = 0;
  const header = (size: number) => new Uint8Array(size);
  for (const file of files) {
    const name = new TextEncoder().encode(file.name), data = new TextEncoder().encode(file.text);
    let crc = 0xffffffff;
    for (const byte of data) { crc ^= byte; for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0); }
    crc = (crc ^ 0xffffffff) >>> 0;
    const local = header(30 + name.length), l = new DataView(local.buffer);
    l.setUint32(0, 0x04034b50, true); l.setUint16(4, 20, true); l.setUint16(12, 33, true);
    l.setUint32(14, crc, true); l.setUint32(18, data.length, true); l.setUint32(22, data.length, true); l.setUint16(26, name.length, true); local.set(name, 30);
    const central = header(46 + name.length), c = new DataView(central.buffer);
    c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint16(14, 33, true);
    c.setUint32(16, crc, true); c.setUint32(20, data.length, true); c.setUint32(24, data.length, true); c.setUint16(28, name.length, true); c.setUint32(42, offset, true); central.set(name, 46);
    parts.push(local, data); directory.push(central); offset += local.length + data.length; directorySize += central.length;
  }
  const end = header(22), e = new DataView(end.buffer);
  e.setUint32(0, 0x06054b50, true); e.setUint16(8, files.length, true); e.setUint16(10, files.length, true); e.setUint32(12, directorySize, true); e.setUint32(16, offset, true);
  return new Blob([...parts, ...directory, end], { type: 'application/zip' });
}
