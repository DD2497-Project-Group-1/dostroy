const fs = require('fs')
const moment = require('moment')

const SLOWLORIS_DEFAULT = false // not yet implemented
const RATELIMITING_DEFAULT = false
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

const rateLimiting = (req, res, next, logging) => {
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
    logging && logRateLimiting(_rlAddressToRequests[address].startRequestAt, address, _interval, _rlAddressToRequests[address].requests, 'ended')
    return res.end()
  } else if (diffSeconds < _interval) {
    addAddressToRequests(address, requests + 1, startRequestAt)
  } else {
    addAddressToRequests(address, 1, now)
  }
  logging && logRateLimiting(_rlAddressToRequests[address].startRequestAt, address, _interval, _rlAddressToRequests[address].requests, 'ok')
  return next()
}

const getAddresses = () => {
  return _rlAddressToRequests
}

dostroy = (config) => {
  const all = !config || Object.keys(config).length === 0
  const sl = config && config.slowloris ? config.slowloris : SLOWLORIS_DEFAULT
  const rl = config && config.rateLimiting ? config.rateLimiting : RATELIMITING_DEFAULT
  const logging = config && config.logging ? config.logging : LOGGING_DEFAULT

  return dostroy = (req, res, next) =>{
    (rl || all) && rateLimiting(req, res, next, logging)
    //TODO: Add slowloris
  }
}

module.exports = dostroy
module.exports.getAddresses = getAddresses
