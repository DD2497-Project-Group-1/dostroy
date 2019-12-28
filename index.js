const fs = require('fs')
const moment = require('moment')
const Crypto = require('crypto-js')

const RUDY_DEFAULT = false
const RUDY_TIMEOUT_DEFAULT = 100
const SLOWLORIS_DEFAULT = false
const RATELIMITING_DEFAULT = false
const LOGGING_DEFAULT = false
const ERRORHANDLING_DEFAULT = false
const USE_DYNAMIC_RATE_LIMITING_DEFAULT = false
const USER_ACTIVE_TIMEOUT_DEFAULT = 30000
const INTERVAL_DEFAULT = 10000
const LIMIT_DEFAULT = 5
const HEADER_TIMEOUT_DEFAULT = 1000

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
  const address = Crypto.SHA256(req.connection.remoteAddress).toString(Crypto.enc.Hex);
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

const _createTimeout = (resolve, timeoutTime) => {
  return setTimeout(() => {
    return resolve(true)
  }, timeoutTime)
}

const logRudy = (moment, address, timeoutTime, status) => {
  logStream.write('[' + formatMoment(moment) + ']{ Address: ' + address + ', timeout limit: ' + timeoutTime + 'ms, status: ' + status + ' }\n')
}

const rudy = async (req, timeoutTime, logging) => {
  return new Promise((resolve) => {
    let timeout = _createTimeout(resolve, timeoutTime)
    req.on('data', () => {
      clearTimeout(timeout)
      logging && logRudy(moment(), req.ip, timeoutTime, 'ended')
      timeout = _createTimeout(resolve, timeoutTime)
    })
    req.on('end', () => {
      clearTimeout(timeout)
      logging && logRudy(moment(), req.ip, timeoutTime, 'ok')
      return resolve(false)
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
  const address = Crypto.SHA256(req.connection.remoteAddress).toString(Crypto.enc.Hex);
  const lastRequestAt = _rlAddressToRequests[address] ? _rlAddressToRequests[address].lastRequestAt : null
  if(!lastRequestAt || lastRequestAt.diff(_lastActiveTimeout) < 0){ //The last connection was before we zeroed the totalActiveUsers field
    _totalActiveUsers++
  }
}

const init = (HTTPServer, serverConfig) => {
  if (!HTTPServer) throw new Error('Server has not been initialized')
  if (!serverConfig) throw new Error('No config for server')

  let config = {}
  config.all = !serverConfig || Object.keys(serverConfig).length === 0
  config.r = serverConfig && serverConfig.rudy ? serverConfig.rudy : RUDY_DEFAULT
  config.sl = serverConfig && serverConfig.slowloris ? serverConfig.slowloris : SLOWLORIS_DEFAULT
  config.rl = serverConfig && serverConfig.rateLimiting ? serverConfig.rateLimiting : RATELIMITING_DEFAULT
  config.eh = serverConfig && serverConfig.errorHandling ? serverConfig.errorHandling : ERRORHANDLING_DEFAULT
  config.rtimeout = serverConfig && serverConfig.rudyTimeout ? serverConfig.rudyTimeout : RUDY_TIMEOUT_DEFAULT
  config.dynamic = serverConfig && serverConfig.dynamicRateLimiting ? serverConfig.dynamicRateLimiting : USE_DYNAMIC_RATE_LIMITING_DEFAULT
  config.userActiveTimeout = config.dynamic && serverConfig && !isNaN(serverConfig.userActiveTimeout) ? serverConfig.userActiveTimeout : USER_ACTIVE_TIMEOUT_DEFAULT
  config.limit = config.dynamic && serverConfig && !isNaN(serverConfig.requestLimit) ? serverConfig.requestLimit : LIMIT_DEFAULT
  config.interval = config.dynamic && serverConfig && !isNaN(serverConfig.requestInterval) ? serverConfig.requestInterval : INTERVAL_DEFAULT
  config.logging = serverConfig && serverConfig.logging ? serverConfig.logging : LOGGING_DEFAULT
  config.headerTimeout = serverConfig && serverConfig.headerTimeout ? serverConfig.headerTimeout : HEADER_TIMEOUT_DEFAULT



  if (config.sl || config.all) {
    slowloris(HTTPServer, config.headerTimeout)
  }
  return config
}

const protect = (config) => async (req, res, next) => {
  if (!config) throw new Error('No config for server')

  const now = moment()

  if(config.dynamic && now.diff(_lastActiveTimeout) > config.userActiveTimeout){
    _totalActiveUsers = 0
    _lastActiveTimeout = moment()
  }

  if ((config.rl || config.all) && config.dynamic) {
    setTotalActiveUsers(req)
  }

  if (((config.rl || config.all) && rateLimiting(req, res, next, config.logging, config.limit, config.interval)) ||
      ((config.r || config.all) && await rudy(req, config.rtimeout, config.logging))) {
    res.connection.destroy()
    return res.end()
  } else {
    return next()
  }
}

const errorHandler = (err, _, res, __) => {
  err && res.status(400).send('An error occured')
}

module.exports.init = init
module.exports.protect = protect
module.exports.errorHandler = errorHandler
module.exports.getAddresses = getAddresses
