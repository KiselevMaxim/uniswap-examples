import 'dotenv/config.js';
import Web3 from 'web3';
import Tx from 'ethereumjs-tx';
import BigNumber from "bignumber.js";
import router2ABI from "./abi/IUniswapV2Router02.js";
import erc20ABI from "./abi/erc20.js";

let ethNetwork;
let web3;
let baseWallet;
let privateKey = process.env.PRIVATE_KEY;
let gasPriceGWEI = process.env.GAS_PRICE_GWEI;
let gasPriceWEI = new BigNumber(gasPriceGWEI * 10**9).toString();
let gasLimit = process.env.GAS_LIMIT;
const UniswapV2Router02 = '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D'; // same on mainnet and ropsten

const main = async (chain) => {    
    chain = (typeof(process.argv[2]) == 'undefined' ? chain : process.argv[2]);    
    ethNetwork = (chain == 'ropsten' ? process.env.Ropsten : (chain == 'mainnet' ? process.env.MainNet : null));
    web3 = new Web3(new Web3.providers.WebsocketProvider(ethNetwork))    
    
    let Router2Contract = new web3.eth.Contract(router2ABI, UniswapV2Router02)        
    let TOKEN = process.argv[3] //'0x22c69aabf79254f124bef3018d10ffe57ae3ff8f' // ropsten
    let TokenContract = await new web3.eth.Contract(erc20ABI, TOKEN)
    let tokenSymbol = await TokenContract.methods.symbol().call()
    let tokenName = await TokenContract.methods.name().call()    
    let ETHtoBUY = process.argv[4]//0.001;
    let ETHtoBUYWEIhex = '0x' + new BigNumber(ETHtoBUY * 10**18).toString(16);

    console.log('====================')
    console.log('| chain -', chain, ' |')
    console.log('====================')
    console.log('GWEI:', parseInt(gasPriceGWEI))
    console.log('Gas Limit:', parseInt(gasLimit))
    console.log('Max Budget:', ETHtoBUY, 'ETH')
    console.log('Selected token:', tokenName, '(' + tokenSymbol + ')')
    
    baseWallet = web3.eth.accounts.privateKeyToAccount("0x"+privateKey).address
    
    //*** from ABI: function WETH() external pure returns (address);    
    let WETH = await Router2Contract.methods.WETH().call();
    
    buyTokens(chain, Router2Contract, WETH, TOKEN, ETHtoBUYWEIhex);
}
    
const buyTokens = async (chain, Router2Contract, WETH, TOKEN, _ETHtoBUYWEIhex) => {

    // deadline parameter
    let _date = new Date(new Date().toUTCString());
    _date.setHours( _date.getHours() + 1)

    //*** from ABI: function swapExactETHForTokens(uint amountOutMin, address[] calldata path, address to, uint deadline) external payable returns (uint[] memory amounts);
    let funcData = await Router2Contract.methods.swapExactETHForTokens(0, [WETH, TOKEN], baseWallet, _date.getTime()).encodeABI()

    let nonce = await web3.eth.getTransactionCount(baseWallet)
    
    await sendTX(chain, funcData, UniswapV2Router02, nonce, _ETHtoBUYWEIhex, privateKey)
}

const sendTX = async (chain, funcData, _to, transactionCount, _ETHHEXvalue, _private) => {

    let privateKey = Buffer.from(_private, 'hex');

    let rawTx = {
        nonce: web3.utils.toHex(transactionCount),
        gasLimit: web3.utils.toHex(gasLimit),
        gasPrice: web3.utils.toHex(gasPriceWEI),
        to: _to,
        value: _ETHHEXvalue,
        data: funcData
    }

    let tx = (chain == 'ropsten' ? await new Tx.Transaction(rawTx, {'chain':'ropsten'}) : await new Tx.Transaction(rawTx));

    await tx.sign(privateKey);

    let serializedTx = await tx.serialize();
    
    await sendSignedTx('0x' + serializedTx.toString('hex'))
}

const sendSignedTx = async (serializedTx) => {

    web3.eth.sendSignedTransaction(serializedTx)    
        .on('transactionHash', hash => {
            console.log('transaction Hash ready:', hash)
        })
        .on('error', () => {        
            console.log('failed. Trying to buy', tokenSymbol, 'up to', ETHtoBUY, 'ETH using GWEI', parseInt(gasPriceGWEI), 'in gas.')
        })
}

main('');