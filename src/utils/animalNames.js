const adjectives = [
  "Brave", "Cheerful", "Gentle", "Swift", "Curious",
  "Witty", "Bold", "Calm", "Daring", "Eager",
  "Fierce", "Happy", "Jolly", "Kind", "Lively",
  "Mighty", "Noble", "Playful", "Quick", "Radiant",
  "Silent", "Tender", "Unique", "Vivid", "Warm",
  "Zesty", "Clever", "Dreamy", "Fearless", "Graceful",
  "Humble", "Icy", "Jazzy", "Keen", "Lucky",
  "Mellow", "Nimble", "Odd", "Proud", "Quirky",
  "Rapid", "Sneaky", "Tiny", "Ultra", "Velvet",
  "Wild", "Cosmic", "Fuzzy", "Shiny", "Stormy",
]

const animals = [
  "Penguin", "Otter", "Fox", "Owl", "Dolphin",
  "Koala", "Panda", "Tiger", "Eagle", "Wolf",
  "Bear", "Rabbit", "Deer", "Hawk", "Whale",
  "Turtle", "Parrot", "Seal", "Falcon", "Lynx",
  "Badger", "Crane", "Gecko", "Heron", "Ibis",
  "Jaguar", "Kiwi", "Lemur", "Moose", "Newt",
  "Ocelot", "Puma", "Quail", "Raven", "Sloth",
  "Toucan", "Urchin", "Viper", "Wombat", "Yak",
  "Alpaca", "Bison", "Cobra", "Dingo", "Emu",
  "Ferret", "Gopher", "Hyena", "Impala", "Jackal",
]

export function generateAnimalName() {
  const adj = adjectives[Math.floor(Math.random() * adjectives.length)]
  const animal = animals[Math.floor(Math.random() * animals.length)]
  return `${adj} ${animal}`
}
