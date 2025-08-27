# Settings Management Page

This implementation provides a settings management static page that allows authenticated users with settings permission to view and update system settings.

## Features

- **Responsive UI**: Matches existing application design patterns
- **Real-time Updates**: Live UI feedback for setting changes
- **Permission-based Access**: Requires `settings = true` permission
- **Three System Settings**:
  - `close_delay_ms`: Door closing delay in milliseconds
  - `save_detection`: Whether to save detection images to database
  - `use_arduino`: Whether to use Arduino for door control

## Files Added

- `src/main/resources/settings/index.html` - Settings management page
- `src/main/resources/settings/script.js` - JavaScript functionality
- Updated `src/main/kotlin/Routing.kt` - Added settings route with permissions
- Updated `src/main/kotlin/settings/SystemSettings.kt` - Added authentication/permissions to API

## API Endpoints

- `GET /api/settings` - Retrieve current settings (requires settings permission)
- `PUT /api/settings` - Update a setting (requires settings permission)

## Usage

1. User must be authenticated
2. User must have `settings = true` permission in their UserPermissions
3. Navigate to `/settings/` to access the settings page
4. View current settings with descriptions in Russian
5. Modify values using the form controls
6. Click "Сохранить изменения" to save changes
7. Click "Обновить" to reload settings from server

## Security

- API endpoints protected with session authentication
- Permission-based access control using `UserPermissions(settings = true)`
- Form validation and error handling
- Loading states to prevent duplicate requests

## Testing

For testing without full authentication setup, temporarily uncomment the basic routing in `Application.kt` and use the non-authenticated API routes in `SystemSettings.kt`.