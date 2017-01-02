'use strict';

const
  inherits = require('util').inherits,
  Busboy = require('busboy');


/**
 * @returns {HttpFormDataStream}
 * @constructor
 * @param {Object} opts
 * @param {Object} payload
 */
function HttpFormDataStream (opts, payload) {
  Busboy.call(this, opts);
  this.content = {};

  this.on('file', (fieldname, file, filename, encoding, mimetype) => {
    let fileBuffer = Buffer.from('');

    file.on('data', chunk => {
      fileBuffer = Buffer.concat([fileBuffer, chunk], fileBuffer.length + chunk.length);
    });

    file.on('end', () => {
      this.content[fieldname] = {
        filename: filename,
        encoding: encoding,
        mimetype: mimetype,
        file: fileBuffer.toString('base64')
      };
    });

  });

  this.on('field', (fieldname, val) => {
    this.content[fieldname] = val;
  });

  this.on('end', () => {
    payload.content = JSON.stringify(this.content);
  });

  return this;
}

inherits(HttpFormDataStream, Busboy);

module.exports = HttpFormDataStream;