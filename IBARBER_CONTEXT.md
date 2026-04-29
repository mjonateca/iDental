# iDental: Contexto Completo del Producto

## Qué es iDental

iDental es una webapp de reservas para clínicas dentales pequeñas y medianas, pensada para tres tipos de usuario:

- `client`: la persona que busca clínicas dentales, reserva citas, guarda favoritos y deja reseñas.
- `barber`: el dentista que gestiona su agenda, ve sus clientes y mantiene su perfil profesional.
- `shop_owner` / clínica dental: el dueño o administrador de la clínica dental que gestiona operación, servicios, dentistas y reservas.

El producto está construido con:

- `Next.js App Router`
- `Supabase Auth + Postgres + RLS`
- `API routes` para lógica sensible
- UI mobile-first orientada a reservas rápidas

También existe un `modo demo` que permite ver la experiencia sin Supabase configurado.

---

## Visión del producto

La idea central de iDental es cubrir el flujo completo de una clínica dental moderna:

1. Descubrimiento público de clínicas dentales por ubicación.
2. Registro y autenticación por rol.
3. Reserva online con validaciones reales de disponibilidad.
4. Panel diferenciado para cliente, dentista y clínica dental.
5. Gestión operativa de servicios, dentistas, reservas y clientes.
6. Base preparada para recordatorios, reprogramaciones y notificaciones tipo WhatsApp.

En otras palabras, iDental no es solo “una landing con formulario”; es una plataforma con catálogo público, sistema de cuentas, reservas y operación interna.

---

## Cómo está organizado el producto

### 1. Capa pública

La parte pública permite:

- ver la home de iDental
- filtrar clínicas dentales por país y ciudad
- abrir la página pública de cada clínica dental
- ver servicios activos
- ver dentistas activos
- iniciar una reserva desde la ficha pública

### 2. Capa autenticada

Después del login, el sistema decide la experiencia según el rol:

- `client` entra a un dashboard de descubrimiento, favoritos y reservas
- `barber` entra a un dashboard de agenda y clientes
- `shop_owner` entra a un dashboard de operación del negocio

### 3. Capa de datos

La base de datos separa claramente:

- `auth.users`: identidad autenticada
- `profiles`: rol y ubicación base del usuario
- `clients`: perfil de cliente
- `barbers`: perfil de dentista
- `shops`: clínicas dentales
- `services`: catálogo de servicios
- `bookings`: reservas
- `reviews`: reseñas
- `favorite_shops` y `favorite_barbers`: favoritos
- `notification_templates` y `notification_events`: sistema de notificaciones
- `barber_availability` y `barber_time_blocks`: disponibilidad y bloqueos

---

## Qué hace hoy iDental en la experiencia pública

## Home pública

La home pública de iDental:

- muestra branding de iDental
- permite entrar a login y registro
- deja elegir `country` y `city`
- lista clínicas dentales activas
- ordena primero las clínicas dentales de la ciudad seleccionada
- usa país/ciudad como mecanismo de descubrimiento local

La intención del home es que un cliente encuentre rápido clínicas dentales cercanas y entre al flujo de reserva sin fricción.

## Página pública de clínica dental

Cada clínica dental tiene una URL pública por `slug`.

La página pública muestra:

- nombre de la clínica dental
- logo, si existe
- dirección, si existe
- teléfono, si existe
- descripción, si existe
- lista de dentistas activos
- especialidad y rating del dentista, si existen
- lista de servicios activos y visibles
- duración y precio de cada servicio
- CTA para reservar

También permite:

- seleccionar un dentista concreto antes de reservar
- filtrar los servicios visibles según los servicios asignados a ese dentista
- advertir si el usuario está viendo la clínica dental con una cuenta de dentista o clínica dental, porque para reservar se requiere cuenta `client`
- mostrar un aviso de depósito si la clínica dental exige depósito y tiene monto configurado

---

## Registro y autenticación

## Tipos de cuenta soportados

El registro soporta tres tipos de cuenta:

- `client`
- `barber`
- `barbershop` que internamente se convierte en `shop_owner`

## Qué captura el registro

Según el tipo de cuenta, el formulario recoge:

- nombre
- apellidos
- correo
- teléfono / WhatsApp
- país
- ciudad
- contraseña

Además:

- `barbershop` pide nombre comercial, dirección y descripción
- `barber` puede indicar especialidad y el `slug` de la clínica dental donde trabaja

## Qué hace el backend al registrar

El endpoint de registro:

