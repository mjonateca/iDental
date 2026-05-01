"use client";

import { FormEvent, useMemo, useState } from "react";
import type { InputHTMLAttributes } from "react";
import Link from "next/link";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import {
  Bell,
  CalendarDays,
  Camera,
  CheckCircle,
  Clock,
  CreditCard,
  ExternalLink,
  Loader2,
  Mail,
  Image as ImageIcon,
  Send,
  ShieldCheck,
  Star,
  Trash2,
  TrendingUp,
  UploadCloud,
  UserRound,
  Users,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { Toaster } from "@/components/ui/toaster";
import { formatCurrency, formatTime } from "@/lib/utils";
import type {
  BarberRating,
  Barber,
  BookingAddon,
  BookingStatus,
  EmailNotification,
  NotificationEvent,
  PaymentStatus,
  Service,
  ServiceAddon,
  Shop,
  ShopPaymentMethod,
  ShopSubscription,
  SubscriptionStatus,
} from "@/types/database";

export interface BookingWithRelations {
  id: string;
  client_id?: string;
  date?: string;
  start_time: string;
  end_time: string;
  status: BookingStatus;
  payment_status: PaymentStatus;
  payment_required: boolean;
  base_amount?: number;
  payment_amount: number;
  payment_currency: string;
  guest_count?: number;
  notes?: string | null;
  booking_addons?: BookingAddon[];
  clients: { id?: string; user_id?: string | null; name: string; phone: string | null; whatsapp: string | null } | null;
  barbers: { display_name: string } | null;
  services: { name: string; duration_min: number; price: number } | null;
}

type BarberWithServices = Barber & { barber_services?: Array<{ service_id: string }> };
type ServiceWithAddons = Service & { service_addons?: ServiceAddon[] };
type ClientSummary = {
  id: string;
  user_id?: string | null;
  name: string;
  phone: string | null;
  whatsapp: string | null;
  city?: string | null;
  country_name?: string | null;
};

type OpeningHoursValue = Record<string, { open: string; close: string; closed: boolean }>;

type Analytics = {
  totalsByStatus: {
    total: number;
    confirmed: number;
    pending: number;
    cancelled: number;
    completed: number;
  };
  estimatedRevenue: number;
  realizedRevenue: number;
  avgServiceTime: number;
  avgTicket: number;
  recurrentClients: number;
  topServices: Array<{ name: string; count: number; revenue: number }>;
  topBarbers: Array<{ name: string; count: number; revenue: number; completed: number }>;
  bestBarbers: Array<{ name: string; count: number; revenue: number; completed: number; completionRate: number }>;
  peakHours: Array<{ slot: string; count: number }>;
  peakWeekdays: Array<{ day: string; count: number }>;
  evolutions: {
    day: Array<{ label: string; value: number }>;
    week: Array<{ label: string; value: number }>;
    month: Array<{ label: string; value: number }>;
  };
  avgLeadMinutes: number;
};

interface Props {
  shop: Shop;
  todayBookings: BookingWithRelations[];
  bookings: BookingWithRelations[];
  services: ServiceWithAddons[];
  barbers: BarberWithServices[];
  clients: ClientSummary[];
  clientEmailById: Record<string, string | null>;
  ownerEmail?: string | null;
  notificationEvents: NotificationEvent[];
  ratings: BarberRating[];
  emailNotifications: EmailNotification[];
  subscription: ShopSubscription | null;
  paymentMethods: ShopPaymentMethod[];
  analytics: Analytics;
  stats: { totalCompleted: number; upcomingConfirmed: number; expectedToday: number; expectedWeek: number };
  todayStr: string;
  initialTab?: string;
}

type TabId = "summary" | "bookings" | "services" | "barbers" | "clients" | "schedule" | "email" | "settings";

const STATUS_LABELS: Record<BookingStatus, string> = {
  pending: "Pendiente",
  confirmed: "Confirmada",
  rescheduled: "Reprogramada",
  completed: "Completada",
  no_show: "No se presentó",
  cancelled: "Cancelada",
};

function StarDisplay({ rating, size = "sm" }: { rating: number; size?: "sm" | "md" }) {
  const sz = size === "md" ? "h-5 w-5" : "h-3.5 w-3.5";
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} className={`${sz} ${i <= Math.round(rating) ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30"}`} />
      ))}
    </div>
  );
}


const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  pending: "Pendiente de pago",
  paid: "Pagada",
  failed: "Pago fallido",
  refunded: "Reembolsada",
};

const SUBSCRIPTION_LABELS: Record<SubscriptionStatus, string> = {
  trial: "Prueba gratis",
  active: "Activa",
  past_due: "Pago pendiente",
  cancelled: "Cancelada",
  expired: "Vencida",
};

const WEEK_DAYS = [
  { key: "lunes", label: "Lunes" },
  { key: "martes", label: "Martes" },
  { key: "miercoles", label: "Miércoles" },
  { key: "jueves", label: "Jueves" },
  { key: "viernes", label: "Viernes" },
  { key: "sabado", label: "Sábado" },
  { key: "domingo", label: "Domingo" },
] as const;

function defaultOpeningHours(): OpeningHoursValue {
  return {
    lunes: { open: "09:00", close: "19:00", closed: false },
    martes: { open: "09:00", close: "19:00", closed: false },
    miercoles: { open: "09:00", close: "19:00", closed: false },
    jueves: { open: "09:00", close: "19:00", closed: false },
    viernes: { open: "09:00", close: "19:00", closed: false },
    sabado: { open: "09:00", close: "17:00", closed: false },
    domingo: { open: "09:00", close: "13:00", closed: true },
  };
}

function normalizeOpeningHours(value: Shop["opening_hours"]): OpeningHoursValue {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return defaultOpeningHours();
  }

  const fallback = defaultOpeningHours();
  const raw = value as Record<string, unknown>;
  const normalized: OpeningHoursValue = { ...fallback };

  for (const day of WEEK_DAYS) {
    const current = raw[day.key];
    if (current && typeof current === "object" && !Array.isArray(current)) {
      const dayValue = current as Record<string, unknown>;
      normalized[day.key] = {
        open: typeof dayValue.open === "string" ? dayValue.open : fallback[day.key].open,
        close: typeof dayValue.close === "string" ? dayValue.close : fallback[day.key].close,
        closed: typeof dayValue.closed === "boolean" ? dayValue.closed : fallback[day.key].closed,
      };
    }
  }

  return normalized;
}

