const WEB3_URL = `http://127.0.0.1:9545/`;

// Global variable
let web3, accounts, balances, borrowIndex ,payerIndex, borrower, payer;
let owner, contractAddress, debts;
let simpleLoan;
const DEFAULT_OPTION = -1;

async function init() {
    const provider = new Web3.providers.HttpProvider(WEB3_URL);
    web3 = new Web3(provider);
    accounts = await web3.eth.getAccounts()
    await deployCintract();
    // await populateAccountTable();
}

async function setupBorrowButton(){
    $('#BorrowBtn').on('click', async e => {
        let borrowAmount = parseFloat( $('#BorrowAmount').val());
        if(isNaN(borrowAmount) || typeof borrower == 'undefined')
            return;
        const amount = web3.utils.toWei(borrowAmount, 'ether');
        try {
            const estGas = await simpleLoan.borrow.estimateGas(amount, { from: borrower });
            const sendingGas = Math.ceil(estGas * 1.5);
            const receipt = await simpleLoan.borrow(amount, { from: borrower, gas: sendingGas });
            updateBorrowLog(receipt);
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
    $('#BorrowTransactionLog').append(logEntry);
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
        borrower = accounts[borrowIndex];
    });
    $('#PaybackBorrowers').on('change', async e => {
        payerIndex = e.target.value;
        payer = accounts[borrowIndex];
    });
}

async function getLoanInfo() {
    owner = accounts[0];
    $('#LoanOwner').html(owner);
    $('#LoanContractAddress').html(contractAddress);
    const firstDeposit = web3.utils.toWei('20', 'ether');
    try {
        await simpleLoan.deposit({value: firstDeposit, from: owner})
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

async function deployCintract() {
    $.getJSON('SimpleLoan.json', async contractABI => {
        const contract = TruffleContract(contractABI);
        contract.setProvider(web3.currentProvider);
        try {
            simpleLoan = await contract.deployed();
            contractAddress = simpleLoan.address;
            console.log('simmple loan contract : ', simpleLoan)
            await getLoanInfo();
            await populateAccountTable();
            await updateSelectOptions();
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
        for(let i =0; i < accounts.length; i++){
            let found = false;
            for(let j = 0; borrowers.length; j++){
                currentDebts[i] = web3.utils.fromWei(debts[j],'ether');
                found = true;
                break;
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