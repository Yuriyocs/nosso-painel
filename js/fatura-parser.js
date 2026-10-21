/* Leitor de faturas de cartão: Bradesco (PDF), Itaú (PDF), Nubank (PDF e CSV).
   Funções puras: recebem o texto posicionado de cada página (ou o texto do CSV) e devolvem os lançamentos.
   Resultado: { banco, venc:'aaaa-mm-dd'|null, total, cartao, titular, itens:[{dm, data, desc, valor, credito, parcela:{p,n}|null, dataFixa}] } */
(function (global) {
  'use strict';
  const MONEY = /^-?\d{1,3}(\.\d{3})*,\d{2}(\s*-)?$/;
  const toNum = s => parseFloat(String(s).replace(/[^\d,]/g, '').replace(',', '.'));
  const MESES = { JAN: '01', FEV: '02', MAR: '03', ABR: '04', MAI: '05', JUN: '06', JUL: '07', AGO: '08', SET: '09', OUT: '10', NOV: '11', DEZ: '12' };

  /* agrupa os itens em linhas (mesma altura) e ordena da esquerda para a direita */
  function linhas(items) {
    const v = items.filter(i => i.str && i.str.trim()).sort((a, b) => b.y - a.y || a.x - b.x);
    const ls = [];
    v.forEach(i => {
      const l = ls[ls.length - 1];
      if (l && Math.abs(l.y - i.y) <= 2.5) l.push(i); else { const n = [i]; n.y = i.y; ls.push(n); }
    });
    ls.forEach(l => l.sort((a, b) => a.x - b.x));
    return ls;
  }

  /* dd/mm -> aaaa-mm-dd: a compra nunca é depois do vencimento da fatura */
  function ano(dm, venc) {
    if (!venc) return null;
    const [d, m] = dm.split('/');
    let y = +venc.slice(0, 4);
    if (`${y}-${m}-${d}` > venc) y -= 1;
    return `${y}-${m}-${d}`;
  }

  /* tira "Parcela 3/12", "- 1/2" ou "04/12" do fim do nome */
  function extrairParcela(desc) {
    desc = desc.replace(/^Pix no Cr[eé]dito\s*-\s*/i, '');
    const pad = [/\s*-?\s*Parcela\s+(\d{1,2})\/(\d{1,2})\s*$/i, /\s+-\s+(\d{1,2})\/(\d{1,2})\s*$/, /\s*(\d{2})\/(\d{2})\s*$/];
    for (let k = 0; k < pad.length; k++) {
      const m = desc.match(pad[k]);
      if (!m) continue;
      const p = +m[1], n = +m[2];
      if (n >= 2 && n <= 60 && p >= 1 && p <= n && (k < 2 || desc.length > 6)) return { desc: desc.slice(0, m.index).trim(), parcela: { p, n } };
    }
    return { desc: desc.trim(), parcela: null };
  }

  function finalizar(out) {
    out.itens.forEach(it => {
      const r = extrairParcela(it.desc.replace(/\s+/g, ' ').trim());
      it.desc = r.desc || it.desc; it.parcela = r.parcela;
      if (!it.data) it.data = ano(it.dm, out.venc);
    });
    return out;
  }

  /* ---------- PDF ---------- */
  function parsePdf(pages) {
    const textoPag = pages.map(items => linhas(items).map(l => l.map(i => i.str).join(' ')).join('\n'));
    const tudo = textoPag.join('\n');
    let out;
    if (/Nu Pagamentos|Nubank/i.test(tudo)) out = nubank(pages, tudo);
    else if (/Bradesco/i.test(tudo)) out = bradesco(pages, tudo);
    else if (/Ita[uú]/i.test(tudo)) out = itau(pages, tudo);
    else out = { banco: null, venc: null, total: null, cartao: null, itens: [] };
    out.titular = textoPag[0] || '';
    return finalizar(out);
  }

  function bradesco(pages, tudo) {
    const out = { banco: 'Bradesco', venc: null, total: null, cartao: null, itens: [] };
    const mv = tudo.match(/Vencimento[\s\S]{0,400}?(\d{2})\/(\d{2})\/(\d{4})/);
    if (mv) out.venc = `${mv[3]}-${mv[2]}-${mv[1]}`;
    const mt = tudo.match(/Total da fatura em real\s*R?\$?\s*([\d.]+,\d{2})/i) || tudo.match(/Total de fatura[\s\S]{0,200}?R\$\s*([\d.]+,\d{2})/i);
    if (mt) out.total = toNum(mt[1]);
    const mc = tudo.match(/(\d{4})\s+X{4}\s+X{4}\s+(\d{4})/);
    if (mc) out.cartao = mc[2];
    pages.forEach(items => {
      const cab = items.find(i => /^Cidade$/.test(i.str));
      const lim = items.find(i => /^Limites$/.test(i.str));
      const cidadeX = cab ? cab.x : 204, corte = lim ? lim.x - 6 : 355;
      let ant = null;
      linhas(items).forEach(l => {
        const esq = l.filter(i => i.x < corte), d = esq[0];
        if (d && d.x < 60 && /^\d{2}\/\d{2}$/.test(d.str.trim())) {
          const valorIt = [...esq].reverse().find(i => i.x >= 290 && MONEY.test(i.str.trim()));
          if (!valorIt) { ant = null; return; }
          let desc = esq.filter(i => i !== d && i !== valorIt && i.x < cidadeX - 25).map(i => i.str.trim()).join(' ');
          desc = desc.replace(/\s+\d[\d.]*,\d{2}\b.*$/, '');                 // valor em moeda estrangeira
          const it = { dm: d.str.trim(), desc, valor: toNum(valorIt.str), credito: /-\s*$/.test(valorIt.str.trim()) };
          out.itens.push(it); ant = it;
        } else if (ant && esq.length === 1 && /^\d$/.test(esq[0].str.trim()) && /\d{2}\/0$/.test(ant.desc)) {
          ant.desc += esq[0].str.trim(); ant = null;                          // "04/0" + "4" quebrado em duas linhas
        } else ant = null;
      });
    });
    return out;
  }

  function itau(pages, tudo) {
    const out = { banco: 'Itaú', venc: null, total: null, cartao: null, itens: [] };
    const mv = tudo.match(/Vencimento:?\s*(\d{2})\/(\d{2})\/(\d{4})/);
    if (mv) out.venc = `${mv[3]}-${mv[2]}-${mv[1]}`;
    const mt = tudo.match(/Total desta fatura\s*R?\$?\s*([\d.]+,\d{2})/i);
    if (mt) out.total = toNum(mt[1]);
    const mc = tudo.match(/(\d{4})\.X{4}\.X{4}\.(\d{4})/);
    if (mc) out.cartao = mc[2];
    let ativo = false, fim = false;
    pages.forEach(items => {
      linhas(items).forEach(l => {
        if (fim) return;
        const esq = l.filter(i => i.x < 345), txt = esq.map(i => i.str).join('');
        if (/Lan.{0,3}amentos:/i.test(txt)) { ativo = true; return; }
        if (/Total dos lan.{0,3}amentos atuais/i.test(txt)) { fim = true; return; }   // depois vêm só as parcelas das próximas faturas
        if (!ativo) return;
        const d = esq[0];
        if (!(d && d.x < 150 && /^\d{2}\/\d{2}$/.test(d.str.trim()))) return;
        const valorIt = [...esq].reverse().find(i => i.x >= 290 && MONEY.test(i.str.trim()));
        if (!valorIt) return;
        const desc = esq.filter(i => i !== d && i !== valorIt && i.x < 285).map(i => i.str.trim()).join(' ');
        out.itens.push({ dm: d.str.trim(), desc, valor: toNum(valorIt.str), credito: /^-|-\s*$/.test(valorIt.str.trim()) });
      });
    });
    return out;
  }

  function nubank(pages, tudo) {
    const out = { banco: 'Nubank', venc: null, total: null, cartao: null, itens: [] };
    const mv = tudo.match(/FATURA\s+(\d{2})\s+([A-Z]{3})\s+(\d{4})/);
    if (mv && MESES[mv[2]]) out.venc = `${mv[3]}-${MESES[mv[2]]}-${mv[1]}`;
    const mt = tudo.match(/no valor de\s*R\$\s*([\d.]+,\d{2})/i);
    if (mt) out.total = toNum(mt[1]);
    const re = /^(\d{2})\s+(JAN|FEV|MAR|ABR|MAI|JUN|JUL|AGO|SET|OUT|NOV|DEZ)\s+(?:•+\s*\d{4}\s+)?(.+?)\s+([−-])?\s*R\$\s*([\d.]+,\d{2})$/;
    pages.forEach(items => linhas(items).forEach(l => {
      const m = l.map(i => i.str.trim()).join(' ').match(re);
      if (!m) return;
      out.itens.push({ dm: `${m[1]}/${MESES[m[2]]}`, desc: m[3], valor: toNum(m[5]), credito: !!m[4] });
    }));
    return out;
  }

  /* ---------- CSV do Nubank: date,title,amount ---------- */
  function csvLinhas(texto) {
    const rows = []; let row = [], cur = '', q = false;
    texto = texto.replace(/^﻿/, '');
    for (let i = 0; i < texto.length; i++) {
      const c = texto[i];
      if (q) { if (c === '"') { if (texto[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += c; }
      else if (c === '"') q = true;
      else if (c === ',') { row.push(cur); cur = ''; }
      else if (c === '\n' || c === '\r') { if (c === '\r' && texto[i + 1] === '\n') i++; row.push(cur); cur = ''; if (row.some(x => x.trim())) rows.push(row); row = []; }
      else cur += c;
    }
    row.push(cur); if (row.some(x => x.trim())) rows.push(row);
    return rows;
  }
  function parseCsv(texto, nome) {
    const rows = csvLinhas(texto);
    const out = { banco: 'Nubank', venc: null, total: null, cartao: null, titular: '', itens: [] };
    if (!rows.length || !/date/i.test(rows[0][0]) || !/title/i.test(rows[0][1] || '') || !/amount/i.test(rows[0][2] || '')) return out;
    const mn = String(nome || '').match(/(\d{4})-(\d{2})-(\d{2})/);
    if (mn) out.venc = `${mn[1]}-${mn[2]}-${mn[3]}`;
    rows.slice(1).forEach(r => {
      const md = String(r[0]).trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
      const v = String(r[2] || '').replace(/\s+/g, '');
      if (!md || !/^-?[\d.]*,?\d+$/.test(v)) return;
      out.itens.push({ dm: `${md[3]}/${md[2]}`, data: r[0].trim(), dataFixa: true, desc: String(r[1]).trim(), valor: Math.abs(toNum(v)), credito: v.startsWith('-') });
    });
    return finalizar(out);
  }

  global.FaturaParser = { parsePdf, parseCsv, parse: parsePdf, ano };
  if (typeof module !== 'undefined' && module.exports) module.exports = global.FaturaParser;
})(typeof window !== 'undefined' ? window : globalThis);
