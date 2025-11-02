const Task = require('../models/task');
const User = require('../models/user'); 
const mongoose = require('mongoose');
module.exports = function (router) {

    var tasksRoute = router.route('/tasks');
    var tasksIDRoute = router.route('/tasks/:task_id');

    tasksRoute.get(async (req, res) => {
        const query = Task.find();
        if (req.query['where']) {
            const where = JSON.parse(req.query['where']);
            query.where(where);
        }
        if (req.query['sort']) {
            const sort = JSON.parse(req.query['sort']);
            query.sort(sort);
        }
        if (req.query['select']) {
            const select = JSON.parse(req.query['select']);
            query.select(select);
        }
        if (req.query['skip']) {
            const skip = parseInt(req.query['skip']);
            query.skip(skip);
        }
        if (req.query['limit']) {
            const limit = parseInt(req.query['limit']);
            query.limit(limit);
        } else {
            query.limit(100);
        }
        if (req.query['count']) {
            const count = req.query['count'] === 'true';
            if (count) {
                try {
                    const countResult = await query.countDocuments();
                    return res.status(200).json({
                        message: "task count retrieved successfully",
                        data: countResult
                    });
                } catch (err) {
                    return res.status(500).json({ message: err.message, data: null });
                }
            }
        }
        try {
            const tasks = await query.exec();
            res.status(200).json({
                message: "tasks retrieved successfully",
                data: tasks
            });
        } catch (err) {
            res.status(500).json({ message: err.message, data: null });
        }
    });

    tasksRoute.post(async (req, res) => {
        // Convert empty string to null for assignedUser
        if (req.body.assignedUser === '') {
            req.body.assignedUser = null;
        }
        const newtask = new Task(req.body);
        const err = newtask.validateSync();
        if (err) {
            return res.status(400).json({ message: err.message, data: null });
        }
        try {
            await newtask.save();
        } catch (err) {
            return res.status(500).json({ message: err.message, data: null });
        }
        res.status(201).json({
            message: "New task created successfully",
            data: newtask
        });
    });

    tasksIDRoute.get(async (req, res) => {
        const taskID = req.params.task_id;
        const query = Task.findById(taskID);

        if (req.query['where']) {
            const where = JSON.parse(req.query['where']);
            query.where(where);
        }
        if (req.query['sort']) {
            const sort = JSON.parse(req.query['sort']);
            query.sort(sort);
        }
        if (req.query['select']) {
            const select = JSON.parse(req.query['select']);
            query.select(select);
        }
        if (req.query['skip']) {
            const skip = parseInt(req.query['skip']);
            query.skip(skip);
        }
        if (req.query['limit']) {
            const limit = parseInt(req.query['limit']);
            query.limit(limit);
        }
        if (req.query['count']) {
            const count = req.query['count'] === 'true';
            if (count) {
                try {
                    const countResult = await query.countDocuments();
                    return res.status(200).json({
                        message: "task count retrieved successfully",
                        data: countResult
                    });
                } catch (err) {
                    return res.status(500).json({ message: err.message, data: null });
                }
            }
        }
        try {
            const task = await query.exec();
            if (!task) {
                return res.status(404).json({ message: "task not found", data: null });
            }
            res.status(200).json({
                message: "task retrieved successfully",
                data: task
            });
        } catch (err) {
            res.status(500).json({ message: err.message, data: null });
        }
    });

    tasksIDRoute.put(async (req, res) => {
        const taskID = req.params.task_id;
        const query = Task.findById(taskID);
        const newTaskData = req.body;

        // Convert empty string to null for assignedUser
        if (newTaskData.assignedUser === '') {
            newTaskData.assignedUser = null;
        }

        if (req.query['select']) {
            const select = JSON.parse(req.query['select']);
            query.select(select);
        }
        let task;
        try {
            task = await query.exec();
        } catch (err) {
            return res.status(500).json({ message: err.message, data: null });
        }
        if (!task) {
            return res.status(404).json({ message: "task not found", data: null });
        }

        const oldUserId = task.assignedUser;
        const newUserId = newTaskData.assignedUser; 

        Object.assign(task, req.body);
        const err = task.validateSync();
        if (err) {
            return res.status(400).json({ message: err.message, data: null });
        }
        try {
            const session = await mongoose.startSession();
            await session.withTransaction(async () => {
                
                await task.save({ session });

                if (String(oldUserId) !== String(newUserId)) {
                    
                    if (oldUserId) {
                        await User.updateOne(
                            { _id: oldUserId },
                            { $pull: { pendingTasks: task._id } },
                            { session }
                        );
                    }
                    if (newUserId) {
                        await User.updateOne(
                            { _id: newUserId },
                            { $addToSet: { pendingTasks: task._id } },
                            { session }
                        );
                    }
                }
            });
            await session.endSession();
        }
        catch (err) {
            return res.status(500).json({ message: err.message, data: null });
        }
        res.status(200).json({
            message: "task updated successfully",
            data: task
        });
    });

    tasksIDRoute.delete(async (req, res) => {
        const taskID = req.params.task_id;
        let task;
        try {
            task = await Task.findById(taskID);
        } catch (err) {
            return res.status(500).json({ message: err.message, data: null });
        }
        if (!task) {
            return res.status(404).json({ message: "task not found", data: null });
        }

        const assignedUserId = task.assignedUser;

        try {
            const session = await mongoose.startSession();
            await session.withTransaction(async () => {
                // Remove task from user's pendingTasks if assigned
                if (assignedUserId) {
                    await User.updateOne(
                        { _id: assignedUserId },
                        { $pull: { pendingTasks: taskID } },
                        { session }
                    );
                }
                // Delete the task
                await Task.deleteOne({ _id: taskID }, { session });
            });
            await session.endSession();
        } catch (err) {
            return res.status(500).json({ message: err.message, data: null });
        }
        res.status(200).json({
            message: "task deleted successfully",
            data: null
        });
    });

    
    return router;
}
