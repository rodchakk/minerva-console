# ENTRY Community Registration / Pre-Onboarding Analysis

**Fecha:** 2026-08-05
**Alcance:** inspeccion, analisis y diseno tecnico. No se implemento codigo de producto, migraciones, RLS, Supabase, rutas ni componentes.
**Ubicacion elegida:** `content/brain/harness/ENTRY_COMMUNITY_ONBOARDING_ANALYSIS.md`. La solicitud sugirio `.minerva-harness/ENTRY_COMMUNITY_ONBOARDING_ANALYSIS.md`, pero en este repo no existe `.minerva-harness/`; el harness oficial de Minerva Core Brain vive bajo `content/brain/harness/`, definido como conocimiento Git-backed en `content/brain/harness/02_ARCHITECTURE.md`.

## 1. Resumen ejecutivo

**Recomendacion principal:** implementar ENTRY Community Registration / Pre-Onboarding como un modulo nuevo y obligatorio, separado de usuarios activos, activacion, autenticacion y `resident_activation_queue`. Debe recolectar datos por vivienda en tablas independientes de pre-onboarding y convertirlos a la cola/final de usuarios solo despues de revision interna y confirmacion del patronato.

**Hecho confirmado:** la consola ya tiene un onboarding interno para comunidades, importacion de viviendas/residentes desde archivo, cola de activacion, PINs, campanas de invitacion y creacion final de usuarios. Evidencia: `features/entry/communities/actions.ts:235-390`, `features/entry/communities/unitsImport.ts:1-11`, `features/entry/activation/actions.ts:277-327`, `features/entry/activation/createUserActions.ts:76-180`, `supabase/migrations/20260502140000_generate_resident_activation_pins_v1.sql:4-10`.

**Brecha central:** el flujo actual depende de que ENTRY ya tenga residentes preparados en `resident_activation_queue`; no existe un flujo publico privado por residencial para que residentes busquen vivienda, registren personas, corrijan y envien informacion sin crear usuarios. Busquedas por `registro`, `pre-onboarding`, `allow edit`, `reset registration`, `patronato` y equivalentes no muestran un modulo de registro comunitario en `app/`, `features/entry/` ni `supabase/`.

**Riesgo tecnico mayor:** varias tablas/RPCs base usadas por la consola no estan definidas en las migraciones de este repo (`create_community_v1`, `create_houses_bulk_v2`, `confirm_resident_bulk_import_v1`, `list_resident_activation_queue_v1`, tablas base como `communities`, `houses`, `profiles`, `community_members`, `resident_activation_queue`). El Knowledge Pack ya documenta esta deuda: varios RPCs viven solo en la DB live (`content/brain/projects/entry-implementation-map.md:47`, `content/brain/projects/entry-known-issues.md:30`).

## 2. Estado actual encontrado

### 2.1 Minerva Core Brain y harness

**Hecho confirmado:** Brain es Markdown/JSON versionado bajo `content/brain/**`, con harness en `content/brain/harness/`. Evidencia: `content/brain/harness/02_ARCHITECTURE.md:8-17`.

**Hecho confirmado:** Brain no debe tocar Supabase de ENTRY ni importar runtime de ENTRY. Evidencia: `content/brain/harness/02_ARCHITECTURE.md:32`, `content/brain/harness/05_AGENT_RULES.md:8-17`.

**Hecho confirmado:** el Knowledge Pack de ENTRY es una captura read-only de otro repo ENTRY (`D:\Dev\node-bridge-foundation`) y su `.minerva-harness/`; no es verificacion live actual. Evidencia: `content/brain/projects/entry.md:3-13`.

### 2.2 Arquitectura ENTRY documentada en Brain

**Hecho confirmado por Knowledge Pack:** ENTRY es una app Expo/React Native con Supabase, RLS en tablas, RPCs `SECURITY DEFINER`, Edge Functions, Realtime y Storage. Evidencia: `content/brain/projects/entry-implementation-map.md:9`.

**Hecho confirmado por Knowledge Pack:** las tablas core documentadas incluyen `communities`, `houses`, `house_residents`, `community_members`, `profiles`, `security_event_log` y otras. Evidencia: `content/brain/projects/entry-implementation-map.md:33-36`.

**Hecho confirmado por Knowledge Pack:** el patronato/administracion es el comprador principal de ENTRY; FIRST DOOR / Patronato Package v1 es la estrategia comercial formal. Evidencia: `content/brain/decisions/dec-0006-entry-first-door-patronato-package.md:28-44`, `content/brain/projects/entry-first-door-patronato-package-v1.md:24-29`.

