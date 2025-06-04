const assert = require('assert');
const plugin = require('../src/index.js');

describe('sanitizeFilename', function() {
  it('should sanitize invalid characters', function() {
    const result = plugin.sanitizeFilename('inva|id:name?.png');
    assert.strictEqual(result, 'inva_id_name_.png');
  });
});
