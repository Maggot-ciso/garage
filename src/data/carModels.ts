// Offline make/model database for the picker in the car form.
// Curated, Europe-leaning. It doesn't need to be exhaustive — the form
// always accepts free text for anything missing here.
export const CAR_DATABASE: Record<string, string[]> = {
  'Alfa Romeo': ['147', '156', '159', '164', 'Brera', 'Giulia', 'Giulietta', 'GT', 'Junior', 'MiTo', 'Spider', 'Stelvio', 'Tonale'],
  Audi: ['A1', 'A2', 'A3', 'A4', 'A4 Allroad', 'A5', 'A6', 'A6 Allroad', 'A7', 'A8', 'Q2', 'Q3', 'Q4 e-tron', 'Q5', 'Q7', 'Q8', 'e-tron', 'e-tron GT', 'R8', 'RS3', 'RS4', 'RS6', 'S3', 'S4', 'S5', 'TT'],
  BMW: ['1 Series', '2 Series', '2 Series Active Tourer', '3 Series', '4 Series', '5 Series', '6 Series', '7 Series', '8 Series', 'i3', 'i4', 'i5', 'iX', 'iX1', 'iX3', 'M2', 'M3', 'M4', 'M5', 'X1', 'X2', 'X3', 'X4', 'X5', 'X6', 'X7', 'Z3', 'Z4'],
  BYD: ['Atto 3', 'Dolphin', 'Han', 'Seal', 'Seal U', 'Sealion 7', 'Tang'],
  Chevrolet: ['Aveo', 'Camaro', 'Captiva', 'Corvette', 'Cruze', 'Lacetti', 'Matiz', 'Orlando', 'Spark', 'Trax'],
  Chrysler: ['300C', 'Grand Voyager', 'PT Cruiser', 'Sebring', 'Voyager'],
  Citroën: ['Berlingo', 'C1', 'C2', 'C3', 'C3 Aircross', 'C3 Picasso', 'C4', 'C4 Cactus', 'C4 Picasso', 'C5', 'C5 Aircross', 'C5 X', 'C6', 'C8', 'C-Elysée', 'DS3', 'DS4', 'DS5', 'Grand C4 Picasso', 'Jumper', 'Jumpy', 'Saxo', 'Xantia', 'Xsara', 'Xsara Picasso', 'ë-C4'],
  Cupra: ['Ateca', 'Born', 'Formentor', 'Leon', 'Tavascan', 'Terramar'],
  Dacia: ['Bigster', 'Dokker', 'Duster', 'Jogger', 'Lodgy', 'Logan', 'Logan MCV', 'Sandero', 'Sandero Stepway', 'Spring'],
  Dodge: ['Caliber', 'Challenger', 'Charger', 'Durango', 'Journey', 'Nitro', 'RAM 1500'],
  DS: ['DS 3', 'DS 3 Crossback', 'DS 4', 'DS 5', 'DS 7', 'DS 7 Crossback', 'DS 9'],
  Fiat: ['124 Spider', '500', '500C', '500L', '500X', '600', 'Bravo', 'Doblo', 'Ducato', 'Freemont', 'Grande Panda', 'Grande Punto', 'Linea', 'Panda', 'Punto', 'Punto Evo', 'Scudo', 'Sedici', 'Stilo', 'Talento', 'Tipo', 'Ulysse'],
  Ford: ['B-Max', 'C-Max', 'EcoSport', 'Edge', 'Escort', 'Explorer', 'F-150', 'Fiesta', 'Focus', 'Fusion', 'Galaxy', 'Grand C-Max', 'Ka', 'Kuga', 'Mondeo', 'Mustang', 'Mustang Mach-E', 'Puma', 'Ranger', 'S-Max', 'Tourneo Connect', 'Tourneo Custom', 'Transit', 'Transit Connect', 'Transit Custom'],
  Genesis: ['G70', 'G80', 'G90', 'GV60', 'GV70', 'GV80'],
  Honda: ['Accord', 'City', 'Civic', 'CR-V', 'CR-Z', 'e:Ny1', 'FR-V', 'HR-V', 'Insight', 'Jazz', 'Legend', 'S2000', 'ZR-V'],
  Hyundai: ['Bayon', 'Elantra', 'Genesis', 'Genesis Coupe', 'Getz', 'i10', 'i20', 'i30', 'i40', 'Inster', 'Ioniq', 'Ioniq 5', 'Ioniq 6', 'ix20', 'ix35', 'Kona', 'Matrix', 'Santa Fe', 'Sonata', 'Terracan', 'Tucson', 'Veloster'],
  Infiniti: ['FX', 'G37', 'Q30', 'Q50', 'QX70'],
  Jaguar: ['E-Pace', 'F-Pace', 'F-Type', 'I-Pace', 'S-Type', 'X-Type', 'XE', 'XF', 'XJ', 'XK'],
  Jeep: ['Avenger', 'Cherokee', 'Commander', 'Compass', 'Grand Cherokee', 'Patriot', 'Renegade', 'Wrangler'],
  Kia: ['Carens', 'Carnival', 'Ceed', 'Cerato', 'EV3', 'EV6', 'EV9', 'Niro', 'Optima', 'Picanto', 'ProCeed', 'Rio', 'Sorento', 'Soul', 'Sportage', 'Stinger', 'Stonic', 'Venga', 'XCeed'],
  Lada: ['2107', 'Granta', 'Kalina', 'Niva', 'Priora', 'Samara', 'Vesta'],
  Lancia: ['Delta', 'Musa', 'Thema', 'Ypsilon'],
  'Land Rover': ['Defender', 'Discovery', 'Discovery Sport', 'Freelander', 'Range Rover', 'Range Rover Evoque', 'Range Rover Sport', 'Range Rover Velar'],
  Lexus: ['CT', 'ES', 'GS', 'IS', 'LBX', 'LC', 'LS', 'NX', 'RX', 'RZ', 'UX'],
  Mazda: ['2', '3', '323', '5', '6', '626', 'CX-3', 'CX-30', 'CX-5', 'CX-60', 'CX-7', 'CX-80', 'MX-30', 'MX-5', 'Premacy', 'RX-8'],
  'Mercedes-Benz': ['A-Class', 'B-Class', 'C-Class', 'CL', 'CLA', 'CLK', 'CLS', 'Citan', 'E-Class', 'EQA', 'EQB', 'EQC', 'EQE', 'EQS', 'G-Class', 'GL', 'GLA', 'GLB', 'GLC', 'GLE', 'GLK', 'GLS', 'ML', 'R-Class', 'S-Class', 'SL', 'SLK', 'Sprinter', 'V-Class', 'Viano', 'Vito'],
  MG: ['4', '5', 'EHS', 'HS', 'Marvel R', 'ZS'],
  Mini: ['Aceman', 'Clubman', 'Cooper', 'Countryman', 'One', 'Paceman'],
  Mitsubishi: ['ASX', 'Carisma', 'Colt', 'Eclipse Cross', 'Galant', 'L200', 'Lancer', 'Outlander', 'Pajero', 'Space Star'],
  Nissan: ['350Z', '370Z', 'Almera', 'Ariya', 'Juke', 'Leaf', 'Micra', 'Murano', 'Navara', 'Note', 'Pathfinder', 'Patrol', 'Primera', 'Pulsar', 'Qashqai', 'Terrano', 'X-Trail'],
  Opel: ['Adam', 'Agila', 'Ampera', 'Antara', 'Astra', 'Combo', 'Corsa', 'Crossland', 'Crossland X', 'Frontera', 'Grandland', 'Grandland X', 'Insignia', 'Karl', 'Meriva', 'Mokka', 'Movano', 'Omega', 'Signum', 'Tigra', 'Vectra', 'Vivaro', 'Zafira', 'Zafira Life'],
  Peugeot: ['1007', '106', '107', '108', '2008', '206', '207', '208', '3008', '306', '307', '308', '4007', '406', '407', '408', '5008', '508', '607', '807', 'Boxer', 'Expert', 'Partner', 'RCZ', 'Rifter', 'Traveller', 'e-208', 'e-2008'],
  Polestar: ['1', '2', '3', '4'],
  Porsche: ['718 Boxster', '718 Cayman', '911', '924', '944', 'Boxster', 'Cayenne', 'Cayman', 'Macan', 'Panamera', 'Taycan'],
  Renault: ['Arkana', 'Austral', 'Captur', 'Clio', 'Espace', 'Fluence', 'Grand Espace', 'Grand Scénic', 'Kadjar', 'Kangoo', 'Koleos', 'Laguna', 'Master', 'Mégane', 'Mégane E-Tech', 'Modus', 'Rafale', 'Scénic', 'Symbioz', 'Talisman', 'Thalia', 'Trafic', 'Twingo', 'Vel Satis', 'Zoe'],
  SEAT: ['Alhambra', 'Altea', 'Altea XL', 'Arona', 'Arosa', 'Ateca', 'Cordoba', 'Exeo', 'Ibiza', 'Leon', 'Mii', 'Tarraco', 'Toledo'],
  Škoda: ['105', '120', '130', 'Citigo', 'Elroq', 'Enyaq', 'Fabia', 'Favorit', 'Felicia', 'Forman', 'Kamiq', 'Karoq', 'Kodiaq', 'Octavia', 'Rapid', 'Roomster', 'Scala', 'Superb', 'Yeti'],
  Smart: ['Forfour', 'Fortwo', '#1', '#3'],
  SsangYong: ['Korando', 'Kyron', 'Rexton', 'Tivoli', 'Torres'],
  Subaru: ['BRZ', 'Crosstrek', 'Forester', 'Impreza', 'Legacy', 'Levorg', 'Outback', 'Solterra', 'XV'],
  Suzuki: ['Across', 'Alto', 'Baleno', 'Celerio', 'Grand Vitara', 'Ignis', 'Jimny', 'Liana', 'S-Cross', 'Splash', 'Swace', 'Swift', 'SX4', 'SX4 S-Cross', 'Vitara', 'Wagon R+'],
  Tesla: ['Cybertruck', 'Model 3', 'Model S', 'Model X', 'Model Y', 'Roadster'],
  Toyota: ['4Runner', 'Auris', 'Avensis', 'Aygo', 'Aygo X', 'bZ4X', 'C-HR', 'Camry', 'Carina', 'Celica', 'Corolla', 'Corolla Cross', 'Corolla Verso', 'GR86', 'GR Yaris', 'Hilux', 'Land Cruiser', 'Mirai', 'MR2', 'Previa', 'Prius', 'Proace', 'RAV4', 'Supra', 'Urban Cruiser', 'Verso', 'Yaris', 'Yaris Cross'],
  Volkswagen: ['Amarok', 'Arteon', 'Beetle', 'Bora', 'Caddy', 'California', 'Caravelle', 'CC', 'Crafter', 'Eos', 'Fox', 'Golf', 'Golf Plus', 'Golf Sportsvan', 'ID.3', 'ID.4', 'ID.5', 'ID.7', 'ID. Buzz', 'Jetta', 'Lupo', 'Multivan', 'New Beetle', 'Passat', 'Passat CC', 'Phaeton', 'Polo', 'Scirocco', 'Sharan', 'T-Cross', 'T-Roc', 'Taigo', 'Tayron', 'Tiguan', 'Tiguan Allspace', 'Touareg', 'Touran', 'Transporter', 'up!'],
  Volvo: ['C30', 'C40', 'C70', 'EX30', 'EX90', 'S40', 'S60', 'S80', 'S90', 'V40', 'V50', 'V60', 'V70', 'V90', 'XC40', 'XC60', 'XC70', 'XC90'],
}

export const MAKES = Object.keys(CAR_DATABASE).sort((a, b) => a.localeCompare(b))

function normalize(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
}

// Type-ahead filter: prefix matches first, then substring matches.
// Diacritic-insensitive so "skoda" finds "Škoda".
export function filterOptions(options: string[], query: string): string[] {
  const q = normalize(query)
  if (!q) return options
  const starts: string[] = []
  const contains: string[] = []
  for (const option of options) {
    const n = normalize(option)
    if (n.startsWith(q)) starts.push(option)
    else if (n.includes(q)) contains.push(option)
  }
  return [...starts, ...contains]
}

export function modelsForMake(make: string): string[] {
  const n = normalize(make)
  for (const [name, models] of Object.entries(CAR_DATABASE)) {
    if (normalize(name) === n) return models
  }
  return []
}
