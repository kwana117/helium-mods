// Minimal zip writer (no compression), enough to download the theme as one
// file when the Mac helper is not installed. files: [{ name, data: Uint8Array }].

const Zip = (() => {
  const tabela = new Uint32Array(256).map((_, n) => {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
  });
  const crc32 = (d) => {
    let c = 0xffffffff;
    for (let i = 0; i < d.length; i++) c = tabela[(c ^ d[i]) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };

  function criar(files) {
    const enc = new TextEncoder();
    const partes = [];
    const centrais = [];
    let offset = 0;
    for (const f of files) {
      const nome = enc.encode(f.name);
      const crc = crc32(f.data);
      const local = new DataView(new ArrayBuffer(30));
      local.setUint32(0, 0x04034b50, true);
      local.setUint16(4, 20, true);
      local.setUint16(8, 0, true); // sem compressão
      local.setUint32(14, crc, true);
      local.setUint32(18, f.data.length, true);
      local.setUint32(22, f.data.length, true);
      local.setUint16(26, nome.length, true);
      partes.push(new Uint8Array(local.buffer), nome, f.data);

      const central = new DataView(new ArrayBuffer(46));
      central.setUint32(0, 0x02014b50, true);
      central.setUint16(4, 20, true);
      central.setUint16(6, 20, true);
      central.setUint32(16, crc, true);
      central.setUint32(20, f.data.length, true);
      central.setUint32(24, f.data.length, true);
      central.setUint16(28, nome.length, true);
      central.setUint32(42, offset, true);
      centrais.push(new Uint8Array(central.buffer), nome);
      offset += 30 + nome.length + f.data.length;
    }
    const tamanhoCentral = centrais.reduce((s, p) => s + p.length, 0);
    const fim = new DataView(new ArrayBuffer(22));
    fim.setUint32(0, 0x06054b50, true);
    fim.setUint16(8, files.length, true);
    fim.setUint16(10, files.length, true);
    fim.setUint32(12, tamanhoCentral, true);
    fim.setUint32(16, offset, true);
    return new Blob([...partes, ...centrais, new Uint8Array(fim.buffer)], { type: "application/zip" });
  }

  return { criar };
})();
