// Índice del cancionero: fuente de verdad de qué canciones existen.
// Lo usan index.html, cancion.html y el service worker (sw.js).
//
// Cada canción: id (= nombre del archivo en letras/, sin .html), num (número
// en el cancionero impreso, 0 si no tiene), title y category (clave de CATS).
// Reglas completas para cargar canciones: AGENTS.md §3.

const SONGS = [
  // --- ENTRADA (ent_) ---
  { "id": "ent_bendecire", "num": 0, "title": "Bendeciré", "category": "entrada" },
  { "id": "ent_aqui-estamos-senor", "num": 19, "title": "Aquí estamos Señor", "category": "entrada" },
  { "id": "ent_vienen-con-alegria", "num": 19, "title": "Vienen con alegría", "category": "entrada" },
  { "id": "ent_juntos-como-hermanos", "num": 9, "title": "Juntos como hermanos", "category": "entrada" },
  { "id": "ent_que-lindo-es-llegar-cantando", "num": 15, "title": "Qué lindo es llegar cantando", "category": "entrada" },
  { "id": "ent_ven-hermano", "num": 17, "title": "Ven hermano", "category": "entrada" },
  { "id": "ent_el-senor-es-mi-pastor", "num": 8, "title": "El Señor es mi Pastor", "category": "entrada" },
  { "id": "ent_felices-los-que-anuncian", "num": 10, "title": "Felices los que anuncian", "category": "entrada" },
  { "id": "ent_vive-el-senor", "num": 0, "title": "Vive el Señor", "category": "entrada" },

  // --- GLORIA / KYRIE (glo_) ---
  { "id": "glo_senor-ten-piedad-kyrie", "num": 0, "title": "Señor ten piedad (Kyrie)", "category": "gloria" },
  { "id": "glo_gloria-congreso-2000", "num": 4, "title": "Gloria (Congreso Eucarístico 2000)", "category": "gloria" },
  { "id": "glo_gloria-a-dios-gloria-a-dios", "num": 5, "title": "Gloria a Dios, Gloria a Dios", "category": "gloria" },

  // --- ALELUYA (ale_) ---
  { "id": "ale_aleluya-mi-menor", "num": 13, "title": "Aleluya Pascual (Celta, Mi-)", "category": "aleluya" },
  { "id": "ale_aleluya-busca-primero", "num": 1, "title": "Aleluya (Busca primero)", "category": "aleluya" },
  { "id": "ale_aleluya-emaus-carnavalito", "num": 4, "title": "Aleluya Emaús (Carnavalito)", "category": "aleluya" },

  // --- OFERTORIO (ofert_) ---
  { "id": "ofert_toma", "num": 45, "title": "Toma", "category": "ofertorio" },
  { "id": "ofert_esto-que-soy-eso-te-doy", "num": 28, "title": "Esto que soy, eso te doy", "category": "ofertorio" },
  { "id": "ofert_hazme-pan", "num": 0, "title": "Hazme pan", "category": "ofertorio" },
  { "id": "ofert_al-altar-del-senor", "num": 20, "title": "Al Altar del Señor", "category": "ofertorio" },
  { "id": "ofert_coplas-de-yaravi", "num": 26, "title": "Coplas de Yaraví", "category": "ofertorio" },
  { "id": "ofert_este-es-el-momento", "num": 29, "title": "Este es el momento (Sinaí)", "category": "ofertorio" },
  { "id": "ofert_los-cinco-panes", "num": 30, "title": "Los cinco panes", "category": "ofertorio" },
  { "id": "ofert_hacerte-pan", "num": 31, "title": "Hacerte Pan", "category": "ofertorio" },
  { "id": "ofert_mira-nuestra-ofrenda", "num": 32, "title": "Mira nuestra ofrenda", "category": "ofertorio" },
  { "id": "ofert_resurreccion", "num": 35, "title": "Resurrección", "category": "ofertorio" },
  { "id": "ofert_pan-de-vida-y-bebida-de-luz", "num": 38, "title": "Pan de vida y bebida de luz", "category": "ofertorio" },
  { "id": "ofert_senor-ante-ti", "num": 40, "title": "Señor ante ti", "category": "ofertorio" },
  { "id": "ofert_toma-senor", "num": 46, "title": "Toma Señor", "category": "ofertorio" },
  { "id": "ofert_bendito-seas", "num": 23, "title": "Bendito seas", "category": "ofertorio" },
  { "id": "ofert_cinco-panes-y-dos-peces", "num": 24, "title": "Cinco panes y dos peces", "category": "ofertorio" },
  { "id": "ofert_padre-nuestro-recibid", "num": 37, "title": "Padre nuestro recibid", "category": "ofertorio" },
  { "id": "ofert_sobre-tu-altar-senor", "num": 43, "title": "Sobre tu Altar Señor", "category": "ofertorio" },
  { "id": "ofert_te-presentamos-el-vino-y-el-pan", "num": 44, "title": "Te presentamos el vino y el pan", "category": "ofertorio" },

  // --- SANTO / CORDERO (snt_) ---
  { "id": "snt_santo-clasico", "num": 0, "title": "Santo Clásico (Santo es el Señor)", "category": "santo" },
  { "id": "snt_santo-congreso-eucaristico", "num": 6, "title": "Santo (Congreso Eucarístico)", "category": "santo" },
  { "id": "snt_cordero-clasico", "num": 0, "title": "Cordero Clásico", "category": "santo" },
  { "id": "snt_cordero-lento", "num": 0, "title": "Cordero Lento", "category": "santo" },
  { "id": "snt_cordero-marcha-carnavalito", "num": 0, "title": "Cordero Marcha (Carnavalito)", "category": "santo" },
  { "id": "snt_cordero-lento-sube", "num": 4, "title": "Cordero (Lento, sube de tono)", "category": "santo" },
  { "id": "snt_este-es-el-cordero", "num": 6, "title": "Éste es el Cordero", "category": "santo" },
  { "id": "snt_cordero-cueca", "num": 7, "title": "Cordero (Cueca)", "category": "santo" },

  // --- COMUNIÓN (com_) ---
  { "id": "com_alma-misionera", "num": 0, "title": "Alma misionera", "category": "comunion" },
  { "id": "com_eucaristia", "num": 0, "title": "Eucaristía", "category": "comunion" },
  { "id": "com_jesus-te-seguire", "num": 67, "title": "Jesús, te seguiré", "category": "comunion" },
  { "id": "com_yo-soy-el-camino", "num": 410, "title": "Yo soy el camino", "category": "comunion" },
  { "id": "com_pescador-de-hombres", "num": 77, "title": "Pescador de hombres", "category": "comunion" },
  { "id": "com_como-cristo-nos-amo", "num": 54, "title": "Como Cristo nos amó", "category": "comunion" },
  { "id": "com_en-mi-getsemani", "num": 61, "title": "En mi Getsemaní", "category": "comunion" },
  { "id": "com_jesucristo-danos-de-este-pan", "num": 65, "title": "Jesucristo (Danos de este Pan)", "category": "comunion" },
  { "id": "com_no-podemos-caminar", "num": 76, "title": "No podemos caminar", "category": "comunion" },
  { "id": "com_senor-toma-mi-vida-nueva", "num": 80, "title": "Señor toma mi vida nueva", "category": "comunion" },
  { "id": "com_jesus-amigo", "num": 0, "title": "Jesús amigo", "category": "comunion" },
  { "id": "com_consolad-a-mi-pueblo", "num": 56, "title": "Consolad a mi pueblo", "category": "comunion" },
  { "id": "com_el-dios-de-la-vida", "num": 58, "title": "El Dios de la vida", "category": "comunion" },
  { "id": "com_en-memoria-tuya", "num": 60, "title": "En memoria tuya", "category": "comunion" },
  { "id": "com_el-profeta", "num": 62, "title": "El profeta", "category": "comunion" },
  { "id": "com_es-mi-padre", "num": 63, "title": "Es mi Padre", "category": "comunion" },
  { "id": "com_jesus-eucaristia-himno-x-congreso", "num": 68, "title": "Jesús Eucaristía (Himno X Congreso)", "category": "comunion" },
  { "id": "com_mensajero-de-la-paz", "num": 71, "title": "Mensajero de la paz", "category": "comunion" },
  { "id": "com_milagro-de-amor", "num": 73, "title": "Milagro de Amor", "category": "comunion" },
  { "id": "com_salmo-18", "num": 78, "title": "Salmo 18", "category": "comunion" },
  { "id": "com_tu-modo-fones", "num": 83, "title": "Tu Modo (Fones)", "category": "comunion" },
  { "id": "com_yo-soy-el-pan-de-vida", "num": 87, "title": "Yo Soy el Pan de Vida", "category": "comunion" },
  { "id": "com_vida-en-abundancia", "num": 88, "title": "Vida en abundancia", "category": "comunion" },
  { "id": "com_zaqueo", "num": 89, "title": "Zaqueo", "category": "comunion" },
  { "id": "com_sopla", "num": 0, "title": "Sopla", "category": "comunion" },


  // --- POST COMUNIÓN / ADORACIÓN / CARMELITANOS (ador_) ---
  { "id": "ador_maranatha", "num": 273, "title": "Maranathá", "category": "adoracion" },
  { "id": "ador_nada-te-turbe-pascua-joven", "num": 200, "title": "Nada te turbe (Pascua Joven)", "category": "carmelitanos" },
  { "id": "ador_como-la-brisa", "num": 0, "title": "Como la brisa", "category": "adoracion" },
  { "id": "ador_tan-cerca-de-mi", "num": 127, "title": "Tan cerca de mí", "category": "adoracion" },
  { "id": "ador_la-fonte-san-juan-de-la-cruz", "num": 418, "title": "La fonte T5 (San Juan de la Cruz)", "category": "carmelitanos" },
  { "id": "ador_tu-el-unico-rey", "num": 0, "title": "Tú, el único Rey", "category": "adoracion" },
  { "id": "ador_antifonas", "num": 95, "title": "Antífonas", "category": "adoracion" },
  { "id": "ador_alma-de-cristo-pascua-joven", "num": 92, "title": "Alma de Cristo (Pascua Joven)", "category": "adoracion" },
  { "id": "ador_alabado-sea-el-santisimo", "num": 94, "title": "Alabado sea el Santísimo", "category": "adoracion" },
  { "id": "ador_cara-a-cara", "num": 99, "title": "Cara a cara", "category": "adoracion" },
  { "id": "ador_jesus-estoy-aqui", "num": 108, "title": "Jesús, estoy aquí", "category": "adoracion" },
  { "id": "ador_signos-de-amor", "num": 125, "title": "Signos de amor", "category": "adoracion" },
  { "id": "ador_acuercate-jesus", "num": 229, "title": "Acuérdate, Jesús", "category": "carmelitanos" },
  { "id": "ador_el-abandono", "num": 231, "title": "El abandono", "category": "carmelitanos",
    "medios": [{ "url": "https://www.youtube.com/watch?v=mfQE3ep5iLo" }] },
  { "id": "ador_elevacion-a-la-trinidad", "num": 248, "title": "Elevación a la Trinidad", "category": "carmelitanos" },
  { "id": "ador_lo-que-agrada-a-dios", "num": 232, "title": "Lo que agrada a Dios", "category": "carmelitanos",
    "medios": [{ "url": "https://www.youtube.com/watch?v=zsWCN5VF0DI" }] },
  { "id": "ador_no-conozco-otro-medio", "num": 234, "title": "No conozco otro medio", "category": "carmelitanos",
    "medios": [{ "url": "https://www.youtube.com/watch?v=WAxo95wF2r0" }] },
  { "id": "ador_la-confianza", "num": 235, "title": "La confianza", "category": "carmelitanos",
    "medios": [{ "url": "https://www.youtube.com/watch?v=OClD97tGVNs" }] },
  { "id": "ador_porque-te-amo-oh-madre", "num": 242, "title": "Porque te amo, oh Madre", "category": "carmelitanos",
    "medios": [{ "url": "https://www.youtube.com/watch?v=0A4gbAMI9H8" }] },
  { "id": "ador_una-lluvia-de-rosas", "num": 0, "title": "Una lluvia de rosas", "category": "carmelitanos",
    "medios": [{ "url": "https://www.youtube.com/watch?v=Q1xFY4K-xA0" }] },
  { "id": "ador_el-pastorcico", "num": 214, "title": "El pastorcico (San Juan de la Cruz)", "category": "carmelitanos" },
  { "id": "ador_noche-oscura-jesed", "num": 218, "title": "Noche oscura (Jesed)", "category": "carmelitanos" },
  { "id": "ador_oracion-del-alma-enamorada", "num": 219, "title": "Oración del alma enamorada (San Juan de la Cruz)", "category": "carmelitanos" },
  { "id": "ador_silencio-de-amor-jesed", "num": 221, "title": "Silencio de amor (Jesed)", "category": "carmelitanos" },

  // --- MARIANOS / SALIDA (mar_) ---
  { "id": "mar_la-elegida", "num": 160, "title": "La elegida", "category": "marianos" },
  { "id": "mar_contigo-maria", "num": 149, "title": "Contigo María", "category": "marianos" },
  { "id": "mar_dulce-doncella", "num": 151, "title": "Dulce Doncella", "category": "marianos" },
  { "id": "mar_magnificat", "num": 167, "title": "Magníficat", "category": "marianos" },
  { "id": "mar_virgen-de-la-esperanza", "num": 176, "title": "Virgen de la esperanza", "category": "marianos" },
  { "id": "mar_canto-de-maria", "num": 148, "title": "Canto de María", "category": "marianos" },
  { "id": "mar_dulce-maria", "num": 150, "title": "Dulce María", "category": "marianos" },
  { "id": "mar_bendita-sea-tu-pureza", "num": 147, "title": "Bendita sea tu pureza", "category": "marianos" },
  { "id": "mar_junto-a-ti-maria", "num": 159, "title": "Junto a ti María", "category": "marianos" },
  { "id": "mar_madre-hoy-quiero-hablarte", "num": 164, "title": "Madre hoy quiero hablarte", "category": "marianos" },
  { "id": "mar_maria-mirame", "num": 169, "title": "María mírame", "category": "marianos" },
  { "id": "mar_ven-con-nosotros-a-caminar", "num": 182, "title": "Ven con nosotros a caminar", "category": "marianos" },
  { "id": "mar_dios-te-salve-maria", "num": 182, "title": "Dios te salve María", "category": "marianos" },


  // --- OTRAS / VARIAS (var_) ---
  { "id": "var_glorioso-rey-en-la-cruz", "num": 0, "title": "Glorioso rey en la cruz", "category": "varias" },
  { "id": "var_esta-es-la-luz-de-cristo", "num": 338, "title": "Esta es la luz de Cristo", "category": "varias" },
  { "id": "var_ven-espiritu-de-dios", "num": 337, "title": "Ven, Espíritu de Dios", "category": "varias" }
];

const CATS = [
  ["misa","Misa de Hoy","⛪"],
  ["entrada","Entrada","🚪"],
  ["gloria","Gloria / Kyrie","✨"],
  ["aleluya","Aleluya","🎶"],
  ["ofertorio","Ofrenda","🌾"],
  ["santo","Santo / Cordero","🔔"],
  ["comunion","Comunión","✝️"],
  ["adoracion","Adoración / Post-Comunión","🙏"],
  ["marianos","A María","🌹"],
  ["carmelitanos","Carmelitanos","📜"],
  ["sanjose","San José","⚒️"],
  ["adviento","Adviento","🕯️"],
  ["navidad","Navidad","⭐"],
  ["cuaresma","Cuaresma","🏜️"],
  ["pascua","Pascua","🕊️"],
  ["varias","Varios","🎵"]
];
const CMAP = Object.fromEntries(CATS.map(([id,label]) => [id, label]));
