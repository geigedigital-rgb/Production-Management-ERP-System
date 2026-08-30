# Technical Specification

## Base Version of the Costing, Order, and Production Management Service for Corporate Apparel Manufacturing

**Document status:** Technical specification for the base version  
**Specification language:** English  
**User interface language:** Ukrainian  
**Primary currency:** Ukrainian hryvnia (UAH)

---

## Language and Localization Rules

- All technical documentation, source code, database entities and fields, API contracts, component names, file names, tests, and developer-facing messages must be written in English.
- All user-facing content must be displayed in Ukrainian.
- User-facing content includes navigation, buttons, forms, field labels, tables, statuses, notifications, validation messages, errors, empty states, confirmations, quotations, specifications, and printable documents.
- The default locale is uk-UA.
- Currency values must use UAH and the hryvnia symbol (₴) where appropriate.
- Dates, numbers, quantities, percentages, and monetary values must be formatted according to the Ukrainian locale.
- User-facing strings must not be hardcoded across individual components. They must be stored in a centralized localization layer so that additional interface languages can be added later.
- User-entered Ukrainian text must be stored, searched, sorted, exported, and printed correctly.
- Internal enum and status identifiers must be in English, while their visible labels must be in Ukrainian.

---

## 1. Summary of Agreed Product Requirements

The company manufactures corporate apparel for custom B2B orders: T-shirts, polo shirts, hoodies, sweatshirts, medical uniforms, workwear, and other textile products. A single order may vary by model, fabric, trims, manufacturing operations, branding or decoration method, size range, and production quantity.

Current cost calculations are maintained in Google Sheets. They account for materials, prices, consumption rates, cutting, sewing, other operations, decoration, quantity-based rules, sizes, and standard output per shift.

The base version must not be built as an isolated product calculator. It is the foundation of a complete order and production management service. It must allow users to:

- maintain centralized reference catalogs for materials, trims, operations, decoration methods, prices, and standards;
- create reusable standard product templates with a default configuration;
- create a custom product configuration from a standard template or from scratch;
- create a missing material, operation, client, or product without leaving the current workflow;
- automatically calculate cost, selling price, total value, profit, and margin;
- apply quantity tiers, sizes, waste, fixed costs, and agreed coefficients;
- maintain a client and order database;
- save calculation alternatives and lock the approved version;
- generate a simple commercial quotation;
- hand an approved specification over to production by changing the order status.

The base version must be simple enough for the business owner and managers. After initial configuration, authorized users must be able to add and maintain data and operate the system without developer assistance.

Future modules are outside the current functional scope. However, the architecture of the base version must not prevent their later connection.

---

## 2. Goal of the Base Version

The goal is to move the core operating logic from Google Sheets into one web application and provide an end-to-end workflow:

~~~mermaid
flowchart TD
    A[Client and request] --> B[Standard product or custom configuration]
    B --> C[Materials, operations, and decoration]
    C --> D[Automatic cost calculation]
    D --> E[Saved version and quotation]
    E --> F[Approved order]
    F --> G[Specification handed over to production]
~~~

The result must be a working system in which a manager can complete this entire workflow without duplicating data across multiple spreadsheets or pages.

---

## 3. Core System Principles

### 3.1. Single Source of Truth

A material, operation, decoration method, client, or standard product is created once in the central database and reused throughout the system. Separate copies for different sections or workflows must not be created.

### 3.2. Separation Between Workspaces and Settings

The system must provide two clearly separated navigation groups.

**Operational workspace:**

- overview and orders;
- clients;
- products;
- calculations and approved versions;
- commercial quotations.

**Settings workspace:**

- materials and trims;
- manufacturing operations;
- decoration methods;
- quantity and size rules;
- price and margin rules;
- users and permissions;
- company details.

Configuration sections must not overload the manager's daily workspace.

### 3.3. Inline Creation Within the Current Workflow

If a required record does not exist while the user is creating a product or order, the user must not lose entered data or navigate away through the main menu.

Selection fields must provide the action **“+ Додати новий”** (“+ Add new”). It opens a compact side panel or modal dialog. After the record is saved, it is automatically selected in the current product or order.

This rule applies to:

- clients;
- materials and trims;
- operations;
- decoration methods;
- standard products.

Records created inline must be saved to the same central catalogs. The system must not maintain a separate temporary database.

