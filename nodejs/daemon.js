/**
 * xmreuse/nodejs/daemon
 * 
 * A script for scanning blocks for key image information from a Monero daemon's RPC API using Node.js
 * https://github.com/sneurlax/xmreuse
 * 
 * @author     sneurlax <sneurlax@gmail.com> (https://github.com/sneurlax)
 * @copyright  2018
 * @license    MIT
 */
'use strict'

// Commandline options
const commandLineArgs = require('command-line-args');
const optionDefinitions = [
  {
    name: 'hostname',
    alias: 'i',
    description: 'Daemon hostname (default: "127.0.0.1")',
    type: String,
    typeLabel: '{underline string}'
  },
  {
    name: 'port',
    alias: 'p',
    description: 'Daemon port (default: 28083)',
    type: Number,
    typeLabel: '{underline number}'
  },
  {
    name: 'min',
    description: 'Block height to start scrape (default: 100 blocks back from the current height)',
    type: Number,
    typeLabel: '{underline Number}'
  },
  {
    name: 'max',
    description: 'Block height to end scrape (default: current height)', 
    type: Number,
    typeLabel: '{underline number}'
  },
  {
    name: 'limit',
    alias: 'l',
    description: 'Number of blocks to scrape.  If set, overrides --min (default: 100)', 
    type: Number,
    typeLabel: '{underline number}'
  },
  {
    name: 'file',
    alias: 'f',
    description: 'Filename to write results to (default: none; logs to console)',
    type: String,
    typeLabel: '{underline string}'
  },
  {
    name: 'json',
    alias: 'j',
    description: 'Print information in JSON format (default: false)',
    type: Boolean,
    typeLabel: '{underline boolean}'
  },
  {
    name: 'verbose',
    alias: 'v',
    description: 'Print more information (default: false)',
    type: Boolean,
    typeLabel: '{underline boolean}'
  },
  {
    name: 'serve',
    alias: 's',
    description: 'Print results using stdout for consumption by server.js (default: false; logs to console)',
    type: Boolean,
    typeLabel: '{underline boolean}' 
  },
  {
    name: 'help',
    alias: 'h',
    description: 'Print this usage guide.',
    type: Boolean
  }
];
const options = commandLineArgs(optionDefinitions);

// Help / usage
if (options.help) {
  const commandLineUsage = require('command-line-usage');
  const sections = [
    {
      header: 'xmreuse/nodejs/daemon',
      content: 'A script for scanning blocks for key image information from a Monero daemon\'s RPC API using Node.js'
    },
    {
      header: 'Options',
      optionList: optionDefinitions
    }
  ];
  const usage = commandLineUsage(sections);
  console.log(usage);
  process.exit();
}

const fs = require('fs');
if (options.file) {
  if (!fs.existsSync(options.file)) {
    if (!options.json) {
      if (options.verbose) {
        fs.appendFileSync(options.file, `transaction block key_image offset_format ...key_offsets\n`);
        console.log(`Wrote format header to ${options.file}`);
      } else {
        fs.appendFileSync(options.file, `key_image offset_format ...key_offsets\n`);
      }
    }
  }
}

if ((Object.keys(options).length === 0 && options.constructor === Object) && !(options.verbose && Object.keys(options).length == 1)) {
  console.log('No arguments specified, using defaults: scanning the last 100 blocks and reporting key image information in format KEY_IMAGE OFFSET_FORMAT A B C D');
  console.log('Use the --help (or -h) commandline argument to show usage information.');
}

const Monero = require('moneronodejs');

const daemonRPC = new Monero.daemonRPC({ hostname: options.hostname, port: options.port });
// var daemonRPC = new Monero.daemonRPC('127.0.0.1', 28081, 'user', 'pass', 'http'); // Example of passing in parameters
// var daemonRPC = new Monero.daemonRPC({ port: 28081, protocol: 'https'); // Parameters can be passed in as an object/dictionary

var blocks = [];

