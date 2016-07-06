var
  should = require('should'),
  PluginStore = require.main.require('lib/store/Plugin');

describe('Test: store/Plugin', function () {
  var
    dummyPluginExist = {protocol: 'exists', dummy: 'data'},
    dummyPluginDoesNotExist = {protocol: 'doesnotexist', dummy: 'data'},
    dummyInvalidPlugin = {notAProtocol: 'invalid', dummy: 'data'};

  it('constructor must initialize plugins', () => {
    var pluginStore = new PluginStore();

    should(pluginStore.plugins).be.an.Object();
  });


  it('method add must add an item to the plugins', () => {
    var pluginStore = new PluginStore();

    pluginStore.add(dummyPluginExist);

    should(pluginStore.plugins[dummyPluginExist.protocol]).be.deepEqual(dummyPluginExist);
  });

  it('method add must not add an item if invalid', () => {
    var pluginStore = new PluginStore();

    pluginStore.add(dummyInvalidPlugin);

    should(Object.keys(pluginStore.plugins).length).be.eql(0);
  });

  it('method getByProtocol must return an item if plugin exists', () => {
    var pluginStore = new PluginStore();
    
    pluginStore.plugins = {[dummyPluginExist.protocol]: dummyPluginExist };

    should(pluginStore.getByProtocol(dummyPluginExist.protocol)).be.deepEqual(dummyPluginExist);
  });

  it('method getByProtocol must return undefined if plugin does not exist', () => {
    var pluginStore = new PluginStore();

    pluginStore.plugins = {[dummyPluginExist.protocol]: dummyPluginExist};

    should(pluginStore.getByProtocol(dummyPluginDoesNotExist.protocol)).be.undefined();
  });

  it('method count must count the number of declared plugins properly', () => {
    var pluginStore = new PluginStore();

    pluginStore.plugins = {[dummyPluginExist.protocol]: dummyPluginExist};

    should(pluginStore.count()).be.eql(1);
  });
});
