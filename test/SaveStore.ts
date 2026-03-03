import { ethers } from "hardhat";
import { expect } from "chai";

describe("SaveStore", function () {
    let saveStore: any, schoolToken: any;
    let owner: any, user1: any, user2: any;
    let saveStoreAddress: string;
    let tokenAddress: string;

    beforeEach(async function () {
        [owner, user1, user2] = await ethers.getSigners();

        // Deploy SchoolToken as our ERC20 token
        const SchoolToken = await ethers.getContractFactory("SchoolToken");
        schoolToken = await SchoolToken.connect(owner).deploy(ethers.parseEther("1000"));
        await schoolToken.waitForDeployment();
        tokenAddress = await schoolToken.getAddress();

        // Deploy SaveStore
        const SaveStore = await ethers.getContractFactory("SaveStore");
        saveStore = await SaveStore.deploy();
        await saveStore.waitForDeployment();
        saveStoreAddress = await saveStore.getAddress();

        // Fund users with tokens
        await schoolToken.connect(owner).mint(user1.address, ethers.parseEther("100"));
        await schoolToken.connect(owner).mint(user2.address, ethers.parseEther("100"));
    });

    describe("depositEther", function () {
        it("should deposit ether and update balance", async function () {
            const amount = ethers.parseEther("2");
            await saveStore.connect(user1).depositEther({ value: amount });
            expect(await saveStore.connect(user1).checkEtherBalance()).to.eq(amount);
        });

        it("should update etherBalance mapping", async function () {
            const amount = ethers.parseEther("1");
            await saveStore.connect(user1).depositEther({ value: amount });
            expect(await saveStore.etherBalance(user1.address)).to.eq(amount);
        });

        it("should accumulate multiple deposits", async function () {
            const amount = ethers.parseEther("1");
            await saveStore.connect(user1).depositEther({ value: amount });
            await saveStore.connect(user1).depositEther({ value: amount });
            expect(await saveStore.connect(user1).checkEtherBalance()).to.eq(amount + amount);
        });

        it("should track balances separately for different users", async function () {
            await saveStore.connect(user1).depositEther({ value: ethers.parseEther("1") });
            await saveStore.connect(user2).depositEther({ value: ethers.parseEther("3") });
            expect(await saveStore.connect(user1).checkEtherBalance()).to.eq(ethers.parseEther("1"));
            expect(await saveStore.connect(user2).checkEtherBalance()).to.eq(ethers.parseEther("3"));
        });

        it("should revert when depositing zero ether", async function () {
            await expect(
                saveStore.connect(user1).depositEther({ value: 0 })
            ).to.be.revertedWith("Send Ether");
        });

        it("should emit EtherDeposited event", async function () {
            const amount = ethers.parseEther("1");
            await expect(saveStore.connect(user1).depositEther({ value: amount }))
                .to.emit(saveStore, "EtherDeposited")
                .withArgs(user1.address, amount);
        });
    });

    describe("withdrawEther", function () {
        beforeEach(async function () {
            await saveStore.connect(user1).depositEther({ value: ethers.parseEther("5") });
        });

        it("should withdraw ether and reduce balance", async function () {
            const withdrawAmount = ethers.parseEther("2");
            await saveStore.connect(user1).withdrawEther(withdrawAmount);
            expect(await saveStore.connect(user1).checkEtherBalance()).to.eq(ethers.parseEther("3"));
        });

        it("should send ether back to user", async function () {
            const withdrawAmount = ethers.parseEther("2");
            const balanceBefore = await ethers.provider.getBalance(user1.address);

            const tx = await saveStore.connect(user1).withdrawEther(withdrawAmount);
            const receipt = await tx.wait();

            const balanceAfter = await ethers.provider.getBalance(user1.address);
            expect(balanceAfter).to.be.closeTo(
                balanceBefore + withdrawAmount - receipt.fee,
                ethers.parseEther("0.001")
            );
        });

        it("should allow full withdrawal", async function () {
            await saveStore.connect(user1).withdrawEther(ethers.parseEther("5"));
            expect(await saveStore.connect(user1).checkEtherBalance()).to.eq(0);
        });

        it("should revert if amount exceeds balance", async function () {
            await expect(
                saveStore.connect(user1).withdrawEther(ethers.parseEther("999"))
            ).to.be.revertedWith("Insufficient balance");
        });

        it("should revert if user has no balance", async function () {
            await expect(
                saveStore.connect(user2).withdrawEther(ethers.parseEther("1"))
            ).to.be.revertedWith("Insufficient balance");
        });

        it("should emit EtherWithdrawn event", async function () {
            const amount = ethers.parseEther("1");
            await expect(saveStore.connect(user1).withdrawEther(amount))
                .to.emit(saveStore, "EtherWithdrawn")
                .withArgs(user1.address, amount);
        });
    });

    describe("checkEtherBalance", function () {
        it("should return 0 for new user", async function () {
            expect(await saveStore.connect(user1).checkEtherBalance()).to.eq(0);
        });

        it("should return correct balance after deposit", async function () {
            const amount = ethers.parseEther("3");
            await saveStore.connect(user1).depositEther({ value: amount });
            expect(await saveStore.connect(user1).checkEtherBalance()).to.eq(amount);
        });

        it("should return correct balance after partial withdrawal", async function () {
            await saveStore.connect(user1).depositEther({ value: ethers.parseEther("5") });
            await saveStore.connect(user1).withdrawEther(ethers.parseEther("2"));
            expect(await saveStore.connect(user1).checkEtherBalance()).to.eq(ethers.parseEther("3"));
        });
    });

    describe("depositToken", function () {
        beforeEach(async function () {
            // Approve SaveStore to spend user1 tokens
            await schoolToken.connect(user1).approve(saveStoreAddress, ethers.parseEther("100"));
        });

        it("should deposit tokens and update token balance", async function () {
            const amount = ethers.parseEther("10");
            await saveStore.connect(user1).depositToken(tokenAddress, amount);
            expect(await saveStore.connect(user1).checkTokenBalance(tokenAddress)).to.eq(amount);
        });

        it("should update tokenBalance mapping", async function () {
            const amount = ethers.parseEther("10");
            await saveStore.connect(user1).depositToken(tokenAddress, amount);
            expect(await saveStore.tokenBalance(user1.address, tokenAddress)).to.eq(amount);
        });

        it("should accumulate multiple token deposits", async function () {
            const amount = ethers.parseEther("10");
            await saveStore.connect(user1).depositToken(tokenAddress, amount);
            await saveStore.connect(user1).depositToken(tokenAddress, amount);
            expect(await saveStore.connect(user1).checkTokenBalance(tokenAddress)).to.eq(amount + amount);
        });

        it("should track token balances separately for different users", async function () {
            await schoolToken.connect(user2).approve(saveStoreAddress, ethers.parseEther("100"));

            await saveStore.connect(user1).depositToken(tokenAddress, ethers.parseEther("10"));
            await saveStore.connect(user2).depositToken(tokenAddress, ethers.parseEther("20"));

            expect(await saveStore.connect(user1).checkTokenBalance(tokenAddress)).to.eq(ethers.parseEther("10"));
            expect(await saveStore.connect(user2).checkTokenBalance(tokenAddress)).to.eq(ethers.parseEther("20"));
        });

        it("should revert when depositing zero tokens", async function () {
            await expect(
                saveStore.connect(user1).depositToken(tokenAddress, 0)
            ).to.be.revertedWith("Amount must be greater than zero");
        });

        it("should revert if user has not approved enough tokens", async function () {
            await expect(
                saveStore.connect(user2).depositToken(tokenAddress, ethers.parseEther("10"))
            ).to.be.reverted;
        });

        it("should emit TokenDeposited event", async function () {
            const amount = ethers.parseEther("10");
            await expect(saveStore.connect(user1).depositToken(tokenAddress, amount))
                .to.emit(saveStore, "TokenDeposited")
                .withArgs(user1.address, tokenAddress, amount);
        });
    });

    describe("withdrawToken", function () {
        beforeEach(async function () {
            // Approve and deposit tokens first
            await schoolToken.connect(user1).approve(saveStoreAddress, ethers.parseEther("100"));
            await saveStore.connect(user1).depositToken(tokenAddress, ethers.parseEther("50"));
        });

        it("should withdraw tokens and reduce balance", async function () {
            const withdrawAmount = ethers.parseEther("20");
            await saveStore.connect(user1).withdrawToken(tokenAddress, withdrawAmount);
            expect(await saveStore.connect(user1).checkTokenBalance(tokenAddress)).to.eq(ethers.parseEther("30"));
        });

        it("should send tokens back to user", async function () {
            const withdrawAmount = ethers.parseEther("20");
            const balanceBefore = await schoolToken.balanceOf(user1.address);

            await saveStore.connect(user1).withdrawToken(tokenAddress, withdrawAmount);

            const balanceAfter = await schoolToken.balanceOf(user1.address);
            expect(balanceAfter).to.eq(balanceBefore + withdrawAmount);
        });

        it("should allow full token withdrawal", async function () {
            await saveStore.connect(user1).withdrawToken(tokenAddress, ethers.parseEther("50"));
            expect(await saveStore.connect(user1).checkTokenBalance(tokenAddress)).to.eq(0);
        });

        it("should revert if amount exceeds token balance", async function () {
            await expect(
                saveStore.connect(user1).withdrawToken(tokenAddress, ethers.parseEther("999"))
            ).to.be.revertedWith("Insufficient token balance");
        });

        it("should revert if user has no token balance", async function () {
            await expect(
                saveStore.connect(user2).withdrawToken(tokenAddress, ethers.parseEther("10"))
            ).to.be.revertedWith("Insufficient token balance");
        });

        it("should emit TokenWithdrawn event", async function () {
            const amount = ethers.parseEther("10");
            await expect(saveStore.connect(user1).withdrawToken(tokenAddress, amount))
                .to.emit(saveStore, "TokenWithdrawn")
                .withArgs(user1.address, tokenAddress, amount);
        });
    });

    describe("checkTokenBalance", function () {
        it("should return 0 for user with no deposits", async function () {
            expect(await saveStore.connect(user1).checkTokenBalance(tokenAddress)).to.eq(0);
        });

        it("should return correct balance after deposit", async function () {
            const amount = ethers.parseEther("15");
            await schoolToken.connect(user1).approve(saveStoreAddress, amount);
            await saveStore.connect(user1).depositToken(tokenAddress, amount);
            expect(await saveStore.connect(user1).checkTokenBalance(tokenAddress)).to.eq(amount);
        });

        it("should return correct balance after partial withdrawal", async function () {
            await schoolToken.connect(user1).approve(saveStoreAddress, ethers.parseEther("50"));
            await saveStore.connect(user1).depositToken(tokenAddress, ethers.parseEther("50"));
            await saveStore.connect(user1).withdrawToken(tokenAddress, ethers.parseEther("20"));
            expect(await saveStore.connect(user1).checkTokenBalance(tokenAddress)).to.eq(ethers.parseEther("30"));
        });
    });
});