### 3.4. Versioning Instead of Overwriting

The current draft can be edited. When an important option is saved, the system creates a calculation version. When the client approves it, its configuration, prices, rules, and results become immutable.

Changing a material price in the reference catalog must not change an already approved order. New catalog prices are used only in new drafts and new versions.

### 3.5. Extensibility

Base-version entities must have stable identifiers and explicit relationships. Future inventory, procurement, production, payroll, CRM, and finance modules must connect to existing materials, products, clients, orders, and specifications without recreating the database.

Inactive modules must not appear as empty pages or non-functional buttons. They must be introduced through separate routes, permissions, and feature flags in future versions.

---

## 4. Scope of the Base Version

### 4.1. Included

- user authentication;
- Administrator and Manager roles;
- a start screen with the order list;
- client database;
- catalogs of materials, trims, operations, decoration methods, standards, and prices;
- standard product cards;
- custom product configuration builder;
- cost, selling price, profit, and margin calculation;
- quantity and size rules within the agreed calculation logic;
- manual price adjustment according to permissions;
- orders, statuses, deadlines, responsible manager, and files;
- calculation versions and locking of the approved version;
- one simple commercial quotation document;
- the **“Передано у виробництво”** (“Handed over to production”) status and a locked production specification;
- initial import of agreed structured data.

### 4.2. Excluded

- workshop capacity planning;
- task assignment to seamstresses and other production workers;
- actual output, defects, rework, and payroll accounting;
- inventory balances, reservations, material movements, and write-offs;
- procurement, suppliers, and automatic material requirements;
- a complete CRM pipeline, reminders, telephony, and communication history;
- Cash Flow, P&L, accounting, and tax reporting;
- a 3D apparel constructor or graphical placement of decoration;
- a mobile application;
- complex external integrations;
- automatic delivery of quotations by email or messenger;
- hosting, domain registration, paid APIs, and third-party service subscriptions.

In the base version, handing an order over to production means locking the approved specification and changing the order status. Internal production task allocation is not included.

---

## 5. Users and Permissions

### 5.1. Administrator

The Administrator represents the business owner or an authorized manager.

The Administrator can:

- view all orders and clients;
- manage users;
- create and edit all reference catalogs;
- change global price, margin, quantity, and size rules;
- create, edit, duplicate, and archive standard products;
- allow or restrict manual price changes;
- approve a price below the minimum margin;
- save a custom configuration as a new standard product;
- view all versions and administrative information.

### 5.2. Manager

The Manager can:

- create and edit clients;
- create orders;
- select a standard product or build a configuration from scratch;
- create materials, operations, decoration methods, and products inline while working;
- modify the configuration of a specific order;
- obtain an automatic calculation;
- adjust the selling price only within the permitted range;
- save versions, generate quotations, and change order statuses.

The Manager cannot:

- change the global calculation formula;
- change the minimum margin;
- permanently delete records that have already been used;
- modify a locked approved version;
- manage users.

### 5.3. Safe Editing

Records that have already been used in calculations must not be physically deleted. The Administrator can mark them as archived. Archived records are excluded from new selections but remain available in historical versions.

---

## 6. Navigation Structure

### 6.1. Operational Workspace

- **“Огляд”** (“Overview”) — active orders, deadlines, statuses, and quick actions.
- **“Замовлення”** (“Orders”) — order list, search, filters, and order creation.
- **“Клієнти”** (“Clients”) — client database and related orders.
- **“Вироби”** (“Products”) — standard products, calculated base price list, and new product creation.

### 6.2. Settings Workspace

- **“Матеріали та фурнітура”** (“Materials and trims”);
- **“Операції”** (“Operations”);
- **“Нанесення”** (“Decoration”);
- **“Правила калькуляції”** (“Calculation rules”);
- **“Користувачі”** (“Users”);
- **“Компанія та документи”** (“Company and documents”).

Calculation must not exist as an isolated section that users have to find separately. The primary calculation must be performed directly inside the product or order card.

Recommended route map:

- /overview — overview;
- /orders and /orders/:id — order list and order card;
- /clients and /clients/:id — clients;
- /products and /products/:id — standard products and product editor;
- /settings/resources — materials and trims;
- /settings/operations — operations;
- /settings/applications — decoration methods;
- /settings/pricing — calculation and pricing rules;
- /settings/users — users;
- /settings/company — company details and quotation template.

