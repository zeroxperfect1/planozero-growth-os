# PLANOZERO Growth OS

Centro de mando de crecimiento internacional para PLANOZERO, desarrollado a partir de `public/estrategia-planozero.md`. Interfaz en español, responsive, con fondo grafito y naranja de acción.

## Ejecutar

Requiere **Node.js 22.13 o superior**. El proyecto usa `node:sqlite`, que puede emitir una advertencia experimental en Node 22.

```sh
npm install
npm run dev
```

Abrir **http://localhost:5173**. Desarrollo y API usan el mismo servidor y puerto. El servidor escucha únicamente en `127.0.0.1` por defecto.

```sh
npm run build   # TypeScript y build de producción
npm start       # Sirve dist y la API en el mismo puerto
npm test        # Pruebas de dominio, API, autenticación y permisos
```

## Empezar con datos reales

La aplicación **exige una cuenta del equipo**: no hay acceso de demostración ni datos ficticios en el navegador.

1. Abrir **http://localhost:5173**. Si el espacio aún no está configurado, la pantalla inicial pide crear la **cuenta de Dirección** con correo `@planozero.cl` y una contraseña de al menos 10 caracteres.
2. El espacio real empieza con el catálogo de **39 servicios y packs** y los **14 perfiles** de la matriz interna, más las doce iniciativas estratégicas. No contiene contactos, ingresos ni proyectos de ejemplo.
3. En Configuración, ajustar metas, capacidad, moneda de reporting y tasas de planificación. Los precios CLP deben definirse en la ficha de cada oferta.
4. Desde **Configuración → Equipo y acceso**, Dirección puede generar las cuentas de **Raúl, Vale y Dany** como ejecutivos Comerciales. El sistema crea contraseñas aleatorias y las muestra una sola vez para compartirlas por un canal privado. Para otros integrantes, usar **Agregar integrante**.

Solo se permite crear el primer administrador antes de configurar el espacio. En producción, esa activación exige `SETUP_TOKEN` (mínimo 32 caracteres). Cada integrante puede cambiar su contraseña; Dirección puede restablecerla y revocar sus sesiones. No se envía correo de invitación ni hay recuperación por correo o MFA.

## Funciones implementadas

- **Command Center:** MRR activo, pipeline ponderado, reuniones del periodo, capacidad, fase del roadmap, oportunidades, próximos pasos y actividad reciente.
- **Pipeline:** nueve etapas, kanban arrastrable y tabla, filtros, búsqueda, creación/edición/eliminación, oferta recomendada, moneda, probabilidad, responsable, origen, ICP y próxima acción. Selector de etapa accesible como alternativa al arrastre.
- **Detalle lateral:** registro de notas, reuniones, llamadas, emails y propuestas; historial y proyecto vinculado.
- **Ganado → proyecto:** creación transaccional e idempotente del proyecto, tres tareas de onboarding y revisión a 21 días. Usa las horas y recurrencia de la oferta. Editar el proyecto en Métricas para registrar costo, horas, recurrencia y renovación.
- **Roadmap:** doce meses, seis fases, edición de fechas, progreso, KPI, objetivos, dependencias, responsables y estados. Filtros por mercado, responsable, fase, estado y tipo.
- **Tareas:** acceso desde la navegación, responsables, fechas, prioridades, estados y marcado de completadas. Los filtros globales también se aplican al panel de tareas.
- **Mercados:** ICP, sectores, ciudades, posicionamiento, mensajes copiables, prospectos activos y ganados.
- **Servicios:** catálogo de 39 servicios y packs (proyecto, fee, individual, fotografía, reels e internacional) con precio neto en CLP, equivalencia referencial en EUR/USD para servicios locales, HH de referencia y origen de cada dato. Las tres ofertas internacionales conservan sus rangos propios en EUR/USD. Los 14 perfiles de la matriz interna muestran costo por HH y tarifa con comisión.
- **Cotizador HH:** precio neto por alcance, con perfiles, horas, comisión de agencia, margen adicional y otros costos. Guarda borradores, congela la fotografía comercial al enviar y permite duplicar para cambiar el alcance. Exporta el detalle interno en CSV.
- **Cuentas de equipo:** acceso limitado a `@planozero.cl`. Dirección genera las tres cuentas Comerciales solicitadas con contraseñas aleatorias de un solo vistazo, agrega otros integrantes y puede restablecer sus claves. Cada integrante puede cambiar su propia contraseña.
- **Contenido:** calendario mensual y lista, canales, formatos, pilares, CTA, estado y resultado registrado manualmente.
- **Alianzas:** partners, estado, modelo comercial, servicio complementario y próximo paso.
- **Métricas:** conversiones estimadas por cohorte, ingresos proyectados, MRR, ticket, margen, concentración, mix internacional y contenido. Exportación CSV de métricas y prospectos, con comillas escapadas y protección frente a fórmulas de hojas de cálculo.
- **Biblioteca:** documento maestro descargable y playbooks de método, prospección, revisión semanal y venta.
- **Alertas:** inactividad de siete días, propuesta abierta por cinco días hábiles, próxima acción ausente, pipeline menor a 3× meta, capacidad superior a 85% y renovación a 30 días.
- **Búsqueda global:** botón Buscar o ⌘/Ctrl K.

