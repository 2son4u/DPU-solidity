const WEB3_URL = `http://127.0.0.1:9545/`;

// Global variable
let web3, accounts, balances, transactionCounts;
let sender, receiver, senderIndex, receiverIndex;
let amount;

async function init() {
    // ผู้ให้บริการ Web3 โดยใช้การสื่อสารด้วย Http
    const provider = new Web3.providers.HttpProvider(WEB3_URL);
    web3 = new Web3(provider);

    // (1) Populate Account Table
    await populateAccountTable();
    // (2) Common Information
    await updateSelectOptions();
    await setupTransferButton();
    // (3) Setup Interface creation interface
    // (4) Tranfer Operation
        // Select Sender
        // Select Reciever / Recipent
}

async function populateAccountTable() {
    // ดึงข้อมูล account
    try 
    {
        accounts = await web3.eth.getAccounts();
        await getBalance();
        if (Array.isArray(accounts) && accounts.length > 0) {
            let htmlStr = '';
            for (let index = 0; index < accounts.length; index++) {
                const balanceEth = await web3.utils.fromWei(balances[index], 'ether');
                htmlStr += '<tr>';
                htmlStr += `<th scope="row">${index + 1}</th>`;
                htmlStr += `<td>${accounts[index]}</td>`;
                htmlStr += `<td>${Number(balanceEth).toFixed(8)}</td>`;
                htmlStr += `<td>${transactionCounts[index]}</td>`;
                htmlStr += '</tr>';
            }

            $('#accountList').html(htmlStr);
        }
    }
    catch (err) {
        console.log(err);
    }
    
}

async function getBalance() {
    balances = await Promise.all(accounts.map(async account => await web3.eth.getBalance(account)));
    // จำนวน transaction ที่แต่ละ account เคยทำ
    transactionCounts = await Promise.all(accounts.map(async account => await web3.eth.getTransactionCount(account)));
    // balances = [];
    // for (let i = 0; i < accounts.length; i++) {
    //     const balance = await web3.eth.getBalance(accounts[i]);
    //     balances.pust(balance);
    // }
}

async function updateSelectOptions() {
    if(Array.isArray(accounts) && accounts.length > 0) {
        let sOptions = "<option value='-1' >Select Sender Account </option>"
        let rOptions = "<option value='-1' >Select Receiver Account </option>"
        for (let i = 0; i < accounts.length; i++){
            sOptions += '<option value="' + i + '">' + (i + 1) + ') ' + accounts[i] + '</option>';
            rOptions += '<option value="' + i + '">' + (i + 1) + ') ' + accounts[i] + '</option>';
        }
        $('#Sender').html(sOptions);
        $('#Receiver').html(rOptions);
        $('#Sender').on('change', e => {
            senderIndex = e.target.value;
            sender = accounts[senderIndex];
        });
        $('#Receiver').on('change', e => {
            receiverIndex = e.target.value;
            receiver = accounts[receiverIndex];
        });
    }
}

async function setupTransferButton() {
    $('#TranferBtn').on('click', async e => {
        if(typeof sender == 'undefined' || typeof receiver == 'undefined' || sender == receiver)
            return;
            amount = web3.utils.toWei($('#TransferAmount').val(), "ether");
            const senderBalance = await web3.eth.getBalance(sender);
            console.log('sender bal ',senderBalance);
            const sBalanceBN = new web3.utils.BN(senderBalance);
            const amountBN = new web3.utils.BN(amount);
            let receipt;

            try{
                if(amountBN.gt(sBalanceBN))
                    alert("Insufficient Balance");
                else {
                    const estimatedGas = await web3.eth.estimateGas({value: amountBN,from: sender, to: receiver});
                    const sendingGas = Math.ceil(estimatedGas * 1.5);
                    receipt = await web3.eth.sendTransaction({value: amountBN, from: sender, to: receiver, gas: sendingGas});
                }
            } catch(err){
                console.log(err)
                alert('Unable to make a transfer')
            } finally {
                resetControl();
            }
            await populateAccountTable();
            await updateTransactionLog(receipt);
    });
}

async function updateTransactionLog(receipt){
    const logEntry = 
    '<li><p>Tx ID:' + receipt.transactionHash + '</p>' +
    '<p>Sender: ' + receipt.from + '</p>' +
    '<p>Gas Used: ' + receipt.cumulativeGasUsed + '</p>' +
    '<p>Gas Price: ' + receipt.effectiveGasPrice + '</p>' +
    '</li>';
    $('#TransactionLog').append(logEntry);
}

function resetControl () {
    $('#Sender').val(-1);
    $('#Receiver').val(-1);
    $('#TransferAmount').val('');
}