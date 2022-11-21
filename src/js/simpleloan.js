//const WEB3_URL = `http://127.0.0.1:9545/`;
const WEB3_URL = `ws://localhost:8545/`;
// Global variable
let web3, accounts, balances, borrowIndex ,payerIndex, borrower, payer;
let owner, contractAddress, debts;
let simpleLoan;
const DEFAULT_OPTION = -1;

async function init() {
    let provider;
    if(WEB3_URL.startsWith('ws'))
        provider = new Web3.providers.WebsocketProvider(WEB3_URL);
    else
        provider = new Web3.providers.HttpProvider(WEB3_URL);
    web3 = new Web3(provider);
    accounts = await web3.eth.getAccounts()
    await deployContract();
    // await populateAccountTable();
}

async function setupBorrowButton(){
    $('#BorrowBtn').on('click', async e => {
        let borrowAmount = parseFloat( $('#BorrowAmount').val());
        if(isNaN(borrowAmount) || typeof payer == 'undefined')
            return;
        const amount = web3.utils.toWei(String(borrowAmount), 'ether');
        try {
            const estGas = await simpleLoan.borrow.estimateGas(amount, { from: payer });
            const sendingGas = Math.ceil(estGas * 1.5);
            const {receipt} = await simpleLoan.borrow(amount, { from: payer, gas: sendingGas });
            updateBorrowLog(receipt);
            await getLoanInfo();
            await populateAccountTable();
        } catch (err){
            console.log(err);
            alert('Unable to borrow');
            return;
        } finally {
            resetBorrowControl();
        }
    });
}

function resetBorrowControl(){
    $('#BorrowAmount').val('');
    $('#Borrowers').val(-1);
}

function updateBorrowLog(receipt){
    const logEntry = 
    '<li><p>TxHash' + receipt.transactionHash + '</p>' +
    '<p>BlockNumber' + receipt.blockNumber + '</p>' +
    '<p>Borrower:' + receipt.from + '</p>'+
    '<p>Gas used:' + receipt.cumulativeGasUsed +'</p>'+
    '</li>';
    $('#BorrowTxLog').append(logEntry);
}

async function setupPaybackButton(){
    $('#PaybackBtn').on('click', async e => {
        let paybackAmount = parseFloat( $('#PaybackAmount').val());
        if(isNaN(paybackAmount) || typeof payer == 'undefined')
            return;
        const amount = web3.utils.toWei(String(paybackAmount), 'ether');
        try {
            const estGas = await simpleLoan.payback.estimateGas( {value : amount,  from: payer });
            const sendingGas = Math.ceil(estGas * 1.5);
            const {receipt} = await simpleLoan.payback({value:amount, from: payer, gas: sendingGas });
            updatePaybackLog(receipt);
            await getLoanInfo();
            await populateAccountTable();
        } catch (err){
            console.log(err);
            alert('Unable to payback');
            return;
        } finally {
            resetPaybackControl();
        }
    });
}

function resetPaybackControl(){
    $('#PaybackAmount').val('');
    $('#PaybackBorrowers').val(-1);
}

function updatePaybackLog(receipt){
    const logEntry = 
    '<li><p>TxHash' + receipt.transactionHash + '</p>' +
    '<p>BlockNumber' + receipt.blockNumber + '</p>' +
    '<p>Payer:' + receipt.from + '</p>'+
    '<p>Gas used:' + receipt.cumulativeGasUsed +'</p>'+
    '</li>';
    $('#PaybackTxLog').append(logEntry);
}

