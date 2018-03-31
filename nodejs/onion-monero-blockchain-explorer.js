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

if ((Object.keys(options).length === 0 && options.constructor === Object) || (options.verbose && Object.keys(options).length == 1))
  console.log('No arguments specified, using defaults: scanning the last 100 blocks and reporting key image information in format KEY_IMAGE A B C D');
  console.log('Use the --help (or -h) commandline argument to show usage information.');

const request = require('request-promise');

let url = options.url || 'https://moneroexplorer.com';

request({ uri: `${url}/api/networkinfo`, json: true })
.then(networkinfo => {
  let startHeight;
  if (typeof options.min == 'undefined') {
    startHeight = networkinfo['data']['height'] - 1;
  } else {
    startHeight = options.min;
  }

  let limit;
  if (typeof options.max == 'undefined') {
    // limit = 100;
    limit = 1;
  } else {
    limit = options.max - startHeight;
  }

  let block_chain = Promise.resolve();
  for (let height = startHeight; height > startHeight - limit; height--) {
    if (options.verbose)
      console.log(`Querying block ${height}...`)
    // let key_images = {};

    block_chain = block_chain
    .then(() => {
      return new Promise(resolve => {
        request({ uri: `${url}/api/block/${height}`, json: true })
        .then(block => {
          if (options.verbose)
            console.log(`Got block ${height}...`)
          let json = block['data'];

          // Add key images of transactions in block to key images object
          if ('txs' in json) {
            let txs = json['txs'];

            if (options.verbose)
              console.log(`${txs.length} transactions in block ${height}...`)

            if (txs.length > 1) {
              // Get the key image and key offsets used in each transaction
              let tx_chain = Promise.resolve();
              for (let tx in txs) {
                let txid = txs[tx]['tx_hash'];
                if (options.verbose)
                  console.log(`Querying transaction ${txid}...`)
                
                tx_chain = tx_chain
                .then(() => {
                  return new Promise(resolve => {
                    request({ uri: `${url}/api/transaction/${txid}`, json: true })
                    .then(gettransactions => {
                      if (options.verbose)
                        console.log(`Got transaction ${txid}...`)

                      if ('coinbase' in gettransactions['data'])
                        if (gettransactions['data']['coinbase'])
                          resolve();

                      if ('inputs' in gettransactions['data']) {
                        let txs = gettransactions['data']['inputs'];
                        
                        for (let tx in txs) {
                          let transaction = txs[tx];
                          let key_image = transaction['key_image'];
                          let key_offsets = [];

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
                                fs.appendFile(options.file, `{ ${key_image}: [${key_offsets}], offset_format: 'absolute' }\n`, function(err) {
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
                              console.log(`{ ${key_image}: [${key_offsets}], offset_format: 'absolute' }`);
                            } else {
                              console.log(`${key_image} absolute ${key_offsets.join(' ')}`);
                            }
                          }
                        }
                      }
                      resolve();
                    });
                  });
                });
              }
            }
          }
          resolve();
        });
      });
    });
  }
})
.catch(err => {
  // API call failed...
});
