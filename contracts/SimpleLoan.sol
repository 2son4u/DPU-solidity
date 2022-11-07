// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity  >=0.8.0;

contract SimpleLoan {
    // payable จะทำให้สามารถรับเงินได้
    address payable owner;

    // รายละเอียดของหนี้ของคน
    struct DebInfo {
        uint balance; // ยอดหนี้
        uint lastBorrowed; // เก็ยว่าคนนนี้มากู้เมื่อไหร่ (block.timestamp)
    }

    // key: val | address: id ของผู้กู้, DebInfo รายละเอียดการกู้
    mapping(address => DebInfo) public debts; // Debt tables
    // solidity ไม่มีทศนิยม เราจึงใช้เทคนิคเก็บเป็นเศษส่วน
    // เศษ
    uint public interestRateNumberator;

    //ส่วน 
    uint public interestRateDenominator;

    uint public constant DEFAULT_INTEREST_NUMERATOR = 1;
    uint public constant DEFAULT_INTEREST_DEMONIRATOR = 10;
    uint public constant PAYBACK_PERIOD = 60 * 60 * 24 * 7; // วิ, นาที, ชั่วโมง, วัน

    // ผู้ยืม
    address[] public borrowers; 
    // สถานะของ contract
    bool active;

    constructor() {
        // msg คือคนที่สร้าง contract
        owner = payable(msg.sender);
        interestRateNumberator = DEFAULT_INTEREST_NUMERATOR;
        interestRateDenominator = DEFAULT_INTEREST_DEMONIRATOR;

        // ให้ contract ทำงาน
        active = true;
    }

    // กำหนดว่าฟังชันนี้เรียกใช้ได้จากเจ้าของเท่านั้น
    modifier onlyOwner {
        // ถ้าเงื่อนไขใน require ผิดจะถูกย้อนกลับทั้งหมด
        require(msg.sender == owner, "Only owner allowed");
        _; //ให้ทำงานต่อไปได้
    }

    modifier notAnOwner {
        require(msg.sender != owner, "Only owner not allowed");
        _;
    }

    modifier whenActive {
        require(active, "Contract is not active");
        _;
    }

    // event เป็นการสร้าง log
    event Deposited(uint time, uint amout, uint balance);
    // ฟังชันที่รับเงินได้จะต้องมี payable
    // เฉพาะ owner ที่ฝากเงินได้และ contract ต้อง active
    function deposit() public payable onlyOwner whenActive {
        // (เวลาปัจจุบันของ block, ดูค่าเงินจาก msg, ดู balance ของ contract ด้วย this แล้วเข้าถึง address เพื่อไปเอา balance)
        emit Deposited(block.timestamp, msg.value, address(this).balance);
    }

    // log rate
    event InterestRateChanged(uint time, uint newRate);
    // เปลี่ยนแปรงอัตราดอกเบี้ยตั้งแต่ 0 - 100
    function setInterestRate(uint numerator) public onlyOwner whenActive {
        require(numerator > 0, "Invalid interest rate");
        interestRateDenominator = numerator;
        interestRateNumberator = 100;

        //example 7 / 100 = 0.7

        emit InterestRateChanged(block.timestamp, numerator);
    }

    event Borrwed(uint time, uint amount, uint interest, address borrower);

    // external ต้องเรียกจากภายนอกเท่านั้น
    // public เรียกจากภายในหรือภายนอกก็ได้

    // คนที่ไม่ใช้เจ้าของถึงจะกู้ได้ และ contract ต้อง active เท่านั้น
    // ฟังชันกู้ยืมเงิน
    function borrow(uint amount) external notAnOwner whenActive {
        require(address(this).balance >= amount, "Not enough balance");

        // ถ้าหารก่อนแล้วมา * จะทำให้ค่าอาดคาดเคลื่น แนะนำให้ * ก่อนแล้วค่อย /
        uint interest = (amount * interestRateNumberator / interestRateDenominator); // ดอกเบี้ย
        uint debt = amount + interest;

        // ถ้าไม่มีข้อมูลมันจะ return 0 ออกมา
        if (debts[msg.sender].balance == 0) {
            // ถ้าเป็น 0 คือผู้กู้รายใหม่
            // ผู้ไปยัง array ผู้กู้รายใหม่
            borrowers.push(msg.sender);

            // เพิ่มข้อมูลผู้กู้รายใหม่ไปยัง map table
            debts[msg.sender] = DebInfo(0, 0);
        }
        debts[msg.sender].balance += debt;
        debts[msg.sender].lastBorrowed = block.timestamp;

        // โอนเงินไปให้ผู้ใช้มากู้ โดยส่ง amount ไปให้
        // transfer เป็น func ที่มช้ได้กับข้อมูลชนิด address
        payable(msg.sender).transfer(amount);

        // เวลา, จำนวนเงิน, ดอกเบี้ย, ผู้ยืม
        emit Borrwed(block.timestamp, amount, interest, msg.sender);
    }


    // เพื่อชำระคืน
    event Paybacked(uint time, uint amount, uint remaining, address borrower);
    // period ระยะเวลาที่เกินมา
    event LatePayback(uint time, uint amount, uint remaining, address borrower, uint period);
    // ถ้าชำระหนี้หมด
    event deptClreared(uint time, address borrower);

    // ให้ผู้กู้มาจ่ายคืน
    // payable ใช้เฉพาะฟังชัยที่รับเงิน
    function payback() external payable notAnOwner whenActive {
        // ยอดเงินจะต้องน้อยกว่าหนี้ที่เป็นอยู่
        require(msg.value <= debts[msg.sender].balance, "Overpaid not allowed");

        // หนี้ปัจจุบัน - เงินที่ใช้คืน
        debts[msg.sender].balance -= msg.value;

    
        if (block.timestamp - debts[msg.sender].lastBorrowed < PAYBACK_PERIOD) {
            // ถ้าหากเวลายังไม่เกินกำหนด
            emit Paybacked(block.timestamp, msg.value, debts[msg.sender].balance, msg.sender);
        } else {
            // ถ้าหากเวลาเกินกำหนด
            emit LatePayback(
                block.timestamp, 
                msg.value, 
                debts[msg.sender].balance, 
                msg.sender, 
                block.timestamp - debts[msg.sender].lastBorrowed - PAYBACK_PERIOD);
        }

        // ถ้าหนี้หมด
        if (debts[msg.sender].balance == 0) {
            for (uint i = 0; i < borrowers.length; i++) {
                if (borrowers[i] == msg.sender) {
                    delete borrowers[i];
                    delete debts[msg.sender];
                    emit deptClreared(block.timestamp, msg.sender);
                    break;
                }
            }
        }
    }

    event Withdraw(uint time, uint amount);
    // ถอนเงิน
    function withdraw(uint amount) external onlyOwner whenActive {

        // เงินที่ขอถอนจะต้องไม่เกินเงินที่ contract นี้มีอยู่
        require (amount <= address(this).balance, "Not enough balance");
        // address ของผู้รับ.transfer(จำนวนเงิน)
        owner.transfer(amount);
        emit Withdraw(block.timestamp, amount);
    }

    event ClosedDown(uint time);
    //เลิกกิจการ
    function closeDown() external onlyOwner whenActive {
        require (borrowers.length == 0, "Can not close due existing borrowers");
        active = false;
        emit ClosedDown(block.timestamp);
        
        // ทำลายตัวเอง 
        // address ยังอยู่อยู่แต่ไม่ทำงาน
        // เงินเหลือเท่าไหร่จะโอนเงินให้ Owner อัตโนมัติ
        selfdestruct(owner);
    }
}