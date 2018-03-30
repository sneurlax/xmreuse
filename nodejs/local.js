var Monero = require('moneronodejs');

var daemonRPC = new Monero.daemonRPC();
// var daemonRPC = new Monero.daemonRPC('127.0.0.1', 28081, 'user', 'pass', 'http'); // Example of passing in parameters
// var daemonRPC = new Monero.daemonRPC({ port: 28081, protocol: 'https'); // Parameters can be passed in as an object/dictionary

daemonRPC.getblockcount()
.then(blocks => {

  let startHeight = blocks['count'] - 1;
  console.log(startHeight);
  let limit = 200;

  let block_chain = Promise.resolve();
  for (let height = startHeight; height > startHeight - limit; height--) {
    let key_images = {};

    block_chain = block_chain
    .then(() => {
      daemonRPC.getblock_by_height(height)
      .then(block => {
        let json = JSON.parse(block['json']);

        // Add key images of transactions in block to key images object
        let txs = json['tx_hashes'];
        if (txs.length > 0) {
          // Get the key image and key offsets used in each transaction
          let tx_chain = Promise.resolve();
          for (let txi in txs) {
            let txid = txs[txi];

            tx_chain = tx_chain
            .then(() => {
              daemonRPC.gettransactions([txid])
                .then(gettransactions => {
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
                            console.log(`${key_image} ${key_offsets.join(' ')}`);
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
