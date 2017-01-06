'use strict';

const
  inherits = require('util').inherits,
  Busboy = require('busboy');


/**
 * @returns {HttpFormDataStream}
 * @constructor
 * @param {Object} opts
 * @param {Object} payload
 * @param {Function} throwSizeLimitError
 */
function HttpFormDataStream (opts, payload, throwSizeLimitError) {
  Busboy.call(this, opts);
  payload.json = {};

  this.on('file', (fieldname, file, filename, encoding, mimetype) => {
    let fileBuffer = Buffer.from('');

    file.on('data', chunk => {
      fileBuffer = Buffer.concat([fileBuffer, chunk], fileBuffer.length + chunk.length);
    });

    file.on('limit', () => {
      throwSizeLimitError();
    });

    file.on('end', () => {
      payload.json[fieldname] = {
        filename: filename,
        encoding: encoding,
        mimetype: mimetype,
        file: fileBuffer.toString('base64')
      };
    });

  });

  this.on('field', (fieldname, val) => {
    payload.json[fieldname] = val;
  });

  return this;
}

inherits(HttpFormDataStream, Busboy);

module.exports = HttpFormDataStream;