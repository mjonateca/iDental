import type { Shop, Barber, Service, Booking, Client } from "@/types/database";

export const IS_DEMO = !process.env.NEXT_PUBLIC_SUPABASE_URL?.startsWith("http");

export const demoShop: Shop = {
  id: "demo-shop-1",
  owner_id: "demo-user-1",
  name: "Sonrisa Clara Santiago",
  slug: "sonrisa-clara",
  logo_url: null,
  maps_url: null,
  maps_url: null,
  maps_url: null,
  banner_image_url: "https://images.unsplash.com/photo-1609840114035-3c981b782dfe?auto=format&fit=crop&w=1600&q=80",
  address: "Calle El Sol #45, Santiago, RD",
  lat: 19.4517,
  lng: -70.6970,
  phone: "+1 809-555-0100",
  whatsapp: "+1 809-555-0100",
  country_code: "DO",
  country_name: "República Dominicana",
  city: "Santiago",
  description: "Clínica dental demo para probar reservas, dentistas y servicios.",
  is_active: true,
  opening_hours: {
    lunes:     { open: "09:00", close: "19:00", closed: false },
    martes:    { open: "09:00", close: "19:00", closed: false },
    miercoles: { open: "09:00", close: "19:00", closed: false },
    jueves:    { open: "09:00", close: "19:00", closed: false },
    viernes:   { open: "09:00", close: "19:00", closed: false },
    sabado:    { open: "09:00", close: "17:00", closed: false },
    domingo:   { open: "09:00", close: "13:00", closed: true },
  },
  deposit_required: false,
  deposit_amount: 0,
  payments_enabled: true,
  online_payment_mode: "optional",
  created_at: new Date().toISOString(),
};

export const demoBarbers: Barber[] = [
  {
    id: "demo-barber-1",
    user_id: "demo-user-1",
    shop_id: "demo-shop-1",
    display_name: "Dra. Laura Perez",
    avatar_url: null,
    bio: "10 anos de experiencia en odontologia estetica y rehabilitacion oral.",
    portfolio_urls: [],
    rating: 4.8,
    is_independent: false,
    specialty: "Odontologia estetica",
    is_active: true,
    created_at: new Date().toISOString(),
  },
  {
    id: "demo-barber-2",
    user_id: "demo-user-2",
    shop_id: "demo-shop-1",
    display_name: "Dr. Miguel Santos",
    avatar_url: null,
    bio: "Especialista en ortodoncia preventiva y diagnostico integral.",
    portfolio_urls: [],
    rating: 4.6,
    is_independent: false,
    specialty: "Ortodoncia",
    is_active: true,
    created_at: new Date().toISOString(),
  },
];

export const demoServices: Service[] = [
  { id: "svc-1", shop_id: "demo-shop-1", name: "Limpieza dental", duration_min: 45, price: 1800, currency: "DOP", is_active: true, description: "Higiene profesional y revision basica.", category: "Prevencion", is_visible: true, sort_order: 1, created_at: new Date().toISOString() },
  { id: "svc-2", shop_id: "demo-shop-1", name: "Valoracion general", duration_min: 30, price: 1200, currency: "DOP", is_active: true, description: "Diagnostico inicial con plan de tratamiento.", category: "Consulta", is_visible: true, sort_order: 2, created_at: new Date().toISOString() },
  { id: "svc-3", shop_id: "demo-shop-1", name: "Blanqueamiento", duration_min: 60, price: 4200, currency: "DOP", is_active: true, description: "Sesion estetica para mejorar el tono dental.", category: "Estetica", is_visible: true, sort_order: 3, created_at: new Date().toISOString() },
  { id: "svc-4", shop_id: "demo-shop-1", name: "Consulta infantil", duration_min: 30, price: 1500, currency: "DOP", is_active: true, description: "Atencion preventiva para ninos.", category: "Pediatria", is_visible: true, sort_order: 4, created_at: new Date().toISOString() },
];

Object.assign(demoServices[0], {
  service_addons: [
    { id: "addon-1", service_id: "svc-1", name: "Pulido extra", price: 450, duration_min: 10, is_active: true, created_at: new Date().toISOString() },
    { id: "addon-2", service_id: "svc-1", name: "Aplicacion de fluor", price: 350, duration_min: 5, is_active: true, created_at: new Date().toISOString() },
  ],
});

