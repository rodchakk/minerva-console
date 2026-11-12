# ENTRY — Nombre visible con mayúsculas (2026-11-12)

Objetivo: capitalizar la primera letra de cada palabra de nombres de personas, sin alterar claves de identidad, activaciones o correos.

BASELINE PRODUCCIÓN, SOLO LECTURA:
- profiles: 183 / 524 nombres a transformar
- resident_activation_queue: 197 / 315
- community_registration_residents: 309 / 433
- resident_invites: 3 / 105
- resident_favorites: 3 / 77
- houses.owner_name: 0 / 25
- Total: 695 campos, NO 695 personas únicas.
- 283 vínculos registro -> Activation Queue: ninguna diferencia al comparar nombres ignorando mayúsculas.

DISEÑO:
- Mantener _cr_normalize_name_v1 y _cr_conversion_normalize_name_v1 en minúsculas para identidad.
- Nueva función entry_display_person_name_v1 y triggers antes de guardar los nombres visibles.
- Backfill histórico separado en supabase/maintenance; NO ejecutarlo como migración automática.
- La tabla privada de respaldo guarda valores anteriores, IDs y la clave normalizada de registro.

GATE OBLIGATORIO ANTES DE PRODUCCIÓN:
1. Ejecutar la migración en laboratorio ENTRY aislado, nunca en producción primero.
2. Probar INSERT/UPDATE para seis tablas, incluyendo caracteres acentuados, ñ, nombres de 4 palabras y mayúsculas arbitrarias.
3. Probar registro -> confirmación -> conversión -> Activation Queue -> activación y edición de contacto aprobado.
4. Revisar que la edición de contacto aprobado no cause eventos internal_correction falsos por diferencia de capitalización.
5. Revisar búsquedas y claves normalizadas, índices, RLS y comportamiento del JSON de retorno de los RPC.
6. Verificar respaldo reciente REAL y ruta de restauración; el gate de RPO de ENTRY anteriormente fue NO-GO.
7. Probar el backfill y su rollback en laboratorio. Auditar que no cambian IDs, permisos, contactos ni asociaciones.
8. Ejecutar migration en producción solo tras PASS. Probar nueva escritura en comunidad de pruebas autorizada.
9. Ejecutar script histórico en ventana controlada. Verificar con consultas de solo lectura.

CASOS ESPECIALES: McDonald, O'Neill, De la Cruz y otros pueden requerir revisión manual: initcap conserva acentos pero no la grafía excepcional.

CONSULTAS POSTERIORES:
select public.entry_display_person_name_v1('mIkAsA anCkErMaN');
select count(*) from public.profiles where full_name is not null and full_name is distinct from public.entry_display_person_name_v1(full_name);
select count(*) from public.resident_activation_queue where resident_name is not null and resident_name is distinct from public.entry_display_person_name_v1(resident_name);
select count(*) from public.community_registration_residents where full_name is not null and full_name is distinct from public.entry_display_person_name_v1(full_name);
select count(*) from public.community_registration_residents where normalized_full_name is distinct from public._cr_normalize_name_v1(full_name);
select count(*) from public.community_registration_residents r join public.resident_activation_queue q on q.id=r.activation_queue_id where lower(r.full_name) is distinct from lower(q.resident_name);

STATUS: Cambios preparados para PR. Laboratorio, recuperación, despliegue y backfill pendientes de validación. No declarar PASS.