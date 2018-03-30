// COmmandline options
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
      header: 'xmreuse',
      content: 'A Node.js tool to assist with the reuse of rings across Cryptonote blockchain forks'
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

var Monero = require('moneronodejs');

var daemonRPC = new Monero.daemonRPC({ host: options.host, port: options.port,  });
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
    let key_images = {};

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

                            key_images[key_image] = key_offsets;
                            if (options.verbose)
                              console.log(`Transaction ${txid} in block ${height}:`);
                            if (options.json) {
                              console.log(`{ ${key_image}: [${key_offsets}] }`);
                            } else {
                              console.log(`${key_image} ${key_offsets.join(' ')}`);
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
