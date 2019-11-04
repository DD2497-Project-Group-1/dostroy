const fs = require('fs')

const logSession = new Date().toISOString()
const logStream = fs.createWriteStream('/tmp/express-requests-' + logSession + '.log', {flags:'a'})

let _requests = 0

module.exports = {
  countRequests: function(req, res, next) {
    _requests++
    const now = new Date()
    logStream.write('Connection requested at: ' + now + ', connection attempt: ' + _requests + '\n')
    next()
  },
  getRequests: function() {
    const requests = _requests
    return requests
  }
}