- crea el usuario en Supabase Auth con `email_confirm: true`
- guarda metadatos del usuario
- delega en un trigger SQL la creación o sincronización de tablas de negocio

Ese trigger:

- crea o actualiza `profiles`
- si es `client`, crea o actualiza `clients`
- si es `barber`, crea un registro en `barbers`
- si es `shop_owner`, crea una clínica dental en `shops`
- si es `shop_owner`, también genera templates de notificación por defecto

## Login

El login:

- autentica con email y contraseña
- mantiene sesión Supabase SSR
- redirige al dashboard

## Reparación automática de cuentas legacy

El producto ahora incluye una capa de autocorrección para usuarios antiguos que:

- existen en `auth.users`
- pero no tienen `profiles`
- o no tienen `clients`

Cuando eso ocurre, iDental:

- reconstruye el `profile`
- infiere el rol correcto según datos existentes
- crea el perfil `client` si hace falta

Esto evita que usuarios viejos queden “loggeados pero rotos”.

---

## Roles y experiencia por tipo de usuario

## 1. Cliente

El cliente es la cara de consumo del producto.

### Qué puede hacer hoy

- registrarse como cliente
- iniciar sesión
- ver clínicas dentales públicas
- filtrar clínicas dentales por ubicación
- abrir la ficha pública de una clínica dental
- seleccionar dentista
- seleccionar servicio
- elegir fecha y hora
- crear una reserva
- guardar clínicas dentales favoritas
- guardar dentistas favoritos
- ver sus reservas
- ver estado de sus reservas
- dejar reseñas sobre citas completadas

### Cómo funciona el dashboard del cliente

El dashboard del cliente muestra:

- perfil básico del cliente
- ciudad y país
- métricas simples:
  - cantidad de reservas
  - clínicas dentales favoritas
  - dentistas favoritos
- clínicas dentales activas relevantes para su zona
- acciones rápidas para:
  - reservar
  - ver clínica dental
  - marcar favorito
- historial / lista de reservas
- formulario para reseñar una cita completada

### Reglas de negocio del cliente

- solo un usuario con rol `client` puede reservar
- solo un cliente puede guardar favoritos
- solo un cliente puede reseñar
- solo puede reseñar una reserva propia
- solo puede reseñar si la reserva está `completed`
- solo puede dejar una reseña por booking

### Valor del producto para el cliente

Para el cliente, iDental funciona como:

- buscador local de clínicas dentales
- agenda de reservas
- sistema de favoritos
- historial de experiencia

---

## 2. Dentista

El dentista es un profesional dentro o fuera de una clínica dental.

### Qué puede hacer hoy

- registrarse como dentista
- iniciar sesión
- quedar vinculado a una clínica dental por `shop_slug` si se indicó al registrarse
- existir como dentista independiente si no se vinculó a un shop
- ver su dashboard
- ver su agenda de hoy
- ver próximos turnos
- ver clientes asociados a sus reservas
- ver servicios asignados
- editar su perfil profesional

### Qué muestra el dashboard del dentista

El dashboard del dentista se orienta a operación diaria:

- turnos de hoy
- próximos turnos
- clientes de hoy / próximos
- clínica dental asociada
- ingresos esperados del día
- servicios que ofrece

### Perfil del dentista

El dentista tiene atributos preparados para:

- nombre visible
- avatar
- bio
- especialidad
- portfolio
- rating
- si es independiente o no
- estado activo/inactivo

### Qué puede gestionar

Hoy, desde la lógica existente:

- puede actualizar su propio perfil profesional
- puede ver las reservas donde participa
- puede ver clientes que ya reservaron con él

### Valor del producto para el dentista

Para el dentista, iDental funciona como:

- agenda profesional
- ficha de presentación
- fuente de clientes
- interfaz ligera de operación diaria

---

## 3. Clínica dental / dueño del negocio

La clínica dental es el rol más completo en términos operativos.

### Qué puede hacer hoy

- registrarse como clínica dental
- iniciar sesión
- crear automáticamente su clínica dental al registrarse
- ser enviada a onboarding si aún no tiene clínica dental operativa
- gestionar su dashboard
- ver reservas del día
- ver reservas futuras
- crear servicios
- editar servicios
- desactivar servicios
- crear dentistas
- editar dentistas
- desactivar dentistas
- asignar servicios a dentistas
- ver clientes de sus reservas
- reprogramar o cambiar estado de bookings
- ver eventos/notificaciones del negocio

### Qué muestra el dashboard de clínica dental

El dashboard de clínica dental incluye:

