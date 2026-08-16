/**
 * Read the AliExpress affiliate portal's order export.
 *
 * The API sync and the portal count the same thing at the same grain — one row per
 * SUB-order — so a mismatch ("the portal says 67, the system says 66") is answerable
 * exactly: which sub-order id is in the file and not in the DB. Answering it by eye means
 * reading 67 nineteen-digit numbers twice, which is how a missing order stays missing.
 *
 * Tolerant on purpose: the owner may paste the whole CSV, a few columns of it, or just a
 * list of ids copied out of the portal. Anything that yields ids is accepted, and rows
 * that yield none are skipped rather than failing the whole file.
 */

export interface PortalRow {
  sub_order_id: string;
  order_id: string;
  product_id: string;
  title: string;
  /** The portal's own commission estimate, for the report line. */
  commission_usd: number;
  amount_usd: number;
  paid_at: string;
  status: string;
}

/** An AliExpress order / sub-order id: a long digit run. Short numbers are prices. */
const ID_RE = /\b\d{15,22}\b/g;

/** Split ONE csv line, honouring "quoted, fields" and "" escapes. */
export function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"') {
        if (line[i + 1] === '"') { cur += '"'; i++; } else quoted = false;
      } else cur += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') { out.push(cur); cur = ''; }
    else cur += ch;
  }
  out.push(cur);
  return out.map((v) => v.trim());
}

const num = (v: string | undefined) => {
  const n = parseFloat(String(v ?? '').replace(/[^0-9.\-]/g, ''));
  return Number.isFinite(n) ? n : 0;
};

/**
 * Parse the export. With a header row the columns are read by name; without one, every
 * line contributes its long digit runs (first = order, second = sub-order, matching the
 * portal's own column order).
 */
export function parsePortalCsv(text: string): PortalRow[] {
  const lines = String(text || '')
    .replace(/^﻿/, '')
    .split(/\r?\n/)
    .filter((l) => l.trim());
  if (!lines.length) return [];

  const header = splitCsvLine(lines[0]).map((h) => h.toLowerCase().replace(/[\s_]/g, ''));
  const idx = (...names: string[]) => {
    for (const n of names) {
      const i = header.indexOf(n.toLowerCase().replace(/[\s_]/g, ''));
      if (i >= 0) return i;
    }
    return -1;
  };
  const iSub = idx('suborderid');
  const iOrder = idx('orderid');

  const rows: PortalRow[] = [];
  const seen = new Set<string>();
  const push = (r: PortalRow) => {
    // The portal exports each sub-order once; a duplicate id means the owner pasted an
    // overlapping range twice. Counting it twice would invent a discrepancy.
    if (!r.sub_order_id || seen.has(r.sub_order_id)) return;
    seen.add(r.sub_order_id);
    rows.push(r);
  };

  if (iSub >= 0) {
    const iProduct = idx('productid');
    const iTitle = idx('producttitle');
    const iComm = idx('estimatedpaymentscommission', 'estimatedcompletedcommission');
    const iAmount = idx('completedpaymentsamount', 'completedorderamount');
    const iPaid = idx('completedpaymentstime');
    const iStatus = idx('orderstatus');
    for (const line of lines.slice(1)) {
      const c = splitCsvLine(line);
      push({
        sub_order_id: (c[iSub] || '').replace(/\D/g, ''),
        order_id: iOrder >= 0 ? (c[iOrder] || '').replace(/\D/g, '') : '',
        product_id: iProduct >= 0 ? (c[iProduct] || '').replace(/\D/g, '') : '',
        title: iTitle >= 0 ? (c[iTitle] || '') : '',
        commission_usd: iComm >= 0 ? num(c[iComm]) : 0,
        amount_usd: iAmount >= 0 ? num(c[iAmount]) : 0,
        paid_at: iPaid >= 0 ? (c[iPaid] || '') : '',
        status: iStatus >= 0 ? (c[iStatus] || '') : '',
      });
    }
    return rows;
  }

  // Headerless: ids only. One id on the line IS the sub-order (that is what a copied
  // list holds); two or more follow the portal's order → sub-order column order.
  for (const line of lines) {
    const ids = line.match(ID_RE) || [];
    if (!ids.length) continue;
    push({
      sub_order_id: ids.length > 1 ? ids[1] : ids[0],
      order_id: ids.length > 1 ? ids[0] : '',
      product_id: '', title: '', commission_usd: 0, amount_usd: 0, paid_at: '', status: '',
    });
  }
  return rows;
}
