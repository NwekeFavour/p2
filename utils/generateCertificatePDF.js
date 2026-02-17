'use strict';

const PDFDocument = require('pdfkit');
const fs          = require('fs');
const path        = require('path');

// ── Palette ────────────────────────────────────────────────────────────────
const PURPLE      = '#51455d';
const PURPLE_ACC  = '#7c6da1';
const PURPLE_PALE = '#ede9f4';
const PURPLE_LITE = '#b8aecf';
const GOLD        = '#c9a84c';
const GOLD_DARK   = '#8b6320';
const GOLD_LITE   = '#f0d484';
const CHARCOAL    = '#1a1a2e';
const GREY_TEXT   = '#4b4460';
const LIGHT_TEXT  = '#9c8fad';
const OFF_WHITE   = '#faf9fc';

// ── Geometry helpers ───────────────────────────────────────────────────────

/** Letter-spaced centred text */
function spacedText(doc, text, cx, y, gap = 5) {
  const total = [...text].reduce((s, ch) => s + doc.widthOfString(ch), 0) + gap * (text.length - 1);
  let x = cx - total / 2;
  for (const ch of text) {
    doc.text(ch, x, y, { lineBreak: false });
    x += doc.widthOfString(ch) + gap;
  }
}

/** Gold diamond-flanked divider */
function goldDivider(doc, cx, y, hw = 85) {
  doc.save()
    .strokeColor(GOLD).lineWidth(0.9)
    .moveTo(cx - hw, y).lineTo(cx - 9, y).stroke()
    .moveTo(cx + 9, y).lineTo(cx + hw, y).stroke();
  // centre diamond
  doc.save().translate(cx, y).rotate(45)
    .rect(-3.5, -3.5, 7, 7).fillColor(GOLD).fill()
    .restore();
  doc.restore();
}

// ── Background & structural layers ────────────────────────────────────────

function drawBackground(doc) {
  const W = doc.page.width, H = doc.page.height;

  // Off-white base
  doc.rect(0, 0, W, H).fill(OFF_WHITE);

  // Top-left triangle
  doc.save().path(`M 0 0 L 340 0 L 0 220 Z`).fill(PURPLE).restore();

  // Top-right accent
  doc.save().path(`M ${W} 0 L ${W - 200} 0 L ${W} 130 Z`).fill(PURPLE_ACC).restore();

  // Bottom-right triangle
  doc.save().path(`M ${W} ${H} L ${W - 320} ${H} L ${W} ${H - 240} Z`).fill(PURPLE).restore();

  // Bottom-left accent
  doc.save().path(`M 0 ${H} L 160 ${H} L 0 ${H - 100} Z`).fill(PURPLE_ACC).restore();
}

function drawInnerPanel(doc) {
  const W = doc.page.width, H = doc.page.height, m = 48;
  // White card
  doc.roundedRect(m, m, W - 2 * m, H - 2 * m, 4).fill('white');
  // Outer rule
  doc.roundedRect(m, m, W - 2 * m, H - 2 * m, 4)
    .lineWidth(1.8).strokeColor(PURPLE).stroke();
  // Inner rule
  doc.roundedRect(m + 7, m + 7, W - 2 * (m + 7), H - 2 * (m + 7), 2)
    .lineWidth(0.55).strokeColor(PURPLE_ACC).stroke();
}

function drawCornerOrnaments(doc) {
  const W = doc.page.width, H = doc.page.height, m = 54;
  const corners = [
    [m,     H - m, 0],
    [W - m, H - m, 90],
    [m,     m,     -90],
    [W - m, m,     180],
  ];
  for (const [cx, cy, rot] of corners) {
    doc.save().translate(cx, cy).rotate(rot)
      .strokeColor(GOLD).lineWidth(2)
      .moveTo(0, 0).lineTo(26, 0).stroke()
      .moveTo(0, 0).lineTo(0, 26).stroke()
      .circle(26, 0, 2.5).fillColor(GOLD).fill()
      .circle(0, 26, 2.5).fill()
      .restore();
  }
}

