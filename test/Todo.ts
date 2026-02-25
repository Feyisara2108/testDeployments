import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { expect } from "chai";
import hre from "hardhat";

describe("Todo", function () {
  // We define a fixture to reuse the same setup in every test.
  // We use loadFixture to run this setup once, snapshot that state,
  // and reset Hardhat Network to that snapshot in every test.
  async function deployTodo() {
    // Contracts are deployed using the first signer/account by default
    const [owner, otherAccount] = await hre.ethers.getSigners();

    const Todo = await hre.ethers.getContractFactory("Todo");
    const todo = await Todo.deploy();

    const title: string = "Laundry";

    await todo.createTask(title);

    return { todo, title, owner, otherAccount };
  }

  describe("Deployment", function () {
    it("Should create a todo", async function () {
      const { todo, title } = await loadFixture(deployTodo);
      let task_length: any = await todo.getAllTasks();

      expect(task_length[0].title).to.equal(title);

      expect(task_length[0].isComplete).to.equal(false);

      expect(task_length.length).to.equal(1);
    });

    it("Should get the length of a todo", async function () {
      const { todo } = await loadFixture(deployTodo);

      let task_length: any = await todo.getAllTasks();

      expect(task_length.length).to.equal(1);
    });

    it("Should mark task complete", async function () {
      const { todo } = await loadFixture(deployTodo);

      await todo.markComplete(1);

      let task_length: any = await todo.getAllTasks();

      expect(task_length[0].isComplete).to.equal(true);

      expect(task_length[0].timeCompleted).not.equal(0);
    });

    it("Should delete a task", async function () {
      const { todo } = await loadFixture(deployTodo);

      await todo.deleteTask(1);

      let task_length: any = await todo.getAllTasks();

      expect(task_length.length).to.equal(0);
    });
  });
});



































































// import {
//   time,
//   loadFixture,
// } from "@nomicfoundation/hardhat-toolbox/network-helpers";
// import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs";
// import { expect } from "chai";
// import hre from "hardhat";

// describe("Todo", function () {
//   // We define a fixture to reuse the same setup in every test.
//   // We use loadFixture to run this setup once, snapshot that state,
//   // and reset Hardhat Network to that snapshot in every test.
//   async function deployTodo() {
//     // Contracts are deployed using the first signer/account by default
//     const [owner, otherAccount] = await hre.ethers.getSigners();

//     const Todo = await hre.ethers.getContractFactory("Todo"); //the ethers is the one that give you access to your contrcat even without compiling or deploying yet
//     const todo = await Todo.deploy();
//     const title = "Laundry";
//     const new_task = todo.createTask(title);
//     return { todo,new_task, owner, otherAccount };
//   }

//   describe("Deployment", function () {
//     it("Should create a todo", async function () {
//       const { todo } = await loadFixture(deployTodo);

//       const title = "Laundry";

//       await todo.createTask(title);// its asynchronous key word because we are tryig to interaction with the evm
      
//       let task_length: any = await todo.getAllTasks();

//       expect(task_length[0].title).to.equal(title);

//       expect(task_length.length).to.equal(1);
//     });
//   });
// });
