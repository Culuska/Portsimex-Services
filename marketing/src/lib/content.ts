export const brand = {
  name: "Portsimex Logistics",
  tagline: "Your World Brought Closer",
  promise: "Create Better Connections",
  promiseCopy:
    "Our promise is short-hand for what we aim to deliver time and time again. It summarizes our management philosophy — we connect to a more prosperous future by building better relationships and ties across the world with everyone we work with: customers, colleagues, partners, and society.",
  mission:
    "To become the world's preferred supply chain logistics company — applying insight, service quality, and innovation to create sustainable growth for business and society.",
  vision:
    "Connecting people, businesses, and communities to a better future — through logistics.",
};

export const contact = {
  email: "ops@portsimex.com",
  phones: ["0614901114", "0614430787"],
  region: "Mogadishu, Somalia",
};

export const values = [
  {
    name: "Connected",
    points: [
      "We invest in insight to get to the heart of our customers' challenges.",
      "We are open and transparent in the way we work.",
    ],
  },
  {
    name: "Committed",
    points: [
      "Deeply involved in building relationships — everything we do is with the long term in mind.",
      "Our dedication to quality is the cornerstone of our success — we get every detail right.",
    ],
  },
  {
    name: "Creative",
    points: [
      "We are constantly developing better ways of working.",
      "When we find a better way of working, we act on it and share it proactively.",
    ],
  },
];

export type Service = {
  slug: string;
  name: string;
  short: string;
  body?: string[];
  draft?: boolean;
};

export const services: Service[] = [
  {
    slug: "air-freight",
    name: "Air Cargo & Freight Forwarding",
    short:
      "Fast, reliable air freight for time-sensitive and high-value cargo, in and out of Somalia and the Horn of Africa.",
    body: [
      "Transporting goods by air is one of the fastest and most reliable ways to get products delivered anywhere in the world — the right choice when cargo needs to move quickly, including high-value assets and perishable goods. For businesses looking for cost-effective, complete air freight solutions in Somalia and the Horn of Africa, Portsimex Logistics is the company you can trust.",
      "We work with partners and carriers across the globe, giving us the reach to handle shipments through airports and seaports both within the country and internationally — importing or exporting to schedule, on our clients' timelines.",
      "Everything runs in-house: online clearance, storage, and air, sea, and land transportation, backed by meticulous documentation and tracking. Whether you're a small business or a large corporation, your cargo is handled with care and delivered on time.",
    ],
  },
  {
    slug: "sea-freight",
    name: "Sea Freight & Cargo Shipping",
    short:
      "FCL and LCL ocean freight, NVOCC and OOG cargo handling, backed by partnerships with major shipping lines.",
    body: [
      "Our dedicated ocean freight team specializes in Full Container Load (FCL) and Less than Container Load (LCL) solutions, along with requirements for non-vessel operating common carriers (NVOCC) and Out of Gauge (OOG) cargo. Whatever the type or size of bulk shipment, we partner with top shipping lines around the globe to move it.",
      "We provide complete door-to-door service for local and international clients, with partner networks that reach anywhere in the world — from reliable OOG cargo handling to tailored LCL solutions, delivered without delay or errors along the way.",
    ],
  },
  {
    slug: "logistics-warehousing",
    name: "Logistics & Warehousing",
    short:
      "Secure storage, inventory handling, and distribution — keeping cargo moving on schedule.",
    draft: true,
  },
  {
    slug: "customs-clearing",
    name: "Customs Clearing Brokerage",
    short:
      "Clearance handled in-house, so shipments move through customs without delay or guesswork.",
    draft: true,
  },
  {
    slug: "land-transport",
    name: "General Land Transport",
    short:
      "Trucking and inland haulage connecting the port to wherever cargo needs to go next.",
    draft: true,
  },
  {
    slug: "helicopter-shifting",
    name: "Helicopter Shifting",
    short:
      "Helicopter logistics for cargo and equipment moves ground transport can't reach.",
    draft: true,
  },
  {
    slug: "household-relocation",
    name: "Household Relocation",
    short:
      "Full-service household moving, locally and across borders — packed, shipped, and delivered with care.",
    draft: true,
  },
  {
    slug: "supply-chain-management",
    name: "Supply Chain Management",
    short:
      "3PL and 4PL supply chain management — from a single outsourced link to running the whole chain.",
    draft: true,
  },
];