---

## 7. Core Entities and Relationships

~~~mermaid
flowchart TD
    A[Catalogs: materials, operations, decoration] --> B[Standard product]
    B --> C[Order item configuration]
    A --> C
    D[Client] --> E[Order]
    E --> C
    C --> F[Calculation version]
    G[Pricing rules] --> F
    F --> H[Commercial quotation]
    F --> I[Approved specification]
~~~

### 7.1. Material or Trim

Required data:

- name;
- type: fabric, other material, or trim;
- category;
- unit of measure;
- purchase price;
- default waste percentage, when applicable;
- status: active or archived.

Optional data according to the agreed logic:

- supplier or internal code;
- color or other characteristic;
- price effective date;
- note.

The default consumption rate is stored in the composition of a specific product because the same material may have different consumption rates in different product models.

### 7.2. Manufacturing Operation

Examples include cutting, sewing, finishing, and packaging.

Operation data:

- name;
- category;
- calculation method;
- base rate or cost;
- standard output per shift, when used by the formula;
- quantity rules, when cost depends on quantity;
- optional size coefficient;
- status.

The standard for a specific product is independent of the actual output of an individual seamstress. The base version calculates the standard manufacturing cost, not the actual wage of a specific worker.

If larger sizes require a percentage surcharge, it is represented as an operation size coefficient. Calculation of an individual seamstress's wage remains part of a future module.

### 7.3. Decoration Method

Decoration method data:

- method name;
- calculation unit;
- setup or fixed cost;
- unit rate;
- quantity-based price tiers, when applicable;
- status.

The fixed setup cost applies to the entire quantity and is divided among units only when displaying unit cost.

### 7.4. Standard Product

A standard product is a reusable template, not an inventory item.

The product card contains:

- name;
- internal code;
- category;
- short description;
- image, when available;
- available sizes;
- materials and trims with consumption rates;
- operations with standards or rates;
- available decoration methods;
- standard additional costs;
- quantity and size dependencies;
- status.

The system generates the calculated base price list for standard products from current catalog prices. A separate manually maintained price list that duplicates the calculation must not be created.

### 7.5. Client

The client card contains:

- company name or full name;
- contact person;
- telephone;
- email;
- legal details or note;
- related orders.

The base version does not include a complete CRM history of calls, correspondence, or reminders.

### 7.6. Order

The order card contains:

- automatically generated number;
- client;
- responsible manager;
- request name or short description;
- total quantity and size distribution;
- requested and approved date;
- status;
- configuration;
- calculation versions;
- files, logos, and comments;
- approved specification.

Default visible statuses:

1. **“Чернетка”** (“Draft”).
2. **“Розрахунок”** (“Calculation”).
3. **“На погодженні”** (“Pending approval”).
4. **“Погоджено”** (“Approved”).
5. **“Передано у виробництво”** (“Handed over to production”).
6. **“Закрито”** (“Closed”).
7. **“Скасовано”** (“Cancelled”).

Internal status identifiers must be stable English enum values and must be separate from the Ukrainian visible labels.

### 7.7. Calculation Version

A calculation version stores an immutable snapshot of:

- product composition;
- standards and quantities;
- material and operation prices;
- quantity and sizes;
- applied coefficients;
- cost;
- selling price;
- profit and margin;
- author, date, and comment.

One version can be marked as approved by the client. After approval, it cannot be edited.

### 7.8. Technical Relationship Rules

- A standard product references catalog records through composition, operation, and decoration rows.
- A composition row stores both the material reference and the consumption rate specific to that product.
- An order item is created as a working copy of a standard configuration or from scratch.
- Editing an order item must not modify the standard product or reference catalogs.
- A draft calculation uses current catalog records and current pricing rules.
- A saved version stores its own snapshots of names, units, standards, rates, prices, and calculated results.
- A commercial quotation always references a specific saved version, never the mutable draft.
- An approved specification always references the approved version.
- Future inventory and production documents must reference the approved specification rather than rebuilding the product composition.
- Updating a catalog affects new drafts but must not change saved or approved versions.

---

## 8. Functional Requirements

### 8.1. Authentication

- sign in with email or login and password;
- access only to permitted sections and actions;
- ability for the Administrator to activate or deactivate a user;
- passwords must never be stored in plain text;
- authentication is required again after the session expires.

