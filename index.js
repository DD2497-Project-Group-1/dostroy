const fs = require('fs')
const moment = require('moment')

const RUDY_DEFAULT = false
const RATELIMITING_DEFAULT = false
const LOGGING_DEFAULT = false
const ERRORHANDLING_DEFAULT = false

const logSession = new Date().toISOString()
const logStream = fs.createWriteStream('/tmp/express-requests-' + logSession + '.log', { flags: 'a' })

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
    return false
  }

  let requests = addressObject.requests
  const startRequestAt = addressObject.startRequestAt
  const diffSeconds = now.diff(startRequestAt)
  if (diffSeconds < _interval && requests > _limit) {
    addAddressToRequests(address, requests + 1, now)
    logging && logRateLimiting(_rlAddressToRequests[address].startRequestAt, address, _interval, _rlAddressToRequests[address].requests, 'ended')
    return true
  } else if (diffSeconds < _interval) {
    addAddressToRequests(address, requests + 1, startRequestAt)
  } else {
    addAddressToRequests(address, 1, now)
  }
  logging && logRateLimiting(_rlAddressToRequests[address].startRequestAt, address, _interval, _rlAddressToRequests[address].requests, 'ok')
  return false
}

const _createTimeout = (resolve) => {
  return setTimeout(() => {
    return resolve(true)
  }, 1000)
}

const rudy = async (req, res, next, logging) => {
  return new Promise((resolve) => {
    let timeout = _createTimeout(resolve)
    req.on('data', () => {
      clearTimeout(timeout)
      timeout = _createTimeout(resolve)
    })
    req.on('end', () => {
      clearTimeout(timeout)
      return resolve(false)
    })
  })
}

const getAddresses = () => {
  return _rlAddressToRequests
}

const dostroy = (config) => async (req, res, next) => {
  const all = !config || Object.keys(config).length === 0
  const r = config && config.rudy ? config.rudy : RUDY_DEFAULT
  const rl = config && config.rateLimiting ? config.rateLimiting : RATELIMITING_DEFAULT
  const logging = config && config.logging ? config.logging : LOGGING_DEFAULT
  if (((rl || all) && rateLimiting(req, res, next, logging)) ||
      ((r || all) && await rudy(req, res, next, logging))) {
    console.log('Dropped connection')
    return res.end()
  } else {
    return next()
  }
}

// TODO: Add errorhandler middleware in server
const errorHandler = (err, res) => {
  err && res.status(400).send('An error occured')
}

module.exports = dostroy
module.exports.getAddresses = getAddresses