### 2.3 Consola y autenticacion

**Hecho confirmado:** todas las rutas operativas bajo `app/(console)` heredan `requireSuperadmin()`. Evidencia: `app/(console)/layout.tsx:1-9`, `features/auth/requireSuperadmin.ts:38-52`.

**Hecho confirmado:** `requireSuperadmin()` resuelve usuario Supabase y llama RPC `is_superadmin`. Evidencia: `features/auth/requireSuperadmin.ts:14-35`.

**Hecho confirmado:** las rutas publicas actuales son `/login`, `/unauthorized`, `/activate`, `/reset-password`; no hay ruta publica `/registro/...`. Evidencia: `lib/supabase/middleware.ts:38-45`.

### 2.4 Comunidades y viviendas

**Hecho confirmado:** la creacion de comunidad actual llama RPC `create_community_v1`, luego opcionalmente `create_houses_bulk_v2`, `create_community_facilities_bulk_v1` y `confirm_resident_bulk_import_v1`. Evidencia: `features/entry/communities/actions.ts:235-390`.

**Hecho confirmado:** agregar viviendas manualmente llama `create_houses_bulk_v2` con `p_community_id` y `p_houses`. Evidencia: `features/entry/communities/actions.ts:203-232`.

**Hecho confirmado:** la UI ya permite importacion simple de una vivienda por linea y modo avanzado de residentes. Evidencia: `features/entry/communities/BulkUnitsUploader.tsx:50-79`.

**Hecho confirmado:** el importador avanzado usa encabezados `Unit Label`, `Resident Name`, `Phone`, `Email`, `Is Owner` y xlsx/csv. Evidencia: `features/entry/communities/unitsImport.ts:3-11`, `features/entry/communities/AdvancedUnitsImport.tsx:98-132`.

### 2.5 Residentes, cola de activacion y usuarios

**Hecho confirmado:** el importador avanzado prepara residentes, pero dice explicitamente que no crea usuarios activos ni PINs finales. Evidencia: `features/entry/communities/AdvancedUnitsImport.tsx:77-81`.

**Hecho confirmado:** la cola se consulta con RPC `list_resident_activation_queue_v1`; la pantalla la presenta como registros preparados esperando activacion controlada. Evidencia: `features/entry/activation/actions.ts:277-327`, `app/(console)/products/entry/activation/page.tsx:46-73`.

**Hecho confirmado:** generar PINs crea credenciales para `resident_activation_queue`, no usuarios reales. Evidencia: `supabase/migrations/20260502140000_generate_resident_activation_pins_v1.sql:4-10`, `:69-80`.

**Hecho confirmado:** completar activacion inserta `profiles`, `community_members`, `house_residents`, marca PIN usado y cola activada. Evidencia: `supabase/migrations/20260517223000_fix_complete_resident_activation_auth_type.sql:226-314`, comentario `:338-343`.

**Hecho confirmado:** la accion batch actual `createActivatedUsers` genera PINs y luego itera fila por fila llamando `complete_resident_activation_pin_v1`. Evidencia: `features/entry/activation/createUserActions.ts:76-180`.

### 2.6 Campanas actuales de onboarding

**Hecho confirmado:** ya existen `onboarding_campaigns` y `onboarding_campaign_messages`, pero son campanas de envio de invitaciones a residentes que ya estan en `resident_activation_queue`. Evidencia: `supabase/migrations/20260518010000_create_onboarding_campaigns.sql:1-15`, `:21-54`, `:71-108`.

**Hecho confirmado:** `start_onboarding_email_campaign_v1` no genera PINs, no envia emails y no crea usuarios; solo prepara mensajes por residente de la cola. Evidencia: `supabase/migrations/20260518011000_start_onboarding_email_campaign_v1.sql:1-25`, `:111-188`.

**Hecho confirmado:** el worker `send-onboarding-email-batch` genera PIN just-in-time, envia email o dry-run y marca cola como `invited`. Evidencia: `supabase/functions/send-onboarding-email-batch/index.ts:1-30`, `:163-230`.

## 3. Evidencia concreta del repositorio

