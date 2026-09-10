import { Batch, Order, Product } from "./types";

// Simple inline SVG placeholders so the demo has no external image
// dependency. Real product photos come from the (mock) upload flow.
function placeholderImage(bg: string, label: string): string {
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='600' height='600'>
    <rect width='600' height='600' fill='${bg}'/>
    <text x='50%' y='50%' font-family='Arial, sans-serif' font-size='42' fill='#fff'
      text-anchor='middle' dominant-baseline='middle'>${label}</text>
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export const seedBatches: Batch[] = [
  {
    id: "batch-1",
    name: "Batch – September 2026",
    createdAt: "2026-09-01T09:00:00.000Z",
    status: "open",
  },
  {
    id: "batch-2",
    name: "Batch – August 2026",
    createdAt: "2026-08-03T09:00:00.000Z",
    status: "closed",
  },
];

export const seedProducts: Product[] = [
  {
    id: "prod-1",
    batchId: "batch-1",
    name: "Quilted Tote Bag",
    description:
      "Spacious quilted tote with reinforced handles. Great for retail resale — comes in three colours.",
    attributes: [
      { label: "Color", value: "Beige" },
      { label: "Size", value: "Large" },
    ],
    price: 18500,
    imageUrl: placeholderImage("#d9622b", "Tote Bag"),
    publicSlug: "quilted-tote-bag-9x2f",
  },
  {
    id: "prod-2",
    batchId: "batch-1",
    name: "Ceramic Dinner Set (12pc)",
    description:
      "12-piece ceramic dinner set, chip-resistant glaze. Sold as a full set per unit.",
    attributes: [
      { label: "Color", value: "Cream" },
      { label: "Pieces", value: "12" },
    ],
    price: 42000,
    imageUrl: placeholderImage("#b9781a", "Dinner Set"),
    publicSlug: "ceramic-dinner-set-4k1a",
  },
  {
    id: "prod-3",
    batchId: "batch-1",
    name: "Kids Puffer Jacket",
    description: "Lightweight puffer jacket for kids, water resistant shell.",
    attributes: [
      { label: "Size", value: "6-8yrs" },
      { label: "Color", value: "Navy" },
    ],
    price: 12500,
    imageUrl: placeholderImage("#2c6e8c", "Puffer Jacket"),
    publicSlug: "kids-puffer-jacket-7q3d",
  },
  {
    id: "prod-4",
    batchId: "batch-2",
    name: "Non-Stick Cookware Set",
    description: "5-piece non-stick cookware set with soft-touch handles.",
    attributes: [{ label: "Pieces", value: "5" }],
    price: 35000,
    imageUrl: placeholderImage("#2f855a", "Cookware Set"),
    publicSlug: "nonstick-cookware-set-2m8p",
  },
];

const now = Date.now();
const hoursAgo = (h: number) => new Date(now - h * 3600_000).toISOString();

export const seedOrders: Order[] = [
  {
    id: "order-1",
    orderReference: "RNM-1001",
    batchId: "batch-1",
    productId: "prod-1",
    productName: "Quilted Tote Bag",
    quantity: 3,
    customerName: "Amaka Obi",
    customerPhone: "+2348031234567",
    customerEmail: "amaka.obi@example.com",
    deliveryAddress: "12 Adeola Odeku St, Victoria Island, Lagos",
    itemPayment: { paid: true, amount: 55500, paidAt: hoursAgo(50) },
    shippingPayment: { paid: false, amount: null, paidAt: null },
    dispatchStatus: "awaiting_shipping_payment",
    createdAt: hoursAgo(51),
  },
  {
    id: "order-2",
    orderReference: "RNM-1002",
    batchId: "batch-1",
    productId: "prod-2",
    productName: "Ceramic Dinner Set (12pc)",
    quantity: 1,
    customerName: "Tunde Bakare",
    customerPhone: "+2348122345678",
    customerEmail: "tunde.bakare@example.com",
    deliveryAddress: "5 Ligali Ayorinde St, Lekki Phase 1, Lagos",
    itemPayment: { paid: true, amount: 42000, paidAt: hoursAgo(30) },
    shippingPayment: { paid: true, amount: 4500, paidAt: hoursAgo(20) },
    dispatchStatus: "ready_to_dispatch",
    createdAt: hoursAgo(31),
  },
  {
    id: "order-3",
    orderReference: "RNM-1003",
    batchId: "batch-1",
    productId: "prod-3",
    productName: "Kids Puffer Jacket",
    quantity: 2,
    customerName: "Grace Eze",
    customerPhone: "+2348093456789",
    customerEmail: "grace.eze@example.com",
    deliveryAddress: "44 Allen Avenue, Ikeja, Lagos",
    itemPayment: { paid: false, amount: null, paidAt: null },
    shippingPayment: { paid: false, amount: null, paidAt: null },
    dispatchStatus: "awaiting_item_payment",
    createdAt: hoursAgo(5),
  },
  {
    id: "order-4",
    orderReference: "RNM-1004",
    batchId: "batch-2",
    productId: "prod-4",
    productName: "Non-Stick Cookware Set",
    quantity: 1,
    customerName: "Chinedu Okafor",
    customerPhone: "+2348045678901",
    customerEmail: "chinedu.okafor@example.com",
    deliveryAddress: "3 Aba Road, Port Harcourt, Rivers",
    itemPayment: { paid: true, amount: 35000, paidAt: hoursAgo(200) },
    shippingPayment: { paid: true, amount: 6000, paidAt: hoursAgo(190) },
    dispatchStatus: "dispatched",
    createdAt: hoursAgo(201),
  },
  {
    id: "order-5",
    orderReference: "RNM-1005",
    batchId: "batch-2",
    productId: "prod-4",
    productName: "Non-Stick Cookware Set",
    quantity: 2,
    customerName: "Bisi Adeyemi",
    customerPhone: "+2348056789012",
    customerEmail: "bisi.adeyemi@example.com",
    deliveryAddress: "21 Ring Road, Ibadan, Oyo",
    itemPayment: { paid: true, amount: 70000, paidAt: hoursAgo(260) },
    shippingPayment: { paid: true, amount: 9000, paidAt: hoursAgo(250) },
    dispatchStatus: "delivered",
    createdAt: hoursAgo(261),
  },
];