- resumen del negocio
- total de reservas completadas
- reservas confirmadas pendientes
- ingresos esperados del día
- ingresos esperados de la semana
- lista de reservas del día
- catálogo de servicios
- equipo de dentistas
- lista de clientes relacionados con reservas
- notificaciones / eventos recientes

### Gestión de servicios

La clínica dental puede gestionar servicios con estos atributos:

- nombre
- duración en minutos
- precio
- moneda
- descripción
- categoría
- visibilidad
- estado activo
- orden

Esto permite diferenciar:

- servicios visibles para el público
- servicios internos o desactivados

### Gestión de dentistas

La clínica dental puede gestionar dentistas con:

- nombre visible
- bio
- especialidad
- avatar
- estado activo
- servicios asignados

### Gestión de reservas

La clínica dental puede:

- ver reservas del shop
- filtrar por fecha
- filtrar por estado
- filtrar por dentista
- cambiar estado de la reserva
- reprogramar fecha y hora
- detectar conflictos antes de mover una cita

### Onboarding de clínica dental

Existe un onboarding para cuentas `shop_owner` sin clínica dental operativa.

El flujo está pensado para:

- completar o corregir la información del negocio
- añadir dentistas iniciales
- dejar lista la clínica dental para comenzar a recibir reservas

### Valor del producto para la clínica dental

Para la clínica dental, iDental funciona como:

- mini sistema operativo del negocio
- agenda central
- gestor de catálogo
- gestor de equipo
- CRM ligero de clientes

---

## Cómo funciona el motor de reservas

La reserva es el núcleo funcional del producto.

## Flujo de reserva

El flujo actual es:

1. cliente entra a la clínica dental pública
2. elige dentista
3. elige servicio
4. elige fecha
5. elige hora
6. confirma
7. el backend crea el booking

## Validaciones reales del backend

El backend valida:

- que haya sesión iniciada
- que el rol sea `client`
- que exista el perfil `client`
- que la clínica dental esté activa
- que el dentista esté activo
- que el dentista pertenezca a esa clínica dental
- que el servicio esté activo y visible
- que el servicio pertenezca a esa clínica dental
- que el dentista realmente ofrezca ese servicio si tiene asignaciones explícitas
- que la hora de fin sea posterior a la de inicio
- que no exista solape con otra reserva

## Disponibilidad

La disponibilidad pública usa:

- reservas ya creadas
- bloqueos manuales del dentista (`barber_time_blocks`)

El endpoint devuelve intervalos ocupados.

## Estado inicial del booking

Cuando el booking se crea:

- entra como `confirmed`
- `deposit_status = none`
- `deposit_amount = 0`

## Estados soportados de reserva

La base contempla:

- `pending`
- `confirmed`
- `rescheduled`
- `completed`
- `no_show`
- `cancelled`

## Qué ya está preparado aunque no esté completo en UI

El modelo ya soporta:

- depósitos
- no show
- reprogramaciones
- recordatorios
- cancelaciones con eventos de notificación

---

## Favoritos y reseñas

## Favoritos

El cliente puede marcar:

- clínicas dentales favoritas
- dentistas favoritos

Eso sirve para:

- personalizar su dashboard
- volver rápido a una clínica dental o dentista preferido

## Reseñas

El cliente puede reseñar una cita completada.

Cada reseña:

- pertenece a un booking
- pertenece a un cliente
- pertenece a un dentista
- tiene rating de 1 a 5
- puede incluir comentario

Cuando una reseña se crea:

- el sistema recalcula el rating promedio del dentista

Esto convierte la reputación del dentista en una métrica viva y no solo decorativa.

---

## Ubicación y catálogo local

iDental tiene una capa de localización orientada al mercado hispano y caribeño.

## Países y ciudades

Hoy están modelados:

- República Dominicana
- Estados Unidos
- Puerto Rico

Y varias ciudades de esos países.

## Cómo usa la ubicación

La ubicación se usa para:

- registro de usuario
- ubicación de clínicas dentales
- orden del catálogo público
- personalización del dashboard del cliente
- filtros rápidos de descubrimiento

El objetivo es que iDental se sienta local, no genérico.

---

## Notificaciones y WhatsApp

## Qué está implementado en datos y lógica

El producto ya tiene una base robusta para notificaciones:

- `notification_templates`
- `notification_events`
- tipos de notificación:
  - confirmación
  - recordatorio
  - cancelación
  - reprogramación

Además:

- al crear un booking se generan eventos
- al cancelar se genera evento
- al reprogramar se genera evento
- el recordatorio se programa 3 horas antes por defecto

