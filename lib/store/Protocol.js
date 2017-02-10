/**
 * Protocol store constructor
 *
 * @constructor
 */
function Protocol() {
  /** @type {Object[]} protocols */
  this.protocols = {};
}

/**
 * Add a protocol to the store
 *
 * @param {string} protocol name
 * @param protocol
 */
Protocol.prototype.add = function (name, protocol) {
  this.protocols[name] = protocol;
};

/**
 * Get a protocol by its name
 *
 * @param {string} protocol name
 * @returns {Object|undefined}
 */
Protocol.prototype.get = function (name) {
  return this.protocols[name];
};

/**
 * Return the count of protocols
 *
 * @returns {Number}
 */
Protocol.prototype.count = function () {
  return Object.keys(this.protocols).length;
};

module.exports = Protocol;