
module.exports = {

  version: require('./package.json').version,

  Chrome: require('./src/chrome-proc'),

  Tab: require('./src/chrome-tab')

};