## Datos y cálculo

- **Espacio real:** `data/growth.sqlite` con WAL. Usuarios, sesiones, entidades y configuración persisten en SQLite. `data/` está ignorado por Git. No hay datos de demostración ni copia en el navegador.
- **Catálogo:** `server/catalog.json` (versión `2026-10-catalog-v4`) se carga en el primer inicio de cada espacio: 39 servicios y packs con sus HH por perfil, y 14 perfiles con costo interno por HH. **El repositorio publica valores ilustrativos**: precios, márgenes y costos por hora no son los reales. La matriz comercial verdadera vive en `server/catalog.private.json`, un archivo local e ignorado por Git que el servidor usa en su lugar cuando existe; si no existe, se cargan las cifras ilustrativas del repositorio. Dirección puede editar o desactivar perfiles; desactivar un perfil conserva las cotizaciones y asignaciones que lo usan, permite seguir editando borradores y cotizar ofertas que ya lo incluyen, pero no agregarlo a una línea nueva.
- **Monedas:** se conserva la moneda de cada oportunidad/proyecto. Los totales se convierten a la moneda de reporting con tasas editables. EUR/USD 1,09 y USD/CLP 950 son valores demostrativos de planificación, **no cotizaciones en vivo**.
- **Precio de cotización:** `neto = costo directo ÷ (1 − comisión − margen adicional)`, con `costo directo = horas × costo del perfil + otros costos`. La comisión de agencia es un porcentaje de la venta, no un recargo sobre el costo, y el margen adicional es la utilidad. El servidor recalcula siempre los totales: el cliente no puede fijar el precio.
- **Snapshot comercial:** al marcar una cotización como enviada, quedan congelados tarifas, horas, comisión, margen, costos y tipos de cambio. Cambiar las tarifas de los perfiles no altera una cotización ya enviada; para modificar el alcance hay que duplicarla.
- **Precio de catálogo vs. cotización:** el precio del catálogo es el valor comercial de la matriz; el cotizador es una reconstrucción de costo más comisión y margen. Con la comisión y el margen por defecto, el cotizador suele dar un valor superior al precio de catálogo. Conviene usarlos como dos referencias distintas, no como el mismo número.
- **Meta de ingresos:** se interpreta en la moneda de reporting. Ajustarla al cambiar esa moneda.
- **Ingresos:** proyectados por proyectos ganados; no representan cobros ni facturación. El MRR suma retainers activos, y la capacidad suma horas mensuales de proyectos activos.
- **Periodo:** filtra reuniones, contenido y cierres; conversiones usan prospectos creados en el periodo. MRR, pipeline y capacidad son fotografías actuales. Las conversiones se estiman desde la etapa actual, no desde un historial de todos los eventos de un embudo. Las fórmulas se explican en la interfaz. Las fechas y los periodos se calculan en horario de Chile (`America/Santiago`), no en UTC.
- **Costo cero:** se considera pendiente de registro al calcular margen, para evitar mostrar 100% sin costos cargados.
- **Días hábiles:** lunes a viernes, sin calendario de festivos por país.
- **Reabrir un ganado:** conserva el proyecto existente para evitar duplicados. Si se revierte un cierre por error, revisar y pausar/eliminar el proyecto desde Métricas según corresponda.

## Roles

| Rol                 | Acceso                                                                                                                                         |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Dirección           | Todas las entidades, configuración, catálogo de servicios y perfiles, y creación de usuarios                                                   |
| Comercial           | CRM, tareas, alianzas, contenido, proyectos e iniciativas; cotizador de sus propias cotizaciones; catálogo y perfiles en consulta                  |
| Estrategia / Diseño | Edición de tareas, contenido, proyectos e iniciativas; CRM y catálogo en consulta; sin cotizador                                                   |
| Colaborador externo | Solo tareas, contenido, iniciativas y proyectos asignados a su nombre; sin acceso al CRM ni al cotizador; puede actualizar sus tareas, contenido e iniciativas |

