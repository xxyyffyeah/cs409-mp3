// Load required packages
var mongoose = require('mongoose');

// Define our task schema
var TaskSchema = new mongoose.Schema({
    name: { type: String, required: [true, 'Name is required'] },
    description: {type: String, default: "No description" },
    deadline: { type: Date, required: [true, 'Deadline is required'] },
    completed: {type: Boolean, default: false },
    assignedUser: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    assignedUserName: { type: String, default: "unassigned" },
    dateCreated: { type: Date, default: Date.now }
}, { timestamps: true });

// Export the Mongoose model
module.exports = mongoose.model('Task', TaskSchema);