### 8.2. Overview and Order List

The start screen displays:

- active orders;
- number, client, product, responsible manager, status, and deadline;
- simple counts grouped by status;
- overdue or approaching deadlines;
- quick actions **“Створити замовлення”** (“Create order”) and **“Створити виріб”** (“Create product”).

Available functions:

- search by number, client, or product;
- filters by status, manager, and deadline;
- sorting;
- opening the order card without duplicating pages.

The overview must not become a complex analytics dashboard in the base version. Its primary purpose is to help the user quickly find work that requires attention.

### 8.3. Reference Catalogs

Every reference catalog provides:

- a searchable and filterable list;
- create;
- edit;
- duplicate when useful;
- archive;
- required-field validation;
- likely-duplicate warning.

When a record is created, the system checks at least the combination of name, category, and unit of measure. The user can open an existing matching record instead of creating a duplicate.

Units of measure must be selected from one centralized list. Free-text variants such as “м”, “метр”, and “метри” must not create separate units.

### 8.4. Creating a Standard Product

The user:

1. Enters the product's primary data.
2. Selects available sizes.
3. Adds materials and trims and defines their consumption rates.
4. Adds operations and their parameters.
5. Adds available decoration methods.
6. Selects or verifies quantity, size, and pricing rules.
7. Reviews a control calculation.
8. Saves the product as an active template.

If a required material or operation does not exist, the user creates it through **“+ Додати новий”** without closing the product card.

The system must not allow a standard product to become active if its composition contains rows without a unit, price, consumption standard, or calculation method.

### 8.5. Creating a Custom Configuration

A configuration is created in one of two ways:

- by copying a standard product;
- from scratch using existing catalogs.

Within a specific order, the user can:

- add, replace, or remove a material;
- change a consumption rate;
- add or remove a trim;
- add, replace, or remove an operation;
- add or change a decoration method;
- add an agreed additional cost;
- change the total quantity and size distribution;
- add a comment explaining a non-standard decision.

The system recalculates the result after every relevant change.

Order-specific changes must not modify the source standard product. Only the Administrator can explicitly save a configuration as a new standard template.

### 8.6. Inline Creation of a Missing Record

Inline creation flow:

1. The user opens a selection field.
2. Search does not find the required record.
3. The user clicks **“+ Додати новий матеріал”** (“+ Add new material”).
4. A side panel opens with the minimum required fields.
5. On save, the system checks for duplicates and validates the data.
6. The new material is stored in the main catalog.
7. The panel closes and the new material is automatically added to the current configuration.
8. Previously entered data is preserved.

The same behavior applies to a client, operation, decoration method, and product.

### 8.7. Cost Calculation

Base formula:

**Materials + trims + operations + decoration + approved additional costs = total cost.**

The system must display:

- cost per unit;
- total cost for the entire quantity;
- materials subtotal;
- operations subtotal;
- decoration subtotal;
- additional costs;
- selling price per unit;
- total selling value;
- profit amount and margin.

If coefficients or consumption standards differ by size, the calculation must be performed separately for each size and then aggregated.

#### Materials and Trims

Base material-row formula:

**Consumption per unit × product quantity × size coefficient × (1 + waste percentage) × purchase price.**

If a size coefficient or waste is not applicable, use 1 or 0 respectively.

#### Operations

An operation can be calculated:

- using a direct unit rate;
- using a rate derived from shift cost and standard output;
- using an agreed quantity-based rate.

When a per-shift standard is used:

**Operation cost per unit = agreed shift cost / standard units per shift.**

A size coefficient may increase the standard operation cost. The individual productivity of a specific seamstress must not affect the standard base-version calculation.

#### Decoration

Base formula:

**Fixed setup cost + applicable quantity-tier unit rate × quantity.**

For unit-cost display, the fixed component is divided by the number of products.

#### Quantity Rules

The system determines the quantity tier using the order's total quantity. Rule priority:

1. Rule for the specific product or specific calculation row.
2. Rule for the category.
3. Global system rule.

Exact tiers and formulas are transferred from the client's approved control calculations. The base version must not introduce a universal editor for arbitrary mathematical formulas.

#### Size Rules

Each size can define:

- a material consumption coefficient;
- an operation cost coefficient for selected operations;
- an agreed surcharge percentage.