Object.assign(demoServices[1], {
  service_addons: [
    { id: "addon-3", service_id: "svc-2", name: "Radiografia inicial", price: 900, duration_min: 10, is_active: true, created_at: new Date().toISOString() },
  ],
});

export const demoClient: Client = {
  id: "demo-client-1",
  user_id: "demo-user-1",
  name: "Demo Usuario",
  phone: "+1 809-555-0200",
  whatsapp: "+1 809-555-0200",
  first_name: "Demo",
  last_name: "Usuario",
  country_code: "DO",
  country_name: "República Dominicana",
  city: "Santiago",
  created_at: new Date().toISOString(),
};

const today = new Date().toISOString().split("T")[0];

export const demoBookings: (Booking & {
  clients: { name: string; phone: string | null; whatsapp: string | null } | null;
  barbers: { display_name: string } | null;
  services: { name: string; duration_min: number; price: number } | null;
})[] = [
  {
    id: "bk-1", client_id: "demo-client-1", barber_id: "demo-barber-1",
    shop_id: "demo-shop-1", service_id: "svc-1",
    date: today, start_time: "09:00:00", end_time: "09:30:00",
    status: "confirmed", deposit_status: "none", deposit_amount: 0,
    payment_status: "pending", payment_required: false, base_amount: 1800, payment_amount: 1800, payment_currency: "DOP", guest_count: 1, notes: "Primera limpieza del semestre", paid_at: null, confirmed_at: null, confirmed_by_user_id: null,
    whatsapp_reminder_sent: false, created_at: new Date().toISOString(),
    clients: { name: "Pedro Rodríguez", phone: "+1 809-555-0300", whatsapp: null },
    barbers: { display_name: "Dra. Laura Perez" },
    services: { name: "Limpieza dental", duration_min: 45, price: 1800 },
  },
  {
    id: "bk-2", client_id: "demo-client-2", barber_id: "demo-barber-2",
    shop_id: "demo-shop-1", service_id: "svc-2",
    date: today, start_time: "10:00:00", end_time: "10:45:00",
    status: "confirmed", deposit_status: "none", deposit_amount: 0,
    payment_status: "paid", payment_required: false, base_amount: 2100, payment_amount: 2100, payment_currency: "DOP", guest_count: 2, notes: "Pareja consulta inicial", paid_at: new Date().toISOString(), confirmed_at: null, confirmed_by_user_id: null,
    whatsapp_reminder_sent: false, created_at: new Date().toISOString(),
    clients: { name: "Luis Martínez", phone: "+1 809-555-0400", whatsapp: "+1 809-555-0400" },
    barbers: { display_name: "Dr. Miguel Santos" },
    services: { name: "Valoracion general", duration_min: 30, price: 1200 },
  },
  {
    id: "bk-3", client_id: "demo-client-3", barber_id: "demo-barber-1",
    shop_id: "demo-shop-1", service_id: "svc-3",
    date: today, start_time: "11:30:00", end_time: "11:50:00",
    status: "completed", deposit_status: "none", deposit_amount: 0,
    payment_status: "paid", payment_required: false, base_amount: 4200, payment_amount: 4200, payment_currency: "DOP", guest_count: 1, notes: null, paid_at: new Date().toISOString(), confirmed_at: null, confirmed_by_user_id: null,
    whatsapp_reminder_sent: true, created_at: new Date().toISOString(),
    clients: { name: "Miguel Torres", phone: null, whatsapp: null },
    barbers: { display_name: "Dra. Laura Perez" },
    services: { name: "Blanqueamiento", duration_min: 60, price: 4200 },
  },
  {
    id: "bk-4", client_id: "demo-client-4", barber_id: "demo-barber-2",
    shop_id: "demo-shop-1", service_id: "svc-4",
    date: today, start_time: "14:00:00", end_time: "14:25:00",
    status: "confirmed", deposit_status: "none", deposit_amount: 0,
    payment_status: "failed", payment_required: false, base_amount: 1500, payment_amount: 1500, payment_currency: "DOP", guest_count: 1, notes: "Paciente pediatrico", paid_at: null, confirmed_at: null, confirmed_by_user_id: null,
    whatsapp_reminder_sent: false, created_at: new Date().toISOString(),
    clients: { name: "Roberto King Jr.", phone: "+1 809-555-0500", whatsapp: null },
    barbers: { display_name: "Dr. Miguel Santos" },
    services: { name: "Consulta infantil", duration_min: 30, price: 1500 },
  },
];
