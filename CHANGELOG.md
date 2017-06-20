# [1.0.0](https://github.com/kuzzleio/kuzzle-proxy/releases/tag/1.0.0) (2017-06-20)

### Compatibility

| Kuzzle | Proxy |
|--------|-------|
| 1.0.0 | 1.0.0 |

#### Bug fixes

- [ [#85](https://github.com/kuzzleio/kuzzle-proxy/pull/85) ] Deny to activate a new backend if another one is already active.   ([ballinette](https://github.com/ballinette))
- [ [#83](https://github.com/kuzzleio/kuzzle-proxy/pull/83) ] Close client connection when no backend left   ([stafyniaksacha](https://github.com/stafyniaksacha))
- [ [#75](https://github.com/kuzzleio/kuzzle-proxy/pull/75) ] Add an error message when there is no kuzzle instance   ([dbengsch](https://github.com/dbengsch))
- [ [#74](https://github.com/kuzzleio/kuzzle-proxy/pull/74) ] Filter volatile instead of metadata in access logs   ([dbengsch](https://github.com/dbengsch))
- [ [#68](https://github.com/kuzzleio/kuzzle-proxy/pull/68) ] Fix http client connection leak   ([stafyniaksacha](https://github.com/stafyniaksacha))
- [ [#63](https://github.com/kuzzleio/kuzzle-proxy/pull/63) ] Fixes #62 - empty errors coming from proxy   ([benoitvidis](https://github.com/benoitvidis))

#### New features

- [ [#72](https://github.com/kuzzleio/kuzzle-proxy/pull/72) ] Add support for Kuzzle graceful shutdown   ([scottinet](https://github.com/scottinet))

#### Enhancements

- [ [#77](https://github.com/kuzzleio/kuzzle-proxy/pull/77) ] Add request headers to request.context   ([ballinette](https://github.com/ballinette))
- [ [#69](https://github.com/kuzzleio/kuzzle-proxy/pull/69) ] Remove stack from error   ([AnthonySendra](https://github.com/AnthonySendra))

#### Others

- [ [#79](https://github.com/kuzzleio/kuzzle-proxy/pull/79) ] Fix 836 ghost rooms   ([benoitvidis](https://github.com/benoitvidis))
- [ [#71](https://github.com/kuzzleio/kuzzle-proxy/pull/71) ] Improve debug function to allow toggle one/multiple lines   ([stafyniaksacha](https://github.com/stafyniaksacha))
- [ [#58](https://github.com/kuzzleio/kuzzle-proxy/pull/58) ] Update node prerequisite in package.json   ([scottinet](https://github.com/scottinet))
- [ [#57](https://github.com/kuzzleio/kuzzle-proxy/pull/57) ] Remove unused bluebird dependency   ([scottinet](https://github.com/scottinet))
---

*__note:__ the # at the end of lines are the pull request numbers on GitHub*

# 1.0.0-RC9

* https://github.com/kuzzleio/kuzzle-proxy/releases/tag/1.0.0-RC9

### Breaking changes

* Plugin: full refactoring of the plugin management and installation: #52
* Protocols: Websocket and Socket.io protocols are now embed within the core and listen to the same port as HTTP (7512 by default) #48

# 1.0.0-RC8

* https://github.com/kuzzleio/kuzzle-proxy/releases/tag/1.0.0-RC8

# 1.0.0-RC6

* https://github.com/kuzzleio/kuzzle-proxy/releases/tag/1.0.0-RC6

# 1.0.0-RC5

* https://github.com/kuzzleio/kuzzle-proxy/releases/tag/1.0.0-RC5

# 1.0.0-RC4

* Use the new Kuzzle plugin context format (see https://github.com/kuzzleio/kuzzle/pull/316) #11
* Improve code coverage to 100% #9

# 1.0.0-RC3

* Replace 'server' by 'backend' terminology when referring to a Kuzzle backend  #6
* Proxy communication with Kuzzle #4
* Added kuzzle-common-objects #2
* Start Proxy implementation
