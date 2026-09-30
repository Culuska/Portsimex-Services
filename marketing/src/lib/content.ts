import type { StaticImageData } from "next/image";
import airCargo from "@/assets/images/air-cargo-mogadishu.jpg";
import containers from "@/assets/images/containers.jpg";
import heavyCargo from "@/assets/images/heavy-cargo-trailer.jpg";
import warehouse from "@/assets/images/warehouse.jpg";
import humanitarian from "@/assets/images/humanitarian-loading.jpg";
import airport from "@/assets/images/mogadishu-airport.jpg";

export const brand = {
  name: "Portsimex Services",
  legalName: "Portsimex Services Ltd",
  tagline: "Your World Brought Closer",
  summary:
    "Freight forwarding, customs clearance and logistics across Somalia and the Horn of Africa.",
  mission:
    "To become the world's preferred supply chain and logistics company, applying insight, service quality and innovation to create sustainable growth for business and society.",
  vision:
    "Connecting people, businesses and communities to a better future through logistics.",
};

export const about = [
  "Portsimex Services Ltd is a Somali logistics and supply chain company, headquartered in Mogadishu with offices in Somaliland and Puntland, and a regional office in Nairobi that coordinates our work across the Greater Horn of Africa.",
  "We provide international freight forwarding and tailored third- and fourth-party logistics (3PL and 4PL) solutions to clients worldwide, including in some of the most challenging and conflict-affected operating environments in the world.",
  "Portsimex Services is the partner of choice for international and regional freight forwarders and humanitarian organisations delivering projects in Somalia, which allows us to offer a seamless door-to-door service.",
];

export type Phone = { display: string; tel: string; label: string };

export const contact = {
  emails: [
    { address: "info@portsimex.com", label: "General enquiries" },
    { address: "somops@portsimex.com", label: "Operations" },
    { address: "osman@portsimex.com", label: "Managing Director" },
  ],
  quoteEmail: "somops@portsimex.com",
  phones: [
    { display: "+252 61 520 0615", tel: "+252615200615", label: "Somalia" },
    { display: "+254 724 806 536", tel: "+254724806536", label: "Kenya" },
  ] satisfies Phone[],
  website: "www.portsimex.com",
};

export const offices = [
  { city: "Mogadishu", country: "Somalia", role: "Head office" },
  { city: "Nairobi", country: "Kenya", role: "Regional office" },
  { city: "Berbera", country: "Somaliland", role: "Branch office" },
  { city: "Garowe", country: "Puntland", role: "Branch office" },
  { city: "Kismayo", country: "Somalia", role: "Branch office" },
];

export const values = [
  { name: "Reliability", text: "We deliver on what we commit to, shipment after shipment." },
  { name: "Accountability", text: "We take ownership of every consignment, from origin to final delivery." },
  { name: "Flexibility", text: "We adapt our operations to each client's needs and to conditions on the ground." },
  { name: "Client focus", text: "Our clients' requirements shape how we plan and deliver every job." },
];

export const reasons = [
  { title: "Cargo that keeps moving", label: "Fast delivery", text: "Efficient routing and clearance keep consignments on schedule." },
  { title: "Always reachable", label: "24/7 support", text: "Our operations team is available around the clock." },
  { title: "Every port in Somalia", label: "Nationwide reach", text: "Air and sea shipments to all ports, with inland delivery nationwide." },
  { title: "Proven where it is hardest", label: "Complex environments", text: "Extensive experience operating in conflict-affected and hard-to-reach areas." },
  { title: "Chosen by the sector", label: "Trusted partner", text: "Partner of choice for freight forwarders and aid organisations working in Somalia." },
  { title: "One point of contact", label: "Door to door", text: "A single, accountable team from origin to final destination." },
];

export type ServiceIcon = "plane" | "customs" | "truck" | "warehouse" | "aid" | "travel" | "permit" | "car";

export type Service = {
  slug: string;
  name: string;
  short: string;
  body: string;
  points?: string[];
  image?: StaticImageData;
  imageAlt?: string;
  icon: ServiceIcon;
  group: "freight" | "beyond";
};