| Area | Evidencia |
| --- | --- |
| Harness oficial | `content/brain/harness/02_ARCHITECTURE.md:8-17` |
| Regla de aislamiento Brain/ENTRY | `content/brain/harness/02_ARCHITECTURE.md:32`, `content/brain/harness/05_AGENT_RULES.md:8-17` |
| Entrada publica actual | `lib/supabase/middleware.ts:38-45`, `app/activate/page.tsx:108-205` |
| Gate superadmin | `app/(console)/layout.tsx:1-9`, `features/auth/requireSuperadmin.ts:14-52` |
| Crear comunidad | `features/entry/communities/actions.ts:235-390` |
| Agregar viviendas | `features/entry/communities/actions.ts:203-232` |
| Importador xlsx/csv | `features/entry/communities/unitsImport.ts:3-11`, `:95-224`, `:241-262` |
| Cola de activacion | `features/entry/activation/actions.ts:277-327` |
| Crear usuarios desde cola | `features/entry/activation/createUserActions.ts:76-180` |
| PINs pre-activacion | `supabase/migrations/20260502140000_generate_resident_activation_pins_v1.sql:16-54`, `:59-80` |
| Activacion atomica | `supabase/migrations/20260517223000_fix_complete_resident_activation_auth_type.sql:226-314` |
| Campanas existentes | `supabase/migrations/20260518010000_create_onboarding_campaigns.sql:21-108`, `20260518011000_start_onboarding_email_campaign_v1.sql:1-25` |
| Auditoria existente | `_sa_audit_log` en `supabase/migrations/20260502140000_generate_resident_activation_pins_v1.sql:299-310`; `security_event_log` en `20260517223000_fix_complete_resident_activation_auth_type.sql:295-304` |
| Deuda de migraciones/RPCs | `content/brain/projects/entry-implementation-map.md:47`, `content/brain/projects/entry-known-issues.md:30`; busqueda local no encontro definiciones versionadas de RPCs base |

## 4. Brechas detectadas

**Hecho confirmado:** no existe una tabla de campañas publicas de registro comunitario con slug/token, instrucciones, fechas y estados de registro por vivienda.

**Hecho confirmado:** no existe una ruta publica anonima tipo `/registro/[slug]`; el middleware solo reconoce `/activate` y `/reset-password` como publicas ademas de login/unauthorized.

**Hecho confirmado:** no existe una vista de patronato separada ni roles/permisos para patronato dentro del modulo actual. Los roles UI/RPC observados son `SUPERADMIN`, `ADMIN`, `GUARD`, `RESIDENT`, `UNASSIGNED`.

**Hecho confirmado:** no existe control de limite por vivienda en el codigo inspeccionado. Hay conteos de residentes activos por unidad (`features/entry/communities/detailQueries.ts:566-569`), pero no un `max_residents` versionado ni validacion de limite.

**Hecho confirmado:** no existe mecanismo de edicion anonima por token para registros enviados.

**Hecho confirmado:** no existe reset/versionado de solicitud de vivienda con preservacion de evidencia.

**Riesgo confirmado:** la historia de migraciones es incompleta para varias tablas/RPCs base. Esto puede bloquear implementacion segura si se intenta modificar entidades actuales sin snapshot/reconciliacion.

## 5. Arquitectura propuesta

### 5.1 Separacion de capas

**Recomendacion:** crear una capa nueva de pre-onboarding, con tablas independientes:

1. `community_registration_campaigns`: configuracion publica/privada de registro.
2. `community_registration_units`: snapshot normalizado de viviendas por campana, enlazable a `houses.id`.
3. `community_registration_submissions`: solicitud activa/versionada por vivienda.
4. `community_registration_residents`: personas declaradas dentro de una solicitud.
5. `community_registration_events`: historial/auditoria operacional.
6. `community_registration_access_tokens`: tokens hash para editar/revisar via enlace anonimo o patronato.

**Razon:** `resident_activation_queue` ya significa "residentes preparados para activacion"; usarla para datos no revisados mezclaria informacion incierta con flujo final y haria mas dificil resetear, reabrir y auditar errores.

### 5.2 Ubicacion del modulo

**Recomendacion:** construir dentro de Minerva Console como modulo ENTRY compartido:

- Publico residente: `app/registro/[campaignSlug]/page.tsx` o `app/entry/registro/[campaignSlug]/page.tsx`, fuera de `(console)` y permitido por middleware.
- Patronato: MVP con enlace privado `app/registro/[campaignSlug]/patronato/[token]` o ruta bajo `/board/...`; fase 2 puede pasar a login.
- ENTRY interno: bajo `app/(console)/products/entry/communities/[communityId]/registration/...` o `app/(console)/products/entry/onboarding-registration/...`.

