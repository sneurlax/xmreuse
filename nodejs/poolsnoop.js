/**
 * xmreuse/nodejs/poolsnoop
 * 
 * A script for scraping mining pool APIs in order to detect when mining pools use one of their own coinbase outputs as an input in one of their own transactions using a combination of http/https requests and a Monero daemon's RPC API in Node.js
 * https://github.com/sneurlax/xmreuse
 *
 * Overview:
 *  If a mining pool announces the blocks that they find and if any of those coinbase outputs are later used in a ring signature in a transaction announced by that same pool, then the true output in that ring is probably the coinbase.  This script scrapes mining pool APIs in order to associate coinbase outputs with a particular pool, then scans those pools' transactions to see if they've moved their own outputs.
 * 
 * @author     sneurlax <sneurlax@gmail.com> (https://github.com/sneurlax)
 * @copyright  2018
 * @license    MIT
 */
'use strict'

const Monero = require('monerojs'); 
const request = require('request-promise');
const fs = require('fs');
const os = require('os');

// API notes
// poolui: ...?limit=4206931337
// node-cryptonote-pool: ...?height=N; need to count backwards from current height 25 blocks at a time from until (https://mixpools.org:8117/)stats.pool.stats.totalBlocks is reached

// API endpoints
const pools = {
  XMRPool: {
    api: 'https://api.xmrpool.net',
    format: 'poolui'
  },
  SupportXMR: {
    api: 'https://supportxmr.com/api',
    format: 'poolui'
  },
  // ViaXMR: {
  //   api: 'https://api.viaxmr.com',
  //   format: 'cryptonote-universal-pool'
  // },
  HashVault: {
    api: 'https://monero.hashvault.pro/api',
    format: 'poolui'
  },
  // MixPools: {
  //   api: 'https://mixpools.org:8117/get_blocks',
  //   format: 'node-cryptonote-pool'
  // }
};

// Commandline options
const commandLineArgs = require('command-line-args');
const optionDefinitions = [
  {
    name: 'filename',
    alias: 'f',
    description: 'Filename to which to append reused keys.  (default: "reused_keys.txt")', 
    type: String,
    typeLabel: '{underline string}'
  },
  {
    name: 'min',
    description: 'Block height to start scrape (default: 0)',
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
    name: 'blocks',
    alias: 'l',
    description: 'Number of blocks to scrape.  If set, overrides --min (optional)', 
    type: Number,
    typeLabel: '{underline number}'
  },
  {
    name: 'txs',
    alias: 't',
    description: 'Number of transactions to scrape at a time. (default: 1000)', 
    type: Number,
    typeLabel: '{underline number}'
  },
  { 
    name: 'hostname', 
    alias: 'i', 
    description: 'Daemon hostname (optional)', 
    type: String, 
    typeLabel: '{underline string}' 
  }, 
  { 
    name: 'port', 
    alias: 'p', 
    description: 'Daemon port (optional)', 
    type: Number, 
    typeLabel: '{underline number}' 
  }
]; // Options stub to build upon below

// Add pool APIs to options definitions
var poolOptions = [];
for (let pool in pools) {
  let poolOption = pools[pool];
  poolOption['name'] = pool.toLowerCase();
  poolOption['description'] = `Scrape ${pool}`;
  poolOption['type'] = String;
  poolOption['typeLabel'] = `{underline boolean} (API format: ${poolOption['format']})`;
  poolOptions.push(poolOption)
  optionDefinitions.push(poolOption);
}

