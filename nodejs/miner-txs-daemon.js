/**
 * xmreuse/nodejs/miner-txs-daemon
 * 
 * A script for scanning blocks for identifiable miner transactions from a Monero daemon's RPC API using Node.js
 * https://github.com/sneurlax/xmreuse
 * 
 * @author     sneurlax <sneurlax@gmail.com> (https://github.com/sneurlax)
 * @copyright  2018
 * @license    MIT
 */
'use strict'

// TODO scrape announced blocks of pools

// Commandline options
const commandLineArgs = require('command-line-args');
const optionDefinitions = [
  {
    name: 'host',
    alias: 'i',
    description: 'Daemon (default: "127.0.0.1")',
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
    name: 'help',
    alias: 'h',
    description: 'Print this usage guide.',
    type: Boolean
  }
];
const options = commandLineArgs(optionDefinitions);

// Help / usage
if (options.help) {
  const commandLineUsage = require('command-line-usage')
  const sections = [
    {
      header: 'xmreuse/nodejs/miner-txs-daemon',
      content: 'A script for scanning blocks for identifiable miner transactions from a Monero daemon\'s RPC API using Node.js'
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
        fs.appendFileSync(options.file, `transaction block key_image\n`);
        console.log(`Wrote format header to ${options.file}`);
      } else {
        fs.appendFileSync(options.file, `key_image\n`);
      }
    }
  }
}

if ((Object.keys(options).length === 0 && options.constructor === Object) && !(options.verbose && Object.keys(options).length == 1)) {
  console.log('No arguments specified, using defaults: scanning the last 100 blocks and reporting key image information in format KEY_IMAGE');
  console.log('Use the --help (or -h) commandline argument to show usage information.');
}

const Monero = require('moneronodejs');

const daemonRPC = new Monero.daemonRPC({ host: options.host, port: options.port });
// var daemonRPC = new Monero.daemonRPC('127.0.0.1', 28081, 'user', 'pass', 'http'); // Example of passing in parameters
// var daemonRPC = new Monero.daemonRPC({ port: 28081, protocol: 'https'); // Parameters can be passed in as an object/dictionary

var blocks = [];
var minerBlocks = [];

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
  // TODO scan block heights of a particular pool
  for (let height = startHeight; height > startHeight - options.limit; height--) {
    blocks.push(height);
    minerBlocks.push(height);
  }

  scrapeBlocks(minerBlocks.shift());
});

function scrapeBlocks(height) {
  if (options.verbose)
    console.log(`Querying block ${height}...`);

  daemonRPC.getblock_by_height(height)
  .then(block => {
    if (options.verbose)
      console.log(`Got block ${height}...`);

    scrapeTransaction(block['miner_tx_hash']);
  });
}

var miner_key_images = [];

function scrapeTransaction(txid) {
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

          let vout = transaction['vout'];
          for (let ini in vout) {
            if ('target' in vout[ini]) {
              if ('key' in vout[ini]['target']) {
                let key_image = vout[ini]['target']['key'];
                miner_key_images.push(key_image);
              }
            }
          }
        }
      }
    }
    if (minerBlocks.length > 0) {
      scrapeBlocks(minerBlocks.shift());
    } else {
      if (options.verbose)
        console.log('Finished scanning blocks for coinbase outputs, scanning for their inclusion in key images...');

      requestBlock(blocks.shift());
    }
  });
}

function requestBlock(height) {
  if (options.verbose)
    console.log(`Querying block ${height}...`);

  daemonRPC.getblock_by_height(height)
  .then(block => {
    if (options.verbose)
      console.log(`Got block ${height}...`);

    let txids = [];

    let json = JSON.parse(block['json']);
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

              if (key_image in miner_key_images) {
                if (options.file) {
                  if (options.json) {
                    if (options.verbose) {
                      fs.appendFile(options.file, `{ transaction: ${txid}, block: ${height}, key_image: ${key_image} }\n`, function(err) {
                        if (err) throw err;
                        console.log(`Wrote miner transaction information to ${options.file}`);
                      });
                    } else {
                      fs.appendFile(options.file, `{ ${key_image} }\n`, function(err) {
                        if (err) throw err;
                      });
                    }
                  } else {
                    if (options.verbose) {
                      fs.appendFile(options.file, `${txid} ${height} ${key_image}\n`, function(err) {
                        if (err) throw err;
                        console.log(`Wrote miner transaction information to ${options.file}`);
                      });
                    } else {
                      fs.appendFile(options.file, `${key_image}\n`, function(err) {
                        if (err) throw err;
                      });
                    }
                  }
                } else {
                  if (options.verbose)
                    console.log(`Transaction ${txid} in block ${height}:`);
                  if (options.json) {
                    console.log(`{ ${key_image} }`);
                  } else {
                    console.log(`${key_image}`);
                  }
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
      } else {
        console.log(miner_key_images);
      }
    }
  });
}