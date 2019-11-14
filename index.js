const fs = require('fs')
const moment = require('moment')

const SLOWLORIS_DEFAULT = true
const RATELIMIT_DEFAULT = true
const LOGGING_DEFAULT = false

const logSession = new Date().toISOString()
const logStream = fs.createWriteStream('/tmp/express-requests-' + logSession + '.log', {flags:'a'})

const _interval = 3000 // milliseconds to check number of requests
const _limit = 3 // limit for requests within interval
let _rlAddressToRequests = {}

const formatMoment = (moment) => {
  return moment.format()
}

const addAddressToRequests = (address, requests, startRequestAt) => {
  _rlAddressToRequests[address] = { requests, startRequestAt }
}

const logRateLimiting = (moment, address, interval, requests, status) => {
  logStream.write('[' + formatMoment(moment) + ']{ Address: ' + address + ', interval: ' + interval + 'ms, requests: ' + requests + ', status: ' + status + ' }\n')
}

const rateLimiting = (req, res, next) => {
  const address = req.connection.remoteAddress
  const now = moment()
  const addressObject = _rlAddressToRequests[address]
  if (!addressObject) {
    addAddressToRequests(address, 1, now)
    return next()
  }

  let requests = addressObject.requests
  const startRequestAt = addressObject.startRequestAt
  const diffSeconds = now.diff(startRequestAt)
  if (diffSeconds < _interval && requests > _limit) {
    addAddressToRequests(address, requests + 1, now)
    logRateLimiting(_rlAddressToRequests[address].startRequestAt, address, _interval, _rlAddressToRequests[address].requests, 'ended')
    return res.end()
  } else if (diffSeconds < _interval) {
    addAddressToRequests(address, requests + 1, startRequestAt)
  } else {
    addAddressToRequests(address, 1, now)
  }
  logRateLimiting(_rlAddressToRequests[address].startRequestAt, address, _interval, _rlAddressToRequests[address].requests, 'ok')
  return next()
}

const getAddresses = () => {
  return _rlAddressToRequests
}

module.exports = {
  rateLimiting,
  getAddresses
}

dostroy = config => {
  const slowloris = config.slowloris ? config.slowloris : SLOWLORIS_DEFAULT
  const rateLimit = config.rateLimit ? config.rateLimit : RATELIMIT_DEFAULT
  const logging = config.logging ? config.logging : LOGGING_DEFAULT

  return function dostroy(req, res, next) {}

}

module.exports = dostroy