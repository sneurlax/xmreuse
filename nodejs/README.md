# `xmreuse`

A Node.js tool to assist with the reuse of rings across Cryptonote blockchain forks

## What's in this tool?

#### [`daemon.js`](#daemonjs-1)
A script for scanning blocks for key image information from a Monero daemon's RPC API

#### [`onion-monero-blockchain-explorer.js`](#onion-monero-blockchain-explorerjs-1)
A script for scanning blocks for key image information from an Onion Monero Blockchain Explorer's JSON API

## Usage

### `daemon.js`

```bash
$ node daemon --help


xmreuse/nodejs/daemon

  A script for scanning blocks for key image information from a Monero daemon's 
  RPC API using Node.js                                                         

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
  Blockchain Explorer's JSON API using Node.js                                  

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