**Inferencia tecnica:** conviene mantenerlo en la consola porque ya tiene Supabase SSR, Server Actions, UI y superadmin. No conviene una app separada para MVP salvo que se confirme necesidad de dominio/branding/public deploy independiente.

## 6. Modelo de datos recomendado

### 6.1 `community_registration_campaigns`

Campos:

- `id uuid pk`
- `community_id uuid references communities(id)`
- `slug text unique`
- `public_token_hash text` opcional si no se quiere slug enumerable puro
- `name text`
- `visible_name text`
- `resident_instructions text`
- `status text check ('draft','open','paused','closed','reviewing','confirmed','processed','archived')`
- `opens_at timestamptz`
- `closes_at timestamptz`
- `default_resident_limit int default 3 check (default_resident_limit > 0)`
- `patronato_access_token_hash text`
- `created_by uuid`
- `created_at`, `updated_at`

### 6.2 `community_registration_units`

Campos:

- `id uuid pk`
- `campaign_id uuid`
- `community_id uuid`
- `house_id uuid null references houses(id)`
- `unit_label text`
- `normalized_label text`
- `resident_limit_override int null`
- `current_status text`
- `active_submission_id uuid null`
- `created_at`, `updated_at`

Regla: `effective_limit = coalesce(resident_limit_override, campaign.default_resident_limit, 3)`.

### 6.3 `community_registration_submissions`

Campos:

- `id uuid pk`
- `campaign_id uuid`
- `registration_unit_id uuid`
- `status text check ('empty','in_progress','submitted','edit_allowed','resubmitted','needs_correction','entry_reviewed','patronato_confirmed','ready_for_activation','processed','reset')`
- `version int default 1`
- `submitter_name text null`
- `submitter_phone text null`
- `submitter_email text null`
- `edit_token_hash text null`
- `edit_token_expires_at timestamptz null`
- `submitted_at timestamptz null`
- `locked_at timestamptz null`
- `reviewed_by uuid null`
- `reviewed_at timestamptz null`
- `confirmed_by uuid/text null`
- `confirmed_at timestamptz null`
- `reset_at timestamptz null`
- `superseded_by uuid null`
- `created_at`, `updated_at`

### 6.4 `community_registration_residents`

Campos:

- `id uuid pk`
- `submission_id uuid`
- `campaign_id uuid`
- `registration_unit_id uuid`
- `full_name text`
- `email text null`
- `phone text null`
- `relationship text check ('owner','tenant','family','other')`
- `sort_order int`
- `validation_status text default 'unchecked'`
- `matched_profile_user_id uuid null`
- `matched_activation_queue_id uuid null`
- `created_at`, `updated_at`

### 6.5 `community_registration_events`

Campos:

- `id uuid pk`
- `campaign_id uuid`
- `registration_unit_id uuid null`
- `submission_id uuid null`
- `event_type text`
- `actor_type text check ('resident_token','patronato_token','superadmin','system')`
- `actor_user_id uuid null`
- `actor_token_id uuid null`
- `reason text null`
- `metadata jsonb`
- `created_at timestamptz default now()`

Eventos minimos: `campaign_opened`, `unit_started`, `submission_saved`, `submission_submitted`, `edit_allowed`, `resubmitted`, `entry_edited`, `marked_reviewed`, `patronato_confirmed`, `reset`, `prepared_for_activation`, `processed`.

## 7. Estados y transiciones

### Campana

**Recomendacion MVP:** `draft -> open -> paused -> closed -> reviewing -> confirmed -> processed -> archived`.

- `draft`: configuracion interna, no publica.
- `open`: residentes pueden registrar.
- `paused`: enlace responde, pero no acepta cambios.
- `closed`: no acepta nuevos registros.
- `reviewing`: ENTRY corrige/revisa.
- `confirmed`: patronato confirma consolidado.
- `processed`: usuarios/cola final creados.
- `archived`: solo lectura.

No usar `failed` en campana de recoleccion; los errores deben vivir en eventos y estado de procesamiento.

### Vivienda / solicitud

**Recomendacion MVP:** mantener estado operativo en `community_registration_submissions.status` y derivar estado de vivienda desde `active_submission_id`.

- Sin registrar: no hay submission activa.
- En progreso: `in_progress`.
- Enviado: `submitted`.
- Edicion habilitada: `edit_allowed`.
- Reenviado: `resubmitted`.
- Requiere correccion: `needs_correction`.
- Revisado: `entry_reviewed`.
- Confirmado por patronato: `patronato_confirmed`.
- Preparado para creacion: `ready_for_activation`.
- Usuarios creados: `processed`.
- Reiniciado: submission historica `reset`; vivienda vuelve a sin registrar.

