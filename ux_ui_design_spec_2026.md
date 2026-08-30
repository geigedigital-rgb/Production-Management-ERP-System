# UX/UI Design Specification

## Production Management SaaS — Base Version, 2026

**Document purpose:** Product design and interaction specification  
**Specification language:** English  
**User interface language:** Ukrainian  
**Visual direction:** Light, white, green, calm, precise, and professional  
**Primary platform:** Desktop and laptop web application  

---

## 1. Document Role

This document defines the visual system, information hierarchy, navigation, screen composition, interaction rules, and core UX scenarios for the production management service.

It complements production_management_service_base_spec.md:

- the product specification defines business scope, data, permissions, calculations, and system behavior;
- this document defines how users see, understand, and operate that behavior;
- if the documents appear to conflict, business rules and scope come from the product specification, while presentation and interaction rules come from this document;
- this document must not be used to add future modules or expand the approved base-version scope.

The design must support a real daily operating system for a textile production business. It must not look like a generic admin template, a collection of unrelated dashboard cards, or an AI-generated landing page.

---

## 2. Product Design Goal

Create a modern, unified SaaS interface in which the business owner or Manager can quickly:

- understand what requires attention;
- find an order, client, product, or resource;
- create a product or order without unnecessary navigation;
- add missing data without losing the current context;
- see how a calculation was produced;
- recognize warnings, incomplete data, and blocked actions;
- save, compare, and approve calculation versions;
- prepare and hand an approved specification over to production.

The user should feel that the system helps complete a business task, not that it exposes the database structure.

The interface must reduce:

- switching between distant sections;
- repeated data entry;
- nested pages and nested cards;
- unnecessary confirmation steps;
- visual noise;
- uncertainty about the next action;
- the risk of editing the wrong version or using outdated prices.

---

## 3. Reference Interpretation

The previously supplied screenshots establish the following direction:

- clear left-side navigation;
- a wide central workspace;
- compact data tables;
- object-detail pages with strong information hierarchy;
- tabs inside an order or product workspace;
- contextual actions next to the data they affect;
- quiet backgrounds and white working surfaces;
- thin borders and restrained corner radii;
- moderate information density;
- one clear accent color;
- practical SaaS composition rather than decorative presentation.

The references are not templates to copy. Do not reproduce their:

- logos or brand identity;
- logistics-specific content;
- exact layouts;
- text;
- illustrations;
- navigation labels.

The final interface must be personalized for corporate apparel production, product costing, order configuration, and preparation for production.

---

## 4. Core UX Principles

### 4.1. Task Before Navigation

Navigation helps users reach an area, but the interface must also present the next relevant action inside the current workflow.

Examples:

- an order awaiting calculation shows **“Розрахувати”** directly in its context;
- an incomplete product shows which required data is missing;
- a calculation below the minimum margin shows how to request Administrator approval;
- a missing material can be created without leaving the configuration;
- production handover shows a readiness checklist with direct links to incomplete fields.

Do not force users to remember where every function lives in the menu.

### 4.2. One Workspace per Business Task

A user must be able to complete one product configuration or order calculation inside one coherent workspace.

Use:

- a stable page header;
- contextual tabs;
- one main content area;
- a sticky calculation summary where appropriate;
- side panels for adding supporting data;
- in-place validation and status feedback.

Do not split one calculation across several unrelated pages.

### 4.3. Progressive Disclosure

Show the information required for the current decision first. Advanced or rarely used details remain accessible without dominating the page.

Examples:

- show product, quantity, cost, price, and margin before audit metadata;
- show common material fields first and optional supplier details under **“Додатково”**;
- keep secondary row actions in a compact overflow menu;
- reveal detailed calculation components when the user opens the corresponding section or row.

Progressive disclosure must never hide information required to understand a price or approve an order.

### 4.4. Context Preservation

The system must preserve the user's position and entered data:

- opening a side panel does not reset the parent form;
- returning from an order preserves list filters and scroll position;
- failed validation does not discard valid inputs;
- changing a tab does not lose an unsaved draft;
- creating a missing record automatically returns it to the original selector;
- closing a form with unsaved changes requires a clear warning.

### 4.5. Visual Hierarchy Instead of Containers

Use spacing, typography, alignment, background shifts, dividers, and sticky regions to organize information.

Do not solve every grouping problem with another card. Avoid:

- cards inside cards;
- a separate outlined box around every field group;
- multiple nested backgrounds;
- excessive rounded containers;
- large empty dashboard tiles;
- repeated titles at page, card, and tab level.

Use a card only when a block is a genuinely separate object, summary, or interactive unit.

