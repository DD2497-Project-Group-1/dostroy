const fs = require('fs')
const moment = require('moment')

const SLOWLORIS_DEFAULT = false // not yet implemented
const RATELIMITING_DEFAULT = false
const LOGGING_DEFAULT = false
const ERRORHANDLING_DEFAULT = false
const USE_DYNAMIC_RATE_LIMITING_DEFAULT = false
const USER_ACTIVE_TIMEOUT_DEFAULT = 30000

const logSession = new Date().toISOString()
const logStream = fs.createWriteStream('/tmp/express-requests-' + logSession + '.log', {flags:'a'})

const _interval = 1000 // milliseconds to check number of requests
const _limit = 10 // limit for requests within interval
var totalActiveUsers = 0 // The amount of active users reset every now and then (default 30 sec)
var lastActiveTimeout = 0

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

const rateLimiting = (req, res, next, logging) => {
  const address = req.connection.remoteAddress
  const now = moment()
  const addressObject = _rlAddressToRequests[address]
  if (!addressObject) {
    addAddressToRequests(address, 1, now, now)
    return next()
  }

  let requests = addressObject.requests
  const startRequestAt = addressObject.startRequestAt
  const diffSeconds = now.diff(startRequestAt)
  const limitDenominator = (totalActiveUsers > 0 ? totalActiveUsers : 1) //1 if there is no dynamic rate limiting
  const requestLimit = _limit/limitDenominator //
  if (diffSeconds < _interval && requests > requestLimit) {
    addAddressToRequests(address, requests + 1, now, now)
    logging && logRateLimiting(_rlAddressToRequests[address].startRequestAt, address, _interval, _rlAddressToRequests[address].requests, 'ended')
    return res.end()
  } else if (diffSeconds < _interval) {
    addAddressToRequests(address, requests + 1, startRequestAt, now)
  } else {
    addAddressToRequests(address, 1, now, now)
  }
  logging && logRateLimiting(_rlAddressToRequests[address].startRequestAt, address, _interval, _rlAddressToRequests[address].requests, 'ok')
  return next()
}

const setTotalActiveUsers = (req) => {
  const address = req.connection.remoteAddress
  const lastRequestAt = _rlAddressToRequests[address].lastRequestAt
  console.log("Setting users:");
  console.log("last req: " + lastActiveTimeout.diff(lastRequestAt));
  
  
  if(!lastRequestAt || lastActiveTimeout.diff(lastRequestAt) < 0){ //The last connection was before we zeroed the totalActiveUsers field
    totalActiveUsers++
    console.log("Active users is now: " + totalActiveUsers);
  }
}

const getAddresses = () => {
  return _rlAddressToRequests
}

const errorHandler = (err, res) => {
  err && res.status(400).send('An error occured')
}

dostroy = (config) => {
  const all = !config
  const sl = config && config.slowloris ? config.slowloris : SLOWLORIS_DEFAULT
  const rl = config && config.rateLimiting ? config.rateLimiting : RATELIMITING_DEFAULT
  const dynamic = config && config.rateLimiting ? config.rateLimiting.useDynamicRateLimiting : USE_DYNAMIC_RATE_LIMITING_DEFAULT
  const userActiveTimeout = dynamic && config.rateLimiting.userActiveTimeout ? config.rateLimiting.userActiveTimeout : USER_ACTIVE_TIMEOUT_DEFAULT
  const logging = config && config.logging ? config.logging : LOGGING_DEFAULT
  const eh = config && config.errorHandling ? config.errorHandling : ERRORHANDLING_DEFAULT

  console.log(rl);
  console.log(dynamic);
  console.log(userActiveTimeout);
  
  if(dynamic){
    setInterval(() => {
      totalActiveUsers = 0
      lastActiveTimeout = moment()      
    }, userActiveTimeout);
  }  
  return function dostroy(err, req, res, next) {        
    if (eh || all) {
      errorHandler(err, res)
    }
    if (rl || all) {
      if (dynamic) {
        setTotalActiveUsers(req);
      }
      rateLimiting(req, res, next, logging)
    }
  }
}

module.exports = dostroy
module.exports.getAddresses = getAddresses