**Evitar:** estados separados `corregido` y `en edicion` si no hay UI que los necesite; se pueden inferir por eventos.

## 8. Roles y permisos

### Residente anonimo

Puede:

- Ver campana abierta por slug/token.
- Buscar viviendas por etiqueta sin ver residentes existentes.
- Crear/editar un borrador solo mientras el token de sesion o edicion lo permita.
- Enviar y bloquear.

No puede:

- Crear viviendas arbitrarias.
- Ver datos de otra vivienda.
- Editar despues de enviar salvo `edit_allowed`.

### Patronato

MVP recomendado: enlace privado por campana con token hash, solo lectura + confirmacion.

Puede:

- Ver resumen por vivienda.
- Ver pendientes/registradas.
- Marcar observaciones o confirmar vivienda/consolidado.

No puede:

- Reiniciar registros.
- Cambiar limites.
- Crear usuarios.
- Cambiar configuracion de campana.
- Acceder a otras comunidades.

### ENTRY interno

Superadmin actual, heredando `requireSuperadmin()`.

Puede:

- Configurar campanas/unidades.
- Editar datos.
- Reabrir edicion.
- Reiniciar registro.
- Ajustar limites por vivienda.
- Revisar/confirmar/preparar procesamiento.
- Ejecutar conversion final.
- Ver historial.

### Sistema final

Consume solo registros `ready_for_activation` o `patronato_confirmed`, nunca submissions publicas crudas.

## 9. Flujo del residente

1. Abre `/registro/[slug]`.
2. Backend valida campana `open`, fecha, token si aplica.
3. Busca vivienda en `community_registration_units`.
4. Si vivienda no tiene submission activa: empieza registro.
5. Agrega hasta `effective_limit` residentes, default 3.
6. Ve resumen.
7. Confirma.
8. Backend crea/bloquea submission `submitted`, guarda residents y evento.
9. UI muestra mensaje neutro: "La informacion fue recibida y sera revisada por la administracion antes de activar las cuentas de ENTRY."

Si la vivienda ya fue enviada, mostrar solo: "Esta vivienda ya tiene un registro enviado." No mostrar nombres, correos ni telefonos.

## 10. Flujo del patronato

1. ENTRY comparte enlace privado de patronato o crea acceso limitado.
2. Patronato ve dashboard por campana: viviendas totales, registradas, pendientes, revisadas, confirmadas.
3. Revisa detalle por vivienda.
4. Marca observaciones o confirma.
5. Confirma consolidado final cuando ENTRY lo solicite.

MVP: token privado de solo lectura + acciones de confirmacion. Fase 2: cuenta administrativa formal.

## 11. Flujo interno ENTRY

1. Crear comunidad con flujo existente o seleccionar comunidad.
2. Importar/definir viviendas con `create_houses_bulk_v2` o nuevo importador de campana.
3. Crear campana de registro con slug, instrucciones, fechas y limite default 3.
4. Publicar enlace para WhatsApp.
5. Monitorear tablero interno.
6. Reabrir edicion o reiniciar viviendas con razon.
7. Revisar duplicados/errores.
8. Solicitar confirmacion patronato.
9. Marcar registros listos para conversion.
10. Ejecutar conversion final idempotente.

## 12. Flujo de creacion final de usuarios

**Recomendacion:** no insertar usuarios directamente desde submissions. Convertir submissions aprobadas a `resident_activation_queue` o a un RPC transaccional que use el mismo contrato final que `complete_resident_activation_pin_v1`.

MVP mas seguro:

1. RPC `prepare_registration_submission_for_activation_v1(p_campaign_id, p_submission_ids)` valida todo y crea filas en `resident_activation_queue` con referencia a `community_registration_residents.id`.
2. Usar flujo existente de Activation Queue para PINs/campanas/activacion.

Fase 2:

1. RPC `process_confirmed_registration_campaign_v1(p_campaign_id)` crea usuarios por lote con idempotency keys.
2. Cada residente queda enlazado a `profiles`, `community_members`, `house_residents`.

**Idempotencia necesaria:**

- unique parcial por `registration_resident_id` en la cola o tabla de conversion.
- verificar email/phone/username contra `profiles` y `auth.users`.
- no procesar submissions que ya tengan `processed_at`.
- registrar resultado por residente: `created`, `linked_existing`, `skipped_duplicate`, `failed_validation`.

