# dostroy
Node.js middleware for DoS-prevention.

## Project Members
Josefin Nilsson (josefnil@kth.se) <br>
Helena Alinder (halinder@kth.se) <br>
Samuel Hertzberg (shert@kth.se) <br>
Martin Hyberg (mhyberg@kth.se)

## Running
Install package:
```
npm install dostroy
```
Example usage to handle malicious requests from remote addresses to a Node.js server:
```
const express = require('express')
const dostroy = require('dostroy')
const app = express()

config = {
  rateLimiting: true,
  dynamicRateLimiting: true,
  userActiveTimeout: 10000,
  requestLimit: 10,
  requestInterval: 10000,
  rudy: true
}

const server = app.listen(3000)
const dostroyConfig = dostroy.init(server, config)
app.use(dostroy.protect(dostroyConfig))

... end of server ...

app.use(dostroy.errorHandler)

```
## Config
dostroy allows for some degree of configuration. The individual mitigations can be turned on or off and have their thresholds set. If no config is passed, dostroy will employ all mitigations with standard values.
```json
config = {
  slowloris: boolean,
  rateLimiter: boolean,
  rudy: boolean,
  rudyTimeout: int,
  dynamicRateLimiting: boolean,
  userActiveTimeout: int,
  requestLimit: int,
  requestInterval: int, 
  logging: boolean,
  headerTimeout: int,
}
```
##### slowloris
Whether dostroy should mitigate the slowloris attack.
*Default:* false
##### rateLimiter
Whether dostroy should employ rate limiting, and mitigate possible flood attacks.
*Default:* false
##### rudy
Whether dostroy should mitigate the R.U.D.Y attack.
*Default:* false
##### rudyTimeout:
The timeout in milliseconds (between each chunk) when transmitting the body. If the timeout is exceeded the connection is dropped.
*Default:* false
##### dynamicRateLimiting
Regular rate limiting but the upper limit is a dynamic limit depending on the number of currently active users.
*Default:* false
##### userActiveTimeout:
For how long the clients remain active in milliseconds. See dynamicRateLimiting.
*Default:* 30000ms
##### requestLimit:
If dynamicRateLimiting is off:
The limit to how many requests each host can send each 'requestInterval'. See requestInterval.
If dynamicRateLimiting is on:
The total capacity of request per 'requestInterval' for the entire server.
*Default:* 100
##### requestInterval:
Is used to measure how many requests a user is sending. "Amounts of requests per requestInterval"
*Default:* 10000
##### logging
Should logging be enabled?
*Default:* false
##### headerTimeout
The timeout in milliseconds when transmitting the header. If the timeout is exceeded the connection is dropped.
*Default:* 1000

## The Mitigations
dostroy employs several techniques to mitigate different attacks. Here are the attacks dostroy aims to mitigate.
### Flooding attack
Rate limiting is useful for many things but is especially convenient to counter a flooding attack. If a host exceeds the allowed numbers of request for a certain time period, any requests from the hosts IP will be dropped for the remainder of that period. The limit which the host might exceed can be set in one of two ways. A static limit or a dynamic limit. The static limit is a fixed number unchanged throughout the runtime of the server. The dynamic limit is changed depending on how many active users there are. The total resources are split equally across all users. So if the server can handle 100 connections/second and there are 5 active users, the limit of requests per second for each user is 20.
### Slowloris attack
The slowloris attack sends the request header very slowly to bind a connection to the server.
To mitigate a slowloris attack dostroy sets timeouts for transmitting the entire header. The timeout limit is configurable.
### R.U.D.Y attack
The R.U.D.Y (R-U-DEAD-YET?) attack sends the request body very slowly to bind a connection to the server.
To mitigate a R.U.D.Y attack, dostroy sets a timeout between each chunk when transmitting the body. The timeout limit is configurable.