A coefficient applies only to explicitly selected cost components and must not automatically multiply the entire calculation.

### 8.8. Selling Price and Margin

The Administrator selects the agreed pricing method.

For margin-based pricing:

**Selling price = cost / (1 - margin).**

For markup-based pricing:

**Selling price = cost × (1 + markup).**

The agreed rounding rule is applied after calculation.

The Administrator defines:

- target margin;
- minimum permitted margin;
- limits for manual price adjustment by a Manager.

A Manager can modify the final price within the permitted range. If the change reduces the margin below the minimum, the system must block saving or require Administrator approval.

A manual price never changes the cost. The system must always recalculate and display the actual margin after the selling price changes.

### 8.9. Calculated Base Price List

For active standard products, the system displays calculated prices for the agreed quantity tiers.

The price list is generated automatically from:

- the current standard configuration;
- current catalog prices;
- active quantity, size, and margin rules.

The price list is an operational estimate. When a specific order is created, the system creates a separate calculation using the actual quantity, sizes, and configuration changes.

### 8.10. Clients and Orders

A client can be created:

- in the **“Клієнти”** (“Clients”) section;
- directly while creating an order.

After selecting the client, the Manager creates an order and adds the product, total quantity, sizes, deadline, files, and comments.

In the base version, an order contains one primary item with its own configuration and calculation. The database must still use a separate OrderItem entity so that multiple order items can be supported later without rebuilding clients, orders, calculations, or versions.

### 8.11. Versions, Approval, and Changes

- the draft is updated while the user works;
- the user creates a named version before sending information to the client;
- each version has a number, date, author, and comment;
- a generated quotation references one specific version;
- after approval, one version receives the visible label **“Погоджено клієнтом”** (“Approved by client”);
- the approved version becomes immutable;
- changes after approval are made by copying the version into a new draft;
- the previous approved version remains available for comparison and history.

The system must never silently recalculate or overwrite approved versions after reference catalogs are updated.

### 8.12. Commercial Quotation

The system generates one agreed simple template using data from a saved version.

The document contains:

- company logo and legal details;
- client information;
- number and date;
- product or order item;
- short configuration description;
- quantity;
- unit price;
- total amount;
- deadline;
- note.

The quotation can be previewed, printed, and saved as PDF using system or browser capabilities.

### 8.13. Handing an Order Over to Production

Before handover, the system verifies:

- an approved version exists;
- total quantity and size distribution are complete;
- no rows are missing standards or prices;
- required files and comments have been recorded;
- a deadline has been defined.

After confirmation:

- the order receives the status **“Передано у виробництво”** (“Handed over to production”);
- the approved configuration is locked as the production specification;
- the specification can be viewed or printed;
- later changes require a new version and renewed approval.

Worker tasks, production queues, shifts, and actual execution are not created in the base version.

### 8.14. Files and Notes

The user can attach to a client or order:

- a logo;
- a technical file;
- a reference;
- an approved document;
- a text note.

Allowed formats and maximum file size must be configurable. Each file is stored once and linked to the corresponding client or order.

### 8.15. Basic Activity History

For important entities, the system stores:

- creation date;
- creator;
- last modification date;
- last modifying user;
- status changes;
- version creation and approval events.

A complete audit trail for every click is not required in the base version.

---

## 9. Core Workflows

### 9.1. Adding a New Standard Product

1. The user opens **“Вироби”** (“Products”) and clicks **“Створити виріб”** (“Create product”).
2. The user enters the name, category, code, and sizes.
3. The user adds materials, operations, and decoration methods.
4. If required, the user creates a missing material in a side panel.
5. The user enters standards and reviews the automatic control calculation.
6. The user saves a draft or activates the standard product.
7. The product becomes available for new orders and the calculated base price list.

### 9.2. Calculating a Standard Order

1. The Manager creates or selects a client.
2. The Manager creates an order.
3. The Manager selects a standard product.
4. The Manager enters total quantity and quantities by size.
5. The system loads the standard configuration and current applicable rules.
6. The system calculates cost, selling price, profit, and margin.
7. The Manager saves a version and generates a quotation.

### 9.3. Calculating a Non-Standard Order