### 4.6. Visible System Logic

Users must understand why the system produced a result.

The interface should make visible:

- data source;
- applied unit and quantity;
- active rate;
- size or quantity coefficient;
- waste;
- fixed and variable components;
- cost;
- selling price;
- actual margin;
- whether a value is current, manually overridden, saved, or approved.

The user must not have to trust an unexplained total.

### 4.7. Safe Actions

The visual design must distinguish:

- editing a draft;
- saving a version;
- approving a version;
- changing an approved order through a new version;
- archiving a record;
- handing an order over to production.

Irreversible or state-changing actions require clear labels, consequences, and confirmation. Do not use vague buttons such as **“ОК”**, **“Так”**, or **“Продовжити”** when a specific action name is possible.

---

## 5. Visual Identity

### 5.1. Overall Character

The interface should feel:

- light;
- confident;
- organized;
- modern but not fashionable for its own sake;
- professional;
- calm during long sessions;
- precise enough for calculations and production data;
- approachable for non-technical users.

The visual identity is based on white working surfaces, a very light neutral application background, graphite typography, and a controlled green accent.

Green communicates action, readiness, and progress. It must not flood the interface or replace hierarchy.

### 5.2. Color Tokens

Use the following palette as the initial design source of truth:

~~~css
:root {
  --color-app-bg: #F5F8F6;
  --color-surface: #FFFFFF;
  --color-surface-subtle: #EFF5F1;
  --color-surface-hover: #F7FAF8;

  --color-text-primary: #18221D;
  --color-text-secondary: #5F6E66;
  --color-text-tertiary: #859188;
  --color-text-disabled: #A8B1AB;

  --color-border: #DDE6E0;
  --color-border-strong: #C9D6CE;
  --color-divider: #E8EEEA;

  --color-primary-50: #EDF8F2;
  --color-primary-100: #D9F0E3;
  --color-primary-200: #B8E2CA;
  --color-primary-300: #8FD0AA;
  --color-primary-400: #58B782;
  --color-primary-500: #2E9664;
  --color-primary-600: #1F7650;
  --color-primary-700: #195F42;
  --color-primary-800: #164C36;
  --color-primary-900: #133F2E;

  --color-success-bg: #EAF7EF;
  --color-success-text: #216A46;
  --color-warning-bg: #FFF6E5;
  --color-warning-text: #8A5A0A;
  --color-danger-bg: #FDEEEE;
  --color-danger-text: #A73535;
  --color-info-bg: #EDF4FF;
  --color-info-text: #285FAD;

  --color-focus-ring: #85C9A4;
  --color-overlay: rgba(18, 31, 24, 0.38);
}
~~~

Rules:

- primary buttons use primary-600;
- primary hover uses primary-700;
- light active navigation and selected rows use primary-50 or primary-100;
- white remains the dominant working surface;
- the application background is visible only between major surfaces;
- success and primary action must not rely on the same visual treatment;
- warning and danger states use text, icon, and shape in addition to color;
- colored text on soft backgrounds must meet WCAG AA contrast;
- large solid green areas are not allowed except for a small brand mark or intentional onboarding illustration.

### 5.3. Surfaces and Elevation

Use three elevation levels only:

1. Base application background.
2. White working surface with a border.
3. Floating surface such as dropdown, popover, modal, or side panel.

Recommended treatment:

- standard surface: white with a 1 px border;
- table and form sections: divider-based, usually without shadows;
- dropdown and popover: subtle shadow plus border;
- side panel: stronger shadow toward the page edge;
- modal: only for confirmation or a short focused action.

Do not use shadow to separate every section.

### 5.4. Radius

- compact controls: 8 px;
- buttons and inputs: 8 px;
- panels and major surfaces: 10–12 px;
- badges: 6 px or pill shape only for short statuses;
- no oversized 20–32 px radii on operational surfaces.

The product should look precise, not toy-like.

---

## 6. Typography

### 6.1. Font Families

Use:

- **Manrope Variable** for page titles, section titles, important totals, and product identity;
- **Inter Variable** for body text, forms, navigation, tables, statuses, and dense data.

Both fonts must be self-hosted or loaded reliably, include Ukrainian Cyrillic characters, and use font-display: swap.

If maintaining two families creates a technical limitation, use Inter Variable throughout. Do not introduce a third interface font.

### 6.2. Type Scale

~~~css
--type-page-title: 650 26px/32px "Manrope Variable";
--type-object-title: 650 20px/26px "Manrope Variable";
--type-section-title: 650 17px/24px "Manrope Variable";
--type-subsection-title: 650 15px/21px "Inter Variable";

