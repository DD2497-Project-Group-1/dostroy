# dostroy
Node.js middleware for DoS-prevention

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
Example usage to limit the number of requests from one remote address to a Node.js server:
```
const dostroy = require('dostroy')
const express = require('express')
const app = express()

app.use(dostroy.rateLimiting)

app.listen(3000)

app.get('/', function (req, res) {
  res.send('Hello from example server!')
})
```
Run your server and see the number of requests logged to console!
