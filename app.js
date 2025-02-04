import express from 'express';
import session from 'express-session';
import { v4 as uuidv4 } from 'uuid';
import moment from 'moment-timezone';
import os from 'os';
import getmac from 'getmac'; // Importa el paquete getmac

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

const getServerDetails = () => {
    const interfaces = os.networkInterfaces();
    let serverIp = 'Desconocida';
    let serverMac = 'Desconocida';

    if (interfaces.en0) {
        for (const iface of interfaces.en0) {
            if (iface.family === 'IPv4' && !iface.internal) {
                serverIp = iface.address;
                serverMac = iface.mac;
                break;
            }
        }
    }
    return { serverIp, serverMac };
};

// Obtener datos del servidor
const { serverIp, serverMac } = getServerDetails();

/**
 * Obtiene la IP del cliente, asegurándose de que sea IPv4.
 */
const getClientIp = (req) => {
    const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    if (clientIp.startsWith('::ffff:')) return clientIp.substring(7);
    return clientIp === '::1' || clientIp === '127.0.0.1' ? serverIp : clientIp;
};

/**
 * Obtiene la dirección MAC del cliente. Esto solo funciona en entornos locales.
 */
const getClientMac = () => {
    return new Promise((resolve, reject) => {
        getmac.getMac((err, macAddress) => {
            if (err) {
                reject('No se pudo obtener la dirección MAC debido al entorno.');
            } else {
                resolve(macAddress);
            }
        });
    });
};

// Ruta de bienvenida
app.get('/', (req, res) => {
    res.status(200).json({
        message: 'Bienveni@ a la API de sesiones',
        author: 'T.E.C Programación Angel de Jesus Baños Tellez'
    });
});

// Endpoint de inicio de sesión
app.post('/login', async (req, res) => {
    const { email, nickname, fullName } = req.body;
    if (!email || !nickname || !fullName) {
        return res.status(400).json({ message: 'Faltan campos requeridos.' });
    }

    const sessionId = uuidv4();
    const now = moment().tz('America/Mexico_City');
    const clientIp = getClientIp(req);
    const clientMac = await getClientMac().catch((err) => console.error(err));

    const sessionData = {
        sessionId,
        email,
        nickname,
        fullName,
        createdAt: now,
        lastAccessedAt: now,
        clientIp,
        clientMac,  // Se agrega la dirección MAC del cliente
        status: 'activa',
        serverIp,
        serverMac
    };

    activeSessions.set(sessionId, sessionData);
    req.session.sessionId = sessionId;

    res.status(200).json({
        message: 'Sesión iniciada exitosamente.',
        sessionId
    });
});

// Endpoint para obtener estado de la sesión
// Endpoint para obtener estado de la sesión
app.post('/session-status', async (req, res) => {
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

    const clientIp = sessionData.clientIp;
    let clientMac = sessionData.clientMac || 'No se pudo obtener la dirección MAC debido al entorno.';

    // Verificación de si la solicitud proviene del mismo servidor
    if (clientIp === serverIp) {
        clientMac = serverMac;  // Asignamos la MAC del servidor si la IP coincide
    }

    res.status(200).json({
        sessionId: sessionData.sessionId,
        email: sessionData.email,
        nickname: sessionData.nickname,
        createdAt: sessionData.createdAt.format('YYYY-MM-DD HH:mm:ss'),
        lastAccessedAt: sessionData.lastAccessedAt.format('YYYY-MM-DD HH:mm:ss'),
        sessionDuration: `${Math.floor(duration.asMinutes())} min : ${duration.seconds()} sec`,
        inactivityDuration: `${Math.floor(inactivity.asMinutes())} min : ${inactivity.seconds()} sec`,
        clientIp,
        clientMac,  // Mostramos la dirección MAC del cliente o la del servidor
        status: sessionData.status,
        serverIp,
        serverMac
    });
});

//update

app.post('/update', (req, res) => {
    const { sessionId } = req.body;
    if (!sessionId || !activeSessions.has(sessionId)) {
        return res.status(404).json({ message: 'Sesión no encontrada o expirada.' });
    }

    const sessionData = activeSessions.get(sessionId);
    const now = moment().tz('America/Mexico_City');
    const inactivity = moment.duration(now.diff(sessionData.lastAccessedAt));

    // Si la sesión no ha sido actualizada en más de 2 minutos, se destruye y se cierra
    if (inactivity.asMinutes() >= 2) {
        sessionData.status = 'destruida por inactividad';
        activeSessions.delete(sessionId); // Eliminar la sesión destruida
        return res.status(200).json({
            message: 'La sesión fue destruida por inactividad. Inicia sesión nuevamente.'
        });
    }

    // Si la sesión está siendo actualizada, se marca como activa
    sessionData.status = 'activa';
    sessionData.lastAccessedAt = now;

    res.status(200).json({
        message: 'Sesión actualizada.',
        sessionId: sessionData.sessionId,
        status: sessionData.status
    });
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
    sessionData.status = 'cerrada por el usuario';
    res.status(200).json({ message: 'Sesión cerrada exitosamente.', session: sessionData });
});

// Inicio del servidor
const port = 3000;
app.listen(port, () => {
    console.log(`Servidor corriendo en puerto ${port}`);
});
