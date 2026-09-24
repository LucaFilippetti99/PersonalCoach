// Disegno della figura per la mappa dei muscoli (vista frontale e posteriore).
// Coordinate in un riquadro 200 × 440. Ogni forma è la metà SINISTRA (x < 100):
// la metà destra si ottiene specchiando attorno a x = 100.

/** Sagoma del corpo (metà sinistra), fa da sfondo ai muscoli */
export const SAGOMA =
  'M100 50 L92 51 C91 56 91 60 90 63 C84 67 76 69 68 70 C56 72 47 80 45 94 ' +
  'C43 108 43 124 43 140 C42 152 41 160 40 168 C37 186 36 204 38 222 ' +
  'C35 230 35 242 40 250 C45 255 51 253 53 246 C55 238 54 230 54 224 ' +
  'C57 206 60 188 61 170 C62 158 63 146 64 134 C66 126 67 120 69 116 ' +
  'C70 132 71 150 72 168 C72 180 70 194 67 206 ' +
  'C63 226 63 256 66 284 C67 296 69 306 70 316 ' +
  'C67 334 66 356 70 380 C72 392 73 400 74 406 C70 412 68 420 72 425 L90 425 ' +
  'C93 420 92 412 89 406 C90 396 92 384 93 370 C95 352 95 334 94 318 ' +
  'C95 306 96 296 97 284 C98 266 99 246 99 228 L100 226 Z'

/** Testa (non specchiata) */
export const TESTA = { cx: 100, cy: 28, rx: 16, ry: 20 }

/** Forme dei muscoli: { id, d } — id come in src/muscoli.js */
export const FRONTE = [
  // trapezio visto da davanti: la fascia tra collo e spalla
  { id: 'trapezi', d: 'M91 58 C88 63 81 66 72 69 C80 71 88 71 93 69 C94 66 93 61 91 58 Z' },
  // deltoide: parte anteriore (verso il petto) e laterale (esterna)
  {
    id: 'deltoidi_lat',
    d: 'M68 70 C57 70 47 78 45.5 92 C45 102 46.5 110 49.5 116 C51 104 54 93 59 85 C62 79 65 74 68 70 Z',
  },
  {
    id: 'deltoidi_ant',
    d: 'M68.5 70.5 C65.5 74.5 62.5 79.5 59.5 85.5 C54.5 94 51.5 105 50 116 C56 111 62 104 66 97 C69.5 90 71 80 68.5 70.5 Z',
  },
  // petto
  {
    id: 'petto',
    d: 'M98.5 76 L98.5 116 C92 122 80 122 72 116 C68 111 66 103 66.5 95 C67 87 70 80 76 76 C84 72 92 72 98.5 76 Z',
  },
  // bicipite
  {
    id: 'bicipiti',
    d: 'M50 117 C47 128 47 142 49 155 C53 159 58 159 61 155 C63 142 64 128 64 116 C60 110 54 111 50 117 Z',
  },
  // avambraccio
  {
    id: 'avambracci',
    d: 'M48 160 C43 172 41 186 41 200 C41 208 42 215 43 221 L52 222 C55 206 58 190 60 170 C60 166 60 164 59.5 162 C56 158 51 157 48 160 Z',
  },
  // addominali: quattro blocchi per lato
  { id: 'addominali', d: 'M88 124 L98.5 124 L98.5 141 L87 141 C86 134 86 128 88 124 Z' },
  { id: 'addominali', d: 'M87 144 L98.5 144 L98.5 161 L86.5 161 Z' },
  { id: 'addominali', d: 'M86.5 164 L98.5 164 L98.5 181 L86.5 181 Z' },
  { id: 'addominali', d: 'M86.5 184 L98.5 184 L98.5 212 C93 210 89 204 87 196 Z' },
  // obliqui: il fianco
  {
    id: 'obliqui',
    d: 'M71 120 C76 125 81 126 84 126 C83 150 83 174 84 198 C80 201 75 204 70 206 C72 192 73 178 72 162 C72 148 71 134 71 120 Z',
  },
  // quadricipiti (coscia davanti, parte esterna)
  {
    id: 'quadricipiti',
    d: 'M68 214 C64 238 64 264 68 290 C70 300 76 306 84 306 C90 304 92 296 92 286 C92 262 90 240 86 222 C81 216 74 213 68 214 Z',
  },
  // adduttori (interno coscia)
  {
    id: 'adduttori',
    d: 'M89 222 C93 225 97 228 98.5 232 C98 250 97 266 95 280 C93 262 91 242 89 222 Z',
  },
  // polpaccio visto da davanti
  {
    id: 'polpacci',
    d: 'M71 322 C68 340 68 362 72 384 C75 392 80 394 84 390 C89 370 91 346 90 326 C84 318 76 317 71 322 Z',
  },
]

export const RETRO = [
  // trapezio: grande rombo dal collo al centro della schiena
  {
    id: 'trapezi',
    d: 'M98.5 52 L92 54 C90 60 84 65 70 70 C80 73 88 80 93 92 C96 100 98 110 98.5 120 Z',
  },
  // deltoide posteriore e laterale
  {
    id: 'deltoidi_lat',
    d: 'M68 70 C57 70 47 78 45.5 92 C45 102 46.5 110 49.5 116 C51 104 54 93 59 85 C62 79 65 74 68 70 Z',
  },
  {
    id: 'deltoidi_post',
    d: 'M68.5 70.5 C65.5 74.5 62.5 79.5 59.5 85.5 C54.5 94 51.5 105 50 116 C56 111 62 104 66 97 C69.5 90 71 80 68.5 70.5 Z',
  },
  // schiena alta: romboidi / trapezio medio, tra le scapole
  {
    id: 'schiena_alta',
    d: 'M72 76 C80 78 87 84 91 94 C94 102 95 110 95 116 C88 112 80 106 75 98 C72 92 71 84 72 76 Z',
  },
  // dorsali
  {
    id: 'dorsali',
    d: 'M71 100 C76 108 84 115 95 120 C96 134 96 148 94 160 C88 168 80 172 74 172 C72 160 71 146 70 132 C70 120 70 110 71 100 Z',
  },
  // lombari
  {
    id: 'lombari',
    d: 'M98.5 124 L98.5 206 L86 206 C84 196 83 186 84 176 C90 170 95 160 97 146 C98 138 98 130 98.5 124 Z',
  },
  // tricipite
  {
    id: 'tricipiti',
    d: 'M49 116 C46 128 46 142 48 155 C53 159 58 159 61 155 C63 142 64 128 64 116 C60 110 53 110 49 116 Z',
  },
  // avambraccio
  {
    id: 'avambracci',
    d: 'M48 160 C43 172 41 186 41 200 C41 208 42 215 43 221 L52 222 C55 206 58 190 60 170 C60 166 60 164 59.5 162 C56 158 51 157 48 160 Z',
  },
  // gluteo
  {
    id: 'glutei',
    d: 'M98.5 208 L98.5 252 C90 258 78 257 70 250 C66 238 67 222 71 210 C80 206 90 206 98.5 208 Z',
  },
  // femorali
  {
    id: 'femorali',
    d: 'M68 256 C66 272 67 290 71 304 C77 310 88 310 94 304 C97 290 98 274 97 258 C88 262 77 262 68 256 Z',
  },
  // polpaccio (gemelli)
  {
    id: 'polpacci',
    d: 'M71 322 C66 336 66 356 71 372 C75 380 84 382 88 374 C92 358 92 338 90 324 C84 317 76 317 71 322 Z',
  },
]