Cada clínica dental creada recibe templates por defecto.

## Qué significa esto en la práctica

iDental ya está programado para comportarse como si fuera a tener:

- confirmaciones automáticas
- recordatorios automáticos
- avisos de cambios de cita

## Qué no se ve completo en el repo inspeccionado

No se ve en este repo un worker o integrador final que:

- lea `notification_events`
- envíe el mensaje real por WhatsApp
- marque el evento como `sent` o `failed`

Es decir:

- la infraestructura de eventos y plantillas sí está modelada
- la entrega final del mensaje parece preparada, pero no completamente expuesta en esta capa

---

## Disponibilidad, horarios y bloqueos

La base también está preparada para gestión más avanzada de agenda.

## Tablas existentes

- `barber_availability`: disponibilidad semanal por día
- `barber_time_blocks`: bloqueos puntuales por fecha y hora

## Estado actual observado

Hoy el flujo de reserva usa claramente:

- slots predefinidos de hora en frontend
- reservas ya tomadas
- bloqueos puntuales

La disponibilidad semanal existe en modelo de datos, pero no se ve todavía explotada como editor completo en la UI revisada.

Eso significa que iDental ya está diseñado para evolucionar hacia una agenda mucho más flexible.

---

## Seguridad y permisos

Uno de los puntos fuertes del proyecto es que no mezcla todos los roles.

## Row Level Security

Hay políticas específicas para:

- lectura pública de clínicas dentales, dentistas, servicios y reviews
- lectura/escritura del propio cliente
- lectura/escritura del propio dentista
- gestión del dueño del shop sobre su clínica dental
- reservas según cliente, dentista o owner
- favoritos del propio cliente
- reviews del cliente correcto

## Reglas importantes ya codificadas

- el cliente no puede gestionar clínicas dentales
- la clínica dental no puede reservar como cliente
- el dentista no puede hacerse pasar por cliente al reservar
- cada actor ve lo que le toca según ownership y rol

Esto reduce muchísimo la mezcla de contextos y errores de autorización.

---

## Qué hace el modo demo

Si Supabase no está configurado:

- la app no se cae
- carga datos demo
- se puede revisar UI y navegación
- se puede simular el flujo principal

Esto sirve para:

- diseño
- demos
- trabajo de producto sin backend real

---

## Qué está operativo hoy vs qué está preparado para crecer

## Operativo hoy

Esto sí está implementado y visible en la app:

- home pública
- catálogo de clínicas dentales por ciudad/país
- página pública de clínica dental
- registro por rol
- login
- dashboard por rol
- reserva por cliente
- validaciones backend de reservas
- favoritos
- reseñas
- onboarding de clínica dental
- CRUD de servicios
- CRUD de dentistas
- actualización de reservas por el dueño
- perfil del dentista
- cálculo de rating por reseñas
- autocorrección de cuentas legacy

## Preparado o parcialmente preparado

Esto ya está modelado o encaminado, aunque no parece totalmente cerrado en UI/automatización:

- depósitos
- disponibilidad semanal avanzada
- bloqueos operativos más completos
- sistema de recordatorios por WhatsApp
- cola de eventos de notificación
- templates editables por clínica dental
- operación más avanzada de clientes y CRM

---

## Resumen por rol, en una frase

- `client`: descubre clínicas dentales, guarda favoritos, reserva y reseña.
- `barber`: gestiona su perfil, agenda y clientes.
- `shop_owner`: opera la clínica dental, equipo, catálogo y reservas.

---

## Resumen ejecutivo final

iDental es una plataforma de reservas para clínicas dentales con tres vistas de negocio claramente separadas:

- una vista pública para descubrimiento y conversión
- una vista de cliente para reservar y fidelizar
- una vista de dentista para ejecutar el servicio
- una vista de clínica dental para operar el negocio

No está planteado como un simple directorio. Está pensado como un sistema operativo ligero para clínicas dentales:

- atrae clientes
- convierte reservas
- organiza agenda
- estructura catálogo
- gestiona staff
- conserva historial
- prepara comunicaciones automáticas

Si alguien lee este archivo, debe entender que iDental ya resuelve el núcleo del producto:

- identidad por rol
- catálogo público
- reservas reales
- dashboards diferenciados
- operación interna

Y además deja lista la base para una segunda etapa:

- automatización de recordatorios
- agenda más avanzada
- depósitos y cobros
- mayor profundidad operativa

En resumen: iDental ya es una app funcional de reservas y gestión para clínicas dentales, con una arquitectura preparada para convertirse en un SaaS vertical serio para el sector.
