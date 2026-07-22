// Motorcycles and scooters. Kept separate from CAR_DATABASE because the makes
// barely overlap — offering Škoda when adding a scooter was the bug this fixes.
// Extend it the same way as the car list: when the owner reports a gap.
export const MOTORCYCLE_DATABASE: Record<string, string[]> = {
  Aprilia: ['RS 125', 'RS 660', 'SR 50', 'SR GT', 'Tuareg 660', 'Tuono 660', 'Tuono V4'],
  Bajaj: ['Dominar 400', 'Pulsar 125', 'Pulsar N250', 'Pulsar NS200'],
  Benelli: ['Leoncino 500', 'TNT 125', 'TRK 502', 'TRK 702'],
  BMW: ['C 400 GT', 'F 900 R', 'G 310 R', 'R 1250 GS', 'R 1300 GS', 'S 1000 RR'],
  Ducati: ['Diavel', 'Monster', 'Multistrada V4', 'Panigale V2', 'Panigale V4', 'Scrambler'],
  'Harley-Davidson': ['Fat Boy', 'Iron 883', 'Nightster', 'Pan America', 'Sportster S', 'Street Glide'],
  Honda: [
    'Africa Twin', 'CB125R', 'CB500F', 'CB650R', 'CBR600RR', 'CBR1000RR-R',
    'CRF300L', 'Forza 125', 'Forza 350', 'NC750X', 'PCX125', 'Rebel 500',
    'SH125i', 'SH150i', 'Transalp', 'Vision 110', 'X-ADV',
  ],
  Husqvarna: ['Norden 901', 'Svartpilen 401', 'Vitpilen 401'],
  Kawasaki: ['Ninja 125', 'Ninja 400', 'Ninja 650', 'Ninja ZX-6R', 'Versys 650', 'Z650', 'Z900'],
  Keeway: ['RKF 125', 'Superlight 125', 'Vieste 125'],
  KTM: ['125 Duke', '390 Adventure', '390 Duke', '690 SMC R', '790 Duke', '890 Adventure', '1290 Super Duke'],
  Kymco: ['Agility 125', 'AK 550', 'Downtown 350', 'People S 125', 'Super 8', 'X-Town 300'],
  'Moto Guzzi': ['V7', 'V85 TT', 'V100 Mandello'],
  Peugeot: ['Django', 'Kisbee', 'Metropolis', 'Speedfight'],
  Piaggio: ['Beverly 300', 'Liberty 125', 'Medley 125', 'MP3', 'Typhoon 50', 'Zip 50'],
  'Royal Enfield': ['Classic 350', 'Continental GT 650', 'Himalayan', 'Interceptor 650'],
  Suzuki: ['Address 125', 'Burgman 400', 'GSX-8S', 'GSX-R1000', 'SV650', 'V-Strom 650', 'V-Strom 800'],
  SYM: ['Crox 125', 'Fiddle 125', 'Jet X 125', 'Symphony 125'],
  Triumph: ['Bonneville T120', 'Speed Triple', 'Street Triple', 'Tiger 900', 'Trident 660'],
  Vespa: ['GTS 125', 'GTS 300', 'Primavera 125', 'Sprint 125'],
  Yamaha: [
    'Aerox 155', 'MT-03', 'MT-07', 'MT-09', 'MT-125', 'NMAX 125', 'R1', 'R3',
    'R7', 'Tenere 700', 'Tracer 7', 'Tracer 9', 'TMAX', 'XMAX 125', 'XMAX 300', 'XSR700',
  ],
  Zontes: ['125 U', '310 T', '350 R'],
}

export const MOTORCYCLE_MAKES = Object.keys(MOTORCYCLE_DATABASE)
  .map((m) => m.replace('_', ' '))
  .sort((a, b) => a.localeCompare(b))
