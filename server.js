const express = require('express');
const path = require('path');
const fs = require('fs');
const app = express();

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

let examActive = false;
let currentFormUrl = "";
let currentResponseUrl = ""; 
let studentStats = {}; 

function getStudents() {
    try {
        const data = fs.readFileSync(path.join(__dirname, 'students.json'), 'utf8');
        return JSON.parse(data);
    } catch (err) {
        console.error("Could not read students.json. Make sure the file exists.");
        return [];
    }
}

app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    const students = getStudents();
    const validStudent = students.find(s => s.username === username && s.password === password);

    if (!validStudent) return res.status(401).json({ error: "Invalid username or password." });

    // Mark them as 'waiting' if the exam hasn't started, or 'active' if it has
    if (!studentStats[username]) {
        studentStats[username] = { strikes: 0, status: examActive ? 'active' : 'waiting' };
    }

    res.json({ success: true, examActive, formUrl: currentFormUrl });
});

app.get('/api/status', (req, res) => {
    res.json({ examActive, formUrl: currentFormUrl });
});

app.post('/api/strike', (req, res) => {
    const { username, reason } = req.body;
    if (studentStats[username]) {
        studentStats[username].strikes += 1;
        if (studentStats[username].strikes >= 5) studentStats[username].status = 'terminated';
    }
    res.json({ success: true });
});

// --- ADMIN ENDPOINTS ---

app.get('/api/admin/data', (req, res) => {
    // Send the complete roster of expected students to the dashboard
    const roster = getStudents().map(s => s.username);
    res.json({ examActive, currentFormUrl, currentResponseUrl, studentStats, roster });
});

app.post('/api/admin/config', (req, res) => {
    const { active, formUrl, responseUrl } = req.body;
    const previouslyActive = examActive;
    
    examActive = active;
    if (formUrl !== undefined) currentFormUrl = formUrl;
    if (responseUrl !== undefined) currentResponseUrl = responseUrl;
    
    // Transition states based on host action
    if (active && !previouslyActive) {
        // Exam started: move everyone in the waiting room to active
        for (let user in studentStats) {
            if (studentStats[user].status === 'waiting') studentStats[user].status = 'active';
        }
    } else if (!active) {
        // Exam stopped: clear the session data
        studentStats = {}; 
    }
    
    res.json({ success: true });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Exam server running at http://localhost:${PORT}`);
});