import { ethers } from "hardhat";
import { expect } from "chai";

describe("SchoolToken & SchoolManager", function () {
    let schoolToken: any, schoolManager: any;
    let owner: any, principal: any, student1: any, student2: any, staff1: any, staff2: any;

    beforeEach(async function () {
        [owner, principal, student1, student2, staff1, staff2] = await ethers.getSigners();

        const SchoolToken = await ethers.getContractFactory("SchoolToken");
        const SchoolManager = await ethers.getContractFactory("SchoolManager");

        const initialSupply = ethers.parseEther("1000");
        schoolToken = await SchoolToken.connect(owner).deploy(initialSupply);
        await schoolToken.waitForDeployment();

        const schoolTokenAddress = await schoolToken.getAddress();

        schoolManager = await SchoolManager.connect(principal).deploy(schoolTokenAddress);
        await schoolManager.waitForDeployment();

        const schoolManagerAddress = await schoolManager.getAddress();

        await schoolToken.connect(owner).mint(student1.address, ethers.parseEther("100"));
        await schoolToken.connect(owner).mint(student2.address, ethers.parseEther("100"));

        await schoolToken.connect(student1).approve(schoolManagerAddress, ethers.parseEther("100"));
        await schoolToken.connect(student2).approve(schoolManagerAddress, ethers.parseEther("100"));
    });



    describe("SchoolToken - Deployment", function () {
        it("should have correct name, symbol and decimals", async function () {
            expect(await schoolToken.name()).to.eq("SchoolToken");
            expect(await schoolToken.symbol()).to.eq("SCH");
            expect(await schoolToken.decimals()).to.eq(18);
        });

        it("should mint initial supply to owner on deployment", async function () {
            const initialSupply = ethers.parseEther("1000");
            // Owner balance = initial supply + 200 minted to students in beforeEach
            const ownerBalance = await schoolToken.balanceOf(owner.address);
            expect(ownerBalance).to.eq(initialSupply);
        });

        it("should set correct owner", async function () {
            expect(await schoolToken.owner()).to.eq(owner.address);
        });
    });


    describe("SchoolToken - Mint", function () {
        it("should allow owner to mint tokens to any address", async function () {
            const mintAmount = ethers.parseEther("50");
            await schoolToken.connect(owner).mint(staff1.address, mintAmount);
            expect(await schoolToken.balanceOf(staff1.address)).to.eq(mintAmount);
        });

        it("should increase total supply when minting", async function () {
            const supplyBefore = await schoolToken.totalSupply();
            const mintAmount = ethers.parseEther("50");
            await schoolToken.connect(owner).mint(staff1.address, mintAmount);
            expect(await schoolToken.totalSupply()).to.eq(supplyBefore + mintAmount);
        });

        it("should revert if non-owner tries to mint", async function () {
            await expect(
                schoolToken.connect(student1).mint(student1.address, ethers.parseEther("50"))
            ).to.be.revertedWithCustomError(schoolToken, "NotOwner");
        });
    });


    describe("SchoolToken - Transfer", function () {
        it("should transfer tokens between addresses", async function () {
            const amount = ethers.parseEther("10");
            await schoolToken.connect(student1).transfer(student2.address, amount);
            expect(await schoolToken.balanceOf(student2.address)).to.eq(
                ethers.parseEther("110") // student2 already has 100 from beforeEach
            );
        });

        it("should revert transfer to zero address", async function () {
            await expect(
                schoolToken.connect(student1).transfer(ethers.ZeroAddress, ethers.parseEther("10"))
            ).to.be.revertedWithCustomError(schoolToken, "ZeroAddress");
        });

        it("should revert transfer with insufficient balance", async function () {
            await expect(
                schoolToken.connect(student1).transfer(student2.address, ethers.parseEther("9999"))
            ).to.be.revertedWithCustomError(schoolToken, "InsufficientBalance");
        });
    });


    describe("SchoolToken - Approve & TransferFrom", function () {
        it("should approve spender and emit Approval event", async function () {
            const amount = ethers.parseEther("50");
            await expect(schoolToken.connect(student1).approve(staff1.address, amount))
                .to.emit(schoolToken, "Approval")
                .withArgs(student1.address, staff1.address, amount);
        });

        it("should allow approved spender to transferFrom", async function () {
            const amount = ethers.parseEther("20");
            await schoolToken.connect(student1).approve(staff1.address, amount);
            await schoolToken.connect(staff1).transferFrom(student1.address, staff1.address, amount);
            expect(await schoolToken.balanceOf(staff1.address)).to.eq(amount);
        });

        it("should revert transferFrom with insufficient allowance", async function () {
            await expect(
                schoolToken.connect(staff1).transferFrom(student1.address, staff1.address, ethers.parseEther("999"))
            ).to.be.revertedWithCustomError(schoolToken, "InsufficientAllowance");
        });
    });


    describe("SchoolToken - Buy & Sell Tokens", function () {
        it("should mint tokens when ETH is sent via buyTokens", async function () {
            const ethAmount = ethers.parseEther("1");
            await schoolToken.connect(student1).buyTokens({ value: ethAmount });
            // student1 already has 100 tokens from beforeEach
            expect(await schoolToken.balanceOf(student1.address)).to.eq(
                ethers.parseEther("100") + ethAmount
            );
        });

        it("should revert buyTokens with zero ETH", async function () {
            await expect(
                schoolToken.connect(student1).buyTokens({ value: 0 })
            ).to.be.revertedWithCustomError(schoolToken, "NoETHToSend");
        });

        it("should allow token holder to sell tokens back for ETH", async function () {
            const ethAmount = ethers.parseEther("2");

            // First buy tokens so contract has ETH
            await schoolToken.connect(student1).buyTokens({ value: ethAmount });

            // Now sell tokens back
            const balanceBefore = await ethers.provider.getBalance(student1.address);
            const tx = await schoolToken.connect(student1).sellTokens(ethAmount);
            const receipt = await tx.wait();
            const gasUsed = receipt.gasUsed * receipt.gasPrice;
            const balanceAfter = await ethers.provider.getBalance(student1.address);

            // Balance should increase by ethAmount minus gas
            expect(balanceAfter).to.be.closeTo( balanceBefore + ethAmount - receipt.fee, ethers.parseEther("0.001"));
        });

        it("should revert sellTokens with insufficient token balance", async function () {
            await expect(
                schoolToken.connect(staff1).sellTokens(ethers.parseEther("999"))
            ).to.be.revertedWithCustomError(schoolToken, "InsufficientBalance");
        });

        it("should revert sellTokens if contract has no ETH", async function () {
            // student1 has tokens but contract has no ETH
            await expect(
                schoolToken.connect(student1).sellTokens(ethers.parseEther("10"))
            ).to.be.revertedWithCustomError(schoolToken, "InsufficientContractFunds");
        });
    });


    describe("SchoolToken - Burn", function () {
        it("should burn tokens and reduce total supply", async function () {
            const burnAmount = ethers.parseEther("10");
            const supplyBefore = await schoolToken.totalSupply();
            await schoolToken.connect(student1).burn(burnAmount);
            expect(await schoolToken.totalSupply()).to.eq(supplyBefore - burnAmount);
            expect(await schoolToken.balanceOf(student1.address)).to.eq(
                ethers.parseEther("100") - burnAmount
            );
        });

        it("should revert burn with insufficient balance", async function () {
            await expect(
                schoolToken.connect(student1).burn(ethers.parseEther("9999"))
            ).to.be.revertedWithCustomError(schoolToken, "InsufficientBalance");
        });
    });

    // SCHOOL MANAGER TESTS

    describe("SchoolManager - Deployment", function () {
        it("should set correct principal", async function () {
            expect(await schoolManager.principal()).to.eq(principal.address);
        });

        it("should set correct token address", async function () {
            expect(await schoolManager.token()).to.eq(await schoolToken.getAddress());
        });
    });


    describe("SchoolManager - Register Student", function () {
        it("should register a level 100 student and collect correct fee", async function () {
            await schoolManager.connect(student1).registerStudent("Alice", 100);

            const [name, level, hasPaid] = await schoolManager.getStudent(student1.address);
            expect(name).to.eq("Alice");
            expect(level).to.eq(100);
            expect(hasPaid).to.eq(true);
        });

        it("should collect correct fee for each level", async function () {
            // Level 100 = 10 tokens
            await schoolManager.connect(student1).registerStudent("Alice", 100);
            expect(await schoolManager.getSchoolBalance()).to.eq(ethers.parseEther("10"));

            // Level 200 = 20 tokens
            await schoolManager.connect(student2).registerStudent("Bob", 200);
            expect(await schoolManager.getSchoolBalance()).to.eq(ethers.parseEther("30"));
        });

        it("should add student to studentList", async function () {
            await schoolManager.connect(student1).registerStudent("Alice", 100);
            expect(await schoolManager.getStudentCount()).to.eq(1);
        });

        it("should emit StudentRegistered event", async function () {
            await expect(schoolManager.connect(student1).registerStudent("Alice", 100))
                .to.emit(schoolManager, "StudentRegistered")
                .withArgs(student1.address, "Alice", 100);
        });

        it("should revert if student registers twice", async function () {
            await schoolManager.connect(student1).registerStudent("Alice", 100);
            await expect(
                schoolManager.connect(student1).registerStudent("Alice", 100)
            ).to.be.revertedWithCustomError(schoolManager, "AlreadyRegistered");
        });

        it("should revert with invalid level", async function () {
            await expect(
                schoolManager.connect(student1).registerStudent("Alice", 500)
            ).to.be.revertedWithCustomError(schoolManager, "InvalidLevel");
        });
    });


    describe("SchoolManager - Register Staff", function () {
        it("should allow principal to register staff", async function () {
            await schoolManager.connect(principal).registerStaff(
                staff1.address, "Mr. John", ethers.parseEther("5")
            );
            const s = await schoolManager.staffRecords(staff1.address);
            expect(s.name).to.eq("Mr. John");
            expect(s.isRegistered).to.eq(true);
        });

        it("should emit StaffRegistered event", async function () {
            const salary = ethers.parseEther("5");
            await expect(
                schoolManager.connect(principal).registerStaff(staff1.address, "Mr. John", salary)
            ).to.emit(schoolManager, "StaffRegistered")
             .withArgs(staff1.address, "Mr. John", salary);
        });

        it("should revert if non-principal registers staff", async function () {
            await expect(
                schoolManager.connect(student1).registerStaff(staff1.address, "Mr. John", ethers.parseEther("5"))
            ).to.be.revertedWithCustomError(schoolManager, "NotPrincipal");
        });

        it("should revert if staff is already registered", async function () {
            await schoolManager.connect(principal).registerStaff(staff1.address, "Mr. John", ethers.parseEther("5"));
            await expect(
                schoolManager.connect(principal).registerStaff(staff1.address, "Mr. John", ethers.parseEther("5"))
            ).to.be.revertedWithCustomError(schoolManager, "AlreadyRegistered");
        });
    });


    describe("SchoolManager - Pay Staff", function () {
        beforeEach(async function () {
        
            await schoolManager.connect(student1).registerStudent("Alice", 400); 
            await schoolManager.connect(student2).registerStudent("Bob", 400);   

            await schoolManager.connect(principal).registerStaff(
                staff1.address, "Mr. John", ethers.parseEther("10")
            );
            await schoolManager.connect(principal).registerStaff(
                staff2.address, "Mrs. Jane", ethers.parseEther("15")
            );
        });

        it("should pay a single staff member", async function () {
            await schoolManager.connect(principal).payStaff(staff1.address);
            expect(await schoolToken.balanceOf(staff1.address)).to.eq(ethers.parseEther("10"));
        });

        it("should emit StaffPaid event", async function () {
            await expect(schoolManager.connect(principal).payStaff(staff1.address))
                .to.emit(schoolManager, "StaffPaid")
                .withArgs(staff1.address, ethers.parseEther("10"));
        });

        it("should pay all staff at once", async function () {
            await schoolManager.connect(principal).payAllStaff();
            expect(await schoolToken.balanceOf(staff1.address)).to.eq(ethers.parseEther("10"));
            expect(await schoolToken.balanceOf(staff2.address)).to.eq(ethers.parseEther("15"));
        });

        it("should revert payStaff if staff not registered", async function () {
            await expect(
                schoolManager.connect(principal).payStaff(student1.address)
            ).to.be.revertedWithCustomError(schoolManager, "StaffNotRegistered");
        });

        it("should revert payStaff if school has insufficient funds", async function () {
        
            await schoolManager.connect(principal).registerStaff(
                owner.address, "Big Boss", ethers.parseEther("9999")
            );
            await expect(
                schoolManager.connect(principal).payStaff(owner.address)
            ).to.be.revertedWithCustomError(schoolManager, "InsufficientSchoolFunds");
        });

        it("should revert if non-principal tries to pay staff", async function () {
            await expect(
                schoolManager.connect(student1).payStaff(staff1.address)
            ).to.be.revertedWithCustomError(schoolManager, "NotPrincipal");
        });
    });


    describe("SchoolManager - Update Staff Salary", function () {
        beforeEach(async function () {
            await schoolManager.connect(principal).registerStaff(
                staff1.address, "Mr. John", ethers.parseEther("10")
            );
        });

        it("should update staff salary", async function () {
            const newSalary = ethers.parseEther("20");
            await schoolManager.connect(principal).updateStaffSalary(staff1.address, newSalary);
            const s = await schoolManager.staffRecords(staff1.address);
            expect(s.salary).to.eq(newSalary);
        });

        it("should emit SalaryUpdated event", async function () {
            const newSalary = ethers.parseEther("20");
            await expect(
                schoolManager.connect(principal).updateStaffSalary(staff1.address, newSalary)
            ).to.emit(schoolManager, "SalaryUpdated")
             .withArgs(staff1.address, newSalary);
        });

        it("should revert if non-principal updates salary", async function () {
            await expect(
                schoolManager.connect(student1).updateStaffSalary(staff1.address, ethers.parseEther("20"))
            ).to.be.revertedWithCustomError(schoolManager, "NotPrincipal");
        });

        it("should revert if staff is not registered", async function () {
            await expect(
                schoolManager.connect(principal).updateStaffSalary(student1.address, ethers.parseEther("20"))
            ).to.be.revertedWithCustomError(schoolManager, "StaffNotRegistered");
        });
    });


    describe("SchoolManager - Remove Staff", function () {
        beforeEach(async function () {
            await schoolManager.connect(principal).registerStaff(
                staff1.address, "Mr. John", ethers.parseEther("10")
            );
        });

        it("should remove a staff member", async function () {
            await schoolManager.connect(principal).removeStaff(staff1.address);
            const s = await schoolManager.staffRecords(staff1.address);
            expect(s.isRegistered).to.eq(false);
        });

        it("should emit StaffRemoved event", async function () {
            await expect(schoolManager.connect(principal).removeStaff(staff1.address))
                .to.emit(schoolManager, "StaffRemoved")
                .withArgs(staff1.address);
        });

        it("should not pay removed staff in payAllStaff", async function () {
            await schoolManager.connect(student1).registerStudent("Alice", 400);
            await schoolManager.connect(student2).registerStudent("Bob", 400);

            await schoolManager.connect(principal).removeStaff(staff1.address);
            await schoolManager.connect(principal).payAllStaff();

            expect(await schoolToken.balanceOf(staff1.address)).to.eq(0);
        });

        it("should revert removing already removed staff", async function () {
            await schoolManager.connect(principal).removeStaff(staff1.address);
            await expect(
                schoolManager.connect(principal).removeStaff(staff1.address)
            ).to.be.revertedWithCustomError(schoolManager, "StaffNotRegistered");
        });
    });


    describe("SchoolManager - Withdraw Fees", function () {
        beforeEach(async function () {
            // Fill school with tokens from student registrations
            await schoolManager.connect(student1).registerStudent("Alice", 400); 
            await schoolManager.connect(student2).registerStudent("Bob", 400);   
            // School has 80 tokens
        });

        it("should allow principal to withdraw fees", async function () {
            const withdrawAmount = ethers.parseEther("30");
            const balanceBefore = await schoolToken.balanceOf(principal.address);

            await schoolManager.connect(principal).withdrawFees(withdrawAmount);

            expect(await schoolToken.balanceOf(principal.address)).to.eq(
                balanceBefore + withdrawAmount
            );
        });

        it("should emit FeesWithdrawn event", async function () {
            const withdrawAmount = ethers.parseEther("30");
            await expect(schoolManager.connect(principal).withdrawFees(withdrawAmount))
                .to.emit(schoolManager, "FeesWithdrawn")
                .withArgs(principal.address, withdrawAmount);
        });

        it("should revert if non-principal withdraws", async function () {
            await expect(
                schoolManager.connect(student1).withdrawFees(ethers.parseEther("10"))
            ).to.be.revertedWithCustomError(schoolManager, "NotPrincipal");
        });

        it("should revert if withdrawal exceeds school balance", async function () {
            await expect(
                schoolManager.connect(principal).withdrawFees(ethers.parseEther("9999"))
            ).to.be.revertedWithCustomError(schoolManager, "InsufficientSchoolFunds");
        });
    });


    describe("SchoolManager - View Functions", function () {
        it("should return correct student count", async function () {
            expect(await schoolManager.getStudentCount()).to.eq(0);
            await schoolManager.connect(student1).registerStudent("Alice", 100);
            expect(await schoolManager.getStudentCount()).to.eq(1);
        });

        it("should return correct staff count", async function () {
            expect(await schoolManager.getStaffCount()).to.eq(0);
            await schoolManager.connect(principal).registerStaff(staff1.address, "Mr. John", ethers.parseEther("5"));
            expect(await schoolManager.getStaffCount()).to.eq(1);
        });

        it("should return all students", async function () {
            await schoolManager.connect(student1).registerStudent("Alice", 100);
            await schoolManager.connect(student2).registerStudent("Bob", 200);
            const students = await schoolManager.getAllStudents();
            expect(students.length).to.eq(2);
            expect(students[0]).to.eq(student1.address);
            expect(students[1]).to.eq(student2.address);
        });

        it("should return all staff", async function () {
            await schoolManager.connect(principal).registerStaff(staff1.address, "Mr. John", ethers.parseEther("5"));
            await schoolManager.connect(principal).registerStaff(staff2.address, "Mrs. Jane", ethers.parseEther("8"));
            const staff = await schoolManager.getAllStaff();
            expect(staff.length).to.eq(2);
        });

        it("should return correct school token balance", async function () {
            await schoolManager.connect(student1).registerStudent("Alice", 300); 
            expect(await schoolManager.getSchoolBalance()).to.eq(ethers.parseEther("30"));
        });
    });
});