// Append more options definitions
optionDefinitions.push(
  {
    name: 'all',
    alias: 'A',
    description: 'Scan all pools (optional)',
    type: Boolean,
    typeLabel: '{underline boolean}'
  },
  {
    name: 'list',
    description: 'List all pools (optional)',
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
);

var options = commandLineArgs(optionDefinitions);

// Help / usage
const commandLineUsage = require('command-line-usage');
if (options.help) {
  const sections = [
    {
      header: 'xmreuse/nodejs/poolsnoop',
      content: 'A script for scraping mining pool APIs in order to detect when mining pools use one of their own coinbase outputs as an input in one of their own transactions using a combination of http/https requests and a Monero daemon\'s RPC API in Node.js'
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

// List all pools
if (options.list) {
  const sections = [
    {
      header: 'xmreuse/nodejs/poolsnoop --list',
      content: 'The following pools can be scraped by this tool:\n\n{italic Submit requests for additional pools at:} {underline https://github.com/sneurlax/xmreuse/issues}'
    },
    {
      header: 'Pools',
      optionList: poolOptions
    }
  ];
  const usage = commandLineUsage(sections);
  console.log(usage);
  process.exit();
}

// Format pools to scan into options.pools (so all pools can be scanned later by just iterating through options.pools)
let poolStrings = []; // Array of pool name strings
if (!options.all) {
  for (let key in options) {
    let index = Object.keys(Object.keys(pools).reduce((c, k) => (c[k.toLowerCase()] = pools[k], c), {})).indexOf(key); // Search pools as lowercase strings in case pool passed lowercase (ie., pools defined are defined as eg. 'SupportXMR', but we need to search by 'supportxmr', etc. etc.)
    if (index > -1) {
      if (!('pools' in options))
        options.pools = [];
      poolStrings.push(Object.keys(pools)[index]);
      options.pools.push(Object.keys(pools)[index]);
    }
  }
}
if (!options.pools) {
  poolStrings = Object.keys(pools);
}
// Format pools to scan into a string ... aesthetic//cosmetic only
let poolsString = '';
for (let pool in poolStrings) {
  if (pool == poolStrings.length - 1) {
    if (pool > 1) {
      poolsString = poolsString.concat(`, and ${poolStrings[pool]}`);
    } else {
      poolsString = poolsString.concat(` and ${poolStrings[pool]}`);
    }
  } else {
    if (pool > 0)
      poolsString = poolsString.concat(`, `);    
    poolsString = poolsString.concat(`${poolStrings[pool]}`);
  }
}

if ((Object.keys(options).length === 0 && options.constructor === Object) && !(options.verbose && Object.keys(options).length == 1)) {
  console.log(`No arguments specified, using defaults: scanning all pools (${poolsString}) and reporting reused coinbase outputs as KEY (1 per line)`);
  console.log('Use the --help (or -h) commandline argument to show usage information.');
  options.pools = Object.keys(pools);
} else {
  if (options.all) {
    if (options.verbose)
      console.log(`Scanning all pools (${poolsString})`);
  } else { // No pool specified or pool not categorized
    if (options.pools) {
      if (options.verbose)
        console.log(`Scanning ${poolsString}`);
    } else {
      if (options.verbose)
        console.log(`No pools specified, scanning all pools (${poolsString})`);
      options.pools = Object.keys(pools);
    }
  }
}

// Set default filename
if (!options.filename)
  options.filename = 'reused_keys.txt';

// Initialize global variables
var data = {}; // To be populated by each pools' blocks
for (let pool in options.pools) {
  data[options.pools[pool]] = {
    height: 0, // Height of last update
    blocks: {}, // Mined blocks
    txs: {}, // Sent payments object
    payments: [], // Sent payments array
    coinbase_txids: [],
    coinbase_outs: [],
    coinbase_blocks: [], // Used for indexing purposes,
    formatted_offsets: [],
    reused_keys: []
  };
}

var daemonRPC = new Monero.daemonRPC({ autoconnect: true, hostname: options.hostname, port: options.port })
.then((daemon) => {
  console.log('Connected to daemon');
  daemonRPC = daemon;

  // Get current block height to start scraping process (not needed if no min, max, or limit option(s) are set
  if ('min' in options || 'max' in options || 'limit' in options) {
    daemonRPC.getblockcount()
    .then(networkinfo => {
      let maxHeight = networkinfo['count'] - 1;
      if (typeof options.max == 'undefined') {
        options.max = maxHeight;
      }

      if (typeof options.min == 'undefined') {
        if (typeof options.blocks == 'undefined') {
          options.min = 0;
        } else {
          options.min = options.max - options.blocks;
        }
      }

      // Scrape pools
      scrapeBlocks(options.pools.slice(0)); // .slice() creates a copy of the input array, preventing operations acting upon the source array (options.pools)
    });
  } else {
    options.min = options.min || 0;
    options.max = options.max || 42069313373;
    scrapeBlocks(options.pools.slice(0));
  }
});

// Use configured APIs to scrape a list of a pool's blocks
function scrapeBlocks(_pools) {
  let pool = _pools.shift();
  if (options.verbose)
    console.log(`Scraping ${pool}\'s API for blocks...`);

  // Scrape pool APIs for blocks
  let url = pools[pool].api;

  if (pools[pool].format == 'poolui') {
    let limit = options.blocks || 4206931337;
    let _url = url.concat(`/pool/blocks?limit=${limit}`); // TODO just request the latest blocks needed

    request({ uri: _url, json: true })
    .then(got => {
      if (options.verbose)
        console.log(`Got ${pool}\'s blocks...`);

      for (let block in got) {
        let hash = got[block].hash;
        let height = got[block].height;

        if (height > options.min && height < options.max && !(height in data[pool].blocks)) {
          if (options.verbose)
            console.log(`Added ${pool}\'s block ${height}`);

          data[pool].blocks[height] = {
            hash: hash,
            coinbase_outs: []
          };

          if (height > data[pool].height)
            data[pool].height = height;
        } else {
          if (options.verbose)
            console.log(`Skipped ${pool}\'s block ${height}`);
        }
      }

      if (Object.keys(data[pool].blocks).length == 0) {
        if (options.verbose)
          console.log(`${pool} had no blocks within configured block range, skipping...`);

        // Remove pool from list of pools to scrape
        options.pools.splice(options.pools.indexOf(pool), 1);

        if (_pools.length > 0) {
          scrapeBlocks(_pools);
        } else {
          // Build upon a list of a pool's blocks by adding each block's coinbase
          findCoinbaseTxs(options.pools.slice(0), options.pools.slice(0)[0], Object.keys(data[options.pools.slice(0)[0]].blocks));
        }
      } else {
        if (options.verbose)
          console.log(`Querying ${pool}\'s height...`);

        _url = url.concat('/network/stats');
        request({ uri: _url, json: true }, (error, response, networkinfo) => {
          if (networkinfo.height > data[pool].height) {
            data[pool].height = networkinfo.height;

            if (options.verbose)
              console.log(`Updated ${pool}\'s height to ${networkinfo.height}`);
          }

          if (_pools.length > 0) {
            scrapeBlocks(_pools);
          } else {
            // Build upon a list of a pool's blocks by adding each block's coinbase
            findCoinbaseTxs(options.pools.slice(0), options.pools.slice(0)[0], Object.keys(data[options.pools.slice(0)[0]].blocks));
          }
        }); // TODO catch error
      }
    }); // TODO catch error
  } else if (pools[pool].format == 'node-cryptonote-pool') {
    // Need to iterate through all blocks, 25 at a time...
  } else if (pools[pool].format == 'cryptonote-universal-pool') {
    // TODO
  } else {
    // No recognized format
  }
}

function findCoinbaseTxs(_pools, pool, _blocks) {
  let height = _blocks.shift();
  if (options.verbose)
    console.log(`Requesting ${pool}\'s block ${height}...`);

  daemonRPC.getblock_by_height(height)
  .then(block => {
    if ('miner_tx_hash' in block) {
      let coinbase_txid = block.miner_tx_hash;
      if (options.verbose)
        console.log(`Got coinbase transaction from ${pool}\'s block ${height}: ${coinbase_txid}`);

      data[pool].blocks[height].miner_tx_hash = coinbase_txid;
      data[pool].coinbase_txids.push(coinbase_txid);
    } else {
      console.log(`Failed to get ${pool}\'s block ${height}`);
    }

    if (_blocks.length > 0) {
      findCoinbaseTxs(_pools, pool, _blocks);
    } else {
      if (_pools.length > 0 && _pools[0] != pool) {
        pool = _pools.shift();
        findCoinbaseTxs(_pools, pool, Object.keys(data[pool].blocks));
      } else {
        findCoinbaseKeys(options.pools.slice(0), options.pools.slice(0)[0], Object.keys(data[options.pools.slice(0)[0]].blocks));
      }
    }
  });
}

function findCoinbaseKeys(_pools, pool, _blocks) {
  let height = _blocks.shift();
  let txid = data[pool].blocks[height].miner_tx_hash;
  if (height && txid) {
    if (options.verbose)
      console.log(`Requesting ${pool}\'s coinbase transaction ${txid}...`);

    daemonRPC.gettransactions([txid])
    .then(gettransactions => {
      if (gettransactions) {
        if (options.verbose)
          console.log(`Got transaction ${txid}...`);

        if ('txs' in gettransactions) {
          let txs = gettransactions['txs'];
          for (let tx in txs) { 
            if ('as_json' in txs[tx]) {
              let transaction = JSON.parse(txs[tx]['as_json']);

              let vout = transaction['vout'];
              for (let ini in vout) {
                if ('target' in vout[ini]) {
                  let output = vout[ini]['target'];
     
                  let public_key = output['key'];

                  data[pool].blocks[height].coinbase_outs.push(public_key);
                  data[pool].coinbase_outs.push(public_key);
                  data[pool].coinbase_blocks[public_key] = height; // Index coinbase outputs by block for use later
                  if (options.verbose)
                    console.log(`Added coinbase output ${public_key} to ${pool}\'s block ${height}`);
                }
              }
            }
          }
        } else {
          let vout = transaction['vout'];
          for (let ini in vout) {
            if ('target' in vout[ini]) {
              let output = vout[ini]['target'];
 
              let public_key = output['key'];

              data[pool].blocks[height].coinbase_outs.push(public_key);
              data[pool].coinbase_outs.push(public_key);
              data[pool].coinbase_blocks[public_key] = height; // Index coinbase outputs by block for use later
              if (options.verbose)
                console.log(`Added coinbase output ${public_key} to ${pool}\'s block ${height}`);
            }
          }
        }
      } else {
        // Re-scan block
        _blocks.unshift(height);
      }

      if (_blocks.length > 0) {
        findCoinbaseKeys(_pools, pool, _blocks);
      } else {
        if (_pools.length > 0) {
          pool = _pools.shift();
          findCoinbaseKeys(_pools, pool, Object.keys(data[pool].blocks));
        } else {
          scrapeTransactions(options.pools.slice(0));
        }
      }
    });
  } else {
    if (_blocks.length > 0) {
      findCoinbaseKeys(_pools, pool, _blocks);
    } else {
      if (_pools.length > 0) {
        pool = _pools.shift();
        findCoinbaseKeys(_pools, pool, Object.keys(data[pool].blocks));
      } else {
        scrapeTransactions(options.pools.slice(0));
      }
    }
  }
}

// Use configured APIs to scrape a list of a pool's transactions
function scrapeTransactions(_pools) {
  let pool = _pools.shift();
  if (options.verbose)
    console.log(`Scraping ${pool}\'s API for transactions...`);

  scrapePage(pool)
  .then(() => {
    if (_pools.length > 0) {
      scrapeTransactions(_pools);
    } else {
      scanTransactions(options.pools.slice(0), options.pools.slice(0)[0], data[pool].payments);
    }
  })
  .catch(err => {
    console.error(err);
    _pools.unshift(pool);

    if (_pools.length > 0) {
      scrapeTransactions(_pools);
    } else {
      scanTransactions(options.pools.slice(0), options.pools.slice(0)[0], data[pool].payments);
    }
  });
}

// Scrape pool APIs for transactions page-by-page
function scrapePage(pool, limit = options.txs || 1000, txs = 0, page = 0) {
  return new Promise((resolve, reject) => { // TODO reject() on error
    let url = pools[pool].api;

    if (pools[pool].format == 'poolui') {
      if (options.verbose)
        console.log(`Scraping ${pool}\'s API transactions ${page} to ${page + limit}...`);
      let _url = url.concat(`/pool/payments?limit=${limit}&page=${page}`);

      request({ uri: _url, json: true })
      .then(got => {
        if (options.verbose)
          console.log(`Got ${pool}\'s transactions ${page} to ${page + limit}...`);

        if (typeof got == 'object') {
          if (page == 0)
            txs = got[0].id;

          for (let tx in got) {
            if ('hash' in got[tx]) {
              let txid = got[tx].hash;
              if (txid && txid != undefined && txid != null)
                data[pool].payments.push(txid);
            }
          }

          if (options.verbose)
            console.log(`Scraped ${pool}\'s transactions ${page} to ${page + limit}`);
        }

        page += limit;
        if (page + limit > txs) {
          if (limit > 1) {
            limit = limit/10;
          } else {
            resolve();
          }
        }

        if (page < txs && txs > 0) {
          return scrapePage(pool, limit, txs, page)
          .then(() => {
            resolve();
          })
          .catch(err => {
            reject(err);
          });
        } else {
          reoslve();
        }
      })
      .catch(err => {
        if (page + 1000 > txs) {
          resolve();
        } else {
          return scrapePage(pool, limit, txs, page)
          .then(() => {
            resolve();
          })
          .catch(err => {
            reject(err);
          });
        }
      });
    } // TODO support other pool formats
  });
}

// Scan transactions for reuse of coinbases.
function scanTransactions(_pools, pool, txs) {
  let txid = txs.shift();
  if (options.verbose)
    console.log(`Requesting information for ${pool}\'s txid ${txid} to find offsets of inputs...`);

  if (txid && txid !== undefined && txid !== null) {
    daemonRPC.gettransactions([txid])
    .then(gettransactions => {
      if (options.verbose)
        console.log(`Got transaction information for ${txid}, finding offsets of inputs...`);

      if ('txs' in gettransactions) {
        let formatted_offsets = [];
        for (let tx in gettransactions.txs) {
          let height = gettransactions.txs[tx].block_height;
          let txid = gettransactions.txs[tx].tx_hash;
          if (height > options.min && height < options.max) {
            data[pool].txs[txid] = {
              key_indices: [],
              height: gettransactions.txs[tx].block_height
            };
            if ('as_json' in gettransactions.txs[tx]) {
              let transaction = JSON.parse(gettransactions.txs[tx].as_json);

              let vin = transaction.vin;
              for (let ini in vin) {
                let input = vin[ini].key;

                let key_offsets = {
                  relative: input.key_offsets,
                  absolute: []
                };

                for (let offset in key_offsets.relative) {
                  let index = key_offsets.relative[offset];
                  if (offset > 0)
                    index += key_offsets.absolute[offset - 1];
                  key_offsets.absolute.push(index);
                }

                let key_indices = {
                  relative: [],
                  absolute: []
                };
                for (let offset in key_offsets.relative) {
                  key_indices.relative.push({ index: key_offsets.relative[offset] });
                  key_indices.absolute.push({ index: key_offsets.absolute[offset] });
                }

                data[pool].txs[txid].key_indices.push(key_indices);

                data[pool].formatted_offsets.push(key_indices);
              }
              if (options.verbose)
                console.log(`Found offsets of ${pool}\'s transaction ${txid}...`);
            } 
          } else {
            if (options.verbose)
              console.log(`${pool}\'s transaction ${txid} is outside of the configured block range, skipping...`);

            delete data[pool].txs[txid];

            if (height < options.min) {
              data[pool].payments.splice(data[pool].payments.indexOf(txid));
              txs = [];
              if (_pools.length > 0) {
                pool = _pools.shift();
                scanTransactions(_pools, pool, data[pool].payments);
              } else {
                checkInputs(_pools, pool, data[pool].formatted_offsets);
              }
              break;
            } else {
              data[pool].payments.splice(data[pool].payments.indexOf(txid), 1);
            }

          }
        }
      }

      if (txs.length > 0) {
        scanTransactions(_pools, pool, txs);
      } else {
        if (_pools.length > 0) {
          pool = _pools.shift();
          scanTransactions(_pools, pool, data[pool].payments);
        } else {
          checkInputs(_pools, pool, data[pool].formatted_offsets);
        }
      }
    });
  } else {
    if (txs.length > 0) {
      scanTransactions(_pools, pool, txs);
    } else {
      if (_pools.length > 0) {
        pool = _pools.shift();
        scanTransactions(_pools, pool, data[pool].payments);
      } else {
        checkInputs(_pools, pool, data[pool].formatted_offsets);
      }
    }
  }
}

// Check if any vins reuse an earlier coinbase output
function checkInputs(_pools, pool, offsets) {
  let offset = offsets.shift();

  if (offset) {
    // Format offsets to check into a string ... aesthetic//cosmetic only
    let offsetsString = '';
    for (let index in offset.absolute) {
      if (index > 0)
        offsetsString = offsetsString.concat(`, `);
      if (index == offset.absolute.length - 1)
        offsetsString = offsetsString.concat(`or `);
      offsetsString = offsetsString.concat(offset.absolute[index].index);
    }
    if (options.verbose)
      console.log(`Checking if offsets ${offsetsString} reuse a ${pool} coinbase output...`);
    

    daemonRPC.get_outs(offset.absolute)
    .then(outputs => {
      // TODO validation (check that 'outs' in outputs)
      let found = false; // Local variable for reporting purposes later (cosmetic/aesthetic only)
      for (let output in outputs.outs) {
        let key = outputs.outs[output].key;
        let txid = outputs.outs[output].txid;
        if (data[pool].coinbase_outs.indexOf(key) > -1 /*|| data[pool].coinbase_txids.indexOf(txid) > -1*/) {
          found = true;
          let coinbase_block = data[pool].coinbase_blocks[key];
          if (options.verbose) {
            console.log(`Reuse of ${pool} block ${coinbase_block}\'s coinbase output ${key} in txid ${txid}`);
          } else {
            console.log(key);
          }
          if (data[pool].reused_keys.indexOf(key) == -1)
            data[pool].reused_keys.push(key);
        } else {
          // if (options.verbose)
          //   console.log(`No reuse in txid ${txid}`);
        }
      }
      if (!found) {
        if (options.verbose)
          console.log(`No reuse in offsets ${offsetsString}`);
      }

      if (offsets.length > 0) {
        checkInputs(_pools, pool, offsets);
      } else {
        if (_pools.length > 0) {
          findCoinbaseTxs(_pools, pool, Object.keys(data[_pools[0]].blocks));
        } else {
          for (let key in data[pool].reused_keys) {
            fs.appendFileSync(options.filename, data[pool].reused_keys[key] + os.EOL);
          }
          if (options.verbose)
            console.log(`Wrote reused keys to ${options.filename}`);
        }
      }
    });
  } else {
    if (_pools.length > 0) {
      findCoinbaseTxs(_pools, pool, Object.keys(data[_pools[0]].blocks));
    } else {
      for (let key in data[pool].reused_keys) {
        fs.appendFileSync(options.filename, data[pool].reused_keys[key] + os.EOL);
      }
      if (options.verbose)
        console.log(`Wrote reused keys to ${options.filename}`);
    }
  }
}