--type-body-primary: 450 14px/21px "Inter Variable";
--type-body-secondary: 450 13px/19px "Inter Variable";
--type-label: 600 12.5px/17px "Inter Variable";
--type-caption: 500 12px/16px "Inter Variable";
--type-table: 450 13.5px/20px "Inter Variable";
--type-table-strong: 600 13.5px/20px "Inter Variable";
--type-button: 600 13.5px/18px "Inter Variable";
--type-total: 650 20px/26px "Manrope Variable";
~~~

### 6.3. Information Hierarchy

**First-priority text:**

- page and object names;
- cost, selling price, total, and margin;
- current order status;
- blocking warnings;
- main row value;
- primary action labels.

Use primary text color and medium or semibold weight. Do not use bold for entire paragraphs.

**Second-priority text:**

- explanatory text;
- client contact details;
- units;
- metadata;
- timestamps;
- descriptions;
- helper text.

Use secondary text color and normal weight.

**Third-priority text:**

- optional hints;
- historical metadata;
- empty-state descriptions;
- technical references visible to an Administrator.

Use tertiary text color only when contrast remains accessible.

### 6.4. Typography Rules

- Use sentence case for Ukrainian interface labels.
- Avoid all-uppercase headings.
- Keep page titles to one line where practical.
- Keep helper text short and place it near the field it explains.
- Use tabular numerals for prices, quantities, percentages, and calculated columns.
- Align monetary and numeric table columns to the right.
- Preserve non-breaking relationships between value and unit where practical.
- Use consistent decimal precision by value type.
- Do not reduce type below 12 px.
- Do not use letter spacing as decoration; apply only small optical adjustments to headings and labels.

---

## 7. Spacing, Grid, and Density

### 7.1. Spacing Scale

Use an 8 px foundation with half steps:

- 4 px — icon-to-label micro spacing;
- 8 px — compact internal spacing;
- 12 px — related controls;
- 16 px — field groups and table toolbar gaps;
- 20 px — compact section spacing;
- 24 px — standard section spacing;
- 32 px — major page separation;
- 40–48 px — exceptional separation between major page regions.

Avoid arbitrary values unless required for optical alignment.

### 7.2. Application Shell

- expanded sidebar width: 224 px;
- collapsed sidebar width: 68 px;
- top utility bar height: 56 px;
- standard page padding: 24 px on laptop, 28–32 px on wide desktop;
- maximum content width should not artificially constrain calculation and table screens;
- reading-oriented pages such as quotation preview may use a narrower centered layout;
- major workspaces should use available width rationally.

### 7.3. Control Density

- standard input and button height: 40 px;
- compact table controls: 32–36 px;
- table row height: 44 px by default;
- dense reference lists may use 40 px rows;
- touch target should remain at least 40 × 40 px for primary interactive controls;
- do not increase all controls to mobile-scale sizes on desktop.

### 7.4. Alignment

- align labels and values to a consistent column grid;
- group related numeric columns;
- align row actions consistently at the far right;
- keep primary actions in a predictable page-header or sticky-footer position;
- avoid centered text in operational tables except for short status or icon columns;
- use whitespace and dividers before adding another container.

---

## 8. Iconography

### 8.1. Icon Style

Use one consistent outline icon system as the technical foundation, with custom domain-specific SVG icons where general libraries are insufficient.

Style:

- 1.75 px stroke at 18–20 px;
- rounded line caps and joins;
- simple geometry;
- no filled cartoon icons;
- no emoji;
- no mixed icon families;
- optical alignment to text, not only mathematical centering.

### 8.2. Personalized Domain Icons

Create or adapt a coherent set for:

- overview;
- orders;
- clients;
- standard products;
- material or fabric roll;
- trims;
- manufacturing operation;
- decoration or branding;
- calculation;
- margin and price;
- version history;
- commercial quotation;
- approved specification;
- production handover;
- company settings.

Custom icons must look like part of the same family as navigation and action icons. They must not become illustrations.

### 8.3. Icon Usage Rules

- important actions use icon plus text;
- icon-only buttons are allowed for repeated conventional actions such as search, close, more actions, or row edit;
- every icon-only control requires an accessible name and tooltip;
- do not use the same icon for semantically different actions;
- destructive icons use danger color only on hover, focus, or confirmed destructive context;
- status icons are accompanied by text;
- a chevron indicates disclosure or navigation, not a generic action.

---

## 9. Navigation and Orientation

### 9.1. Primary Sidebar

The sidebar contains two visually distinct groups.

