# Copilot Instructions for VOS3000 Frontend

## Project Overview
- This is a React + Vite project for managing VOS3000 server configurations.
- Main features: server selection, mapping/routing gateway management, customer management, and credit limit editing.
- State management uses Redux (see `src/store/`).
- API communication is via Axios (see `src/api/vosApi.js`).

## Key Architectural Patterns
- **Pages**: High-level views in `src/pages/` (e.g., `ConfigureServerPage.jsx`, `CustomerManagementPage.jsx`).
- **Components**: Reusable UI in `src/components/` (e.g., `MappingGatewayActions.jsx`, `CustomerTable.jsx`).
- **API Layer**: All backend calls are centralized in `src/api/vosApi.js`.
- **State**: Redux slice for server selection (`src/store/serverSlice.js`).
- **UI**: Ant Design is used for most UI elements.

## Developer Workflows
- **Start Dev Server**: `npm run dev` (uses Vite)
- **Build**: `npm run build`
- **Lint**: `npm run lint` (ESLint config in `eslint.config.js`)
- **No built-in test suite**: Add tests if needed.

## Project-Specific Conventions
- All API calls should go through `vosApi.js`.
- Use Ant Design components for UI consistency.
- State for selected server/gateway is managed at the page level and passed down as props.
- After mutating data (e.g., updating a gateway), always re-fetch details to ensure UI is up-to-date.
- Notification/alert patterns: Use Ant Design's `notification` and `Alert` for user feedback.

## Integration Points
- Backend API base URL is set in `vosApi.js` (`http://127.0.0.1:8000`).
- All gateway and customer data flows through the API layer.
- To add new API endpoints, extend `vosApi.js` and use in relevant pages/components.

## Examples
- To update a Mapping Gateway: use `updateMappingGateway` in `vosApi.js`, then call the provided `onUpdateSuccess` callback to refresh data.
- To add a new page: create a file in `src/pages/`, add route logic if using a router (not present by default).

## Key Files
- `src/pages/ConfigureServerPage.jsx`: Main logic for server/gateway configuration.
- `src/components/MappingGatewayActions.jsx`: Handles add/delete/count prefix actions for Mapping Gateway.
- `src/api/vosApi.js`: All backend API calls.
- `src/store/serverSlice.js`: Redux state for server selection.

---
For further conventions, check this file and the README. Update this doc if you introduce new patterns or workflows.