## 13. Permitir edicion

**Recomendacion MVP:** token de edicion por vivienda/sumision, generado y hasheado por backend.

Flujo:

1. ENTRY presiona "Permitir edicion".
2. Backend cambia submission a `edit_allowed`, genera token random de alta entropia, guarda hash y expiracion.
3. ENTRY comparte enlace privado a la persona que reporto el error, o sistema envia correo/SMS en fase posterior.
4. Residente abre `/registro/[slug]/editar?token=...`.
5. Backend valida hash, campana no archivada, submission `edit_allowed`, expiracion vigente.
6. UI muestra datos de esa vivienda.
7. Residente corrige y confirma.
8. Backend crea nueva version o actualiza bajo lock, marca `resubmitted`, elimina/rota token y registra evento.

**Seguridad:** no usar solo vivienda+slug como autorizacion. No mostrar datos enviados en la pagina publica sin token.

## 14. Reiniciar registro

**Recomendacion MVP:** reset con versionado y auditoria, no hard delete.

Flujo:

1. ENTRY abre vivienda.
2. Presiona "Reiniciar registro".
3. Debe escribir motivo.
4. Backend en transaccion:
   - marca submission activa como `reset`;
   - guarda `reset_at`, `reset_by`, `reset_reason`;
   - deja `community_registration_units.active_submission_id = null`;
   - crea evento `reset` con snapshot/resumen de datos anteriores o referencia a submission.
5. Para residente, la vivienda vuelve a aparecer como no registrada.

**No borrar:** conservar residents historicos con `submission_id` reset y no exponerlos publicamente.

## 15. Seguridad y privacidad

Riesgos y controles:

- Enumeracion de viviendas: buscar por texto con rate limit y responder de forma neutra; opcional pedir codigo de campana.
- Exposicion de PII: nunca listar residentes registrados en vista publica sin token.
- Modificacion ajena: token por submission para editar; un token no puede cambiar otra vivienda.
- Spam: rate limit por IP+campana+vivienda en RPC publica; captcha solo si abuso real.
- Duplicados: validacion por email/telefono/nombre normalizado dentro de campana y contra perfiles existentes.
- Separacion comunitaria: toda tabla lleva `community_id` y `campaign_id`; RPCs validan ambos.
- RLS: tablas privadas sin politicas anon directas; operaciones anon solo via RPC `SECURITY DEFINER`.
- Patronato: token hash por campana, permisos limitados, expiracion/rotacion.
- Retencion: definir politica antes de produccion; minimo conservar evidencia hasta cierre/activacion y luego archivar.
- Consentimiento: pagina publica debe incluir aviso breve de uso de datos antes de envio.

## 16. RLS y controles backend

**Recomendacion:**

- Habilitar RLS en todas las tablas nuevas.
- `superadmin_all` para `authenticated` usando `public.is_superadmin()`, igual que `onboarding_campaigns` (`supabase/migrations/20260518010000_create_onboarding_campaigns.sql:150-165`).
- No dar `select/insert/update` anon directo sobre tablas de submissions/residents.
- Exponer RPCs anonimas limitadas:
  - `public_registration_lookup_campaign_v1`
  - `public_registration_search_units_v1`
  - `public_registration_start_submission_v1`
  - `public_registration_submit_v1`
  - `public_registration_validate_edit_token_v1`
  - `public_registration_resubmit_v1`
- RPCs internas:
  - `sa_create_registration_campaign_v1`
  - `sa_update_registration_campaign_v1`
  - `sa_reopen_registration_submission_v1`
  - `sa_reset_registration_unit_v1`
  - `sa_mark_registration_reviewed_v1`
  - `sa_prepare_registration_for_activation_v1`
  - `sa_process_registration_campaign_v1`

Cada RPC publica debe escribir `security_event_log` o `community_registration_events` con metadata no sensible.

## 17. Casos limite

- Dos familias intentan registrar la misma vivienda al mismo tiempo: unique parcial por vivienda+campana con estado activo, bloqueo transaccional.
- Familia registra casa equivocada: usar reset, no borrar.
- Vivienda con mas de 3 residentes: ENTRY ajusta `resident_limit_override`.
- Correo duplicado en dos viviendas: marcar duplicado, no bloquear submission si MVP quiere recolectar; bloquear conversion final.
- Residente sin email: permitir telefono; activacion posterior puede usar username/PIN existente.
- Campana cerrada mientras alguien edita: permitir completar solo si token tiene gracia configurada o bloquear con mensaje.
- Patronato confirma con errores: ENTRY mantiene autoridad final de procesamiento.
- Vivienda inexistente reportada por residente: MVP no permite crear; opcion fase 2 "Reportar vivienda no encontrada" como issue separado.