**Робоча зона:**

- Огляд;
- Замовлення;
- Клієнти;
- Вироби.

**Налаштування:**

- Матеріали та фурнітура;
- Операції;
- Нанесення;
- Правила калькуляції;
- Користувачі;
- Компанія та документи.

Behavior:

- the active item uses a soft green background, primary text, and a subtle left indicator;
- icons remain neutral until active or hovered;
- group labels are quiet and compact;
- the sidebar can collapse, but state should persist;
- collapsed icons require tooltips;
- future modules are not displayed;
- do not place deep multi-level trees in the primary sidebar.

### 9.2. Page Orientation

Every page should answer:

1. Where am I?
2. What object or list am I working with?
3. What requires attention?
4. What is the primary next action?

Use:

- one page title;
- optional short description only when useful;
- object identifier and status near the title;
- breadcrumbs only when the hierarchy is genuinely deeper than one level;
- contextual tabs for the internal structure of an order or product.

Do not repeat the same name in the sidebar, breadcrumb, page title, card title, and tab.

### 9.3. Global Search and Quick Access

Provide one global search or command entry in the application shell. It should help users reach:

- an order by number;
- a client by name;
- a product by name or code;
- a recently opened item.

The global search is a shortcut, not a replacement for page-level search and filters.

### 9.4. Contextual Navigation

Inside an order, use stable tabs:

- Комплектація;
- Калькуляція;
- Версії;
- Файли.

Tabs must:

- remain in the same position;
- show an error or incomplete indicator when relevant;
- preserve unsaved work;
- avoid routing users to visually unrelated pages;
- keep order identity and key summary visible.

---

## 10. Common Component Rules

### 10.1. Buttons

**Primary:** one per local decision area; solid green.  
**Secondary:** white or subtle surface with border.  
**Ghost:** low-emphasis contextual action.  
**Danger:** reserved for archive, delete, cancel, or destructive confirmation.

Rules:

- use precise verb labels;
- do not show more than one visually dominant action in the same group;
- maintain stable button positions between states;
- display progress inside the button during submission;
- disable repeated submission while processing;
- disabled actions should provide an explanation when the reason is not obvious.

### 10.2. Forms

- labels are placed above fields;
- required fields use a consistent marker;
- helper text appears below the field;
- errors appear next to the affected field;
- related unit or currency appears inside the control or in an attached suffix;
- input width reflects expected content length;
- optional fields are not given equal visual weight to required fields;
- use autocomplete for large catalogs;
- provide inline creation from searchable selectors;
- preserve user input after validation errors.

Use a two-column grid only when the fields are clearly related and comfortably fit. Long descriptions, calculations, and file inputs span the full width.

### 10.3. Side Panels

Use a side panel for:

- creating a missing material, client, operation, decoration method, or product;
- editing a supporting record without leaving the current workflow;
- viewing secondary details that do not require full-page context.

Recommended width:

- 420–480 px for simple reference data;
- 520–640 px for a larger but still contextual editor.

The panel includes:

- clear title and object type;
- concise form;
- sticky footer with **“Скасувати”** and the specific save action;
- unsaved-change protection;
- focus management and keyboard closing behavior.

Do not place another modal inside a side panel.

### 10.4. Dialogs

Use modal dialogs only for:

- short confirmations;
- a focused approval decision;
- explaining a blocked state with one resolution;
- destructive actions.

Do not use a modal for long product or order editing.

### 10.5. Statuses and Badges

Statuses use:

- a soft background;
- readable dark text;
- an optional small semantic icon;
- consistent Ukrainian labels.

Do not use saturated badge colors for every status. Color meaning must remain stable:

- neutral — draft or inactive;
- blue — informational or under review;
- green — approved or completed;
- amber — requires attention;
- red — blocked, cancelled, or critical.

### 10.6. Notifications

- success feedback is brief and non-blocking;
- validation errors remain near the field;
- system failures show a concise message and recovery action;
- do not rely only on disappearing toast notifications for important consequences;
- approval and production handover create visible persistent state changes.

---

## 11. Data Tables

### 11.1. Table Purpose

Tables are the primary interface for materials, products, clients, orders, versions, and calculation rows. They must be efficient, readable, and consistent.

### 11.2. Table Structure

- sticky header in long lists;
- clear primary column;
- secondary metadata in lower-emphasis text;
- numeric values aligned right;
- units displayed consistently;
- status column compact;
- row actions aligned right;
- selected row uses a soft green background or left marker;
- hover must not change row geometry;
- column widths reflect content importance.

### 11.3. Table Toolbar

The toolbar may contain:

