const express = require('express');
const AWS = require('aws-sdk');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const mysql = require('mysql');
const bodyParser = require('body-parser');
const { exec } = require('child_process');
const util = require('util');
const execAsync = util.promisify(exec);
const app = express();
app.use(cors());
app.use(bodyParser.urlencoded({ extended: false }));
const upload = multer({ dest: 'uploads/' });

const S3_BUCKET = 'miniprojecttestbucket';
const S3_KEY = '';
const S3_SECRET = '';
const S3_REGION = 'eu-north-1';

const s3 = new AWS.S3({
  accessKeyId: S3_KEY,
  secretAccessKey: S3_SECRET,
  region: S3_REGION
});

const db = mysql.createConnection({
  host: 'localhost',
  user: 'root', // Replace with your MySQL username
  password: '', // Replace with your MySQL password
  database: 'student_timetable' // Replace with your database name
});

db.connect(err => {
  if (err) {
    console.error('Error connecting to MySQL:', err.message);
    return;
  }
  console.log('MySQL connected...');
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/choose.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'choose.html'));
});

app.get('/register1.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'register1.html'));
});

app.get('/register2.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'register2.html'));
});

app.get('/register3.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'register3.html'));
});

app.get('/login1.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'login1.html'));
});

app.get('/login2.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'login2.html'));
});

app.get('/login3.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'login3.html'));
});

app.get('/destination.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'destination.html'));
});

app.get('/courseinfo.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'courseinfo.html'));
});

app.get('/subjectsselection.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'subjectsselection.html'));
});

app.post('/upload', upload.single('file'), async (req, res) => {
  const file = req.file;
  if (!file) {
      return res.status(400).json({ message: 'No file part' });
  }

  const filename = file.originalname;
  const filePath = path.join(__dirname, file.path);

  const uploadParams = {
      Bucket: S3_BUCKET,
      Key: filename,
      Body: fs.createReadStream(filePath)
  };
  
  s3.upload(uploadParams, async (err, data) => {
      if (err) {
          console.error('Error uploading file:', err);
          return res.status(500).json({ message: 'File upload failed', error: err.message });
      }

      try {
          // Run the summarization script
          await runSummarizationScript();
          res.json({ message: 'File uploaded and processed successfully' });
      } catch (summarizationError) {
          console.error('Error during summarization:', summarizationError);
          res.status(500).json({ message: 'File uploaded but summarization in progress'});
      }
  });
});

const { spawn } = require('child_process');

async function runSummarizationScript() {
  return new Promise((resolve, reject) => {
    const pythonProcess = spawn('python', ['Summarize.py']);

    pythonProcess.stdout.on('data', (data) => {
      console.log('Python script output:', data.toString());
    });

    pythonProcess.stderr.on('data', (data) => {
      reject(new Error(data.toString()));
    });

    pythonProcess.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Python script exited with code ${code}`));
      }
    });
  });
}

app.get('/summary.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'summary.html'));
});

app.get('/studentindex.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'studentindex.html'));
});

// Serve the script file
app.get('/script.js', (req, res) => {
  res.sendFile(path.join(__dirname, 'script.js'));
});

app.get('/styles.css', (req, res) => {
  res.sendFile(path.join(__dirname, 'styles.css'));
});

// Endpoint to get the timetable
app.get('/timetable', (req, res) => {
  const date = req.query.date;
  const query = 'SELECT * FROM timetable WHERE date = ?'; // Adjust the query according to your table structure

  db.query(query, [date], (err, results) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ timetable: results });
  });
});

// Route to handle form submission
app.post('/save_course_info', (req, res) => {
  console.log(req.body);
  const { semester, from_date, to_date } = req.body;

  // Insert form data into MySQL database
  const sql = `INSERT INTO course_info (sem, startdate, enddate) VALUES (?, ?, ?)`;
  db.query(sql, [semester, from_date, to_date], (err, result) => {
    if (err) {
      console.log(err);
      res.status(500).json({ error: 'Error storing course information' });
    } else {
      console.log('Course information stored successfully');
      res.status(200).json({ message: 'Course information stored successfully' });
    }
  });
});

app.post('/save_subjects', (req, res) => {
  const { subjectNumber } = req.body;
  const subjects = [];

  // Extract subject names from request body
  for (let i = 1; i <= subjectNumber; i++) {
    const subjectName = req.body['sub' + i];
    if (subjectName) {
      subjects.push([subjectName]);
    }
  }

  // Insert subject names into MySQL database
  const sql = 'INSERT INTO subjects (sname) VALUES ?';
  db.query(sql, [subjects], (err, result) => {
    if (err) {
      console.log(err);
      res.status(500).send('Error storing subjects');
    } else {
      console.log('Subjects stored successfully');
      res.status(200).send('Subjects stored successfully');
    }
  });
});

// Endpoint to get the summary text files from the local file system
app.get('/summary/:type/:subject', (req, res) => {
  const { type, subject } = req.params;
  const filePath = path.join(__dirname, 'summaries', subject, `${type}.txt`);

  fs.readFile(filePath, 'utf8', (err, data) => {
    if (err) {
      if (err.code === 'ENOENT') {
        res.status(404).send('Summary not found');
      } else {
        res.status(500).json({ error: err.message });
      }
      return;
    }

    res.send(data);
  });
});

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