## 18. Riesgos

1. **Migraciones/RPCs incompletos:** varias dependencias base no estan versionadas en este repo.
2. **PII en enlaces compartidos:** WhatsApp multiplica exposicion; la pagina publica debe ser neutra.
3. **Uso indebido de `resident_activation_queue`:** mezclar solicitudes crudas con cola final puede crear usuarios incorrectos.
4. **Batch parcial:** la accion actual de crear usuarios itera por fila; para campanas grandes conviene RPC/job idempotente.
5. **Tokens largos vivos:** tokens de edicion/patronato deben expirar y rotarse.
6. **Patronato como rol no modelado:** no hay entidad clara de acceso limitado por comunidad/campana.
7. **Limites por vivienda inexistentes:** debe crearse modelo explicito.

## 19. MVP recomendado

Incluye:

- Campana por comunidad con slug privado, instrucciones, estado y fechas.
- Import/snapshot de viviendas existentes.
- Registro publico por busqueda de vivienda.
- Max default 3 residentes y override por vivienda.
- Confirmacion antes de enviar.
- Submission bloqueada despues de enviar.
- Dashboard interno ENTRY con conteos y detalle por vivienda.
- Acciones internas: editar datos, permitir edicion, reiniciar, marcar revisado, ajustar limite.
- Vista patronato por enlace privado: resumen, detalle y confirmacion.
- Eventos/historial basico.
- Preparar submissions aprobadas hacia Activation Queue.

## 20. Fases posteriores

- Cuenta formal de patronato con roles por comunidad.
- Notificaciones por email/SMS/WhatsApp.
- Verificacion por telefono/correo para edicion.
- Captcha/abuse tooling avanzado.
- Deteccion avanzada de duplicados fuzzy.
- Procesamiento directo de usuarios por campana con job reintentable.
- Portal de correcciones del patronato.
- Retencion/anonimizacion automatica post-procesamiento.

## 21. Plan de implementacion ordenado

1. Reconciliar schema/RPCs base: documentar definiciones actuales de `communities`, `houses`, `resident_activation_queue` y RPCs usados.
2. Crear migracion de tablas pre-onboarding + RLS + indices.
3. Crear RPCs publicas minimas de lookup/search/submit con rate limit.
4. Crear UI publica residente.
5. Crear UI interna de campanas y tablero por vivienda.
6. Implementar permitir edicion con token hash.
7. Implementar reiniciar registro con evento/snapshot.
8. Crear vista patronato por token.
9. Crear validaciones de duplicados/limites.
10. Implementar preparacion hacia `resident_activation_queue`.
11. Integrar con Activation Queue existente.
12. QA end-to-end con campana de prueba y datos ficticios.

## 22. Archivos que probablemente deberan modificarse

- `lib/supabase/middleware.ts`: permitir ruta publica `/registro`.
- `app/registro/[campaignSlug]/page.tsx`: nueva ruta publica.
- `app/registro/[campaignSlug]/editar/page.tsx`: edicion por token.
- `app/(console)/products/entry/communities/[communityId]/registration/...`: nuevo tablero interno.
- `features/entry/communityRegistration/**`: queries, actions, componentes.
- `features/entry/communities/CommunityOnboardingReadinessPanel.tsx`: enlazar progreso de pre-onboarding.
- `features/entry/activation/actions.ts`: integrar filas preparadas desde registration si se decide mostrar origen.
- `supabase/migrations/<timestamp>_create_community_registration_pre_onboarding.sql`.
- `supabase/migrations/<timestamp>_community_registration_rpcs.sql`.

## 23. Migraciones probablemente necesarias

- Crear `community_registration_campaigns`.
- Crear `community_registration_units`.
- Crear `community_registration_submissions`.
- Crear `community_registration_residents`.
- Crear `community_registration_events`.
- Crear `community_registration_access_tokens` o columnas hash dedicadas.
- Indices unique:
  - `campaign.slug`.
  - `campaign_id + normalized_label`.
  - una submission activa por `registration_unit_id`.
  - idempotency key por residente convertido.
- RLS y grants.
- RPCs `SECURITY DEFINER`.
- Comentarios SQL documentando que no crea usuarios.