async function setupEventListener(){
    simpleLoan.Deposited().on('data', e => {
        const dateTime = (new Date(e.returnValues.time * 1000)).toLocaleString();
        const amountEther = web3.utils.fromWei(e.returnValues.amount,'ether');
        const html = '<li class="lead">[Deposited]:Owner has deposited ' + amountEther + 
        'Ether at ' + dateTime + '</li>';
        $('#EventLog').append(html);
    });
    simpleLoan.InterestRateChanged().on('data', e => {
        const dateTime = (new Date(e.returnValues.time * 1000)).toLocaleString();
        const newRate = e.returnValues.newRate;
        const html = '<li class="lead">[InterestRateChanged]:Interest Rate has changed from to '
        + newRate + '% at ' + dateTime + '</li>';
        $('#EventLog').append(html);
    });
    simpleLoan.Borrowed().on('data', e => {
        const dateTime = (new Date(e.returnValues.time * 1000)).toLocaleString();
        const amountEther = web3.utils.fromWei(e.returnValues.amount,'ether');
        const borrower = e.returnValues.borrower;
        const html = '<li class="lead">[Borrowed]:Borrower (' + borrower + 
        ') has borrowed '+amountEther+'Ether at ' + dateTime + '</li>';
        $('#EventLog').append(html);
    });
    simpleLoan.Paybacked().on('data', e => {
        const dateTime = (new Date(e.returnValues.time * 1000)).toLocaleString();
        const amountEther = web3.utils.fromWei(e.returnValues.amount,'ether');
        const borrower = e.returnValues.borrower;
        const remainingEther = web3.utils.fromWei(e.returnValues.remaining,'ether');
        const html = '<li class="lead">[Paybacked]:Borrower (' + borrower + 
        ') has repaid '+amountEther+ 'Ether ( ' + remainingEther + ' Ether remaining) at ' + dateTime + '</li>';
        $('#EventLog').append(html);
    });
    simpleLoan.LatePayback().on('data', e => {
        const dateTime = (new Date(e.returnValues.time * 1000)).toLocaleString();
        const amountEther = web3.utils.fromWei(e.returnValues.amount,'ether');
        const borrower = e.returnValues.borrower;
        const remainingEther = web3.utils.fromWei(e.returnValues.remaining,'ether');
        const period = e.returnValues.period;
        const html = '<li class="lead">[LatePaybacked]:Borrower (' + borrwer + 
        ') has repaid '+amountEther+ 'Ether ( ' + remainingEther + ' Ether remaining) at ' + dateTime + '(LATE BY: '+ period + ' Seconds) </li>';
        $('#EventLog').append(html);
    });
    simpleLoan.deptClreared().on('data', e => {
        const dateTime = (new Date(e.returnValues.time * 1000)).toLocaleString();
        const borrower = e.returnValues.borrower;
        const html = '<li class="lead">[DebtCleared]:Borrower (' + borrwer + 
        ') has repaid all debt at ' + dateTime + '</li>';
        $('#EventLog').append(html);
    });
    simpleLoan.Withdraw().on('data', e => {
        const dateTime = (new Date(e.returnValues.time * 1000)).toLocaleString();
        const amountEther = web3.utils.fromWei(e.returnValues.amount,'ether');
        const html = '<li class="lead">[Withdrawn]:Owner has withdrawn ' + amountEther + 
        'Ether at ' + dateTime + '</li>';
        $('#EventLog').append(html);
    });
    simpleLoan.ClosedDown().on('data', e => {
        const dateTime = (new Date(e.returnValues.time * 1000)).toLocaleString();
        const html = '<li class="lead">[ClosedDown]:Simple Loan contract is destroyed at ' + dateTime + '</li>';
        $('#EventLog').append(html);
    });
}

async function updateSelectOptions(){
    if(!(Array.isArray(accounts) || !accounts.length > 0))
        return;
    let borrowerOptions = '<option value="-1">Select Borrower Account</option>';
    for(let i = 1; i < accounts.length; i++){
        borrowerOptions += '<option value="' + i + '">' + 
            (i+1) + ') ' + accounts[i] + '</option>';
    }
    $('#Borrowers').html(borrowerOptions);
    $('#PaybackBorrowers').html(borrowerOptions);
    $('#Borrowers').on('change', async e => {
        borrowIndex = e.target.value;
        payer = accounts[borrowIndex];
    });
    $('#PaybackBorrowers').on('change', async e => {
        payerIndex = e.target.value;
        payer = accounts[borrowIndex];
    });
}

async function firstTimeDeposit(){
    owner = accounts[0];
    const firstDeposit = web3.utils.toWei('20','ether');
    try{
        await simpleLoan.deposit({value: firstDeposit, from: owner});
    } catch(err){
        console.log(err);
    }
}

async function getLoanInfo() {
    $('#LoanOwner').html(owner);
    $('#LoanContractAddress').html(contractAddress);
    try {
        const contractBalance = await web3.eth.getBalance(contractAddress);
        $('#LoanContractBalance').html(web3.utils.fromWei(contractBalance,'ether'));
        const borrowers = await simpleLoan.getBorrowers.call();
        $('#BorrowerCount').html(borrowers.length);
        const rateNumerator = await simpleLoan.interestRateNumberator.call();
        const rateDenominator = await simpleLoan.interestRateDenominator.call();
        const interestRate = Number(rateNumerator * 100 / rateDenominator).toFixed(2);
        $('#InterestRate').html(interestRate);
    }
    catch (err){
        console.log(err);
    }
    // await populateAccountTable();
}

