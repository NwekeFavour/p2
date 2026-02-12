const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

async function generateCertificatePDF(data) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: "A4", layout: "landscape", margin: 50 });
      const dirPath = path.join(__dirname, '../certificates');
      const filePath = path.join(dirPath, `${data.certificateId}.pdf`);

      if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
      }

      const stream = fs.createWriteStream(filePath);
      doc.pipe(stream);

      // --- PDF Design ---
      doc.rect(0, 0, doc.page.width, doc.page.height).fill('#ffffff');
      doc.rect(20, 20, doc.page.width - 40, doc.page.height - 40).lineWidth(5).stroke('#4f39f6');

      doc.moveDown(4);
      doc.fillColor('#4f39f6').fontSize(45).text("KNOWNLY", { align: "center" });
      doc.fillColor('#111827').fontSize(30).text("Certificate of Completion", { align: "center" });

      doc.moveDown(2);
      doc.fontSize(20).text(`This is to certify that`, { align: "center" });
      doc.fontSize(35).font('Helvetica-Bold').text(data.name, { align: 'center' });
      
      doc.moveDown(1);
      doc.font('Helvetica').fontSize(18).text(
        `has successfully completed the ${data.level || 'Professional'} ${data.track} program`,
        { align: "center" }
      );

      if (data.specialization) {
        doc.fontSize(16).fillColor('#4f39f6').text(`Specialization: ${data.specialization}`, { align: "center" });
      }

      doc.moveDown(3);
      doc.fillColor('#9ca3af').fontSize(12).text(`Issued on: ${new Date().toLocaleDateString()}`, { align: "center" });
      doc.text(`Certificate ID: ${data.certificateId}`, { align: "center" });

      doc.end();

      // --- Wait for stream to finish before returning ---
      stream.on('finish', () => resolve(filePath));
      stream.on('error', (err) => reject(err));

    } catch (err) {
      reject(err);
    }
  });
}

// THE MISSING LINK:
module.exports = generateCertificatePDF;