const assert = require('assert');
const plugin = require('../src/index.js');

describe('sanitizeFolderName', function() {
  it('should remove leading and trailing slashes', function() {
    const result = plugin.sanitizeFolderName('/images/');
    assert.strictEqual(result, 'images');
  });

  it('should sanitize invalid characters', function() {
    const result = plugin.sanitizeFolderName('inva|id/name');
    assert.strictEqual(result, 'inva_id_name');
  });
});