function subscriptionTone(status?: SubscriptionStatus | null) {
  switch (status) {
    case "active":
    case "trial":
      return "text-emerald-600";
    case "past_due":
      return "text-amber-600";
    default:
      return "text-destructive";
  }
}

export default function DashboardClient({
  shop,
  todayBookings,
  bookings: initialBookings,
  services: initialServices,
  barbers: initialBarbers,
  clients,
  clientEmailById,
  ownerEmail,
  notificationEvents,
  ratings,
  emailNotifications: initialEmailNotifications,
  subscription,
  paymentMethods,
  analytics,
  stats,
  todayStr,
  initialTab = "summary",
}: Props) {
  const searchParams = useSearchParams();
  const currentTab = (searchParams.get("tab") || initialTab) as TabId;
  const [bookings, setBookings] = useState(initialBookings);
  const [services, setServices] = useState(initialServices);
  const [barbers, setBarbers] = useState(initialBarbers);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [shopState, setShopState] = useState(shop);
  const [notificationItems, setNotificationItems] = useState(notificationEvents);
  const [openingHours, setOpeningHours] = useState<OpeningHoursValue>(() => normalizeOpeningHours(shop.opening_hours));
  const [savingSchedule, setSavingSchedule] = useState(false);
  const [billingAction, setBillingAction] = useState<string | null>(null);
  const [sendingReminderId, setSendingReminderId] = useState<string | null>(null);
  const [uploadingBanner, setUploadingBanner] = useState(false);
  const [deletingServiceId, setDeletingServiceId] = useState<string | null>(null);
  const [uploadingBarberPhoto, setUploadingBarberPhoto] = useState<string | null>(null);
  const [emailNotifications, setEmailNotifications] = useState(initialEmailNotifications);

  const clientItems = useMemo(
    () =>
      clients.map((client) => ({
        title: client.name,
        detail: `${client.phone || client.whatsapp || "Sin teléfono"}${client.city ? ` · ${client.city}` : ""}`,
      })),
    [clients]
  );

  const bookingStatusCounts = bookings.reduce(
    (acc, booking) => {
      acc.total += 1;
      acc[booking.status] += 1;
      return acc;
    },
    {
      total: 0,
      pending: 0,
      confirmed: 0,
      rescheduled: 0,
      completed: 0,
      no_show: 0,
      cancelled: 0,
    } as Record<BookingStatus | "total", number>
  );
  const occupancyRate = stats.upcomingConfirmed ? Math.min(100, Math.round((todayBookings.length / stats.upcomingConfirmed) * 100)) : 0;
  const completedShare = bookingStatusCounts.total
    ? Math.min(100, Math.round((bookingStatusCounts.completed / bookingStatusCounts.total) * 100))
    : 0;
  const nextBooking = bookings.find((booking) => booking.status !== "cancelled");
  const topDentist = analytics.topBarbers[0];
  const topService = analytics.topServices[0];
  const todayRevenue = todayBookings.reduce((sum, booking) => sum + Number(booking.base_amount || booking.services?.price || 0), 0);
  const upcomingBookings = bookings.filter((booking) => !["cancelled", "completed"].includes(booking.status));
  const pendingBookings = bookings.filter((booking) => booking.status === "pending");
  const paidBookings = bookings.filter((booking) => booking.payment_status === "paid");
  const bookingsWithNotes = bookings.filter((booking) => booking.notes?.trim());
  const activeServices = services.filter((service) => service.is_active);
  const addonsCount = services.reduce((sum, service) => sum + (service.service_addons?.length || 0), 0);
  const avgServicePrice = services.length ? Math.round(services.reduce((sum, service) => sum + service.price, 0) / services.length) : 0;
  const avgServiceDuration = services.length ? Math.round(services.reduce((sum, service) => sum + service.duration_min, 0) / services.length) : 0;
  const activeBarbers = barbers.filter((barber) => barber.is_active);
  const specialtiesCount = new Set(barbers.map((barber) => barber.specialty?.trim()).filter(Boolean)).size;
  const serviceNameById = new Map(services.map((service) => [service.id, service.name]));
  const reminderCandidates = bookings.filter((booking) => ["pending", "confirmed", "rescheduled"].includes(booking.status));

  function updateDay(day: keyof OpeningHoursValue, field: "open" | "close" | "closed", value: string | boolean) {
    setOpeningHours((current) => ({
      ...current,
      [day]: {
        ...current[day],
        [field]: value,
      },
    }));
  }

  async function updateBooking(bookingId: string, status: BookingStatus) {
    setUpdatingId(bookingId);
    const response = await fetch(`/api/bookings/${bookingId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });

    const payload = await response.json().catch(() => ({ error: "Error inesperado" }));
    if (!response.ok) {
      toast({ variant: "destructive", title: "No se actualizó la reserva", description: payload.error });
    } else {
      setBookings((prev) => prev.map((booking) => (booking.id === bookingId ? { ...booking, status } : booking)));
      toast({ title: payload.message || "Reserva actualizada", description: STATUS_LABELS[status] });
    }

    setUpdatingId(null);
  }

  async function createService(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/dashboard/services", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        shop_id: shopState.id,
        name: form.get("name"),
        category: form.get("category"),
        description: form.get("description"),
        duration_min: Number(form.get("duration_min")),
        price: Number(form.get("price")),
      }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      toast({ variant: "destructive", title: "No se creó el servicio", description: payload.error });
      return;
    }
    setServices((prev) => [...prev, payload]);
    event.currentTarget.reset();
    toast({ title: "Servicio creado" });
  }

  async function toggleService(service: Service) {
    const response = await fetch(`/api/dashboard/services/${service.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_active: !service.is_active, is_visible: !service.is_active }),
    });
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      toast({ variant: "destructive", title: "No se actualizó el servicio", description: payload.error });
      return;
    }
    setServices((prev) =>
      prev.map((item) =>
        item.id === service.id ? { ...item, is_active: !item.is_active, is_visible: !item.is_active } : item
      )
    );
  }

  async function createBarber(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const serviceIds = form.getAll("service_ids").map(String);
    const response = await fetch("/api/dashboard/barbers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        shop_id: shopState.id,
        display_name: form.get("display_name"),
        specialty: form.get("specialty"),
        bio: form.get("bio"),
        service_ids: serviceIds,
      }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      toast({ variant: "destructive", title: "No se creó el dentista", description: payload.error });
      return;
    }
    setBarbers((prev) => [...prev, { ...payload, barber_services: serviceIds.map((id) => ({ service_id: id })) }]);
    event.currentTarget.reset();
    toast({ title: "Dentista creado" });
  }

  async function toggleBarber(barber: BarberWithServices) {
    const response = await fetch(`/api/dashboard/barbers/${barber.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_active: !barber.is_active }),
    });
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      toast({ variant: "destructive", title: "No se actualizó el dentista", description: payload.error });
      return;
    }
    setBarbers((prev) => prev.map((item) => (item.id === barber.id ? { ...item, is_active: !item.is_active } : item)));
  }

  async function createAddon(serviceId: string, event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const response = await fetch(`/api/dashboard/services/${serviceId}/addons`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.get("name"),
        price: Number(form.get("price")),
        duration_min: Number(form.get("duration_min") || 0),
      }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      toast({ variant: "destructive", title: "No se creó el add-on", description: payload.error });
      return;
    }
    setServices((prev) =>
      prev.map((service) =>
        service.id === serviceId
          ? { ...service, service_addons: [...(service.service_addons || []), payload] }
          : service
      )
    );
    event.currentTarget.reset();
    toast({ title: "Add-on creado" });
  }

  async function deleteAddon(serviceId: string, addonId: string) {
    const response = await fetch(`/api/dashboard/service-addons/${addonId}`, { method: "DELETE" });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      toast({ variant: "destructive", title: "No se eliminó el add-on", description: payload.error });
      return;
    }
    setServices((prev) =>
      prev.map((service) =>
        service.id === serviceId
          ? { ...service, service_addons: (service.service_addons || []).filter((addon) => addon.id !== addonId) }
          : service
      )
    );
  }

  async function saveSchedule(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSavingSchedule(true);

    const invalidDay = WEEK_DAYS.find(({ key }) => {
      const day = openingHours[key];
      return !day.closed && day.open >= day.close;
    });

    if (invalidDay) {
      toast({
        variant: "destructive",
        title: "Horario inválido",
        description: `Revisa ${invalidDay.label}: la hora de apertura debe ser menor que la de cierre.`,
      });
      setSavingSchedule(false);
      return;
    }

    const response = await fetch("/api/dashboard/shop", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ opening_hours: openingHours }),
    });

    const payload = await response.json().catch(() => ({}));
    setSavingSchedule(false);

    if (!response.ok) {
      toast({ variant: "destructive", title: "No se guardó el horario", description: payload.error || "Error inesperado" });
      return;
    }

    setShopState(payload);
    toast({ title: "Horario actualizado" });
  }

  async function openBillingCheckout() {
    setBillingAction("checkout");
    const response = await fetch("/api/billing/checkout", { method: "POST" });
    const payload = await response.json().catch(() => ({}));
    setBillingAction(null);
    if (!response.ok || !payload.url) {
      toast({ variant: "destructive", title: "No se pudo iniciar la suscripción", description: payload.error || "Error inesperado" });
      return;
    }
    window.location.href = payload.url;
  }

  async function openBillingPortal() {
    setBillingAction("portal");
    const response = await fetch("/api/billing/portal", { method: "POST" });
    const payload = await response.json().catch(() => ({}));
    setBillingAction(null);
    if (!response.ok || !payload.url) {
      toast({ variant: "destructive", title: "No se pudo abrir billing", description: payload.error || "Error inesperado" });
      return;
    }
    window.location.href = payload.url;
  }

  async function sendBookingReminder(bookingId: string) {
    setSendingReminderId(bookingId);
    const response = await fetch("/api/dashboard/reminders/email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ booking_id: bookingId }),
    });
    const payload = await response.json().catch(() => ({}));
    setSendingReminderId(null);

    if (!response.ok) {
      toast({ variant: "destructive", title: "No se envió el recordatorio", description: payload.error || "Error inesperado" });
      return;
    }

    setNotificationItems((current) => [
      {
        id: `local-${bookingId}-${Date.now()}`,
        booking_id: bookingId,
        shop_id: shopState.id,
        client_id: bookings.find((booking) => booking.id === bookingId)?.client_id || null,
        channel: "email",
        type: "booking_reminder",
        status: "sent",
        scheduled_for: null,
        sent_at: new Date().toISOString(),
        error: null,
        payload: {},
        created_at: new Date().toISOString(),
      },
      ...current,
    ]);
    toast({ title: payload.message || "Recordatorio enviado" });
  }

  async function uploadBannerImage(file: File) {
    setUploadingBanner(true);
    const formData = new FormData();
    formData.append("file", file);

    const response = await fetch("/api/dashboard/shop/banner", {
      method: "POST",
      body: formData,
    });
    const payload = await response.json().catch(() => ({}));
    setUploadingBanner(false);

    if (!response.ok || !payload.shop) {
      toast({ variant: "destructive", title: "No se subió el banner", description: payload.error || "Error inesperado" });
      return;
    }

    setShopState(payload.shop);
    toast({ title: "Banner actualizado" });
  }

  async function deleteService(id: string) {
    setDeletingServiceId(id);
    const response = await fetch(`/api/dashboard/services/${id}`, { method: "DELETE" });
    setDeletingServiceId(null);
    if (!response.ok) { toast({ variant: "destructive", title: "No se eliminó el servicio" }); return; }
    setServices((prev) => prev.filter((s) => s.id !== id));
    toast({ title: "Servicio eliminado" });
  }

  async function uploadBarberPhoto(barberId: string, file: File) {
    setUploadingBarberPhoto(barberId);
    const fd = new FormData(); fd.append("file", file);
    const response = await fetch(`/api/dashboard/barbers/${barberId}/upload-photo`, { method: "POST", body: fd });
    const payload = await response.json().catch(() => ({}));
    setUploadingBarberPhoto(null);
    if (!response.ok) { toast({ variant: "destructive", title: "Error al subir foto", description: payload.error }); return; }
    setBarbers((prev) => prev.map((b) => b.id === barberId ? { ...b, avatar_url: payload.url } : b));
    toast({ title: "Foto actualizada" });
  }

  async function sendEmailNotification(bookingId: string, type: string) {
    const response = await fetch("/api/dashboard/email-notifications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ booking_id: bookingId, type }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) { toast({ variant: "destructive", title: "Error al enviar email", description: payload.error }); return; }
    setEmailNotifications((prev) => [payload.notification, ...prev]);
    toast({ title: "Email enviado" });
  }

  async function saveShopInfo(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/dashboard/shop", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ address: form.get("address"), phone: form.get("phone"), description: form.get("description"), maps_url: form.get("maps_url") || null }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) { toast({ variant: "destructive", title: "No se guardó", description: payload.error }); return; }
    setShopState(payload);
    toast({ title: "Información guardada" });
  }

  return (
    <div className="max-w-7xl p-4 md:p-8">
      <div className="mb-7 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-sky-700">Panel Clinico</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight">{shopState.name}</h1>
          <p className="mt-1 text-muted-foreground capitalize">
            {shopState.city ? `${shopState.city} · ` : ""}
            {todayStr}
          </p>
          {subscription && (
            <p className={`mt-2 text-sm font-medium ${subscriptionTone(subscription.status)}`}>
              Suscripción: {SUBSCRIPTION_LABELS[subscription.status]}
              {subscription.trial_ends_at ? ` · Trial hasta ${new Date(subscription.trial_ends_at).toLocaleDateString()}` : ""}
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <Link href="/">Inicio</Link>
          </Button>
          <Link href={`/${shopState.slug}`} target="_blank" className="text-sm font-medium text-primary hover:underline">
            Ver página pública <ExternalLink className="inline h-3.5 w-3.5" />
          </Link>
        </div>
      </div>

      {currentTab === "summary" && (
        <div className="space-y-6">
          <section className="grid gap-4 xl:grid-cols-[1.7fr_1fr]">
            <div className="overflow-hidden rounded-[28px] bg-[linear-gradient(135deg,#0f4667_0%,#2d8fd0_48%,#8fd7ff_100%)] p-6 text-white shadow-[0_24px_60px_rgba(29,113,173,0.22)]">
              <div className="space-y-8">
                <div className="max-w-2xl pr-2">
                  <p className="text-sm font-medium text-white/70">Vista ejecutiva del dia</p>
                  <h2 className="mt-2 text-3xl font-bold tracking-tight">Operacion, ingresos y equipo en una sola pantalla.</h2>
                  <p className="mt-3 max-w-xl text-sm text-white/78">
                    Ve lo urgente primero: agenda de hoy, rendimiento del equipo, ticket promedio y salud de cobros sin perder el tono ligero de la app.
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
                  <HeroMetric title="Hoy" value={todayBookings.length} detail="citas activas" />
                  <HeroMetric title="Facturacion" value={formatCurrency(todayRevenue)} detail="programada" />
                  <HeroMetric title="Ocupacion" value={`${occupancyRate}%`} detail="de la agenda" />
                  <HeroMetric title="Completadas" value={`${completedShare}%`} detail="del historico" />
                </div>
              </div>
            </div>

            <Card className="border-white/70 bg-white/80 shadow-none backdrop-blur">
              <CardHeader>
                <CardTitle>Radar operativo</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <RadarRow
                  label="Proxima cita"
                  value={
                    nextBooking
                      ? `${nextBooking.clients?.name || "Cliente"} · ${nextBooking.date} · ${formatTime(nextBooking.start_time.slice(0, 5))}`
                      : "Sin reservas pendientes"
                  }
                />
                <RadarRow
                  label="Dentista mas solicitado"
                  value={topDentist ? `${topDentist.name} · ${topDentist.count} reservas` : "Todavia sin datos"}
                />
                <RadarRow
                  label="Servicio dominante"
                  value={topService ? `${topService.name} · ${formatCurrency(topService.revenue)}` : "Todavia sin datos"}
                />
                <RadarRow
                  label="Clientes recurrentes"
                  value={`${analytics.recurrentClients} pacientes con repeticion`}
                />
              </CardContent>
            </Card>
          </section>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <Metric title="Ingresos esperados hoy" value={formatCurrency(stats.expectedToday)} icon={TrendingUp} />
            <Metric title="Ingresos esperados semana" value={formatCurrency(stats.expectedWeek)} icon={CalendarDays} />
            <Metric title="Ticket medio" value={formatCurrency(analytics.avgTicket)} icon={CreditCard} />
            <Metric title="Tiempo medio servicio" value={`${analytics.avgServiceTime} min`} icon={Clock} />
            <Metric title="Total reservas" value={bookingStatusCounts.total} icon={CalendarDays} />
            <Metric title="Confirmadas" value={bookingStatusCounts.confirmed} icon={CheckCircle} />
            <Metric title="Pendientes" value={bookingStatusCounts.pending} icon={Clock} />
            <Metric title="Canceladas" value={bookingStatusCounts.cancelled} icon={Users} />
          </div>

          <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
            <Card className="border-white/70 bg-white/85 shadow-none backdrop-blur">
              <CardHeader>
                <CardTitle>Agenda inmediata</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {todayBookings.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No hay citas para hoy.</p>
                ) : (
                  todayBookings.slice(0, 6).map((booking) => (
                    <div key={booking.id} className="flex items-start justify-between rounded-2xl border border-sky-100 bg-sky-50/50 p-4">
                      <div>
                        <p className="font-medium">{booking.clients?.name || "Cliente"}</p>
                        <p className="text-sm text-muted-foreground">
                          {formatTime(booking.start_time.slice(0, 5))} · {booking.services?.name} · {booking.barbers?.display_name}
                        </p>
                        {booking.booking_addons?.length ? (
                          <p className="text-xs text-muted-foreground">Add-ons: {booking.booking_addons.map((addon) => addon.name_snapshot).join(", ")}</p>
                        ) : null}
                      </div>
                      <span className="rounded-full bg-white px-3 py-1 text-xs font-medium text-sky-800 shadow-sm">
                        {STATUS_LABELS[booking.status]}
                      </span>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            <Card className="border-white/70 bg-white/85 shadow-none backdrop-blur">
              <CardHeader>
                <CardTitle>Salud comercial</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <HealthBar label="Cobrado vs estimado" value={analytics.estimatedRevenue ? Math.round((analytics.realizedRevenue / analytics.estimatedRevenue) * 100) : 0} />
                <HealthBar label="Reservas completadas" value={completedShare} tone="emerald" />
                <HealthBar
                  label="Agenda confirmada"
                  value={bookingStatusCounts.total ? Math.round((bookingStatusCounts.confirmed / bookingStatusCounts.total) * 100) : 0}
                  tone="sky"
                />
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <InsightList
              title="Servicios más solicitados"
              items={analytics.topServices.map((item) => ({
                title: item.name,
                detail: `${item.count} reservas · ${formatCurrency(item.revenue)}`,
              }))}
            />
            <InsightList
              title="Dentistas con más reservas"
              items={analytics.topBarbers.map((item) => ({
                title: item.name,
                detail: `${item.count} reservas · ${formatCurrency(item.revenue)}`,
              }))}
            />
            <InsightList
              title="Dentistas con mejor rendimiento"
              items={analytics.bestBarbers.map((item) => ({
                title: item.name,
                detail: `${Math.round(item.completionRate * 100)}% completadas · ${formatCurrency(item.revenue)}`,
              }))}
            />
            <InsightList
              title="Franja horaria con más demanda"
              items={analytics.peakHours.map((item) => ({
                title: item.slot,
                detail: `${item.count} reservas`,
              }))}
            />
            <InsightList
              title="Días con más demanda"
              items={analytics.peakWeekdays.map((item) => ({
                title: item.day,
                detail: `${item.count} reservas`,
              }))}
            />
            <InsightList
              title="Evolución mensual"
              items={analytics.evolutions.month.slice(-6).map((item) => ({
                title: item.label,
                detail: `${item.value} reservas`,
              }))}
            />
          </div>

          <Card className="border-white/70 bg-white/85 shadow-none backdrop-blur">
            <CardHeader>
              <CardTitle>Suscripción y cobros</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {subscription ? (
                <>
                  <div className="rounded-xl border p-4">
                    <p className="font-medium">Estado actual: {SUBSCRIPTION_LABELS[subscription.status]}</p>
                    <p className="text-sm text-muted-foreground">
                      Importe: {formatCurrency(subscription.monthly_price, subscription.currency)} / mes
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Próxima renovación: {subscription.current_period_end ? new Date(subscription.current_period_end).toLocaleDateString() : "Pendiente"}
                    </p>
                    {subscription.last_payment_error && (
                      <p className="mt-2 text-sm text-destructive">{subscription.last_payment_error}</p>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button onClick={openBillingCheckout}>
                      {billingAction === "checkout" ? <Loader2 className="h-4 w-4 animate-spin" /> : "Activar / renovar plan"}
                    </Button>
                    <Button variant="outline" onClick={openBillingPortal}>
                      {billingAction === "portal" ? <Loader2 className="h-4 w-4 animate-spin" /> : "Gestionar método de pago"}
                    </Button>
                  </div>
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Tarjetas registradas</p>
                    {paymentMethods.length === 0 ? (
                      <p className="text-sm text-muted-foreground">Todavía no hay métodos de pago guardados para la clínica dental.</p>
                    ) : (
                      paymentMethods.map((paymentMethod) => (
                        <div key={paymentMethod.id} className="rounded-lg border p-3 text-sm">
                          {paymentMethod.brand?.toUpperCase() || "Tarjeta"} terminada en {paymentMethod.last4 || "****"}
                          {paymentMethod.is_default ? " · Predeterminada" : ""}
                        </div>
                      ))
                    )}
                  </div>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">La suscripción de esta clínica dental todavía se está preparando.</p>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {currentTab === "bookings" && (
        <div className="space-y-4">
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <Metric title="Por atender" value={upcomingBookings.length} icon={CalendarDays} />
            <Metric title="Pendientes" value={pendingBookings.length} icon={Clock} />
            <Metric title="Pagadas" value={paidBookings.length} icon={ShieldCheck} />
            <Metric title="Con notas clínicas" value={bookingsWithNotes.length} icon={Users} />
          </section>

          <div className="grid gap-4 xl:grid-cols-[1.3fr_0.7fr]">
            <Card className="overflow-hidden border-white/70 bg-white/85 shadow-none backdrop-blur">
              <CardHeader className="flex flex-row items-start justify-between gap-4">
                <div>
                  <CardTitle>Agenda operativa</CardTitle>
                  <p className="mt-1 text-sm text-muted-foreground">Reserva, estado clínico y cobro en una sola vista.</p>
                </div>
                <span className="rounded-full bg-sky-100 px-3 py-1 text-xs font-semibold text-sky-800">
                  {bookings.length} reservas
                </span>
              </CardHeader>
              <CardContent className="space-y-3">
                {bookings.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No hay reservas próximas.</p>
                ) : (
                  bookings.map((booking) => (
                    <div key={booking.id} className="rounded-[24px] border border-sky-100 bg-[linear-gradient(180deg,rgba(240,249,255,0.95)_0%,rgba(255,255,255,0.98)_100%)] p-4">
                      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_160px]">
                        <div className="min-w-0 space-y-3">
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="text-lg font-semibold">{booking.clients?.name || "Cliente"}</p>
                              <Tag tone="sky">{STATUS_LABELS[booking.status]}</Tag>
                              <Tag tone={booking.payment_status === "paid" ? "emerald" : booking.payment_status === "failed" ? "rose" : "slate"}>
                                {PAYMENT_STATUS_LABELS[booking.payment_status]}
                              </Tag>
                            </div>
                            <p className="mt-1 text-sm text-muted-foreground">
                              {booking.date} · {formatTime(booking.start_time.slice(0, 5))} a {formatTime(booking.end_time.slice(0, 5))}
                            </p>
                          </div>

                          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                            <MiniStat label="Tratamiento" value={booking.services?.name || "Sin servicio"} />
                            <MiniStat label="Dentista" value={booking.barbers?.display_name || "Sin asignar"} />
                            <MiniStat label="Pacientes" value={booking.guest_count && booking.guest_count > 1 ? String(booking.guest_count) : "1"} />
                            <MiniStat
                              label="Importe"
                              value={booking.payment_amount > 0 ? formatCurrency(booking.payment_amount, booking.payment_currency) : "Por definir"}
                            />
                          </div>

                          {booking.booking_addons?.length ? (
                              <div className="flex flex-wrap gap-2">
                                {booking.booking_addons.map((addon) => (
                                <Tag key={`${booking.id}-${addon.addon_id}-${addon.name_snapshot}`} tone="slate">
                                  {addon.name_snapshot}
                                </Tag>
                              ))}
                            </div>
                          ) : null}

                          {booking.notes ? (
                            <div className="rounded-2xl border border-sky-100 bg-white px-3 py-2 text-sm text-slate-600">
                              {booking.notes}
                            </div>
                          ) : null}
                        </div>

                        <div className="flex flex-col gap-2 xl:items-stretch">
                          {(["confirmed", "completed", "cancelled"] as BookingStatus[]).map((status) => (
                            <Button key={status} size="sm" variant="outline" disabled={updatingId === booking.id} onClick={() => updateBooking(booking.id, status)}>
                              {updatingId === booking.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : STATUS_LABELS[status]}
                            </Button>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            <Card className="border-white/70 bg-white/85 shadow-none backdrop-blur">
              <CardHeader>
                <CardTitle>Lectura rápida</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <RadarRow
                  label="Próxima cita"
                  value={
                    nextBooking
                      ? `${nextBooking.clients?.name || "Cliente"} · ${formatTime(nextBooking.start_time.slice(0, 5))}`
                      : "No hay movimientos pendientes"
                  }
                />
                <RadarRow
                  label="Cobro confirmado"
                  value={`${paidBookings.length} de ${bookings.length || 0} reservas ya están pagadas`}
                />
                <RadarRow
                  label="Pendiente de decisión"
                  value={`${pendingBookings.length} reservas requieren confirmación o cancelación`}
                />
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {currentTab === "services" && (
        <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
          <div className="space-y-4">
            <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <Metric title="Servicios activos" value={activeServices.length} icon={CheckCircle} />
              <Metric title="Add-ons activos" value={addonsCount} icon={TrendingUp} />
              <Metric title="Precio medio" value={formatCurrency(avgServicePrice)} icon={CreditCard} />
              <Metric title="Duración media" value={`${avgServiceDuration} min`} icon={Clock} />
            </section>

            <Card className="overflow-hidden border-white/70 bg-white/85 shadow-none backdrop-blur">
              <CardHeader className="flex flex-row items-start justify-between gap-4">
                <div>
                  <CardTitle>Catálogo clínico</CardTitle>
                  <p className="mt-1 text-sm text-muted-foreground">Controla visibilidad, estructura de precio y add-ons por tratamiento.</p>
                </div>
                <span className="rounded-full bg-sky-100 px-3 py-1 text-xs font-semibold text-sky-800">
                  {services.length} servicios
                </span>
              </CardHeader>
              <CardContent className="space-y-3">
                {services.map((service) => (
                  <div key={service.id} className="rounded-[24px] border border-sky-100 bg-[linear-gradient(180deg,rgba(240,249,255,0.95)_0%,rgba(255,255,255,0.98)_100%)] p-4">
                    <div className="flex flex-col gap-4">
                      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-lg font-semibold">{service.name}</p>
                            <Tag tone={service.is_active ? "emerald" : "slate"}>{service.is_active ? "Activo" : "Inactivo"}</Tag>
                            <Tag tone="sky">{service.category || "General"}</Tag>
                          </div>
                          <p className="mt-1 text-sm text-muted-foreground">
                            {service.description || "Sin descripción pública todavía."}
                          </p>
                        </div>
                        <Button variant="outline" size="sm" onClick={() => toggleService(service)}>
                          {service.is_active ? "Desactivar" : "Activar"}
                        </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:text-destructive"
                            onClick={() => { if (confirm("¿Eliminar este servicio?")) deleteService(service.id); }}
                            disabled={deletingServiceId === service.id}
                          >
                            {deletingServiceId === service.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                          </Button>
                      </div>

                      <div className="grid gap-2 sm:grid-cols-3">
                        <MiniStat label="Duración" value={`${service.duration_min} min`} />
                        <MiniStat label="Precio base" value={formatCurrency(service.price, service.currency)} />
                        <MiniStat label="Add-ons" value={String(service.service_addons?.length || 0)} />
                      </div>

                      <div className="space-y-2">
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-700">Add-ons disponibles</p>
                        {(service.service_addons || []).length ? (
                          <div className="grid gap-2">
                            {(service.service_addons || []).map((addon) => (
                              <div key={addon.id} className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm">
                                <div>
                                  <p className="font-medium">{addon.name}</p>
                                  <p className="text-muted-foreground">
                                    +{addon.duration_min} min · {formatCurrency(addon.price, service.currency)}
                                  </p>
                                </div>
                                <Button variant="ghost" size="sm" onClick={() => deleteAddon(service.id, addon.id)}>
                                  Quitar
                                </Button>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-sm text-muted-foreground">Todavía no hay add-ons para este servicio.</p>
                        )}
                        <form onSubmit={(event) => createAddon(service.id, event)} className="grid gap-2 sm:grid-cols-[1fr_110px_110px_auto]">
                          <Input name="name" placeholder="Add-on" required />
                          <Input name="duration_min" type="number" min="0" defaultValue="10" placeholder="Min" required />
                          <Input name="price" type="number" min="0" defaultValue="500" placeholder="Precio" required />
                          <Button type="submit">Agregar</Button>
                        </form>
                      </div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
          <CreateServiceForm onSubmit={createService} />
        </div>
      )}

      {currentTab === "barbers" && (
        <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
          <div className="space-y-4">
            <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <Metric title="Dentistas activos" value={activeBarbers.length} icon={Users} />
              <Metric title="Especialidades" value={specialtiesCount} icon={ShieldCheck} />
              <Metric title="Top performer" value={topDentist?.name || "Sin datos"} icon={TrendingUp} />
              <Metric title="Promedio servicios" value={barbers.length ? Math.round(barbers.reduce((sum, barber) => sum + (barber.barber_services?.length || 0), 0) / barbers.length) : 0} icon={CheckCircle} />
            </section>

            <Card className="overflow-hidden border-white/70 bg-white/85 shadow-none backdrop-blur">
              <CardHeader className="flex flex-row items-start justify-between gap-4">
                <div>
                  <CardTitle>Equipo clínico</CardTitle>
                  <p className="mt-1 text-sm text-muted-foreground">Cada ficha resume activación, especialidad y tratamientos asignados.</p>
                </div>
                <span className="rounded-full bg-sky-100 px-3 py-1 text-xs font-semibold text-sky-800">
                  {barbers.length} perfiles
                </span>
              </CardHeader>
              <CardContent className="space-y-3">
                {barbers.map((barber) => {
                  const assignedServices = (barber.barber_services || [])
                    .map((item) => serviceNameById.get(item.service_id))
                    .filter(Boolean) as string[];

                  return (
                    <div key={barber.id} className="rounded-[24px] border border-sky-100 bg-[linear-gradient(180deg,rgba(240,249,255,0.95)_0%,rgba(255,255,255,0.98)_100%)] p-4">
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                        <div className="space-y-3">
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="text-lg font-semibold">{barber.display_name}</p>
                              <Tag tone={barber.is_active ? "emerald" : "slate"}>{barber.is_active ? "Activo" : "Inactivo"}</Tag>
                              <Tag tone="sky">{barber.specialty || "Odontología general"}</Tag>
                            </div>
                            {barber.bio ? <p className="mt-1 text-sm text-muted-foreground">{barber.bio}</p> : null}
                          </div>

                          <div className="grid gap-2 sm:grid-cols-3">
                            <MiniStat label="Servicios asignados" value={String(assignedServices.length)} />
                            <MiniStat label="Reservas atendidas" value={String(analytics.topBarbers.find((item) => item.name === barber.display_name)?.count || 0)} />
                            <MiniStat label="Ingresos" value={formatCurrency(analytics.topBarbers.find((item) => item.name === barber.display_name)?.revenue || 0)} />
                          </div>

                          {assignedServices.length ? (
                            <div className="flex flex-wrap gap-2">
                              {assignedServices.map((serviceName) => (
                                <Tag key={`${barber.id}-${serviceName}`} tone="slate">
                                  {serviceName}
                                </Tag>
                              ))}
                            </div>
                          ) : (
                            <p className="text-sm text-muted-foreground">Sin tratamientos asignados todavía.</p>
                          )}
                        </div>

                        <div className="flex flex-col items-end gap-2">
                          <div className="relative h-16 w-16 overflow-hidden rounded-xl bg-muted flex items-center justify-center">
                            {barber.avatar_url ? (
                              <Image src={barber.avatar_url} alt={barber.display_name} width={64} height={64} className="object-cover w-full h-full" />
                            ) : (
                              <UserRound className="h-8 w-8 text-muted-foreground" />
                            )}
                            {barber.rating > 0 && (
                              <span className="absolute bottom-0.5 right-0.5 flex items-center gap-0.5 rounded bg-black/60 px-1 py-0.5 text-[9px] font-semibold text-white leading-none">
                                <Star className="h-2 w-2 fill-amber-400 text-amber-400" />
                                {barber.rating.toFixed(1)}
                              </span>
                            )}
                          </div>
                          <label className="cursor-pointer rounded-lg border px-3 py-1.5 text-xs font-medium hover:bg-muted transition-colors flex items-center gap-1.5">
                            {uploadingBarberPhoto === barber.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Camera className="h-3 w-3" />}
                            Foto
                            <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadBarberPhoto(barber.id, f); }} />
                          </label>
                          <Button variant="outline" size="sm" onClick={() => toggleBarber(barber)}>
                            {barber.is_active ? "Desactivar" : "Activar"}
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          </div>
          <CreateBarberForm services={services.filter((service) => service.is_active)} onSubmit={createBarber} />
        </div>
      )}

      {currentTab === "clients" && <SimpleList title="Clientes" empty="Aún no hay clientes con reservas." items={clientItems} />}

      {currentTab === "schedule" && (
        <Card className="shadow-none">
          <CardHeader>
            <CardTitle>Horario de funcionamiento</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={saveSchedule} className="space-y-4">
              {WEEK_DAYS.map(({ key, label }) => (
                <div key={key} className="grid gap-3 rounded-xl border p-4 md:grid-cols-[160px_1fr_1fr_auto] md:items-center">
                  <div className="font-medium">{label}</div>
                  <div className="space-y-1">
                    <Label htmlFor={`${key}-open`}>Abre</Label>
                    <Input
                      id={`${key}-open`}
                      type="time"
                      value={openingHours[key].open}
                      onChange={(event) => updateDay(key, "open", event.target.value)}
                      disabled={openingHours[key].closed}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor={`${key}-close`}>Cierra</Label>
                    <Input
                      id={`${key}-close`}
                      type="time"
                      value={openingHours[key].close}
                      onChange={(event) => updateDay(key, "close", event.target.value)}
                      disabled={openingHours[key].closed}
                    />
                  </div>
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={openingHours[key].closed} onChange={(event) => updateDay(key, "closed", event.target.checked)} />
                    Cerrado
                  </label>
                </div>
              ))}
              <Button type="submit" disabled={savingSchedule}>
                {savingSchedule ? "Guardando..." : "Guardar horario"}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {currentTab === "email" && (
        <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
          <Card className="border-white/70 bg-white/85 shadow-none backdrop-blur">
            <CardHeader>
              <CardTitle>Recordatorios por email</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Envía manualmente un correo recordando la cita desde la operativa de la clínica.
                {ownerEmail ? ` Responderá a ${ownerEmail}.` : ""}
              </p>
              {reminderCandidates.length === 0 ? (
                <p className="text-sm text-muted-foreground">No hay reservas pendientes para recordar.</p>
              ) : (
                reminderCandidates.map((booking) => {
                  const email = booking.client_id ? clientEmailById[booking.client_id] : null;
                  return (
                    <div key={`reminder-${booking.id}`} className="rounded-2xl border border-sky-100 bg-sky-50/40 p-4">
                      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                        <div className="min-w-0">
                          <p className="font-semibold">{booking.clients?.name || "Cliente"}</p>
                          <p className="text-sm text-muted-foreground">
                            {booking.date} · {formatTime(booking.start_time.slice(0, 5))} · {booking.services?.name} · {booking.barbers?.display_name}
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {email || "Este cliente no tiene correo registrado."}
                          </p>
                        </div>
                        <Button
                          size="sm"
                          disabled={!email || sendingReminderId === booking.id}
                          onClick={() => sendBookingReminder(booking.id)}
                        >
                          {sendingReminderId === booking.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="mr-2 h-4 w-4" />}
                          Enviar reminder
                        </Button>
                      </div>
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>

          <SimpleList
            title="Historial de notificaciones"
            empty="Aún no hay recordatorios enviados."
            items={notificationItems.map((event) => ({
              title: `${event.channel.toUpperCase()} · ${event.type.replaceAll("_", " ")}`,
              detail: `${event.status}${event.sent_at ? ` · ${new Date(event.sent_at).toLocaleString()}` : ""}${event.error ? ` · ${event.error}` : ""}`,
            }))}
          />
        </div>
      )}

      {currentTab === "settings" && (
        <div className="grid gap-4 xl:grid-cols-[1fr_380px]">
          <Card className="shadow-none">
            <CardHeader>
              <CardTitle>Ajustes</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-muted-foreground">
              <p>{shopState.name}</p>
              <p>{shopState.address}</p>
              <p>
                {shopState.city} · {shopState.country_name}
              </p>
              <p>{shopState.description || "Sin descripción pública."}</p>
              <p>Pagos online: {shopState.payments_enabled ? `Sí · modo ${shopState.online_payment_mode}` : "No activados"}</p>
            </CardContent>
          </Card>

          <Card className="border-white/70 bg-white/85 shadow-none backdrop-blur">
            <CardHeader>
              <CardTitle>Banner público</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="overflow-hidden rounded-2xl border border-sky-100 bg-sky-50">
                {shopState.banner_image_url ? (
                  <Image
                    src={shopState.banner_image_url}
                    alt="Banner de la clínica"
                    width={1200}
                    height={480}
                    className="h-48 w-full object-cover"
                  />
                ) : (
                  <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
                    <ImageIcon className="mr-2 h-4 w-4" />
                    Sin banner cargado
                  </div>
                )}
              </div>

              <label className="block">
                <span className="mb-2 block text-sm text-muted-foreground">Sube la imagen principal del banner público.</span>
                <Input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  disabled={uploadingBanner}
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) {
                      void uploadBannerImage(file);
                      event.currentTarget.value = "";
                    }
                  }}
                />
              </label>

              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <UploadCloud className="h-4 w-4" />
                JPG, PNG o WEBP hasta 5 MB.
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <Toaster />
    </div>
  );
}

function Metric({ title, value, icon: Icon }: { title: string; value: number | string; icon: typeof Clock }) {
  return (
    <Card className="overflow-hidden border-white/70 bg-white/85 shadow-none backdrop-blur">
      <CardContent className="flex items-center gap-3 p-4">
        <div className="rounded-2xl bg-primary/10 p-2.5">
          <Icon className="h-5 w-5 text-primary" />
        </div>
        <div>
          <p className="text-2xl font-bold">{value}</p>
          <p className="text-xs text-muted-foreground">{title}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function HeroMetric({ title, value, detail }: { title: string; value: string | number; detail: string }) {
  return (
    <div className="min-w-0 rounded-2xl border border-white/20 bg-white/10 p-4 backdrop-blur">
      <p className="text-xs uppercase tracking-[0.18em] text-white/65">{title}</p>
      <p className="mt-2 break-words text-2xl font-bold">{value}</p>
      <p className="mt-1 text-xs text-white/70">{detail}</p>
    </div>
  );
}

function RadarRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-sky-100 bg-sky-50/60 p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-700">{label}</p>
      <p className="mt-2 text-sm font-medium text-foreground">{value}</p>
    </div>
  );
}

function HealthBar({ label, value, tone = "amber" }: { label: string; value: number; tone?: "amber" | "emerald" | "sky" }) {
  const width = `${Math.max(0, Math.min(100, value))}%`;
  const toneClass =
    tone === "emerald"
      ? "from-emerald-400 to-emerald-600"
      : tone === "sky"
        ? "from-sky-400 to-sky-600"
        : "from-amber-300 to-amber-500";

  return (
    <div>
      <div className="mb-2 flex items-center justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium">{Math.max(0, Math.min(100, value))}%</span>
      </div>
      <div className="h-3 rounded-full bg-sky-50">
        <div className={`h-3 rounded-full bg-gradient-to-r ${toneClass}`} style={{ width }} />
      </div>
    </div>
  );
}

function Tag({ children, tone = "slate" }: { children: string; tone?: "emerald" | "sky" | "slate" | "rose" }) {
  const toneClass =
    tone === "emerald"
      ? "bg-emerald-100 text-emerald-700"
      : tone === "sky"
        ? "bg-sky-100 text-sky-800"
        : tone === "rose"
          ? "bg-rose-100 text-rose-700"
          : "bg-slate-100 text-slate-700";

  return <span className={`rounded-full px-3 py-1 text-xs font-semibold ${toneClass}`}>{children}</span>;
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-2xl border border-slate-200 bg-white px-3 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">{label}</p>
      <p className="mt-1 break-words text-sm font-semibold text-slate-900">{value}</p>
    </div>
  );
}

function InsightList({ title, items }: { title: string; items: Array<{ title: string; detail: string }> }) {
  return <SimpleList title={title} empty="No hay datos suficientes todavía." items={items} />;
}

function CreateServiceForm({ onSubmit }: { onSubmit: (event: FormEvent<HTMLFormElement>) => void }) {
  return (
    <Card className="shadow-none">
      <CardHeader>
        <CardTitle>Nuevo servicio</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={saveShopInfo} className="space-y-3">
          <Field name="name" label="Nombre" required />
          <Field name="category" label="Categoría" />
          <Field name="duration_min" label="Duración minutos" type="number" defaultValue="30" required />
          <Field name="price" label="Precio" type="number" defaultValue="500" required />
          <div className="space-y-1">
            <Label htmlFor="description">Descripción</Label>
            <textarea id="description" name="description" className="min-h-[76px] w-full rounded-xl border bg-background px-3 py-2 text-sm" />
          </div>
                  <div className="space-y-1">
                    <Label htmlFor="maps_url" className="text-sm">Embed de Google Maps</Label>
                    <Input id="maps_url" name="maps_url" defaultValue={shopState.maps_url || ""} placeholder="https://www.google.com/maps/embed?pb=..." />
                    <p className="text-xs text-muted-foreground">Google Maps → tu local → Compartir → Insertar mapa → copia el <code>src</code> del iframe</p>
                  </div>
          <Button type="submit" className="w-full">
            Crear servicio
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function CreateBarberForm({ services, onSubmit }: { services: ServiceWithAddons[]; onSubmit: (event: FormEvent<HTMLFormElement>) => void }) {
  return (
    <Card className="shadow-none">
      <CardHeader>
        <CardTitle>Nuevo dentista</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-3">
          <Field name="display_name" label="Nombre público" required />
          <Field name="specialty" label="Especialidad" />
          <div className="space-y-1">
            <Label htmlFor="bio">Bio</Label>
            <textarea id="bio" name="bio" className="min-h-[76px] w-full rounded-xl border bg-background px-3 py-2 text-sm" />
          </div>
          <div className="space-y-2">
            <Label>Servicios</Label>
            <div className="space-y-2 rounded-xl border p-3">
              {services.map((service) => (
                <label key={service.id} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" name="service_ids" value={service.id} />
                  {service.name}
                </label>
              ))}
            </div>
          </div>
          <Button type="submit" className="w-full">
            Crear dentista
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function Field({ label, ...props }: { label: string } & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="space-y-1">
      <Label htmlFor={props.name}>{label}</Label>
      <Input id={props.name} {...props} />
    </div>
  );
}

function SimpleList({ title, empty, items }: { title: string; empty: string; items: Array<{ title: string; detail: string }> }) {
  return (
    <Card className="shadow-none">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">{empty}</p>
        ) : (
          items.map((item, index) => (
            <div key={`${item.title}-${index}`} className="rounded-xl border p-4">
              <p className="font-medium">{item.title}</p>
              <p className="text-sm text-muted-foreground">{item.detail}</p>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