1. The Manager copies a standard product into the order or starts from scratch.
2. The Manager replaces a material or adds a trim, operation, or decoration method.
3. The system recalculates automatically after every relevant change.
4. The source standard product remains unchanged.
5. The Manager adds comments explaining non-standard decisions.
6. After approval, the system saves a separate immutable version.

### 9.4. Change After Approval

1. The Manager opens the approved version.
2. The Manager clicks **“Створити нову версію”** (“Create new version”).
3. The system copies the data into a new draft.
4. The Manager makes changes and receives a new calculation.
5. The new version is approved separately.
6. The history of the previous approval is preserved.

---

## 10. Data Integrity Rules

- One record has one stable identifier regardless of where it was created.
- Inline creation uses the same form schema and rules as the main catalog.
- Used records are archived, not deleted.
- Likely duplicates are shown before saving.
- Required numeric values cannot be negative.
- A zero price or zero standard is allowed only with explicit confirmation and a note when business rules permit it.
- All monetary calculations use sufficient internal precision; rounding is applied only when producing final prices and displayed totals.
- Displayed row amounts and totals must remain mathematically consistent after rounding.
- An approved version must not depend on later catalog changes.
- Editing an order configuration must not change the source template.
- A manually changed selling price must not change the cost.
- All critical actions and permissions must be validated on the server, not only in the interface.
- Database foreign keys and domain constraints must protect critical relationships.
- Concurrent updates must not silently overwrite an approved version or another user's confirmed change.

---

## 11. UX/UI Direction

### 11.1. General Style

The interface must be light, calm, and professional. The main focus is reading tables, working with forms, and understanding the current state of an order quickly.

The supplied screenshots are design direction, not templates to copy. The implementation should adopt:

- clear left-side navigation;
- a wide operational workspace;
- compact data tables;
- a clear object detail page;
- tabs within an object card;
- contextual actions next to the relevant block;
- quiet backgrounds, thin borders, and moderate corner radii;
- one distinctive accent color.

The four supplied references must be attached separately when this specification is provided to the developer or Cursor. Their logos, text, logistics entities, and exact layouts must not be copied. Use only their principles of information density, navigation, tables, and object-detail pages.

The interface must look like a purpose-built system for textile production, not a generic admin dashboard or automatically generated template.

### 11.2. Visual System

Recommended direction:

- application background: warm light gray;
- surfaces: white;
- primary text: graphite or near-black;
- secondary text: neutral gray;
- borders: light gray with minimal shadows;
- accent: warm terracotta or the company brand color after the logo is supplied;
- green is reserved for successful states and must not become the primary product color;
- red is reserved for errors, risk, destructive actions, or blocked states.

Do not use:

- gradients without a functional reason;
- glass effects;
- excessive shadows;
- large decorative shapes;
- unnecessary charts and widgets;
- oversized headings;
- text that is too small;
- a different colored card for every metric;
- non-functional controls for future modules;
- excessive empty space that reduces useful table density;
- animation that delays or distracts from a work action.

### 11.3. Scale and Density

- base body text: 14–15 px;
- table text: 13–14 px;
- page title: 24–28 px;
- section heading: 16–18 px;
- primary input and button height: 38–42 px;
- compact vertical spacing in tables without reducing readability;
- the available width should be used effectively for calculation tables and configuration forms;
- the primary cost, price, and margin summary should remain visible while editing the configuration;
- layouts must remain usable at common laptop resolutions without requiring browser zoom.

### 11.4. Key Calculation Screen Layout

The order card or configuration builder must contain:

- a top section with order number, client, responsible manager, status, and deadline;
- tabs **“Комплектація”**, **“Калькуляція”**, **“Версії”**, and **“Файли”**;
- the main table of materials, operations, and decoration methods;
- a compact summary of cost, selling price, profit, and margin;
- prominent primary actions **“Зберегти версію”**, **“Сформувати пропозицію”**, and **“Погодити”**;
- secondary actions in a contextual menu;
- a side panel for inline creation of missing records.

The user must not have to open several separate pages to complete one calculation.

### 11.5. States and Feedback

The system must provide:

- empty states with one clear primary action;
- loading states that do not cause major layout shifts;
- clear successful-save feedback;
- warnings about unsaved changes;
- understandable validation errors next to the relevant fields;
- confirmation before archiving or locking a version;
- an explanation when an action is blocked;
- prevention of duplicate submissions while a save operation is in progress;
- recovery guidance after a failed operation without discarding user input.