export const services: Service[] = [
  {
    slug: "freight-forwarding",
    name: "Freight forwarding",
    short: "Air and sea cargo of every type, from origin to any port in Somalia.",
    body: "We arrange the storage and shipment of all types of cargo by air and sea, managing each consignment from its point of origin to its destination at any port in Somalia, Somaliland, Puntland and Kismayo.",
    points: [
      "Air freight — scheduled and project cargo",
      "Sea freight — containerised and break-bulk cargo",
      "Storage arranged at origin and destination",
      "Door-to-door delivery through our partner network",
    ],
    image: airCargo,
    imageAlt: "Cargo being unloaded from a freighter aircraft at Mogadishu airport",
    icon: "plane",
    group: "freight",
  },
  {
    slug: "customs-clearance",
    name: "Customs clearance & tax exemption",
    short: "Import clearance, trade advice and government tax exemption processing.",
    body: "Customs clearance is at the heart of our service. We guide clients through every document required for import clearance, and our customs agents advise on trade regulations, tax rates and the duty exemptions that apply in each region of Somalia. We also manage the government tax exemption process on our clients' behalf. Our trained and experienced teams handle every type of shipment at seaports and airports across Somalia.",
    image: containers,
    imageAlt: "Shipping containers stacked at a port",
    icon: "customs",
    group: "freight",
  },
  {
    slug: "road-transport",
    name: "Road transport & inland services",
    short: "Fast, flexible delivery anywhere in Somalia once your cargo is cleared.",
    body: "Once your cargo is cleared, we deliver it anywhere in Somalia. Our inland services are fast, reliable and flexible, and tailored to each client's requirements.",
    points: [
      "Container transport — full (FCL) and less-than-container (LCL) loads",
      "Break-bulk cargo movements",
      "Special and heavy equipment movements",
      "Cranes and forklifts arranged at short notice",
      "Fleet management",
      "Temperature-controlled container shipments",
      "Door-to-door delivery",
    ],
    image: heavyCargo,
    imageAlt: "Oversized crated cargo loaded on a multi-axle trailer",
    icon: "truck",
    group: "freight",
  },
  {
    slug: "warehousing",
    name: "Warehousing",
    short: "Secure storage at origin, in transit and at destination.",
    body: "Secure storage at origin, in transit and at destination, integrated with our freight and inland transport services.",
    image: warehouse,
    imageAlt: "Racked pallets inside a warehouse",
    icon: "warehouse",
    group: "freight",
  },
  {
    slug: "humanitarian-logistics",
    name: "Humanitarian logistics",
    short: "Supporting aid organisations through every phase of a crisis.",
    body: "Through our humanitarian relief programme, we support aid organisations through every phase of a crisis. Our expedition and life support services keep teams supplied in remote and conflict-affected areas.",
    image: humanitarian,
    imageAlt: "Relief supplies being loaded onto a truck by forklift",
    icon: "aid",
    group: "freight",
  },
  {
    slug: "expedition-travel",
    name: "Expedition & travel services",
    short: "Travel and ground movements for staff, contractors and visiting teams.",
    body: "We organise and support travel for staff, contractors and visiting teams across Somalia.",
    points: [
      "Travel planning for individuals and teams",
      "Ground movements between airports, offices and sites",
      "Field expeditions and life support in remote areas",
    ],
    image: airport,
    imageAlt: "Aerial view of Mogadishu and Aden Adde International Airport",
    icon: "travel",
    group: "beyond",
  },
  {
    slug: "permits-visas",
    name: "Permit & visa processing",
    short: "Applications prepared and followed up with the authorities for you.",
    body: "We prepare and follow up applications with the relevant authorities on your behalf.",
    points: ["Visas for staff and visitors", "Work and residence permits", "Project and operating permits"],
    icon: "permit",
    group: "beyond",
  },
  {
    slug: "vehicle-rental",
    name: "Car & armoured vehicle rental",
    short: "Standard and B6-armoured vehicles for business, project and field use.",
    body: "Standard and armoured vehicles for business, project and field use, arranged around your plans.",
    points: [
      "Armoured vehicles — B6-protected Toyota Land Cruiser V8",
      "Standard vehicles for city and field use",
      "Short- and long-term hire",
    ],
    icon: "car",
    group: "beyond",
  },
];
