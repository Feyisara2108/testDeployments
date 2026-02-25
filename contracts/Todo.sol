// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

contract Todo {
    struct Task {
        uint8 id;
        string title;
        bool isComplete;
        uint256 timeCompleted;
    }
    Task[] public tasks; //the array where we push our struct into
    uint8 todo_id; //declaring the state variable here

    //using external make live easier cost it doesnt cost much gas since we are building on L2
    function createTask(string memory _title) external {
        //this helps to increment the id for subsequent calls or task that will be created
        todo_id = todo_id + 1;
        // Task memory task = Task(id , _title, false, 0);   a shorter way to write it but you need to know ypur struct arrangement for this
        Task memory task = Task({id: todo_id, title: _title, isComplete: false, timeCompleted: 0});
        tasks.push(task);
    }

    function getAllTasks() external view returns (Task[] memory) {
        return tasks;
    }

    // we are using for loop because we need to iterate/ keep searching over all the task(struct) to get the id
    function markComplete(uint8 _id) external {
        for (uint8 i; i < tasks.length; i++) {
            if (tasks[i].id == _id) {
                tasks[i].isComplete = true; //marks it complete
                tasks[i].timeCompleted = block.timestamp;
            }
        }
    }

    // Update function that allows changing the task title
    function updateTask(uint8 _id, string memory _newTitle) external {
        for (uint8 i; i < tasks.length; i++) {
            if (tasks[i].id == _id) {
                tasks[i].title = _newTitle;
            }
        }
    }

    //we could have used delete keyword but it leave space
    function deleteTask(uint8 _id) external {
        for (uint8 i; i < tasks.length; i++) {
            if (tasks[i].id == _id) {
                tasks[i] = tasks[tasks.length - 1];
                tasks.pop();
            }
        }
    }
    //Mapping is a key value pair like using the same nin and bvn to open different account
}
