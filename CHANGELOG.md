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

# [1.0.0-RC9](https://github.com/kuzzleio/kuzzle-proxy/releases/tag/1.0.0-RC9) (2017-02-10)

#### Others

- [ [#56](https://github.com/kuzzleio/kuzzle-proxy/pull/56) ] Release 1.0.0-RC9   ([ballinette](https://github.com/ballinette))
- [ [#55](https://github.com/kuzzleio/kuzzle-proxy/pull/55) ] Improve protocol settings + use requestMaxSize for all protocols   ([ballinette](https://github.com/ballinette))
- [ [#48](https://github.com/kuzzleio/kuzzle-proxy/pull/48) ] Feature #40 merge http ws ports   ([ballinette](https://github.com/ballinette))
- [ [#52](https://github.com/kuzzleio/kuzzle-proxy/pull/52) ] Plugin installation refactor   ([xbill82](https://github.com/xbill82))
- [ [#51](https://github.com/kuzzleio/kuzzle-proxy/pull/51) ] Develop add debug mode   ([stafyniaksacha](https://github.com/stafyniaksacha))
- [ [#50](https://github.com/kuzzleio/kuzzle-proxy/pull/50) ] Fix #49: incorrect stringified Buffer detection in raw responses   ([scottinet](https://github.com/scottinet))
- [ [#47](https://github.com/kuzzleio/kuzzle-proxy/pull/47) ] Http multipart/form-data support to enable file uploads   ([ballinette](https://github.com/ballinette))
- [ [#44](https://github.com/kuzzleio/kuzzle-proxy/pull/44) ] Access logs   ([benoitvidis](https://github.com/benoitvidis))
---

# [1.0.0-RC8](https://github.com/kuzzleio/kuzzle-proxy/releases/tag/1.0.0-RC9) (2016-12-20)

#### Others

- [ [#43](https://github.com/kuzzleio/kuzzle-proxy/pull/43) ] Kuzzle #586: dynamic http options   ([scottinet](https://github.com/scottinet))
- [ [#41](https://github.com/kuzzleio/kuzzle-proxy/pull/41) ] Response headers handling - remove double JSON stringification   ([benoitvidis](https://github.com/benoitvidis))
- [ [#38](https://github.com/kuzzleio/kuzzle-proxy/pull/38) ] Fixes #37 - Add support for http headers   ([benoitvidis](https://github.com/benoitvidis))
- [ [#35](https://github.com/kuzzleio/kuzzle-proxy/pull/35) ] New request model   ([scottinet](https://github.com/scottinet))
- [ [#36](https://github.com/kuzzleio/kuzzle-proxy/pull/36) ] Add support for HTTP OPTIONS requests   ([scottinet](https://github.com/scottinet))
- [ [#34](https://github.com/kuzzleio/kuzzle-proxy/pull/34) ] Migrate node-uuid to uuid   ([scottinet](https://github.com/scottinet))
- [ [#32](https://github.com/kuzzleio/kuzzle-proxy/pull/32) ] PluginsInstall was not removed after refactor   ([dbengsch](https://github.com/dbengsch))
- [ [#33](https://github.com/kuzzleio/kuzzle-proxy/pull/33) ] Shrinkwrap is unstable   ([dbengsch](https://github.com/dbengsch))
- [ [#30](https://github.com/kuzzleio/kuzzle-proxy/pull/30) ] Build shrinkwrap from the current dependency state   ([dbengsch](https://github.com/dbengsch))
- [ [#31](https://github.com/kuzzleio/kuzzle-proxy/pull/31) ] HTTP Performances   ([scottinet](https://github.com/scottinet))
- [ [#29](https://github.com/kuzzleio/kuzzle-proxy/pull/29) ] 26 27 networkoptions and plugins install   ([benoitvidis](https://github.com/benoitvidis))
- [ [#28](https://github.com/kuzzleio/kuzzle-proxy/pull/28) ] 26 27 networkoptions and plugins install   ([benoitvidis](https://github.com/benoitvidis))
- [ [#24](https://github.com/kuzzleio/kuzzle-proxy/pull/24) ] Container refactor   ([stafyniaksacha](https://github.com/stafyniaksacha))
---

# [1.0.0-RC6](https://github.com/kuzzleio/kuzzle-proxy/releases/tag/1.0.0-RC6) (2016-05-10)

#### Others

- [ [#21](https://github.com/kuzzleio/kuzzle-proxy/pull/21) ] [Develop] Updated pluginConfig with websocket example   ([jenow](https://github.com/jenow))
- [ [#20](https://github.com/kuzzleio/kuzzle-proxy/pull/20) ] [master] Updated pluginConfig with websocket example   ([jenow](https://github.com/jenow))
- [ [#19](https://github.com/kuzzleio/kuzzle-proxy/pull/19) ] KUZ-664: rejects connections if no kuzzle instance is available   ([scottinet](https://github.com/scottinet))
---

# [1.0.0-RC5](https://github.com/kuzzleio/kuzzle-proxy/releases/tag/1.0.0-RC5) (2016-08-05)

#### Others

- [ [#18](https://github.com/kuzzleio/kuzzle-proxy/pull/18) ] General improvements   ([scottinet](https://github.com/scottinet))
- [ [#16](https://github.com/kuzzleio/kuzzle-proxy/pull/16) ] Replace q by bluebird   ([dbengsch](https://github.com/dbengsch))
- [ [#14](https://github.com/kuzzleio/kuzzle-proxy/pull/14) ] Introduced an infinite loop when handling the backend connection close   ([dbengsch](https://github.com/dbengsch))
- [ [#13](https://github.com/kuzzleio/kuzzle-proxy/pull/13) ] Fixes #12 Enable local plugin config override   ([benoitvidis](https://github.com/benoitvidis))
---


# [1.0.0-RC4](https://github.com/kuzzleio/kuzzle-proxy/releases/tag/1.0.0-RC4) (2016-07-07)

#### Others

- [ [#11](https://github.com/kuzzleio/kuzzle-proxy/pull/11) ] KUZ-599: refactor plugin context   ([scottinet](https://github.com/scottinet))
- [ [#9](https://github.com/kuzzleio/kuzzle-proxy/pull/9) ] KUZ-584 : Coverage of 100%, yeah :)   ([dbengsch](https://github.com/dbengsch))
---


# [1.0.0-RC3](https://github.com/kuzzleio/kuzzle-proxy/releases/tag/1.0.0-RC3) (2016-06-15)

#### Others

- [ [#8](https://github.com/kuzzleio/kuzzle-proxy/pull/8) ] KUZ-591 Remove load-balancer functionalities from the proxy.   ([dbengsch](https://github.com/dbengsch))
- [ [#7](https://github.com/kuzzleio/kuzzle-proxy/pull/7) ] Rename load-balancer by proxy   ([dbengsch](https://github.com/dbengsch))
- [ [#6](https://github.com/kuzzleio/kuzzle-proxy/pull/6) ] Replace 'server' by 'backend' terminology when referring to a Kuzzle backend   ([dbengsch](https://github.com/dbengsch))
- [ [#4](https://github.com/kuzzleio/kuzzle-proxy/pull/4) ] LB communication with Kuzzle   ([AnthonySendra](https://github.com/AnthonySendra))
- [ [#5](https://github.com/kuzzleio/kuzzle-proxy/pull/5) ] [Fix] Bad in hard path for node module   ([dbengsch](https://github.com/dbengsch))
- [ [#1](https://github.com/kuzzleio/kuzzle-proxy/pull/1) ] Initialization of CI stack   ([dbengsch](https://github.com/dbengsch))
- [ [#3](https://github.com/kuzzleio/kuzzle-proxy/pull/3) ] Add request rejection if the corresponding server die   ([stafyniaksacha](https://github.com/stafyniaksacha))
- [ [#2](https://github.com/kuzzleio/kuzzle-proxy/pull/2) ] Added kuzzle-common-objects   ([jenow](https://github.com/jenow))
---
