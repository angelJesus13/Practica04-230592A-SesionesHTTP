//aqui iran todos nuestros imports
import express from 'express';
import session from 'express-session';

//inicializar express
const app = express(); 
app.use(express.json());



app.use(
    session({
        secret: 'P4-ADJBT#SpeakNow-Variables-de-SessionesHTTP',
        resave: false,
        saveUninitialized: false,
        cookie: { maxAge: 5 * 60 * 1000 },
    })
)

//Funciones para obtener la IP y MAC de la unica manera permitida en MacOS
const getLocalIp = () =>{
    return '172.16.2.14'
}

const getLocalMac = () => {
    return '60:3e:5f:2f:7d:8f'
}

//Funciones para obetenr la IP y MAC de nuestros clientes

const getClienteIp = (req) =>{
    const clienteIp = req.headers ['x-foward-for'] || req.socket.remoteAddress;
    if (clienteIp &&  clienteIp.starsWith('::ffff:')){
        return clienteIp.subString(7); //esto hara que se extraiga solo IPv4
    }
    if (clienteIp === '::1' || clienteIp === '127.0.0.1'){
        return '172.16.2.14'
    }
}
//Obetenemos la mac, en el caso de que esten en una red local se obtendra en de lo contrario mandara el mensaje de error dando el motivo por el cual no se puede acceder 
const getClientMac = (req) => {
    const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    if (clientIp === '::1' || clientIp === '127.0.0.1' || clientIp.startsWith('192.168.') || clientIp.startsWith('10.') || clientIp.startsWith('172.16.')) {
        return '60:3e:5f:2f:7d:8f'; 
    }
    return 'no se puede obtener de manera externa por temas de seguridad, gracias :)'; 
};

//Bienvenida

app.get('/', (req, res)=>{
    res.status(200).json({
        message: 'Bienveni@ a la API de sesiones',
        author: 'T.E.C Programació Angel de Jesus Baños Tellez'
    })
})




// Inicio del servidor
const port = 3000;
app.listen(port, () => {
    console.log(`Servidor corriendo en puerto ${port} `);
});