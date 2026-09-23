# DEG Manager

A DHIS2 web app that keeps **Data Element Groups** in sync with the data elements of their source **Datasets** — bulk create, bulk update, configurable naming/sharing, and a manual mapping mode for datasets that can't be linked automatically.

## Features

- **Datasets view** — lists every dataset, its sync status against the matching Data Element Group, and lets you bulk-create/update groups for a selection (or all datasets at once), with per-dataset progress and a retry-on-failure summary.
- **Data Element Groups view** — lists every group on the instance, its linked dataset (if any), consistency status, and per-group sharing/delete actions.
- **Mappings view** — for instances that can't rely on a shared code/UID convention, pair a dataset with an existing group by hand. Only active when the mapping mode (below) is set to Manual.
- **Configurable mapping mode** (Settings): link a dataset to its group by
  - the group's `code` matching the dataset's `code`,
  - the group's `code` matching the dataset's `id`, or
  - explicit pairs created in the Mappings view.
- **Configurable naming**: an optional prefix/suffix applied to the group's name (and short name) derived from the dataset name, with a live preview.
- **Configurable default sharing** for newly-created groups: either copy the source dataset's own sharing, or set a fixed public-access/user-group policy. Only applied at creation time — an existing group's sharing is never touched by a sync.
- **Sorting and filtering** on every table (name, code, counts, status), plus status filter chips matching across the Datasets and Groups views.
- **French translation** included out of the box (see [Translations](#translations)).

## Requirements

- Node.js 18+ and Yarn
- A DHIS2 instance (2.38+) to develop/deploy against

## Development

```sh
yarn install
yarn start --proxy https://your-dhis2-instance.org
```

`--proxy` is required in development — it points the local dev server at a real DHIS2 instance for API calls (metadata, datastore) while serving the app locally. Without it you'll hit CORS errors.

## Testing

```sh
yarn test
```

Jest + React Testing Library, with `@dhis2/app-runtime`'s `CustomDataProvider` used to mock all `useDataQuery`/`useDataMutation`/`useDataEngine` calls — no network access required.

## Building

```sh
yarn build
```

Produces a deployable `.zip` under `build/bundle/`. This also runs `i18next-scanner` to extract every `i18n.t(...)` call into `i18n/en.pot`, and regenerates the runtime translation bundles under `src/locales/` from `i18n/*.po`.

## Translations

Translatable strings live in `i18n/en.pot` (the source-of-truth English strings, auto-extracted from the code on every build) and `i18n/<locale>.po` (translated strings per locale — currently `fr.po`). To add or update a translation:

1. Run `yarn build` (or `yarn start`) once to refresh `i18n/en.pot` with any new strings.
2. Edit `i18n/<locale>.po`, keeping each `msgid` in sync with `en.pot` and filling in `msgstr` with the translation. Placeholders like `{{count}}` must be preserved verbatim.
3. Run `yarn build` again — the app's runtime picks up the new/changed strings automatically the next time it's deployed, no code changes needed.

The app name "DEG Manager" is intentionally left untranslated across locales, matching how most DHIS2 app names behave in the app menu.

## Settings & data storage

App configuration (mapping mode, naming, default sharing) and manual dataset↔group pairings are stored in the DHIS2 datastore under the `deg-manager` namespace (`settings` and `mappings` keys respectively), so they persist per-instance and are shared by every user of the app. Both are bootstrapped with sensible defaults the first time the app runs against a fresh instance.