### 11.6. Form and Table Behavior

- Required and optional fields must be clearly distinguishable.
- Tables must support keyboard navigation where practical.
- Column labels, units, totals, and editable values must be visually distinct.
- Long names must be truncated safely with access to the full value.
- Destructive actions must not be placed next to primary save actions.
- Filters must show their active state and provide a clear reset action.
- A return from a detail page should preserve relevant list filters and scroll position.
- Inline-created records must appear immediately in the original selector and remain selected.

---

## 12. Non-Functional Requirements

### 12.1. Architecture

- web application with server-side business logic;
- relational database;
- calculation layer independent of interface components;
- modular structure organized by business domain;
- database migrations under version control;
- ability to expose an API and connect future modules;
- environment configuration through environment variables;
- no critical business logic hidden only in client-side code;
- explicit domain services for calculation, approval, version locking, and handover;
- transaction boundaries for actions that change several related records;
- clear separation between mutable working drafts and immutable snapshots.

Recommended implementation foundation: TypeScript, a modern React framework, PostgreSQL, and an ORM with controlled migrations. The developer may use another stack only if all requirements in this specification are preserved.

### 12.2. Suggested Domain Modules

The codebase should be organized around domains rather than page names:

- authentication and users;
- clients;
- resource catalogs;
- products and configurations;
- calculation engine;
- orders and order items;
- calculation versions and approvals;
- quotations and specifications;
- files;
- company settings;
- activity history.

UI modules may compose these domains, but one page must not own duplicated business logic.

### 12.3. Security

- secure password hashing;
- server-side role and permission checks;
- protection of private routes;
- validation and sanitization of input;
- secure file handling;
- error logging without exposing technical details to users;
- secrets and keys must not be committed to the repository;
- uploaded files must not be executable through public application routes;
- sensitive actions must use authenticated server requests and appropriate CSRF protection where relevant.

### 12.4. Performance

- large lists use pagination or incremental loading;
- search and filters must not block the interface;
- calculations update without a full page reload;
- typical work screens must remain usable with hundreds of materials, products, clients, and orders;
- database indexes must support numbers, names, clients, statuses, and dates;
- expensive derived values should be calculated predictably and must not create unnecessary repeated database queries.

### 12.5. Responsiveness

The primary workflow is designed for laptop and desktop use. A tablet must support viewing and basic editing. A separate mobile application is outside the base-version scope.

### 12.6. Localization and Formats

- all visible interface content is Ukrainian;
- the default locale is uk-UA;
- dates use a clear Ukrainian format;
- currency is UAH;
- units of measure come from one centralized catalog;
- the system time zone is configurable;
- visible status labels are Ukrainian while internal identifiers remain English;
- printable quotations and specifications are Ukrainian;
- code, database names, API fields, tests, and developer documentation are English;
- interface strings are centralized and prepared for additional languages.

### 12.7. Reliability and Error Handling

- a failed save must not silently discard entered data;
- operations that lock versions or hand orders over to production must be atomic;
- repeated requests must not create duplicate versions, quotations, or handover events;
- user-facing errors must explain what the user can correct;
- technical error details belong in server logs, not in the Ukrainian user interface;
- critical state transitions must be validated against the current server state.

---

## 13. Technical Acceptance Criteria

The base version is considered functionally ready when all of the following scenarios work:

- The Administrator creates a material, operation, and decoration method.
- A user creates a missing material without leaving the product card.
- The Administrator creates a standard product with a default configuration.
- The system calculates a standard product for an agreed quantity and size distribution.
- Five agreed control calculations produce the approved results, including the rounding rules.
- The Manager creates a client and order.
- The Manager copies a standard product, changes a material or operation, and receives a new calculation.
- Order-specific changes do not modify the standard template.
- The Manager changes the price within the permitted range and sees the actual margin.
- The system does not allow the Manager to save a price below the minimum margin without approval.
- A user saves a version and generates a commercial quotation.
- An approved version does not change after a catalog material price is updated.
- Changes after approval create a new version.
- An order with an approved version can be moved to **“Передано у виробництво”**.
- The approved production specification can be viewed and printed.
- The Manager cannot access prohibited administrative settings.
- All user-facing content in the above flows is displayed in Ukrainian.
- Internal code, database names, API fields, and tests remain in English.