function drawSideDots(doc) {
  const H = doc.page.height;
  const groups = [[72, H / 2 + 12], [doc.page.width - 92, H / 2 + 12]];
  for (const [bx, by] of groups) {
    for (let r = 0; r < 5; r++) {
      for (let col = 0; col < 3; col++) {
        doc.circle(bx + col * 13, by - r * 17, 2.6).fillColor(PURPLE_LITE).fill();
      }
    }
  }
}

// ── Gold seal ─────────────────────────────────────────────────────────────

function drawSeal(doc, cx, cy, r = 30) {
  const spikes = 28;
  // Starburst
  for (let i = 0; i < spikes; i++) {
    const a1 = (i * 360 / spikes) * Math.PI / 180;
    const a2 = ((i + 0.5) * 360 / spikes) * Math.PI / 180;
    const a3 = ((i + 1) * 360 / spikes) * Math.PI / 180;
    doc.save()
      .path(`M ${cx} ${cy}
             L ${cx + Math.cos(a1) * r} ${cy + Math.sin(a1) * r}
             L ${cx + Math.cos(a2) * r * 0.76} ${cy + Math.sin(a2) * r * 0.76}
             L ${cx + Math.cos(a3) * r} ${cy + Math.sin(a3) * r} Z`)
      .fillColor(GOLD).fill().restore();
  }
  doc.circle(cx, cy, r * 0.80).fillColor(GOLD).fill();
  doc.circle(cx, cy, r * 0.68).fillColor(GOLD_LITE).fill();
  doc.circle(cx, cy, r * 0.56).fillColor(GOLD).fill();

  // Inner star
  const pts = [];
  for (let i = 0; i < 10; i++) {
    const a = (i * 36 - 90) * Math.PI / 180;
    const rad = i % 2 === 0 ? r * 0.28 : r * 0.13;
    pts.push(`${i === 0 ? 'M' : 'L'} ${cx + Math.cos(a) * rad} ${cy + Math.sin(a) * rad}`);
  }
  doc.path(pts.join(' ') + ' Z').fillColor(GOLD_DARK).fill();

  // Ring text
  doc.fillColor(GOLD_DARK).fontSize(4).font('Helvetica-Bold')
    .text('• KNOWNLY  •  VERIFIED  •  CERTIFIED •', cx - 36, cy - r * 0.86, { lineBreak: false });
}

// ── Signatures ─────────────────────────────────────────────────────────────

/**
 * NF Founder signature — traced from image:
 * Large overlapping oval body, tall ascender loop,
 * three crossing downstrokes, wavy tail to the right.
 */
function drawSignatureNF(doc, ox, oy, sc = 1) {
  // Draw a compact NF monogram-style signature
  doc.save();
  const s = sc;
  doc.translate(ox, oy);
  doc.strokeColor(CHARCOAL).lineCap('round').lineJoin('round');

  // N: diagonal with slight curl
  doc.lineWidth(2.2 * s)
    .moveTo(-36, 18)
    .lineTo(-36, -18)
    .bezierCurveTo(-36, -22, -34, -24, -30, -22)
    .lineTo(0, 12)
    .bezierCurveTo(6, 18, 12, 18, 18, 12)
    .lineTo(18, -18).stroke();

  // F: stylized right of N
  doc.lineWidth(2.0 * s)
    .moveTo(34, -16)
    .lineTo(34, 18)
    .moveTo(34, -16).lineTo(10, -16)
    .moveTo(34, 0).lineTo(16, 0)
    .stroke();

  doc.restore();
}

/**
 * Director signature — traced from image:
 * Dominant large oval, ascending hook, two crossing diagonal slashes,
 * pointed arrow exit right, small downward hook.
 */
