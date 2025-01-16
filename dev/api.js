const express = require('express');
const bodyParser = require('body-parser');
const Blockchain = require("./blockchain");
const raymond = new Blockchain(); 
const uuid = require('uuid');
const nodeAddress = uuid.v1().split('-').join('');
const port = process.argv[2]
const path = require('path');

const app = express();
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));

app.use(express.static(path.join(__dirname, 'public')));

// Assign an instance or object of express to our app
app.get('/blockchain', function (req, res) {
    res.send(raymond)
});

app.post('/transaction', function (req, res) {
    const newTransaction = req.body;
    console.log(req.body);
    // res.send(`The amount of the transaction is ${req.body.amount} bitcoin`);
    // const blockIndex = raymond.createNewTransaction(req.body.amount,req.body.sender,req.body.recipient);
    const blockIndex = raymond.addTransactionToPendingTransactions(newTransaction);

    // transaction.push(blockIndex);
    res.json({note:`Transaction will be added in block ${blockIndex}.`});

});


//broadcasttransaction
app.post('/transaction/broadcast',function(req, res){
    const newTransaction = raymond.createNewTransaction(req.body.amount, req.body.sender, req.body.recipient);
    raymond.addTransactionToPendingTransactions(newTransaction);

    const requestpromises = [];
    raymond.networkNodes.forEach(networkNodeUrl => {
        const requestOptions = {

            url: networkNodeUrl + '/transaction',
            method: 'POST',
            body: newTransaction,
            json: true
        };
        requestpromises.push(rp(requestOptions));
    });
    Promise.all(requestpromises).then(data =>{
        res.json({note: "Transaction created and broadcasted successfully!"});
    });

})



app.get('/mine', function (req, res) {
    const lastBlock = raymond.getLastBlock();
    const previousBlockHash = lastBlock['hash'];
    const currentBlockData = {
        transactions: raymond.pendingTransactions,
        index: lastBlock['index']+1};
    const nonce =raymond.proofOfWork(previousBlockHash,currentBlockData);
    const blockHash = raymond.hashBlock(previousBlockHash,currentBlockData,nonce);
    const newBlock = raymond.createNewBlock(nonce,previousBlockHash,blockHash);

    const requestPromises = [];

    raymond.networkNodes.forEach(networkNodeUrl=>{
        const requestOptions = {
            url: networkNodeUrl + '/receive-new-block',
            method: 'POST',
            body: {newBlock: newBlock},
            json: true
        };
    })
    res.json({
        note: "New block mined successfully",block: newBlock

    });
    // raymond.createNewTransaction(12.5,"00",nodeAddress);
    raymond.createNewTransaction(req.body.amount,req.body.sender,req.body.recipient);

});

app.get('/mine-progress', function(req, res) {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const lastBlock = raymond.getLastBlock();
    const previousBlockHash = lastBlock['hash'];
    const currentBlockData = {
        transactions: raymond.pendingTransactions,
        index: lastBlock['index'] + 1
    };

    // Set up the callback to send hash attempts to client
    raymond.onHashGenerated = (hash, nonce) => {
        res.write(`data: ${JSON.stringify({
            hash: hash,
            nonce: nonce,
            attempts: nonce + 1,
            found: hash.substring(0, 4) === '0000'
        })}\n\n`);

        if (hash.substring(0, 4) === '0000') {
            raymond.onHashGenerated = null; // Clean up callback
            const newBlock = raymond.createNewBlock(nonce, previousBlockHash, hash);
            raymond.createNewTransaction(12.5, "00", "MINER-REWARD");
            res.end();
        }
    };

    req.on('close', () => {
        raymond.onHashGenerated = null; // Clean up callback if client disconnects
    });

    // Start the mining process
    raymond.proofOfWork(previousBlockHash, currentBlockData);
});

app.post('/register-and-broadcast-node',function(req,res){
    const newNodeUrl = req.body.NewNodeUrl;
    if(raymond.networkNodes.indexOf(newNodeUrl)== -1)
    raymond.networkNodes.push(newNodeUrl);
    const regNodesPromises = [];
    raymond.networkNodes.forEach(networkNodeUrl=>{
        const requestOptions = {
            url: networkNodeUrl + '/register-node',
            method: 'POST',
            body: {newNodeUrl: newNodeUrl},
            json:true
        };
        regNodesPromises.push(rp(requestOptions));

    });
    Promise.all;;(regNodesPromises)
    .then(data=>{

        const bulkRegisterOptions = {
            url: networkNodeUrl + '/register-nodes-bulk',
            method: 'POST',
            body: {allNetworkNodes: [...raymond.networkNodes,raymond.currentNodeUrl]},
            json:true
        };
        return rp(bulkRegisterOptions);


})
then(data =>{
    res.json({note: 'New node registered with network successfully'})
});

});

app.post('/register-node',function(req,res){
    const newNodeUrl = req.body.newNodeUrl;
    const nodeNotAlreadyPresent = raymond.networkNodes.indexOf(newNodeUrl) == -1;
    const notCurrentNode = raymond.currentNodeUrl !== newNodeUrl;
    if (nodeNotAlreadyPresent && notCurrentNode)
        raymond.networkNodes.push(newNodeUrl);

    res.json({note: 'New node registered successfully'});
});

app.post('/register-node-bulk',function (req,res){
    const allNetworkNodes = req.body.allNetworkNodes;
    allNetworkNodes.forEach(networkNodeUrl =>{
        const nodeNotAlreadyPresent = raymond.networkNodes.indexOf(networkNodeUrl) == -1;
        const notCurrentNode = raymond.currentNodeUrl !== networkNodeUrl;
        if (nodeNotAlreadyPresent && notCurrentNode) raymond.networkNodes.push(networkNodeUrl);
    });
    res.json({note: 'Bulk registration successfull'})

});

app.listen(port, function () {
    console.log(`Listening on port ${port}`);
});

