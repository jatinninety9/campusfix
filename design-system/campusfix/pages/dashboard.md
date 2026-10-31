# CampusFix dashboard implementation choices

This override records the user-requested orange-and-white redesign on 29 October 2026. It supersedes the master's dark palette and typography for the entire application. Preserve the master's operational states and accessibility requirements. Use navigation, metrics, role-specific workspaces, a category chart, and the issue feed in authenticated pages.

Use ivory canvas (`#f8f7f4`), white panels, warm neutral borders (`#e9e5df`), charcoal text (`#282620`), and burnt-orange actions (`#b94312`, white text). Student hero uses `#bc4917` with cream campus line art; the admin dispatch band uses charcoal with a white queue; staff uses an orange-edged white workbench and three actionable assignment stages. All role identities share the orange brand. Preserve amber open states, blue in-progress states, green resolved states, and neutral closed states. Pair status text with color.

Use Outfit for headings and numbers and DM Sans for body copy, with Arial/sans-serif fallbacks. Headings are larger and tighter; forms and navigation remain readable. The UI/UX Pro Max minimal/Swiss recommendation informs the grid, whitespace, and clear typography. The user's orange preference takes precedence over the generated blue palette.

Admin navigation exposes a control center and staff directory/account creation, with metrics ordered before dispatch. Staff overview emphasizes personal assignments and urgent work, with stage cards that filter assignments. Student overview highlights reports and resolutions awaiting confirmation in an illustrated orange banner. Metrics and charts are personal for staff/students and campus-wide for admins; the student campus feed remains shared. Login, registration, report forms, staff creation, charts, and native issue dialogs use the same light palette.

Maintain visible keyboard focus, labeled inputs, semantic buttons, a skip link, native modal dialog behavior, explicit async states, non-animated charts, reduced motion, and responsive layouts down to 375px. Persisted sample data must be labeled in the README and authentication page; never invent live activity or trend values.
