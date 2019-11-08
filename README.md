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
Example usage to count number of requests in Node.js server:
```
const dostroy = require('dostroy')
const express = require('express')
const app = express()

app.use(dostroy.countRequests)

app.listen(3000)

app.get('/', function (req, res) {
  console.log('Number of requests: ' + dostroy.getRequests())
  res.send('Hello from example server!')
})
```
Run your server and see the number of requests logged to console!
