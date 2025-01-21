const express = require("express");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { MongoClient, ObjectId } = require("mongodb");
require("dotenv").config();

const app = express();
app.use(express.json());

const mongoUri = process.env.MONGO_URI;
const JWT_SECRET = process.env.JWT_SECRET;
const dbName = "task_management";

const client = new MongoClient(mongoUri, { useNewUrlParser: true, useUnifiedTopology: true });

async function connectToMongoDB() {
    try {
        await client.connect();
        console.log("Connected to MongoDB");
    } catch (error) {
        console.error("Error connecting to MongoDB:", error);
        process.exit(1); // Stop the app if the database connection fails
    }
}

// **Verify Token Middleware**
const verifyToken = (req, res, next) => {
    const token = req.headers["authorization"]?.split(" ")[1]; // Extract token from Authorization header

    if (!token) {
        return res.status(403).json({ error: "No token provided" });
    }

    jwt.verify(token, JWT_SECRET, (err, decoded) => {
        if (err) {
            return res.status(403).json({ error: "Failed to authenticate token" });
        }

        req.userId = decoded.userId; // Attach user ID to request object
        next(); // Call the next middleware/route handler
    });
};

async function main() {
    const db = await connectToMongoDB(mongoUri, dbName);

    app.get("/", (req, res) => {
        res.json({ message: "Welcome to Task Management System!" });
    });

    // Use verifyToken middleware for all routes below this point
    app.use(verifyToken);

    // **Create a Task** Route (Protected)
    app.post("/tasks", async (req, res) => {
        try {
            const { title, description, status, dueDate } = req.body;

            // Validate input
            if (!title) {
                return res.status(400).json({ error: "Title is required" });
            }

            const db = client.db(dbName);
            const task = {
                title,
                description,
                status: status || "pending", // Default to "pending" if no status is provided
                dueDate: dueDate ? new Date(dueDate) : null, // If no dueDate is provided, set it as null
                userId: req.userId, // Associate task with the logged-in user
            };

            const result = await db.collection("tasks").insertOne(task);
            res.status(201).json({ message: "Task created successfully", taskId: result.insertedId });
        } catch (error) {
            console.error("Error creating task:", error);
            res.status(500).json({ error: "Error creating task" });
        }
    });

    // **Get All Tasks** Route (Protected)
    app.get("/tasks", async (req, res) => {
        try {
            const db = client.db(dbName);
            const tasks = await db.collection("tasks").find({ userId: req.userId }).toArray(); // Fetch tasks for the logged-in user
            res.json(tasks); // Return tasks as JSON
        } catch (error) {
            console.error("Error fetching tasks:", error);
            res.status(500).json({ error: "Error fetching tasks" });
        }
    });

    // User Registration Route
    app.post("/users/signup", async (req, res) => {
        try {
            const { email, password } = req.body;

            // Validate input
            if (!email || !password) {
                return res.status(400).json({ error: "Email and password are required" });
            }

            const db = client.db(dbName);

            // Check if the email already exists
            const existingUser = await db.collection("users").findOne({ email });
            if (existingUser) {
                return res.status(409).json({ error: "Email is already registered" });
            }

            // Hash the password
            const hashedPassword = await bcrypt.hash(password, 10);

            // Insert the user into the database
            const result = await db.collection("users").insertOne({ email, password: hashedPassword });
            res.status(201).json({ message: "User created successfully", userId: result.insertedId });
        } catch (error) {
            console.error("Error during signup:", error);
            res.status(500).json({ error: "Internal server error" });
        }
    });

    // User Login Route
    app.post("/users/login", async (req, res) => {
        try {
            const { email, password } = req.body;

            // Validate input
            if (!email || !password) {
                return res.status(400).json({ error: "Email and password are required" });
            }

            const db = client.db(dbName);

            // Check if the user exists
            const user = await db.collection("users").findOne({ email });
            if (!user) {
                return res.status(401).json({ error: "Invalid email or password" });
            }

            // Compare passwords
            const validPassword = await bcrypt.compare(password, user.password);
            if (!validPassword) {
                return res.status(401).json({ error: "Invalid email or password" });
            }

            // Generate JWT token
            const token = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: "1h" });
            res.json({ token });
        } catch (error) {
            console.error("Error during login:", error);
            res.status(500).json({ error: "Internal server error" });
        }
    });

    app.get('/', (req, res) => {
        res.send('Welcome to the Task Management API');
    });
}

// Connect to MongoDB and start the server
connectToMongoDB().then(() => {
    app.listen(3000, () => {
        console.log("Server is running on port 3000");
    });
});

main().catch(console.error);
