const IMAGE_BASE = "https://images.unsplash.com/";

const destinationMap = [
  { keys:["giappone","tokyo","kyoto"], photo:"photo-1528360983277-13d401cdc186" },
  { keys:["maldive"], photo:"photo-1514282401047-d79a71a590e8" },
  { keys:["parigi","francia"], photo:"photo-1499856871958-5b9627545d1a" },
  { keys:["new york","stati uniti","usa"], photo:"photo-1485871981521-5b1fd3805eee" },
  { keys:["londra","regno unito","inghilterra"], photo:"photo-1513635269975-59663e0ac1ad" },
  { keys:["roma"], photo:"photo-1529260830199-42c24126f198" },
  { keys:["italia","toscana","firenze"], photo:"photo-1529260830199-42c24126f198" },
  { keys:["dubai","emirati arabi"], photo:"photo-1512453979798-5ea266f8880c" },
  { keys:["bali","indonesia"], photo:"photo-1537996194471-e657df975ab4" },
  { keys:["thailandia","bangkok","phuket"], photo:"photo-1528181304800-259b08848526" },
  { keys:["egitto","cairo"], photo:"photo-1539650116574-75c0c6d73f6e" },
  { keys:["islanda"], photo:"photo-1504893524553-b855bce32c67" },
  { keys:["grecia","santorini","mykonos"], photo:"photo-1533105079780-92b9be482077" },
  { keys:["spagna","barcellona","madrid"], photo:"photo-1539037116277-4db20889f2d4" },
  { keys:["portogallo","lisbona"], photo:"photo-1555881400-74d7acaacd8b" },
  { keys:["messico","cancun"], photo:"photo-1518105779142-d975f22f1b0a" },
  { keys:["brasile","rio de janeiro"], photo:"photo-1483729558449-99ef09a8c325" },
  { keys:["australia","sydney"], photo:"photo-1506973035872-a4ec16b8e8d9" },
  { keys:["sudafrica","sud africa","cape town"], photo:"photo-1529528070131-eda9f3e90919" },
  { keys:["tanzania","kenya","safari","zanzibar"], photo:"photo-1516426122078-c23e76319801" },
  { keys:["caraibi","caraibico","repubblica dominicana","cuba"], photo:"photo-1507525428034-b723cf961d3e" },
  { keys:["crociere","crociera","mediterraneo"], photo:"photo-1548574505-5e239809ee19" },
  { keys:["norvegia","fiordi"], photo:"photo-1520769669658-f07657f5a307" },
  { keys:["canada"], photo:"photo-1503614472-8c93d56e92ce" },
  { keys:["marocco","marrakech"], photo:"photo-1489493585363-d69421e0edd3" },
  { keys:["india"], photo:"photo-1524492412937-b28074a5d7da" },
  { keys:["turchia","istanbul"], photo:"photo-1524231757912-21f4fe3a7200" }
];

const fallbackPhoto = "photo-1488646953014-85cb44e25828";

function normalize(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

export function getDestinationImage(destinations = [], extraText = "") {
  const values = Array.isArray(destinations) ? destinations : [destinations];
  const haystack = normalize(values.join(" ") + " " + extraText);
  const match = destinationMap.find(item => item.keys.some(key => haystack.includes(normalize(key))));
  const photo = match ? match.photo : fallbackPhoto;
  return `${IMAGE_BASE}${photo}?auto=format&fit=crop&w=1400&q=82`;
}

export const UNSPLASH_ATTRIBUTION = "https://unsplash.com/";
