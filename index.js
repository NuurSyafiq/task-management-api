const express = require("express");
const cors = require("cors");
const { MongoClient, ObjectId } = require("mongodb");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
require("dotenv").config();
const uri = 'mongodb+srv://syafiqnatty:fdABoCP97LQDJXns@cluster0.zzag0.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0';
require('dotenv').config();
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });


const JWT_SECRET = process.env.JWT_SECRET;

const app = express();
app.use(express.json());
app.use(cors());

const mongoUri = process.env.MONGO_URI;
const dbName = "task_management";

async function connectToMongoDB(uri, dbName) {
    try {
        const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });
        await client.connect();
        console.log("Connected to MongoDB!");
        return client.db(dbName);
    } catch (error) {
        console.error("Error connecting to MongoDB:", error.message);
        throw error;
    }
}

async function main() {
    const db = await connectToMongoDB(mongoUri, dbName);

    app.get("/", (req, res) => {
        res.json({ message: "Welcome to Task Management System!" });
    });

    // Define your routes here (e.g., tasks, users)

    // Fetch all tasks
    app.get("/tasks", async (req, res) => {
        try {
            const tasks = await db.collection("tasks").find().toArray();
            res.json({ tasks });
        } catch (error) {
            console.error("Error fetching tasks:", error.message);
            res.status(500).json({ error: "Internal server error" });
        }
    });

    // Fetch a specific task by ID
    app.get("/tasks/:id", async (req, res) => {
        try {
            const task = await db.collection("tasks").findOne({
                _id: new ObjectId(req.params.id),
            });

            if (!task) {
                return res.status(404).json({ error: "Task not found" });
            }

            res.json(task);
        } catch (error) {
            console.error("Error fetching task:", error.message);
            res.status(500).json({ error: "Internal server error" });
        }
    });

    // Create a new task
    app.post("/tasks", async (req, res) => {
        try {
            const { title, description, status, dueDate, userId } = req.body;
            if (!title ||!status) {
                return res.status(400).json({ error: "Missing required fields" });
            }
            const parsedDueDate = new Date(dueDate);
            if (isNaN(parsedDueDate.getTime())) {
                return res.status(400).json({ error: "Invalid dueDate" });
            }
            const result = await db.collection("tasks").insertOne({
                title,
                description,
                status,
                dueDate: parsedDueDate,
                userId: new ObjectId(userId),
            });
            res.status(201).json({ message: "Task created", taskId: result.insertedId });
        } catch (error) {
            console.error("Error creating task:", error.message);
            res.status(500).json({ error: "Internal server error", details: error.message });
        }
    });

    // Update a task
    app.put("/tasks/:id", async (req, res) => {
        try {
            const { title, description, status, dueDate } = req.body;

            const result = await db.collection("tasks").updateOne(
                { _id: new ObjectId(req.params.id) },
                { $set: { title, description, status, dueDate: new Date(dueDate) } }
            );

            if (result.matchedCount === 0) {
                return res.status(404).json({ error: "Task not found" });
            }

            res.json({ message: "Task updated" });
        } catch (error) {
            console.error("Error updating task:", error.message);
            res.status(500).json({ error: "Internal server error" });
        }
    });

    // Delete a task
    app.delete("/tasks/:id", async (req, res) => {
        try {
            const result = await db.collection("tasks").deleteOne({
                _id: new ObjectId(req.params.id),
            });

            if (result.deletedCount === 0) {
                return res.status(404).json({ error: "Task not found" });
            }

            res.json({ message: "Task deleted" });
        } catch (error) {
            console.error("Error deleting task:", error.message);
            res.status(500).json({ error: "Internal server error" });
        }
    });

    // User registration route
    app.post('/users/signup', async (req, res) => {
        try {
            const { email, password } = req.body;
            // Hash the password
            const hashedPassword = await bcrypt.hash(password, 12);
            const result = await db.collection('users').insertOne({
                email,
                password: hashedPassword
            });
            res.status(201).json({ message: 'User created successfully', userId: result.insertedId });
        } catch (error) {
            console.error('Error creating user:', error);
            res.status(500).json({ message: 'Internal server error', error: error.message });
        }
    });

    // User login route
    app.post('/users/login', async (req, res) => {
        try {
           

            const { email, password } = req.body;
            const user = await client.db(dbName).collection('users').findOne({ email });
            if (!user) {
                return res.status(401).json({ message: 'Invalid email or password' });
            }
            const validPassword = await bcrypt.compare(password, user.password);
            if (!validPassword) {
                return res.status(401).json({ message: 'Invalid email or password' });
            }
            // Generate JWT
            
            const token = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: '1h' });
            res.json({ token });
        } catch (error) {
            console.error('Error logging in:', error);
            res.status(500).json({ message: 'Internal server error' });
        }
    });
}


process.on('SIGINT', async () => {
    try {
        await client.close();
        console.log('MongoDB connection closed');
        process.exit(0);
    } catch (err) {
        console.error('Error closing MongoDB connection:', err);
        process.exit(1);
    }
});



main().catch(console.error);

app.listen(3000, () => {
    console.log("Server is running on port 3000");
});
