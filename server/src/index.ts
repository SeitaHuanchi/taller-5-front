import colors from 'colors'; // Para darle color a el texto de consola
import server from './server'; // Importa la instancia de servidor express

const port = process.env.PORT || 4000; //asigna un puerto al servidor

server.listen(port, () => {
  console.log(colors.cyan.bold(`El server esta ON en <http://localhost>:${port}`));
});