/**
 * xmreuse/nodejs/server
 * 
 * A webserver for serving up other xmreuse scripts and outputs using a Node.js REST API
 * https://github.com/sneurlax/xmreuse
 * 
 * @author     sneurlax <sneurlax@gmail.com> (https://github.com/sneurlax)
 * @copyright  2018
 * @license    MIT
 */
'use strict'


// Modes: full, allowing access to all scripts and 


// Configuration options
var port = 28084;
var limit = 100;


// ExpressJS server
var express = require('express');
var server = express();
// For running other xmreuse scripts
var childProcess = require('child_process');

// Return usage information
server.get('/', (req, res) => {
  res
  .status(200)
  .send(`Hello 
    world`);
});

// Return results from a block
server.get('/block/:block', (req, res) => {
  res
  .status(200)
  .send(`Hello block ${req.params.block}`);
});

// Return results from last block
server.get('/block', (req, res) => {
  res
  .status(200)
  .send(`Hello block ${req.params.block}`);
});

// Return results from a range of blocks
server.get('/blocks/:min/:max', (req, res) => {
  res
  .status(200)
  .send(`Hello blocks ${req.params.min} to ${req.params.max}`);
});

// Return default block range
server.get('/blocks', (req, res) => {
  runScript('daemon.js', ['-j', '-s', '-v'])
  .then((result) => {
    console.log('Process exited, result:', result);
    res
    .status(200)
    .send(`Hello blocks ${req.params.min} to ${req.params.max}`);
  });
});

// Initialize server
var server = server.listen(port, () => {
  console.log(`Express server listening on port ${port}`);
});

module.exports = server;

function runScript(scriptPath, ...params) {
  return new Promise((resolve, reject) => {
    // keep track of whether callback has been invoked to prevent multiple invocations
    var invoked = false;

    var process = childProcess.fork(scriptPath, ...params);

    // listen for errors as they may prevent the exit event from firing
    process.on('error', (err) => {
      if (invoked) return;
      invoked = true;
      reject(err);
    });

    process.on('message', (result) => {
      console.log('Data return from daemon.js, result:', result);
    });

    // execute the callback once the process has finished running
    process.on('exit', (code) => {
      if (invoked) return;
      invoked = true;
      // var err = code === 0 ? null : new Error('exit code ' + code);
      // resolve(err);
      resolve();
    });
  });
}
