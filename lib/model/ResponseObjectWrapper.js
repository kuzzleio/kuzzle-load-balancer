/**
 * Mokes a ResponseObject for plugins
 * @param {Object} dataObject
 * @constructor
 */
function ResponseObjectWrapper (dataObject) {
  this.dataObject = dataObject;
}

/**
 * Returns the content previously set with the constructor
 * @returns {Object}
 */
ResponseObjectWrapper.prototype.toJson = function () {
  return this.dataObject;
};

module.exports = ResponseObjectWrapper;