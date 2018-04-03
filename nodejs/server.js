/**
 * xmreuse/nodejs/server
 * 
 * A webserver for serving up other xmreuse scripts using a Node.js REST API
 * https://github.com/sneurlax/xmreuse
 * 
 * @author     sneurlax <sneurlax@gmail.com> (https://github.com/sneurlax)
 * @copyright  2018
 * @license    MIT
 */
'use strict'

// Configuration options
var port = 28084;


// ExpressJS server
var express = require('express');
var server = express();

server.get('/', (req, res) => {
  res
  .status(200)
  .send('Hello world');
});

var server = server.listen(port, () => {
  console.log('Express server listening on port ' + port);
});

module.exports = server;
