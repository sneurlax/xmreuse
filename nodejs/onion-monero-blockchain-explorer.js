/**
 * xmreuse/nodejs/onion-monero-blockchain-explorer
 * 
 * A script for scanning blocks for key image information from an Onion Monero Blockchain Explorer's JSON API using Node.js
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
    name: 'url',
    description: 'Onion Monero Blockchain Explorer URL (default: "https://moneroexplorer.com")',
    type: String,
    typeLabel: '{underline string}'
  },
  {
    name: 'port',
    description: 'Daemon port (optional)',
    type: Number,
    typeLabel: '{underline number}'
  },
  {
    name: 'min',
    description: 'Block height to start scrape (default: 100 blocks back from the current height)',
    type: Number,
    typeLabel: '{underline Number}'
  },
  { name: 'max',
    description: 'Block height to end scrape (default: current height)', 
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
      header: 'xmreuse/nodejs/onion-monero-blockchain-explorer',
      content: 'A script for scanning blocks for key image information from an Onion Monero Blockchain Explorer\'s JSON API using Node.js'
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
    if (!options.json)
      fs.appendFileSync(options.file, `transaction block key_image ...key_offsets\n`);
      if (options.verbose)
        console.log(`Wrote format header to ${options.file}`)
  }
}

if ((Object.keys(options).length === 0 && options.constructor === Object) && !(options.verbose && Object.keys(options).length == 1)) {
  console.log('No arguments specified, using defaults: scanning the last 100 blocks and reporting key image information in format KEY_IMAGE OFFSET_FORMAT A B C D');
  console.log('Use the --help (or -h) commandline argument to show usage information.');
}

const request = require('request');

var url = options.url || 'https://moneroexplorer.com';
var blocks = [];

// Get current block height
request.get({ uri: `${url}/api/networkinfo`, json: true }, (error, response, networkinfo) => {
  let maxHeight = networkinfo['data']['height'] - 1;
  // Set range of block heights to scan
  let startHeight;
  if (typeof options.max == 'undefined') {
      startHeight = maxHeight;
  } else {
    startHeight = options.max;
  }

  let limit;
  if (typeof options.min == 'undefined') {
    limit = 100;
  } else {
    limit = options.min - startHeight;
  }

  // Scan range of block heights
  for (let height = startHeight; height > startHeight - limit; height--) {
    blocks.push(height);
  }

  requestBlock(blocks.shift());
});

function requestBlock(height) {
  if (options.verbose)
    console.log(`Querying block ${height}...`);

  request.get({ uri: `${url}/api/block/${height}`, json: true }, (error, response, block) => {
    if (options.verbose)
      console.log(`Got block ${height}...`);

    let txids = [];

    if ('data' in block) {
      let json = block['data'];

      if ('txs' in json) {
        let txs = json['txs'];

        if (txs.length > 1) {
          if (options.verbose)
            console.log(`${txs.length} transactions in block ${height}...`);

          let txids = [];
          for (let tx in txs) {
            if ('tx_hash' in txs[tx]) {
              let txid = txs[tx]['tx_hash'];
              txids.push(txid);
            }
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

  if (options.verbose)
    console.log(`Querying transaction ${txid}...`);

  request.get({ uri: `${url}/api/transaction/${Object.values(txids)[0]}`, json: true }, (error, response, gettransactions) => {
    if (options.verbose)
      console.log(`Got transaction ${txid}...`)
    
    if ('data' in gettransactions) {
      if ('coinbase' in gettransactions['data']) {
        let height = gettransactions['data']['block_height'];
        if (!(gettransactions['data']['coinbase'])) {
          if ('inputs' in gettransactions['data']) {
            let txs = gettransactions['data']['inputs'];
            for (let tx in txs) {
              let transaction = txs[tx];
              if ('key_image' in transaction) {
                let key_image = transaction['key_image'];
                let key_offsets = [];

                if ('mixins' in transaction) {
                  let vin = transaction['mixins'];
                  for (let ini in vin) {
                    if ('public_key' in vin[ini]) {
                      let input = vin[ini];

                      key_offsets.push(input['block_no']);
                    }
                  }

                  if (options.file) {
                    if (options.json) {
                      if (options.verbose) {
                        fs.appendFile(options.file, `{ transaction: ${txid}, block: ${height}, key_image: ${key_image}, key_offsets: [${key_offsets}], offset_format: 'absolute' }\n`, function(err) {
                          if (err) throw err;
                          console.log(`Wrote key image information to ${options.file}`);
                        });
                      } else {
                        fs.appendFile(options.file, `{ key_image: ${key_image}, key_offsets: [${key_offsets}], offset_format: 'absolute' }\n`, function(err) {
                          if (err) throw err;
                        });
                      }
                    } else {
                      if (options.verbose) {
                        fs.appendFile(options.file, `${txid} ${height} ${key_image} absolute ${key_offsets.join(' ')}\n`, function(err) {
                          if (err) throw err;
                          console.log(`Wrote key image information to ${options.file}`);
                        });
                      } else {
                        fs.appendFile(options.file, `${key_image} absolute ${key_offsets.join(' ')}\n`, function(err) {
                          if (err) throw err;
                        });
                      }
                    }
                  } else {
                    if (options.verbose)
                      console.log(`Transaction ${txid} in block ${height}:`);
                    if (options.json) {
                      console.log(`{ key_image: ${key_image}, key_offsets: [${key_offsets}], offset_format: 'absolute' }`);
                    } else {
                      console.log(`${key_image} absolute ${key_offsets.join(' ')}`);
                    }
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
      }
    }
  });
}
