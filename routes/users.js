const User = require('../models/user');
const Task = require('../models/task'); 
const mongoose = require('mongoose');
module.exports = function (router) {

    var usersRoute = router.route('/users');
    var usersIDRoute = router.route('/users/:user_id');

    usersRoute.get(async (req, res) => {
        const query = User.find();

        try {
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
        } catch (err) {
            return res.status(400).json({
                message: "Invalid JSON in query parameters",
                data: null
            });
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
                        message: "User count retrieved successfully",
                        data: countResult
                    });
                } catch (err) {
                    return res.status(500).json({ message: err.message, data: null });
                }
            }
        }
        try {
            const users = await query.exec();
            res.status(200).json({
                message: "Users retrieved successfully",
                data: users
            });
        } catch (err) {
            res.status(500).json({ message: err.message, data: null });
        }
    });

    usersRoute.post(async (req, res) => {
        const newUser = new User(req.body);
        const err = newUser.validateSync();
        if (err) {
            return res.status(400).json({ message: err.message, data: null });
        }
        try {
            await newUser.save();
        } catch (err) {
            // Handle duplicate email error
            if (err.code === 11000 && err.keyPattern && err.keyPattern.email) {
                return res.status(400).json({
                    message: "A user with this email already exists",
                    data: null
                });
            }
            return res.status(500).json({ message: err.message, data: null });
        }
        res.status(201).json({
            message: "New user created successfully",
            data: newUser
        });
    });

    usersIDRoute.get(async (req, res) => {
        const userID = req.params.user_id;
        const query = User.findById(userID);

        try {
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
        } catch (err) {
            return res.status(400).json({
                message: "Invalid JSON in query parameters",
                data: null
            });
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
                        message: "User count retrieved successfully",
                        data: countResult
                    });
                } catch (err) {
                    return res.status(500).json({ message: err.message, data: null });
                }
            }
        }
        try {
            const user = await query.exec();
            if (!user) {
                return res.status(404).json({ message: "User not found", data: null });
            }
            res.status(200).json({
                message: "User retrieved successfully",
                data: user
            });
        } catch (err) {
            res.status(500).json({ message: err.message, data: null });
        }
    });

    usersIDRoute.put(async (req, res) => {
        const userID = req.params.user_id;
        const newUserData = req.body;
        const query = User.findById(userID);

        let user;
        try {
            user = await query.exec();
        } catch (err) {
            return res.status(500).json({ message: err.message, data: null });
        }
        if (!user) {
            return res.status(404).json({ message: "User not found", data: null });
        }

        const oldTaskIds = user.pendingTasks.map(id => String(id));

        // Handle pendingTasks - can be array, string, or undefined
        let newTaskIds = oldTaskIds;
        if (newUserData.pendingTasks !== undefined) {
            if (Array.isArray(newUserData.pendingTasks)) {
                newTaskIds = newUserData.pendingTasks.map(id => String(id));
            } else if (typeof newUserData.pendingTasks === 'string') {
                // Single value sent as string
                newTaskIds = [String(newUserData.pendingTasks)];
            } else {
                newTaskIds = [];
            }
        }

        const tasksToRemove = oldTaskIds.filter(id => !newTaskIds.includes(id));
        const tasksToAdd = newTaskIds.filter(id => !oldTaskIds.includes(id));


        // Update pendingTasks with the processed array
        req.body.pendingTasks = newTaskIds;

        Object.assign(user, req.body);
        const err = user.validateSync();
        if (err) {
            return res.status(400).json({ message: err.message, data: null });
        }
        try {
            const session = await mongoose.startSession();
            await session.withTransaction(async () => {
                if (tasksToRemove.length > 0) {
                    await Task.updateMany(
                        { _id: { $in: tasksToRemove } },
                        { $set: { assignedUser: null, assignedUserName: "" } },
                        { session } 
                    );
                }
                if (tasksToAdd.length > 0) {
                    await Task.updateMany(
                        { _id: { $in: tasksToAdd } },
                        { $set: { assignedUser: user._id, assignedUserName: user.name } },
                        { session }
                    );
                }
                await user.save({ session });
            });
            await session.endSession();
        } catch (err) {
            return res.status(500).json({ message: err.message, data: null });
        }
        res.status(200).json({
            message: "User updated successfully",
            data: user
        });
    });

    usersIDRoute.delete(async (req, res) => {
        const userID = req.params.user_id;
        let user;
        try {
            user = await User.findById(userID);
        } catch (err) {
            return res.status(500).json({ message: err.message, data: null });
        }
        if (!user) {
            return res.status(404).json({ message: "User not found", data: null });
        }

        const pendingTaskIds = user.pendingTasks;

        try {
            const session = await mongoose.startSession();
            await session.withTransaction(async () => {
                // Unassign all tasks that were assigned to this user
                if (pendingTaskIds && pendingTaskIds.length > 0) {
                    await Task.updateMany(
                        { _id: { $in: pendingTaskIds } },
                        { $set: { assignedUser: null, assignedUserName: "unassigned" } },
                        { session }
                    );
                }
                // Delete the user
                await User.deleteOne({ _id: userID }, { session });
            });
            session.endSession();
        } catch (err) {
            return res.status(500).json({ message: err.message, data: null });
        }
        res.status(200).json({
            message: "User deleted successfully",
            data: null
        });
    });


    return router;
}
