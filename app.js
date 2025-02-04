import express from 'express';
import session from 'express-session';
import { v4 as uuidv4 } from 'uuid';
import moment from 'moment-timezone';
import os from 'os';

const app = express();
app.use(express.json());

app.use(
    session({
        secret: 'P4-ADJBT#SpeakNow-Variables-de-SessionesHTTP',
        resave: false,
        saveUninitialized: false,
        cookie: { maxAge: 5 * 60 * 1000 },
    })
);

const activeSessions = new Map();

const getClientIp = (req) => {
    const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    if (clientIp.startsWith('::ffff:')) return clientIp.substring(7);
    return clientIp === '::1' || clientIp === '127.0.0.1' ? serverIp : clientIp;
};

const getMacAddress = (ip) => {
    const interfaces = os.networkInterfaces();
    for (const iface of Object.values(interfaces)) {
        for (const config of iface) {
            if (!config.internal && config.mac !== '00:00:00:00:00:00') {
                return config.mac;
            }
        }
    }
    return 'No disponible (Red Externa)';
};

// Obtener la IP y la MAC del servidor automáticamente
const serverIp = Object.values(os.networkInterfaces())
    .flat()
    .find((iface) => iface.family === 'IPv4' && !iface.internal)?.address || 'Desconocida';
const serverMac = getMacAddress(serverIp);

// Ruta de bienvenida
app.get('/', (req, res) => {
    res.status(200).json({
        message: 'Bienveni@ a la API de sesiones',
        author: 'T.E.C Programación Angel de Jesus Baños Tellez',
        serverIp,
        serverMac
    });
});

// Endpoint de inicio de sesión
app.post('/login', (req, res) => {
    const { email, nickname, fullName } = req.body;
    if (!email || !nickname || !fullName) {
        return res.status(400).json({ message: 'Faltan campos requeridos.' });
    }

    const sessionId = uuidv4();
    const now = moment().tz('America/Mexico_City');
    const clientIp = getClientIp(req);
    const clientMac = getMacAddress(clientIp);

    const sessionData = {
        sessionId,
        email,
        nickname,
        fullName,
        createdAt: now,
        lastAccessedAt: now,
        clientIp,
        clientMac,
        status: 'activa',
        serverIp,
        serverMac
    };

    activeSessions.set(sessionId, sessionData);
    req.session.sessionId = sessionId;

    res.status(200).json({
        message: 'Sesión iniciada exitosamente.',
        session: sessionData
    });
});

// Endpoint para obtener estado de la sesión
app.post('/session-status', (req, res) => {
    const { sessionId } = req.body;
    if (!sessionId || !activeSessions.has(sessionId)) {
        return res.status(404).json({ message: 'Sesión no encontrada o expirada.' });
    }

    const sessionData = activeSessions.get(sessionId);
    const now = moment().tz('America/Mexico_City');
    const duration = moment.duration(now.diff(sessionData.createdAt));
    const inactivity = moment.duration(now.diff(sessionData.lastAccessedAt));

    if (inactivity.asMinutes() >= 2) {
        sessionData.status = 'destruida por inactividad';
    }

    res.status(200).json({
        sessionId,
        email: sessionData.email,
        nickname: sessionData.nickname,
        createdAt: sessionData.createdAt.format('YYYY-MM-DD HH:mm:ss'),
        lastAccessedAt: sessionData.lastAccessedAt.format('YYYY-MM-DD HH:mm:ss'),
        sessionDuration: `${Math.floor(duration.asMinutes())} min : ${duration.seconds()} sec`,
        inactivityDuration: `${Math.floor(inactivity.asMinutes())} min : ${inactivity.seconds()} sec`,
        clientIp: sessionData.clientIp,
        clientMac: sessionData.clientMac,
        status: sessionData.status,
        serverIp,
        serverMac
    });
});

// Endpoint de actualización de sesión
app.post('/update', (req, res) => {
    const { sessionId } = req.body;
    if (!sessionId || !activeSessions.has(sessionId)) {
        return res.status(404).json({ message: 'Sesión no encontrada o expirada.' });
    }

    const sessionData = activeSessions.get(sessionId);
    sessionData.lastAccessedAt = moment().tz('America/Mexico_City');

    res.status(200).json({ message: 'Sesión actualizada.', sessionId });
});

// Endpoint para listar todas las sesiones (activas e inactivas)
app.get('/listCurrentSessions', (req, res) => {
    const sessionsArray = Array.from(activeSessions.values());
    res.status(200).json({ sessions: sessionsArray, serverIp, serverMac });
});

// Endpoint para cerrar sesión
app.post('/logout', (req, res) => {
    const { sessionId } = req.body;
    if (!sessionId || !activeSessions.has(sessionId)) {
        return res.status(404).json({ message: 'Sesión no encontrada o expirada.' });
    }

    const sessionData = activeSessions.get(sessionId);
    sessionData.status = 'cerrada por logout';
    res.status(200).json({ message: 'Sesión cerrada exitosamente.', session: sessionData });
});

// Inicio del servidor
const port = 3000;
app.listen(port, () => {
    console.log(`Servidor corriendo en puerto ${port}`);
});