- page-level search;
- essential filters;
- active-filter count;
- sort control when not represented in headers;
- density or column control only if genuinely needed;
- one primary create action.

Avoid a toolbar with many equally prominent controls.

### 11.4. Editing Behavior

Use inline editing only for safe, easily understood values such as:

- consumption rate;
- quantity;
- simple note;
- permitted manual price.

Open a side panel or dedicated object editor for:

- records with dependencies;
- calculation method;
- pricing rules;
- complex operation parameters;
- permission changes.

### 11.5. Empty and Loading States

- preserve table headers during loading;
- use restrained skeleton rows without animation overload;
- distinguish no data from no search results;
- empty catalog states provide one clear create action;
- no-results states show active filters and a reset option.

---

## 12. Page Templates

### 12.1. Overview

The Overview is an operational starting point, not an analytics showcase.

Recommended composition:

1. Compact page header with greeting or current work context and **“Створити замовлення”**.
2. Short attention strip showing:
   - orders requiring calculation;
   - orders pending approval;
   - approaching or overdue deadlines.
3. Main table **“Потребують уваги”** with the next recommended action in each row.
4. Secondary section for recently opened or recently updated orders.

Avoid:

- large decorative metric cards;
- charts without an operational decision;
- duplicated status counts;
- showing all possible data at once.

### 12.2. Orders List

Header:

- title **“Замовлення”**;
- concise result count;
- primary action **“Створити замовлення”**.

Toolbar:

- search by number, client, or product;
- status filter;
- responsible Manager filter;
- deadline filter;
- clear-filter action.

Table priority:

1. Order number and short request name.
2. Client.
3. Product.
4. Status.
5. Deadline.
6. Responsible Manager.
7. Total value when available.
8. Contextual next action.

Clicking a row opens the same order workspace. Do not create separate duplicated detail views.

### 12.3. Order Workspace

The order workspace is the core product screen.

**Persistent header:**

- order number and request name;
- client;
- responsible Manager;
- current status;
- deadline;
- unsaved-change or saved-state indicator;
- one primary context-dependent action.

**Context tabs:**

- Комплектація;
- Калькуляція;
- Версії;
- Файли.

**Desktop layout:**

- flexible main content area;
- 300–340 px sticky summary column when calculation context requires it;
- no unnecessary outer card around the entire page;
- section dividers instead of nested containers.

**Sticky summary:**

- cost per unit;
- selling price per unit;
- total amount;
- profit;
- actual margin;
- margin state;
- active calculation version or draft state.

The summary updates after relevant changes without moving the user's focus.

### 12.4. Product Catalog

Use a table as the default desktop view.

Primary columns:

- product name and code;
- category;
- default material;
- calculated reference price;
- last update;
- status.

A small product thumbnail is optional. Do not turn the catalog into a large card grid that shows fewer products and reduces scanning speed.

### 12.5. Product Editor

Use one continuous workspace with anchored sections rather than a multi-page wizard:

1. Основні дані.
2. Розміри.
3. Матеріали та фурнітура.
4. Операції.
5. Нанесення.
6. Контрольна калькуляція.

Provide:

- a compact completion indicator;
- direct navigation to an incomplete section;
- inline creation of missing records;
- sticky calculated summary;
- activation only when required data is valid.

The user should see the relationship between composition and calculation without switching between unrelated screens.

### 12.6. Reference Catalogs

Materials, trims, operations, and decoration methods share one consistent list pattern:

- page title and create action;
- search and essential filters;
- dense table;
- row editing in a side panel;
- archive instead of physical delete;
- duplicate detection before save.

The shared pattern reduces learning time, but field sets remain specific to each entity.

### 12.7. Client Page

The client page contains:

- company or client identity;
- contact information;
- compact legal or business details;
- related orders;
- quick action **“Створити замовлення”**.

Do not imitate a full CRM profile. Communication timelines, lead stages, and reminders are outside the current scope.

### 12.8. Versions

Display versions as a chronological list or table with:

- version number;
- author;
- date;
- comment;
- cost;
- selling price;
- margin;
- state: draft, sent, or approved.

The approved version has a clear locked state. A user can:

- open;
- compare relevant totals and changed configuration rows;
- generate a quotation;
- create a new draft from it.

Do not allow direct editing of the approved version.

### 12.9. Quotation Preview

Use a clean document preview centered on a neutral background.

Provide:

- Ukrainian document content;
- clear company and client identity;
- readable product description;
- unit price and total;
- print and PDF actions;
- visible source version.

The preview must look like a business document, not an application card.

---

## 13. Core UX Scenarios