async function setupNewInterestRateButton(){
    $('#NewInterestRateBtn').on('click',async e => {
        let newRate = ($('#NewInterestRate').val());
        if(isNaN(newRate) || newRate <= 0){
            alert('Invalid Interest Rate');
            return;
        }
        try{
            const estGas = await simpleLoan.setInterestRate.estimateGas(String(newRate), { from:owner });
            const sendingGas = Math.ceil(estGas * 1.5);
            await simpleLoan.setInterestRate((String(newRate), {from: owner, gas: sendingGas}));
            const rateNumerator = await simpleLoan.interestRateNumberator.call();
            const rateDenominator = await simpleLoan.interestRateDenominator.call();
            $('#InterestRate').html(Number(rateNumerator * 100 / rateDenominator).toFixed(2));
        } catch(err){
            console.log(err);
        } finally {
            $('#NewInterestRate').val('');
        }
    });
}

async function setupWithdrawButton(){
    $('#WithdrawBtn').on('click',async e => {
        let amount = String($('#WithdrawAmount').val());
        if(isNaN(amount) || amount <= 0){
            alert('Invalid Withdraw Amount');
            return;
        }

        const contractBalanceBN = new web3.utils.BN(await web3.eth.getBalance(contractAddress));
        let withdrawBN = new web3.utils.BN( web3.utils.toWei(String(amount), 'ether') );
        if(withdrawBN.gt(contractBalanceBN)){
            alert('Insufficient fund to withdraw');
            return;
        }
        try{
           const estGas = await simpleLoan.withdraw.estimateGas(withdrawBN,{from:owner});
           const sendingGas = Math.ceil(estGas * 1.5);
           await simpleLoan.withdraw(withdrawBN, {from:owner,gas:sendingGas});
        }catch (err){
            console.log(err)
        } finally {
            $('#WithdrawAmount').val('');
        }
        await populateAccountTable();
        await getLoanInfo();
    })
}

async function deployContract() {
    $.getJSON('SimpleLoan.json', async contractABI => {
        const contract = TruffleContract(contractABI);
        contract.setProvider(web3.currentProvider);
        try {
            simpleLoan = await contract.deployed();
            contractAddress = simpleLoan.address;
            console.log('simmple loan contract : ', simpleLoan)
            await setupEventListener();
            await firstTimeDeposit();
            await getLoanInfo();
            await populateAccountTable();
            await updateSelectOptions();
            await setupBorrowButton();
            await setupPaybackButton();
            await setupWithdrawButton();
            await setupNewInterestRateButton();
        }catch (err) {
            console.log(err);
        }
    });
}

async function getDebtsInfo(){
    const borrowers = await simpleLoan.getBorrowers.call();
    debts = await Promise.all(borrowers.map(async borrower => await simpleLoan.getDebt(borrower)));
}

async function populateAccountTable() {
    // ดึงข้อมูล account
    try 
    {
        // accounts = await web3.eth.getAccounts();
        await getBalance();
        await getDebtsInfo();
        const borrowers = await simpleLoan.getBorrowers.call();
        const currentDebts = [];
        console.log(borrowers.length)
        for(let i =0; i < accounts.length; i++){
            let found = false;
            for(let j = 0;j < borrowers.length; j++){
                if(accounts[i] == borrowers[j]){
                    currentDebts[i] = web3.utils.fromWei(debts[j],'ether');
                    found = true;
                    break;
                }
            }
            if(!found){
                currentDebts[i] = 0;
            }
        }

        if (Array.isArray(accounts) && accounts.length > 0) {
            let htmlStr = '';
            for (let index = 0; index < accounts.length; index++) {
                const balanceEth = await web3.utils.fromWei(balances[index], 'ether');
                htmlStr += '<tr>';
                htmlStr += `<th scope="row">${index + 1}</th>`;
                htmlStr += `<td>${accounts[index]}</td>`;
                htmlStr += `<td>${Number(balanceEth).toFixed(8)}</td>`;
                htmlStr += '<td>'+ currentDebts[index] + '</td>';
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
}