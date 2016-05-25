/**
 * Mokes a ResponseObject for plugins
 * @param {Object} dataObject
 * @constructor
 */
function ResponseObject (dataObject) {
  this.dataObject = dataObject;
}

/**
 * Returns the content previously set with the constructor
 * @returns {Object}
 */
ResponseObject.prototype.toJson = function () {
  return this.dataObject;
};

module.exports = ResponseObject;