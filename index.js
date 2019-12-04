const fs = require('fs')
const moment = require('moment')

const RUDY_DEFAULT = false
const SLOWLORIS_DEFAULT = false
const RATELIMITING_DEFAULT = false
const LOGGING_DEFAULT = false
const ERRORHANDLING_DEFAULT = false
const USE_DYNAMIC_RATE_LIMITING_DEFAULT = false
const USER_ACTIVE_TIMEOUT_DEFAULT = 30000
const INTERVAL_DEFAULT = 10000
const LIMIT_DEFAULT = 10
const HEADERTIMEOUT_DEFAULT = 1000


const logSession = new Date().toISOString()
const logStream = fs.createWriteStream('/tmp/express-requests-' + logSession + '.log', { flags: 'a' })

let _totalActiveUsers = 0 // The amount of active users reset every now and then (default 30 sec)
let _lastActiveTimeout = moment()

let _rlAddressToRequests = {}

const formatMoment = (moment) => {
  return moment.format()
}

const addAddressToRequests = (address, requests, startRequestAt, lastRequestAt) => {
  _rlAddressToRequests[address] = { requests, startRequestAt, lastRequestAt}
}

const logRateLimiting = (moment, address, interval, requests, status) => {
  logStream.write('[' + formatMoment(moment) + ']{ Address: ' + address + ', interval: ' + interval + 'ms, requests: ' + requests + ', status: ' + status + ' }\n')
}

const rateLimiting = (req, res, next, logging, limit, interval) => {
  const address = req.connection.remoteAddress
  const now = moment()
  const addressObject = _rlAddressToRequests[address]
  if (!addressObject) {
    addAddressToRequests(address, 1, now, now)
    return false
  }

  let requests = addressObject.requests
  const startRequestAt = addressObject.startRequestAt
  const diffSeconds = now.diff(startRequestAt)
  const limitDenominator = (_totalActiveUsers > 0 ? _totalActiveUsers : 1) //1 if there is no dynamic rate limiting
  const requestLimit = limit/limitDenominator
  if (diffSeconds < interval && requests > requestLimit) {
    addAddressToRequests(address, requests + 1, now, now)
    logging && logRateLimiting(_rlAddressToRequests[address].startRequestAt, address, interval, _rlAddressToRequests[address].requests, 'ended')
    return true
  } else if (diffSeconds < interval) {
    addAddressToRequests(address, requests + 1, startRequestAt, now)
  } else {
    addAddressToRequests(address, 1, now, now)
  }
  logging && logRateLimiting(_rlAddressToRequests[address].startRequestAt, address, interval, _rlAddressToRequests[address].requests, 'ok')
  return false
}


const rudy = async (req, res, next, logging) => {
  const bodyChunkTimeout = 100 // 100ms upper limit for each body chunk
  return new Promise((resolve) => {
    let start = moment()
    req.on('data', () => {
      const now = moment()
      if (Math.abs(start.diff(now)) > bodyChunkTimeout) {
        resolve(true)
      }
      start = now
    })
    req.on('end', () => {
      resolve(false)
    })
  })
}

const slowloris = (HTTPServer, headerTimeout) => {
  HTTPServer.headersTimeout = headerTimeout
}

const getAddresses = () => {
  return _rlAddressToRequests
}

const setTotalActiveUsers = (req) => {
  const address = req.connection.remoteAddress
  const lastRequestAt = _rlAddressToRequests[address] ? _rlAddressToRequests[address].lastRequestAt : null

  if(!lastRequestAt || lastRequestAt.diff(_lastActiveTimeout) < 0){ //The last connection was before we zeroed the totalActiveUsers field
    _totalActiveUsers++
  }
}

const dostroy = (HTTPServer, config) => async (req, res, next) => {
  if (!HTTPServer) throw new Error('Server has not been initialized')
  const now = moment()
  const all = !config || Object.keys(config).length === 0
  const r = config && config.rudy ? config.rudy : RUDY_DEFAULT
  const sl = config && config.slowloris ? config.slowloris : SLOWLORIS_DEFAULT
  const rl = config && config.rateLimiting ? config.rateLimiting : RATELIMITING_DEFAULT
  const eh = config && config.errorHandling ? config.errorHandling : ERRORHANDLING_DEFAULT

  const headerTimeout = config && config.headerTimeout ? config.headerTimeout : HEADERTIMEOUT_DEFAULT
  const dynamic = config && config.dynamicRateLimiting ? config.dynamicRateLimiting : USE_DYNAMIC_RATE_LIMITING_DEFAULT
  const userActiveTimeout = dynamic && config && !isNaN(config.userActiveTimeout) ? config.userActiveTimeout : USER_ACTIVE_TIMEOUT_DEFAULT
  const limit = dynamic && config && !isNaN(config.requestLimit) ? config.requestLimit : LIMIT_DEFAULT
  const interval = dynamic && config && !isNaN(config.requestInterval) ? config.requestInterval : INTERVAL_DEFAULT
  const logging = config && config.logging ? config.logging : LOGGING_DEFAULT

  // Parsing request
  if (sl || all) slowloris(HTTPServer, headerTimeout)

  if(dynamic && now.diff(_lastActiveTimeout) > userActiveTimeout){
    _totalActiveUsers = 0
    _lastActiveTimeout = moment()
  }

  if ((rl || all) && dynamic) {
    setTotalActiveUsers(req)
  }

  if (((rl || all) && rateLimiting(req, res, next, logging, limit, interval)) ||
      ((r || all) && await rudy(req, res, next, logging))) {
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
