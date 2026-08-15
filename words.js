'use strict';

const CATEGORIES = {
  animales: {
    label: 'Animales',
    words: [
      'perro', 'gato', 'elefante', 'jirafa', 'pingüino', 'tiburón', 'mariposa',
      'serpiente', 'caballo', 'rana', 'delfín', 'oso', 'loro', 'hormiga',
      'pulpo', 'murciélago', 'camello', 'tortuga', 'águila', 'canguro', 'erizo'
    ]
  },
  comida: {
    label: 'Comida',
    words: [
      'paella', 'tortilla', 'gazpacho', 'jamón', 'queso', 'chocolate', 'aguacate',
      'pizza', 'sushi', 'hamburguesa', 'croissant', 'macarrones', 'helado',
      'risotto', 'chorizo', 'churros', 'salmón', 'cebolla', 'fresa', 'café'
    ]
  },
  lugares: {
    label: 'Lugares',
    words: [
      'Madrid', 'Bilbao', 'París', 'Tokio', 'Nueva York', 'Roma', 'Londres',
      'Sídney', 'Río de Janeiro', 'El Cairo', 'Moscú', 'Ámsterdam', 'Lisboa',
      'Berlín', 'Venecia', 'Praga', 'Dublín', 'Buenos Aires', 'Ciudad de México', 'Bangkok'
    ]
  },
  cine: {
    label: 'Cine y TV',
    words: [
      'Star Wars', 'Harry Potter', 'El Padrino', 'Titanic', 'Matrix', 'Los Simpson',
      'Friends', 'Breaking Bad', 'Juego de Tronos', 'Stranger Things', 'Toy Story',
      'Jurassic Park', 'El Rey León', 'Avatar', 'Spider-Man', 'Batman', 'Shrek',
      'Gladiator', 'Forrest Gump', 'Grease'
    ]
  },
  futbol: {
    label: 'Fútbol',
    words: [
      'Lamine Yamal', 'Vinícius Jr', 'Jude Bellingham', 'Kylian Mbappé', 'Erling Haaland',
      'Mohamed Salah', 'Kevin De Bruyne', 'Rodri', 'Pedri', 'Gavi',
      'Florian Wirtz', 'Bukayo Saka', 'Phil Foden', 'Cole Palmer', 'Alexander Isak',
      'Raphinha', 'Robert Lewandowski', 'Harry Kane', 'Son Heung-min', 'Bruno Fernandes',
      'Lautaro Martínez', 'Julián Álvarez', 'Federico Valverde', 'Antonio Rüdiger', 'Thibaut Courtois',
      'Marc-André ter Stegen', 'Dani Carvajal', 'Ronald Araújo', 'William Saliba', 'Virgil van Dijk',
      'Alisson Becker', 'Emiliano Martínez', 'Declan Rice', 'Martin Ødegaard', 'Bernardo Silva',
      'Rodrygo', 'Endrick', 'Arda Güler', 'Nico Williams', 'Mikel Oyarzabal',
      'Álex Baena', 'Aitana Bonmatí', 'Alexia Putellas', 'Jennifer Hermoso', 'Irene Paredes',
      'Lionel Messi', 'Cristiano Ronaldo', 'Neymar', 'Luis Suárez', 'Sergio Ramos',
      'Gerard Piqué', 'Andrés Iniesta', 'Xavi Hernández', 'Sergio Busquets', 'Karim Benzema',
      'Luka Modrić', 'Toni Kroos', 'Manuel Neuer', 'David Alaba', 'Joshua Kimmich',
      'Thiago Alcántara', 'Raúl González', 'Iker Casillas', 'Carles Puyol', 'Xabi Alonso',
      'David Villa', 'Fernando Torres', 'Cesc Fàbregas', 'Thierry Henry', 'Zinedine Zidane',
      'Ronaldo Nazário', 'Ronaldinho', 'Pelé', 'Diego Maradona', 'Alfredo Di Stéfano',
      'Johan Cruyff', 'Franz Beckenbauer', 'Michel Platini', 'Marco van Basten', 'Paolo Maldini',
      'Roberto Baggio', 'Gianluigi Buffon', 'Andrea Pirlo', 'Alessandro Del Piero', 'Francesco Totti',
      'Wayne Rooney', 'Steven Gerrard', 'Frank Lampard', 'Ryan Giggs', 'Eric Cantona',
      'Alan Shearer', 'Patrick Vieira', 'Didier Drogba', 'Samuel Eto\'o', 'Claudio Pizarro',
      'Hugo Sánchez', 'Gabriel Batistuta', 'Javier Zanetti', 'Carlos Tévez', 'Ángel Di María',
      'James Rodríguez', 'Radamel Falcao', 'Luís Figo', 'Eusébio',
      'George Best', 'Bobby Charlton', 'Lev Yashin', 'Gerd Müller', 'Bobby Moore',
      'Franco Baresi', 'Lothar Matthäus', 'Miroslav Klose', 'Rivaldo', 'Roberto Carlos',
      'Cafú', 'Clarence Seedorf', 'Dennis Bergkamp', 'Ruud van Nistelrooy', 'Arjen Robben',
      'Robin van Persie', 'Wesley Sneijder',       'Eden Hazard', 'Zlatan Ibrahimović', 'Gareth Bale',
      'Hugo Lloris', 'Antoine Griezmann', 'Paul Pogba', 'N\'Golo Kanté',
      'Sadio Mané', 'Pierre-Emerick Aubameyang', 'Raheem Sterling', 'Marcus Rashford', 'Trent Alexander-Arnold',
      'Andrew Robertson', 'Alphonso Davies', 'Achraf Hakimi', 'Marquinhos', 'Casemiro',
      'Fabinho', 'Alphonse Areola', 'Keylor Navas', 'Jan Oblak', 'Diego Simeone',
      'Pep Guardiola', 'Jürgen Klopp', 'Carlo Ancelotti', 'José Mourinho',
      'Santiago Bernabéu', 'Camp Nou', 'Old Trafford', 'Anfield', 'Wembley',
      'San Siro', 'Signal Iduna Park', 'Allianz Arena', 'Maracaná', 'La Bombonera',
      'Balón de Oro', 'Botín de Oro', 'Champions League', 'Europa League', 'Copa del Mundo',
      'Eurocopa', 'Copa América', 'Copa del Rey', 'FA Cup', 'Premier League',
      'LALIGA', 'Serie A', 'Bundesliga', 'Ligue 1', 'Copa Libertadores',
      'penalti', 'fuera de juego', 'hat-trick', 'córner', 'tarjeta roja',
      'VAR', 'portero', 'derbi', 'tiempo de descuento', 'prórroga'
    ]
  },
  profesiones: {
    label: 'Profesiones',
    words: [
      'médico', 'bombero', 'profesor', 'policía', 'piloto', 'cocinero', 'dentista',
      'abogado', 'periodista', 'camarero', 'electricista', 'veterinario', 'arquitecto',
      'fontanero', 'carpintero', 'biólogo', 'mecánico', 'peluquero', 'juez', 'astronauta'
    ]
  },
  objetos: {
    label: 'Objetos',
    words: [
      'paraguas', 'linterna', 'taza', 'gafas', 'mochila', 'lápiz', 'llaves',
      'reloj', 'vela', 'espejo', 'cepillo', 'tenedor', 'martillo', 'tijeras',
      'cuerda', 'botella', 'sombrero', 'guantes', 'mando', 'auriculares'
    ]
  },
  tecnologia: {
    label: 'Tecnología',
    words: [
      'teléfono móvil', 'ordenador portátil', 'impresora', 'wifi', 'videollamada',
      'red social', 'videoconsola', 'robot', 'dron', 'correo electrónico',
      'contraseña', 'batería', 'pantalla táctil', 'auriculares inalámbricos',
      'inteligencia artificial', 'navegador web', 'memoria USB', 'disco duro',
      'cámara digital', 'videojuego'
    ]
  },
  mezcla: {
    label: 'Mezcla',
    words: []
  }
};

