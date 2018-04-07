/**
 * xmreuse/nodejs/poolsnoop
 * 
 * A script for scraping mining pool APIs in order to detect likely identifiable ring members using a combination of http/https requests and a Monero daemon's RPC API using Node.js
 * https://github.com/sneurlax/xmreuse
 *
 * Overview:
 *  If a mining pool announces the blocks that they find, then those coinbase outputs can be associated with a particular pool.  If that output is then used in a ring signature in a block found by the same pool, then the true output in the ring is probably the coinbase.  This script scrapes mining pool APIs in order to associate coinbase outputs with a particular pool, then scans those pools' blocks to see if they've moved their own outputs.
 * 
 * @author     sneurlax <sneurlax@gmail.com> (https://github.com/sneurlax)
 * @copyright  2018
 * @license    MIT
 */
'use strict'

// API notes
// poolui: ...?limit=4206931337
// node-cryptonote-pool: ...?height=N; need to count backwards from current height 25 blocks at a time from until https://mixpools.org:8117/stats.pool.stats.totalBlocks is reached

const pools = {
  XMRPool: {
    api: 'https://api.xmrpool.net',
    format: 'poolui'
  },
  SupportXMR: {
    api: 'https://supportxmr.com/api',
    format: 'poolui'
  },
  ViaXMR: {
    api: 'https://api.viaxmr.com',
    format: 'poolui'
  },
  HashVault: {
    api: 'https://monero.hashvault.pro/api',
    format: 'poolui'
  },
  MixPools: {
    api: 'https://mixpools.org:8117/get_blocks',
    format: 'node-cryptonote-pool'
  }
};

// Commandline options
const commandLineArgs = require('command-line-args');
const optionDefinitions = []; // Options stub to build upon below

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
    alias: 'l',
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

const options = commandLineArgs(optionDefinitions);

// Help / usage
const commandLineUsage = require('command-line-usage');
if (options.help) {
  const sections = [
    {
      header: 'xmreuse/nodejs/poolsnoop-daemon',
      content: 'A script for scraping mining pool APIs in order to detect likely identifiable ring members using a combination of http/https requests and a Monero daemon\'s RPC API using Node.js'
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
      header: 'xmreuse/nodejs/poolsnoop-daemon --list',
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
      options.pools.push(key);
    }
  }
}
if (!options.pools) {
  // options.pools = [];
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
  console.log('No arguments specified, using defaults: scanning all pools');
  console.log('Use the --help (or -h) commandline argument to show usage information.');
}

if (options.verbose) {
  if (options.all) {
    console.log(`Scanning all pools (${poolsString})`);
  } else { // No pool specified or pool not categorized
    if (options.pools) {
      console.log(`Scanning ${poolsString}`);
    } else {
      console.log(`No pools specified, scanning all pools (${poolsString})`);
      options.pools = Object.keys(pools);
    }
  }
}

// Scrape pools
const request = require('request');
var poolsToScrape = options.pools;
var blocks = {}; // To be populated by each pools' blocks
scrapePools(poolsToScrape);

function scrapePools(_pools) {
  let pool = _pools.shift();
  if (options.verbose)
    console.log(`Scanning ${pool}...`)

  // Scrape pools for blocks
  // request.get({ uri: `${url}/api/networkinfo`, json: true }, (error, response, data) => {});
  let url = pools[pool].api;

  if (pools[pool].format == 'poolui') {
    let _url = url.concat('/pool/blocks?limit=4206931337'); // TODO just request the latest blocks needed

    request.get({ uri: _url, json: true }, (error, response, data) => {
      if (options.verbose)
        console.log(`Got ${pool}\'s blocks...`);
      // console.log(data);

      blocks[pool] = {
        height: 0, // Height of last update
        blocks: {}
      };
      for (let block in data) {
        let hash = data[block].hash;
        let height = data[block].height;

        if (!(height in blocks[pool].blocks)) {
          if (options.verbose)
            console.log(`Added ${pool}\'s block ${height}`);

          blocks[pool].blocks[height] = {
            hash: hash
          };

          if (height > blocks[pool].height)
            blocks[pool].height = height;
        } else {
          if (options.verbose)
            console.log(`Skipped ${pool}\'s block ${height}`);
        }
      }

      _url = url.concat('/network/stats');
      request.get({ uri: _url, json: true }, (error, response, networkinfo) => {
        if (networkinfo.height > blocks[pool].height) {
          blocks[pool].height = networkinfo.height;

          if (options.verbose)
            console.log(`Updated ${pool}\'s height to ${networkinfo.height}`);
        }
        // console.log(blocks[pool]);

        if (_pools.length > 1) {
          scrapePools(_pools);
        } else {
          console.log('Done scraping.');
        }
      });
    });
  } else if (pools[pool].format == 'node-cryptonote-pool') {
    // Need to iterate through all blocks, 25 at a time...
  } else {
    // No recognized format
  }
}
