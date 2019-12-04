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
Example usage to limit number of requests from a remote address to a Node.js server:
```
const dostroy = require('dostroy')
const express = require('express')
const app = express()

const config = {
  slowloris: true,
  rateLimiting: true,
  rudy: false
}

const server = app.listen(3000)
app.use(dostroy(server, config))

app.get('/', function (req, res) {
  res.send('Hello from example server')
})
```
## Config
Dostroy allows for some degree of configuration. The individual mitigations can be turned on or off and have their thresholds set. If no config is passed, Dostroy will employ all mitigations with standard values.
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
  headerTimeout: int
}
```
##### slowloris
Should the server mitigate the slowloris attack?
##### rateLimiter
Should the server employ rate limiting?
##### rudy
Should the server mitigate the rudy attack?
##### rudyTimeout:
The timeout in milliseconds (between each chunk) when transmitting the body. If the timeout is exceeded the connection is dropped.
##### dynamicRateLimiting
Regular rate limiting but the upper limit is a dynamic limit depending on the number of currently active users.
##### userActiveTimeout:
For how long the clients remain active in milliseconds. See dynamicRateLimiting.
##### requestLimit:
If dynamicRateLimiting is off:
The limit to how many requests each host can send each 'requestInterval'. See requestInterval.
If dynamicRateLimiting is on:
The total capacity of request per 'requestInterval' for the entire server.
##### requestInterval:
Is used to measure how many requests a user is sending. "Amounts of requests per requestInterval"
##### logging
Should logging be enabled?
##### headerTimeout
The timeout in milliseconds when transmitting the header. If the timeout is exceeded the connection is dropped.

## The Mitigations
Dostroy employs several techniques to mitigate different attacks. Here are the attacks Dostroy aims to mitigate.
### Flooding attack
Rate limiting is useful for many things but is especially convenient to counter a flooding attack. If a host exceeds the allowed numbers of request for a certain time period, any requests from the hosts IP will be dropped for the remainder of that period. The limit which the host might exceed can be set in one of two ways. A static limit or a dynamic limit. The static limit is a fixed number unchanged throughout the runtime of the server. The dynamic limit is changed depending on how many active users there are. The total resources are split equally across all users. So if the server can handle 100 connections/second and there are 5 active users, the limit of requests per second for each user is 20.
### Slowloris attack
The slowloris attack sends the request header very slowly to bind a connection to the server.
To mitigate a slowloris attack Dostroy sets timeouts for transmitting the entire header. The timeout limit is configurable.
### R.U.D.Y attack
The R.U.D.Y (R-U-DEAD-YET?) attack sends the request body very slowly to bind a connection to the server.
To mitigate a R.U.D.Y attack, Dostroy sets a timeout between each chunk when transmitting the body. The timeout limit is configurable.