// La categoría "Mezcla" combina todas las demás (sin duplicados)
const seen = new Set();
for (const key of Object.keys(CATEGORIES)) {
  if (key === 'mezcla') continue;
  for (const w of CATEGORIES[key].words) {
    if (!seen.has(w)) {
      seen.add(w);
      CATEGORIES.mezcla.words.push(w);
    }
  }
}

// Pistas por categoría (una por categoría de producción, excluyendo personalizadas)
// Las pistas deben tener sentido pero no ser triviales para el impostor
const PISTAS = {
  futbol: {
    'Lamine Yamal': 'Es muy joven y juega en el Barcelona',
    'Vinícius Jr': 'Juega en el Real Madrid y es extremo izquierdo',
    'Rodri': 'Capitán del Manchester City y mediano español',
    'Kylian Mbappé': 'Jugador francés, velocidad extrema',
    'Lautaro Martínez': 'Delantero argentino, capitán inter',
    'Federico Valverde': 'Volante uruguayo del Real Madrid',
    'Pedri': 'Canterano del Barcelona, muy joven',
    'Luka Modrić': 'Balón de Oro 2018, mediocentro croata',
  },
  objetos: {
    'paraguas': 'Te protege cuando llueve, suele ser de tela',
    'linterna': 'Sirve para ver en la oscuridad, usa pilas',
    'taza': 'Contenedor para beber, suele tener mango',
    'gafas': 'Ayuda a ver mejor, puede ser de sol o graduadas',
    'mochila': 'Llevas cosas en la espalda al colegio/trabajo',
    'llaves': 'Para abrirpuertas o coche, par de metal',
    'reloj': 'Indica la hora, pueden ser de pulsera o de pared',
    'auriculares': 'Para escuchar música o hablar por teléfono',
  },
  tecnologia: {
    'teléfono móvil': 'Dispositivo para comunicarse sin cables',
    'ordenador portátil': 'Portátil, también llamado laptop',
    'impresora': 'Imprime documentos en papel',
    'wifi': 'Conexión inalámbrica a internet',
    'red social': 'Plataforma para relacionarse online',
    'videoconsola': 'Para jugar videojuegos en casa',
    'robot': 'Máquina que puede realizar tareas automáticamente',
    'inteligencia artificial': 'Software que simula inteligencia humana',
  },
  comida: {
    'paella': 'Plato típico de Valencia con arroz y mariscos',
    'tortilla': 'Patatas y huevos, clásica española',
    'gazpacho': 'Sopa fría de verduras, típica de verano',
    'jamón': 'Embutido ibérico, corte fino',
    'queso': 'Derivado de la leche, muchos tipos',
    'chocolate': 'Dulce de cacao, oscuro o con leche',
    'pizza': 'Base de pan, salsa y queso, origen italiano',
    'sushi': 'Rice with raw fish, origen japonés',
  },
  lugares: {
    'Madrid': 'Capital de España, ciudad madrileña',
    'Bilbao': 'Ciudad vasca, conocida por su arquitectura',
    'París': 'Capital de Francia, ciudad del amor',
    'Tokio': 'Capital de Japón, megaurbe futurista',
    'Nueva York': 'Ciudad más poblada de EE.UU.',
    'Roma': 'Ciudad italiana, capital del antiguo imperio',
    'Londres': 'Capital del Reino Unido',
    'Sídney': 'Ciudad australiana, oper house famous',
  },
  profesiones: {
    'médico': 'Profesional de la salud, cura enfermedades',
    'bombero': 'Salva gente y apaga incendios',
    'profesor': 'Dedica su vida a enseñar',
    'policía': 'Hace cumplir la ley y mantiene orden',
    'piloto': 'Vuela aviones comerciales o privados',
    'cocinero': 'Prepara comida en restaurantes',
    'dentista': 'Cuidado de salud bucal y dientes',
    'abogado': 'Profesional que defiende la ley',
  },
};

module.exports = { CATEGORIES, PISTAS };
