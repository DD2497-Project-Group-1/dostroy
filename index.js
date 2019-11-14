const fs = require('fs')
const moment = require('moment')

const logSession = new Date().toISOString()
const logStream = fs.createWriteStream('/tmp/express-requests-' + logSession + '.log', {flags:'a'})

const interval = 3000 // milliseconds to check number of requests
const limit = 3 // limit for requests within interval
let _rateLimitingAddress2Requests = {}

const formatMoment = (moment) => {
  return moment.format()
}

const addAddress2Requests = (address, requests, startRequestAt) => {
  _rateLimitingAddress2Requests[address] = { requests: requests, startRequestAt: startRequestAt }
}

const rateLimiting = (req, res, next) => {
  const address = req.connection.remoteAddress
  const now = moment()
  const addressObject = _rateLimitingAddress2Requests[address]
  if (!addressObject) {
    addAddress2Requests(address, 1, now)
    return next()
  }

  let requests = addressObject.requests
  let startRequestAt = addressObject.startRequestAt
  let rateLimitingDiffSeconds = now.diff(startRequestAt)
  if (rateLimitingDiffSeconds < interval && requests > limit) {
    addAddress2Requests(address, requests + 1, now)
    logStream.write('[' + formatMoment(_rateLimitingAddress2Requests[address].startRequestAt) + ']{ Address: ' + address + ', interval: ' + interval + 'ms, requests: ' + _rateLimitingAddress2Requests[address].requests + ', status: ended }\n')
    return res.end()
  } else if (rateLimitingDiffSeconds < interval) {
    addAddress2Requests(address, requests + 1, startRequestAt)
  } else {
    addAddress2Requests(address, 1, now)
  }
  logStream.write('[' + formatMoment(_rateLimitingAddress2Requests[address].startRequestAt) + ']{ Address: ' + address + ', interval: ' + interval + 'ms, requests: ' + _rateLimitingAddress2Requests[address].requests + ', status: ok }\n')
  return next()
}

const getAddresses = () => {
  const addresses = _rateLimitingAddress2Requests
  return addresses
}

module.exports = {
  rateLimiting,
  getAddresses
}
