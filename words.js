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
  deportes: {
    label: 'Deportes',
    words: [
      'fútbol', 'baloncesto', 'tenis', 'natación', 'ciclismo', 'boxeo', 'golf',
      'rugby', 'voleibol', 'atletismo', 'esquí', 'surf', 'judo', 'ajedrez',
      'senderismo', 'pádel', 'fútbol americano', 'béisbol', 'hockey', 'gimnasia'
    ]
  },
  futbol: {
    label: 'Fútbol',
    words: [
      'Real Madrid', 'Barcelona', 'Athletic Club', 'Atlético de Madrid', 'Real Sociedad',
      'Champions League', 'Eurocopa', 'Mundial', 'penalti', 'fuera de juego',
      'VAR', 'Messi', 'Cristiano Ronaldo', 'Mbappé', 'Lamine Yamal',
      'portero', 'hat-trick', 'córner', 'tarjeta roja', 'derbi'
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
  naturaleza: {
    label: 'Naturaleza',
    words: [
      'volcán', 'cascada', 'desierto', 'glaciar', 'selva', 'huracán', 'arcoíris',
      'montaña', 'lago', 'playa', 'cueva', 'bosque', 'río', 'isla',
      'aurora boreal', 'tornado', 'oasis', 'arrecife', 'pradera', 'niebla'
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
  musica: {
    label: 'Música',
    words: [
      'guitarra', 'piano', 'batería', 'violín', 'saxofón', 'rap', 'ópera',
      'karaoke', 'reggaetón', 'rock and roll', 'jazz', 'flamenco', 'coro',
      'DJ', 'concierto', 'tambor', 'arpa', 'trompeta', 'música clásica', 'pop'
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

module.exports = { CATEGORIES };