function drawSignatureDirector(doc, ox, oy, sc = 1) {
  doc.save();
  const s = sc;
  const t = (x, y) => [ox + x * s, oy + y * s];

  doc.strokeColor(CHARCOAL).lineCap('round').lineJoin('round');

  // Top ascending hook
  doc.lineWidth(1.05 * s)
    .moveTo(...t(30, 0))
    .bezierCurveTo(...t(28, 18), ...t(26, 36), ...t(28, 48))
    .bezierCurveTo(...t(29, 56), ...t(33, 58), ...t(36, 54))
    .bezierCurveTo(...t(38, 50), ...t(36, 42), ...t(32, 38))
    .stroke();

  // Main outer oval
  doc.lineWidth(1.5 * s)
    .moveTo(...t(32, 38))
    .bezierCurveTo(...t(24, 36), ...t(8, 30), ...t(2, 18))
    .bezierCurveTo(...t(-4, 6), ...t(2, -10), ...t(16, -16))
    .bezierCurveTo(...t(30, -22), ...t(50, -16), ...t(58, -2))
    .bezierCurveTo(...t(66, 12), ...t(60, 32), ...t(46, 40))
    .bezierCurveTo(...t(38, 44), ...t(30, 42), ...t(24, 36))
    .stroke();

  // Inner crossing oval
  doc.lineWidth(1.05 * s)
    .moveTo(...t(24, 36))
    .bezierCurveTo(...t(16, 30), ...t(12, 18), ...t(18, 8))
    .bezierCurveTo(...t(24, -2), ...t(40, -4), ...t(48, 6))
    .bezierCurveTo(...t(54, 14), ...t(50, 30), ...t(40, 36))
    .bezierCurveTo(...t(34, 40), ...t(26, 38), ...t(22, 32))
    .stroke();

  // Diagonal slash 1 (longer)
  doc.lineWidth(1.6 * s)
    .moveTo(...t(14, 38))
    .bezierCurveTo(...t(20, 24), ...t(28, 4), ...t(36, -12))
    .stroke();

  // Diagonal slash 2 (shorter, parallel)
  doc.lineWidth(1.25 * s)
    .moveTo(...t(6, 30))
    .bezierCurveTo(...t(16, 20), ...t(30, 8), ...t(44, -4))
    .stroke();

  // Arrow exit right
  doc.lineWidth(1.1 * s)
    .moveTo(...t(54, 12))
    .bezierCurveTo(...t(64, 8), ...t(76, 10), ...t(86, 14))
    .bezierCurveTo(...t(90, 16), ...t(90, 18), ...t(86, 16))
    .stroke();

  // Downward hook at arrow tip
  doc.lineWidth(1.0 * s)
    .moveTo(...t(86, 14))
    .bezierCurveTo(...t(88, 10), ...t(90, 6), ...t(88, 2))
    .bezierCurveTo(...t(86, -2), ...t(82, 0), ...t(84, 4))
    .stroke();

  doc.restore();
}

// ── Main generator ─────────────────────────────────────────────────────────

