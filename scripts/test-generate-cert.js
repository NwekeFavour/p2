const generate = require('../utils/generateCertificatePDF');
(async () => {
  const sample = {
    certificateId: 'TEST-001',
    name: 'Jane Doe',
    track: 'Data Science',
    level: 'Advanced',
    issued_date: '17 February 2026'
  };

  try {
    const out = await generate(sample);
    console.log('GENERATED:', out);
  } catch (err) {
    console.error('ERROR:', err);
    process.exit(1);
  }
})();
