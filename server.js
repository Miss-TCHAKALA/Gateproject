require('dotenv').config();
const express = require('express');
const mysql = require('mysql2/promise'); // MySQL avec Promises
const cors = require('cors');
const bodyParser = require('body-parser');
const WebSocket = require('ws'); // 📌 Ajout ici

const app = express();
app.use(cors());
app.use(bodyParser.json());

// 🔥 Utilisation d'un seul serveur pour Express et WebSocket
const server = require('http').createServer(app);
const wss = new WebSocket.Server({ server });

// 📌 Gestion des connexions WebSocket
wss.on('connection', ws => {
  console.log('✅ Client WebSocket connecté');
  ws.send('Bienvenue sur le WebSocket !');

  ws.on('message', message => {
    console.log(`📩 Message reçu : ${message}`);
  });

  ws.on('close', () => {
    console.log('❌ Client WebSocket déconnecté');
  });
});

// 📌 Configuration MySQL
const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'school_gatekeeper'
};

// 📌 Connexion MySQL
async function connectDB() {
    try {
        const connection = await mysql.createConnection(dbConfig);
        console.log('✅ Connecté à MySQL');
        return connection;
    } catch (error) {
        console.error('❌ Erreur de connexion MySQL:', error);
        process.exit(1);
    }
}

// 📌 API pour ajouter un étudiant
app.post('/add-student', async (req, res) => {
    const { student_id, name, profile_image, qr_code } = req.body;

    if (!student_id || !name || !profile_image || !qr_code) {
        return res.status(400).json({ error: 'Tous les champs sont obligatoires' });
    }

    try {
        const db = await connectDB();
        const sql = `INSERT INTO students (student_id, name, profile_image, qr_code) VALUES (?, ?, ?, ?)`;
        await db.execute(sql, [student_id, name, profile_image, qr_code]);

        // 📢 Envoi d'une mise à jour en temps réel via WebSocket
        wss.clients.forEach(client => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify({ message: "Nouvel étudiant ajouté", student_id, name }));
            }
        });

        res.status(201).json({ message: '✅ Étudiant ajouté avec succès' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 📌 API pour récupérer tous les étudiants
app.get('/students', async (req, res) => {
    try {
        const db = await connectDB();
        const [results] = await db.execute('SELECT * FROM students');
        res.json(results);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 📌 API pour récupérer un étudiant par ID
app.get('/student/:student_id', async (req, res) => {
    const { student_id } = req.params;

    try {
        const db = await connectDB();
        const [results] = await db.execute('SELECT * FROM students WHERE student_id = ?', [student_id]);

        if (results.length > 0) {
            res.json(results[0]);
        } else {
            res.status(404).json({ error: 'Étudiant non trouvé' });
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 📌 Démarrage du serveur Express + WebSocket
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`🚀 Serveur HTTP et WebSocket en cours d'exécution sur http://localhost:${PORT}`);
});
