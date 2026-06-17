# ENTRY

Residential and community access control system.

## Overview

ENTRY is a product that manages residential communities, units, staff, and user access. It has its own Supabase project and dedicated data layer.

## Boundaries

- ENTRY has its own Supabase project and operational database.
- Brain may reference ENTRY decisions and architecture but must not read ENTRY operational data.
- Brain code must not import from `features/entry/**`.

## Status

- **Status:** Approved
- **Stage:** Active development
- **Infrastructure:** Supabase (dedicated project)

## Key Features

- Community management
- Unit management
- Staff and user access control
- Onboarding workflows
- Activity logging
