# HR Management Application Design Guidelines

## Design Approach

**Framework:** BambooHR-inspired design system with Material Design principles for enterprise HR applications. This approach prioritizes:
- Clean, organized data presentation with clear visual hierarchy
- Trustworthy, professional aesthetic suitable for healthcare compliance
- Efficient workflows with minimal visual friction
- Consistent, familiar patterns that reduce training time

**Key Design Principles:**
- Information clarity over decoration
- Progressive disclosure for complex workflows
- Scannable layouts with strong typographic hierarchy
- Consistent component patterns across all modules

## Color Palette

**Primary Colors:**
- Primary Blue: 217 91% 60% (#2563EB) - Primary actions, headers, active states
- Secondary Green: 160 84% 39% (#10B981) - Success states, completion indicators, positive metrics

**Supporting Colors:**
- Slate Gray: 215 25% 27% - Text primary, dark mode backgrounds
- Slate Light: 214 32% 91% - Subtle backgrounds, dividers
- Red Error: 0 84% 60% - Validation errors, critical alerts
- Amber Warning: 38 92% 50% - Pending reviews, caution states
- Sky Info: 199 89% 48% - Informational messages, badges

**Dark Mode:**
- Background: 222 47% 11%
- Surface: 217 33% 17%
- Maintain color accessibility with adjusted luminance

## Typography

**Font Stack:** Inter (Google Fonts) for entire application
- Headings: 600-700 weight, tight letter spacing (-0.025em)
- Body: 400-500 weight, relaxed line height (1.6)
- Data Tables: 400 weight, tabular numbers
- Labels: 500 weight, uppercase transforms for section headers

**Scale:**
- Page Titles: text-3xl (30px)
- Section Headers: text-xl (20px)
- Card Titles: text-lg (18px)
- Body/Forms: text-base (16px)
- Table Data: text-sm (14px)
- Captions/Meta: text-xs (12px)

## Layout System

**Spacing Primitives:** Use Tailwind units: 2, 4, 6, 8, 12, 16
- Component padding: p-6 or p-8
- Section gaps: gap-6 or gap-8
- Card spacing: space-y-4 or space-y-6
- Form fields: space-y-3

**Container Strategy:**
- Main content: max-w-7xl mx-auto with px-6
- Split layouts: 2-column with 2/3 - 1/3 ratio for content/sidebar
- Tables: full-width within container with horizontal scroll on mobile

## Core Components

### Navigation & Layout

**Top Navigation Bar:**
- Fixed header with shadow, white background (dark: slate-900)
- Logo left, global search center, user menu/notifications right
- Height: h-16, items centered vertically
- Active module indicator with bottom border (border-b-2 border-primary)

**Sidebar Navigation:**
- Width: w-64, collapsible to w-16 icon-only
- Module groupings with subtle dividers
- Active state: bg-blue-50 (dark: bg-slate-800) with left border accent
- Icons from Heroicons (outline style)

### Document Upload/Download Components

**File Upload Zone:**
- Dashed border (border-2 border-dashed border-slate-300), rounded-lg
- Drag-and-drop active state: border-primary bg-blue-50
- Center-aligned upload icon (cloud-arrow-up), bold text, file requirements
- Multiple file selection with preview thumbnails in grid below
- File type badges, size display, remove button per file

**Document Table:**
- Striped rows (odd:bg-slate-50)
- Columns: File icon, Name, Type badge, Size, Uploaded by, Date, Actions
- Sortable headers with arrow indicators
- Hover state: bg-slate-100 with download/delete action buttons revealed
- Inline progress bars during upload (h-1 bg-primary rounded-full)

**S3 Migration Progress Indicator:**
- Card-based layout with outlined border
- Top: Migration status badge (In Progress/Complete/Failed)
- Progress bar: h-2 with animated stripe pattern for active migrations
- Statistics grid below: Files Migrated, Total Size, Estimated Time
- Real-time log viewer (monospace font, max-h-64 overflow-y-auto)

### Forms & Data Entry

**Form Layout:**
- Label above input pattern with text-sm font-medium
- Input fields: border border-slate-300, rounded-lg, px-4 py-2.5
- Focus state: ring-2 ring-primary ring-offset-2
- Required fields: red asterisk, inline validation messages below input
- Multi-step forms: Stepper component with completed/active/upcoming states

**Employee Record Cards:**
- White cards with shadow-sm, rounded-lg, p-6
- Avatar/photo left (h-20 w-20 rounded-full)
- Name/title hierarchy, status badge right
- Quick actions toolbar at bottom with icon buttons
- Expandable sections using disclosure pattern

### Admin Configuration Pages

**S3 Settings Panel:**
- Two-column layout: Settings form left, connection status right
- Connection status card: Large status icon, last sync time, test connection button
- Form fields: Bucket name, Region dropdown, Access credentials (obscured with show/hide)
- Save settings: Primary button bottom-right with "Test & Save" pattern
- Activity log table below showing configuration changes with timestamps

### Data Tables

**Standard Table Pattern:**
- Sticky header with bg-slate-100 (dark: bg-slate-800)
- Column sorting: Chevron icons, active column highlighted
- Pagination: Bottom-center with per-page selector (10/25/50/100)
- Bulk actions: Checkbox column left, action bar appears when items selected
- Empty states: Centered illustration, helpful message, primary action button

**Compliance Tracking Table:**
- Status column with colored dots: Green (compliant), Red (overdue), Amber (expiring)
- Progress bars for partial completion
- Date columns with relative time tooltips
- Filter pills above table for quick filtering by status/department

### Progress Indicators

**Upload Progress:**
- Linear progress with percentage text overlay
- File-by-file breakdown in expandable list
- Color-coded completion: Primary for active, green for complete, red for errors

**Onboarding Workflow Progress:**
- Horizontal stepper with 4-6 steps
- Completed: Green checkmark, active: Primary circle, upcoming: Gray circle
- Connecting lines between steps
- Step labels below circles, clickable for navigation

## Images

**No large hero images** - This is a utility application prioritizing function over marketing.

**Avatar/Profile Photos:**
- Employee records: Circular avatars throughout
- Team directory: Grid of profile photos with names
- Fallback: Initials on colored background (derived from name hash)

**Empty State Illustrations:**
- Document library empty: Simple folder illustration
- No compliance items: Clipboard with checkmark illustration
- Use subtle, line-art style illustrations in slate-400 color

**Icon Library:** Heroicons (outline variant) for all interface icons

---

**Accessibility:** WCAG AA contrast ratios, keyboard navigation for all interactions, ARIA labels for screen readers, focus indicators on all interactive elements, form validation with clear error messaging.