### 13.1. Start the Day and Find What Requires Attention

**User goal:** Understand priorities without opening many sections.

Flow:

1. The Manager opens **“Огляд”**.
2. The system shows a short list of orders requiring action.
3. Each row explains the reason: missing calculation, pending approval, approaching deadline, or incomplete handover.
4. The row provides one contextual next action.
5. The Manager opens the order in the relevant tab, not always at the first tab.

UX requirements:

- no decorative dashboard metrics;
- urgent and important items are visually distinct but calm;
- the system does not use red for ordinary pending work;
- returning to Overview preserves the previous position.

### 13.2. Create an Order with a New Client

**User goal:** Create an order without first visiting the client catalog.

Flow:

1. The Manager clicks **“Створити замовлення”**.
2. The client selector searches existing clients.
3. If no client is found, **“+ Додати нового клієнта”** opens a side panel.
4. The Manager enters the minimum required client data and saves.
5. The panel closes; the new client is selected automatically.
6. The Manager continues the order without lost data.

UX requirements:

- duplicate warning appears before creation;
- the parent order draft remains visible behind the panel;
- the user returns to the exact field that initiated creation.

### 13.3. Build a Standard Product

**User goal:** Create a reusable product with reliable costing.

Flow:

1. The Administrator opens **“Вироби”** and clicks **“Створити виріб”**.
2. The editor shows required sections and current completeness.
3. The Administrator adds sizes, materials, operations, and decoration methods.
4. Missing resources are created inline.
5. The sticky summary recalculates after valid changes.
6. Invalid or incomplete rows show field-level explanations.
7. The product can be activated only when the control calculation is complete.

UX requirements:

- no full-page stepper that hides previous sections;
- direct jump to incomplete sections;
- cost changes show a brief visual update without flashing the whole page;
- activation explains every missing requirement.

### 13.4. Calculate a Standard Order

**User goal:** Produce a client-ready price quickly.

Flow:

1. The Manager selects a standard product.
2. The system copies its configuration into the order.
3. The Manager enters total quantity and size distribution.
4. The system calculates cost, selling price, total, and margin.
5. The Manager reviews calculation components.
6. The Manager saves a named version.
7. The Manager generates a quotation from that version.

UX requirements:

- the source template is clearly identified;
- order-specific edits are marked as local to the order;
- the current price source and active rules are available without leaving the page;
- the save-version action is more prominent than raw draft saving.

### 13.5. Configure a Non-Standard Product

**User goal:** Modify a product without damaging the standard template.

Flow:

1. The Manager copies a standard product or starts from scratch.
2. The configuration shows editable composition rows.
3. The Manager replaces or adds resources.
4. Each change updates the calculation summary.
5. Modified rows receive a subtle **“Змінено”** indicator.
6. The original standard product remains unchanged.

UX requirements:

- show the difference between inherited and changed values;
- provide undo for a recent row-level change where practical;
- offer **“Повернути як у типовому виробі”** for inherited rows;
- avoid a separate page for every material or operation.

### 13.6. Add a Missing Material During Configuration

**User goal:** Continue the calculation without navigation loss.

Flow:

1. Material search returns no suitable result.
2. The user clicks **“+ Додати новий матеріал”**.
3. A side panel opens with required fields.
4. The system checks likely duplicates.
5. The user saves.
6. The record appears in the central catalog and current row.
7. Focus returns to the next logical field, such as consumption rate.

UX requirements:

- do not reset the calculation;
- do not open a new browser page;
- do not require repeating the search;
- show success in the context of the new row.

### 13.7. Adjust Price Within Margin Limits

**User goal:** Negotiate a price while understanding profitability.

Flow:

1. The Manager edits the permitted selling price field.
2. The system recalculates total, profit, and actual margin immediately.
3. The margin indicator changes state without relying only on color.
4. If the price remains within limits, the Manager can save.
5. If it falls below the minimum, saving is blocked or Administrator approval is requested.

UX requirements:

- cost remains visually unchanged;
- explain target and minimum margin;
- show the effect before confirmation;
- provide a specific action **“Запросити погодження”** when applicable;
- never silently restore the previous value without explanation.

### 13.8. Save and Approve a Version

**User goal:** Preserve exactly what was sent to and approved by the client.

Flow:

1. The Manager clicks **“Зберегти версію”**.
2. A short dialog requests a version name or comment.
3. The version appears in the Versions tab.
4. A quotation references this version.
5. After client approval, an authorized user selects **“Позначити погодженою”**.
6. The system explains that the version will become immutable.
7. The approved version displays a lock and approval metadata.

