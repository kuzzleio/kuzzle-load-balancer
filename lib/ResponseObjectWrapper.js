module.exports = function(dataObject) {
  this.dataObject = dataObject;

  this.toJson = function () {
    return dataObject;
  };
};