La matriz de permisos es un único archivo (`shared/permissions.mjs`) que usan la interfaz y el servidor, con una prueba que la recorre rol por rol. Los permisos se comprueban en el servidor, no solo en la interfaz. Solo se aceptan correos `@planozero.cl`; las contraseñas se almacenan con scrypt y salt. Los intentos fallidos se limitan por cuenta e IP (5 por cuenta y 30 por IP cada 15 minutos); los ingresos correctos no consumen el límite. Las sesiones usan tokens aleatorios, hash en la base de datos y cookies HttpOnly/SameSite Strict con siete días de duración. Cambiar o restablecer una clave revoca las otras sesiones. Las escrituras verifican origen y contenido JSON.

## Producción en Vercel y Supabase

- **Aplicación:** [https://planozero-growth-os.vercel.app](https://planozero-growth-os.vercel.app)
- **Vercel:** proyecto `planozero-growth-os`, función en São Paulo (`gru1`).
- **Supabase:** proyecto `planozero-growth-os`, PostgreSQL en São Paulo (`sa-east-1`), compartido por el pooler transaccional para serverless.
- Vercel guarda `DATABASE_URL` y `SETUP_TOKEN` como secretos de producción. `DATABASE_URL` usa TLS con la CA raíz oficial de Supabase (`server/supabase-ca.crt`), verificación del certificado y pool local de una conexión por instancia.
- La página está publicada y requiere una cuenta del equipo: entra con el correo de Dirección `@planozero.cl` y el código de activación. Después de crear Dirección, la aplicación rechaza nuevas activaciones; se puede retirar `SETUP_TOKEN` de Vercel.
- Luego, desde **Configuración → Equipo y acceso**, generar las cuentas de Raúl, Vale y Dany. Las contraseñas se muestran una sola vez.

## Configuración de servidor

| Variable        | Valor predeterminado | Uso                         |
| --------------- | -------------------- | --------------------------- |
| `PORT`          | `5173`               | Puerto de la app y API      |
| `HOST`          | `127.0.0.1`          | Interfaz de escucha         |
| `DB_PATH`       | `data/growth.sqlite` | Archivo de SQLite           |
| `NODE_ENV`      | desarrollo           | `production` sirve el build |
| `COOKIE_SECURE` | `false`              | Usar `true` detrás de HTTPS |
| `DATABASE_URL`  | —                    | Base PostgreSQL persistente para Vercel |
| `SETUP_TOKEN`   | —                    | Obligatorio en producción para activar por primera vez; mínimo 32 caracteres |

Genera un token de activación nuevo con `node -e "console.log(require('node:crypto').randomBytes(32).toString('base64url'))"`. No copiar `DATABASE_URL`, `SETUP_TOKEN` ni credenciales a un repositorio. Los respaldos productivos deben realizarse desde Supabase.

## Estructura

```text
src/             React, componentes, pantallas, cálculo de métricas y estilos
shared/          Datos estratégicos, semillas, permisos, errores y funciones de dominio
server/          Express, SQLite/PostgreSQL, catálogo, CA de Supabase, validación y autorización
public/          Favicon y documento maestro
tests/          Pruebas de dominio, catálogo, cálculo y API con SQLite/PostgreSQL temporal aislado
```

Stack: React + TypeScript + Vite, Express, Zod, SQLite/PostgreSQL y Lucide. Las tipificaciones están incluidas localmente. No hay integración con CRM externo, correo, facturación, scraping o IA comercial en este MVP.

## Verificación

- Build TypeScript/producción completado.
- Productivo publicado y verificado: `https://planozero-growth-os.vercel.app`, `/api/health` responde 200 y PostgreSQL conecta con TLS verificado. El espacio está configurado y solo se entra con una cuenta del equipo.
- 29 pruebas automatizadas: autorización, dominio corporativo, setup token, login, rate limits, cambio y restablecimiento de contraseña, revocación de sesiones, provisión de ejecutivos, validación, actividad, conversión a ganado, idempotencia, roles, persistencia, monedas, fechas de Chile, días hábiles, CSV, integridad del catálogo, cálculo de cotizaciones, perfiles inactivos y permisos por rol.
- Prueba de humo PostgreSQL (`RUN_PG_TESTS=1` y `TEST_DATABASE_URL`) que verifica el bloqueo de fila al cerrar dos veces un prospecto como Ganado. GitHub Actions ejecuta `npm test` con un servicio PostgreSQL 16 y luego `npm run build`.
- Pruebas de humo contra el servidor real: alta de espacio, alta de cotización, envío, congelación de la fotografía comercial, rechazo de volver a borrador y duplicación.
- Revisión en Chrome de dashboard, kanban, creación/guardado de prospecto, etapa Ganado, onboarding, actividad, persistencia tras recarga, edición de roadmap, navegación móvil y exportación CSV filtrada en el navegador.