UX requirements:

- clearly distinguish draft, saved version, and approved version;
- approval cannot be triggered accidentally;
- all later changes begin from **“Створити нову версію”**;
- do not hide previous approved data.

### 13.9. Hand an Order Over to Production

**User goal:** Confirm that production receives complete and approved information.

Flow:

1. The authorized user selects **“Передати у виробництво”**.
2. A readiness panel checks approved version, quantities, sizes, prices, files, notes, and deadline.
3. Missing items are listed with direct actions leading to the exact field or tab.
4. When complete, the user confirms handover.
5. The order status changes and the specification is locked.
6. The user can open or print the production specification.

UX requirements:

- the readiness check helps resolve problems instead of only displaying an error;
- the confirmation names the order and approved version;
- the resulting state is persistent and visible;
- no shop-floor task UI appears in the base version.

### 13.10. Change an Approved Order

**User goal:** Make a controlled change without losing history.

Flow:

1. The Manager opens an approved version.
2. Edit controls are not available directly.
3. The Manager clicks **“Створити нову версію”**.
4. The system creates a draft copy and identifies its source version.
5. Changes are made and recalculated.
6. The new version follows the same approval process.

UX requirements:

- never make an immutable version look editable;
- show the relationship between versions;
- preserve the previous approved version;
- make changed rows easy to identify.

### 13.11. Recover from a Validation or Network Error

**User goal:** Continue working without losing entered data.

Flow:

1. A save fails.
2. The system keeps the form values.
3. Field problems are shown inline.
4. A system problem shows a concise Ukrainian message and retry action.
5. The user corrects or retries.
6. The system confirms the saved state.

UX requirements:

- never clear the form after a failed request;
- distinguish validation from system failure;
- prevent duplicate records after repeated requests;
- show whether the current state is saved.

---

## 14. Responsive Behavior

### 14.1. Desktop and Laptop

Primary design target:

- 1280–1600 px viewport width;
- persistent sidebar;
- full-width tables;
- split order workspace with sticky summary;
- contextual tabs and side panels.

At approximately 1100–1279 px:

- reduce page padding;
- collapse non-essential table columns;
- allow the summary to become a compact sticky top strip;
- preserve the main workflow without browser zoom.

### 14.2. Tablet

At approximately 768–1099 px:

- sidebar becomes collapsible;
- large tables may use horizontal scrolling with frozen primary columns;
- side panels can occupy most of the viewport;
- editing remains possible for core fields;
- primary actions remain visible.

A specialized mobile application and full phone-first editing are outside the base-version scope.

---

## 15. Accessibility

- meet WCAG 2.2 AA contrast for text and controls;
- never communicate status only through color;
- provide visible keyboard focus;
- maintain logical tab order;
- support keyboard operation for navigation, dialogs, panels, and common table actions;
- provide accessible names for icon-only controls;
- associate labels, helper text, and errors with form fields;
- move focus to the first error after a failed submission when appropriate;
- respect reduced-motion preferences;
- do not use hover as the only way to discover essential functionality;
- keep interactive targets large enough for comfortable use;
- ensure Ukrainian text remains readable at 200% browser zoom.

---

## 16. Ukrainian Interface Copy

### 16.1. Language Style

All user-facing text must be Ukrainian.

Use:

- concise, direct language;
- familiar business terms;
- sentence case;
- action-oriented button labels;
- consistent names for the same object;
- short explanations of consequences.

Avoid:

- mixed Ukrainian and English labels;
- developer terminology;
- vague error messages;
- excessive politeness that lengthens routine actions;
- multiple synonyms for the same system entity.

### 16.2. Action Labels

Preferred:

- Створити замовлення;
- Створити виріб;
- Додати матеріал;
- Зберегти зміни;
- Зберегти версію;
- Сформувати пропозицію;
- Запросити погодження;
- Позначити погодженою;
- Створити нову версію;
- Передати у виробництво;
- Архівувати.

Avoid generic:

- ОК;
- Далі, when the destination is unclear;
- Виконати;
- Продовжити, when a specific action is possible;
- Підтвердити, without naming what will be confirmed.

### 16.3. Error Structure

An effective error contains:

1. What happened.
2. Why the action cannot continue.
3. What the user can do.

Example:

**“Не вдалося зберегти ціну. Після зміни маржа становитиме 14%, що нижче дозволених 18%. Змініть ціну або запросіть погодження адміністратора.”**

---

## 17. Motion and Feedback

Motion is functional and restrained:

