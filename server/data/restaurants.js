// Sample restaurant catalogue used by the matcher.
// Replace with a real data source (DB, Google Places, etc.) later.
// `diet` lists the dietary needs a place can accommodate.
export const restaurants = [
  { id: 'r1', name: 'Silogan House', cuisine: 'Filipino', priceMin: 200, priceMax: 600, walkMins: 4, address: 'Katipunan Ave, Quezon City', diet: ['noPork', 'nutAllergy', 'dairyFree', 'glutenFree'] },
  { id: 'r2', name: 'Burnt Diner', cuisine: 'American', priceMin: 300, priceMax: 750, walkMins: 7, address: 'Maginhawa St, Quezon City', diet: ['vegetarian', 'nutAllergy', 'seafoodAllergy'] },
  { id: 'r3', name: 'Cibo', cuisine: 'Italian', priceMin: 450, priceMax: 900, walkMins: 12, address: 'UP Town Center, Quezon City', diet: ['vegetarian', 'noPork', 'nutAllergy', 'seafoodAllergy'] },
  { id: 'r4', name: 'Ramen Kagura', cuisine: 'Japanese', priceMin: 350, priceMax: 650, walkMins: 6, address: 'Tomas Morato Ave, Quezon City', diet: ['noPork', 'nutAllergy', 'dairyFree'] },
  { id: 'r5', name: 'Seoul Grill Station', cuisine: 'Korean', priceMin: 400, priceMax: 800, walkMins: 9, address: 'Banawe St, Quezon City', diet: ['nutAllergy', 'dairyFree', 'glutenFree'] },
  { id: 'r6', name: 'Lucky Dumpling', cuisine: 'Chinese', priceMin: 180, priceMax: 450, walkMins: 5, address: 'Ongpin St, Binondo', diet: ['dairyFree', 'nutAllergy'] },
  { id: 'r7', name: 'Pho Saigon Corner', cuisine: 'Vietnamese', priceMin: 250, priceMax: 500, walkMins: 8, address: 'Kalayaan Ave, Quezon City', diet: ['noPork', 'dairyFree', 'glutenFree', 'nutAllergy'] },
  { id: 'r8', name: 'Taqueria Lola', cuisine: 'Mexican', priceMin: 250, priceMax: 550, walkMins: 10, address: 'Kapitolyo, Pasig', diet: ['vegetarian', 'vegan', 'noPork', 'glutenFree'] },
  { id: 'r9', name: 'Kape at Tinapay', cuisine: 'Cafe', priceMin: 150, priceMax: 400, walkMins: 3, address: 'Teachers Village, Quezon City', diet: ['vegetarian', 'vegan', 'dairyFree', 'noPork'] },
  { id: 'r10', name: 'Flour Power Bakeshop', cuisine: 'Pastry', priceMin: 120, priceMax: 350, walkMins: 6, address: 'Scout Area, Quezon City', diet: ['vegetarian', 'noPork', 'seafoodAllergy'] },
  { id: 'r11', name: 'Patty Daddy Burgers', cuisine: 'Burgers', priceMin: 250, priceMax: 500, walkMins: 5, address: 'Maginhawa St, Quezon City', diet: ['vegetarian', 'seafoodAllergy', 'nutAllergy'] },
  { id: 'r12', name: 'Lutong Bahay ni Aling Nena', cuisine: 'Filipino', priceMin: 150, priceMax: 350, walkMins: 2, address: 'Anonas St, Quezon City', diet: ['nutAllergy', 'dairyFree'] },
  { id: 'r13', name: 'Sushi Nori Bar', cuisine: 'Japanese', priceMin: 500, priceMax: 1200, walkMins: 14, address: 'BGC, Taguig', diet: ['noPork', 'dairyFree', 'nutAllergy', 'glutenFree'] },
  { id: 'r14', name: 'Green Bowl Kitchen', cuisine: 'Cafe', priceMin: 280, priceMax: 550, walkMins: 7, address: 'Katipunan Ave, Quezon City', diet: ['vegetarian', 'vegan', 'glutenFree', 'dairyFree', 'noPork', 'nutAllergy', 'seafoodAllergy'] },
  { id: 'r15', name: 'Big Bite Steakhouse', cuisine: 'American', priceMin: 600, priceMax: 1500, walkMins: 15, address: 'Eastwood, Quezon City', diet: ['noPork', 'glutenFree', 'nutAllergy'] },
  { id: 'r16', name: 'Mama Lin Noodle House', cuisine: 'Chinese', priceMin: 200, priceMax: 480, walkMins: 9, address: 'Wilson St, San Juan', diet: ['vegetarian', 'noPork', 'dairyFree'] },
  { id: 'r17', name: 'Pasta Nonna', cuisine: 'Italian', priceMin: 300, priceMax: 650, walkMins: 6, address: 'Kapitolyo, Pasig', diet: ['vegetarian', 'nutAllergy', 'seafoodAllergy'] },
  { id: 'r18', name: 'Inasal Express', cuisine: 'Filipino', priceMin: 180, priceMax: 400, walkMins: 4, address: 'Aurora Blvd, Quezon City', diet: ['noPork', 'nutAllergy', 'dairyFree', 'glutenFree'] },
];

export const CUISINES = ['Japanese', 'Korean', 'Chinese', 'Pastry', 'Vietnamese', 'Cafe', 'Mexican', 'American', 'Italian', 'Burgers', 'Filipino'];
