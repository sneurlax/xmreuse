# `xmreuse`
A Node.js tool to assist with the reuse of rings across Cryptonote blockchain forks

## What's in this tool?
#### [`daemon.js`](#daemonjs-1)
A script for scanning blocks for key image information from a Monero daemon's RPC API

#### [`onion-monero-blockchain-explorer.js`](#onion-monero-blockchain-explorerjs-1)
A script for scanning blocks for key image information from an Onion Monero Blockchain Explorer's JSON API

#### [`poolsnoop.js`](#poolsnoopjs-1)
A script for scraping mining pool APIs in order to detect when mining pools use one of their own coinbases as an input in one of their own transactions using a combination of http/https requests and a Monero daemon's RPC API

##### What is `poolsnoop.js` detecting?
If a mining pool announces the blocks that they find and if any of those coinbase outputs are later used in a ring signature in a transaction announced by that same pool, then the true output in that ring is probably the coinbase output.  This script scrapes mining pool APIs in order to associate coinbase outputs with a particular pool, then scans those pools' transactions to see if they've moved their own outputs.

## Usage

### `daemon.js`
```bash
$ node daemon --help

xmreuse/nodejs/daemon

  A script for scanning blocks for key image information from a Monero daemon's 
  RPC API in Node.js                                                      

Options

  -i, --host string       Daemon (default: "127.0.0.1")                         
  -p, --port number       Daemon port (default: 28083)                          
  --min Number            Block height to start scrape (default: 100 blocks     
                          back from the current height)                         
  --max number            Block height to end scrape (default: current height)  
  -l, --limit number      Number of blocks to scrape.  If set, overrides --min  
                          (default: 100)                              
  -f, --file string       Filename to write results to (default: none; logs to  
                          console)                                              
  -j, --json boolean      Print information in JSON format (default: false)     
  -v, --verbose boolean   Print more information (default: false)               
  -h, --help              Print this usage guide. 
```

### `onion-monero-blockchain-explorer.js`
```bash
$ node onion-monero-blockchain-explorer --help

xmreuse/nodejs/onion-monero-blockchain-explorer

  A script for scanning blocks for key image information from an Onion Monero   
  Blockchain Explorer's JSON API in Node.js                               

Options

  -u, --url string        Onion Monero Blockchain Explorer URL (default:        
                          "https://moneroexplorer.com")                         
  -p, --port number       API port (optional)                                   
  --min Number            Block height to start scrape (default: 100 blocks     
                          back from the current height)                         
  --max number            Block height to end scrape (default: current height)  
  -l, --limit number      Number of blocks to scrape.  If set, overrides --min  
                          (default: 100)                              
  -f, --file string       Filename to write results to (default: none; logs to  
                          console)                                              
  -j, --json boolean      Print information in JSON format (default: false)     
  -v, --verbose boolean   Print more information (default: false)               
  -h, --help              Print this usage guide.
```

### `poolsnoop.js`
```bash
$ node onion-monero-blockchain-explorer --help

xmreuse/nodejs/poolsnoop-daemon

  A script for scraping mining pool APIs in order to detect when mining pools   
  use one of their own coinbases as an input in one of their own transactions   
  using a combination of http/https requests and a Monero daemon's RPC API in   
  Node.js                                                                       

Options

  -i, --hostname string                       Daemon hostname (default: "127.0.0.1")                          
  -p, --port number                           Daemon port (default: 28083)                                    
  --min Number                                Block height to start scrape (default: 0)                       
  --max number                                Block height to end scrape (default: current height)            
  -l, --limit number                          Number of blocks to scrape.  If set, overrides --min (optional) 
  --xmrpool boolean (API format: poolui)      Scrape XMRPool                                                  
  --supportxmr boolean (API format: poolui)   Scrape SupportXMR                                               
  --viaxmr boolean (API format: poolui)       Scrape ViaXMR                                                   
  --hashvault boolean (API format: poolui)    Scrape HashVault                                                
  -A, --all boolean                           Scan all pools (optional)                                       
  --list boolean                              List all pools (optional)                                       
  -v, --verbose boolean                       Print more information (default: false)                         
  -h, --help                                  Print this usage guide.
```
```bash
$ node poolsnoop-deamon.js --list

xmreuse/nodejs/poolsnoop-daemon --list

  The following pools can be scraped by this tool:                              
                                                                                
  Submit requests for additional pools at:                                      
  https://github.com/sneurlax/xmreuse/issues                                    

Pools

  --xmrpool boolean (API format: poolui)      Scrape XMRPool    
  --supportxmr boolean (API format: poolui)   Scrape SupportXMR 
  --viaxmr boolean (API format: poolui)       Scrape ViaXMR     
  --hashvault boolean (API format: poolui)    Scrape HashVault
```
