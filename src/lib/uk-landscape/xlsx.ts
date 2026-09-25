/* ═══════════════════════════════════════════════════════════════════
   A MINIMAL XLSX WRITER

   Enough of the format to produce a clean three-sheet workbook: bold
   header row, frozen header, column widths, thousands-separated
   numbers. Nothing more.

   WHY HAND-ROLLED. This project has four runtime dependencies and no
   spreadsheet library, and the environment this was built in has no
   outbound network to add one. Rather than ship a fake "Open in Google
   Sheets" button or make James open a CSV, the ~150 lines below write
   the format directly. An .xlsx is a zip of XML; Node already has the
   deflate.

   Strings are written inline (t="inlineStr") rather than through a
   shared-strings table — slightly larger, considerably less to get
   wrong, and irrelevant at a couple of hundred rows.

   The output is verified by reading it back with a real spreadsheet
   library rather than by trusting that it looked right.
   ═══════════════════════════════════════════════════════════════════ */

import { deflateRawSync } from 'zlib';

/** A plain value, or a cell that is a hyperlink. */
export type Link = { text: string; link: string };
export type Cell = string | number | Link | null | undefined;

export const isLink = (v: Cell): v is Link =>
  !!v && typeof v === 'object' && 'link' in v;

export type Sheet = {
  name: string;
  headers: string[];
  rows: Cell[][];
  /** Column widths in Excel character units, in header order. */
  widths?: number[];
};

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Excel sheet names: 31 chars, and : \ / ? * [ ] are illegal. */
const safeName = (s: string) => s.replace(/[:\\/?*[\]]/g, ' ').slice(0, 31);

const colName = (n: number): string => {
  let s = '';
  let i = n;
  while (i > 0) {
    const r = (i - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    i = Math.floor((i - 1) / 26);
  }
  return s;
};

/* ── zip ──────────────────────────────────────────────────────── */

const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[i] = c;
  }
  return t;
})();

function crc32(buf: Buffer): number {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

type Entry = { name: string; data: Buffer };

function zip(entries: Entry[]): Buffer {
  const locals: Buffer[] = [];
  const centrals: Buffer[] = [];
  let offset = 0;

  for (const e of entries) {
    const nameBuf = Buffer.from(e.name, 'utf8');
    const comp = deflateRawSync(e.data, { level: 9 });
    const crc = crc32(e.data);

    const local = Buffer.alloc(30 + nameBuf.length);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4); // version needed
    local.writeUInt16LE(0, 6); // flags
    local.writeUInt16LE(8, 8); // deflate
    local.writeUInt16LE(0, 10); // time
    local.writeUInt16LE(0x21, 12); // date — 1 Jan 1980
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(comp.length, 18);
    local.writeUInt32LE(e.data.length, 22);
    local.writeUInt16LE(nameBuf.length, 26);
    local.writeUInt16LE(0, 28);
    nameBuf.copy(local, 30);
    locals.push(local, comp);

    const central = Buffer.alloc(46 + nameBuf.length);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0, 8);
    central.writeUInt16LE(8, 10);
    central.writeUInt16LE(0, 12);
    central.writeUInt16LE(0x21, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(comp.length, 20);
    central.writeUInt32LE(e.data.length, 24);
    central.writeUInt16LE(nameBuf.length, 28);
    central.writeUInt16LE(0, 30);
    central.writeUInt16LE(0, 32);
    central.writeUInt16LE(0, 34);
    central.writeUInt16LE(0, 36);
    central.writeUInt32LE(0, 38);
    central.writeUInt32LE(offset, 42);
    nameBuf.copy(central, 46);
    centrals.push(central);

    offset += local.length + comp.length;
  }

  const centralBuf = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralBuf.length, 12);
  end.writeUInt32LE(offset, 16);
  end.writeUInt16LE(0, 20);

  return Buffer.concat([...locals, centralBuf, end]);
}

/* ── sheet xml ────────────────────────────────────────────────── */

/* Style ids, in the order they are declared in styles.xml:
     0  default
     1  bold header
     2  number, #,##0                                            */
const S_HEADER = 1;
const S_NUMBER = 2;
const S_LINK = 3;