async function generateCertificatePDF(data) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 0 });
      // set PDF metadata safely without overwriting internal fields
      doc.info = doc.info || {};
      doc.info.Title = `Certificate - ${data.name || 'Recipient'}`;
      doc.info.CreationDate = new Date();

 
      const W  = doc.page.width;   // 841.89
      const H  = doc.page.height;  // 595.28
      const CX = W / 2;
      const M  = 48; // top/side margin used throughout

      // ── Layers ──────────────────────────────────────────────
      drawBackground(doc);
      drawInnerPanel(doc);
      drawCornerOrnaments(doc);
      drawSideDots(doc);


      const chunks = [];
      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', (err) => reject(err));
      // ── Knownly wordmark (top-left purple triangle zone) ────
      doc.fillColor('white').font('Helvetica-Bold').fontSize(13)
        .text('KNOWNLY', M + 10, M + 8, { lineBreak: false });
      doc.fillColor(PURPLE_PALE).font('Helvetica').fontSize(7)
        .text('INTERNSHIP  PROGRAM', M + 10, M + 24, { lineBreak: false });

      // ── CERTIFICATE heading ──────────────────────────────────
      const titleY = M + 80;
      doc.fillColor(PURPLE).font('Times-BoldItalic').fontSize(60);
      spacedText(doc, 'CERTIFICATE', CX, titleY, 6);

      // OF COMPLETION + gold dividers (below the heading)
      const subY = titleY + 60;
      goldDivider(doc, CX, subY + 20, 90);
      doc.fillColor(PURPLE_ACC).font('Times-Italic').fontSize(10);
      spacedText(doc, 'OF COMPLETION', CX, subY, 3);
      goldDivider(doc, CX, subY + 36, 90);

      // ── Presented to (centered, moved slightly)
      const presY = subY + 24;
      // use body width for reliable centering
      const captionW = 520;
      const captionX = CX - captionW / 2;
      doc.fillColor(GREY_TEXT).font('Times-Italic').fontSize(11)
        .text('This certificate is proudly presented to', captionX, presY, { width: captionW, align: 'center', lineBreak: false });

      // ── Recipient name (closer to presented line)
      const nameY = presY + 50;
      doc.fillColor(PURPLE).font('Times-Bold').fontSize(56)
        .text(data.name, captionX, nameY, { width: captionW, align: 'center', lineBreak: false });

      // ── Congratulatory body paragraph ────────────────────────
      const track  = data.track  || 'Full-Stack Development';
      const level  = data.level  || 'Premium';
      const bodyY  = nameY + 80;
      const bodyW  = 520;
      const bodyX  = CX - bodyW / 2;
      const bodyTxt =
        `In recognition of your exceptional dedication, creativity, and perseverance — ` +
        `having successfully completed all eight rigorous stages of the ${level} ${track} ` +
        `Internship Program at Knownly. This remarkable achievement reflects the depth of ` +
        `your professional growth and your unwavering commitment to excellence.`;


      doc.fillColor(GREY_TEXT).font('Helvetica').fontSize(11)
        .text(bodyTxt, bodyX, bodyY, { width: bodyW, align: 'center', lineGap: 3.5 });

      // ── Footer zone (bottom area) — raise signatures a bit
      const footerSigY = H - M - 90;   // y where signature strokes sit (raised)
      const lineY      = footerSigY + 24;    // underline y for signatures (below strokes)
      const labelY     = lineY + 8;    // label text y (below the underline)

      // ── Left: Founder (use director signature for both)
      const sig1cx = CX - 200;
      drawSignatureDirector(doc, sig1cx - 40, footerSigY, 0.95);

      doc.save().strokeColor(PURPLE_LITE).lineWidth(0.65)
        .moveTo(sig1cx - 70, lineY).lineTo(sig1cx + 70, lineY).stroke().restore();

      doc.fillColor(PURPLE).font('Helvetica-Bold').fontSize(7.5);
      spacedText(doc, 'FOUNDER, KNOWNLY', sig1cx, labelY, 1.8);

      // ── Verified badge will sit above the certificate ID/date
      const sealY = H - M - 52;
      drawSeal(doc, CX + 8, sealY, 24);

      // Cert ID & date (below centre area)
      const issued = data.issued_date ||
        new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });
      doc.fillColor(LIGHT_TEXT).font('Helvetica-Bold').fontSize(6.5)
        .text(`CERTIFICATE ID: ${data.certificateId}`, CX - 32, H - M - 36, { lineBreak: false })
        .text(`DATE OF ISSUE: ${issued}`,              CX - 40, H - M - 24, { lineBreak: false });

      // ── Right: Director ──────────────────────────────────────
      const sig2cx = CX + 200;
      drawSignatureDirector(doc, sig2cx - 40, footerSigY, 0.95);

      doc.save().strokeColor(PURPLE_LITE).lineWidth(0.65)
        .moveTo(sig2cx - 70, lineY).lineTo(sig2cx + 70, lineY).stroke().restore();

      doc.fillColor(PURPLE).font('Helvetica-Bold').fontSize(7.5);
      spacedText(doc, 'PROGRAM DIRECTOR', sig2cx, labelY, 1.8);

      // ── Done ─────────────────────────────────────────────────
      doc.end();
    } catch (err) { reject(err); }
  });
}

module.exports = generateCertificatePDF;