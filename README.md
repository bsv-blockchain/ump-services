# BSV Project

Standard BSV project structure.

## UMP retained-lineage release

The custom `ls_users` lookup factory requests retained token-update history
for presentation-hash, recovery-hash, and outpoint queries. It preserves the
existing newest-record selection and database schema. The provider runtime
must use `@bsv/overlay` 2.6.4 or later together with this factory so selected
ancestors remain in the lookup answer after confirmation. Wallet consumers
need Wallet Toolbox, client, or mobile 2.14.6 or later for pin continuity.
The release pins SDK3.1.0 and Overlay Express2.7.4 alongside the engine,
with MongoDB driver7.7.0 to meet their declared runtime dependency contract;
CARS preserves these application dependency pins when generating its runtime.
Deploy the paired provider and engine changes through CARS after publication
and package/provenance verification. Validate confirmed update lineage and
public route availability before production promotion. Existing WAB pins
remain unchanged during this release.
`npm run deploy` uses the CLI's `cars release now 1` command. Keep real
deployment metadata and the resulting release archive in a private operational
context, outside the public source checkout.

Helpful Links:

- [LARS (for local development)](https://github.com/bitcoin-sv/lars)
- [CARS CLI (for cloud deployment)](https://github.com/bitcoin-sv/cars-cli)
- [RUN YOUR OWN CARS NODE](https://github.com/bitcoin-sv/cars-node)
- [Specification for deployment-info.json](https://github.com/bitcoin-sv/BRCs/blob/master/apps/0102.md)

## Getting Started

- Clone this repository
- Run `npm i` to install dependencies
- Run `npm run lars` to configure the local environment according to your needs
- Use `npm run start` to spin up and start writing code
- When you're ready to publish your project, start by running `npm run cars` and configuring one (or, especially for overlays, ideally multiple) hosting provider(s)
- For each of your configurations, execute `npm run build` to create CARS project artifacts
- Deploy with `npm run deploy` and your project will be online
- Use `cars` interactively, or visit your hosting provider(s) web portals, to view logs, configure custom domains, and pay your hosting bills
- Share your new BSV project, it is now online!

## Directory Structure

The project structure is roughly as follows, although it can vary by project.

```
| - deployment-info.json
| - package.json
| - local-data/
| - frontend/
  | - package.json
  | - webpack.config.js
  | - src/...
  | - public/...
  | - build/...
| - backend/
  | - package.json
  | - tsconfig.json
  | - mod.ts
  | - src/
    | - contracts/...
    | - lookup-services/...
    | - topic-managers/...
    | - script-templates/...
  | - artifacts/
  | - dist/
```

The one constant is `deployment-info.json`.

## License

[Open BSV License](./LICENSE.txt)


The lookup integration fixture pins MongoDB7.0.24 and bounds driver selection
and connection below the existing five-second Jest hook limit. Each test still
gets its own disposable server/database. For local qualification,
MONGOMS_SYSTEM_BINARY may identify an independently verified cached binary;
production deployment does not consume this test-only setting.

The test scripts enable Node's VM module support as required by Jest29 for the
MongoDB7 driver's dynamic OS-adapter import. This retains the driver's default
runtime adapter and real server handshakes. Production Node does not need this
Jest-only flag; no connection mocking or test timeout increase is used.