- 120–180 ms for hover and small state transitions;
- 180–240 ms for side panels and dropdowns;
- no long entrance animations;
- no staggered animation of dashboard cards;
- no animation of every calculated number;
- use a brief highlight to show which calculation row changed;
- respect prefers-reduced-motion.

Loading states should preserve layout. Do not replace an entire working screen with a spinner when only one section is updating.

---

## 18. Anti-Patterns to Avoid

The design must not contain:

- a dashboard made from many colorful metric cards;
- cards nested inside cards;
- excessive white-space that forces unnecessary scrolling;
- giant headings and marketing-style hero sections;
- gradients, glassmorphism, glow, or decorative blobs;
- inconsistent icon families;
- emoji used as interface icons;
- a green background across most of the application;
- multiple competing accent colors;
- hidden primary actions;
- a separate page for every small editing operation;
- deep menus that mirror database tables rather than user tasks;
- a wizard that prevents users from seeing related configuration and calculation data;
- duplicated filters or actions at several levels;
- placeholder charts without a business decision;
- inactive menu items for future modules;
- uncontrolled inline editing of dependent business rules;
- hardcoded Ukrainian strings scattered across components;
- mobile-sized controls and empty space on desktop;
- generic template names or text unrelated to textile production.

---

## 19. Design System Implementation Rules

The developer or AI agent must:

1. Create centralized design tokens for color, typography, spacing, radius, borders, elevation, and motion.
2. Create one shared component system before styling individual pages independently.
3. Use semantic tokens such as surface, text-primary, action-primary, warning, and danger rather than raw colors inside feature components.
4. Use one icon family plus a small compatible custom domain set.
5. Keep all user-facing strings in the Ukrainian localization layer.
6. Reuse the same table, form, filter, side-panel, status, empty-state, and confirmation patterns across modules.
7. Avoid duplicating a component only because it appears on another page.
8. Test all components with long Ukrainian labels and realistic production data.
9. Verify common laptop resolutions and 200% zoom.
10. Check loading, empty, validation, error, success, disabled, archived, draft, and approved states.
11. Review every screen in a running browser, not only from source code.
12. Compare visual rhythm, spacing, alignment, and information density across all implemented pages.
13. Preserve the business logic and permissions from the main product specification.
14. Never add a future module merely to make the sidebar or dashboard look fuller.
15. Use realistic textile-production terminology in UI examples and test fixtures.

---

## 20. Screen Review Checklist

Before a screen is considered complete, verify:

### Structure

- Is the page purpose immediately clear?
- Is there one primary next action?
- Does the layout use available space efficiently?
- Are related elements grouped without unnecessary nested cards?
- Can the task be completed without avoidable page switching?

### Hierarchy

- Are title, object identity, status, and primary action easy to find?
- Are first- and second-priority text visibly different?
- Are important totals and warnings more prominent than metadata?
- Is typography consistent with the defined scale?

### Interaction

- Can missing supporting data be created without context loss?
- Are errors shown next to the relevant field?
- Is unsaved work protected?
- Do disabled actions explain why?
- Are state-changing actions explicit and safe?

### Tables and Forms

- Are numeric values and units aligned consistently?
- Are columns prioritized correctly?
- Are filters visible and easy to reset?
- Are field labels and helper text concise?
- Does the interface work with long Ukrainian names?

### Visual Quality

- Is white the main working surface?
- Is green used intentionally?
- Are borders, radii, and shadows consistent?
- Are icons from one coherent family?
- Is the screen free from decorative or generic AI-generated elements?

### Accessibility

- Is contrast sufficient?
- Is focus visible?
- Can the screen be operated with a keyboard?
- Are statuses understandable without color?
- Does the layout remain usable when zoomed?

---

## 21. Definition of UX/UI Completion

The UX/UI of the base version is ready when:

- all included screens use one coherent design system;
- navigation separates operational work from settings;
- the main order and product workflows can be completed without excessive switching;
- missing related records can be created inline;
- calculations are understandable and traceable;
- draft, saved, approved, and handed-over states are visually distinct;
- the interface is fully Ukrainian;
- typography and spacing remain consistent across tables, forms, pages, and documents;
- green functions as a controlled brand and action accent;
- all major states and errors are designed;
- the interface works at common laptop resolutions;
- visual review confirms that the product looks purpose-built for production management rather than like a generic admin template.

---

## Final Design Direction

Build a light, white-and-green 2026 SaaS product with compact professional typography, rational use of screen space, clear visual separation, and deeply considered task-oriented flows.

The interface should help the user understand the next action, preserve context, and complete costing and order preparation with confidence. Visual polish must support operational clarity; it must never compete with the data.