daemonRPC.getblockcount()
.then(networkinfo => {
  let maxHeight = networkinfo['count'] - 1;
  let startHeight;
  if (typeof options.max == 'undefined') {
    startHeight = maxHeight;
  } else {
    startHeight = options.max;
  }

  if (typeof options.limit == 'undefined') {
    if (typeof options.min == 'undefined') {
      options.limit = 100;
    } else {
      options.limit = startHeight - options.min;
    }
  }

  // Scan range of block heights
  for (let height = startHeight; height > startHeight - options.limit; height--) {
    blocks.push(height);
  }

  requestBlock(blocks.shift());
});

function requestBlock(height) {
  if (options.verbose)
    console.log(`Querying block ${height}...`);

  daemonRPC.getblock_by_height(height)
  .then(block => {
    if (options.verbose)
      console.log(`Got block ${height}...`);

    let txids = [];

    if (typeof block['json'] == 'string') {
      block['json'] = JSON.parse(block['json']);
    }

    if (block['json']) {
      let json = block['json'];
      // console.log(json);
      if ('tx_hashes' in json) {
        let txs = json['tx_hashes'];

        if (txs.length > 0) {
          if (options.verbose)
            console.log(`${txs.length} transactions in block ${height}...`);

          if (txs.length > 1) {
            if (options.verbose)
              console.log(`${txs.length} transactions in block ${height}...`);

            for (let tx in txs) {
              let txid = txs[tx];
              txids.push(txid);
            }
            requestTransactions(txids);
          }
        }
      }
    }
    if (txids.length == 0) {
      if (blocks.length > 0) {
        requestBlock(blocks.shift());
      }
    }
  });
}

function requestTransactions(txids) {
  let txid = txids[0];

  daemonRPC.gettransactions([txid])
  .then(gettransactions => {
    if (options.verbose)
      console.log(`Got transaction ${txid}...`);

    if ('txs' in gettransactions) {
      let txs = gettransactions['txs'];
      for (let tx in txs) {
        if ('as_json' in txs[tx]) {
          let transaction = JSON.parse(txs[tx]['as_json']);
          let height = txs[tx]['block_height'];

          let vin = transaction['vin'];
          for (let ini in vin) {
            if ('key' in vin[ini]) {
              let input = vin[ini]['key'];

              let key_offsets = input['key_offsets'];
              let key_image = input['k_image'];

              // key_images[key_image] = key_offsets;

              if (options.file) {
                if (options.json) {
                  if (options.verbose) {
                    fs.appendFile(options.file, `{ transaction: ${txid}, block: ${height}, key_image: ${key_image}, key_offsets: [${key_offsets.join(',')}], offset_format: 'relative' }\n`, function(err) {
                      if (err) throw err;
                      console.log(`Wrote key image information to ${options.file}`);
                    });
                  } else {
                    fs.appendFile(options.file, `{ $key_image: '${key_image}', key_offsets: [${key_offsets.join(',')}], offset_format: 'relative' }\n`, function(err) {
                      if (err) throw err;
                    });
                  }
                } else {
                  if (options.verbose) {
                    fs.appendFile(options.file, `${txid} ${height} ${key_image} relative ${key_offsets.join(' ')}\n`, function(err) {
                      if (err) throw err;
                      console.log(`Wrote key image information to ${options.file}`);
                    });
                  } else {
                    fs.appendFile(options.file, `${key_image} relative ${key_offsets.join(' ')}\n`, function(err) {
                      if (err) throw err;
                    });
                  }
                }
              } else {
                if (options.verbose)
                  console.log(`Transaction ${txid} in block ${height}:`);
                if (options.json) {
                  console.log(`{ key_image: '${key_image}', key_offsets: [${key_offsets.join(',')}], offset_format: 'relative' }`);
                } else {
                  console.log(`${key_image} relative ${key_offsets.join(' ')}`);
                }
              }
              if (options.serve) {
                if (options.verbose)
                  console.log('Sending information to parent process...');
                if (options.json) {
                  process.send({ key_image: key_image, key_offsets: key_offsets, offset_format: 'relative' });
                } else {
                  process.send(`${key_image} relative ${key_offsets.join(' ')}`);
                }
              }
            }
          }
        }
      }
    }
    txids.shift();
    if (txids.length > 0) {
      requestTransactions(txids);
    } else {
      if (blocks.length > 0) {
        requestBlock(blocks.shift());
      }
    }
  });
}