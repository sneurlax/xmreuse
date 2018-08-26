# `xmreuse`
A toolkit to assist with the detection of mining pool coinbase output reuse.

## What's in this tool?
#### [`poolsnoop.js`](#poolsnoopjs-1)
A script for scraping mining pool APIs in order to detect when mining pools use one of their own coinbases as an input in one of their own transactions using a combination of http/https requests and a Monero daemon's RPC API

##### What is `poolsnoop.js` detecting?
If a mining pool announces the blocks that they find and if any of those coinbase outputs are later used in a ring signature in a transaction announced by that same pool, then the true output in that ring is probably the coinbase output.  This script scrapes mining pool APIs in order to associate coinbase outputs with a particular pool, then scans those pools' transactions to see if they've moved their own outputs.

## Usage

### `poolsnoop.js`
```bash
$ node poolsnoop --help

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
$ node poolsnoop.js --list

xmreuse/nodejs/poolsnoop --list

  The following pools can be scraped by this tool:                              
                                                                                
  Submit requests for additional pools at:                                      
  https://github.com/sneurlax/xmreuse/issues                                    

Pools

  --xmrpool boolean (API format: poolui)      Scrape XMRPool    
  --supportxmr boolean (API format: poolui)   Scrape SupportXMR 
  --viaxmr boolean (API format: poolui)       Scrape ViaXMR     
  --hashvault boolean (API format: poolui)    Scrape HashVault
```
