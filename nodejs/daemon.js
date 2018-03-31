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
    name: 'host',
    description: 'Daemon (default: "127.0.0.1")',
    type: String,
    typeLabel: '{underline string}'
  },
  {
    name: 'port',
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

if ((Object.keys(options).length === 0 && options.constructor === Object) || (options.verbose && Object.keys(options).length == 1))
  console.log('No arguments specified, using defaults: scanning the last 100 blocks and reporting key image information in format KEY_IMAGE A B C D');
  console.log('Use the --help (or -h) commandline argument to show usage information.');

const Monero = require('moneronodejs');

const daemonRPC = new Monero.daemonRPC({ host: options.host, port: options.port,  });
// var daemonRPC = new Monero.daemonRPC('127.0.0.1', 28081, 'user', 'pass', 'http'); // Example of passing in parameters
// var daemonRPC = new Monero.daemonRPC({ port: 28081, protocol: 'https'); // Parameters can be passed in as an object/dictionary

daemonRPC.getblockcount()
.then(blocks => {
  let startHeight;
  if (typeof options.min == 'undefined') {
    startHeight = blocks['count'] - 1;
  } else {
    startHeight = options.min;
  }

  let limit;
  if (typeof options.max == 'undefined') {
    limit = 100;
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
      daemonRPC.getblock_by_height(height)
      .then(block => {
        if (options.verbose)
          console.log(`Got block ${height}...`)
        let json = JSON.parse(block['json']);

        // Add key images of transactions in block to key images object
        let txs = json['tx_hashes'];
        if (options.verbose)
          console.log(`${txs.length} tranasctions in block ${height}...`)
        if (txs.length > 0) {
          // Get the key image and key offsets used in each transaction
          let tx_chain = Promise.resolve();
          for (let txi in txs) {
            let txid = txs[txi];
            if (options.verbose)
              console.log(`Querying transaction ${txid}...`)

            tx_chain = tx_chain
            .then(() => {
              daemonRPC.gettransactions([txid])
              .then(gettransactions => {
                if (options.verbose)
                  console.log(`Got transaction ${txid}...`)
                if ('txs' in gettransactions) {
                  let txs = gettransactions['txs'];
                  for (let tx in txs) {
                    if ('as_json' in txs[tx]) {
                      let transaction = JSON.parse(txs[tx]['as_json']);

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
                                fs.appendFile(options.file, `{ transaction: ${txid}, block: ${height}, key_image: ${key_image}, key_offsets: [${key_offsets}], offset_format: 'relative' }\n`, function(err) {
                                  if (err) throw err;
                                  console.log(`Wrote key image information to ${options.file}`);
                                });
                              } else {
                                fs.appendFile(options.file, `{ ${key_image}: [${key_offsets}], offset_format: 'relative' }\n`, function(err) {
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
                              console.log(`{ ${key_image}: [${key_offsets}], offset_format: 'relative' }`);
                            } else {
                              console.log(`${key_image} relative ${key_offsets.join(' ')}`);
                            }
                          }
                        }
                      }
                    }
                  }
                }
              });
            });
          }
        }
      });
    });
  };
});
