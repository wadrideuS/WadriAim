# Acceso por usuario y correo

El registro pide usuario, correo y contraseña. El login pide usuario y contraseña. El usuario se normaliza a minúsculas y la restricción única de `profiles.username` evita duplicados.

La función `supabase/functions/username-auth/index.ts` resuelve el correo únicamente en el servidor y delega la contraseña a Supabase Auth. La clave privilegiada procede de los secretos incorporados de Edge Functions y nunca se añade al frontend. La recuperación devuelve el mismo mensaje para usuarios existentes e inexistentes.

## Configuración aplicada

- Función `username-auth` desplegada en el proyecto de Supabase.
- Verificación JWT de plataforma desactivada para permitir login antes de tener sesión; el handler valida los métodos, orígenes y datos.
- Consulta `supabase/queries/username_auth_limits.sql` aplicada: tabla privada con RLS y función ejecutable únicamente por `service_role`. Quince intentos de acceso y tres solicitudes de recuperación por usuario cada diez minutos. Esto es independiente de la cuota del proveedor de correo.
- El código de la consulta se conserva en `queries` porque la CLI no pudo crear su carpeta de configuración en esta sesión; no se inventó una entrada de historial de migraciones.

## SMTP configurado

Gmail está conectado como SMTP personalizado. Remitente y usuario SMTP: `jairparraga06@gmail.com`; nombre visible: `WadriAim`. La contraseña de aplicación se guardó únicamente en el panel de Supabase, nunca en este repositorio.

- Host: `smtp.gmail.com`
- Puerto: `587` con STARTTLS
- Cuota configurada del proyecto: 100 correos por hora
- Intervalo mínimo por usuario: 60 segundos

Se envió una confirmación a la cuenta del propietario desde el panel. Auth registró `200 /magiclink | request completed`. Esto confirma que la solicitud se procesó; falta la comprobación del propietario en su bandeja de entrada para afirmar recepción.

Gmail también tiene límites de envío. Configurar SMTP no equivale a envíos ilimitados. Después de guardar SMTP hay que verificar el envío real y revisar el límite de correo configurado en Supabase sin desactivar los controles de abuso.

Documentación: https://supabase.com/docs/guides/auth/auth-smtp y https://support.google.com/accounts/answer/185833
