var
  rewire = require('rewire'),
  should = require('should'),
  sinon = require('sinon').sandbox.create(),
  PluginPackage = rewire('../../lib/plugins/package');

describe('lib/plugins/package', () => {
  afterEach(() => {
    sinon.restore();
  });

  describe('#constructor', () => {
    it('should set properties and call setDefinition', () => {
      var
        definition = {foo: 'bar'},
        pkg;

      sinon.stub(PluginPackage.prototype, 'setDefinition');

      pkg = new PluginPackage('plugin', definition);

      should(pkg.name).be.exactly('plugin');
      should(pkg.activated).be.true();

      should(pkg.setDefinition)
        .be.calledOnce()
        .be.calledWith(definition);
    });
  });

  describe('#setDefinition', () => {
    it('should set whitelisted properties', () => {
      var pkg = new PluginPackage('plugin');

      pkg.setDefinition({
        path: 'path',
        foo: 'bar'
      });

      should(pkg.path).be.exactly('path');
      should(pkg)
        .not.have.property('foo');
    });
  });

  describe('#isInstalled', () => {
    it('should return true if the packages.json can be found', () => {
      var
        pkg = new PluginPackage('plugin'),
        response;

      response = pkg.isInstalled();
      should(response).be.false();

      PluginPackage.__with__({
        require: sinon.spy()
      })(() => {
        should(pkg.isInstalled())
          .be.true();
      });
    });
  });

  describe('#needsInstall', () => {
    it('should return true if the plugin is not installed', () => {
      var pkg = new PluginPackage('plugin');

      should(pkg.needsInstall())
        .be.true();
    });

    it('should rely on compareVersion if the plugin is installed', () => {
      var pkg = new PluginPackage('plugin');

      pkg.isInstalled = () => true;
      pkg.localConfiguration = () => {
        return {
          version: 'localVersion'
        };
      };
      pkg.version = 'pkgVersion';

      PluginPackage.__with__({
        compareVersions: sinon.spy()
      })(() => {
        pkg.needsInstall();

        should(PluginPackage.__get__('compareVersions'))
          .be.calledOnce()
          .be.calledWith('pkgVersion', 'localVersion');
      });
    });
  });

  describe('#localConfiguration', () => {
    it('should return the configuration taken from packages.json', () => {
      var
        conf = {foo: 'bar'},
        pkg = new PluginPackage('plugin');

      PluginPackage.__with__({
        require: sinon.stub().returns(conf)
      })(() => {
        var response = pkg.localConfiguration();

        should(response).be.exactly(conf);
      });

    });
  });

  describe('#install', () => {
    it('should install from npm', () => {
      var
        pkg = new PluginPackage('plugin');

      return PluginPackage.__with__({
        exec: sinon.stub().yields()
      })(() => {
        return pkg.install()
          .then(() => {
            should(PluginPackage.__get__('exec'))
              .be.calledOnce()
              .be.calledWith('npm install plugin');
          });
      });
    });

    it('should install from path', () => {
      var
        pkg = new PluginPackage('plugin');

      pkg.path = 'path';

      return PluginPackage.__with__({
        exec: sinon.stub().yields()
      })(() => {
        return pkg.install()
          .then(() => {
            should(PluginPackage.__get__('exec'))
              .be.calledOnce()
              .be.calledWith('npm install path');
          });
      });
    });

    it('should install from url', () => {
      var
        pkg = new PluginPackage('plugin');

      pkg.url = 'url';

      return PluginPackage.__with__({
        exec: sinon.stub().yields()
      })(() => {
        return pkg.install()
          .then(() => {
            should(PluginPackage.__get__('exec'))
              .be.calledOnce()
              .be.calledWith('npm install url');
          });
      });
    });

    it('should handle comitish versions', () => {
      var
        pkg = new PluginPackage('plugin');

      pkg.url = 'repo.git';
      pkg.version = 'version';

      return PluginPackage.__with__({
        exec: sinon.stub().yields()
      })(() => {
        return pkg.install()
          .then(() => {
            should(PluginPackage.__get__('exec'))
              .be.calledOnce()
              .be.calledWith('npm install repo.git#version');
          });
      });
    });

    it('should handle npm versions', () => {
      var
        pkg = new PluginPackage('plugin');

      pkg.version = 'version';

      return PluginPackage.__with__({
        exec: sinon.stub().yields()
      })(() => {
        return pkg.install()
          .then(() => {
            should(PluginPackage.__get__('exec'))
              .be.calledOnce()
              .be.calledWith('npm install plugin@version');
          });
      });
    });

    it('should discard version for remote installs', () => {
      var
        pkg = new PluginPackage('plugin');

      pkg.url = 'http://somewhere';
      pkg.version = 'version';

      return PluginPackage.__with__({
        exec: sinon.stub().yields()
      })(() => {
        return pkg.install()
          .then(() => {
            should(PluginPackage.__get__('exec'))
              .be.calledOnce()
              .be.calledWith('npm install http://somewhere');
          });
      });
    });
  });
});