## 24. Pruebas requeridas

- Unit tests de normalizacion de vivienda y validacion de residentes.
- Tests de RPC:
  - campana cerrada no acepta submit;
  - vivienda ya enviada responde neutro;
  - limite default 3;
  - override por vivienda;
  - token invalido/expirado no edita;
  - reset preserva historial;
  - conversion idempotente.
- Tests de RLS:
  - anon no puede seleccionar tablas directamente;
  - superadmin si puede;
  - patronato solo ve campana/token autorizado.
- E2E web:
  - residente registra vivienda;
  - ENTRY reabre edicion;
  - residente reenvia;
  - ENTRY reinicia vivienda equivocada;
  - patronato confirma;
  - ENTRY prepara Activation Queue.
- Seguridad:
  - no se muestran PII en vivienda ya enviada;
  - busqueda no enumera datos de residentes;
  - rate limiting.

## 25. Respuestas a preguntas solicitadas

1. **Como funciona actualmente el onboarding:** superadmin crea comunidad, agrega/importa unidades y residentes, revisa Activation Queue, genera PINs/campanas y completa onboarding. Evidencia en secciones 2.4-2.6.
2. **Como se crean comunidades/viviendas/residentes:** RPCs `create_community_v1`, `create_houses_bulk_v2`, `confirm_resident_bulk_import_v1`; residentes van a `resident_activation_queue`.
3. **Importacion masiva:** si, xlsx/csv/paste en `AdvancedUnitsImport` y `unitsImport`.
4. **Reutilizable:** importador de viviendas, UI interna, Activation Queue, PINs, campanas de invitacion, auditoria.
5. **Desde cero:** rutas publicas de registro, tablas pre-onboarding, tokens de edicion, patronato view, reset/versionado.
6. **Modelo de datos:** tablas separadas descritas en seccion 6.
7. **Tablas actuales o separadas:** separadas; convertir despues.
8. **Limite default 3:** `default_resident_limit` en campana.
9. **Excepciones:** `resident_limit_override` por vivienda.
10. **Edicion sin usuario:** token hash por submission, expiracion y estado `edit_allowed`.
11. **Permitir edicion:** accion interna genera token, cambia estado, rota al reenviar.
12. **Reiniciar registro:** marcar submission `reset`, liberar vivienda, evento con motivo.
13. **Historial:** `community_registration_events` + submissions versionadas/reset.
14. **Patronato:** ver/revisar/confirmar; no reiniciar ni crear usuarios.
15. **Solo ENTRY:** configuracion, limites, reset, edicion interna, conversion.
16. **Conversion usuarios:** preparar a `resident_activation_queue` o RPC transaccional final.
17. **Evitar duplicados:** unique/idempotency keys y validacion contra `profiles`, cola y campaign residents.
18. **Idempotencia:** referencias de origen y no reprocesar `processed_at`.
19. **RLS:** superadmin directo; anon/patronato solo RPC/token.
20. **Riesgos arquitectura:** migraciones incompletas, PII publica, batch parcial.
21. **Deuda bloqueante:** RPCs base no versionados y schema base ausente en migraciones.
22. **Dentro/separada:** dentro de consola como modulo ENTRY; ruta publica fuera de `(console)`.
23. **MVP:** recoleccion, revision, patronato, confirmacion, preparar usuarios.
24. **Fase 2:** cuentas patronato, notificaciones, verificacion fuerte, jobs avanzados.
25. **Orden:** ver seccion 21.

## 26. Preguntas abiertas

1. Cual es la definicion live actual de `resident_activation_queue` y `confirm_resident_bulk_import_v1`? No esta versionada en este repo.
2. Debe el dominio publico final ser `entry.minervatechs.com` o la consola actual? Afecta cookies, middleware y deploy.
3. El patronato debe operar por token en MVP o ya existen administradores comunitarios que deban reutilizarse?
4. Cual es la politica legal/operativa de retencion de solicitudes rechazadas o reseteadas?
5. Se permitira que un residente reporte "mi vivienda no aparece" en MVP, o se fuerza contacto manual?

## 27. Conclusion

ENTRY Community Registration / Pre-Onboarding es arquitectura de onboarding, no una mejora opcional. El sistema actual ya tiene buenas piezas posteriores a la recoleccion: viviendas, cola, PINs, activacion y auditoria. La implementacion correcta es insertar una capa previa, separada, auditada y tokenizada, que proteja PII y permita correccion comunitaria antes de tocar usuarios reales.
