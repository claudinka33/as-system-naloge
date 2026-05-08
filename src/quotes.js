// =====================================
// CITATI - mešano: motivacijski + slovenski + humor
// =====================================

export const QUOTES = [
  // MOTIVACIJSKI 🚀
  { text: "Najboljši način, da napoveš prihodnost, je, da jo ustvariš.", author: "Peter Drucker", emoji: "🚀" },
  { text: "Velike stvari nikoli ne nastanejo v območju udobja.", author: null, emoji: "💪" },
  { text: "Vsak strokovnjak je bil nekoč začetnik.", author: null, emoji: "🌱" },
  { text: "Ne hodi za sanjami — sanje uresniči.", author: null, emoji: "✨" },
  { text: "Sila ne pride od telesnih sposobnosti. Pride od neuklonljive volje.", author: "Mahatma Gandhi", emoji: "🦁" },
  { text: "Bodi sprememba, ki jo želiš videti v svetu.", author: "Mahatma Gandhi", emoji: "🌟" },
  { text: "Edini način, da delaš dobro delo, je, da ljubiš to, kar delaš.", author: "Steve Jobs", emoji: "💎" },
  { text: "Uspeh ni dokončen, neuspeh ni usoden — pomembno je nadaljevati.", author: "Winston Churchill", emoji: "🎯" },
  { text: "Ne primerjaj se z drugimi. Primerjaj se s tem, kdo si bil včeraj.", author: null, emoji: "📈" },
  { text: "Pot tisočih milj se začne z enim korakom.", author: "Lao Tzu", emoji: "👣" },

  // POZITIVNI 🌸
  { text: "Sreča ni v tem, da imaš to, kar želiš, ampak da želiš to, kar imaš.", author: null, emoji: "😊" },
  { text: "Vsak dan je nova priložnost, da spremeniš svoje življenje.", author: null, emoji: "🌅" },
  { text: "Hvaležnost spremeni običajne dni v posebne.", author: null, emoji: "🙏" },
  { text: "Ko nasmehneš svetu, se svet nasmehne nazaj.", author: null, emoji: "😄" },
  { text: "Najlepše stvari v življenju niso stvari.", author: null, emoji: "💕" },
  { text: "Sreča je odločitev, ne stanje.", author: null, emoji: "🌻" },

  // SLOVENSKI PREGOVORI 🇸🇮
  { text: "Brez muje se še čevelj ne obuje.", author: "Slovenski pregovor", emoji: "👞" },
  { text: "Kdor zgodaj vstaja, mu kruha ostaja.", author: "Slovenski pregovor", emoji: "🌅" },
  { text: "Boljše drobtina v žepu, kot kruh v skrinji.", author: "Slovenski pregovor", emoji: "🍞" },
  { text: "Vaja dela mojstra.", author: "Slovenski pregovor", emoji: "🛠️" },
  { text: "Tako gre svet — eden seje, drugi žanje.", author: "Slovenski pregovor", emoji: "🌾" },
  { text: "Kar Janezek ne nauči, Janez ne zna.", author: "Slovenski pregovor", emoji: "📚" },
  { text: "Lepa beseda lepo mesto najde.", author: "Slovenski pregovor", emoji: "🌹" },

  // HUMOR 😄
  { text: "Ponedeljek je dokaz, da ne pijem dovolj kave v nedeljo.", author: null, emoji: "☕" },
  { text: "Imam diplomo iz prokrastinacije. Bom pokazal jutri.", author: null, emoji: "📜" },
  { text: "Moja torta je dieta — eden majhen kos pa dva velikih.", author: null, emoji: "🍰" },
  { text: "Ne sledim modi. Moda sledi meni — in se izgubi.", author: null, emoji: "👔" },
  { text: "Zjutraj sem velik filozof. Po kavi pa še večji.", author: null, emoji: "☕" },
  { text: "Šef mi je rekel, naj imam pozitivno naravnan dan. Sem pa res — pozitiven, da gre dan počasi.", author: null, emoji: "🐢" },
  { text: "Spim kot dojenček — vsako uro se zbudim in jokam.", author: null, emoji: "😴" },

  // DELOVNI / PROFESIONALNI 💼
  { text: "Trdo delo premaga talent, kadar talent ne dela trdo.", author: "Tim Notke", emoji: "💼" },
  { text: "Sodelovanje je, ko ena plus ena enako tri.", author: null, emoji: "🤝" },
  { text: "Kakovost ni dejanje, je navada.", author: "Aristotel", emoji: "⭐" },
  { text: "Najboljši čas, da posadiš drevo, je bil pred 20 leti. Drugi najboljši čas je danes.", author: "Kitajski pregovor", emoji: "🌳" },
  { text: "Če ne moreš letati, teči. Če ne moreš teči, hodi. Samo nadaljuj.", author: "M. L. King", emoji: "🏃" },
  { text: "Inovacija razlikuje vodjo od privrženca.", author: "Steve Jobs", emoji: "💡" },
  { text: "Kdor dela napake, se lahko nauči veliko. Kdor ne dela ničesar, ne nauči nič.", author: null, emoji: "🎓" },

  // VZTRAJNOST & VOLJA 🦁
  { text: "Nikoli, nikoli, nikoli ne obupaj.", author: "Winston Churchill", emoji: "🛡️" },
  { text: "Zmagovalci ne nehajo, in tisti, ki nehajo, ne zmagajo.", author: "Vince Lombardi", emoji: "🏆" },
  { text: "Med 'poskušal sem' in 'zmogel sem' je samo en korak.", author: null, emoji: "🚶" },
  { text: "Padec ni neuspeh. Neuspeh je, če po padcu ne vstaneš.", author: null, emoji: "🦅" },

  // ŽIVLJENJSKI 🌍
  { text: "Življenje je 10% kar se ti zgodi in 90% kako reagiraš.", author: "Charles Swindoll", emoji: "🎲" },
  { text: "Naredi danes nekaj, za kar se ti bo bodoči ti zahvalil.", author: null, emoji: "🎁" },
  { text: "Vsako jutro je nova priložnost.", author: null, emoji: "🌄" },
  { text: "Bolje pojdi sam, kot s slabo družbo.", author: "Slovenski pregovor", emoji: "🌟" },
];

// Vrne citat za današnji dan (deterministično - vsi vidijo isti citat)
export function getTodayQuote() {
  const today = new Date();
  const dayOfYear = Math.floor((today - new Date(today.getFullYear(), 0, 0)) / 86400000);
  return QUOTES[dayOfYear % QUOTES.length];
}
