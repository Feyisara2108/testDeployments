import { ethers } from "hardhat";
import { expect } from "chai";

describe("SaveEther", function () {
    let saveEther: any, addr1: any, addr2: any, addr3: any;

    beforeEach(async function () {
        const SaveEther = await ethers.getContractFactory("SaveEther");
        [addr1, addr2, addr3] = await ethers.getSigners();

        saveEther = await SaveEther.deploy();
        await saveEther.waitForDeployment();
    });

    it("should be able to deposit ether", async function () {
        const depositAmount = ethers.parseEther("2");
        await saveEther.connect(addr1).deposit({ value: depositAmount });
        expect(await saveEther.connect(addr1).getUserSavings()).to.eq(depositAmount);
    });

    it("should not be able to deposit 0 ether", async function () {
        await expect( saveEther.connect(addr1).deposit({ value: 0 })).to.be.revertedWith("Can't deposit zero value");
    });

    it("should update contract balance after deposit", async function () {
        const depositAmount = ethers.parseEther("2");
        await saveEther.connect(addr1).deposit({ value: depositAmount });
        expect(await saveEther.getContractBalance()).to.eq(depositAmount);
    });

    it("should track balances for multiple users", async function () {
        const amount1 = ethers.parseEther("1");
        const amount2 = ethers.parseEther("3");

        await saveEther.connect(addr1).deposit({ value: amount1 });
        await saveEther.connect(addr2).deposit({ value: amount2 });

        expect(await saveEther.connect(addr1).getUserSavings()).to.eq(amount1);
        expect(await saveEther.connect(addr2).getUserSavings()).to.eq(amount2);
    });

    it("should be able to withdraw ether", async function () {
        const depositAmount = ethers.parseEther("2");
        const withdrawAmount = ethers.parseEther("1");

        await saveEther.connect(addr1).deposit({ value: depositAmount });
        await saveEther.connect(addr1).withdraw(withdrawAmount);

        expect(await saveEther.connect(addr1).getUserSavings()).to.eq(  depositAmount - withdrawAmount);
    });

    it("should not be able to withdraw zero", async function () {
        await expect( saveEther.connect(addr1).withdraw(0) ).to.be.revertedWith("Can't withdraw zero value");
    });

    it("should not be able to withdraw with no savings", async function () {
        const withdrawAmount = ethers.parseEther("1");
        await expect(saveEther.connect(addr2).withdraw(withdrawAmount)).to.be.revertedWith("Insufficient funds");
    });

    it("should update contract balance after withdrawal", async function () {
        const depositAmount = ethers.parseEther("3");
        const withdrawAmount = ethers.parseEther("1");

        await saveEther.connect(addr1).deposit({ value: depositAmount });
        await saveEther.connect(addr1).withdraw(withdrawAmount);

        expect(await saveEther.getContractBalance()).to.eq(depositAmount - withdrawAmount);
    });

    it("should return correct user savings", async function () {
        const depositAmount = ethers.parseEther("5");
        await saveEther.connect(addr1).deposit({ value: depositAmount });
        expect(await saveEther.connect(addr1).getUserSavings()).to.eq(depositAmount);
    });

    it("should return 0 for user with no savings", async function () {
        expect(await saveEther.connect(addr3).getUserSavings()).to.eq(0);
    });

    it("should return correct contract balance", async function () {
        const amount1 = ethers.parseEther("2");
        const amount2 = ethers.parseEther("3");

        await saveEther.connect(addr1).deposit({ value: amount1 });
        await saveEther.connect(addr2).deposit({ value: amount2 });

        expect(await saveEther.getContractBalance()).to.eq(amount1 + amount2);
    });

    it("should emit DepositSuccessful event", async function () {
        const depositAmount = ethers.parseEther("1");
        await expect(saveEther.connect(addr1).deposit({ value: depositAmount })).to.emit(saveEther, "DepositSuccessful") .withArgs(addr1.address, depositAmount);
    });

    it("should emit WithdrawalSuccessful event", async function () {
        const depositAmount = ethers.parseEther("2");
        const withdrawAmount = ethers.parseEther("1");

        await saveEther.connect(addr1).deposit({ value: depositAmount });
        await expect(saveEther.connect(addr1).withdraw(withdrawAmount)) .to.emit(saveEther, "WithdrawalSuccessful") .withArgs(addr1.address, withdrawAmount);
    });

    it("should receive ether via receive()", async function () {
        const amount = ethers.parseEther("1");
        const saveEtherAddress = await saveEther.getAddress();

        await addr1.sendTransaction({ to: saveEtherAddress, value: amount });
        expect(await saveEther.getContractBalance()).to.eq(amount);
    });
});