Technical testing of the base version covers only functions defined in this specification. Future modules must not affect acceptance of the current functionality.

---

## 14. Configurable Calculation Engine Parameters

The developer or AI agent must not invent the following values. They must be transferred from the client's source data and confirmed before final configuration of the calculation engine:

- exact units of measure;
- quantity tiers;
- operation-rate formulas;
- size coefficients;
- waste rules;
- pricing method: margin or markup;
- target and minimum margin;
- limits for manual price adjustment;
- rounding rule;
- initial status list;
- standard products selected for initial import;
- allowed file formats and size limits;
- company details and commercial quotation layout.

Clarifying these parameters does not change the functional scope of the base version unless the clarification introduces new functionality.

Configuration values must be stored as explicit, validated data rather than scattered constants in the codebase.

---

## 15. Preparation for Future Modules

The base version does not implement the modules below, but it must provide stable extension points for them.

### 15.1. Inventory and Procurement

A future module will reuse existing materials, units, and consumption standards. Materials therefore require stable identifiers, and approved specifications require exact quantities.

The base version must not pretend to maintain stock balances, reservations, suppliers, purchase orders, or material movements.

### 15.2. Production Planning

A future module will reuse the approved order, order items, operations, standards, quantity, sizes, and deadline. The handed-over production specification must be an immutable source of data.

The base version stores the information needed for this connection but does not create capacity plans, queues, or worker tasks.

### 15.3. Work Assignment and Payroll

A future module will reuse standard operations from the product configuration, while actual output for an individual worker will be stored separately. Standard product cost must not depend on who accepts a task.

### 15.4. Extended CRM

A future module will reuse existing clients and orders and add leads, contacts, reminders, and communications without duplicating client cards.

### 15.5. Cash Flow and P&L

A future module will use approved order amounts, payments, and actual costs. The base version must not create financial postings or management accounting reports.

### 15.6. Extension Contract

Future modules must connect through:

- stable entity identifiers;
- documented relationships;
- approved order-item specifications;
- explicit domain services or APIs;
- permissions and feature flags;
- database migrations that preserve existing data.

Future functionality must not require duplicate product, client, material, or order records.

---

## 16. Implementation Rules for the Developer or AI Agent

1. Read this specification completely before implementation and do not add functions listed in Section 4.2.
2. Start from the domain model and calculation engine, then build screens around them.
3. Keep calculation business logic in a separate tested module; never duplicate formulas in UI components.
4. Use shared validation schemas for normal creation, inline creation, and editing of each entity.
5. Do not create separate copies of materials, products, or clients for different screens.
6. Apply all database structure changes through migrations.
7. Store approved versions as immutable snapshots, not only as references to current catalog prices.
8. Enforce permissions on the server.
9. Do not display non-functional future modules.
10. Do not use random demo data in the production environment.
11. Cover every primary workflow with an automated test or a reproducible control case.
12. After every material change, verify that existing core workflows still work.
13. UI components may use a proven technical foundation, but the visual system must be personalized for this service.
14. Do not add decorative charts, cards, or animations unless they support a specific work action.
15. Treat every unconfirmed business parameter as configuration; never replace it with an arbitrary assumption.
16. Keep all code, identifiers, schemas, and developer documentation in English.
17. Keep all user-facing interface content and generated business documents in Ukrainian.
18. Preserve user input when validation or a server request fails.
19. Use database transactions for approval, version locking, and production handover.
20. Do not silently change an approved version, even when catalogs or calculation rules change.
21. Before implementing a feature, identify its source data, outputs, dependencies, permissions, and effect on saved versions.
22. Prefer one shared component and one shared domain service for repeated behavior instead of page-specific duplicates.
23. Do not mix settings controls into the operational workspace unless the user is completing an explicitly permitted inline-creation action.
24. For every important screen, implement loading, empty, validation, error, success, and unsaved-change states.
25. Verify Ukrainian localization, numeric formatting, and printable output as part of acceptance testing.

---

## Final Product Boundary

The base version is a usable lightweight production-management ERP/MRP foundation for costing, product configuration, client orders, approvals, quotations, and preparation for production.

It is not yet an inventory, procurement, shop-floor scheduling, payroll, complete CRM, or financial-accounting system. Those capabilities must remain closed until their modules are implemented, while the base architecture and data model remain ready for their future connection.