function sheetXml(s: Sheet): { xml: string; rels: string | null } {
  const ncols = s.headers.length;
  const cols = s.widths
    ? `<cols>${s.widths
        .map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`)
        .join('')}</cols>`
    : '';

  const links: { ref: string; rid: string; target: string }[] = [];
  const rows: string[] = [];
  rows.push(
    `<row r="1" ht="20" customHeight="1">${s.headers
      .map((h, i) => `<c r="${colName(i + 1)}1" s="${S_HEADER}" t="inlineStr"><is><t>${esc(h)}</t></is></c>`)
      .join('')}</row>`,
  );
  s.rows.forEach((r, ri) => {
    const rn = ri + 2;
    const cells = r
      .map((v, ci) => {
        const ref = `${colName(ci + 1)}${rn}`;
        if (v == null || v === '') return '';
        if (isLink(v)) {
          links.push({ ref, rid: `rId${links.length + 1}`, target: v.link });
          return `<c r="${ref}" s="${S_LINK}" t="inlineStr"><is><t>${esc(v.text)}</t></is></c>`;
        }
        if (typeof v === 'number' && Number.isFinite(v)) {
          return `<c r="${ref}" s="${S_NUMBER}"><v>${v}</v></c>`;
        }
        return `<c r="${ref}" t="inlineStr"><is><t>${esc(String(v))}</t></is></c>`;
      })
      .join('');
    rows.push(`<row r="${rn}">${cells}</row>`);
  });

  /* hyperlinks must sit AFTER sheetData and autoFilter, and each needs a
     relationship in the sheet's own .rels part. */
  const hyperlinks = links.length
    ? `<hyperlinks>${links
        .map((l) => `<hyperlink ref="${l.ref}" r:id="${l.rid}"/>`)
        .join('')}</hyperlinks>`
    : '';
  const rels = links.length
    ? `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${links
        .map(
          (l) =>
            `<Relationship Id="${l.rid}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink" Target="${esc(l.target)}" TargetMode="External"/>`,
        )
        .join('')}</Relationships>`
    : null;

  const xml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheetViews><sheetView workbookViewId="0" showGridLines="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/><selection pane="bottomLeft" activeCell="A2" sqref="A2"/></sheetView></sheetViews><sheetFormatPr defaultRowHeight="15"/>${cols}<sheetData>${rows.join('')}</sheetData><autoFilter ref="A1:${colName(ncols)}${s.rows.length + 1}"/>${hyperlinks}</worksheet>`;
  return { xml, rels };
}

const STYLES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><numFmts count="1"><numFmt numFmtId="164" formatCode="#,##0"/></numFmts><fonts count="3"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font><font><u/><sz val="11"/><color rgb="FF0563C1"/><name val="Calibri"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF1F3864"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="4"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment vertical="center"/></xf><xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/><xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`;

/** Build a workbook. Returns the raw .xlsx bytes. */
export function buildXlsx(sheets: Sheet[]): Buffer {
  const names = sheets.map((s) => safeName(s.name));

  const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>${sheets
    .map(
      (_, i) =>
        `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`,
    )
    .join('')}<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`;

  const rootRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`;

  const workbook = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${names
    .map((n, i) => `<sheet name="${esc(n)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`)
    .join('')}</sheets></workbook>`;

  const wbRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets
    .map(
      (_, i) =>
        `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`,
    )
    .join('')}<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`;

  const entries: Entry[] = [
    { name: '[Content_Types].xml', data: Buffer.from(contentTypes, 'utf8') },
    { name: '_rels/.rels', data: Buffer.from(rootRels, 'utf8') },
    { name: 'xl/workbook.xml', data: Buffer.from(workbook, 'utf8') },
    { name: 'xl/_rels/workbook.xml.rels', data: Buffer.from(wbRels, 'utf8') },
    { name: 'xl/styles.xml', data: Buffer.from(STYLES, 'utf8') },
  ];
  sheets.forEach((s, i) => {
    const { xml, rels } = sheetXml(s);
    entries.push({ name: `xl/worksheets/sheet${i + 1}.xml`, data: Buffer.from(xml, 'utf8') });
    if (rels) {
      entries.push({
        name: `xl/worksheets/_rels/sheet${i + 1}.xml.rels`,
        data: Buffer.from(rels, 'utf8'),
      });
    }
  });

  return zip(entries);
}
